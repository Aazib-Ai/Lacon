/**
 * useWriterLoop — Phase 2 React hook
 *
 * Provides a clean API for the renderer to interact with the writer loop
 * state machine running in the main process via IPC.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react'

import type {
  AutomationLevel,
  OutlineSection,
  OutlineSubsection,
  ReviewResult,
  SectionProgress,
  WriterLoopStage,
  WriterOutline,
  WriterSession,
} from '../../shared/writer-types'

// ─────────────────────────── State ───────────────────────────

export interface WriterLoopState {
  /** Current session from the backend */
  session: WriterSession | null
  /** Current outline (may be null if not yet planned) */
  outline: WriterOutline | null
  /** UI loading flag */
  loading: boolean
  /** Last error message */
  error: string | null
  /** Error metadata for UX feedback */
  errorMeta: {
    timestamp: number
    retryable: boolean
    action: string
    retryFn: (() => void) | null
  } | null
  /** Phase 3: Section generation progress */
  progress: SectionProgress | null
  /** Phase 4: Latest review result */
  review: ReviewResult | null
  /** Phase 4: Review pass count */
  reviewPassCount: number
  /** Phase 4: Whether more auto-passes are available */
  canAutoPass: boolean
  /** Agentic pre-flight steps (real-time progress) */
  preflightSteps: Array<{ id: number; type: string; tool?: string; message: string; timestamp: string }>
  /** Whether pre-flight is currently running */
  preflightRunning: boolean
}

const initialState: WriterLoopState = {
  session: null,
  outline: null,
  loading: false,
  error: null,
  errorMeta: null,
  progress: null,
  review: null,
  reviewPassCount: 0,
  canAutoPass: true,
  preflightSteps: [],
  preflightRunning: false,
}

// ─────────────────────────── Reducer ───────────────────────────

type Action =
  | { type: 'START_LOADING' }
  | { type: 'SET_STATE'; session: WriterSession | null; outline: WriterOutline | null }
  | { type: 'SET_SESSION'; session: WriterSession }
  | { type: 'SET_OUTLINE'; outline: WriterOutline | null }
  | { type: 'SET_ERROR'; error: string; retryable?: boolean; action?: string; retryFn?: (() => void) | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_PROGRESS'; progress: SectionProgress }
  | { type: 'SET_REVIEW'; review: ReviewResult | null; passCount: number; canAutoPass: boolean }
  | { type: 'ADD_PREFLIGHT_STEP'; step: WriterLoopState['preflightSteps'][0] }
  | { type: 'SET_PREFLIGHT_RUNNING'; running: boolean }
  | { type: 'CLEAR_PREFLIGHT' }

function reducer(state: WriterLoopState, action: Action): WriterLoopState {
  switch (action.type) {
    case 'START_LOADING':
      return { ...state, loading: true, error: null, errorMeta: null }
    case 'SET_STATE':
      return {
        ...state,
        session: action.session,
        outline: action.outline,
        loading: false,
        error: null,
        errorMeta: null,
      }
    case 'SET_SESSION':
      return { ...state, session: action.session, loading: false, error: null, errorMeta: null }
    case 'SET_OUTLINE':
      return { ...state, outline: action.outline, loading: false, error: null, errorMeta: null }
    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        loading: false,
        errorMeta: {
          timestamp: Date.now(),
          retryable: action.retryable ?? true,
          action: action.action ?? 'unknown',
          retryFn: action.retryFn ?? null,
        },
      }
    case 'CLEAR_ERROR':
      return { ...state, error: null, errorMeta: null }
    case 'SET_PROGRESS':
      return { ...state, progress: action.progress, loading: false, error: null, errorMeta: null }
    case 'SET_REVIEW':
      return {
        ...state,
        review: action.review,
        reviewPassCount: action.passCount,
        canAutoPass: action.canAutoPass,
        loading: false,
        error: null,
        errorMeta: null,
      }
    case 'ADD_PREFLIGHT_STEP':
      return {
        ...state,
        preflightSteps: [...state.preflightSteps, action.step],
      }
    case 'SET_PREFLIGHT_RUNNING':
      return {
        ...state,
        preflightRunning: action.running,
        ...(action.running ? { preflightSteps: [] } : {}),
      }
    case 'CLEAR_PREFLIGHT':
      return {
        ...state,
        preflightSteps: [],
        preflightRunning: false,
      }
    default:
      return state
  }
}

// ─────────────────────────── Hook ───────────────────────────

export function useWriterLoop(documentId: string | undefined) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ── Helpers ──

  const writerLoop = () => {
    if (!window.electron?.writerLoop) {
      throw new Error('writerLoop API not available')
    }
    return window.electron.writerLoop
  }

  /** Wrap a promise with a timeout to prevent indefinite loading states */
  const withTimeout = <T>(promise: Promise<T>, timeoutMs = 60000, label = 'Operation'): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `${label} timed out after ${Math.round(timeoutMs / 1000)}s. Check your API key and provider settings.`,
          ),
        )
      }, timeoutMs)
      promise
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(err => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }

  const handleResponse = useCallback((response: any, onSuccess?: (data: any) => void) => {
    if (!mountedRef.current) {
      return
    }

    if (!response?.success) {
      dispatch({ type: 'SET_ERROR', error: response?.error?.message || 'Unknown error' })
      return
    }

    if (onSuccess) {
      onSuccess(response.data)
    }
  }, [])

  // ── Fetch State ──

  const fetchState = useCallback(async () => {
    if (!documentId) {
      return
    }
    dispatch({ type: 'START_LOADING' })
    try {
      const res = await writerLoop().getState(documentId)
      if (!res?.success || !mountedRef.current) {
        if (res?.error) {
          dispatch({ type: 'SET_ERROR', error: res.error.message || 'Unknown error' })
        }
        return
      }

      const data = res.data
      console.log(
        `[useWriterLoop:fetchState] Backend returned — stage=${data.session?.stage}, outline=${!!data.outline}, outlineSections=${data.outline?.sections?.length}`,
      )

      // Fetch progress BEFORE dispatching state so both arrive in the same render
      const stage = data.session?.stage
      let progressData = null
      if (stage === 'generating' || stage === 'reviewing' || stage === 'complete') {
        try {
          console.log(`[useWriterLoop:fetchState] Fetching progress (stage=${stage})`)
          const progressRes = await writerLoop().getProgress(documentId)
          if (progressRes?.success && mountedRef.current) {
            progressData = progressRes.data
            console.log(
              `[useWriterLoop:fetchState] Progress fetched — status=${progressData?.status}, results=${progressData?.results?.length}`,
            )
          }
        } catch {
          // Progress is non-critical
        }
      }

      // Dispatch state + progress together so they arrive in the same React batch
      if (mountedRef.current) {
        dispatch({ type: 'SET_STATE', session: data.session, outline: data.outline })
        if (progressData) {
          dispatch({ type: 'SET_PROGRESS', progress: progressData })
        }
      }
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  // Auto-fetch on mount / documentId change
  useEffect(() => {
    fetchState()
  }, [fetchState])

  // Auto-load persisted reviews from disk when documentId changes
  useEffect(() => {
    if (!documentId) {return}
    writerLoop()
      .loadReview(documentId)
      .then((res: any) => {
        if (res?.success && res.data?.result && mountedRef.current) {
          dispatch({
            type: 'SET_REVIEW',
            review: res.data.result,
            passCount: res.data.passCount,
            canAutoPass: res.data.canAutoPass,
          })
        }
      })
      .catch(() => {
        /* ignore — no persisted review */
      })
  }, [documentId])

  // Listen for generation-stopped events (fired by any hook instance after abort)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.documentId === documentId) {
        fetchState()
      }
    }
    window.addEventListener('lacon:generation-stopped', handler)
    return () => window.removeEventListener('lacon:generation-stopped', handler)
  }, [documentId, fetchState])

  // ── Planning ──

  const startPlanning = useCallback(
    async (instruction: string, composedSkillPrompt?: string, researchContext?: any) => {
      if (!documentId) {
        return
      }
      dispatch({ type: 'START_LOADING' })
      dispatch({ type: 'SET_PREFLIGHT_RUNNING', running: true })
      const retryFn = () => startPlanning(instruction, composedSkillPrompt, researchContext)
      try {
        const res = await withTimeout(
          writerLoop().startPlanning(documentId, instruction, composedSkillPrompt, researchContext),
          360000, // 6 minutes — pre-flight (up to 150s) + outline generation (free models are slow)
          'Outline generation',
        )
        dispatch({ type: 'SET_PREFLIGHT_RUNNING', running: false })
        handleResponse(res, outline => {
          dispatch({ type: 'SET_OUTLINE', outline })
        })

        // Fetch preflight results (steps for display)
        try {
          const preflightRes = await writerLoop().getPreflight(documentId)
          if (preflightRes?.success && preflightRes.data?.steps) {
            for (const step of preflightRes.data.steps) {
              dispatch({ type: 'ADD_PREFLIGHT_STEP', step })
            }
          }
        } catch {
          // Preflight data optional — ignore errors
        }

        // Refresh session
        await fetchState()
      } catch (err: any) {
        dispatch({ type: 'SET_PREFLIGHT_RUNNING', running: false })
        dispatch({
          type: 'SET_ERROR',
          error: err.message || 'Planning failed. Please try again.',
          retryable: true,
          action: 'planning',
          retryFn,
        })
      }
    },
    [documentId, handleResponse, fetchState],
  )

  // ── Outline Operations ──

  const updateOutline = useCallback(
    async (outline: WriterOutline) => {
      if (!documentId) {
        return
      }
      try {
        const res = await writerLoop().updateOutline(documentId, outline)
        handleResponse(res, updated => {
          dispatch({ type: 'SET_OUTLINE', outline: updated })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  const updateSection = useCallback(
    async (sectionId: string, updates: Partial<OutlineSection>) => {
      if (!documentId) {
        return
      }
      try {
        const res = await writerLoop().updateSection(documentId, sectionId, updates)
        handleResponse(res, updated => {
          dispatch({ type: 'SET_OUTLINE', outline: updated })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  const addSection = useCallback(
    async (section?: Partial<OutlineSection>) => {
      if (!documentId) {
        return
      }
      try {
        const res = await writerLoop().addSection(documentId, section)
        handleResponse(res, updated => {
          dispatch({ type: 'SET_OUTLINE', outline: updated })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  const removeSection = useCallback(
    async (sectionId: string) => {
      if (!documentId) {
        return
      }
      try {
        const res = await writerLoop().removeSection(documentId, sectionId)
        handleResponse(res, updated => {
          dispatch({ type: 'SET_OUTLINE', outline: updated })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  const addSubsection = useCallback(
    async (sectionId: string, subsection?: Partial<OutlineSubsection>) => {
      if (!documentId) {
        return
      }
      try {
        const res = await writerLoop().addSubsection(documentId, sectionId, subsection)
        handleResponse(res, updated => {
          dispatch({ type: 'SET_OUTLINE', outline: updated })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  const removeSubsection = useCallback(
    async (sectionId: string, subsectionId: string) => {
      if (!documentId) {
        return
      }
      try {
        const res = await writerLoop().removeSubsection(documentId, sectionId, subsectionId)
        handleResponse(res, updated => {
          dispatch({ type: 'SET_OUTLINE', outline: updated })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  // ── Approval ──

  const approveOutline = useCallback(
    async (documentContent?: any) => {
      if (!documentId) {
        return
      }
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await writerLoop().approveOutline(documentId, documentContent)
        handleResponse(res, session => {
          dispatch({ type: 'SET_SESSION', session })
        })
        // Refresh state — generation starts automatically on the backend
        await fetchState()
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchState],
  )

  // ── Config ──

  const updateConfig = useCallback(
    async (config: {
      wordTarget?: number
      automationLevel?: AutomationLevel
      activeSkillIds?: string[]
      modelConfig?: { providerId: string; modelId: string }
    }) => {
      if (!documentId) {
        return
      }
      try {
        const res = await writerLoop().updateConfig(documentId, config)
        handleResponse(res, session => {
          dispatch({ type: 'SET_SESSION', session })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  // ── Stage Control ──

  const pause = useCallback(async () => {
    if (!documentId) {
      return
    }
    try {
      const res = await writerLoop().pause(documentId)
      handleResponse(res, session => {
        dispatch({ type: 'SET_SESSION', session })
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  const reset = useCallback(async () => {
    if (!documentId) {
      return
    }
    try {
      const res = await writerLoop().reset(documentId)
      handleResponse(res, session => {
        // Clear everything: outline, progress, review, preflight — return to idle "Start Writing" view
        dispatch({ type: 'SET_STATE', session, outline: null })
        dispatch({
          type: 'SET_PROGRESS',
          progress: {
            totalSections: 0,
            completedSections: 0,
            currentSectionId: null,
            currentSectionTitle: null,
            results: [],
            status: 'idle',
          } as any,
        })
        dispatch({ type: 'SET_REVIEW', review: null, passCount: 0, canAutoPass: true })
        dispatch({ type: 'CLEAR_PREFLIGHT' })
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  const transition = useCallback(
    async (stage: WriterLoopStage) => {
      if (!documentId) {
        return
      }
      try {
        const res = await writerLoop().transition(documentId, stage)
        handleResponse(res, session => {
          dispatch({ type: 'SET_SESSION', session })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  // ── Phase 3: Generation ──

  const generateSection = useCallback(
    async (sectionId: string) => {
      if (!documentId) {
        return
      }
      dispatch({ type: 'START_LOADING' })
      const retryFn = () => generateSection(sectionId)
      try {
        const res = await withTimeout(writerLoop().generateSection(documentId, sectionId), 90000, 'Section generation')
        handleResponse(res)
        // Refresh progress
        const progressRes = await writerLoop().getProgress(documentId)
        handleResponse(progressRes, progress => {
          dispatch({ type: 'SET_PROGRESS', progress })
        })
      } catch (err: any) {
        dispatch({
          type: 'SET_ERROR',
          error: err.message || 'Generation failed. Please try again.',
          retryable: true,
          action: 'generating',
          retryFn,
        })
      }
    },
    [documentId, handleResponse],
  )

  const generateAll = useCallback(async () => {
    if (!documentId) {
      return
    }
    dispatch({ type: 'START_LOADING' })
    const retryFn = () => generateAll()
    try {
      const res = await withTimeout(
        writerLoop().generateAll(documentId),
        180000, // 3 minutes for full generation
        'Full document generation',
      )
      handleResponse(res, progress => {
        dispatch({ type: 'SET_PROGRESS', progress })
      })
    } catch (err: any) {
      dispatch({
        type: 'SET_ERROR',
        error: err.message || 'Generation failed. Please try again.',
        retryable: true,
        action: 'generating',
        retryFn,
      })
    }
  }, [documentId, handleResponse])

  // Guard: prevent multiple concurrent generateAll triggers
  const generationTriggeredRef = useRef(false)

  /** Abort in-progress generation — returns any completed results */
  const abortGeneration = useCallback(async (): Promise<SectionProgress | null> => {
    if (!documentId) {
      return null
    }
    try {
      const res = await writerLoop().abortGeneration(documentId)
      generationTriggeredRef.current = false

      // Wait a moment for the backend generateAll loop to finalize
      await new Promise(resolve => {
        setTimeout(resolve, 500)
      })

      // Refresh state (stage will have transitioned out of generating)
      await fetchState()

      // Notify all hook instances (e.g. LaconWorkspace) to refresh
      window.dispatchEvent(new CustomEvent('lacon:generation-stopped', { detail: { documentId } }))

      if (res?.success && res.data) {
        dispatch({ type: 'SET_PROGRESS', progress: res.data })
        return res.data
      }
      return null
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
      return null
    }
  }, [documentId, fetchState])

  const getGenerationProgress = useCallback(async () => {
    if (!documentId) {
      return
    }
    try {
      const res = await writerLoop().getProgress(documentId)
      handleResponse(res, progress => {
        dispatch({ type: 'SET_PROGRESS', progress })
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  // ── Auto-poll progress while generating ──

  useEffect(() => {
    const stage = state.session?.stage
    if (stage !== 'generating' || !documentId) {
      generationTriggeredRef.current = false
      console.log(`[useWriterLoop:Poll] Exiting poll effect — stage=${stage}, documentId=${!!documentId}`)
      return
    }

    console.log(`[useWriterLoop:Poll] Starting poll effect — stage=${stage}`)

    // Auto-recovery: if we're in 'generating' stage but no generation is active,
    // trigger generateAll(). This handles process restarts and stuck states.
    const kickstartIfNeeded = async () => {
      if (generationTriggeredRef.current) {return}
      try {
        const res = await writerLoop().getProgress(documentId)
        if (res?.success && mountedRef.current) {
          dispatch({ type: 'SET_PROGRESS', progress: res.data })
          console.log(
            `[useWriterLoop:Poll] Kickstart check — progress status=${res.data?.status}, completed=${res.data?.completedSections}, results=${res.data?.results?.length}`,
          )

          // If progress is idle (no generation running), auto-start ONLY in auto mode
          // In manual mode, the user triggers sections individually
          const isAutoMode = state.session?.automationLevel === 'auto'
          if (isAutoMode && (res.data?.status === 'idle' || (!res.data?.status && res.data?.completedSections === 0))) {
            console.log('[useWriterLoop:Poll] Auto-triggering generateAll (recovery)')
            generationTriggeredRef.current = true
            writerLoop()
              .generateAll(documentId)
              .catch(() => {
                // Fire-and-forget — errors handled by progress polling
              })
          }
        }
      } catch {
        // Ignore
      }
    }

    kickstartIfNeeded()

    const pollInterval = setInterval(async () => {
      if (!mountedRef.current) {return}
      try {
        const res = await writerLoop().getProgress(documentId)
        if (res?.success && mountedRef.current) {
          console.log(
            `[useWriterLoop:Poll] Progress polled — status=${res.data?.status}, completed=${res.data?.completedSections}/${res.data?.totalSections}, results=${res.data?.results?.length}`,
          )
          dispatch({ type: 'SET_PROGRESS', progress: res.data })

          // If generation completed, refresh the full state
          if (res.data?.status === 'complete') {
            console.log(
              `[useWriterLoop:Poll] ✅ Generation COMPLETE detected — calling fetchState() + dispatching event`,
            )
            generationTriggeredRef.current = false
            await fetchState()
            // Notify all hook instances so content gets written to editor
            window.dispatchEvent(new CustomEvent('lacon:generation-stopped', { detail: { documentId } }))
          }
        }
      } catch {
        // Ignore polling errors silently
      }
    }, 2000)

    return () => {
      console.log(`[useWriterLoop:Poll] Clearing poll interval`)
      clearInterval(pollInterval)
    }
  }, [state.session?.stage, documentId, fetchState])

  const acceptGeneration = useCallback(
    async (sectionId: string) => {
      if (!documentId) {
        return
      }
      try {
        await writerLoop().acceptGeneration(documentId, sectionId)
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId],
  )

  const rejectGeneration = useCallback(
    async (sectionId: string) => {
      if (!documentId) {
        return
      }
      try {
        await writerLoop().rejectGeneration(documentId, sectionId)
        await getGenerationProgress()
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, getGenerationProgress],
  )

  // ── Phase 4: Review ──

  const runReview = useCallback(
    async (documentContent: any) => {
      if (!documentId) {
        return
      }
      dispatch({ type: 'START_LOADING' })
      const retryFn = () => runReview(documentContent)
      try {
        const res = await withTimeout(writerLoop().runReview(documentId, documentContent), 90000, 'Review')

        // The runReview IPC returns the ReviewResult directly in res.data
        // Use it immediately so we don't depend on a second IPC round-trip
        if (res?.success && res.data && mountedRef.current) {
          console.log(`[useWriterLoop:runReview] Review complete — ${res.data.flags?.length || 0} flags found`)
          dispatch({
            type: 'SET_REVIEW',
            review: res.data,
            passCount: res.data.passNumber || 1,
            canAutoPass: (res.data.passNumber || 1) < 3,
          })
        } else if (!res?.success) {
          console.warn('[useWriterLoop:runReview] IPC returned failure:', res?.error?.message)
          dispatch({ type: 'SET_ERROR', error: res?.error?.message || 'Review failed' })
        }

        // Also refresh from getReview to pick up accurate passCount/canAutoPass
        try {
          const reviewRes = await writerLoop().getReview(documentId)
          if (reviewRes?.success && reviewRes.data?.result && mountedRef.current) {
            dispatch({
              type: 'SET_REVIEW',
              review: reviewRes.data.result,
              passCount: reviewRes.data.passCount,
              canAutoPass: reviewRes.data.canAutoPass,
            })
          }
        } catch {
          // getReview is non-critical — we already have the result from runReview
        }

        await fetchState()
      } catch (err: any) {
        dispatch({
          type: 'SET_ERROR',
          error: err.message || 'Review failed. Please try again.',
          retryable: true,
          action: 'reviewing',
          retryFn,
        })
      }
    },
    [documentId, handleResponse, fetchState],
  )

  const getReviewState = useCallback(async () => {
    if (!documentId) {
      return
    }
    try {
      const res = await writerLoop().getReview(documentId)
      handleResponse(res, data => {
        dispatch({ type: 'SET_REVIEW', review: data.result, passCount: data.passCount, canAutoPass: data.canAutoPass })
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  const acceptReviewFlag = useCallback(
    async (flagId: string) => {
      if (!documentId) {
        return
      }
      try {
        await writerLoop().acceptReviewFlag(documentId, flagId)
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId],
  )

  const rejectReviewFlag = useCallback(
    async (flagId: string) => {
      if (!documentId) {
        return
      }
      try {
        await writerLoop().rejectReviewFlag(documentId, flagId)
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId],
  )

  const surgicalEdit = useCallback(
    async (paragraphId: string, instruction: string, fullDocumentContent: any, originalText?: string) => {
      if (!documentId) {
        return null
      }
      // Don't dispatch START_LOADING — surgical edits use per-flag loading in the UI
      try {
        const res = await withTimeout(
          writerLoop().surgicalEdit(documentId, paragraphId, instruction, fullDocumentContent, originalText),
          60000,
          'Surgical edit',
        )
        if (res?.success) {
          dispatch({ type: 'CLEAR_ERROR' })
          return res.data
        }
        dispatch({
          type: 'SET_ERROR',
          error: res?.error?.message || 'Surgical edit failed',
          retryable: true,
          action: 'surgical-edit',
          retryFn: () => surgicalEdit(paragraphId, instruction, fullDocumentContent, originalText),
        })
        return null
      } catch (err: any) {
        dispatch({
          type: 'SET_ERROR',
          error: err.message || 'Surgical edit failed. Please try again.',
          retryable: true,
          action: 'surgical-edit',
          retryFn: () => surgicalEdit(paragraphId, instruction, fullDocumentContent, originalText),
        })
        return null
      }
    },
    [documentId],
  )

  const rewriteAll = useCallback(
    async (instruction: string, documentContent: any) => {
      if (!documentId) {
        return null
      }
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await writerLoop().rewriteAll(documentId, instruction, documentContent)
        if (res?.success) {
          dispatch({ type: 'CLEAR_ERROR' })
          return res.data
        }
        dispatch({ type: 'SET_ERROR', error: res?.error?.message || 'Rewrite failed' })
        return null
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
        return null
      }
    },
    [documentId],
  )

  return {
    ...state,
    stage: state.session?.stage || 'idle',
    fetchState,
    startPlanning,
    updateOutline,
    updateSection,
    addSection,
    removeSection,
    addSubsection,
    removeSubsection,
    approveOutline,
    updateConfig,
    pause,
    reset,
    transition,
    // Phase 3
    generateSection,
    generateAll,
    getGenerationProgress,
    acceptGeneration,
    rejectGeneration,
    abortGeneration,
    // Phase 4
    runReview,
    getReviewState,
    acceptReviewFlag,
    rejectReviewFlag,
    surgicalEdit,
    rewriteAll,
  }
}

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

function reducer(state: WriterLoopState, action: Action): WriterLoopState {
  switch (action.type) {
    case 'START_LOADING':
      return { ...state, loading: true, error: null, errorMeta: null }
    case 'SET_STATE':
      return { ...state, session: action.session, outline: action.outline, loading: false, error: null, errorMeta: null }
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
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Check your API key and provider settings.`))
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
      handleResponse(res, data => {
        dispatch({ type: 'SET_STATE', session: data.session, outline: data.outline })

        // Also fetch progress if we're in a stage that has generation data
        const stage = data.session?.stage
        if (stage === 'generating' || stage === 'reviewing') {
          writerLoop().getProgress(documentId).then(progressRes => {
            if (progressRes?.success && mountedRef.current) {
              dispatch({ type: 'SET_PROGRESS', progress: progressRes.data })
            }
          }).catch(() => { /* ignore */ })
        }
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  // Auto-fetch on mount / documentId change
  useEffect(() => {
    fetchState()
  }, [fetchState])

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
      const retryFn = () => startPlanning(instruction, composedSkillPrompt, researchContext)
      try {
        const res = await withTimeout(
          writerLoop().startPlanning(documentId, instruction, composedSkillPrompt, researchContext),
          60000,
          'Outline generation',
        )
        handleResponse(res, outline => {
          dispatch({ type: 'SET_OUTLINE', outline })
        })
        // Refresh session
        await fetchState()
      } catch (err: any) {
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
        dispatch({ type: 'SET_SESSION', session })
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
        const res = await withTimeout(
          writerLoop().generateSection(documentId, sectionId),
          90000,
          'Section generation',
        )
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
      await new Promise(resolve => setTimeout(resolve, 500))

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
      return
    }

    // Auto-recovery: if we're in 'generating' stage but no generation is active,
    // trigger generateAll(). This handles process restarts and stuck states.
    const kickstartIfNeeded = async () => {
      if (generationTriggeredRef.current) return
      try {
        const res = await writerLoop().getProgress(documentId)
        if (res?.success && mountedRef.current) {
          dispatch({ type: 'SET_PROGRESS', progress: res.data })

          // If progress is idle (no generation running), auto-start
          if (res.data?.status === 'idle' || (!res.data?.status && res.data?.completedSections === 0)) {
            console.log('[useWriterLoop] Auto-triggering generateAll (recovery)')
            generationTriggeredRef.current = true
            writerLoop().generateAll(documentId).catch(() => {
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
      if (!mountedRef.current) return
      try {
        const res = await writerLoop().getProgress(documentId)
        if (res?.success && mountedRef.current) {
          dispatch({ type: 'SET_PROGRESS', progress: res.data })

          // If generation completed, refresh the full state
          if (res.data?.status === 'complete') {
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

    return () => clearInterval(pollInterval)
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
        const res = await withTimeout(
          writerLoop().runReview(documentId, documentContent),
          90000,
          'Review',
        )
        handleResponse(res)
        // Refresh review state
        const reviewRes = await writerLoop().getReview(documentId)
        handleResponse(reviewRes, data => {
          dispatch({
            type: 'SET_REVIEW',
            review: data.result,
            passCount: data.passCount,
            canAutoPass: data.canAutoPass,
          })
        })
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
    async (paragraphId: string, instruction: string, fullDocumentContent: any) => {
      if (!documentId) {
        return null
      }
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await withTimeout(
          writerLoop().surgicalEdit(documentId, paragraphId, instruction, fullDocumentContent),
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
          retryFn: () => surgicalEdit(paragraphId, instruction, fullDocumentContent),
        })
        return null
      } catch (err: any) {
        dispatch({
          type: 'SET_ERROR',
          error: err.message || 'Surgical edit failed. Please try again.',
          retryable: true,
          action: 'surgical-edit',
          retryFn: () => surgicalEdit(paragraphId, instruction, fullDocumentContent),
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

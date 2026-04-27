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
}

const initialState: WriterLoopState = {
  session: null,
  outline: null,
  loading: false,
  error: null,
}

// ─────────────────────────── Reducer ───────────────────────────

type Action =
  | { type: 'START_LOADING' }
  | { type: 'SET_STATE'; session: WriterSession | null; outline: WriterOutline | null }
  | { type: 'SET_SESSION'; session: WriterSession }
  | { type: 'SET_OUTLINE'; outline: WriterOutline | null }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }

function reducer(state: WriterLoopState, action: Action): WriterLoopState {
  switch (action.type) {
    case 'START_LOADING':
      return { ...state, loading: true, error: null }
    case 'SET_STATE':
      return { ...state, session: action.session, outline: action.outline, loading: false, error: null }
    case 'SET_SESSION':
      return { ...state, session: action.session, loading: false, error: null }
    case 'SET_OUTLINE':
      return { ...state, outline: action.outline, loading: false, error: null }
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
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

  const handleResponse = useCallback((response: any, onSuccess?: (data: any) => void) => {
    if (!mountedRef.current) {return}

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
    if (!documentId) {return}
    dispatch({ type: 'START_LOADING' })
    try {
      const res = await writerLoop().getState(documentId)
      handleResponse(res, data => {
        dispatch({ type: 'SET_STATE', session: data.session, outline: data.outline })
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  // Auto-fetch on mount / documentId change
  useEffect(() => {
    fetchState()
  }, [fetchState])

  // ── Planning ──

  const startPlanning = useCallback(
    async (instruction: string, composedSkillPrompt?: string, researchContext?: any) => {
      if (!documentId) {return}
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await writerLoop().startPlanning(documentId, instruction, composedSkillPrompt, researchContext)
        handleResponse(res, outline => {
          dispatch({ type: 'SET_OUTLINE', outline })
        })
        // Refresh session
        await fetchState()
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchState],
  )

  // ── Outline Operations ──

  const updateOutline = useCallback(
    async (outline: WriterOutline) => {
      if (!documentId) {return}
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
      if (!documentId) {return}
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
      if (!documentId) {return}
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
      if (!documentId) {return}
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
      if (!documentId) {return}
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
      if (!documentId) {return}
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
      if (!documentId) {return}
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await writerLoop().approveOutline(documentId, documentContent)
        handleResponse(res, session => {
          dispatch({ type: 'SET_SESSION', session })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  // ── Config ──

  const updateConfig = useCallback(
    async (config: {
      wordTarget?: number
      automationLevel?: AutomationLevel
      activeSkillIds?: string[]
      modelConfig?: { providerId: string; modelId: string }
    }) => {
      if (!documentId) {return}
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
    if (!documentId) {return}
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
    if (!documentId) {return}
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
      if (!documentId) {return}
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
  }
}

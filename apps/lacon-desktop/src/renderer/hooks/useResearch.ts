/**
 * useResearch — Phase 5 React hook
 *
 * Provides a clean API for the renderer to interact with the research log
 * and citation services running in the main process via IPC.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react'

import type {
  CitationStyle,
  FactCheckResult,
  ResearchLog,
  ResearchLogEntry,
  ResearchMode,
  WebSearchResult,
} from '../../shared/writer-types'

// ─────────────────────────── State ───────────────────────────

export interface ResearchState {
  /** Full research log */
  log: ResearchLog | null
  /** Current entries */
  entries: ResearchLogEntry[]
  /** Current research mode */
  mode: ResearchMode
  /** Current citation style */
  citationStyle: CitationStyle
  /** Latest fact-check result */
  factCheckResult: FactCheckResult | null
  /** Quick search results (preview) */
  searchResults: WebSearchResult[]
  /** Whether a quick search is in progress */
  searching: boolean
  /** Whether a deep research operation is in progress */
  deepResearching: boolean
  /** Loading flag */
  loading: boolean
  /** Error message */
  error: string | null
}

const initialState: ResearchState = {
  log: null,
  entries: [],
  mode: 'supervised',
  citationStyle: 'apa',
  factCheckResult: null,
  searchResults: [],
  searching: false,
  deepResearching: false,
  loading: false,
  error: null,
}

// ─────────────────────────── Reducer ───────────────────────────

type ResearchAction =
  | { type: 'START_LOADING' }
  | { type: 'SET_LOG'; log: ResearchLog }
  | { type: 'SET_ENTRY'; entry: ResearchLogEntry }
  | { type: 'REMOVE_ENTRY'; entryId: string }
  | { type: 'SET_MODE'; mode: ResearchMode }
  | { type: 'SET_CITATION_STYLE'; style: CitationStyle }
  | { type: 'SET_FACT_CHECK'; result: FactCheckResult }
  | { type: 'SET_SEARCH_RESULTS'; results: WebSearchResult[] }
  | { type: 'CLEAR_SEARCH_RESULTS' }
  | { type: 'START_SEARCHING' }
  | { type: 'START_DEEP_RESEARCH' }
  | { type: 'STOP_DEEP_RESEARCH' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }

function researchReducer(state: ResearchState, action: ResearchAction): ResearchState {
  switch (action.type) {
    case 'START_LOADING':
      return { ...state, loading: true, error: null }
    case 'SET_LOG':
      return {
        ...state,
        log: action.log,
        entries: action.log.entries,
        mode: action.log.mode,
        citationStyle: action.log.citationStyle,
        loading: false,
        error: null,
      }
    case 'SET_ENTRY': {
      const exists = state.entries.findIndex(e => e.id === action.entry.id)
      const newEntries =
        exists >= 0
          ? state.entries.map(e => (e.id === action.entry.id ? action.entry : e))
          : [...state.entries, action.entry]
      return { ...state, entries: newEntries, loading: false, error: null }
    }
    case 'REMOVE_ENTRY':
      return {
        ...state,
        entries: state.entries.filter(e => e.id !== action.entryId),
        loading: false,
        error: null,
      }
    case 'SET_MODE':
      return { ...state, mode: action.mode, loading: false, error: null }
    case 'SET_CITATION_STYLE':
      return { ...state, citationStyle: action.style, loading: false, error: null }
    case 'SET_FACT_CHECK':
      return { ...state, factCheckResult: action.result, loading: false, error: null }
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.results, searching: false, error: null }
    case 'CLEAR_SEARCH_RESULTS':
      return { ...state, searchResults: [] }
    case 'START_SEARCHING':
      return { ...state, searching: true, error: null }
    case 'START_DEEP_RESEARCH':
      return { ...state, deepResearching: true, error: null }
    case 'STOP_DEEP_RESEARCH':
      return { ...state, deepResearching: false }
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false, searching: false, deepResearching: false }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

// ─────────────────────────── Hook ───────────────────────────

export function useResearch(documentId: string | undefined) {
  const [state, dispatch] = useReducer(researchReducer, initialState)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const research = () => {
    if (!window.electron?.research) {
      throw new Error('Research API not available')
    }
    return window.electron.research
  }

  const citation = () => {
    if (!window.electron?.citation) {
      throw new Error('Citation API not available')
    }
    return window.electron.citation
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

  // ── Fetch Log ──

  const fetchLog = useCallback(async () => {
    if (!documentId) {
      return
    }
    dispatch({ type: 'START_LOADING' })
    try {
      const res = await research().getLog(documentId)
      handleResponse(res, log => {
        dispatch({ type: 'SET_LOG', log })
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  // Auto-fetch on mount / documentId change
  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  // ── Entry Operations ──

  const addEntry = useCallback(
    async (query: string, sources?: any[], excerpts?: string[], linkedSectionIds?: string[], tags?: string[]) => {
      if (!documentId) {
        return
      }
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await research().addEntry(documentId, query, sources, excerpts, linkedSectionIds, tags)
        handleResponse(res, entry => {
          dispatch({ type: 'SET_ENTRY', entry })
        })
        await fetchLog() // Refresh full log
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchLog],
  )

  const updateEntry = useCallback(
    async (entryId: string, updates: Partial<ResearchLogEntry>) => {
      if (!documentId) {
        return
      }
      try {
        const res = await research().updateEntry(documentId, entryId, updates)
        handleResponse(res, entry => {
          dispatch({ type: 'SET_ENTRY', entry })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  const deleteEntry = useCallback(
    async (entryId: string) => {
      if (!documentId) {
        return
      }
      try {
        const res = await research().deleteEntry(documentId, entryId)
        handleResponse(res, () => {
          dispatch({ type: 'REMOVE_ENTRY', entryId })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  // ── Mode & Style ──

  const setMode = useCallback(
    async (mode: ResearchMode) => {
      if (!documentId) {
        return
      }
      try {
        const res = await research().setMode(documentId, mode)
        handleResponse(res, () => {
          dispatch({ type: 'SET_MODE', mode })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  const setCitationStyle = useCallback(
    async (style: CitationStyle) => {
      if (!documentId) {
        return
      }
      try {
        const res = await citation().setStyle(documentId, style)
        handleResponse(res, () => {
          dispatch({ type: 'SET_CITATION_STYLE', style })
        })
        await fetchLog() // Refresh to get reformatted citations
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchLog],
  )

  // ── Import ──

  const importFile = useCallback(
    async (filePath: string, fileType: 'pdf' | 'docx' | 'txt' | 'pptx') => {
      if (!documentId) {
        return
      }
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await research().importFile(documentId, filePath, fileType)
        handleResponse(res, entry => {
          dispatch({ type: 'SET_ENTRY', entry })
        })
        await fetchLog()
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchLog],
  )

  // ── Fact-check ──

  const factCheck = useCallback(
    async (sectionId: string, sectionContent: string) => {
      if (!documentId) {
        return null
      }
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await research().factCheck(documentId, sectionId, sectionContent)
        if (res?.success) {
          dispatch({ type: 'SET_FACT_CHECK', result: res.data })
          return res.data
        }
        dispatch({ type: 'SET_ERROR', error: res?.error?.message || 'Fact-check failed' })
        return null
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
        return null
      }
    },
    [documentId],
  )

  // ── Web Search ──

  const webSearch = useCallback(
    async (query: string) => {
      if (!documentId) {return}
      dispatch({ type: 'START_SEARCHING' })
      try {
        const res = await research().webSearch(documentId, query, 'quick')
        handleResponse(res, (data: any) => {
          dispatch({ type: 'SET_SEARCH_RESULTS', results: data.results || [] })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  const deepResearch = useCallback(
    async (query: string) => {
      if (!documentId) {return}
      dispatch({ type: 'START_DEEP_RESEARCH' })
      try {
        const res = await research().webSearch(documentId, query, 'deep')
        handleResponse(res, (entry: any) => {
          dispatch({ type: 'SET_ENTRY', entry })
          dispatch({ type: 'CLEAR_SEARCH_RESULTS' })
          dispatch({ type: 'STOP_DEEP_RESEARCH' })
        })
        await fetchLog()
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchLog],
  )

  const clearSearch = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH_RESULTS' })
  }, [])

  return {
    ...state,
    fetchLog,
    addEntry,
    updateEntry,
    deleteEntry,
    setMode,
    setCitationStyle,
    importFile,
    factCheck,
    webSearch,
    deepResearch,
    clearSearch,
  }
}

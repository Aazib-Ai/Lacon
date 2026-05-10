/**
 * useVersion — Phase 6 React hook
 *
 * Provides a clean API for the renderer to interact with the version history
 * service running in the main process via IPC.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react'

import type { RestoreResult, SnapshotListItem, VersionSnapshot } from '../../shared/writer-types'

// ─────────────────────────── State ───────────────────────────

export interface VersionState {
  /** List of snapshot summaries */
  snapshots: SnapshotListItem[]
  /** Currently selected snapshot (full content) */
  selectedSnapshot: VersionSnapshot | null
  /** Result of the last restore operation */
  restoreResult: RestoreResult | null
  /** Whether a restore confirmation is pending */
  confirmingRestore: string | null // snapshotId or null
  /** Loading flag */
  loading: boolean
  /** Error message */
  error: string | null
  /** Zen mode state */
  zenMode: boolean
  /** Assistant panel visibility */
  assistantVisible: boolean
}

const initialState: VersionState = {
  snapshots: [],
  selectedSnapshot: null,
  restoreResult: null,
  confirmingRestore: null,
  loading: false,
  error: null,
  zenMode: false,
  assistantVisible: true,
}

// ─────────────────────────── Reducer ───────────────────────────

type VersionAction =
  | { type: 'START_LOADING' }
  | { type: 'SET_SNAPSHOTS'; snapshots: SnapshotListItem[] }
  | { type: 'SET_SELECTED'; snapshot: VersionSnapshot | null }
  | { type: 'SET_RESTORE_RESULT'; result: RestoreResult }
  | { type: 'SET_CONFIRMING'; snapshotId: string | null }
  | { type: 'SET_ZEN_MODE'; enabled: boolean }
  | { type: 'SET_ASSISTANT_VISIBLE'; visible: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }

function versionReducer(state: VersionState, action: VersionAction): VersionState {
  switch (action.type) {
    case 'START_LOADING':
      return { ...state, loading: true, error: null }
    case 'SET_SNAPSHOTS':
      return { ...state, snapshots: action.snapshots, loading: false, error: null }
    case 'SET_SELECTED':
      return { ...state, selectedSnapshot: action.snapshot, loading: false, error: null }
    case 'SET_RESTORE_RESULT':
      return { ...state, restoreResult: action.result, confirmingRestore: null, loading: false, error: null }
    case 'SET_CONFIRMING':
      return { ...state, confirmingRestore: action.snapshotId }
    case 'SET_ZEN_MODE':
      return { ...state, zenMode: action.enabled }
    case 'SET_ASSISTANT_VISIBLE':
      return { ...state, assistantVisible: action.visible }
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

// ─────────────────────────── Hook ───────────────────────────

export function useVersion(documentId: string | undefined) {
  const [state, dispatch] = useReducer(versionReducer, initialState)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const versionApi = () => {
    if (!window.electron?.version) {
      throw new Error('Version API not available')
    }
    return window.electron.version
  }

  const uxApi = () => {
    if (!window.electron?.ux) {
      throw new Error('UX API not available')
    }
    return window.electron.ux
  }

  const handleResponse = useCallback((response: any, onSuccess?: (data: any) => void) => {
    if (!mountedRef.current) {return}
    if (!response?.success) {
      dispatch({ type: 'SET_ERROR', error: response?.error?.message || 'Unknown error' })
      return
    }
    if (onSuccess) {onSuccess(response.data)}
  }, [])

  // ── Fetch Snapshots ──

  const fetchSnapshots = useCallback(async () => {
    if (!documentId) {return}
    dispatch({ type: 'START_LOADING' })
    try {
      const res = await versionApi().listSnapshots(documentId)
      handleResponse(res, snapshots => {
        dispatch({ type: 'SET_SNAPSHOTS', snapshots })
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [documentId, handleResponse])

  // Auto-fetch on mount / documentId change
  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  // ── Snapshot Operations ──

  const getSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!documentId) {return}
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await versionApi().getSnapshot(documentId, snapshotId)
        handleResponse(res, snapshot => {
          dispatch({ type: 'SET_SELECTED', snapshot })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse],
  )

  /**
   * Start the restore flow — set confirming state.
   */
  const requestRestore = useCallback((snapshotId: string) => {
    dispatch({ type: 'SET_CONFIRMING', snapshotId })
  }, [])

  /**
   * Cancel the restore flow.
   */
  const cancelRestore = useCallback(() => {
    dispatch({ type: 'SET_CONFIRMING', snapshotId: null })
  }, [])

  /**
   * Confirm and execute the restore.
   */
  const confirmRestore = useCallback(
    async (currentContent: any) => {
      if (!documentId || !state.confirmingRestore) {return null}
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await versionApi().restoreSnapshot(documentId, state.confirmingRestore, currentContent)
        if (res?.success) {
          dispatch({ type: 'SET_RESTORE_RESULT', result: res.data })
          await fetchSnapshots() // Refresh list
          return res.data
        }
        dispatch({ type: 'SET_ERROR', error: res?.error?.message || 'Restore failed' })
        return null
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
        return null
      }
    },
    [documentId, state.confirmingRestore, fetchSnapshots],
  )

  const addMilestoneLabel = useCallback(
    async (snapshotId: string, label: string) => {
      if (!documentId) {return}
      try {
        const res = await versionApi().addMilestone(documentId, snapshotId, label)
        handleResponse(res)
        await fetchSnapshots()
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchSnapshots],
  )

  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!documentId) {return}
      try {
        const res = await versionApi().deleteSnapshot(documentId, snapshotId)
        handleResponse(res)
        await fetchSnapshots()
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchSnapshots],
  )

  // ── UX: Zen Mode ──

  const toggleZenMode = useCallback(async () => {
    try {
      const newState = !state.zenMode
      const res = await uxApi().setZenMode(newState)
      handleResponse(res, data => {
        dispatch({ type: 'SET_ZEN_MODE', enabled: data.enabled })
      })
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [state.zenMode, handleResponse])

  const fetchZenMode = useCallback(async () => {
    try {
      const res = await uxApi().getZenMode()
      handleResponse(res, data => {
        dispatch({ type: 'SET_ZEN_MODE', enabled: data.enabled })
      })
    } catch {
      // Non-critical: ignore
    }
  }, [handleResponse])

  // ── UX: Assistant Panel ──

  const toggleAssistant = useCallback(
    async (visible?: boolean) => {
      try {
        const res = await uxApi().toggleAssistant(visible)
        handleResponse(res, data => {
          dispatch({ type: 'SET_ASSISTANT_VISIBLE', visible: data.visible })
        })
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [handleResponse],
  )

  // ── Manual Snapshot ──

  const createManualSnapshot = useCallback(
    async (content: any) => {
      if (!documentId) { return }
      dispatch({ type: 'START_LOADING' })
      try {
        const res = await versionApi().createSnapshot(documentId, 'manual', content)
        handleResponse(res)
        await fetchSnapshots()
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },
    [documentId, handleResponse, fetchSnapshots],
  )

  // Fetch UX state on mount
  useEffect(() => {
    fetchZenMode()
  }, [fetchZenMode])

  return {
    ...state,
    fetchSnapshots,
    getSnapshot,
    requestRestore,
    cancelRestore,
    confirmRestore,
    addMilestoneLabel,
    deleteSnapshot,
    createManualSnapshot,
    toggleZenMode,
    toggleAssistant,
  }
}

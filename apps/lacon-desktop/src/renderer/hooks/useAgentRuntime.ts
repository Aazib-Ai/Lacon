/**
 * React hooks for Agent Runtime
 * Phase 6: Epic P6-E3, Task P6-T8
 */

import { useCallback, useEffect, useState } from 'react'

import type { AgentRunContext, ApprovalRequest } from '../../shared/agent-types'

interface StreamChunk {
  runId: string
  taskId: string
  type: 'token' | 'partial' | 'complete' | 'error'
  data: unknown
  timestamp: number
}

/**
 * Hook for managing agent runs
 */
export function useAgentRuntime() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<AgentRunContext | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * P6-T8.1: Start a new agent run
   */
  const startRun = useCallback(
    async (
      instruction: string,
      documentContext?: {
        documentId: string
        content: unknown
        selection?: { from: number; to: number }
      },
    ) => {
      try {
        setIsRunning(true)
        setError(null)

        const runId = await window.electron.agent.startRun({
          instruction,
          documentContext,
        })

        setActiveRunId(runId)
        return runId
      } catch (err) {
        const runError = err instanceof Error ? err : new Error('Failed to start run')
        setError(runError)
        setIsRunning(false)
        throw runError
      }
    },
    [],
  )

  /**
   * P6-T8.1: Cancel active run
   */
  const cancelRun = useCallback(
    async (runId?: string, reason?: string) => {
      try {
        const targetRunId = runId || activeRunId
        if (!targetRunId) {
          throw new Error('No active run to cancel')
        }

        await window.electron.agent.cancelRun({
          runId: targetRunId,
          reason,
        })

        setIsRunning(false)
        setActiveRunId(null)
      } catch (err) {
        const cancelError = err instanceof Error ? err : new Error('Failed to cancel run')
        setError(cancelError)
        throw cancelError
      }
    },
    [activeRunId],
  )

  /**
   * Get run status
   */
  const getRunStatus = useCallback(async (runId: string) => {
    try {
      const status = await window.electron.agent.getRunStatus({ runId })
      setRunStatus(status)
      return status
    } catch (err) {
      const statusError = err instanceof Error ? err : new Error('Failed to get run status')
      setError(statusError)
      throw statusError
    }
  }, [])

  /**
   * P6-T8.3: Poll for run status updates
   */
  useEffect(() => {
    if (!activeRunId) {
      return
    }

    const interval = setInterval(async () => {
      try {
        const status = await getRunStatus(activeRunId)
        if (status.state === 'completed' || status.state === 'failed' || status.state === 'cancelled') {
          setIsRunning(false)
          clearInterval(interval)
        }
      } catch (err) {
        console.error('Failed to poll run status:', err)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [activeRunId, getRunStatus])

  return {
    activeRunId,
    runStatus,
    isRunning,
    error,
    startRun,
    cancelRun,
    getRunStatus,
  }
}

/**
 * Hook for managing approval requests
 */
export function useApprovalRequests() {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [error, setError] = useState<Error | null>(null)

  /**
   * Fetch pending approvals
   */
  const fetchPendingApprovals = useCallback(async () => {
    try {
      const approvals = await window.electron.agent.getPendingApprovals()
      setPendingApprovals(approvals)
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch approvals')
      setError(fetchError)
      throw fetchError
    }
  }, [])

  /**
   * Approve a request
   */
  const approveRequest = useCallback(
    async (requestId: string) => {
      try {
        await window.electron.agent.approveRequest({ requestId })
        await fetchPendingApprovals()
      } catch (err) {
        const approveError = err instanceof Error ? err : new Error('Failed to approve request')
        setError(approveError)
        throw approveError
      }
    },
    [fetchPendingApprovals],
  )

  /**
   * Reject a request
   */
  const rejectRequest = useCallback(
    async (requestId: string, reason?: string) => {
      try {
        await window.electron.agent.rejectRequest({ requestId, reason })
        await fetchPendingApprovals()
      } catch (err) {
        const rejectError = err instanceof Error ? err : new Error('Failed to reject request')
        setError(rejectError)
        throw rejectError
      }
    },
    [fetchPendingApprovals],
  )

  /**
   * Poll for pending approvals
   */
  useEffect(() => {
    fetchPendingApprovals()

    const interval = setInterval(fetchPendingApprovals, 2000)
    return () => clearInterval(interval)
  }, [fetchPendingApprovals])

  return {
    pendingApprovals,
    error,
    approveRequest,
    rejectRequest,
    fetchPendingApprovals,
  }
}

/**
 * Hook for streaming agent output
 */
export function useAgentStreaming(runId: string | null) {
  const [streamOutput, setStreamOutput] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => {
    if (!runId) {
      setStreamOutput('')
      setIsStreaming(false)
      return
    }

    setIsStreaming(true)

    const handleStream = (chunk: StreamChunk) => {
      if (chunk.runId !== runId) {
        return
      }

      switch (chunk.type) {
        case 'token':
          setStreamOutput(prev => prev + chunk.data)
          break
        case 'partial':
          // Handle partial updates
          break
        case 'complete':
          setIsStreaming(false)
          break
        case 'error':
          setIsStreaming(false)
          console.error('Stream error:', chunk.data)
          break
      }
    }

    // Subscribe to stream events
    window.electron.onAgentStream(handleStream)

    return () => {
      // Cleanup subscription
      setStreamOutput('')
      setIsStreaming(false)
    }
  }, [runId])

  return {
    streamOutput,
    isStreaming,
  }
}

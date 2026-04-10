/**
 * React hooks for Audit functionality
 * Phase 9: Auditability and Governance
 */

import { useCallback, useState } from 'react'

export function useAudit() {
  const [events, setEvents] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryEvents = useCallback(async (filter: any = {}) => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.audit.query(filter)
      if (response.success) {
        setEvents(response.data || [])
      } else {
        setError(response.error?.message || 'Failed to query events')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const getStatistics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.audit.getStatistics()
      if (response.success) {
        setStatistics(response.data)
      } else {
        setError(response.error?.message || 'Failed to get statistics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const verifyIntegrity = useCallback(async (eventId: string) => {
    try {
      const response = await window.electron.audit.verifyIntegrity(eventId)
      return response.success ? response.data : null
    } catch (err) {
      console.error('Failed to verify integrity:', err)
      return null
    }
  }, [])

  return {
    events,
    statistics,
    loading,
    error,
    queryEvents,
    getStatistics,
    verifyIntegrity,
  }
}

export function useTrace() {
  const [sessions, setSessions] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listSessions = useCallback(async (filter: any = {}) => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.trace.listSessions(filter)
      if (response.success) {
        setSessions(response.data || [])
      } else {
        setError(response.error?.message || 'Failed to list sessions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const getTimeline = useCallback(async (sessionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.trace.getTimeline(sessionId)
      if (response.success) {
        setTimeline(response.data || [])
      } else {
        setError(response.error?.message || 'Failed to get timeline')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const getMetrics = useCallback(async (sessionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.trace.getMetrics(sessionId)
      if (response.success) {
        setMetrics(response.data)
      } else {
        setError(response.error?.message || 'Failed to get metrics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const replaySession = useCallback(async (config: any) => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.trace.replay(config)
      if (response.success) {
        return response.data
      }
      setError(response.error?.message || 'Failed to replay session')
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    sessions,
    timeline,
    metrics,
    loading,
    error,
    listSessions,
    getTimeline,
    getMetrics,
    replaySession,
  }
}

export function usePolicy() {
  const [rules, setRules] = useState<any[]>([])
  const [violations, setViolations] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.policy.listRules()
      if (response.success) {
        setRules(response.data || [])
      } else {
        setError(response.error?.message || 'Failed to list rules')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const getRule = useCallback(async (ruleId: string) => {
    try {
      const response = await window.electron.policy.getRule(ruleId)
      return response.success ? response.data : null
    } catch (err) {
      console.error('Failed to get rule:', err)
      return null
    }
  }, [])

  const registerRule = useCallback(
    async (rule: any) => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electron.policy.registerRule(rule)
        if (response.success) {
          await listRules() // Refresh list
          return true
        }
        setError(response.error?.message || 'Failed to register rule')
        return false
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        return false
      } finally {
        setLoading(false)
      }
    },
    [listRules],
  )

  const unregisterRule = useCallback(
    async (ruleId: string) => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electron.policy.unregisterRule(ruleId)
        if (response.success) {
          await listRules() // Refresh list
          return true
        }
        setError(response.error?.message || 'Failed to unregister rule')
        return false
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        return false
      } finally {
        setLoading(false)
      }
    },
    [listRules],
  )

  const evaluate = useCallback(async (context: any) => {
    try {
      const response = await window.electron.policy.evaluate(context)
      return response.success ? response.data : null
    } catch (err) {
      console.error('Failed to evaluate policy:', err)
      return null
    }
  }, [])

  const getViolations = useCallback(async (limit?: number) => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.policy.getViolations(limit)
      if (response.success) {
        setViolations(response.data || [])
      } else {
        setError(response.error?.message || 'Failed to get violations')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const getStatistics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electron.policy.getStatistics()
      if (response.success) {
        setStatistics(response.data)
      } else {
        setError(response.error?.message || 'Failed to get statistics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    rules,
    violations,
    statistics,
    loading,
    error,
    listRules,
    getRule,
    registerRule,
    unregisterRule,
    evaluate,
    getViolations,
    getStatistics,
  }
}

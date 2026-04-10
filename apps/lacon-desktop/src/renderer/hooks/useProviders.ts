/**
 * React hook for provider management (Phase 7)
 */

import { useCallback, useEffect, useState } from 'react'

import type { ModelInfo, ProviderConfig, ProviderHealth, UsageRecord } from '../../shared/provider-types'

export function useProviders() {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.electron.provider.list()
      setProviders(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  const registerProvider = useCallback(
    async (config: ProviderConfig) => {
      try {
        await window.electron.provider.register(config)
        await loadProviders()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to register provider')
      }
    },
    [loadProviders],
  )

  const unregisterProvider = useCallback(
    async (providerId: string) => {
      try {
        await window.electron.provider.unregister(providerId)
        await loadProviders()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to unregister provider')
      }
    },
    [loadProviders],
  )

  return {
    providers,
    loading,
    error,
    loadProviders,
    registerProvider,
    unregisterProvider,
  }
}

export function useProviderHealth(providerId?: string) {
  const [health, setHealth] = useState<ProviderHealth | ProviderHealth[] | null>(null)
  const [loading, setLoading] = useState(false)

  const checkHealth = useCallback(async () => {
    setLoading(true)
    try {
      if (providerId) {
        const result = await window.electron.provider.checkHealth(providerId)
        setHealth(result)
      } else {
        const result = await window.electron.provider.checkAllHealth()
        setHealth(result)
      }
    } catch (err) {
      console.error('Failed to check health:', err)
    } finally {
      setLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [checkHealth])

  return { health, loading, checkHealth }
}

export function useProviderModels(providerId: string | null) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!providerId) {
      setModels([])
      return
    }

    const loadModels = async () => {
      setLoading(true)
      try {
        const result = await window.electron.provider.getModels(providerId)
        setModels(result)
      } catch (err) {
        console.error('Failed to load models:', err)
      } finally {
        setLoading(false)
      }
    }

    loadModels()
  }, [providerId])

  return { models, loading }
}

export function useProviderUsage(providerId?: string, feature?: string) {
  const [usage, setUsage] = useState<UsageRecord[]>([])
  const [summary, setSummary] = useState<{
    totalTokens: number
    totalCost: number
    requestCount: number
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const loadUsage = useCallback(async () => {
    setLoading(true)
    try {
      const records = await window.electron.provider.getUsage({ providerId, feature })
      setUsage(records)

      const summaryData = await window.electron.provider.getUsageSummary(providerId)
      setSummary(summaryData)
    } catch (err) {
      console.error('Failed to load usage:', err)
    } finally {
      setLoading(false)
    }
  }, [providerId, feature])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  return { usage, summary, loading, refresh: loadUsage }
}

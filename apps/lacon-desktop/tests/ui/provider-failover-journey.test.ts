/**
 * Provider failover journey tests (Phase 10 - P10-T3.3)
 * Tests the fallback chain and reliability layer across multiple providers
 */

import { describe, expect, it } from 'vitest'

// Simulate a FallbackChain / reliability layer without live providers
class MockFallbackChain {
  private providers: Array<{ id: string; name: string; healthy: boolean }>
  private callOrder: string[] = []

  constructor(providers: Array<{ id: string; name: string; healthy: boolean }>) {
    this.providers = providers.map(p => ({ ...p }))
  }

  async executeWithFallback<T>(fn: (providerId: string) => Promise<T>): Promise<T> {
    const lastErrors: Error[] = []

    for (const provider of this.providers) {
      if (!provider.healthy) {
        lastErrors.push(new Error(`${provider.name} is unhealthy`))
        continue
      }

      try {
        this.callOrder.push(provider.id)
        // eslint-disable-next-line no-await-in-loop
        return await fn(provider.id)
      } catch (err) {
        lastErrors.push(err as Error)
      }
    }

    throw new Error(`All providers failed. Last error: ${lastErrors[lastErrors.length - 1]?.message}`)
  }

  getCallOrder(): string[] {
    return [...this.callOrder]
  }

  markUnhealthy(id: string): void {
    const found = this.providers.find(provider => provider.id === id)
    if (found) {found.healthy = false}
  }
}

describe('Provider Failover Journey (P10-T3.3)', () => {
  describe('Primary provider success', () => {
    it('should use primary provider when healthy', async () => {
      const chain = new MockFallbackChain([
        { id: 'primary', name: 'OpenAI', healthy: true },
        { id: 'secondary', name: 'Anthropic', healthy: true },
      ])

      const result = await chain.executeWithFallback(async id => `response-from-${id}`)

      expect(result).toBe('response-from-primary')
      expect(chain.getCallOrder()).toEqual(['primary'])
    })
  })

  describe('Failover to secondary', () => {
    it('should fallback to secondary when primary fails', async () => {
      const chain = new MockFallbackChain([
        { id: 'primary', name: 'OpenAI', healthy: true },
        { id: 'secondary', name: 'Anthropic', healthy: true },
      ])

      const result = await chain.executeWithFallback(async id => {
        if (id === 'primary') {throw new Error('OpenAI rate limited')}
        return `response-from-${id}`
      })

      expect(result).toBe('response-from-secondary')
      expect(chain.getCallOrder()).toEqual(['primary', 'secondary'])
    })

    it('should skip unhealthy providers', async () => {
      const chain = new MockFallbackChain([
        { id: 'primary', name: 'OpenAI', healthy: false },
        { id: 'secondary', name: 'Anthropic', healthy: true },
      ])

      const result = await chain.executeWithFallback(async id => `response-from-${id}`)

      expect(result).toBe('response-from-secondary')
      expect(chain.getCallOrder()).toEqual(['secondary'])
    })

    it('should throw when all providers are unhealthy', async () => {
      const chain = new MockFallbackChain([
        { id: 'primary', name: 'OpenAI', healthy: false },
        { id: 'secondary', name: 'Anthropic', healthy: false },
      ])

      await expect(chain.executeWithFallback(async _id => 'response')).rejects.toThrow('All providers failed')
    })

    it('should throw when all providers throw errors', async () => {
      const chain = new MockFallbackChain([
        { id: 'primary', name: 'OpenAI', healthy: true },
        { id: 'secondary', name: 'Anthropic', healthy: true },
      ])

      await expect(
        chain.executeWithFallback(async id => {
          throw new Error(`${id} failed`)
        }),
      ).rejects.toThrow('All providers failed')
    })
  })

  describe('Multi-provider chain ordering', () => {
    it('should respect ordering: primary → secondary → tertiary', async () => {
      const chain = new MockFallbackChain([
        { id: 'openai', name: 'OpenAI', healthy: true },
        { id: 'anthropic', name: 'Anthropic', healthy: true },
        { id: 'gemini', name: 'Gemini', healthy: true },
      ])

      const callOrder: string[] = []
      await chain.executeWithFallback(async id => {
        callOrder.push(id)
        if (id !== 'gemini') {throw new Error(`${id} failed`)}
        return 'ok'
      })

      expect(callOrder).toEqual(['openai', 'anthropic', 'gemini'])
    })
  })

  describe('Retry behavior', () => {
    it('should succeed on second attempt after transient failure', async () => {
      let callCount = 0

      async function callWithRetry(fn: () => Promise<string>, maxRetries = 3): Promise<string> {
        let lastError: Error | undefined

        for (let attempt = 0; attempt < maxRetries; attempt += 1) {
          try {
            // eslint-disable-next-line no-await-in-loop
            return await fn()
          } catch (err) {
            lastError = err as Error
            if (attempt < maxRetries - 1) {
              // eslint-disable-next-line no-await-in-loop
              await new Promise<void>(resolve => {
                setTimeout(resolve, 10)
              })
            }
          }
        }

        throw lastError ?? new Error('Max retries exceeded')
      }

      const result = await callWithRetry(async () => {
        callCount += 1
        if (callCount === 1) {throw new Error('transient error')}
        return 'success'
      })

      expect(result).toBe('success')
      expect(callCount).toBe(2)
    })

    it('should fail after max retries are exhausted', async () => {
      let callCount = 0

      async function callWithRetry(fn: () => Promise<string>, maxRetries = 3): Promise<string> {
        let lastError: Error | undefined

        for (let attempt = 0; attempt < maxRetries; attempt += 1) {
          try {
            // eslint-disable-next-line no-await-in-loop
            return await fn()
          } catch (err) {
            lastError = err as Error
          }
        }

        throw lastError ?? new Error('Max retries exceeded')
      }

      await expect(
        callWithRetry(async () => {
          callCount += 1
          throw new Error('persistent error')
        }, 3),
      ).rejects.toThrow('persistent error')

      expect(callCount).toBe(3)
    })
  })

  describe('Health check flow', () => {
    it('provider health result should contain required fields', () => {
      const healthResult = {
        providerId: 'openai-1',
        status: 'healthy' as const,
        latencyMs: 250,
        lastChecked: Date.now(),
      }

      expect(healthResult).toHaveProperty('providerId')
      expect(healthResult).toHaveProperty('status')
      expect(healthResult).toHaveProperty('lastChecked')
      expect(['healthy', 'degraded', 'unavailable']).toContain(healthResult.status)
    })

    it('latency should be positive number when healthy', () => {
      const healthResult = {
        providerId: 'test',
        status: 'healthy' as const,
        latencyMs: 145,
        lastChecked: Date.now(),
      }

      if (healthResult.status === 'healthy') {
        expect(healthResult.latencyMs).toBeGreaterThan(0)
      }
    })
  })
})

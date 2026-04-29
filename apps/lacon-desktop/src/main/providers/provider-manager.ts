/**
 * Provider manager for Phase 7
 * Orchestrates all provider adapters with retry, fallback, and usage tracking
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  CircuitBreakerState,
  FallbackChain,
  ModelInfo,
  ProviderAdapter,
  ProviderConfig,
  ProviderHealth,
  ProviderType,
  RetryPolicy,
  StreamChunk,
  UsageRecord,
} from '../../shared/provider-types'
import { getKeyStore } from '../security/keystore'
import { getPricingService } from '../services/pricing-service'
import { AnthropicAdapter } from './anthropic-adapter'
import { CustomAdapter } from './custom-adapter'
import { GeminiAdapter } from './gemini-adapter'
import { LocalAdapter } from './local-adapter'
import { OpenAIAdapter } from './openai-adapter'
import { OpenRouterAdapter } from './openrouter-adapter'
import { ZaiAdapter } from './zai-adapter'

export class ProviderManager {
  private adapters = new Map<string, ProviderAdapter>()
  private configs = new Map<string, ProviderConfig>()
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  private usageRecords: UsageRecord[] = []

  private defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  }

  private fallbackChains = new Map<string, FallbackChain>()

  /**
   * Register a provider with its configuration
   */
  async registerProvider(config: ProviderConfig): Promise<void> {
    if (!config.apiKeyId) {
      throw new Error('Provider requires API key')
    }

    const keyStore = getKeyStore()
    const apiKey = await keyStore.getKey(config.apiKeyId)

    if (!apiKey) {
      throw new Error(`API key not found: ${config.apiKeyId}`)
    }

    const adapter = this.createAdapter(config.type)
    await adapter.initialize(config, apiKey)

    this.adapters.set(config.id, adapter)
    this.configs.set(config.id, config)
    this.initializeCircuitBreaker(config.id)
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: string): void {
    this.adapters.delete(providerId)
    this.configs.delete(providerId)
    this.circuitBreakers.delete(providerId)
    this.fallbackChains.delete(providerId)
  }

  /**
   * Get a provider adapter by ID
   */
  getProvider(providerId: string): ProviderAdapter | undefined {
    return this.adapters.get(providerId)
  }

  /**
   * List all registered providers
   */
  listProviders(): ProviderConfig[] {
    return Array.from(this.configs.values())
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(providerId: string): Promise<ModelInfo[]> {
    const adapter = this.adapters.get(providerId)
    if (!adapter) {
      throw new Error(`Provider not found: ${providerId}`)
    }

    return adapter.getAvailableModels()
  }

  /**
   * Execute a chat completion with retry and fallback
   */
  async chatCompletion(
    providerId: string,
    request: ChatCompletionRequest,
    feature: string,
  ): Promise<ChatCompletionResponse> {
    const providers = this.getProviderChain(providerId)

    for (const pid of providers) {
      if (!this.isCircuitBreakerClosed(pid)) {
        continue
      }

      try {
        const response = await this.executeWithRetry(pid, async adapter => {
          return adapter.chatCompletion(request)
        })

        this.recordSuccess(pid)
        this.recordUsage(pid, request.model, response.usage, feature)

        return response
      } catch (error) {
        this.recordFailure(pid)
        console.error(`Provider ${pid} failed:`, error)

        // Try next provider in chain
        if (pid === providers[providers.length - 1]) {
          throw error
        }
      }
    }

    throw new Error('All providers in fallback chain failed')
  }

  /**
   * Execute a streaming chat completion with retry and fallback
   */
  async streamChatCompletion(
    providerId: string,
    request: ChatCompletionRequest,
    feature: string,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (usage: { promptTokens: number; completionTokens: number }) => void,
    onError: (error: Error) => void,
  ): Promise<() => void> {
    const providers = this.getProviderChain(providerId)

    for (const pid of providers) {
      if (!this.isCircuitBreakerClosed(pid)) {
        continue
      }

      try {
        const adapter = this.adapters.get(pid)
        if (!adapter) {
          throw new Error(`Provider not found: ${pid}`)
        }

        const abort = await adapter.streamChatCompletion(
          request,
          onChunk,
          usage => {
            this.recordSuccess(pid)
            this.recordUsage(pid, request.model, usage, feature)
            onComplete(usage)
          },
          error => {
            this.recordFailure(pid)
            onError(error)
          },
        )

        return abort
      } catch (error) {
        this.recordFailure(pid)
        console.error(`Provider ${pid} failed:`, error)

        // Try next provider in chain
        if (pid === providers[providers.length - 1]) {
          onError(error as Error)
          return () => {}
        }
      }
    }

    onError(new Error('All providers in fallback chain failed'))
    return () => {}
  }

  /**
   * Check health of a provider
   */
  async checkHealth(providerId: string): Promise<ProviderHealth> {
    const adapter = this.adapters.get(providerId)
    if (!adapter) {
      throw new Error(`Provider not found: ${providerId}`)
    }

    return adapter.checkHealth()
  }

  /**
   * Check health of all providers
   */
  async checkAllHealth(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = []

    for (const [providerId, adapter] of this.adapters) {
      try {
        const health = await adapter.checkHealth()
        results.push(health)
      } catch (error) {
        results.push({
          providerId,
          status: 'unavailable',
          latencyMs: null,
          lastChecked: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  }

  /**
   * Configure fallback chain for a provider
   */
  setFallbackChain(primary: string, fallbacks: string[]): void {
    this.fallbackChains.set(primary, { primary, fallbacks })
  }

  /**
   * Get usage records
   */
  getUsageRecords(filter?: { providerId?: string; feature?: string; since?: number }): UsageRecord[] {
    let records = this.usageRecords

    if (filter?.providerId) {
      records = records.filter(r => r.providerId === filter.providerId)
    }

    if (filter?.feature) {
      records = records.filter(r => r.feature === filter.feature)
    }

    if (filter?.since !== undefined) {
      records = records.filter(r => r.timestamp >= filter.since!)
    }

    return records
  }

  /**
   * Get usage summary
   */
  getUsageSummary(providerId?: string): {
    totalTokens: number
    totalCost: number
    requestCount: number
  } {
    const records = providerId ? this.usageRecords.filter(r => r.providerId === providerId) : this.usageRecords

    return {
      totalTokens: records.reduce((sum, r) => sum + r.totalTokens, 0),
      totalCost: records.reduce((sum, r) => sum + r.estimatedCost, 0),
      requestCount: records.length,
    }
  }

  private createAdapter(type: ProviderType): ProviderAdapter {
    switch (type) {
      case 'openai':
        return new OpenAIAdapter()
      case 'anthropic':
        return new AnthropicAdapter()
      case 'gemini':
        return new GeminiAdapter()
      case 'openrouter':
        return new OpenRouterAdapter()
      case 'local':
        return new LocalAdapter()
      case 'custom-openai-compatible':
        return new CustomAdapter()
      case 'zai':
        return new ZaiAdapter()
      default:
        throw new Error(`Unknown provider type: ${type}`)
    }
  }

  private async executeWithRetry<T>(providerId: string, fn: (adapter: ProviderAdapter) => Promise<T>): Promise<T> {
    const adapter = this.adapters.get(providerId)
    if (!adapter) {
      throw new Error(`Provider not found: ${providerId}`)
    }

    const policy = this.defaultRetryPolicy
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        return await fn(adapter)
      } catch (error) {
        lastError = error as Error

        if (attempt < policy.maxRetries) {
          const delay = Math.min(policy.initialDelayMs * policy.backoffMultiplier ** attempt, policy.maxDelayMs)
          await new Promise(resolve => {
            setTimeout(resolve, delay)
          })
        }
      }
    }

    throw lastError
  }

  private getProviderChain(providerId: string): string[] {
    const chain = this.fallbackChains.get(providerId)
    return chain ? [chain.primary, ...chain.fallbacks] : [providerId]
  }

  private initializeCircuitBreaker(providerId: string): void {
    this.circuitBreakers.set(providerId, {
      providerId,
      state: 'closed',
      failureCount: 0,
      lastFailureTime: null,
      nextRetryTime: null,
    })
  }

  private isCircuitBreakerClosed(providerId: string): boolean {
    const breaker = this.circuitBreakers.get(providerId)
    if (!breaker) {
      return true
    }

    if (breaker.state === 'open') {
      if (breaker.nextRetryTime && Date.now() >= breaker.nextRetryTime) {
        breaker.state = 'half-open'
        return true
      }
      return false
    }

    return true
  }

  private recordSuccess(providerId: string): void {
    const breaker = this.circuitBreakers.get(providerId)
    if (breaker) {
      breaker.state = 'closed'
      breaker.failureCount = 0
      breaker.lastFailureTime = null
      breaker.nextRetryTime = null
    }
  }

  private recordFailure(providerId: string): void {
    const breaker = this.circuitBreakers.get(providerId)
    if (!breaker) {
      return
    }

    breaker.failureCount += 1
    breaker.lastFailureTime = Date.now()

    // Open circuit after 5 consecutive failures
    if (breaker.failureCount >= 5) {
      breaker.state = 'open'
      breaker.nextRetryTime = Date.now() + 60000 // Retry after 1 minute
    }
  }

  private recordUsage(
    providerId: string,
    model: string,
    usage: { promptTokens: number; completionTokens: number },
    feature: string,
  ): void {
    const config = this.configs.get(providerId)
    if (!config) {
      return
    }

    // Calculate real cost using PricingService
    const pricingService = getPricingService()
    const costBreakdown = pricingService.calculateCost(usage.promptTokens, usage.completionTokens, model, config.type)

    this.usageRecords.push({
      id: crypto.randomUUID(),
      providerId,
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.promptTokens + usage.completionTokens,
      estimatedCost: costBreakdown.totalCost,
      feature,
      timestamp: Date.now(),
    })

    // Keep only last 1000 records
    if (this.usageRecords.length > 1000) {
      this.usageRecords = this.usageRecords.slice(-1000)
    }
  }
}

// Singleton instance
let providerManagerInstance: ProviderManager | null = null

export function getProviderManager(): ProviderManager {
  if (!providerManagerInstance) {
    providerManagerInstance = new ProviderManager()
  }
  return providerManagerInstance
}

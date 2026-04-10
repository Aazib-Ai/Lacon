/**
 * Base adapter class with common functionality for all providers
 */

import type { ProviderAdapter, ProviderConfig, ProviderHealth, ProviderType } from '../../shared/provider-types'

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly type: ProviderType
  abstract readonly name: string

  protected config: ProviderConfig | null = null
  protected apiKey: string | null = null

  async initialize(config: ProviderConfig, apiKey: string): Promise<void> {
    this.config = config
    this.apiKey = apiKey
  }

  isConfigured(): boolean {
    return this.config !== null && this.apiKey !== null
  }

  protected ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(`${this.name} adapter not configured`)
    }
  }

  protected async fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)

        // Retry on 5xx errors and 429 (rate limit)
        if (response.status >= 500 || response.status === 429) {
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * 2 ** attempt, 10000)
            await new Promise(resolve => {
              setTimeout(resolve, delay)
            })
            continue
          }
        }

        return response
      } catch (error) {
        lastError = error as Error
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 10000)
          await new Promise(resolve => {
            setTimeout(resolve, delay)
          })
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  protected async measureLatency(testFn: () => Promise<void>): Promise<number> {
    const start = Date.now()
    try {
      await testFn()
      return Date.now() - start
    } catch {
      return -1
    }
  }

  abstract getAvailableModels(): Promise<
    Array<{
      id: string
      name: string
      provider: ProviderType
      contextWindow: number
      supportsStreaming: boolean
      supportsTools: boolean
      costPer1kInput?: number
      costPer1kOutput?: number
    }>
  >

  abstract chatCompletion(request: {
    model: string
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool'
      content: string
      name?: string
      toolCallId?: string
    }>
    tools?: Array<{
      type: 'function'
      function: {
        name: string
        description: string
        parameters: Record<string, unknown>
      }
    }>
    temperature?: number
    maxTokens?: number
    stream?: boolean
  }): Promise<{
    id: string
    model: string
    choices: Array<{
      index: number
      message: {
        role: 'assistant'
        content: string | null
        toolCalls?: Array<{
          id: string
          type: 'function'
          function: {
            name: string
            arguments: string
          }
        }>
      }
      finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
    }>
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }>

  abstract streamChatCompletion(
    request: {
      model: string
      messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool'
        content: string
        name?: string
        toolCallId?: string
      }>
      tools?: Array<{
        type: 'function'
        function: {
          name: string
          description: string
          parameters: Record<string, unknown>
        }
      }>
      temperature?: number
      maxTokens?: number
      stream?: boolean
    },
    onChunk: (chunk: {
      id: string
      model: string
      choices: Array<{
        index: number
        delta: {
          role?: 'assistant'
          content?: string
          toolCalls?: Array<{
            index: number
            id?: string
            type?: 'function'
            function?: {
              name?: string
              arguments?: string
            }
          }>
        }
        finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
      }>
    }) => void,
    onComplete: (usage: { promptTokens: number; completionTokens: number }) => void,
    onError: (error: Error) => void,
  ): Promise<() => void>

  abstract checkHealth(): Promise<ProviderHealth>
}

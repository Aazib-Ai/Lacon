/**
 * OpenRouter provider adapter for Phase 7
 * OpenRouter uses OpenAI-compatible API — fetches live model catalog
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelInfo,
  OpenRouterModelInfo,
  ProviderHealth,
  ProviderType,
  StreamChunk,
} from '../../shared/provider-types'
import { BaseProviderAdapter } from './base-adapter'

/** Cached model list with TTL */
interface ModelCache {
  models: OpenRouterModelInfo[]
  fetchedAt: number
}

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export class OpenRouterAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'openrouter'
  readonly name = 'OpenRouter'

  private baseUrl = 'https://openrouter.ai/api/v1'
  private static modelCache: ModelCache | null = null

  /**
   * Fetch models from the live OpenRouter /models API
   */
  async fetchOpenRouterModels(): Promise<OpenRouterModelInfo[]> {
    // Return cached if still valid
    if (
      OpenRouterAdapter.modelCache &&
      Date.now() - OpenRouterAdapter.modelCache.fetchedAt < MODEL_CACHE_TTL_MS
    ) {
      return OpenRouterAdapter.modelCache.models
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        console.error(`OpenRouter /models failed: ${response.status}`)
        return this.getFallbackModels()
      }

      const data = await response.json()
      const models: OpenRouterModelInfo[] = (data.data || []).map((m: any) =>
        this.mapApiModel(m),
      )

      // Sort by name
      models.sort((a, b) => a.name.localeCompare(b.name))

      OpenRouterAdapter.modelCache = { models, fetchedAt: Date.now() }
      return models
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error)
      return this.getFallbackModels()
    }
  }

  /**
   * Map a raw OpenRouter API model object to our typed interface
   */
  private mapApiModel(m: any): OpenRouterModelInfo {
    const promptPrice = parseFloat(m.pricing?.prompt || '0') * 1_000_000
    const completionPrice = parseFloat(m.pricing?.completion || '0') * 1_000_000
    const isFree = promptPrice === 0 && completionPrice === 0
    const modelId: string = m.id || ''

    return {
      id: modelId,
      name: m.name || modelId,
      provider: 'openrouter',
      contextWindow: m.context_length || 4096,
      supportsStreaming: true,
      supportsTools: m.supported_parameters?.includes('tools') ?? true,
      supportsVision: m.supported_parameters?.includes('images') ?? false,
      costPer1kInput: promptPrice / 1000,
      costPer1kOutput: completionPrice / 1000,
      description: m.description || '',
      architecture: m.architecture?.modality || '',
      topProvider: m.top_provider?.max_completion_tokens ? `max ${m.top_provider.max_completion_tokens} out` : undefined,
      pricing: {
        promptPer1M: Math.round(promptPrice * 100) / 100,
        completionPer1M: Math.round(completionPrice * 100) / 100,
        currency: 'USD',
      },
      isFree,
      maxOutput: m.top_provider?.max_completion_tokens || m.max_completion_tokens || undefined,
      categories: this.categorizeModel(modelId, isFree),
    }
  }

  /**
   * Assign categories based on model ID patterns
   */
  private categorizeModel(modelId: string, isFree: boolean): OpenRouterModelInfo['categories'] {
    const cats: OpenRouterModelInfo['categories'] = ['all']
    const id = modelId.toLowerCase()

    if (isFree) cats.push('free')

    if (id.includes('gpt') || id.startsWith('openai/')) cats.push('gpt')
    else if (id.includes('claude') || id.startsWith('anthropic/')) cats.push('claude')
    else if (id.includes('gemini') || id.startsWith('google/')) cats.push('gemini')

    // Popular models — curated list
    const popularPrefixes = [
      'openai/gpt-4o', 'openai/gpt-5', 'openai/o',
      'anthropic/claude-sonnet', 'anthropic/claude-opus',
      'google/gemini-2', 'google/gemini-pro',
      'meta-llama/llama-4', 'meta-llama/llama-3',
      'deepseek/deepseek',
      'mistralai/mistral-large', 'mistralai/mistral-medium',
    ]
    if (popularPrefixes.some(p => id.startsWith(p))) cats.push('popular')

    // Open source
    const openSourcePatterns = ['llama', 'mistral', 'mixtral', 'qwen', 'deepseek', 'gemma', 'phi', 'yi', 'command-r']
    if (openSourcePatterns.some(p => id.includes(p))) cats.push('open-source')

    return cats
  }

  /**
   * Fallback models if the API is unreachable
   */
  private getFallbackModels(): OpenRouterModelInfo[] {
    return [
      {
        id: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4',
        provider: 'openrouter',
        contextWindow: 200000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        pricing: { promptPer1M: 3, completionPer1M: 15, currency: 'USD' },
        isFree: false,
        categories: ['all', 'popular', 'claude'],
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'openrouter',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        pricing: { promptPer1M: 2.5, completionPer1M: 10, currency: 'USD' },
        isFree: false,
        categories: ['all', 'popular', 'gpt'],
      },
      {
        id: 'google/gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'openrouter',
        contextWindow: 1048576,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        pricing: { promptPer1M: 1.25, completionPer1M: 10, currency: 'USD' },
        isFree: false,
        categories: ['all', 'popular', 'gemini'],
      },
      {
        id: 'meta-llama/llama-4-maverick',
        name: 'Llama 4 Maverick',
        provider: 'openrouter',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        pricing: { promptPer1M: 0, completionPer1M: 0, currency: 'USD' },
        isFree: true,
        categories: ['all', 'popular', 'free', 'open-source'],
      },
      {
        id: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        provider: 'openrouter',
        contextWindow: 64000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        pricing: { promptPer1M: 0.55, completionPer1M: 2.19, currency: 'USD' },
        isFree: false,
        categories: ['all', 'popular', 'open-source'],
      },
    ]
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return this.fetchOpenRouterModels()
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.ensureConfigured()

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://lacon.app',
        'X-Title': 'LACON',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        tools: request.tools,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} ${error}`)
    }

    const data = await response.json()

    return {
      id: data.id,
      model: data.model,
      choices: data.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
          toolCalls: choice.message.tool_calls?.map((tc: any) => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        },
        finishReason: choice.finish_reason,
      })),
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    }
  }

  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (usage: { promptTokens: number; completionTokens: number }) => void,
    onError: (error: Error) => void,
  ): Promise<() => void> {
    this.ensureConfigured()

    const abortController = new AbortController()

    ;(async () => {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://lacon.app',
            'X-Title': 'LACON',
          },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            tools: request.tools,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens,
            stream: true,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`OpenRouter API error: ${response.status} ${error}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                onComplete({ promptTokens: 0, completionTokens: 0 })
                return
              }

              try {
                const parsed = JSON.parse(data)
                onChunk({
                  id: parsed.id,
                  model: parsed.model,
                  choices: parsed.choices.map((choice: any) => ({
                    index: choice.index,
                    delta: {
                      role: choice.delta.role,
                      content: choice.delta.content,
                      toolCalls: choice.delta.tool_calls?.map((tc: any, idx: number) => ({
                        index: idx,
                        id: tc.id,
                        type: tc.type,
                        function: tc.function
                          ? {
                              name: tc.function.name,
                              arguments: tc.function.arguments,
                            }
                          : undefined,
                      })),
                    },
                    finishReason: choice.finish_reason,
                  })),
                })
              } catch (e) {
                console.error('Failed to parse SSE chunk:', e)
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          onError(error)
        }
      }
    })()

    return () => abortController.abort()
  }

  async checkHealth(): Promise<ProviderHealth> {
    this.ensureConfigured()

    const latency = await this.measureLatency(async () => {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }
    })

    return {
      providerId: this.config!.id,
      status: latency > 0 ? 'healthy' : 'unavailable',
      latencyMs: latency > 0 ? latency : null,
      lastChecked: Date.now(),
      error: latency < 0 ? 'Connection failed' : undefined,
    }
  }
}


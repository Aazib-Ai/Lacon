/**
 * Local model provider adapter for Phase 7
 * Supports local models via OpenAI-compatible endpoints (e.g., Ollama, LM Studio)
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelInfo,
  ProviderConfig,
  ProviderHealth,
  ProviderType,
  StreamChunk,
} from '../../shared/provider-types'
import { BaseProviderAdapter } from './base-adapter'

export class LocalAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'local'
  readonly name = 'Local Model'

  private baseUrl = 'http://localhost:11434/v1' // Default Ollama endpoint

  async initialize(config: ProviderConfig, apiKey: string): Promise<void> {
    await super.initialize(config, apiKey)
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    // Try to fetch models from the local endpoint
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        return (
          data.data?.map((model: any) => ({
            id: model.id,
            name: model.id,
            provider: 'local' as const,
            contextWindow: 4096,
            supportsStreaming: true,
            supportsTools: false,
          })) || []
        )
      }
    } catch {
      // Fallback to default models if endpoint is not available
    }

    return [
      {
        id: 'llama2',
        name: 'Llama 2',
        provider: 'local',
        contextWindow: 4096,
        supportsStreaming: true,
        supportsTools: false,
      },
      {
        id: 'mistral',
        name: 'Mistral',
        provider: 'local',
        contextWindow: 8192,
        supportsStreaming: true,
        supportsTools: false,
      },
    ]
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.ensureConfigured()

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Local model API error: ${response.status} ${error}`)
    }

    const data = await response.json()

    return {
      id: data.id || crypto.randomUUID(),
      model: data.model,
      choices: data.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
        },
        finishReason: choice.finish_reason,
      })),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
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
          },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens,
            stream: true,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Local model API error: ${response.status} ${error}`)
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
                  id: parsed.id || crypto.randomUUID(),
                  model: parsed.model,
                  choices: parsed.choices.map((choice: any) => ({
                    index: choice.index,
                    delta: {
                      role: choice.delta.role,
                      content: choice.delta.content,
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
      error: latency < 0 ? 'Local endpoint not available' : undefined,
    }
  }
}

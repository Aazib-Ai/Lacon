/**
 * OpenRouter provider adapter for Phase 7
 * OpenRouter uses OpenAI-compatible API
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelInfo,
  ProviderHealth,
  ProviderType,
  StreamChunk,
} from '../../shared/provider-types'
import { BaseProviderAdapter } from './base-adapter'

export class OpenRouterAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'openrouter'
  readonly name = 'OpenRouter'

  private baseUrl = 'https://openrouter.ai/api/v1'

  async getAvailableModels(): Promise<ModelInfo[]> {
    // OpenRouter provides access to many models
    return [
      {
        id: 'anthropic/claude-3-opus',
        name: 'Claude 3 Opus (via OpenRouter)',
        provider: 'openrouter',
        contextWindow: 200000,
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        id: 'openai/gpt-4-turbo',
        name: 'GPT-4 Turbo (via OpenRouter)',
        provider: 'openrouter',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        id: 'google/gemini-pro',
        name: 'Gemini Pro (via OpenRouter)',
        provider: 'openrouter',
        contextWindow: 32768,
        supportsStreaming: true,
        supportsTools: true,
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

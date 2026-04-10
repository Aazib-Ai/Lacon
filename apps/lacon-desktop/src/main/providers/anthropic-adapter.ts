/**
 * Anthropic provider adapter for Phase 7
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ModelInfo,
  ProviderHealth,
  ProviderType,
  StreamChunk,
} from '../../shared/provider-types'
import { BaseProviderAdapter } from './base-adapter'

export class AnthropicAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'anthropic'
  readonly name = 'Anthropic'

  private baseUrl = 'https://api.anthropic.com/v1'

  async getAvailableModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        contextWindow: 200000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.015,
        costPer1kOutput: 0.075,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        contextWindow: 200000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.00025,
        costPer1kOutput: 0.00125,
      },
    ]
  }

  private convertMessages(messages: ChatMessage[]): {
    system?: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  } {
    const systemMessage = messages.find(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    return {
      system: systemMessage?.content,
      messages: conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.ensureConfigured()

    const { system, messages } = this.convertMessages(request.messages)

    const response = await this.fetchWithRetry(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model,
        system,
        messages,
        tools: request.tools?.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} ${error}`)
    }

    const data = await response.json()

    // Convert Anthropic response to OpenAI format
    const content = data.content.find((c: any) => c.type === 'text')?.text || ''
    const toolCalls = data.content
      .filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({
        id: c.id,
        type: 'function' as const,
        function: {
          name: c.name,
          arguments: JSON.stringify(c.input),
        },
      }))

    return {
      id: data.id,
      model: data.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'tool_calls',
        },
      ],
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
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
    const { system, messages } = this.convertMessages(request.messages)

    ;(async () => {
      try {
        const response = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: request.model,
            system,
            messages,
            tools: request.tools?.map(t => ({
              name: t.function.name,
              description: t.function.description,
              input_schema: t.function.parameters,
            })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 4096,
            stream: true,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Anthropic API error: ${response.status} ${error}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let messageId = ''

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

              try {
                const parsed = JSON.parse(data)

                if (parsed.type === 'message_start') {
                  messageId = parsed.message.id
                } else if (parsed.type === 'content_block_delta') {
                  if (parsed.delta.type === 'text_delta') {
                    onChunk({
                      id: messageId,
                      model: request.model,
                      choices: [
                        {
                          index: 0,
                          delta: {
                            content: parsed.delta.text,
                          },
                          finishReason: null,
                        },
                      ],
                    })
                  }
                } else if (parsed.type === 'message_delta') {
                  if (parsed.usage) {
                    onComplete({
                      promptTokens: 0,
                      completionTokens: parsed.usage.output_tokens,
                    })
                  }
                }
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
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
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

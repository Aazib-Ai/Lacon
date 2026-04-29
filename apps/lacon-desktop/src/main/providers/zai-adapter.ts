/**
 * Z.AI provider adapter
 * Supports Z.AI GLM models via OpenAI-compatible API.
 *
 * General endpoint:      https://api.z.ai/api/paas/v4
 * GLM Coding Plan:       https://api.z.ai/api/coding/paas/v4
 *
 * The adapter auto-selects the endpoint based on config.baseUrl.
 * If no baseUrl is provided, it defaults to the general endpoint.
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

/** Default Z.AI endpoints */
export const ZAI_GENERAL_ENDPOINT = 'https://api.z.ai/api/paas/v4'
export const ZAI_CODING_ENDPOINT = 'https://api.z.ai/api/coding/paas/v4'

export class ZaiAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'zai'
  readonly name = 'Z.AI'

  private baseUrl = ZAI_GENERAL_ENDPOINT

  async initialize(config: ProviderConfig, apiKey: string): Promise<void> {
    await super.initialize(config, apiKey)
    // Use the configured baseUrl (coding vs general) or fall back to general
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/+$/, '') // strip trailing slash
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return [
      // ── Flagship ──
      {
        id: 'glm-5.1',
        name: 'GLM-5.1',
        provider: 'zai',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.0014,
        costPer1kOutput: 0.0044,
      },
      {
        id: 'glm-5',
        name: 'GLM-5',
        provider: 'zai',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.001,
        costPer1kOutput: 0.0032,
      },
      {
        id: 'glm-5-turbo',
        name: 'GLM-5 Turbo',
        provider: 'zai',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.0012,
        costPer1kOutput: 0.004,
      },
      // ── Mid-tier ──
      {
        id: 'glm-4.7',
        name: 'GLM-4.7',
        provider: 'zai',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.0006,
        costPer1kOutput: 0.0022,
      },
      {
        id: 'glm-4.6',
        name: 'GLM-4.6',
        provider: 'zai',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.0006,
        costPer1kOutput: 0.0022,
      },
      {
        id: 'glm-4.5',
        name: 'GLM-4.5',
        provider: 'zai',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.0006,
        costPer1kOutput: 0.0022,
      },
      // ── Flash (free tier) ──
      {
        id: 'glm-4.7-flash',
        name: 'GLM-4.7 Flash (Free)',
        provider: 'zai',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
      {
        id: 'glm-4.5-flash',
        name: 'GLM-4.5 Flash (Free)',
        provider: 'zai',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
    ]
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.ensureConfigured()

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en',
        Authorization: `Bearer ${this.apiKey}`,
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
      throw new Error(`Z.AI API error: ${response.status} ${error}`)
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
            'Accept-Language': 'en-US,en',
            Authorization: `Bearer ${this.apiKey}`,
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
          throw new Error(`Z.AI API error: ${response.status} ${error}`)
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
      // Z.AI supports model listing at the standard endpoint
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Accept-Language': 'en-US,en',
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
      error: latency < 0 ? 'Z.AI endpoint not reachable' : undefined,
    }
  }
}

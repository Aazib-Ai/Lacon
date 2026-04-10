/**
 * Google Gemini provider adapter for Phase 7
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

export class GeminiAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'gemini'
  readonly name = 'Google Gemini'

  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  async getAvailableModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        provider: 'gemini',
        contextWindow: 32768,
        supportsStreaming: true,
        supportsTools: true,
        costPer1kInput: 0.00025,
        costPer1kOutput: 0.0005,
      },
      {
        id: 'gemini-pro-vision',
        name: 'Gemini Pro Vision',
        provider: 'gemini',
        contextWindow: 16384,
        supportsStreaming: true,
        supportsTools: false,
        costPer1kInput: 0.00025,
        costPer1kOutput: 0.0005,
      },
    ]
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.ensureConfigured()

    // Convert messages to Gemini format
    const contents = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const systemInstruction = request.messages.find(m => m.role === 'system')?.content

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/models/${request.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens,
          },
        }),
      },
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]

    if (!candidate) {
      throw new Error('No response from Gemini')
    }

    const content = candidate.content.parts.map((p: any) => p.text).join('')

    return {
      id: crypto.randomUUID(),
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finishReason: candidate.finishReason === 'STOP' ? 'stop' : null,
        },
      ],
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
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

    const contents = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const systemInstruction = request.messages.find(m => m.role === 'system')?.content

    ;(async () => {
      try {
        const response = await fetch(
          `${this.baseUrl}/models/${request.model}:streamGenerateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents,
              systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
              generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens,
              },
            }),
            signal: abortController.signal,
          },
        )

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Gemini API error: ${response.status} ${error}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        const messageId = crypto.randomUUID()

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
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line)
                const candidate = parsed.candidates?.[0]

                if (candidate) {
                  const content = candidate.content.parts.map((p: any) => p.text).join('')

                  onChunk({
                    id: messageId,
                    model: request.model,
                    choices: [
                      {
                        index: 0,
                        delta: {
                          content,
                        },
                        finishReason: candidate.finishReason === 'STOP' ? 'stop' : null,
                      },
                    ],
                  })
                }

                if (parsed.usageMetadata) {
                  onComplete({
                    promptTokens: parsed.usageMetadata.promptTokenCount || 0,
                    completionTokens: parsed.usageMetadata.candidatesTokenCount || 0,
                  })
                }
              } catch (e) {
                console.error('Failed to parse Gemini chunk:', e)
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
      const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1 },
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

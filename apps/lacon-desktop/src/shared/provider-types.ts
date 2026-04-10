/**
 * Provider abstraction types for Phase 7
 * Defines the common interface contract for all AI model providers
 */

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'local' | 'custom-openai-compatible'

export interface ProviderConfig {
  id: string
  type: ProviderType
  name: string
  apiKeyId?: string // Reference to keystore entry
  baseUrl?: string // For custom endpoints
  defaultModel?: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface ModelInfo {
  id: string
  name: string
  provider: ProviderType
  contextWindow: number
  supportsStreaming: boolean
  supportsTools: boolean
  costPer1kInput?: number
  costPer1kOutput?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  toolCallId?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string | null
      toolCalls?: ToolCall[]
    }
    finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
  }>
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface StreamChunk {
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
}

export interface ProviderHealth {
  providerId: string
  status: 'healthy' | 'degraded' | 'unavailable'
  latencyMs: number | null
  lastChecked: number
  error?: string
}

export interface UsageRecord {
  id: string
  providerId: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  feature: string // e.g., 'agent-run', 'inline-edit', 'research'
  timestamp: number
}

/**
 * Common interface that all provider adapters must implement
 */
export interface ProviderAdapter {
  readonly type: ProviderType
  readonly name: string

  /**
   * Initialize the adapter with configuration
   */
  initialize(config: ProviderConfig, apiKey: string): Promise<void>

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean

  /**
   * Get available models for this provider
   */
  getAvailableModels(): Promise<ModelInfo[]>

  /**
   * Execute a chat completion request
   */
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>

  /**
   * Execute a streaming chat completion request
   */
  streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (usage: { promptTokens: number; completionTokens: number }) => void,
    onError: (error: Error) => void,
  ): Promise<() => void> // Returns abort function

  /**
   * Check provider health and connectivity
   */
  checkHealth(): Promise<ProviderHealth>
}

export interface RetryPolicy {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableStatusCodes: number[]
}

export interface FallbackChain {
  primary: string // Provider ID
  fallbacks: string[] // Ordered list of fallback provider IDs
}

export interface CircuitBreakerState {
  providerId: string
  state: 'closed' | 'open' | 'half-open'
  failureCount: number
  lastFailureTime: number | null
  nextRetryTime: number | null
}

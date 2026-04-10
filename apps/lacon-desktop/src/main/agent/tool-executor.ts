/**
 * Tool Execution Framework
 * Phase 6: Epic P6-E2, Tasks P6-T4, P6-T5
 */

import type { ToolContract, ToolExecutionContext, ToolExecutionResult } from '../../shared/agent-types'

export interface ToolExecutorConfig {
  defaultTimeout: number
  maxConcurrentTools: number
}

export class ToolExecutor {
  private config: ToolExecutorConfig
  private runningTools: Map<string, AbortController> = new Map()
  private idempotencyCache: Map<string, ToolExecutionResult> = new Map()

  constructor(config: ToolExecutorConfig) {
    this.config = config
  }

  /**
   * P6-T5.1: Execute tool with timeout control
   */
  async execute<TInput, TOutput>(
    tool: ToolContract<TInput, TOutput>,
    input: TInput,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult<TOutput>> {
    // P6-T5.2: Check idempotency cache
    if (context.idempotencyKey) {
      const cached = this.idempotencyCache.get(context.idempotencyKey)
      if (cached) {
        return cached as ToolExecutionResult<TOutput>
      }
    }

    // P6-T5.3: Check concurrency limits
    if (this.runningTools.size >= this.config.maxConcurrentTools) {
      return {
        status: 'failed',
        error: {
          code: 'CONCURRENCY_LIMIT_EXCEEDED',
          message: `Maximum concurrent tools (${this.config.maxConcurrentTools}) exceeded`,
        },
        executionTime: 0,
        retryCount: context.retryCount,
      }
    }

    const startTime = Date.now()
    const abortController = new AbortController()
    const executionId = `${tool.name}-${startTime}`

    this.runningTools.set(executionId, abortController)

    try {
      // P6-T5.1: Set up timeout
      const timeout = context.timeout || tool.timeout || this.config.defaultTimeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          abortController.abort()
          reject(new Error(`Tool execution timeout after ${timeout}ms`))
        }, timeout)
      })

      // Execute tool with timeout race
      const output = await Promise.race([tool.execute(input), timeoutPromise])

      const executionTime = Date.now() - startTime
      const result: ToolExecutionResult<TOutput> = {
        status: 'success',
        output,
        executionTime,
        retryCount: context.retryCount,
      }

      // P6-T5.2: Cache result if idempotent
      if (context.idempotencyKey) {
        this.idempotencyCache.set(context.idempotencyKey, result)
      }

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        status: 'failed',
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: errorMessage,
          details: error,
        },
        executionTime,
        retryCount: context.retryCount,
      }
    } finally {
      this.runningTools.delete(executionId)
    }
  }

  /**
   * P6-T5.1: Cancel running tool execution
   */
  cancel(executionId: string): void {
    const abortController = this.runningTools.get(executionId)
    if (abortController) {
      abortController.abort()
      this.runningTools.delete(executionId)
    }
  }

  /**
   * Cancel all running tools
   */
  cancelAll(): void {
    this.runningTools.forEach(controller => {
      controller.abort()
    })
    this.runningTools.clear()
  }

  /**
   * Get count of running tools
   */
  getRunningCount(): number {
    return this.runningTools.size
  }

  /**
   * Clear idempotency cache
   */
  clearCache(): void {
    this.idempotencyCache.clear()
  }

  /**
   * P6-T4.1: Validate tool input against schema
   */
  validateInput<TInput>(tool: ToolContract<TInput>, input: unknown): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    if (!input || typeof input !== 'object') {
      errors.push('Input must be an object')
      return { valid: false, errors }
    }

    const schema = tool.inputSchema
    const inputObj = input as Record<string, unknown>

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in inputObj)) {
          errors.push(`Missing required field: ${field}`)
        }
      }
    }

    // Basic type checking for properties
    for (const [key] of Object.entries(inputObj)) {
      if (!(key in schema.properties)) {
        errors.push(`Unknown field: ${key}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  /**
   * P6-T4.3: Validate tool output against schema
   */
  validateOutput(tool: ToolContract, output: unknown): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    if (!output || typeof output !== 'object') {
      errors.push('Output must be an object')
      return { valid: false, errors }
    }

    // Basic validation - output exists and is an object
    // Future: Add JSON schema validation

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  }
}

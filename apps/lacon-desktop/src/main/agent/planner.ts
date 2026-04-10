/**
 * Agent Task Planner and Router
 * Phase 6: Epic P6-E1, Task P6-T2
 */

import type { AgentTask, ToolContract } from '../../shared/agent-types'

export interface PlannerConfig {
  maxRetries: number
  retryBackoffMs: number
  retryMultiplier: number
}

export class AgentPlanner {
  private config: PlannerConfig
  private toolRegistry: Map<string, ToolContract> = new Map()

  constructor(config: PlannerConfig) {
    this.config = config
  }

  /**
   * P6-T2.1: Decompose user instruction into tasks
   */
  decompose(instruction: string, context: unknown): AgentTask[] {
    // Simple decomposition for v1 - single task per instruction
    // Future: Use LLM to decompose complex instructions
    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random()}`,
      type: 'tool-execution',
      status: 'pending',
      input: {
        instruction,
        context,
      },
      createdAt: Date.now(),
    }

    return [task]
  }

  /**
   * P6-T2.2: Route task to appropriate tool
   */
  route(task: AgentTask): string | null {
    // Simple routing for v1 - match task type to tool name
    // Future: Use LLM to determine best tool for task

    if (task.type === 'tool-execution') {
      // Extract tool name from input if specified
      const input = task.input as { toolName?: string }
      if (input.toolName && this.toolRegistry.has(input.toolName)) {
        return input.toolName
      }
    }

    return null
  }

  /**
   * P6-T2.3: Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount: number): number {
    const delay = this.config.retryBackoffMs * this.config.retryMultiplier ** retryCount
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay
    return Math.floor(delay + jitter)
  }

  /**
   * P6-T2.3: Determine if task should be retried
   */
  shouldRetry(task: AgentTask, error: Error): boolean {
    // Don't retry if max retries exceeded
    if (task.error && this.getRetryCount(task) >= this.config.maxRetries) {
      return false
    }

    // Don't retry validation errors
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return false
    }

    // Don't retry permission errors
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return false
    }

    // Retry network and timeout errors
    if (
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED')
    ) {
      return true
    }

    // Default: retry
    return true
  }

  /**
   * Get retry count from task
   */
  private getRetryCount(task: AgentTask): number {
    return (task.error as { retryCount?: number })?.retryCount || 0
  }

  /**
   * Register a tool in the registry
   */
  registerTool(tool: ToolContract): void {
    this.toolRegistry.set(tool.name, tool)
  }

  /**
   * Get tool from registry
   */
  getTool(name: string): ToolContract | undefined {
    return this.toolRegistry.get(name)
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolContract[] {
    return Array.from(this.toolRegistry.values())
  }
}

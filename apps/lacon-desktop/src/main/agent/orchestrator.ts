/**
 * Agent Runtime Orchestrator
 * Phase 6: Epic P6-E1, P6-E2, P6-E3
 */

import type {
  AgentRunContext,
  AgentRuntimeConfig,
  AgentTask,
  AgentTraceEvent,
  ToolContract,
  ToolExecutionContext,
} from '../../shared/agent-types'
import { ApprovalManager } from './approval-manager'
import { ContextAssembler } from './context-assembler'
import { AgentPlanner } from './planner'
import { AgentStateMachine } from './state-machine'
import { StreamingTransport } from './streaming-transport'
import { ToolExecutor } from './tool-executor'

export class AgentOrchestrator {
  private stateMachine: AgentStateMachine
  private planner: AgentPlanner
  private contextAssembler: ContextAssembler
  private toolExecutor: ToolExecutor
  private approvalManager: ApprovalManager
  private streamingTransport: StreamingTransport
  private config: AgentRuntimeConfig
  private activeRuns: Map<string, AgentRunContext> = new Map()

  constructor(config: AgentRuntimeConfig) {
    this.config = config
    this.stateMachine = new AgentStateMachine()
    this.planner = new AgentPlanner({
      maxRetries: config.maxRetries,
      retryBackoffMs: config.retryBackoffMs,
      retryMultiplier: 2,
    })
    this.contextAssembler = new ContextAssembler()
    this.toolExecutor = new ToolExecutor({
      defaultTimeout: config.defaultToolTimeout,
      maxConcurrentTools: config.maxConcurrentTools,
    })
    this.approvalManager = new ApprovalManager({
      approvalThreshold: config.approvalThreshold,
      autoApproveTools: [],
    })
    this.streamingTransport = new StreamingTransport()

    // Subscribe to state changes
    this.stateMachine.subscribe(this.handleStateChange.bind(this))
  }

  /**
   * Start a new agent run
   */
  async startRun(
    instruction: string,
    documentContext?: {
      documentId: string
      content: unknown
      selection?: { from: number; to: number }
    },
  ): Promise<string> {
    const runId = `run-${Date.now()}-${Math.random()}`

    const runContext: AgentRunContext = {
      runId,
      state: 'idle',
      tasks: [],
      documentContext,
      userInstruction: instruction,
      toolMemory: new Map(),
      traceLog: [],
      createdAt: Date.now(),
    }

    this.activeRuns.set(runId, runContext)

    // Start execution
    this.executeRun(runId).catch(error => {
      console.error(`Run ${runId} failed:`, error)
      this.stateMachine.transitionToError(runId, error)
    })

    return runId
  }

  /**
   * Execute agent run
   */
  private async executeRun(runId: string): Promise<void> {
    const runContext = this.activeRuns.get(runId)
    if (!runContext) {
      throw new Error(`Run not found: ${runId}`)
    }

    try {
      // Transition to planning
      this.stateMachine.transition('planning', runId)
      runContext.state = 'planning'
      runContext.startedAt = Date.now()

      // Assemble context
      const context = this.contextAssembler.assemble(runContext)

      // Decompose into tasks
      const tasks = this.planner.decompose(runContext.userInstruction || '', context)
      runContext.tasks = tasks

      // Transition to executing
      this.stateMachine.transition('executing', runId)
      runContext.state = 'executing'

      // Execute tasks
      for (const task of tasks) {
        await this.executeTask(runId, task)
      }

      // Transition to completed
      this.stateMachine.transition('completed', runId)
      runContext.state = 'completed'
      runContext.completedAt = Date.now()
    } catch (error) {
      this.stateMachine.transitionToError(runId, error as Error)
      runContext.state = 'failed'
      runContext.completedAt = Date.now()
      throw error
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(runId: string, task: AgentTask): Promise<void> {
    const runContext = this.activeRuns.get(runId)
    if (!runContext) {
      throw new Error(`Run not found: ${runId}`)
    }

    task.status = 'running'
    task.startedAt = Date.now()

    try {
      // Route to tool
      const toolName = this.planner.route(task)
      if (!toolName) {
        throw new Error('No tool found for task')
      }

      const tool = this.planner.getTool(toolName)
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`)
      }

      // Check if approval required
      if (this.approvalManager.requiresApproval(tool, task.input)) {
        await this.requestApproval(runId, task, tool)
      }

      // Execute tool
      const executionContext: ToolExecutionContext = {
        toolName,
        input: task.input,
        riskLevel: tool.riskLevel,
        timeout: this.config.defaultToolTimeout,
        startTime: Date.now(),
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      }

      const result = await this.toolExecutor.execute(tool, task.input, executionContext)

      if (result.status === 'success') {
        task.status = 'success'
        task.output = result.output
        this.contextAssembler.updateToolMemory(runContext, toolName, result.output)

        // Finalize stream
        if (this.config.enableStreaming) {
          this.streamingTransport.finalizeStream(runId, task.id, result.output)
        }
      } else {
        task.status = 'failed'
        task.error = result.error

        // Send error
        if (this.config.enableStreaming) {
          this.streamingTransport.sendError(runId, task.id, new Error(result.error?.message || 'Unknown error'))
        }
      }

      task.completedAt = Date.now()
    } catch (error) {
      task.status = 'failed'
      task.error = {
        code: 'TASK_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      }
      task.completedAt = Date.now()
      throw error
    }
  }

  /**
   * Request approval for high-risk operation
   */
  private async requestApproval(runId: string, task: AgentTask, tool: ToolContract): Promise<void> {
    const runContext = this.activeRuns.get(runId)
    if (!runContext) {
      throw new Error(`Run not found: ${runId}`)
    }

    // Transition to waiting-approval
    this.stateMachine.transition('waiting-approval', runId)
    runContext.state = 'waiting-approval'
    task.status = 'awaiting-approval'

    // Create approval request
    const request = this.approvalManager.createApprovalRequest(runId, task.id, tool, task.input)

    // Wait for approval
    const approved = await this.approvalManager.waitForApproval(request.id)

    if (!approved) {
      throw new Error('Operation rejected by user')
    }

    // Transition back to executing
    this.stateMachine.transition('executing', runId)
    runContext.state = 'executing'
    task.status = 'running'
  }

  /**
   * Cancel active run
   */
  cancelRun(runId: string, reason?: string): void {
    const runContext = this.activeRuns.get(runId)
    if (!runContext) {
      return
    }

    this.stateMachine.transitionToCancelled(runId, reason)
    runContext.state = 'cancelled'
    runContext.completedAt = Date.now()

    // Cancel all running tools
    this.toolExecutor.cancelAll()

    // Clear streams
    this.streamingTransport.clearStreams()
  }

  /**
   * Get run context
   */
  getRunContext(runId: string): AgentRunContext | undefined {
    return this.activeRuns.get(runId)
  }

  /**
   * Register a tool
   */
  registerTool(tool: ToolContract): void {
    this.planner.registerTool(tool)
  }

  /**
   * Get streaming transport
   */
  getStreamingTransport(): StreamingTransport {
    return this.streamingTransport
  }

  /**
   * Get approval manager
   */
  getApprovalManager(): ApprovalManager {
    return this.approvalManager
  }

  /**
   * Handle state change events
   */
  private handleStateChange(state: string, event: AgentTraceEvent): void {
    const runContext = this.activeRuns.get(event.runId)
    if (runContext) {
      runContext.traceLog.push(event)
    }
  }

  /**
   * Clean up completed runs
   */
  cleanupRun(runId: string): void {
    this.activeRuns.delete(runId)
  }
}

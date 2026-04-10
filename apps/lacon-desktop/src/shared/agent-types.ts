/**
 * Agent Runtime Core Types
 * Phase 6: Agent Runtime Core
 */

// Runtime State Machine States
export type AgentRuntimeState =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'waiting-approval'
  | 'completed'
  | 'failed'
  | 'cancelled'

// State Transition Guards
export interface StateTransition {
  from: AgentRuntimeState
  to: AgentRuntimeState
  guard?: () => boolean
  action?: () => void
}

// Tool Risk Levels
export type ToolRiskLevel = 'low' | 'medium' | 'high'

// Tool Execution Status
export type ToolExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'awaiting-approval'

// Tool Contract
export interface ToolContract<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  riskLevel: ToolRiskLevel
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  outputSchema: {
    type: 'object'
    properties: Record<string, unknown>
  }
  errorSchema: {
    type: 'object'
    properties: Record<string, unknown>
  }
  execute: (input: TInput) => Promise<TOutput>
  timeout?: number // milliseconds
  idempotencyKey?: string
}

// Tool Execution Context
export interface ToolExecutionContext {
  toolName: string
  input: unknown
  riskLevel: ToolRiskLevel
  idempotencyKey?: string
  timeout: number
  startTime: number
  retryCount: number
  maxRetries: number
}

// Tool Execution Result
export interface ToolExecutionResult<TOutput = unknown> {
  status: ToolExecutionStatus
  output?: TOutput
  error?: {
    code: string
    message: string
    details?: unknown
  }
  executionTime: number
  retryCount: number
}

// Agent Task
export interface AgentTask {
  id: string
  type: 'tool-execution' | 'planning' | 'context-assembly'
  status: ToolExecutionStatus
  input: unknown
  output?: unknown
  error?: {
    code: string
    message: string
    details?: unknown
  }
  createdAt: number
  startedAt?: number
  completedAt?: number
}

// Agent Run Context
export interface AgentRunContext {
  runId: string
  state: AgentRuntimeState
  tasks: AgentTask[]
  documentContext?: {
    documentId: string
    content: unknown
    selection?: { from: number; to: number }
  }
  userInstruction?: string
  toolMemory: Map<string, unknown>
  traceLog: AgentTraceEvent[]
  createdAt: number
  startedAt?: number
  completedAt?: number
}

// Agent Trace Event
export interface AgentTraceEvent {
  id: string
  runId: string
  timestamp: number
  type: 'state-transition' | 'tool-execution' | 'approval-request' | 'error' | 'cancellation'
  data: unknown
}

// Approval Request
export interface ApprovalRequest {
  id: string
  runId: string
  taskId: string
  toolName: string
  input: unknown
  riskLevel: ToolRiskLevel
  riskScore: number
  reason: string
  createdAt: number
  status: 'pending' | 'approved' | 'rejected'
  respondedAt?: number
}

// Streaming Token
export interface StreamingToken {
  runId: string
  taskId: string
  token: string
  isPartial: boolean
  timestamp: number
}

// Runtime Configuration
export interface AgentRuntimeConfig {
  maxConcurrentTools: number
  defaultToolTimeout: number
  maxRetries: number
  retryBackoffMs: number
  approvalThreshold: number // Risk score threshold for requiring approval
  enableStreaming: boolean
}

// Runtime Error
export interface AgentRuntimeError {
  code: string
  message: string
  runId?: string
  taskId?: string
  details?: unknown
  timestamp: number
}

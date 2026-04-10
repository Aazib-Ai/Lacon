/**
 * Trace Viewer Types
 * Phase 9: Epic P9-E2
 */

import type { AuditEvent } from './audit-types'

// Trace Timeline Entry (P9-T3.2)
export interface TraceTimelineEntry {
  id: string
  timestamp: number
  type: 'prompt' | 'response' | 'tool' | 'approval' | 'policy' | 'document' | 'session'
  title: string
  description: string
  status: 'success' | 'failed' | 'pending' | 'cancelled'
  duration?: number
  metadata: Record<string, unknown>
  event: AuditEvent
}

// Trace Session Summary (P9-T3.1)
export interface TraceSessionSummary {
  sessionId: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'active' | 'completed' | 'failed' | 'cancelled'
  provider: string
  model: string
  statistics: {
    totalEvents: number
    promptCount: number
    responseCount: number
    toolExecutions: number
    approvalRequests: number
    policyChecks: number
    documentChanges: number
    totalTokens: number
    totalCost: number
    averageLatency: number
  }
}

// Trace Filter Options (P9-T3.1)
export interface TraceFilterOptions {
  sessionId?: string
  startTime?: number
  endTime?: number
  status?: 'active' | 'completed' | 'failed' | 'cancelled'
  provider?: string
  model?: string
  searchQuery?: string
  limit?: number
  offset?: number
}

// Trace Metrics (P9-T3.2)
export interface TraceMetrics {
  sessionId: string
  tokenMetrics: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
    averageTokensPerResponse: number
  }
  latencyMetrics: {
    averageLatency: number
    minLatency: number
    maxLatency: number
    p50Latency: number
    p95Latency: number
    p99Latency: number
  }
  costMetrics: {
    totalCost: number
    costByProvider: Record<string, number>
    costByModel: Record<string, number>
  }
  toolMetrics: {
    totalExecutions: number
    successRate: number
    averageExecutionTime: number
    executionsByTool: Record<string, number>
    failuresByTool: Record<string, number>
  }
  approvalMetrics: {
    totalRequests: number
    approvalRate: number
    averageResponseTime: number
    requestsByRiskLevel: Record<string, number>
  }
}

// Replay Diagnostics (P9-T4)
export interface ReplayDiagnostics {
  sessionId: string
  originalRunId: string
  replayRunId: string
  startTime: number
  endTime?: number
  status: 'running' | 'completed' | 'failed'
  divergences: ReplayDivergence[]
  summary: {
    totalSteps: number
    matchingSteps: number
    divergentSteps: number
    matchRate: number
  }
}

// Replay Divergence (P9-T4.3)
export interface ReplayDivergence {
  stepIndex: number
  type: 'output' | 'tool' | 'policy' | 'error'
  description: string
  expected: unknown
  actual: unknown
  severity: 'low' | 'medium' | 'high'
  timestamp: number
}

// Replay Configuration (P9-T4.1)
export interface ReplayConfiguration {
  sessionId: string
  startFromStep?: number
  endAtStep?: number
  compareOutputs: boolean
  comparePolicies: boolean
  compareTools: boolean
  stopOnDivergence: boolean
}

// Trace Export Format
export interface TraceExport {
  version: string
  exportedAt: number
  session: TraceSessionSummary
  timeline: TraceTimelineEntry[]
  metrics: TraceMetrics
  events: AuditEvent[]
}

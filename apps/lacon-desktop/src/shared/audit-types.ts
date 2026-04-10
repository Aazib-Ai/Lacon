/**
 * Audit and Governance Types
 * Phase 9: Auditability and Governance
 */

// Audit Event Types (P9-T1.1, P9-T1.2, P9-T1.3, P9-T1.4)
export type AuditEventType =
  | 'prompt-submitted'
  | 'response-received'
  | 'tool-requested'
  | 'tool-executed'
  | 'tool-failed'
  | 'document-created'
  | 'document-updated'
  | 'document-deleted'
  | 'approval-requested'
  | 'approval-granted'
  | 'approval-rejected'
  | 'policy-check'
  | 'policy-violation'
  | 'session-started'
  | 'session-ended'

// Base Audit Event (immutable after write)
export interface AuditEvent {
  readonly id: string
  readonly timestamp: number
  readonly type: AuditEventType
  readonly sessionId: string
  readonly userId?: string
  readonly data: AuditEventData
  readonly integrity: string // SHA-256 hash for tamper detection
}

// Audit Event Data (union type for all event types)
export type AuditEventData =
  | PromptEventData
  | ResponseEventData
  | ToolEventData
  | DocumentEventData
  | ApprovalEventData
  | PolicyEventData
  | SessionEventData

// Prompt and Response Events (P9-T1.1)
export interface PromptEventData {
  type: 'prompt'
  content: string
  documentId?: string
  selectionRange?: { from: number; to: number }
  metadata: {
    characterCount: number
    wordCount: number
  }
}

export interface ResponseEventData {
  type: 'response'
  content: string
  provider: string
  model: string
  metadata: {
    tokens: number
    latencyMs: number
    cost?: number
  }
}

// Tool Request and Result Events (P9-T1.2)
export interface ToolEventData {
  type: 'tool'
  toolName: string
  action: 'requested' | 'executed' | 'failed'
  input: unknown
  output?: unknown
  error?: {
    code: string
    message: string
    details?: unknown
  }
  metadata: {
    riskLevel: 'low' | 'medium' | 'high'
    executionTimeMs: number
    retryCount: number
    approved: boolean
  }
}

// Document Impact Events (P9-T1.3)
export interface DocumentEventData {
  type: 'document'
  action: 'created' | 'updated' | 'deleted'
  documentId: string
  documentTitle: string
  changes?: {
    before?: unknown
    after?: unknown
    diff?: string
  }
  metadata: {
    triggeredBy: 'user' | 'agent' | 'system'
    toolName?: string
  }
}

// Approval and Rejection Events (P9-T1.4)
export interface ApprovalEventData {
  type: 'approval'
  action: 'requested' | 'granted' | 'rejected'
  approvalId: string
  toolName: string
  input: unknown
  riskScore: number
  reason: string
  metadata: {
    requestedAt: number
    respondedAt?: number
    responseTimeMs?: number
  }
}

// Policy Check Events
export interface PolicyEventData {
  type: 'policy'
  action: 'check' | 'violation'
  policyId: string
  policyName: string
  target: {
    type: 'tool' | 'document' | 'data'
    id: string
  }
  result: 'allowed' | 'denied' | 'requires-approval'
  reason?: string
  metadata: {
    riskScore: number
    sensitiveDataDetected: boolean
  }
}

// Session Events
export interface SessionEventData {
  type: 'session'
  action: 'started' | 'ended'
  provider: string
  model: string
  metadata: {
    totalEvents: number
    totalTokens: number
    totalCost: number
    durationMs: number
  }
}

// Audit Query Filters
export interface AuditQueryFilter {
  sessionId?: string
  type?: AuditEventType | AuditEventType[]
  startTime?: number
  endTime?: number
  userId?: string
  toolName?: string
  documentId?: string
  limit?: number
  offset?: number
}

// Audit Statistics
export interface AuditStatistics {
  totalEvents: number
  eventsByType: Record<AuditEventType, number>
  totalSessions: number
  totalToolExecutions: number
  totalApprovals: number
  totalPolicyViolations: number
  timeRange: {
    start: number
    end: number
  }
}

// Event Integrity Verification
export interface IntegrityCheckResult {
  eventId: string
  valid: boolean
  expectedHash: string
  actualHash: string
  timestamp: number
}

// Retention Policy
export interface RetentionPolicy {
  enabled: boolean
  retentionDays: number
  archiveEnabled: boolean
  archivePath?: string
  autoCleanup: boolean
}

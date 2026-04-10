/**
 * Policy and Governance Types
 * Phase 9: Epic P9-E3
 */

// Policy Rule Types (P9-T5)
export type PolicyRuleType = 'risk-scoring' | 'sensitive-data' | 'tool-access' | 'rate-limit' | 'custom'

// Policy Action
export type PolicyAction = 'allow' | 'deny' | 'require-approval' | 'log-only'

// Policy Rule (P9-T5.1, P9-T5.2, P9-T5.3)
export interface PolicyRule {
  id: string
  name: string
  description: string
  type: PolicyRuleType
  enabled: boolean
  priority: number // Higher priority rules are evaluated first
  conditions: PolicyCondition[]
  action: PolicyAction
  metadata: {
    createdAt: number
    updatedAt: number
    createdBy?: string
    tags: string[]
  }
}

// Policy Condition
export interface PolicyCondition {
  field: string // e.g., 'tool.name', 'tool.riskLevel', 'data.content'
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'matches' | 'greater-than' | 'less-than'
  value: unknown
}

// Risk Scoring Rule (P9-T5.1)
export interface RiskScoringRule extends PolicyRule {
  type: 'risk-scoring'
  riskFactors: RiskFactor[]
  threshold: number // 0-1 scale
}

export interface RiskFactor {
  name: string
  weight: number // 0-1 scale
  evaluate: (context: PolicyEvaluationContext) => number // Returns 0-1
}

// Sensitive Data Detection Rule (P9-T5.2)
export interface SensitiveDataRule extends PolicyRule {
  type: 'sensitive-data'
  patterns: SensitiveDataPattern[]
  scanFields: string[] // Which fields to scan
}

export interface SensitiveDataPattern {
  name: string
  pattern: RegExp
  severity: 'low' | 'medium' | 'high'
  redact: boolean
}

// Tool Access Rule (P9-T5.3)
export interface ToolAccessRule extends PolicyRule {
  type: 'tool-access'
  toolPatterns: string[] // Tool name patterns (supports wildcards)
  allowedTools?: string[]
  deniedTools?: string[]
  requireApproval?: boolean
}

// Policy Evaluation Context (P9-T6.1)
export interface PolicyEvaluationContext {
  type: 'tool' | 'document' | 'data'
  tool?: {
    name: string
    riskLevel: 'low' | 'medium' | 'high'
    input: unknown
    output?: unknown
  }
  document?: {
    id: string
    title: string
    content: unknown
  }
  data?: {
    content: string
    metadata: Record<string, unknown>
  }
  user?: {
    id: string
    role: string
  }
  session?: {
    id: string
    provider: string
    model: string
  }
}

// Policy Evaluation Result (P9-T6.1)
export interface PolicyEvaluationResult {
  allowed: boolean
  action: PolicyAction
  matchedRules: PolicyRule[]
  riskScore: number
  sensitiveDataDetected: boolean
  sensitiveDataMatches: SensitiveDataMatch[]
  requiresApproval: boolean
  reason: string
  metadata: {
    evaluatedAt: number
    evaluationTimeMs: number
  }
}

// Sensitive Data Match
export interface SensitiveDataMatch {
  pattern: string
  field: string
  value: string
  severity: 'low' | 'medium' | 'high'
  position: { start: number; end: number }
}

// Policy Enforcement Configuration
export interface PolicyEnforcementConfig {
  enabled: boolean
  strictMode: boolean // If true, deny by default when no rules match
  logAllEvaluations: boolean
  defaultAction: PolicyAction
  approvalThreshold: number // Risk score threshold for requiring approval
}

// Policy Violation
export interface PolicyViolation {
  id: string
  timestamp: number
  policyId: string
  policyName: string
  context: PolicyEvaluationContext
  result: PolicyEvaluationResult
  action: 'blocked' | 'logged' | 'approved'
  metadata: {
    sessionId?: string
    userId?: string
  }
}

// Policy Statistics
export interface PolicyStatistics {
  totalEvaluations: number
  allowedCount: number
  deniedCount: number
  approvalRequiredCount: number
  violationCount: number
  evaluationsByRule: Record<string, number>
  averageEvaluationTime: number
  sensitiveDataDetections: number
}

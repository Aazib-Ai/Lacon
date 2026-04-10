/**
 * Policy Enforcement Engine
 * Phase 9: Epic P9-E3 (P9-T5, P9-T6)
 */

import type {
  PolicyAction,
  PolicyCondition,
  PolicyEnforcementConfig,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  PolicyRule,
  PolicyStatistics,
  PolicyViolation,
  RiskScoringRule,
  SensitiveDataMatch,
  SensitiveDataRule,
} from '../../shared/policy-types'

export class PolicyEngine {
  private rules: Map<string, PolicyRule> = new Map()
  private config: PolicyEnforcementConfig
  private violations: PolicyViolation[] = []
  private statistics: PolicyStatistics = {
    totalEvaluations: 0,
    allowedCount: 0,
    deniedCount: 0,
    approvalRequiredCount: 0,
    violationCount: 0,
    evaluationsByRule: {},
    averageEvaluationTime: 0,
    sensitiveDataDetections: 0,
  }

  constructor(config?: Partial<PolicyEnforcementConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      strictMode: config?.strictMode ?? false,
      logAllEvaluations: config?.logAllEvaluations ?? true,
      defaultAction: config?.defaultAction ?? 'allow',
      approvalThreshold: config?.approvalThreshold ?? 0.7,
    }

    // Register default rules
    this.registerDefaultRules()
  }

  /**
   * Register a policy rule
   */
  registerRule(rule: PolicyRule): void {
    this.rules.set(rule.id, rule)
  }

  /**
   * Unregister a policy rule
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId)
  }

  /**
   * Get all rules
   */
  getRules(): PolicyRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): PolicyRule | undefined {
    return this.rules.get(ruleId)
  }

  /**
   * Evaluate policies for a context (P9-T6.1)
   */
  evaluate(context: PolicyEvaluationContext): PolicyEvaluationResult {
    const startTime = Date.now()

    if (!this.config.enabled) {
      return this.createAllowedResult(startTime)
    }

    // Get applicable rules sorted by priority
    const applicableRules = this.getApplicableRules(context)

    // Evaluate each rule
    const matchedRules: PolicyRule[] = []
    let riskScore = 0
    let sensitiveDataDetected = false
    const sensitiveDataMatches: SensitiveDataMatch[] = []
    let finalAction: PolicyAction = this.config.defaultAction

    for (const rule of applicableRules) {
      if (!rule.enabled) {
        continue
      }

      const matches = this.evaluateRule(rule, context)
      if (matches) {
        matchedRules.push(rule)
        this.statistics.evaluationsByRule[rule.id] = (this.statistics.evaluationsByRule[rule.id] || 0) + 1

        // Update action based on rule priority
        if (rule.action === 'deny') {
          finalAction = 'deny'
          break // Deny takes precedence
        } else if (rule.action === 'require-approval' && finalAction !== 'deny') {
          finalAction = 'require-approval'
        } else if (rule.action === 'allow' && finalAction === this.config.defaultAction) {
          finalAction = 'allow'
        }

        // Calculate risk score for risk-scoring rules (P9-T5.1)
        if (rule.type === 'risk-scoring') {
          const riskRule = rule as RiskScoringRule
          const score = this.calculateRiskScore(riskRule, context)
          riskScore = Math.max(riskScore, score)
        }

        // Detect sensitive data (P9-T5.2)
        if (rule.type === 'sensitive-data') {
          const dataRule = rule as SensitiveDataRule
          const dataMatches = this.detectSensitiveData(dataRule, context)
          if (dataMatches.length > 0) {
            sensitiveDataDetected = true
            sensitiveDataMatches.push(...dataMatches)
          }
        }
      }
    }

    // Apply approval threshold
    if (riskScore >= this.config.approvalThreshold && finalAction === 'allow') {
      finalAction = 'require-approval'
    }

    // Strict mode: deny if no rules matched
    if (this.config.strictMode && matchedRules.length === 0) {
      finalAction = 'deny'
    }

    const evaluationTimeMs = Date.now() - startTime

    // Update statistics
    this.statistics.totalEvaluations += 1
    if (finalAction === 'allow') {
      this.statistics.allowedCount += 1
    } else if (finalAction === 'deny') {
      this.statistics.deniedCount += 1
    } else if (finalAction === 'require-approval') {
      this.statistics.approvalRequiredCount += 1
    }
    if (sensitiveDataDetected) {
      this.statistics.sensitiveDataDetections += 1
    }

    const totalTime = this.statistics.averageEvaluationTime * (this.statistics.totalEvaluations - 1) + evaluationTimeMs
    this.statistics.averageEvaluationTime = totalTime / this.statistics.totalEvaluations

    const result: PolicyEvaluationResult = {
      allowed: finalAction === 'allow',
      action: finalAction,
      matchedRules,
      riskScore,
      sensitiveDataDetected,
      sensitiveDataMatches,
      requiresApproval: finalAction === 'require-approval',
      reason: this.generateReason(finalAction, matchedRules, riskScore, sensitiveDataDetected),
      metadata: {
        evaluatedAt: Date.now(),
        evaluationTimeMs,
      },
    }

    // Log violation if denied
    if (finalAction === 'deny' || finalAction === 'require-approval') {
      this.logViolation(context, result)
    }

    return result
  }

  /**
   * Calculate risk score (P9-T5.1)
   */
  private calculateRiskScore(rule: RiskScoringRule, context: PolicyEvaluationContext): number {
    let totalScore = 0
    let totalWeight = 0

    for (const factor of rule.riskFactors) {
      const score = factor.evaluate(context)
      totalScore += score * factor.weight
      totalWeight += factor.weight
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0
  }

  /**
   * Detect sensitive data (P9-T5.2)
   */
  private detectSensitiveData(rule: SensitiveDataRule, context: PolicyEvaluationContext): SensitiveDataMatch[] {
    const matches: SensitiveDataMatch[] = []

    for (const field of rule.scanFields) {
      const value = this.getFieldValue(context, field)
      if (typeof value !== 'string') {
        continue
      }

      for (const pattern of rule.patterns) {
        const regex = pattern.pattern
        // Reset lastIndex in case the regex is reused
        regex.lastIndex = 0
        let match = regex.exec(value)
        while (match !== null) {
          matches.push({
            pattern: pattern.name,
            field,
            value: pattern.redact ? '[REDACTED]' : match[0],
            severity: pattern.severity,
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
          })
          match = regex.exec(value)
        }
      }
    }

    return matches
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(rule: PolicyRule, context: PolicyEvaluationContext): boolean {
    // Check all conditions
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false
      }
    }
    return true
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
    const fieldValue = this.getFieldValue(context, condition.field)

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value

      case 'not-equals':
        return fieldValue !== condition.value

      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(String(condition.value))

      case 'not-contains':
        return typeof fieldValue === 'string' && !fieldValue.includes(String(condition.value))

      case 'matches':
        if (typeof fieldValue === 'string' && condition.value instanceof RegExp) {
          return condition.value.test(fieldValue)
        }
        return false

      case 'greater-than':
        return typeof fieldValue === 'number' && fieldValue > Number(condition.value)

      case 'less-than':
        return typeof fieldValue === 'number' && fieldValue < Number(condition.value)

      default:
        return false
    }
  }

  /**
   * Get field value from context
   */
  private getFieldValue(context: PolicyEvaluationContext, field: string): unknown {
    const parts = field.split('.')
    let value: any = context

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        return undefined
      }
    }

    return value
  }

  /**
   * Get applicable rules for context
   */
  private getApplicableRules(context: PolicyEvaluationContext): PolicyRule[] {
    const rules = Array.from(this.rules.values())

    // Filter by context type
    const applicable = rules.filter(rule => {
      if (context.type === 'tool' && rule.type === 'tool-access') {
        return true
      }
      if (context.type === 'data' && rule.type === 'sensitive-data') {
        return true
      }
      if (rule.type === 'risk-scoring') {
        return true
      }
      return false
    })

    // Sort by priority (higher first)
    applicable.sort((a, b) => b.priority - a.priority)

    return applicable
  }

  /**
   * Generate reason for policy result
   */
  private generateReason(
    action: PolicyAction,
    matchedRules: PolicyRule[],
    riskScore: number,
    sensitiveDataDetected: boolean,
  ): string {
    if (action === 'deny') {
      const rule = matchedRules.find(r => r.action === 'deny')
      return rule ? `Denied by policy: ${rule.name}` : 'Denied by default policy'
    }

    if (action === 'require-approval') {
      if (riskScore >= this.config.approvalThreshold) {
        return `High risk score (${riskScore.toFixed(2)}) requires approval`
      }
      const rule = matchedRules.find(r => r.action === 'require-approval')
      return rule ? `Approval required by policy: ${rule.name}` : 'Approval required'
    }

    if (sensitiveDataDetected) {
      return 'Allowed with sensitive data detection'
    }

    return 'Allowed by policy'
  }

  /**
   * Log policy violation
   */
  private logViolation(context: PolicyEvaluationContext, result: PolicyEvaluationResult): void {
    const violation: PolicyViolation = {
      id: `violation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      policyId: result.matchedRules[0]?.id || 'default',
      policyName: result.matchedRules[0]?.name || 'Default Policy',
      context,
      result,
      action: (() => {
        if (result.action === 'deny') {
          return 'blocked'
        }
        if (result.action === 'require-approval') {
          return 'approved'
        }
        return 'logged'
      })() as PolicyViolation['action'],
      metadata: {
        sessionId: context.session?.id,
        userId: context.user?.id,
      },
    }

    this.violations.push(violation)
    this.statistics.violationCount += 1
  }

  /**
   * Get violations
   */
  getViolations(limit?: number): PolicyViolation[] {
    const sorted = [...this.violations].sort((a, b) => b.timestamp - a.timestamp)
    return limit ? sorted.slice(0, limit) : sorted
  }

  /**
   * Get statistics
   */
  getStatistics(): PolicyStatistics {
    return { ...this.statistics }
  }

  /**
   * Create allowed result (when policy engine is disabled)
   */
  private createAllowedResult(startTime: number): PolicyEvaluationResult {
    return {
      allowed: true,
      action: 'allow',
      matchedRules: [],
      riskScore: 0,
      sensitiveDataDetected: false,
      sensitiveDataMatches: [],
      requiresApproval: false,
      reason: 'Policy engine disabled',
      metadata: {
        evaluatedAt: Date.now(),
        evaluationTimeMs: Date.now() - startTime,
      },
    }
  }

  /**
   * Register default rules (P9-T5.1, P9-T5.2, P9-T5.3)
   */
  private registerDefaultRules(): void {
    // High-risk tool rule
    this.registerRule({
      id: 'high-risk-tools',
      name: 'High Risk Tools Require Approval',
      description: 'Tools with high risk level require manual approval',
      type: 'tool-access',
      enabled: true,
      priority: 100,
      conditions: [
        {
          field: 'tool.riskLevel',
          operator: 'equals',
          value: 'high',
        },
      ],
      action: 'require-approval',
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['default', 'risk'],
      },
    })

    // Sensitive data detection rule
    this.registerRule({
      id: 'sensitive-data-detection',
      name: 'Detect Sensitive Data',
      description: 'Detect and flag sensitive data patterns',
      type: 'sensitive-data',
      enabled: true,
      priority: 90,
      conditions: [],
      action: 'log-only',
      patterns: [],
      scanFields: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['default', 'security'],
      },
    } as SensitiveDataRule)

    // Add patterns to sensitive data rule
    const sensitiveRule = this.rules.get('sensitive-data-detection') as SensitiveDataRule
    if (sensitiveRule) {
      sensitiveRule.patterns = [
        {
          name: 'API Key',
          pattern: /\b[A-Za-z0-9]{32,}\b/g,
          severity: 'high',
          redact: true,
        },
        {
          name: 'Email',
          pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          severity: 'medium',
          redact: false,
        },
        {
          name: 'Credit Card',
          pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
          severity: 'high',
          redact: true,
        },
      ]
      sensitiveRule.scanFields = ['tool.input', 'data.content']
    }

    // Risk scoring rule
    const riskRule: RiskScoringRule = {
      id: 'risk-scoring',
      name: 'Calculate Risk Score',
      description: 'Calculate risk score based on multiple factors',
      type: 'risk-scoring',
      enabled: true,
      priority: 80,
      conditions: [],
      action: 'log-only',
      riskFactors: [
        {
          name: 'Tool Risk Level',
          weight: 0.4,
          evaluate: (context: PolicyEvaluationContext) => {
            if (context.tool?.riskLevel === 'high') {
              return 1.0
            }
            if (context.tool?.riskLevel === 'medium') {
              return 0.5
            }
            return 0.1
          },
        },
        {
          name: 'Sensitive Data Present',
          weight: 0.3,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          evaluate: (_ctx: PolicyEvaluationContext) => {
            // This would be calculated by sensitive data detection
            return 0
          },
        },
        {
          name: 'Document Impact',
          weight: 0.3,
          evaluate: (context: PolicyEvaluationContext) => {
            if (context.type === 'document') {
              return 0.8
            }
            return 0.2
          },
        },
      ],
      threshold: 0.7,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['default', 'risk'],
      },
    }
    this.registerRule(riskRule)
  }

  /**
   * Clear all violations (for testing)
   */
  clearViolations(): void {
    this.violations = []
  }

  /**
   * Reset statistics (for testing)
   */
  resetStatistics(): void {
    this.statistics = {
      totalEvaluations: 0,
      allowedCount: 0,
      deniedCount: 0,
      approvalRequiredCount: 0,
      violationCount: 0,
      evaluationsByRule: {},
      averageEvaluationTime: 0,
      sensitiveDataDetections: 0,
    }
  }
}

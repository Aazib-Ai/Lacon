/**
 * Audit Manager - Central coordination for audit, trace, and policy
 * Phase 9: Integration layer
 */

import type { AuditEventData, AuditEventType } from '../../shared/audit-types'
import type { PolicyEvaluationContext } from '../../shared/policy-types'
import { AuditEventStore } from './event-store'
import { PolicyEngine } from './policy-engine'
import { TraceViewer } from './trace-viewer'

export class AuditManager {
  private eventStore: AuditEventStore
  private policyEngine: PolicyEngine
  private traceViewer: TraceViewer

  constructor() {
    this.eventStore = new AuditEventStore({
      enabled: true,
      retentionDays: 90,
      archiveEnabled: false,
      autoCleanup: true,
    })

    this.policyEngine = new PolicyEngine({
      enabled: true,
      strictMode: false,
      logAllEvaluations: true,
      defaultAction: 'allow',
      approvalThreshold: 0.7,
    })

    this.traceViewer = new TraceViewer(this.eventStore)
  }

  /**
   * Log an audit event
   */
  logEvent(type: AuditEventType, sessionId: string, data: AuditEventData, userId?: string) {
    return this.eventStore.append(type, sessionId, data, userId)
  }

  /**
   * Check policy before tool execution (P9-T6.1)
   */
  checkPolicy(context: PolicyEvaluationContext) {
    const result = this.policyEngine.evaluate(context)

    // Map policy action to event result literal
    let resultLiteral: 'allowed' | 'denied' | 'requires-approval' = 'allowed'
    if (result.action === 'deny') {
      resultLiteral = 'denied'
    } else if (result.action === 'require-approval') {
      resultLiteral = 'requires-approval'
    }

    // Log policy check event
    this.eventStore.append(
      result.action === 'deny' ? 'policy-violation' : 'policy-check',
      context.session?.id || 'unknown',
      {
        type: 'policy',
        action: result.action === 'deny' ? 'violation' : 'check',
        policyId: result.matchedRules[0]?.id || 'default',
        policyName: result.matchedRules[0]?.name || 'Default Policy',
        target: {
          type: context.type,
          id: context.tool?.name || context.document?.id || 'unknown',
        },
        result: resultLiteral,
        reason: result.reason,
        metadata: {
          riskScore: result.riskScore,
          sensitiveDataDetected: result.sensitiveDataDetected,
        },
      },
    )

    return result
  }

  /**
   * Get event store
   */
  getEventStore() {
    return this.eventStore
  }

  /**
   * Get policy engine
   */
  getPolicyEngine() {
    return this.policyEngine
  }

  /**
   * Get trace viewer
   */
  getTraceViewer() {
    return this.traceViewer
  }

  /**
   * Apply retention policy
   */
  applyRetentionPolicy() {
    return this.eventStore.applyRetentionPolicy()
  }

  /**
   * Get audit statistics
   */
  getAuditStatistics() {
    return this.eventStore.getStatistics()
  }

  /**
   * Get policy statistics
   */
  getPolicyStatistics() {
    return this.policyEngine.getStatistics()
  }
}

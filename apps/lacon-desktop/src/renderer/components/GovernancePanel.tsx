/**
 * Governance Panel Component
 * Phase 9: Epic P9-E3 (P9-T5, P9-T6)
 *
 * Displays policy rules, violations, statistics, and allows policy management.
 */

import React, { useCallback, useEffect, useState } from 'react'

import { usePolicy } from '../hooks/useAudit'

type PolicyView = 'rules' | 'violations' | 'statistics'

export const GovernancePanel: React.FC = () => {
  const { rules, violations, statistics, loading, error, listRules, getViolations, getStatistics, unregisterRule } =
    usePolicy()

  const [activeView, setActiveView] = useState<PolicyView>('rules')
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null)

  // Load data based on active view
  useEffect(() => {
    if (activeView === 'rules') {
      listRules()
    } else if (activeView === 'violations') {
      getViolations(50)
    } else if (activeView === 'statistics') {
      getStatistics()
    }
  }, [activeView, listRules, getViolations, getStatistics])

  const handleUnregisterRule = useCallback(
    async (ruleId: string) => {
      const confirmed = window.confirm(`Remove policy rule "${ruleId}"? This cannot be undone.`)
      if (confirmed) {
        await unregisterRule(ruleId)
      }
    },
    [unregisterRule],
  )

  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString()

  const getRiskBadge = (riskScore: number) => {
    if (riskScore >= 0.7) {
      return <span className="gov-badge badge-high">High Risk</span>
    }
    if (riskScore >= 0.4) {
      return <span className="gov-badge badge-medium">Medium Risk</span>
    }
    return <span className="gov-badge badge-low">Low Risk</span>
  }

  const getViolationLabel = (action: string) => {
    if (action === 'blocked') {
      return '🚫 Blocked'
    }
    if (action === 'approved') {
      return '⚠️ Flagged'
    }
    return '📋 Logged'
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'deny':
        return <span className="gov-badge badge-deny">Deny</span>
      case 'require-approval':
        return <span className="gov-badge badge-approval">Require Approval</span>
      case 'allow':
        return <span className="gov-badge badge-allow">Allow</span>
      default:
        return <span className="gov-badge badge-log">Log Only</span>
    }
  }

  return (
    <div className="governance-panel" id="governance-panel">
      {/* Header */}
      <div className="gov-header">
        <div className="gov-title">
          <span className="gov-icon">🏛️</span>
          <h2>Governance</h2>
        </div>
        <div className="gov-tabs">
          <button
            id="gov-tab-rules"
            className={`gov-tab ${activeView === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveView('rules')}
          >
            Policy Rules
          </button>
          <button
            id="gov-tab-violations"
            className={`gov-tab ${activeView === 'violations' ? 'active' : ''}`}
            onClick={() => setActiveView('violations')}
          >
            Violations
          </button>
          <button
            id="gov-tab-statistics"
            className={`gov-tab ${activeView === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveView('statistics')}
          >
            Statistics
          </button>
        </div>
      </div>

      {error && (
        <div className="gov-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="gov-loading" aria-live="polite">
          Loading {activeView}…
        </div>
      )}

      {/* Policy Rules View */}
      {activeView === 'rules' && !loading && (
        <div className="gov-rules" id="gov-rules-view">
          <div className="gov-section-header">
            <h3>Policy Rules ({rules.length})</h3>
            <p className="gov-hint">Rules are evaluated in priority order. Higher priority rules run first.</p>
          </div>

          {rules.length === 0 && (
            <div className="gov-empty">No policy rules registered. Default rules are applied automatically.</div>
          )}

          <div className="gov-rule-list">
            {rules.map(rule => (
              <div
                key={rule.id}
                id={`policy-rule-${rule.id}`}
                className={`gov-rule-item ${expandedRuleId === rule.id ? 'expanded' : ''} ${!rule.enabled ? 'disabled' : ''}`}
              >
                <div
                  className="gov-rule-header"
                  onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
                >
                  <div className="gov-rule-title">
                    <span className="gov-rule-name">{rule.name}</span>
                    <span className={`gov-rule-type type-${rule.type}`}>{rule.type}</span>
                    {!rule.enabled && <span className="gov-badge badge-disabled">Disabled</span>}
                  </div>
                  <div className="gov-rule-meta">
                    {getActionBadge(rule.action)}
                    <span className="gov-rule-priority">Priority: {rule.priority}</span>
                    <span className="gov-expand-indicator">{expandedRuleId === rule.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expandedRuleId === rule.id && (
                  <div className="gov-rule-details">
                    <p className="gov-rule-description">{rule.description}</p>

                    {rule.conditions && rule.conditions.length > 0 && (
                      <div className="gov-conditions">
                        <h4>Conditions</h4>
                        {rule.conditions.map((cond: any, i: number) => (
                          <div key={i} className="gov-condition">
                            <code>{cond.field}</code>
                            <span className="gov-condition-op">{cond.operator}</span>
                            <code>{String(cond.value)}</code>
                          </div>
                        ))}
                      </div>
                    )}

                    {rule.metadata?.tags && rule.metadata.tags.length > 0 && (
                      <div className="gov-tags">
                        {rule.metadata.tags.map((tag: string) => (
                          <span key={tag} className="gov-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="gov-rule-actions">
                      {!['high-risk-tools', 'sensitive-data-detection', 'risk-scoring'].includes(rule.id) && (
                        <button
                          id={`remove-rule-${rule.id}`}
                          className="gov-btn gov-btn-danger"
                          onClick={() => handleUnregisterRule(rule.id)}
                        >
                          Remove Rule
                        </button>
                      )}
                      {['high-risk-tools', 'sensitive-data-detection', 'risk-scoring'].includes(rule.id) && (
                        <span className="gov-default-badge">Default Rule (Protected)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violations View */}
      {activeView === 'violations' && !loading && (
        <div className="gov-violations" id="gov-violations-view">
          <div className="gov-section-header">
            <h3>Policy Violations ({violations.length})</h3>
            <p className="gov-hint">Events where policy checks blocked or flagged an action.</p>
          </div>

          {violations.length === 0 && (
            <div className="gov-empty">
              <span className="gov-empty-icon">✅</span>
              No violations recorded. All actions are within policy boundaries.
            </div>
          )}

          <div className="gov-violation-list">
            {violations.map((violation: any) => (
              <div
                key={violation.id}
                id={`violation-${violation.id}`}
                className={`gov-violation-item action-${violation.action}`}
              >
                <div className="gov-violation-header">
                  <span className={`gov-action-badge action-${violation.action}`}>
                    {getViolationLabel(violation.action)}
                  </span>
                  <span className="gov-violation-time">{formatTimestamp(violation.timestamp)}</span>
                </div>
                <div className="gov-violation-body">
                  <div className="gov-violation-policy">
                    <strong>Policy:</strong> {violation.policyName}
                  </div>
                  <div className="gov-violation-target">
                    <strong>Target:</strong>{' '}
                    {violation.context?.tool?.name || violation.context?.document?.title || 'Unknown'}
                  </div>
                  {violation.result.reason && (
                    <div className="gov-violation-reason">
                      <strong>Reason:</strong> {violation.result.reason}
                    </div>
                  )}
                  <div className="gov-violation-risk">
                    {getRiskBadge(violation.result.riskScore)}
                    {violation.result.sensitiveDataDetected && (
                      <span className="gov-badge badge-sensitive">Sensitive Data Detected</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics View */}
      {activeView === 'statistics' && !loading && statistics && (
        <div className="gov-statistics" id="gov-statistics-view">
          <div className="gov-section-header">
            <h3>Policy Statistics</h3>
          </div>

          <div className="gov-stats-grid">
            <div className="gov-stat-card">
              <div className="gov-stat-label">Total Evaluations</div>
              <div className="gov-stat-value">{statistics.totalEvaluations.toLocaleString()}</div>
            </div>
            <div className="gov-stat-card gov-stat-success">
              <div className="gov-stat-label">Allowed</div>
              <div className="gov-stat-value">{statistics.allowedCount.toLocaleString()}</div>
            </div>
            <div className="gov-stat-card gov-stat-danger">
              <div className="gov-stat-label">Denied</div>
              <div className="gov-stat-value">{statistics.deniedCount.toLocaleString()}</div>
            </div>
            <div className="gov-stat-card gov-stat-warning">
              <div className="gov-stat-label">Approval Required</div>
              <div className="gov-stat-value">{statistics.approvalRequiredCount.toLocaleString()}</div>
            </div>
            <div className="gov-stat-card gov-stat-danger">
              <div className="gov-stat-label">Violations</div>
              <div className="gov-stat-value">{statistics.violationCount.toLocaleString()}</div>
            </div>
            <div className="gov-stat-card">
              <div className="gov-stat-label">Sensitive Data Detections</div>
              <div className="gov-stat-value">{statistics.sensitiveDataDetections.toLocaleString()}</div>
            </div>
            <div className="gov-stat-card">
              <div className="gov-stat-label">Avg Evaluation Time</div>
              <div className="gov-stat-value">{statistics.averageEvaluationTime.toFixed(2)}ms</div>
            </div>
          </div>

          {statistics.evaluationsByRule && Object.keys(statistics.evaluationsByRule).length > 0 && (
            <div className="gov-rule-stats">
              <h4>Evaluations by Rule</h4>
              <div className="gov-rule-stat-list">
                {Object.entries(statistics.evaluationsByRule as Record<string, number>).map(([ruleId, count]) => (
                  <div key={ruleId} className="gov-rule-stat-item">
                    <span className="gov-rule-stat-name">{ruleId}</span>
                    <div className="gov-rule-stat-bar">
                      <div
                        className="gov-rule-stat-fill"
                        style={{
                          width: `${Math.min(100, (count / Math.max(...Object.values(statistics.evaluationsByRule as Record<string, number>))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="gov-rule-stat-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'statistics' && !loading && !statistics && (
        <div className="gov-empty">No statistics available yet.</div>
      )}
    </div>
  )
}

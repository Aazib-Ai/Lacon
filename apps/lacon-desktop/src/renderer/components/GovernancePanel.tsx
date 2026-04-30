/**
 * Governance Panel Component
 *
 * Displays policy rules, violations, statistics, and allows policy management.
 */

import React, { useCallback, useEffect, useState } from 'react'

import { cn } from '../lib/utils'
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
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">High Risk</span>
    }
    if (riskScore >= 0.4) {
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">Medium Risk</span>
    }
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-success/15 text-success">Low Risk</span>
  }

  const getViolationLabel = (action: string) => {
    if (action === 'blocked') {return '🚫 Blocked'}
    if (action === 'approved') {return '⚠️ Flagged'}
    return '📋 Logged'
  }

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      deny: 'bg-destructive/15 text-destructive',
      'require-approval': 'bg-warning/15 text-warning',
      allow: 'bg-success/15 text-success',
    }
    const labels: Record<string, string> = {
      deny: 'Deny',
      'require-approval': 'Require Approval',
      allow: 'Allow',
    }
    return (
      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', styles[action] || 'bg-muted text-muted-foreground')}>
        {labels[action] || 'Log Only'}
      </span>
    )
  }

  const tabs: { id: PolicyView; label: string }[] = [
    { id: 'rules', label: 'Policy Rules' },
    { id: 'violations', label: 'Violations' },
    { id: 'statistics', label: 'Statistics' },
  ]

  return (
    <div className="flex flex-col h-full" id="governance-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🏛️</span>
          <h2 className="text-base font-semibold text-foreground m-0">Governance</h2>
        </div>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`gov-tab-${tab.id}`}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeView === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              onClick={() => setActiveView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="px-4 py-3 text-sm text-muted-foreground" aria-live="polite">
          Loading {activeView}…
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {/* Policy Rules View */}
        {activeView === 'rules' && !loading && (
          <div id="gov-rules-view">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground m-0 mb-1">Policy Rules ({rules.length})</h3>
              <p className="text-xs text-muted-foreground m-0">Rules are evaluated in priority order. Higher priority rules run first.</p>
            </div>

            {rules.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No policy rules registered. Default rules are applied automatically.
              </div>
            )}

            <div className="flex flex-col gap-2">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  id={`policy-rule-${rule.id}`}
                  className={cn(
                    'rounded-lg border border-border bg-card transition-all',
                    expandedRuleId === rule.id && 'ring-1 ring-primary/20',
                    !rule.enabled && 'opacity-50',
                  )}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
                    onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{rule.name}</span>
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded',
                        rule.type === 'content' ? 'bg-primary/10 text-primary' :
                        rule.type === 'tool' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {rule.type}
                      </span>
                      {!rule.enabled && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Disabled</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getActionBadge(rule.action)}
                      <span className="text-[10px] text-muted-foreground">Priority: {rule.priority}</span>
                      <span className="text-xs text-muted-foreground">{expandedRuleId === rule.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expandedRuleId === rule.id && (
                    <div className="px-4 pb-4 border-t border-border pt-3 animate-in fade-in duration-200">
                      <p className="text-sm text-muted-foreground mb-3 mt-0">{rule.description}</p>

                      {rule.conditions && rule.conditions.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-semibold text-foreground mb-1.5 mt-0">Conditions</h4>
                          {rule.conditions.map((cond: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs mb-1">
                              <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{cond.field}</code>
                              <span className="text-primary font-medium">{cond.operator}</span>
                              <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{String(cond.value)}</code>
                            </div>
                          ))}
                        </div>
                      )}

                      {rule.metadata?.tags && rule.metadata.tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {rule.metadata.tags.map((tag: string) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {!['high-risk-tools', 'sensitive-data-detection', 'risk-scoring'].includes(rule.id) ? (
                          <button
                            id={`remove-rule-${rule.id}`}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                            onClick={() => handleUnregisterRule(rule.id)}
                          >
                            Remove Rule
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Default Rule (Protected)</span>
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
          <div id="gov-violations-view">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground m-0 mb-1">Policy Violations ({violations.length})</h3>
              <p className="text-xs text-muted-foreground m-0">Events where policy checks blocked or flagged an action.</p>
            </div>

            {violations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <span className="text-3xl mb-2">✅</span>
                <p className="text-sm m-0">No violations recorded. All actions are within policy boundaries.</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {violations.map((violation: any) => (
                <div
                  key={violation.id}
                  id={`violation-${violation.id}`}
                  className={cn(
                    'rounded-lg border p-3',
                    violation.action === 'blocked' ? 'border-destructive/20 bg-destructive/5' :
                    violation.action === 'approved' ? 'border-warning/20 bg-warning/5' :
                    'border-border bg-card',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      'text-xs font-semibold',
                      violation.action === 'blocked' ? 'text-destructive' :
                      violation.action === 'approved' ? 'text-warning' :
                      'text-muted-foreground',
                    )}>
                      {getViolationLabel(violation.action)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{formatTimestamp(violation.timestamp)}</span>
                  </div>
                  <div className="text-xs text-foreground space-y-1">
                    <div><strong className="text-muted-foreground">Policy:</strong> {violation.policyName}</div>
                    <div>
                      <strong className="text-muted-foreground">Target:</strong>{' '}
                      {violation.context?.tool?.name || violation.context?.document?.title || 'Unknown'}
                    </div>
                    {violation.result.reason && (
                      <div><strong className="text-muted-foreground">Reason:</strong> {violation.result.reason}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {getRiskBadge(violation.result.riskScore)}
                      {violation.result.sensitiveDataDetected && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                          Sensitive Data Detected
                        </span>
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
          <div id="gov-statistics-view">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground m-0">Policy Statistics</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Total Evaluations', value: statistics.totalEvaluations.toLocaleString() },
                { label: 'Allowed', value: statistics.allowedCount.toLocaleString(), color: 'text-success' },
                { label: 'Denied', value: statistics.deniedCount.toLocaleString(), color: 'text-destructive' },
                { label: 'Approval Required', value: statistics.approvalRequiredCount.toLocaleString(), color: 'text-warning' },
                { label: 'Violations', value: statistics.violationCount.toLocaleString(), color: 'text-destructive' },
                { label: 'Sensitive Data Detections', value: statistics.sensitiveDataDetections.toLocaleString() },
                { label: 'Avg Evaluation Time', value: `${statistics.averageEvaluationTime.toFixed(2)}ms` },
              ].map(stat => (
                <div key={stat.label} className="p-3 bg-card rounded-lg border border-border">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{stat.label}</div>
                  <div className={cn('text-lg font-bold tabular-nums', stat.color || 'text-foreground')}>{stat.value}</div>
                </div>
              ))}
            </div>

            {statistics.evaluationsByRule && Object.keys(statistics.evaluationsByRule).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 mt-0">Evaluations by Rule</h4>
                <div className="flex flex-col gap-2">
                  {Object.entries(statistics.evaluationsByRule as Record<string, number>).map(([ruleId, count]) => (
                    <div key={ruleId} className="flex items-center gap-3">
                      <span className="text-xs text-foreground font-medium w-40 truncate">{ruleId}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (count / Math.max(...Object.values(statistics.evaluationsByRule as Record<string, number>))) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'statistics' && !loading && !statistics && (
          <div className="text-center py-8 text-sm text-muted-foreground">No statistics available yet.</div>
        )}
      </div>
    </div>
  )
}

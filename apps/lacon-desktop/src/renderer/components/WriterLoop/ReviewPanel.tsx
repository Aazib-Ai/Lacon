/**
 * ReviewPanel — Phase 4
 *
 * Displays reviewer flags with suggested rewrites.
 * Provides Accept/Reject per flag, surgical "Fix with AI" per paragraph,
 * and a "Rewrite All" fallback.
 */

import React, { useState } from 'react'

import type { ReviewFlag, ReviewResult } from '../../../shared/writer-types'

interface ReviewPanelProps {
  review: ReviewResult | null
  passCount: number
  canAutoPass: boolean
  onAcceptFlag: (flagId: string) => void
  onRejectFlag: (flagId: string) => void
  onSurgicalEdit: (paragraphId: string, instruction: string) => void
  onRewriteAll: (instruction: string) => void
  onRunReview: () => void
}

function renderFlagsList(
  review: ReviewResult | null,
  acceptedFlags: Set<string>,
  rejectedFlags: Set<string>,
  severityColors: Record<string, string>,
  severityBgColors: Record<string, string>,
  handleAccept: (id: string) => void,
  handleReject: (id: string) => void,
  handleSurgicalEdit: (flag: ReviewFlag) => void,
) {
  if (!review) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af', fontSize: '14px' }}>
        No review results yet. Click &quot;Run Review&quot; to start.
      </div>
    )
  }

  if (review.flags.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px', color: '#059669', fontSize: '14px' }}>
        ✓ No issues found. Content looks good!
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {review.flags.map(flag => {
        const isAccepted = acceptedFlags.has(flag.id)
        const isRejected = rejectedFlags.has(flag.id)
        const isResolved = isAccepted || isRejected

        return (
          <div
            key={flag.id}
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: isResolved ? '#f3f4f6' : severityBgColors[flag.severity],
              border: `1px solid ${isResolved ? '#e5e7eb' : severityColors[flag.severity]}20`,
              opacity: isResolved ? 0.6 : 1,
              transition: 'opacity 200ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: severityColors[flag.severity],
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              >
                {flag.severity}
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{flag.category}</span>
              {isAccepted && <span style={{ fontSize: '11px', color: '#059669' }}>✓ Accepted</span>}
              {isRejected && <span style={{ fontSize: '11px', color: '#dc2626' }}>✗ Rejected</span>}
            </div>

            <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>{flag.message}</p>

            <div
              style={{
                padding: '8px',
                backgroundColor: '#fef2f2',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#991b1b',
                marginBottom: '6px',
                borderLeft: '3px solid #fca5a5',
                fontFamily: 'monospace',
              }}
            >
              {flag.originalText.slice(0, 150)}
              {flag.originalText.length > 150 ? '...' : ''}
            </div>

            {flag.suggestedRewrite !== flag.originalText && (
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#166534',
                  marginBottom: '8px',
                  borderLeft: '3px solid #86efac',
                  fontFamily: 'monospace',
                }}
              >
                {flag.suggestedRewrite.slice(0, 150)}
                {flag.suggestedRewrite.length > 150 ? '...' : ''}
              </div>
            )}

            {!isResolved && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={() => handleAccept(flag.id)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() => handleReject(flag.id)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleSurgicalEdit(flag)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: '#7c3aed',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Fix with AI
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ReviewPanel({
  review,
  passCount,
  canAutoPass,
  onAcceptFlag,
  onRejectFlag,
  onSurgicalEdit,
  onRewriteAll,
  onRunReview,
}: ReviewPanelProps) {
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [editInstructions] = useState<Record<string, string>>({})
  const [acceptedFlags, setAcceptedFlags] = useState<Set<string>>(new Set())
  const [rejectedFlags, setRejectedFlags] = useState<Set<string>>(new Set())

  const handleAccept = (flagId: string) => {
    onAcceptFlag(flagId)
    setAcceptedFlags(prev => new Set(prev).add(flagId))
  }

  const handleReject = (flagId: string) => {
    onRejectFlag(flagId)
    setRejectedFlags(prev => new Set(prev).add(flagId))
  }

  const handleSurgicalEdit = (flag: ReviewFlag) => {
    const instruction = editInstructions[flag.id] || flag.message
    onSurgicalEdit(flag.paragraphId, instruction)
  }

  const handleRewriteAll = () => {
    if (rewriteInstruction.trim()) {
      onRewriteAll(rewriteInstruction.trim())
      setRewriteInstruction('')
    }
  }

  const severityColors: Record<string, string> = {
    suggestion: '#3b82f6',
    warning: '#f59e0b',
    error: '#ef4444',
  }

  const severityBgColors: Record<string, string> = {
    suggestion: 'rgba(59,130,246,0.08)',
    warning: 'rgba(245,158,11,0.08)',
    error: 'rgba(239,68,68,0.08)',
  }

  return (
    <div
      className="review-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#fafbfc',
        borderLeft: '1px solid #e5e7eb',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>Review Panel</h3>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            Pass {passCount}/3 {!canAutoPass && '— Max reached'}
          </span>
        </div>
        <button
          onClick={onRunReview}
          disabled={!canAutoPass}
          style={{
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: canAutoPass ? '#4f46e5' : '#d1d5db',
            color: canAutoPass ? '#fff' : '#9ca3af',
            border: 'none',
            borderRadius: '6px',
            cursor: canAutoPass ? 'pointer' : 'not-allowed',
          }}
        >
          Run Review
        </button>
      </div>

      {/* Flags list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {renderFlagsList(
          review,
          acceptedFlags,
          rejectedFlags,
          severityColors,
          severityBgColors,
          handleAccept,
          handleReject,
          handleSurgicalEdit,
        )}

        {/* Structure conflicts */}
        {review && review.structureConflicts.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
              ⚠ Structure Conflicts (Planner Authority)
            </h4>
            {review.structureConflicts.map((conflict, i) => (
              <div
                key={i}
                style={{
                  padding: '8px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#92400e',
                  marginBottom: '6px',
                }}
              >
                {conflict}
              </div>
            ))}
          </div>
        )}

        {/* Token usage */}
        {review && (
          <div
            style={{
              marginTop: '16px',
              padding: '10px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Token Usage — Pass #{review.passNumber}
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#64748b' }}>
              <span>Input: {review.tokenUsage.inputTokens.toLocaleString()}</span>
              <span>Output: {review.tokenUsage.outputTokens.toLocaleString()}</span>
              <span>Cost: ${review.tokenUsage.estimatedCost.toFixed(4)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Rewrite All footer */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#fff',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Rewrite All (Fallback)
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={rewriteInstruction}
            onChange={e => setRewriteInstruction(e.target.value)}
            placeholder="Instruction for full rewrite..."
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
            }}
            onKeyDown={e => e.key === 'Enter' && handleRewriteAll()}
          />
          <button
            onClick={handleRewriteAll}
            disabled={!rewriteInstruction.trim()}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: rewriteInstruction.trim() ? '#dc2626' : '#e5e7eb',
              color: rewriteInstruction.trim() ? '#fff' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              cursor: rewriteInstruction.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Rewrite All
          </button>
        </div>
      </div>
    </div>
  )
}

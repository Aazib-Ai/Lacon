/**
 * ReviewPanel — Review Flags with Suggested Rewrites
 *
 * Displays reviewer flags with suggested rewrites.
 * Provides Accept/Reject per flag, surgical "Fix with AI" per paragraph,
 * and a "Rewrite All" fallback.
 */

import React, { useState } from 'react'

import type { ReviewFlag, ReviewResult } from '../../../shared/writer-types'
import { cn } from '../../lib/utils'

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

const severityStyles: Record<string, { badge: string; bg: string }> = {
  suggestion: { badge: 'bg-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  warning: { badge: 'bg-warning', bg: 'bg-warning/10 border-warning/20' },
  error: { badge: 'bg-destructive', bg: 'bg-destructive/10 border-destructive/20' },
}

function FlagCard({
  flag,
  isAccepted,
  isRejected,
  onAccept,
  onReject,
  onSurgicalEdit,
}: {
  flag: ReviewFlag
  isAccepted: boolean
  isRejected: boolean
  onAccept: () => void
  onReject: () => void
  onSurgicalEdit: () => void
}) {
  const isResolved = isAccepted || isRejected
  const styles = severityStyles[flag.severity] || severityStyles.suggestion

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-opacity',
        isResolved ? 'bg-muted/50 border-border opacity-60' : styles.bg,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold text-white uppercase', styles.badge)}
        >
          {flag.severity}
        </span>
        <span className="text-[11px] text-muted-foreground font-medium">{flag.category}</span>
        {isAccepted && <span className="text-[11px] text-success">✓ Accepted</span>}
        {isRejected && <span className="text-[11px] text-destructive">✗ Rejected</span>}
      </div>

      <p className="m-0 mb-2 text-[13px] text-foreground leading-relaxed">{flag.message}</p>

      <div className="px-2 py-1.5 bg-destructive/10 rounded border-l-[3px] border-destructive/40 text-xs text-destructive font-mono mb-1.5">
        {flag.originalText.slice(0, 150)}
        {flag.originalText.length > 150 ? '...' : ''}
      </div>

      {flag.suggestedRewrite !== flag.originalText && (
        <div className="px-2 py-1.5 bg-success/10 rounded border-l-[3px] border-success/40 text-xs text-success font-mono mb-2">
          {flag.suggestedRewrite.slice(0, 150)}
          {flag.suggestedRewrite.length > 150 ? '...' : ''}
        </div>
      )}

      {!isResolved && (
        <div className="flex gap-1.5 items-center">
          <button
            onClick={onAccept}
            className="px-3 py-1 text-xs font-medium bg-success text-white border-none rounded cursor-pointer hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1 text-xs font-medium bg-destructive text-white border-none rounded cursor-pointer hover:opacity-90 transition-opacity"
          >
            Reject
          </button>
          <button
            onClick={onSurgicalEdit}
            className="px-3 py-1 text-xs font-medium bg-purple-600 text-white border-none rounded cursor-pointer hover:opacity-90 transition-opacity"
          >
            Fix with AI
          </button>
        </div>
      )}
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

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="m-0 text-[15px] font-semibold text-foreground">Review Panel</h3>
          <span className="text-xs text-muted-foreground">
            Pass {passCount}/3 {!canAutoPass && '— Max reached'}
          </span>
        </div>
        <button
          onClick={onRunReview}
          disabled={!canAutoPass}
          className={cn(
            'px-3.5 py-1.5 text-[13px] font-medium border-none rounded-md cursor-pointer transition-colors',
            canAutoPass
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          Run Review
        </button>
      </div>

      {/* Flags list */}
      <div className="flex-1 overflow-y-auto p-3">
        {!review ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No review results yet. Click &quot;Run Review&quot; to start.
          </div>
        ) : review.flags.length === 0 ? (
          <div className="text-center py-10 text-success text-sm">
            ✓ No issues found. Content looks good!
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {review.flags.map(flag => (
              <FlagCard
                key={flag.id}
                flag={flag}
                isAccepted={acceptedFlags.has(flag.id)}
                isRejected={rejectedFlags.has(flag.id)}
                onAccept={() => handleAccept(flag.id)}
                onReject={() => handleReject(flag.id)}
                onSurgicalEdit={() => handleSurgicalEdit(flag)}
              />
            ))}
          </div>
        )}

        {/* Structure conflicts */}
        {review && review.structureConflicts.length > 0 && (
          <div className="mt-4">
            <h4 className="m-0 mb-2 text-[13px] font-semibold text-warning">
              ⚠ Structure Conflicts (Planner Authority)
            </h4>
            {review.structureConflicts.map((conflict, i) => (
              <div
                key={i}
                className="p-2 bg-warning/10 border border-warning/20 rounded-md text-xs text-warning mb-1.5"
              >
                {conflict}
              </div>
            ))}
          </div>
        )}

        {/* Token usage */}
        {review && (
          <div className="mt-4 p-2.5 bg-muted/50 rounded-md border border-border">
            <div className="text-xs font-semibold text-muted-foreground mb-1">
              Token Usage — Pass #{review.passNumber}
            </div>
            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span>Input: {review.tokenUsage.inputTokens.toLocaleString()}</span>
              <span>Output: {review.tokenUsage.outputTokens.toLocaleString()}</span>
              <span>Cost: ${review.tokenUsage.estimatedCost.toFixed(4)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Rewrite All footer */}
      <div className="px-3 py-3 border-t border-border bg-card">
        <div className="text-xs font-semibold text-foreground mb-1.5">Rewrite All (Fallback)</div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={rewriteInstruction}
            onChange={e => setRewriteInstruction(e.target.value)}
            placeholder="Instruction for full rewrite..."
            className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground outline-none focus:border-primary"
            onKeyDown={e => e.key === 'Enter' && handleRewriteAll()}
          />
          <button
            onClick={handleRewriteAll}
            disabled={!rewriteInstruction.trim()}
            className={cn(
              'px-3.5 py-1.5 text-xs font-medium border-none rounded-md cursor-pointer transition-colors',
              rewriteInstruction.trim()
                ? 'bg-destructive text-white hover:opacity-90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            Rewrite All
          </button>
        </div>
      </div>
    </div>
  )
}

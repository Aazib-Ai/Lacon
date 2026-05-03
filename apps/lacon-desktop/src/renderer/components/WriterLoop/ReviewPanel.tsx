/**
 * ReviewPanel — AI Review Interface
 *
 * Displays reviewer flags as expandable cards.
 * Minimalist design — no emojis, no colored text, no gradient buttons.
 *
 * Button behavior:
 *  - Accept     → applies the suggested fix via AI (surgicalEdit) + shows loading
 *  - Dismiss    → ignores the flag
 *  - Custom Fix → user types their own instruction for the AI + shows loading
 */

import React, { useEffect, useState } from 'react'

import type { ReviewFlag, ReviewResult } from '../../../shared/writer-types'
import { cn } from '../../lib/utils'

interface ReviewPanelProps {
  review: ReviewResult | null
  passCount: number
  canAutoPass: boolean
  loading?: boolean
  onAcceptFlag: (flagId: string) => void
  onRejectFlag: (flagId: string) => void
  onSurgicalEdit: (paragraphId: string, instruction: string, originalText?: string) => Promise<any>
  onRewriteAll: (instruction: string) => void
  onRunReview: () => void
}

// ── Neutral badges ──
const severityBadgeColors: Record<string, string> = {
  error: 'bg-muted text-foreground',
  warning: 'bg-muted text-foreground',
  suggestion: 'bg-muted text-foreground',
}

// ─────────────────────────── Flag Card ───────────────────────────

function FlagCard({
  flag,
  index,
  isAccepted,
  isRejected,
  isFixing,
  onAcceptFix,
  onReject,
  onCustomFix,
}: {
  flag: ReviewFlag
  index: number
  isAccepted: boolean
  isRejected: boolean
  isFixing: boolean
  onAcceptFix: () => void
  onReject: () => void
  onCustomFix: (instruction: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInstruction, setCustomInstruction] = useState('')
  const isResolved = isAccepted || isRejected
  const badgeColor = severityBadgeColors[flag.severity] || severityBadgeColors.suggestion

  const handleCustomSubmit = () => {
    if (customInstruction.trim()) {
      onCustomFix(customInstruction.trim())
      setCustomInstruction('')
      setShowCustomInput(false)
    }
  }

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl overflow-hidden transition-all hover:border-muted-foreground/30 hover:shadow-md',
        isResolved && 'opacity-50',
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold flex-shrink-0',
            badgeColor,
          )}
        >
          {index + 1}
        </span>

        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          <h3 className="text-[0.95rem] font-semibold m-0 text-foreground uppercase">
            {flag.category}
          </h3>
          <span className="text-[0.7rem] text-muted-foreground whitespace-nowrap">
            {flag.severity}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isFixing && (
            <span className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <span className="inline-block w-3 h-3 border-2 border-border border-t-foreground rounded-full animate-spin" />
              Fixing…
            </span>
          )}
          {isAccepted && !isFixing && <span className="text-[0.7rem] text-muted-foreground">Fixed</span>}
          {isRejected && <span className="text-[0.7rem] text-muted-foreground">Dismissed</span>}
          <span className="text-xs text-muted-foreground transition-transform">
            {isExpanded ? '▾' : '▸'}
          </span>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="px-4 pb-4 pl-14 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="m-0 text-sm text-foreground leading-snug">
            {flag.message}
          </p>

          {/* Original text */}
          {flag.originalText && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-0">
                Original
              </h4>
              <p className="m-0 text-sm text-muted-foreground leading-snug">
                {flag.originalText.slice(0, 250)}
                {flag.originalText.length > 250 ? '…' : ''}
              </p>
            </div>
          )}

          {/* Suggested fix */}
          {flag.suggestedRewrite && flag.suggestedRewrite !== flag.originalText && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-0">
                Suggested Fix
              </h4>
              <p className="m-0 text-sm text-foreground leading-snug">
                {flag.suggestedRewrite.slice(0, 250)}
                {flag.suggestedRewrite.length > 250 ? '…' : ''}
              </p>
            </div>
          )}

          {/* Actions */}
          {!isResolved && !isFixing && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onAcceptFix() }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-all"
                >
                  Accept
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onReject() }}
                  className="text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-md transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCustomInput(!showCustomInput) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-card text-foreground border border-border hover:bg-muted transition-colors"
                >
                  Custom Fix
                </button>
              </div>

              {/* Custom fix input */}
              {showCustomInput && (
                <div className="flex gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={customInstruction}
                    onChange={e => setCustomInstruction(e.target.value)}
                    placeholder="Describe how to fix this…"
                    className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground text-sm font-inherit transition-colors focus:outline-none focus:border-foreground/30"
                    onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
                    autoFocus
                  />
                  <button
                    onClick={handleCustomSubmit}
                    disabled={!customInstruction.trim()}
                    className="px-3 py-1.5 rounded-md border border-border bg-card text-foreground font-semibold cursor-pointer hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Fixing state */}
          {isFixing && (
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span className="inline-block w-3.5 h-3.5 border-2 border-border border-t-foreground rounded-full animate-spin" />
              Applying fix…
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Loading ───────────────────────────

function ReviewLoadingState() {
  const [elapsed, setElapsed] = useState(0)

  React.useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 text-muted-foreground" id="review-loading">
      <div className="w-8 h-8 border-3 border-border border-t-foreground rounded-full animate-spin" />
      <p className="text-sm font-medium text-foreground m-0">Reviewing your document…</p>
      <p className="text-xs text-muted-foreground m-0">
        Comparing content against your approved outline
      </p>
      {elapsed > 3 && (
        <p className="text-xs text-muted-foreground m-0 tabular-nums">
          {elapsed}s elapsed…{elapsed > 15 ? ' This is taking longer than usual.' : ''}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────── Main Panel ───────────────────────────

export function ReviewPanel({
  review,
  passCount,
  canAutoPass,
  loading,
  onAcceptFlag,
  onRejectFlag,
  onSurgicalEdit,
  onRewriteAll,
  onRunReview,
}: ReviewPanelProps) {
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [acceptedFlags, setAcceptedFlags] = useState<Set<string>>(new Set())
  const [rejectedFlags, setRejectedFlags] = useState<Set<string>>(new Set())
  const [fixingFlags, setFixingFlags] = useState<Set<string>>(new Set())

  // Sync accepted/rejected state from persisted flag.status when review loads
  useEffect(() => {
    if (!review?.flags) return
    const accepted = new Set<string>()
    const rejected = new Set<string>()
    for (const flag of review.flags) {
      if (flag.status === 'accepted') accepted.add(flag.id)
      if (flag.status === 'rejected') rejected.add(flag.id)
    }
    if (accepted.size > 0) setAcceptedFlags(accepted)
    if (rejected.size > 0) setRejectedFlags(rejected)
  }, [review])

  // Track whether we're doing a surgical edit (not a full review)
  const isSurgicalFixing = fixingFlags.size > 0

  /**
   * Accept: apply the suggested fix via surgicalEdit, then mark resolved.
   */
  const handleAcceptFix = async (flag: ReviewFlag) => {
    const instruction = flag.suggestedRewrite
      ? `Replace the original text with: ${flag.suggestedRewrite}`
      : flag.message

    // Show loading spinner on this flag
    setFixingFlags(prev => new Set(prev).add(flag.id))

    try {
      await onSurgicalEdit(flag.paragraphId, instruction, flag.originalText)
      onAcceptFlag(flag.id)
      setAcceptedFlags(prev => new Set(prev).add(flag.id))
    } catch (err) {
      console.error('[ReviewPanel] Accept fix failed:', err)
    } finally {
      setFixingFlags(prev => {
        const next = new Set(prev)
        next.delete(flag.id)
        return next
      })
    }
  }

  const handleReject = (flagId: string) => {
    onRejectFlag(flagId)
    setRejectedFlags(prev => new Set(prev).add(flagId))
  }

  /**
   * Custom Fix: user writes their own instruction for the AI.
   */
  const handleCustomFix = async (flag: ReviewFlag, instruction: string) => {
    setFixingFlags(prev => new Set(prev).add(flag.id))

    try {
      await onSurgicalEdit(flag.paragraphId, instruction, flag.originalText)
      onAcceptFlag(flag.id)
      setAcceptedFlags(prev => new Set(prev).add(flag.id))
    } catch (err) {
      console.error('[ReviewPanel] Custom fix failed:', err)
    } finally {
      setFixingFlags(prev => {
        const next = new Set(prev)
        next.delete(flag.id)
        return next
      })
    }
  }

  const handleRewriteAll = () => {
    if (rewriteInstruction.trim()) {
      onRewriteAll(rewriteInstruction.trim())
      setRewriteInstruction('')
    }
  }

  const totalFlags = review?.flags.length || 0
  const resolvedCount = acceptedFlags.size + rejectedFlags.size
  const unresolvedCount = totalFlags - resolvedCount
  const isHeuristic = review?.tokenUsage?.model === 'heuristic-fallback'

  // Only show full loading when doing a review (not surgical fixes)
  const isReviewLoading = loading && !isSurgicalFixing

  // ── Loading — no review yet ──
  if (isReviewLoading && !review) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-xl font-bold m-0 text-foreground">Review</h2>
        </div>
        <ReviewLoadingState />
      </div>
    )
  }

  // ── Empty ──
  if (!review && !loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center min-h-[320px] text-center gap-3 p-6" id="review-empty">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground mb-2">R</div>
          <h3 className="text-xl font-semibold m-0 text-foreground">Review Your Document</h3>
          <p className="text-sm text-muted-foreground m-0 mb-2 max-w-[360px]">
            Run a review to check your content against the approved outline.
          </p>
          <button
            id="review-run-btn"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!canAutoPass || loading}
            onClick={onRunReview}
          >
            {loading ? 'Reviewing…' : 'Run Review'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" id="review-panel">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 px-6 pt-6 pb-4">
        <div className="pb-3 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold m-0 text-foreground">Review</h2>
            <span className="text-[0.7rem] text-muted-foreground">
              {unresolvedCount > 0
                ? `${unresolvedCount} issue${unresolvedCount !== 1 ? 's' : ''} remaining`
                : totalFlags > 0 ? 'All resolved' : `${totalFlags} issues`}
            </span>
            <div className="ml-auto">
              <button
                onClick={onRunReview}
                disabled={!canAutoPass || loading}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  canAutoPass && !loading
                    ? 'bg-foreground text-background hover:opacity-90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                {loading ? 'Reviewing…' : passCount > 0 ? 'Re-review' : 'Run Review'}
              </button>
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>Pass {passCount}/3</span>
            <span>{isHeuristic ? 'Basic checks' : 'AI review'}</span>
            {review?.reviewedAt && (
              <span>{new Date(review.reviewedAt).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Loading overlay (only for full review, not surgical edits) ── */}
      {isReviewLoading && review && (
        <div className="px-6">
          <ReviewLoadingState />
        </div>
      )}

      {/* ── Flags ── */}
      {!isReviewLoading && (
        <div className="flex-1 overflow-y-auto">
          {review && review.flags.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-center gap-3 p-6">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-foreground mb-2">✓</div>
              <h3 className="text-xl font-semibold m-0 text-foreground">Looking Good</h3>
              <p className="text-sm text-muted-foreground m-0">
                No issues found in your document.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 px-6 pb-4">
              {review?.flags.map((flag, idx) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  index={idx}
                  isAccepted={acceptedFlags.has(flag.id)}
                  isRejected={rejectedFlags.has(flag.id)}
                  isFixing={fixingFlags.has(flag.id)}
                  onAcceptFix={() => handleAcceptFix(flag)}
                  onReject={() => handleReject(flag.id)}
                  onCustomFix={(instruction) => handleCustomFix(flag, instruction)}
                />
              ))}

              {/* Structure conflicts */}
              {review && review.structureConflicts.length > 0 && (
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-0">
                    Structure Notes
                  </h4>
                  <ul className="list-none m-0 p-0 flex flex-col gap-1">
                    {review.structureConflicts.map((conflict, i) => (
                      <li key={i} className="text-sm text-muted-foreground py-1 px-2 rounded-md bg-muted/50 leading-snug">
                        {conflict}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Token usage */}
              {review && (
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground px-1">
                  <span>{review.tokenUsage.inputTokens.toLocaleString()} tokens in</span>
                  <span>{review.tokenUsage.outputTokens.toLocaleString()} tokens out</span>
                  {review.tokenUsage.estimatedCost > 0 && (
                    <span>${review.tokenUsage.estimatedCost.toFixed(4)}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Rewrite ── */}
      <div className="px-6 py-4 border-t border-border">
        <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-0">
          Full Rewrite
        </h4>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={rewriteInstruction}
            onChange={e => setRewriteInstruction(e.target.value)}
            placeholder="Enter rewrite instruction…"
            className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground text-sm font-inherit transition-colors focus:outline-none focus:border-foreground/30"
            onKeyDown={e => e.key === 'Enter' && handleRewriteAll()}
          />
          <button
            onClick={handleRewriteAll}
            disabled={!rewriteInstruction.trim()}
            className="px-3 py-1.5 rounded-md border border-border bg-card text-foreground font-semibold cursor-pointer hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Rewrite
          </button>
        </div>
      </div>
    </div>
  )
}

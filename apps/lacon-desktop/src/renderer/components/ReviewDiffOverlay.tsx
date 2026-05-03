/**
 * ReviewDiffOverlay — Accept/Reject overlay for review fixes
 *
 * When the user clicks "Accept" on review flags:
 * 1. The text change is applied immediately (by LaconWorkspace)
 * 2. The changed text is highlighted in amber in the editor
 * 3. This overlay shows all pending changes for confirmation
 * 4. Accept All = keep changes, Reject All = undo to pre-edit snapshot
 *
 * Design: uses amber/orange tokens to differentiate from the refine overlay (green).
 */

import { Check, X } from 'lucide-react'
import React, { useEffect } from 'react'

export interface ReviewDiffItem {
  /** Unique flag ID from the review */
  flagId: string
  /** The original text that was in the document */
  originalText: string
  /** The AI-revised text (already applied to the editor) */
  revisedText: string
  /** ProseMirror range of the highlighted text (may be -1 if not found) */
  from: number
  to: number
}

interface ReviewDiffOverlayProps {
  diffs: ReviewDiffItem[]
  editor: any
  /** Called when user accepts — keep the changes */
  onAcceptAll: () => void
  /** Called when user rejects — undo all changes */
  onRejectAll: () => void
}

export function ReviewDiffOverlay({
  diffs,
  editor: _editor,
  onAcceptAll,
  onRejectAll,
}: ReviewDiffOverlayProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onAcceptAll()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onRejectAll()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onAcceptAll, onRejectAll])

  if (diffs.length === 0) return null

  return (
    <div
      className="review-diff-overlay"
      data-testid="review-diff-overlay"
    >
      {/* Header */}
      <div className="review-diff-overlay__header">
        <span className="review-diff-overlay__title">
          Review Changes
        </span>
        <span className="review-diff-overlay__count">
          {diffs.length} {diffs.length === 1 ? 'change' : 'changes'} applied
        </span>
      </div>

      {/* Edits list */}
      <div className="review-diff-overlay__content">
        {diffs.map((diff, idx) => {
          const revisedPreview =
            diff.revisedText.length > 200
              ? diff.revisedText.slice(0, 200) + '…'
              : diff.revisedText
          return (
            <div key={diff.flagId} className="review-diff-overlay__edit">
              <div className="review-diff-overlay__edit-label">
                Change {idx + 1}
              </div>
              <div className="review-diff-overlay__edit-text">
                {revisedPreview}
              </div>
            </div>
          )
        })}
      </div>

      {/* Accept / Reject toolbar */}
      <div className="review-diff-overlay__toolbar">
        <button
          className="review-diff-overlay__reject-btn"
          onClick={onRejectAll}
          title="Reject All (Esc)"
          data-testid="review-reject-all"
        >
          <X className="h-3.5 w-3.5" />
          Reject All
        </button>
        <button
          className="review-diff-overlay__accept-btn"
          onClick={onAcceptAll}
          title="Accept All (Ctrl+Enter)"
          data-testid="review-accept-all"
        >
          <Check className="h-3.5 w-3.5" />
          Accept All
        </button>
        <button
          className="review-diff-overlay__dismiss-btn"
          onClick={onRejectAll}
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

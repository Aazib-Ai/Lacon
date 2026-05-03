/**
 * RefineDiffOverlay — Highlighted diff with Accept/Reject controls
 *
 * When the AI returns a revised paragraph, this component:
 * 1. Highlights the original paragraph in the editor with a soft accent
 * 2. Shows the revised text as a floating comparison
 * 3. Provides Accept (replaces content) and Reject (restores original) buttons
 *
 * Design: uses Lacon's success/accent tokens with a soft tint overlay.
 */

import { Check, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef } from 'react'

export interface RefineDiffData {
  /** The original selected text */
  originalText: string
  /** The AI-revised text */
  revisedText: string
  /** ProseMirror range of the original selection */
  from: number
  to: number
  /** Was this an "add-paragraph" action? */
  isAddParagraph: boolean
}

interface RefineDiffOverlayProps {
  diff: RefineDiffData
  editor: any
  onAccept: () => void
  onReject: () => void
}

export function RefineDiffOverlay({
  diff,
  editor,
  onAccept,
  onReject,
}: RefineDiffOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Apply a highlight decoration to the affected range in the editor
  useEffect(() => {
    if (!editor || diff.isAddParagraph) return

    // Use TipTap's highlight mark to visually mark the affected text
    editor
      .chain()
      .setTextSelection({ from: diff.from, to: diff.to })
      .setHighlight({ color: 'refine-pending' })
      .run()

    return () => {
      // Clean up highlight on unmount
      try {
        if (editor && !editor.isDestroyed) {
          editor
            .chain()
            .setTextSelection({ from: diff.from, to: diff.to })
            .unsetHighlight()
            .run()
        }
      } catch {
        // Editor may have been destroyed
      }
    }
  }, [editor, diff.from, diff.to, diff.isAddParagraph])

  const handleAccept = useCallback(() => {
    if (!editor) return

    if (diff.isAddParagraph) {
      // Insert a new paragraph after the selection
      editor
        .chain()
        .focus()
        .setTextSelection(diff.to)
        .insertContent(`<p>${diff.revisedText}</p>`)
        .run()
    } else {
      // Replace the selected range with the revised text
      editor
        .chain()
        .focus()
        .setTextSelection({ from: diff.from, to: diff.to })
        .unsetHighlight()
        .deleteSelection()
        .insertContent(diff.revisedText)
        .run()
    }

    onAccept()
  }, [editor, diff, onAccept])

  const handleReject = useCallback(() => {
    if (!editor) return

    // Remove highlight, restore original
    if (!diff.isAddParagraph) {
      try {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: diff.from, to: diff.to })
          .unsetHighlight()
          .run()
      } catch {
        // Positions may have shifted
      }
    }

    onReject()
  }, [editor, diff, onReject])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleAccept()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handleReject()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleAccept, handleReject])

  // Truncate preview for long texts
  const revisedPreview =
    diff.revisedText.length > 300
      ? diff.revisedText.slice(0, 300) + '…'
      : diff.revisedText

  return (
    <div
      ref={overlayRef}
      className="refine-diff-overlay"
      data-testid="refine-diff-overlay"
    >
      {/* Revised text preview */}
      <div className="refine-diff-overlay__content">
        <div className="refine-diff-overlay__label">
          {diff.isAddParagraph ? 'New Paragraph' : 'Revised Version'}
        </div>
        <div className="refine-diff-overlay__text">
          {revisedPreview}
        </div>
      </div>

      {/* Accept / Reject toolbar */}
      <div className="refine-diff-overlay__toolbar">
        <button
          className="refine-diff-overlay__reject-btn"
          onClick={handleReject}
          title="Reject (Esc)"
          data-testid="refine-reject"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
        <button
          className="refine-diff-overlay__accept-btn"
          onClick={handleAccept}
          title="Accept (Ctrl+Enter)"
          data-testid="refine-accept"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </button>
        <button
          className="refine-diff-overlay__dismiss-btn"
          onClick={handleReject}
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

/**
 * ReviewPanelWrapper — Wraps the original ReviewPanel with hook integration
 *
 * Instead of applying surgical edits directly to the editor HTML,
 * this wrapper passes the result up to the parent (LaconWorkspace)
 * via onReviewDiffReady, so the text can be highlighted with
 * accept/reject controls before being committed.
 */

import React from 'react'

import { useWriterLoop } from '../../hooks/useWriterLoop'
import { ReviewPanel as ReviewPanelInner } from './ReviewPanel'

interface ReviewPanelWrapperProps {
  documentId: string | undefined
  /** Callback to retrieve the current editor content as TipTap JSON */
  getEditorJSON?: () => any
  /** Callback to replace the current editor HTML (for applying fixes) */
  setEditorHTML?: (html: string) => void
  /** Callback to get the current editor HTML */
  getEditorHTML?: () => string
  /** Called when a surgical edit returns revised text — passes the result up for highlighting */
  onReviewDiffReady?: (data: {
    flagId: string
    originalText: string
    revisedText: string
  }) => void
}

export function ReviewPanelWrapper({
  documentId,
  getEditorJSON,
  setEditorHTML,
  getEditorHTML,
  onReviewDiffReady,
}: ReviewPanelWrapperProps) {
  const loop = useWriterLoop(documentId)

  if (!documentId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
        <p>Open a document to see review results.</p>
      </div>
    )
  }

  /** Safely get the current document JSON from the editor */
  const getDocContent = () => {
    try {
      return getEditorJSON?.() ?? { type: 'doc', content: [] }
    } catch {
      return { type: 'doc', content: [] }
    }
  }

  return (
    <ReviewPanelInner
      review={loop.review}
      passCount={loop.reviewPassCount}
      canAutoPass={loop.canAutoPass}
      loading={loop.loading}
      onAcceptFlag={loop.acceptReviewFlag}
      onRejectFlag={loop.rejectReviewFlag}
      onSurgicalEdit={async (paragraphId, instruction, originalText) => {
        const result = await loop.surgicalEdit(paragraphId, instruction, getDocContent(), originalText)

        // Use result.originalText (full paragraph text from backend) instead of
        // flag.originalText (truncated ~200 chars from LLM review)
        const fullOriginalText = result?.originalText || originalText

        if (result?.revisedText && onReviewDiffReady) {
          onReviewDiffReady({
            flagId: paragraphId,
            originalText: fullOriginalText || '',
            revisedText: result.revisedText,
          })
        } else if (result?.revisedText && getEditorHTML && setEditorHTML) {
          // Fallback: if no onReviewDiffReady callback, apply directly (legacy behavior)
          const currentHTML = getEditorHTML()
          const searchText = fullOriginalText || ''
          if (searchText && currentHTML.includes(searchText.slice(0, 80))) {
            const newHTML = currentHTML.replace(searchText, result.revisedText)
            setEditorHTML(newHTML)
          }
        }
        return result
      }}
      onRewriteAll={instruction => {
        loop.rewriteAll(instruction, getDocContent())
      }}
      onRunReview={() => {
        loop.runReview(getDocContent())
      }}
    />
  )
}

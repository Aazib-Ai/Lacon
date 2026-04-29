/**
 * ReviewPanelWrapper — Wraps the original ReviewPanel with hook integration
 *
 * The original ReviewPanel takes data props; this wrapper provides a
 * documentId-based interface for use inside the RightPanel tabs.
 */

import React from 'react'

import { useWriterLoop } from '../../hooks/useWriterLoop'
import { ReviewPanel as ReviewPanelInner } from './ReviewPanel'

interface ReviewPanelWrapperProps {
  documentId: string | undefined
}

export function ReviewPanelWrapper({ documentId }: ReviewPanelWrapperProps) {
  const loop = useWriterLoop(documentId)

  if (!documentId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
        <p>Open a document to see review results.</p>
      </div>
    )
  }

  return (
    <ReviewPanelInner
      review={loop.review}
      passCount={loop.reviewPassCount}
      canAutoPass={loop.canAutoPass}
      onAcceptFlag={loop.acceptReviewFlag}
      onRejectFlag={loop.rejectReviewFlag}
      onSurgicalEdit={(paragraphId, instruction) => {
        // Get current document content from editor - for now pass empty
        loop.surgicalEdit(paragraphId, instruction, {})
      }}
      onRewriteAll={instruction => {
        loop.rewriteAll(instruction, {})
      }}
      onRunReview={() => {
        loop.runReview({})
      }}
    />
  )
}

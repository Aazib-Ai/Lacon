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
  /** Callback to retrieve the current editor content as TipTap JSON */
  getEditorJSON?: () => any
}

export function ReviewPanelWrapper({ documentId, getEditorJSON }: ReviewPanelWrapperProps) {
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
      onAcceptFlag={loop.acceptReviewFlag}
      onRejectFlag={loop.rejectReviewFlag}
      onSurgicalEdit={(paragraphId, instruction) => {
        loop.surgicalEdit(paragraphId, instruction, getDocContent())
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

/**
 * DiffViewer — Paragraph Diff Viewer
 *
 * Side-by-side diff viewer for surgical paragraph editing.
 * Shows original vs revised text with highlighted additions and removals.
 */

import React from 'react'

import type { DiffChunk, SurgicalEditResult } from '../../../shared/writer-types'

interface DiffViewerProps {
  result: SurgicalEditResult
  onAccept: () => void
  onReject: () => void
}

export function DiffViewer({ result, onAccept, onReject }: DiffViewerProps) {
  const { diff, tokenUsage } = result

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
        <div>
          <h4 className="m-0 text-sm font-semibold text-foreground">Paragraph Diff</h4>
          <span className="text-[11px] text-muted-foreground">Paragraph: {diff.paragraphId.slice(0, 12)}...</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="px-4 py-1.5 text-[13px] font-medium bg-success text-white border-none rounded-md cursor-pointer hover:opacity-90 transition-opacity"
          >
            Accept Change
          </button>
          <button
            onClick={onReject}
            className="px-4 py-1.5 text-[13px] font-medium bg-destructive text-white border-none rounded-md cursor-pointer hover:opacity-90 transition-opacity"
          >
            Reject
          </button>
        </div>
      </div>

      {/* Side-by-side diff */}
      <div className="grid grid-cols-2">
        {/* Original */}
        <div className="border-r border-border">
          <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20 text-[11px] font-semibold text-destructive">
            Original
          </div>
          <div className="p-3 font-mono text-[13px] leading-relaxed">
            {diff.chunks.map((chunk, i) => (
              <DiffLine key={i} chunk={chunk} side="original" />
            ))}
          </div>
        </div>

        {/* Revised */}
        <div>
          <div className="px-3 py-2 bg-success/10 border-b border-success/20 text-[11px] font-semibold text-success">
            Revised
          </div>
          <div className="p-3 font-mono text-[13px] leading-relaxed">
            {diff.chunks.map((chunk, i) => (
              <DiffLine key={i} chunk={chunk} side="revised" />
            ))}
          </div>
        </div>
      </div>

      {/* Token usage footer */}
      <div className="px-4 py-2 bg-muted/50 border-t border-border flex gap-4 text-[11px] text-muted-foreground">
        <span>Input: {tokenUsage.inputTokens.toLocaleString()} tokens</span>
        <span>Output: {tokenUsage.outputTokens.toLocaleString()} tokens</span>
        <span>Cost: ${tokenUsage.estimatedCost.toFixed(4)}</span>
        <span>Model: {tokenUsage.model}</span>
      </div>
    </div>
  )
}

function DiffLine({ chunk, side }: { chunk: DiffChunk; side: 'original' | 'revised' }) {
  if (chunk.type === 'unchanged') {
    return <div className="py-0.5 text-foreground">{chunk.content}</div>
  }

  if (chunk.type === 'removed' && side === 'original') {
    return (
      <div className="py-0.5 px-1 bg-destructive/20 text-destructive line-through rounded-sm">
        {chunk.content}
      </div>
    )
  }

  if (chunk.type === 'added' && side === 'revised') {
    return (
      <div className="py-0.5 px-1 bg-success/20 text-success rounded-sm">
        {chunk.content}
      </div>
    )
  }

  // Hide removed lines on revised side and added lines on original side
  return null
}

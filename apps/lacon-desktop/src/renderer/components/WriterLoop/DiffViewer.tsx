/**
 * DiffViewer — Phase 4
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
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        backgroundColor: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>Paragraph Diff</h4>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Paragraph: {diff.paragraphId.slice(0, 12)}...</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onAccept}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 150ms',
            }}
          >
            Accept Change
          </button>
          <button
            onClick={onReject}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 150ms',
            }}
          >
            Reject
          </button>
        </div>
      </div>

      {/* Side-by-side diff */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* Original */}
        <div style={{ borderRight: '1px solid #e5e7eb' }}>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#fef2f2',
              borderBottom: '1px solid #fecaca',
              fontSize: '11px',
              fontWeight: 600,
              color: '#991b1b',
            }}
          >
            Original
          </div>
          <div style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6 }}>
            {diff.chunks.map((chunk, i) => (
              <DiffLine key={i} chunk={chunk} side="original" />
            ))}
          </div>
        </div>

        {/* Revised */}
        <div>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
              fontSize: '11px',
              fontWeight: 600,
              color: '#166534',
            }}
          >
            Revised
          </div>
          <div style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6 }}>
            {diff.chunks.map((chunk, i) => (
              <DiffLine key={i} chunk={chunk} side="revised" />
            ))}
          </div>
        </div>
      </div>

      {/* Token usage footer */}
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '16px',
          fontSize: '11px',
          color: '#64748b',
        }}
      >
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
    return <div style={{ padding: '2px 0', color: '#374151' }}>{chunk.content}</div>
  }

  if (chunk.type === 'removed' && side === 'original') {
    return (
      <div
        style={{
          padding: '2px 4px',
          backgroundColor: '#fecaca',
          color: '#991b1b',
          textDecoration: 'line-through',
          borderRadius: '2px',
        }}
      >
        {chunk.content}
      </div>
    )
  }

  if (chunk.type === 'added' && side === 'revised') {
    return (
      <div
        style={{
          padding: '2px 4px',
          backgroundColor: '#bbf7d0',
          color: '#166534',
          borderRadius: '2px',
        }}
      >
        {chunk.content}
      </div>
    )
  }

  // Hide removed lines on revised side and added lines on original side
  return null
}

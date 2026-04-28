/**
 * VersionHistory — Phase 6
 *
 * Timeline UI for document snapshots with restore, milestone labels, and confirmation modal.
 */

import './VersionHistory.css'

import React, { useState } from 'react'

import type { SnapshotListItem, SnapshotTrigger } from '../../../shared/writer-types'
import { useVersion } from '../../hooks/useVersion'

interface VersionHistoryProps {
  documentId: string
  currentContent?: any
  onRestore?: (content: any) => void
}

const TRIGGER_LABELS: Record<SnapshotTrigger, { icon: string; label: string }> = {
  'outline-approved': { icon: '✅', label: 'Outline Approved' },
  'before-generation': { icon: '⏳', label: 'Before Generation' },
  'after-generation': { icon: '✨', label: 'After Generation' },
  'before-review': { icon: '🔍', label: 'Before Review' },
  manual: { icon: '📌', label: 'Manual Snapshot' },
}

// ── Sub-component defined before use ──

interface SnapshotCardProps {
  snapshot: SnapshotListItem
  isFirst: boolean
  milestoneInput: string | null
  onRestore: () => void
  onDelete: () => void
  onStartMilestone: () => void
  onMilestoneChange: (value: string) => void
  onSaveMilestone: () => void
  onCancelMilestone: () => void
}

const SnapshotCard: React.FC<SnapshotCardProps> = ({
  snapshot,
  isFirst,
  milestoneInput,
  onRestore,
  onDelete,
  onStartMilestone,
  onMilestoneChange,
  onSaveMilestone,
  onCancelMilestone,
}) => {
  const trigger = TRIGGER_LABELS[snapshot.trigger] || { icon: '📋', label: snapshot.trigger }
  const date = new Date(snapshot.createdAt)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = date.toLocaleDateString()

  return (
    <div className={`vh-snapshot ${isFirst ? 'vh-snapshot-latest' : ''}`}>
      <div className="vh-timeline-dot" />
      <div className="vh-snapshot-card">
        <div className="vh-snapshot-header">
          <span className="vh-trigger-icon">{trigger.icon}</span>
          <div className="vh-snapshot-meta">
            <span className="vh-snapshot-label">{snapshot.label}</span>
            <span className="vh-snapshot-time">
              {dateStr} at {timeStr}
            </span>
          </div>
          <span className="vh-trigger-badge">{trigger.label}</span>
        </div>

        {snapshot.milestoneLabel && milestoneInput === null && (
          <div className="vh-milestone">
            <span className="vh-milestone-icon">🏷️</span>
            <span className="vh-milestone-text">{snapshot.milestoneLabel}</span>
          </div>
        )}

        {milestoneInput !== null && (
          <div className="vh-milestone-form">
            <input
              className="vh-input"
              value={milestoneInput}
              onChange={e => onMilestoneChange(e.target.value)}
              placeholder="Milestone label..."
              onKeyDown={e => e.key === 'Enter' && onSaveMilestone()}
              autoFocus
            />
            <button className="vh-btn vh-btn-primary vh-btn-sm" onClick={onSaveMilestone}>
              Save
            </button>
            <button className="vh-btn vh-btn-ghost vh-btn-sm" onClick={onCancelMilestone}>
              ✕
            </button>
          </div>
        )}

        <div className="vh-snapshot-actions">
          <button className="vh-btn vh-btn-secondary vh-btn-sm" onClick={onRestore}>
            ↩ Restore
          </button>
          <button className="vh-btn vh-btn-ghost vh-btn-sm" onClick={onStartMilestone}>
            🏷️ Label
          </button>
          <button className="vh-btn vh-btn-ghost vh-btn-sm vh-btn-danger-text" onClick={onDelete}>
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──

export const VersionHistory: React.FC<VersionHistoryProps> = ({ documentId, currentContent, onRestore }) => {
  const {
    snapshots,
    confirmingRestore,
    loading,
    error,
    requestRestore,
    cancelRestore,
    confirmRestore,
    addMilestoneLabel,
    deleteSnapshot,
  } = useVersion(documentId)

  const [milestoneInput, setMilestoneInput] = useState<{ id: string; value: string } | null>(null)

  const handleRestore = async () => {
    const result = await confirmRestore(currentContent)
    if (result && onRestore) {onRestore(result.content)}
  }

  const handleAddMilestone = async (snapshotId: string) => {
    if (!milestoneInput || !milestoneInput.value.trim()) {return}
    await addMilestoneLabel(snapshotId, milestoneInput.value.trim())
    setMilestoneInput(null)
  }

  return (
    <div className="version-history">
      <div className="vh-header">
        <h3 className="vh-title">
          📜 Version History <span className="vh-count">{snapshots.length}</span>
        </h3>
      </div>

      {error && <div className="vh-error">{error}</div>}

      {confirmingRestore && (
        <div className="vh-confirm-overlay">
          <div className="vh-confirm-modal">
            <h4>⚠️ Restore Snapshot?</h4>
            <p>A safety snapshot of your current document will be created before restoring. This is reversible.</p>
            <div className="vh-confirm-actions">
              <button className="vh-btn vh-btn-primary" onClick={handleRestore} disabled={loading}>
                {loading ? 'Restoring...' : 'Confirm Restore'}
              </button>
              <button className="vh-btn vh-btn-ghost" onClick={cancelRestore}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="vh-timeline">
        {snapshots.length === 0 ? (
          <div className="vh-empty">
            <span className="vh-empty-icon">🕐</span>
            <p>No snapshots yet. Snapshots are created automatically at key milestones.</p>
          </div>
        ) : (
          snapshots.map((snap, idx) => (
            <SnapshotCard
              key={snap.id}
              snapshot={snap}
              isFirst={idx === 0}
              milestoneInput={milestoneInput?.id === snap.id ? milestoneInput.value : null}
              onRestore={() => requestRestore(snap.id)}
              onDelete={() => deleteSnapshot(snap.id)}
              onStartMilestone={() => setMilestoneInput({ id: snap.id, value: snap.milestoneLabel || '' })}
              onMilestoneChange={v => setMilestoneInput({ id: snap.id, value: v })}
              onSaveMilestone={() => handleAddMilestone(snap.id)}
              onCancelMilestone={() => setMilestoneInput(null)}
            />
          ))
        )}
      </div>

      {loading && !confirmingRestore && (
        <div className="vh-loading">
          <div className="vh-spinner" />
        </div>
      )}
    </div>
  )
}

export default VersionHistory

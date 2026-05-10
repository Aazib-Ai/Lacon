/**
 * VersionHistory — Document Snapshot Timeline
 *
 * Timeline UI for document snapshots with restore, milestone labels, and confirmation modal.
 */

import React, { useState } from 'react'

import type { SnapshotListItem, SnapshotTrigger } from '../../../shared/writer-types'
import { cn } from '../../lib/utils'
import { useVersion } from '../../hooks/useVersion'

interface VersionHistoryProps {
  documentId: string
  currentContent?: any
  onRestore?: (content: any) => void
  /** Optional getter for fresh editor content at restore time */
  getCurrentContent?: () => any
}

const TRIGGER_LABELS: Record<SnapshotTrigger, { icon: string; label: string }> = {
  'outline-approved': { icon: '✅', label: 'Outline Approved' },
  'before-generation': { icon: '⏳', label: 'Before Generation' },
  'after-generation': { icon: '✨', label: 'After Generation' },
  'before-review': { icon: '🔍', label: 'Before Review' },
  manual: { icon: '📌', label: 'Manual Snapshot' },
}

// ── Snapshot Card ──

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
    <div className="flex gap-3 relative">
      {/* Timeline dot */}
      <div className={cn(
        'w-3 h-3 rounded-full border-2 mt-1.5 flex-shrink-0 z-10',
        isFirst ? 'bg-primary border-primary' : 'bg-card border-border'
      )} />

      {/* Card */}
      <div className={cn(
        'flex-1 rounded-lg border p-3 transition-all',
        isFirst ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:border-muted-foreground/30'
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{trigger.icon}</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground block truncate">{snapshot.label}</span>
            <span className="text-xs text-muted-foreground">
              {dateStr} at {timeStr}
            </span>
          </div>
          <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium whitespace-nowrap">
            {trigger.label}
          </span>
        </div>

        {snapshot.milestoneLabel && milestoneInput === null && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs">
            <span>🏷️</span>
            <span className="text-primary font-medium">{snapshot.milestoneLabel}</span>
          </div>
        )}

        {milestoneInput !== null && (
          <div className="flex gap-1.5 mt-2">
            <input
              className="flex-1 px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              value={milestoneInput}
              onChange={e => onMilestoneChange(e.target.value)}
              placeholder="Milestone label..."
              onKeyDown={e => e.key === 'Enter' && onSaveMilestone()}
              autoFocus
            />
            <button
              className="px-2 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
              onClick={onSaveMilestone}
            >
              Save
            </button>
            <button
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={onCancelMilestone}
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-1.5 mt-2">
          <button
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-muted transition-colors"
            onClick={onRestore}
          >
            ↩ Restore
          </button>
          <button
            className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            onClick={onStartMilestone}
          >
            🏷️ Label
          </button>
          <button
            className="px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            onClick={onDelete}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──

export const VersionHistory: React.FC<VersionHistoryProps> = ({ documentId, currentContent, onRestore, getCurrentContent }) => {
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
    createManualSnapshot,
  } = useVersion(documentId)

  const [milestoneInput, setMilestoneInput] = useState<{ id: string; value: string } | null>(null)

  const handleRestore = async () => {
    // Use the getter for fresh content, fallback to static prop
    const content = getCurrentContent ? getCurrentContent() : currentContent
    const result = await confirmRestore(content)
    if (result && onRestore) { onRestore(result.content) }
  }

  const handleCreateManualSnapshot = async () => {
    const content = getCurrentContent ? getCurrentContent() : currentContent
    await createManualSnapshot(content)
  }

  const handleAddMilestone = async (snapshotId: string) => {
    if (!milestoneInput || !milestoneInput.value.trim()) {return}
    await addMilestoneLabel(snapshotId, milestoneInput.value.trim())
    setMilestoneInput(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 m-0">
          📜 Version History{' '}
          <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {snapshots.length}
          </span>
        </h3>
        <button
          className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          onClick={handleCreateManualSnapshot}
          disabled={loading || !documentId}
          title="Save a manual snapshot of the current document"
        >
          📌 Snapshot
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20">
          {error}
        </div>
      )}

      {confirmingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h4 className="text-base font-semibold text-foreground mt-0 mb-2">⚠️ Restore Snapshot?</h4>
            <p className="text-sm text-muted-foreground mb-4">
              A safety snapshot of your current document will be created before restoring. This is reversible.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={cancelRestore}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                onClick={handleRestore}
                disabled={loading}
              >
                {loading ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-3xl mb-2">🕐</span>
            <p className="text-sm m-0 text-center max-w-[250px]">No snapshots yet. Snapshots are created automatically at key milestones.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 relative before:absolute before:left-[5px] before:top-0 before:bottom-0 before:w-px before:bg-border">
            {snapshots.map((snap, idx) => (
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
            ))}
          </div>
        )}
      </div>

      {loading && !confirmingRestore && (
        <div className="flex justify-center py-3 border-t border-border">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

export default VersionHistory

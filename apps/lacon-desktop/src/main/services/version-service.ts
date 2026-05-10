/**
 * Version Service — Phase 6
 *
 * Manages document snapshots in .lacon/snapshots/ for version history.
 * Responsible for:
 * - Listing all snapshots (as lightweight summaries)
 * - Retrieving full snapshot content
 * - Safe snapshot restore (creates a safety snapshot before restoring)
 * - Milestone labeling for snapshots
 * - Per-project isolation enforcement
 */

import { randomUUID } from 'crypto'
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

import type { RestoreResult, SnapshotListItem, SnapshotTrigger, VersionSnapshot } from '../../shared/writer-types'
import { getActiveProjectPath, getProjectWorkspaceService } from './project-workspace-service'

/** Resolve project path or throw if no project is open */
function requireProjectPath(): string {
  const p = getActiveProjectPath()
  if (!p) throw new Error('No project is open')
  return p
}

export class VersionService {
  /**
   * List all snapshots for a document as lightweight summaries.
   * Sorted by creation date (newest first).
   */
  listSnapshots(documentId: string): SnapshotListItem[] {
    const snapshotsDir = getProjectWorkspaceService().getSnapshotsPath(documentId, requireProjectPath())

    if (!existsSync(snapshotsDir)) {
      return []
    }

    const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json'))
    const items: SnapshotListItem[] = []

    for (const file of files) {
      try {
        const raw = readFileSync(join(snapshotsDir, file), 'utf-8')
        const snapshot: VersionSnapshot = JSON.parse(raw)

        // Enforce per-project isolation: skip snapshots from other documents
        if (snapshot.documentId && snapshot.documentId !== documentId) {
          continue
        }

        items.push({
          id: snapshot.id,
          documentId: snapshot.documentId,
          label: snapshot.label,
          trigger: snapshot.trigger,
          milestoneLabel: snapshot.milestoneLabel,
          createdAt: snapshot.createdAt,
        })
      } catch {
        // Skip corrupted snapshot files
      }
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return items
  }

  /**
   * Get the full content of a snapshot.
   */
  getSnapshot(documentId: string, snapshotId: string): VersionSnapshot | null {
    const snapshotsDir = getProjectWorkspaceService().getSnapshotsPath(documentId, requireProjectPath())
    const snapshotPath = join(snapshotsDir, `${snapshotId}.json`)

    if (!existsSync(snapshotPath)) {
      return null
    }

    try {
      const raw = readFileSync(snapshotPath, 'utf-8')
      const snapshot: VersionSnapshot = JSON.parse(raw)

      // Per-project isolation check
      if (snapshot.documentId && snapshot.documentId !== documentId) {
        throw new Error('Snapshot does not belong to this document (isolation violation)')
      }

      return snapshot
    } catch (err) {
      if (err instanceof Error && err.message.includes('isolation')) {
        throw err
      }
      return null
    }
  }

  /**
   * Restore a snapshot. Creates a safety snapshot first (reversible).
   */
  restoreSnapshot(documentId: string, snapshotId: string, currentContent: any): RestoreResult {
    // 1. Verify the snapshot exists and belongs to this document
    const snapshot = this.getSnapshot(documentId, snapshotId)
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }

    // 2. Create a safety snapshot of the current state before restoring
    const safetySnapshot = this.createSnapshot(
      documentId,
      'manual',
      currentContent,
      `Safety snapshot before restoring "${snapshot.label}"`,
    )

    // 3. Return the restored content
    return {
      restoredSnapshotId: snapshotId,
      safetySnapshotId: safetySnapshot.id,
      content: snapshot.content,
      restoredAt: new Date().toISOString(),
    }
  }

  /**
   * Add or update a milestone label on a snapshot.
   */
  addMilestoneLabel(documentId: string, snapshotId: string, label: string): VersionSnapshot {
    const snapshotsDir = getProjectWorkspaceService().getSnapshotsPath(documentId, requireProjectPath())
    const snapshotPath = join(snapshotsDir, `${snapshotId}.json`)

    if (!existsSync(snapshotPath)) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }

    const raw = readFileSync(snapshotPath, 'utf-8')
    const snapshot: VersionSnapshot = JSON.parse(raw)

    // Per-project isolation check
    if (snapshot.documentId && snapshot.documentId !== documentId) {
      throw new Error('Snapshot does not belong to this document')
    }

    snapshot.milestoneLabel = label
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8')

    return snapshot
  }

  /**
   * Delete a snapshot.
   */
  deleteSnapshot(documentId: string, snapshotId: string): void {
    const snapshotsDir = getProjectWorkspaceService().getSnapshotsPath(documentId, requireProjectPath())
    const snapshotPath = join(snapshotsDir, `${snapshotId}.json`)

    if (!existsSync(snapshotPath)) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }

    // Per-project isolation check
    try {
      const raw = readFileSync(snapshotPath, 'utf-8')
      const snapshot: VersionSnapshot = JSON.parse(raw)
      if (snapshot.documentId && snapshot.documentId !== documentId) {
        throw new Error('Snapshot does not belong to this document')
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('does not belong')) {
        throw err
      }
    }

    unlinkSync(snapshotPath)
  }

  /**
   * Create a new snapshot.
   */
  createSnapshot(documentId: string, trigger: SnapshotTrigger, content: any, label?: string): VersionSnapshot {
    const snapshotsDir = getProjectWorkspaceService().getSnapshotsPath(documentId, requireProjectPath())

    const snapshot: VersionSnapshot = {
      id: randomUUID(),
      documentId,
      label: label || `${trigger} — ${new Date().toLocaleString()}`,
      content,
      createdAt: new Date().toISOString(),
      trigger,
    }

    const snapshotPath = join(snapshotsDir, `${snapshot.id}.json`)
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8')

    return snapshot
  }
}

// ── Singleton ──
let instance: VersionService | null = null

export function getVersionService(): VersionService {
  if (!instance) {
    instance = new VersionService()
  }
  return instance
}

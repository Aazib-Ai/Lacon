/**
 * Writer Loop — Snapshot Manager
 *
 * Handles creation and persistence of document snapshots
 * at key milestones (outline approval, pre/post generation, etc.).
 */

import { randomUUID } from 'crypto'
import { writeFileSync } from 'fs'
import { join } from 'path'

import type { DocumentSnapshot } from '../../../shared/writer-types'
import { getActiveProjectPath, getProjectWorkspaceService } from '../../services/project-workspace-service'

export class SnapshotManager {
  private documentId: string

  constructor(documentId: string) {
    this.documentId = documentId
  }

  /**
   * Create and persist a document snapshot.
   */
  createSnapshot(trigger: DocumentSnapshot['trigger'], content?: any): DocumentSnapshot {
    const ws = getProjectWorkspaceService()
    const projectPath = getActiveProjectPath()
    if (!projectPath) { throw new Error('No project is open') }
    const snapshotsDir = ws.getSnapshotsPath(this.documentId, projectPath)

    const snapshot: DocumentSnapshot = {
      id: randomUUID(),
      documentId: this.documentId,
      label: `${trigger} — ${new Date().toLocaleString()}`,
      content: content || null,
      createdAt: new Date().toISOString(),
      trigger,
    }

    const snapshotPath = join(snapshotsDir, `${snapshot.id}.json`)
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8')

    return snapshot
  }
}

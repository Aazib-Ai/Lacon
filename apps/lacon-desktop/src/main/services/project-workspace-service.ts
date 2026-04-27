/**
 * Project Workspace Service — Phase 1
 *
 * Manages the .lacon/ folder structure for each document.
 * Responsible for:
 * - Creating workspace directories per document
 * - Reading/writing session.json
 * - Providing paths for skills, snapshots, research
 */

import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import type { ProjectWorkspace, WriterSession } from '../../shared/writer-types'

/**
 * Default session state for a new project.
 */
function createDefaultSession(documentId: string): WriterSession {
  return {
    documentId,
    automationLevel: 'supervised',
    activeSkillIds: [],
    wordTarget: 0,
    stage: 'idle',
    modelConfig: {
      providerId: '',
      modelId: '',
    },
    lastActivityAt: new Date().toISOString(),
  }
}

export class ProjectWorkspaceService {
  private workspacesRoot: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.workspacesRoot = join(userDataPath, 'workspaces')

    if (!existsSync(this.workspacesRoot)) {
      mkdirSync(this.workspacesRoot, { recursive: true })
    }
  }

  /**
   * Ensure the .lacon/ folder structure exists for a document.
   * Creates it if it doesn't exist.
   */
  ensureWorkspace(documentId: string): ProjectWorkspace {
    const rootPath = join(this.workspacesRoot, documentId)
    const laconPath = join(rootPath, '.lacon')

    // Create directory structure
    const dirs = [
      rootPath,
      laconPath,
      join(laconPath, 'skills'),
      join(laconPath, 'snapshots'),
    ]

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }

    // Initialize session.json if missing
    const sessionPath = join(laconPath, 'session.json')
    if (!existsSync(sessionPath)) {
      const defaultSession = createDefaultSession(documentId)
      writeFileSync(sessionPath, JSON.stringify(defaultSession, null, 2), 'utf-8')
    }

    // Initialize research.json if missing
    const researchPath = join(laconPath, 'research.json')
    if (!existsSync(researchPath)) {
      writeFileSync(
        researchPath,
        JSON.stringify({ entries: [], summary: '' }, null, 2),
        'utf-8',
      )
    }

    // Initialize research.md if missing
    const researchMdPath = join(laconPath, 'research.md')
    if (!existsSync(researchMdPath)) {
      writeFileSync(researchMdPath, '# Research Log\n\nNo research entries yet.\n', 'utf-8')
    }

    return {
      rootPath,
      laconPath,
      documentId,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Get the workspace for a document (creates if missing).
   */
  getWorkspace(documentId: string): ProjectWorkspace {
    return this.ensureWorkspace(documentId)
  }

  /**
   * Check if a workspace exists for a document.
   */
  hasWorkspace(documentId: string): boolean {
    const rootPath = join(this.workspacesRoot, documentId)
    return existsSync(join(rootPath, '.lacon'))
  }

  /**
   * Read the session state for a document.
   */
  getSession(documentId: string): WriterSession {
    const workspace = this.ensureWorkspace(documentId)
    const sessionPath = join(workspace.laconPath, 'session.json')

    try {
      const json = readFileSync(sessionPath, 'utf-8')
      return JSON.parse(json)
    } catch {
      const defaultSession = createDefaultSession(documentId)
      writeFileSync(sessionPath, JSON.stringify(defaultSession, null, 2), 'utf-8')
      return defaultSession
    }
  }

  /**
   * Update the session state for a document.
   */
  updateSession(documentId: string, updates: Partial<WriterSession>): WriterSession {
    const current = this.getSession(documentId)
    const updated: WriterSession = {
      ...current,
      ...updates,
      lastActivityAt: new Date().toISOString(),
    }

    const workspace = this.ensureWorkspace(documentId)
    const sessionPath = join(workspace.laconPath, 'session.json')
    writeFileSync(sessionPath, JSON.stringify(updated, null, 2), 'utf-8')

    return updated
  }

  /**
   * Get the path to the user/agent skills directory for a document.
   */
  getSkillsPath(documentId: string): string {
    const workspace = this.ensureWorkspace(documentId)
    return join(workspace.laconPath, 'skills')
  }

  /**
   * Get the path to the snapshots directory for a document.
   */
  getSnapshotsPath(documentId: string): string {
    const workspace = this.ensureWorkspace(documentId)
    return join(workspace.laconPath, 'snapshots')
  }

  /**
   * Get the path to the research log for a document.
   */
  getResearchPath(documentId: string): { json: string; md: string } {
    const workspace = this.ensureWorkspace(documentId)
    return {
      json: join(workspace.laconPath, 'research.json'),
      md: join(workspace.laconPath, 'research.md'),
    }
  }
}

// ── Singleton ──
let instance: ProjectWorkspaceService | null = null

export function getProjectWorkspaceService(): ProjectWorkspaceService {
  if (!instance) {
    instance = new ProjectWorkspaceService()
  }
  return instance
}

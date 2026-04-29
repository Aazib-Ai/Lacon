/**
 * Project Workspace Service — Portable Folder System
 *
 * Manages the .lacon/ folder structure INSIDE the user's project folder.
 * All AI context (sessions, outlines, research, reviews, snapshots, skills)
 * lives alongside the user's documents so the whole folder is portable.
 *
 * Folder layout:
 *   <project>/
 *   ├── chapter-1.lacon
 *   └── .lacon/
 *       ├── config.json
 *       ├── skills/
 *       └── documents/
 *           └── chapter-1/
 *               ├── session.json
 *               ├── outline.json
 *               ├── research.json
 *               ├── reviews/
 *               └── snapshots/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'

import type { ProjectWorkspace, WriterSession } from '../../shared/writer-types'

/**
 * Extract a clean folder name from a document filename.
 * "chapter-1.lacon" → "chapter-1"
 * "My Story.md" → "My Story"
 */
function docNameFromFile(documentId: string): string {
  // If it looks like a path, use just the basename
  const base = basename(documentId)
  return base.replace(/\.[^.]+$/, '')  // strip extension
}

/**
 * Default session state for a new document.
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
  /**
   * Ensure the per-document workspace exists inside .lacon/documents/<docName>/.
   * Requires the project folder path as context.
   */
  ensureWorkspace(documentId: string, projectPath: string): ProjectWorkspace {
    const docName = docNameFromFile(documentId)
    const laconPath = join(projectPath, '.lacon', 'documents', docName)

    // Create directory structure
    const dirs = [
      laconPath,
      join(laconPath, 'reviews'),
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

    return {
      rootPath: projectPath,
      laconPath,
      documentId,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Get the workspace for a document (creates if missing).
   */
  getWorkspace(documentId: string, projectPath: string): ProjectWorkspace {
    return this.ensureWorkspace(documentId, projectPath)
  }

  /**
   * Check if a workspace exists for a document.
   */
  hasWorkspace(documentId: string, projectPath: string): boolean {
    const docName = docNameFromFile(documentId)
    const laconPath = join(projectPath, '.lacon', 'documents', docName)
    return existsSync(laconPath)
  }

  /**
   * Read the session state for a document.
   */
  getSession(documentId: string, projectPath: string): WriterSession {
    const workspace = this.ensureWorkspace(documentId, projectPath)
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
  updateSession(documentId: string, projectPath: string, updates: Partial<WriterSession>): WriterSession {
    const current = this.getSession(documentId, projectPath)
    const updated: WriterSession = {
      ...current,
      ...updates,
      lastActivityAt: new Date().toISOString(),
    }

    const workspace = this.ensureWorkspace(documentId, projectPath)
    const sessionPath = join(workspace.laconPath, 'session.json')
    writeFileSync(sessionPath, JSON.stringify(updated, null, 2), 'utf-8')

    return updated
  }

  /**
   * Get the path to the project-level skills directory.
   * Skills are shared across all documents in the project.
   */
  getSkillsPath(projectPath: string): string {
    const skillsDir = join(projectPath, '.lacon', 'skills')
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true })
    }
    return skillsDir
  }

  /**
   * Get the path to the snapshots directory for a document.
   */
  getSnapshotsPath(documentId: string, projectPath: string): string {
    const workspace = this.ensureWorkspace(documentId, projectPath)
    return join(workspace.laconPath, 'snapshots')
  }

  /**
   * Get the path to the research log for a document.
   */
  getResearchPath(documentId: string, projectPath: string): { json: string; md: string } {
    const workspace = this.ensureWorkspace(documentId, projectPath)
    return {
      json: join(workspace.laconPath, 'research.json'),
      md: join(workspace.laconPath, 'research.md'),
    }
  }

  /**
   * Get the path to the reviews directory for a document.
   */
  getReviewsPath(documentId: string, projectPath: string): string {
    const workspace = this.ensureWorkspace(documentId, projectPath)
    return join(workspace.laconPath, 'reviews')
  }

  /**
   * Get the path to the outline file for a document.
   */
  getOutlinePath(documentId: string, projectPath: string): string {
    const workspace = this.ensureWorkspace(documentId, projectPath)
    return join(workspace.laconPath, 'outline.json')
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

/**
 * Read the active project path from the persisted settings.
 * This allows services that don't have the project path in scope
 * to resolve it automatically.
 */
export function getActiveProjectPath(): string | null {
  try {
    const { app } = require('electron')
    const { readFileSync } = require('fs')
    const { join } = require('path')
    const settingsPath = join(app.getPath('userData'), 'lacon-project-settings.json')
    const data = readFileSync(settingsPath, 'utf-8')
    const settings = JSON.parse(data)
    return settings.activeProjectPath || null
  } catch {
    return null
  }
}

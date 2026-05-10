/**
 * Writer Loop — State Machine
 *
 * Owns the transition map and validates stage changes.
 * Delegates persistence to ProjectWorkspaceService.
 */

import type { WriterLoopStage, WriterSession } from '../../../shared/writer-types'
import { getActiveProjectPath, getProjectWorkspaceService } from '../../services/project-workspace-service'
import type { WriterLoopEventEmitter } from './event-emitter'

// ─────────────────────────── Transition Map ───────────────────────────

/**
 * Valid transitions: current stage → set of allowed next stages.
 * Any transition not in this map is rejected.
 */
const VALID_TRANSITIONS: Record<WriterLoopStage, WriterLoopStage[]> = {
  idle: ['planning'],
  planning: ['awaiting-outline-approval', 'generating', 'idle'],
  'awaiting-outline-approval': ['generating', 'planning', 'idle'],
  generating: ['reviewing', 'complete', 'paused', 'idle'],
  reviewing: ['awaiting-user', 'generating', 'complete', 'paused'],
  'awaiting-user': ['generating', 'reviewing', 'complete', 'paused', 'idle'],
  complete: ['idle'],
  paused: ['idle', 'planning', 'generating', 'reviewing'],
}

// ─────────────────────────── State Machine ───────────────────────────

export class WriterStateMachine {
  private documentId: string
  private emitter: WriterLoopEventEmitter

  constructor(documentId: string, emitter: WriterLoopEventEmitter) {
    this.documentId = documentId
    this.emitter = emitter
  }

  /**
   * Get the current session from persisted storage.
   */
  getSession(): WriterSession {
    const ws = getProjectWorkspaceService()
    const projectPath = getActiveProjectPath()
    if (!projectPath) { throw new Error('No project is open') }
    return ws.getSession(this.documentId, projectPath)
  }

  /**
   * Get the current stage.
   */
  getStage(): WriterLoopStage {
    return this.getSession().stage
  }

  /**
   * Transition to a new stage. Throws if the transition is invalid.
   */
  transition(nextStage: WriterLoopStage): WriterSession {
    const session = this.getSession()
    const current = session.stage

    if (!VALID_TRANSITIONS[current]?.includes(nextStage)) {
      const msg = `Invalid transition: ${current} → ${nextStage}`
      this.emitter.emit('error', { message: msg })
      throw new Error(msg)
    }

    const ws = getProjectWorkspaceService()
    const projectPath = getActiveProjectPath()
    if (!projectPath) { throw new Error('No project is open') }
    const updated = ws.updateSession(this.documentId, projectPath, { stage: nextStage })

    this.emitter.emit('stage-changed', { from: current, to: nextStage })
    this.emitter.emit('session-updated', updated)

    return updated
  }
}

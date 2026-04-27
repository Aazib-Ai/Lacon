/**
 * Writer Loop State Machine — Phase 2
 *
 * Manages the lifecycle of a writing session through these stages:
 *   idle → planning → awaiting-outline-approval → generating → reviewing → awaiting-user → complete/paused
 *
 * Responsibilities:
 * - Enforce valid stage transitions
 * - Persist stage changes to session.json via ProjectWorkspaceService
 * - Auto-snapshot on outline approval (before-generation trigger)
 * - Generate outlines via the Planner module
 * - Emit events for IPC forwarding to the renderer
 */

import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import type {
  AutomationLevel,
  DocumentSnapshot,
  OutlineSection,
  OutlineSubsection,
  ResearchContext,
  WriterLoopStage,
  WriterOutline,
  WriterSession,
} from '../../shared/writer-types'
import { getProjectWorkspaceService } from '../services/project-workspace-service'

// ─────────────────────────── Transition Map ───────────────────────────

/**
 * Valid transitions: current stage → set of allowed next stages.
 * Any transition not in this map is rejected.
 */
const VALID_TRANSITIONS: Record<WriterLoopStage, WriterLoopStage[]> = {
  idle: ['planning'],
  planning: ['awaiting-outline-approval', 'idle'],
  'awaiting-outline-approval': ['generating', 'planning', 'idle'],
  generating: ['reviewing', 'paused', 'idle'],
  reviewing: ['awaiting-user', 'generating', 'complete', 'paused'],
  'awaiting-user': ['generating', 'reviewing', 'complete', 'paused', 'idle'],
  complete: ['idle'],
  paused: ['idle', 'planning', 'generating', 'reviewing'],
}

// ─────────────────────────── Event Emitter ───────────────────────────

export type WriterLoopEventType =
  | 'stage-changed'
  | 'outline-generated'
  | 'outline-approved'
  | 'snapshot-created'
  | 'session-updated'
  | 'error'

export interface WriterLoopEvent {
  type: WriterLoopEventType
  documentId: string
  payload: any
}

export type WriterLoopListener = (event: WriterLoopEvent) => void

// ─────────────────────────── Planner Module ───────────────────────────

/**
 * Generate a structured outline from a user instruction + composed skill prompt + research context.
 *
 * In Phase 2 this is a deterministic template generator.
 * Phase 3+ will delegate to an LLM via the provider layer.
 */
export function generateOutline(
  instruction: string,
  composedSkillPrompt: string,
  researchContext?: ResearchContext,
): WriterOutline {
  // Parse a loose instruction into sections.
  // The instruction itself becomes the title; we derive sections from keywords or fall back to a sensible default.

  const title = instruction.length > 120 ? `${instruction.slice(0, 117)  }...` : instruction

  // Simple heuristic: split on numbered lines, bullet points, or semi-colons
  const sectionHints = instruction
    .split(/(?:\r?\n|;|(?:\d+\.\s))/)
    .map(s => s.trim())
    .filter(s => s.length > 3)

  let sections: OutlineSection[]

  if (sectionHints.length >= 2) {
    sections = sectionHints.map((hint, _idx) => ({
      id: randomUUID(),
      title: hint,
      keyPoints: [`Develop the "${hint}" section`],
      subsections: [],
      estimatedWords: 300,
    }))
  } else {
    // Fallback: generate a standard 5-section outline
    const defaultSections = ['Introduction', 'Background', 'Main Argument', 'Analysis', 'Conclusion']
    sections = defaultSections.map(name => ({
      id: randomUUID(),
      title: name,
      keyPoints: [`Write the ${name.toLowerCase()} section based on the instruction`],
      subsections: [],
      estimatedWords: name === 'Introduction' || name === 'Conclusion' ? 200 : 400,
    }))
  }

  // Inject research context hints into key points if available
  if (researchContext && researchContext.entries.length > 0) {
    const summaryHint = researchContext.summary
      ? `Incorporate research: ${researchContext.summary.slice(0, 200)}`
      : 'Incorporate available research findings'

    if (sections.length > 1) {
      sections[1].keyPoints.push(summaryHint)
    }
  }

  const totalEstimatedWords = sections.reduce((sum, s) => sum + s.estimatedWords, 0)

  return {
    title,
    sections,
    totalEstimatedWords,
    createdAt: new Date().toISOString(),
  }
}

// ─────────────────────────── Writer Loop Class ───────────────────────────

export class WriterLoop {
  private documentId: string
  private listeners: WriterLoopListener[] = []
  private currentOutline: WriterOutline | null = null

  constructor(documentId: string) {
    this.documentId = documentId
  }

  // ── Event system ──

  on(listener: WriterLoopListener): void {
    this.listeners.push(listener)
  }

  off(listener: WriterLoopListener): void {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  private emit(type: WriterLoopEventType, payload: any): void {
    const event: WriterLoopEvent = { type, documentId: this.documentId, payload }
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[WriterLoop] Listener error:', err)
      }
    }
  }

  // ── Stage Queries ──

  getStage(): WriterLoopStage {
    return this.getSession().stage
  }

  getSession(): WriterSession {
    const ws = getProjectWorkspaceService()
    return ws.getSession(this.documentId)
  }

  getOutline(): WriterOutline | null {
    if (this.currentOutline) {return this.currentOutline}

    // Try loading from persisted session
    const ws = getProjectWorkspaceService()
    const workspace = ws.ensureWorkspace(this.documentId)
    const outlinePath = join(workspace.laconPath, 'outline.json')
    if (existsSync(outlinePath)) {
      try {
        this.currentOutline = JSON.parse(readFileSync(outlinePath, 'utf-8'))
        return this.currentOutline
      } catch {
        return null
      }
    }
    return null
  }

  // ── Stage Transitions ──

  /**
   * Transition to a new stage.  Throws if the transition is invalid.
   */
  transition(nextStage: WriterLoopStage): WriterSession {
    const session = this.getSession()
    const current = session.stage

    if (!VALID_TRANSITIONS[current]?.includes(nextStage)) {
      const msg = `Invalid transition: ${current} → ${nextStage}`
      this.emit('error', { message: msg })
      throw new Error(msg)
    }

    const ws = getProjectWorkspaceService()
    const updated = ws.updateSession(this.documentId, { stage: nextStage })

    this.emit('stage-changed', { from: current, to: nextStage })
    this.emit('session-updated', updated)

    return updated
  }

  // ── Planning ──

  /**
   * Start the planning stage: generate an outline from the instruction.
   */
  startPlanning(instruction: string, composedSkillPrompt: string, researchContext?: ResearchContext): WriterOutline {
    // Transition to planning
    this.transition('planning')

    // Generate outline
    const outline = generateOutline(instruction, composedSkillPrompt, researchContext)
    this.currentOutline = outline

    // Persist outline
    this.persistOutline(outline)

    // Transition to awaiting approval
    this.transition('awaiting-outline-approval')

    this.emit('outline-generated', outline)
    return outline
  }

  // ── Outline Editing ──

  /**
   * Update the outline (user edits sections/subsections/key-points).
   * Only allowed while in 'awaiting-outline-approval'.
   */
  updateOutline(outline: WriterOutline): WriterOutline {
    const stage = this.getStage()
    if (stage !== 'awaiting-outline-approval') {
      throw new Error(`Cannot update outline in stage: ${stage}`)
    }

    // Recalculate totals
    outline.totalEstimatedWords = outline.sections.reduce((sum, s) => sum + s.estimatedWords, 0)

    this.currentOutline = outline
    this.persistOutline(outline)

    this.emit('outline-generated', outline) // re-emit so UI refreshes
    return outline
  }

  /**
   * Add a section to the outline.
   */
  addSection(section: OutlineSection): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {throw new Error('No outline to modify')}

    outline.sections.push(section)
    return this.updateOutline(outline)
  }

  /**
   * Remove a section by ID.
   */
  removeSection(sectionId: string): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {throw new Error('No outline to modify')}

    outline.sections = outline.sections.filter(s => s.id !== sectionId)
    return this.updateOutline(outline)
  }

  /**
   * Update a single section.
   */
  updateSection(sectionId: string, updates: Partial<OutlineSection>): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {throw new Error('No outline to modify')}

    const idx = outline.sections.findIndex(s => s.id === sectionId)
    if (idx === -1) {throw new Error(`Section not found: ${sectionId}`)}

    outline.sections[idx] = { ...outline.sections[idx], ...updates }
    return this.updateOutline(outline)
  }

  /**
   * Add a subsection to a section.
   */
  addSubsection(sectionId: string, subsection: OutlineSubsection): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {throw new Error('No outline to modify')}

    const section = outline.sections.find(s => s.id === sectionId)
    if (!section) {throw new Error(`Section not found: ${sectionId}`)}

    section.subsections.push(subsection)
    return this.updateOutline(outline)
  }

  /**
   * Remove a subsection.
   */
  removeSubsection(sectionId: string, subsectionId: string): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {throw new Error('No outline to modify')}

    const section = outline.sections.find(s => s.id === sectionId)
    if (!section) {throw new Error(`Section not found: ${sectionId}`)}

    section.subsections = section.subsections.filter(ss => ss.id !== subsectionId)
    return this.updateOutline(outline)
  }

  // ── Approval ──

  /**
   * Approve the outline and auto-snapshot before transitioning to generation.
   */
  approveOutline(documentContent?: any): WriterSession {
    const stage = this.getStage()
    if (stage !== 'awaiting-outline-approval') {
      throw new Error(`Cannot approve outline in stage: ${stage}`)
    }

    const outline = this.getOutline()
    if (!outline) {
      throw new Error('No outline to approve')
    }

    // Auto-snapshot before generation
    const snapshot = this.createSnapshot('outline-approved', documentContent)
    this.emit('snapshot-created', snapshot)
    this.emit('outline-approved', outline)

    // Transition to generating
    return this.transition('generating')
  }

  // ── Session Management ──

  /**
   * Update session properties (word target, automation level).
   */
  updateSessionConfig(updates: {
    wordTarget?: number
    automationLevel?: AutomationLevel
    activeSkillIds?: string[]
    modelConfig?: { providerId: string; modelId: string }
  }): WriterSession {
    const ws = getProjectWorkspaceService()
    const updated = ws.updateSession(this.documentId, updates)
    this.emit('session-updated', updated)
    return updated
  }

  /**
   * Pause the loop.
   */
  pause(): WriterSession {
    return this.transition('paused')
  }

  /**
   * Reset the loop to idle.
   */
  reset(): WriterSession {
    const stage = this.getStage()
    // Allow reset from any terminal-ish state
    if (stage === 'idle') {return this.getSession()}

    this.currentOutline = null
    return this.transition('idle')
  }

  // ── Snapshots ──

  private createSnapshot(trigger: DocumentSnapshot['trigger'], content?: any): DocumentSnapshot {
    const ws = getProjectWorkspaceService()
    const snapshotsDir = ws.getSnapshotsPath(this.documentId)

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

  // ── Persistence helpers ──

  private persistOutline(outline: WriterOutline): void {
    const ws = getProjectWorkspaceService()
    const workspace = ws.ensureWorkspace(this.documentId)
    const outlinePath = join(workspace.laconPath, 'outline.json')
    writeFileSync(outlinePath, JSON.stringify(outline, null, 2), 'utf-8')
  }
}

// ─────────────────────────── Loop Registry ───────────────────────────

/**
 * Keep one WriterLoop instance per documentId so state isn't lost across IPC calls.
 */
const loops = new Map<string, WriterLoop>()

export function getWriterLoop(documentId: string): WriterLoop {
  let loop = loops.get(documentId)
  if (!loop) {
    loop = new WriterLoop(documentId)
    loops.set(documentId, loop)
  }
  return loop
}

export function disposeWriterLoop(documentId: string): void {
  loops.delete(documentId)
}

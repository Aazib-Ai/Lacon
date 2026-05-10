/**
 * Writer Loop — Thin Orchestrator
 *
 * Coordinates all sub-modules (state machine, outline manager, generator,
 * snapshot manager) and exposes the public API consumed by IPC handlers.
 *
 * This is intentionally thin — all business logic lives in the sub-modules.
 */

import type {
  AutomationLevel,
  GenerationResult,
  OutlineSection,
  OutlineSubsection,
  ResearchContext,
  SectionProgress,
  WriterLoopStage,
  WriterOutline,
  WriterSession,
} from '../../../shared/writer-types'
import { getActiveProjectPath, getProjectWorkspaceService } from '../../services/project-workspace-service'
import { runAgenticPreflight, type PreflightResult, type PreflightStep } from '../agentic-preflight'
import { WriterLoopEventEmitter, type WriterLoopListener } from './event-emitter'
import { SectionGenerator } from './generator'
import { OutlineManager } from './outline-manager'
import { SnapshotManager } from './snapshot-manager'
import { WriterStateMachine } from './writer-state-machine'

export class WriterLoop {
  private documentId: string
  private emitter: WriterLoopEventEmitter
  private stateMachine: WriterStateMachine
  private outlineManager: OutlineManager
  private generator: SectionGenerator
  private snapshotManager: SnapshotManager
  private lastPreflightResult: PreflightResult | null = null

  constructor(documentId: string) {
    this.documentId = documentId
    this.emitter = new WriterLoopEventEmitter(documentId)
    this.stateMachine = new WriterStateMachine(documentId, this.emitter)
    this.outlineManager = new OutlineManager(documentId, this.emitter, this.stateMachine)
    this.snapshotManager = new SnapshotManager(documentId)
    this.generator = new SectionGenerator(
      documentId,
      this.emitter,
      this.stateMachine,
      this.outlineManager,
      this.snapshotManager,
    )
  }

  // ── Event System (delegated) ──

  on(listener: WriterLoopListener): void { this.emitter.on(listener) }
  off(listener: WriterLoopListener): void { this.emitter.off(listener) }

  // ── Stage Queries (delegated) ──

  getStage(): WriterLoopStage { return this.stateMachine.getStage() }
  getSession(): WriterSession { return this.stateMachine.getSession() }
  transition(nextStage: WriterLoopStage): WriterSession { return this.stateMachine.transition(nextStage) }

  // ── Outline (delegated) ──

  getOutline(): WriterOutline | null { return this.outlineManager.getOutline() }
  updateOutline(outline: WriterOutline): WriterOutline { return this.outlineManager.updateOutline(outline) }
  addSection(section: OutlineSection): WriterOutline { return this.outlineManager.addSection(section) }
  removeSection(sectionId: string): WriterOutline { return this.outlineManager.removeSection(sectionId) }
  updateSection(sectionId: string, updates: Partial<OutlineSection>): WriterOutline { return this.outlineManager.updateSection(sectionId, updates) }
  addSubsection(sectionId: string, subsection: OutlineSubsection): WriterOutline { return this.outlineManager.addSubsection(sectionId, subsection) }
  removeSubsection(sectionId: string, subsectionId: string): WriterOutline { return this.outlineManager.removeSubsection(sectionId, subsectionId) }

  // ── Generation (delegated) ──

  async generateSection(sectionId: string): Promise<GenerationResult> { return this.generator.generateSection(sectionId) }
  async generateAll(): Promise<SectionProgress> { return this.generator.generateAll() }
  abortGeneration(): SectionProgress { return this.generator.abortGeneration() }
  getProgress(): SectionProgress { return this.generator.getProgress() }
  acceptGeneration(sectionId: string): GenerationResult | null { return this.generator.acceptGeneration(sectionId) }
  rejectGeneration(sectionId: string): void { this.generator.rejectGeneration(sectionId) }

  // ── Snapshots (delegated) ──

  createSnapshot(trigger: any, content?: any) { return this.snapshotManager.createSnapshot(trigger, content) }

  // ── Preflight ──

  getPreflightResult(): PreflightResult | null { return this.lastPreflightResult }

  // ── Planning ──

  async startPlanning(
    instruction: string,
    composedSkillPrompt: string,
    researchContext?: ResearchContext,
  ): Promise<WriterOutline> {
    // If session is stuck in 'planning' from a previous failed attempt,
    // reset to 'idle' first so the transition is valid.
    const currentStage = this.stateMachine.getStage()
    if (currentStage === 'planning') {
      this.stateMachine.transition('idle')
    }
    this.stateMachine.transition('planning')

    let finalInstruction = instruction
    let finalSkillPrompt = composedSkillPrompt
    let finalResearch = researchContext

    try {
      const preflight = await runAgenticPreflight({
        documentId: this.documentId,
        instruction,
        composedSkillPrompt,
        existingResearch: researchContext,
        onProgress: (step: PreflightStep) => {
          this.emitter.emit('preflight-step', step)
        },
      })

      this.lastPreflightResult = preflight

      if (preflight.didRun) {
        finalInstruction = preflight.enrichedInstruction
        finalSkillPrompt = preflight.composedSkillPrompt || composedSkillPrompt
        finalResearch = preflight.researchContext || researchContext

        if (preflight.autoSelectedSkillIds.length > 0) {
          const ws = getProjectWorkspaceService()
          const projectPath = getActiveProjectPath()
          if (projectPath) {
            const session = this.stateMachine.getSession()
            const mergedSkills = [...new Set([
              ...(session.activeSkillIds || []),
              ...preflight.autoSelectedSkillIds,
            ])]
            ws.updateSession(this.documentId, projectPath, { activeSkillIds: mergedSkills })
          }
        }

        console.log(
          `[WriterLoop] Pre-flight complete: ${preflight.steps.length} steps, ` +
          `skills=${preflight.autoSelectedSkillIds.length}, ` +
          `research=${finalResearch?.entries.length || 0} entries`,
        )
      }

      this.emitter.emit('preflight-complete', preflight)
    } catch (err: any) {
      console.warn('[WriterLoop] Pre-flight failed, proceeding with direct planning:', err.message)
      this.emitter.emit('error', {
        message: `Pre-flight warning: ${err.message}. Proceeding with direct outline generation.`,
        fatal: false,
      })
    }

    try {
      const outline = await this.outlineManager.generateOutline(finalInstruction, finalSkillPrompt, finalResearch)
      this.outlineManager.setOutline(outline)
      this.outlineManager.persistOutline(outline)

      const session = this.stateMachine.getSession()
      if (session.automationLevel === 'auto') {
        this.stateMachine.transition('generating')
        this.emitter.emit('outline-generated', outline)
        this.generateAll().catch(err => {
          console.error('[WriterLoop] Auto-generation failed:', err)
          this.emitter.emit('error', {
            message: `Generation failed: ${err?.message || 'Unknown error'}`,
            fatal: true,
          })
        })
        return outline
      }

      this.stateMachine.transition('awaiting-outline-approval')
      this.emitter.emit('outline-generated', outline)
      return outline
    } catch (err: any) {
      // Reset to idle so the session doesn't stay stuck in 'planning'
      console.error('[WriterLoop] Outline generation failed, resetting to idle:', err.message)
      try { this.stateMachine.transition('idle') } catch { /* already idle */ }
      throw err
    }
  }

  // ── Approval ──

  approveOutline(documentContent?: any): WriterSession {
    const stage = this.stateMachine.getStage()
    if (stage !== 'awaiting-outline-approval') {
      throw new Error(`Cannot approve outline in stage: ${stage}`)
    }
    const outline = this.outlineManager.getOutline()
    if (!outline) { throw new Error('No outline to approve') }

    const snapshot = this.snapshotManager.createSnapshot('outline-approved', documentContent)
    this.emitter.emit('snapshot-created', snapshot)
    this.emitter.emit('outline-approved', outline)

    const session = this.stateMachine.transition('generating')

    if (session.automationLevel === 'auto') {
      this.generateAll().catch(err => {
        console.error('[WriterLoop] Auto-generation failed:', err)
        this.emitter.emit('error', {
          message: `Generation failed: ${err?.message || 'Unknown error'}`,
          fatal: true,
        })
      })
    }

    return session
  }

  // ── Session Management ──

  updateSessionConfig(updates: {
    wordTarget?: number
    automationLevel?: AutomationLevel
    activeSkillIds?: string[]
    modelConfig?: { providerId: string; modelId: string }
  }): WriterSession {
    const ws = getProjectWorkspaceService()
    const projectPath = getActiveProjectPath()
    if (!projectPath) { throw new Error('No project is open') }
    const updated = ws.updateSession(this.documentId, projectPath, updates)
    this.emitter.emit('session-updated', updated)
    return updated
  }

  pause(): WriterSession {
    return this.stateMachine.transition('paused')
  }

  reset(): WriterSession {
    const stage = this.stateMachine.getStage()

    // Clear all sub-module state
    this.outlineManager.setOutline(null)
    this.outlineManager.deletePersistedOutline()
    this.generator.resetState()
    this.lastPreflightResult = null

    if (stage === 'idle') {
      return this.stateMachine.getSession()
    }
    return this.stateMachine.transition('idle')
  }
}

/**
 * Writer Loop — Outline Manager
 *
 * Handles all outline CRUD operations, LLM-powered outline generation,
 * and outline persistence to disk.
 */

import { randomUUID } from 'crypto'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

import type {
  OutlineSection,
  OutlineSubsection,
  ResearchContext,
  WriterOutline,
} from '../../../shared/writer-types'
import { getProviderManager } from '../../providers/provider-manager'
import { getActiveProjectPath, getProjectWorkspaceService } from '../../services/project-workspace-service'
import type { WriterLoopEventEmitter } from './event-emitter'
import {
  buildOutlineSystemPrompt,
  buildOutlineUserMessage,
  extractWordCountFromPrompt,
} from './prompts'
import { resolveProviderAndModel } from './resolve-model'
import type { WriterStateMachine } from './writer-state-machine'

export class OutlineManager {
  private documentId: string
  private emitter: WriterLoopEventEmitter
  private stateMachine: WriterStateMachine
  private currentOutline: WriterOutline | null = null

  constructor(
    documentId: string,
    emitter: WriterLoopEventEmitter,
    stateMachine: WriterStateMachine,
  ) {
    this.documentId = documentId
    this.emitter = emitter
    this.stateMachine = stateMachine
  }

  getOutline(): WriterOutline | null {
    if (this.currentOutline) {
      return this.currentOutline
    }
    const ws = getProjectWorkspaceService()
    const workspace = ws.ensureWorkspace(this.documentId, getActiveProjectPath()!)
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

  setOutline(outline: WriterOutline | null): void {
    this.currentOutline = outline
  }

  async generateOutline(
    instruction: string,
    composedSkillPrompt: string,
    researchContext?: ResearchContext,
  ): Promise<WriterOutline> {
    try {
      const pm = getProviderManager()
      const resolved = resolveProviderAndModel(this.stateMachine)
      if (resolved) {
        const { providerId, modelId } = resolved
        console.log(`[Planner] Generating outline via LLM (provider: ${providerId}, model: ${modelId})`)
        const response = await pm.chatCompletion(
          providerId,
          {
            model: modelId,
            messages: [
              { role: 'system', content: buildOutlineSystemPrompt(composedSkillPrompt, extractWordCountFromPrompt(instruction)) },
              { role: 'user', content: buildOutlineUserMessage(instruction, researchContext) },
            ],
            temperature: 0.7,
            maxTokens: 4000,
          },
          'outline-generation',
        )
        const content = response.choices?.[0]?.message?.content
        if (content) {
          const outline = parseOutlineResponse(content)
          if (outline) {
            console.log(`[Planner] LLM outline generated: ${outline.sections.length} sections, ~${outline.totalEstimatedWords} words`)
            return outline
          }
          console.warn('[Planner] LLM returned unparseable outline, falling back to deterministic')
        }
      } else {
        console.log('[Planner] No enabled provider found, using deterministic outline')
      }
    } catch (err) {
      console.warn('[Planner] LLM outline generation failed, falling back to deterministic:', err)
    }
    return generateOutlineFallback(instruction, researchContext)
  }

  updateOutline(outline: WriterOutline): WriterOutline {
    const stage = this.stateMachine.getStage()
    if (stage !== 'awaiting-outline-approval') {
      throw new Error(`Cannot update outline in stage: ${stage}`)
    }
    outline.totalEstimatedWords = outline.sections.reduce((sum, s) => sum + s.estimatedWords, 0)
    this.currentOutline = outline
    this.persistOutline(outline)
    this.emitter.emit('outline-generated', outline)
    return outline
  }

  addSection(section: OutlineSection): WriterOutline {
    const outline = this.getOutline()
    if (!outline) { throw new Error('No outline to modify') }
    outline.sections.push(section)
    return this.updateOutline(outline)
  }

  removeSection(sectionId: string): WriterOutline {
    const outline = this.getOutline()
    if (!outline) { throw new Error('No outline to modify') }
    outline.sections = outline.sections.filter(s => s.id !== sectionId)
    return this.updateOutline(outline)
  }

  updateSection(sectionId: string, updates: Partial<OutlineSection>): WriterOutline {
    const outline = this.getOutline()
    if (!outline) { throw new Error('No outline to modify') }
    const idx = outline.sections.findIndex(s => s.id === sectionId)
    if (idx === -1) { throw new Error(`Section not found: ${sectionId}`) }
    outline.sections[idx] = { ...outline.sections[idx], ...updates }
    return this.updateOutline(outline)
  }

  addSubsection(sectionId: string, subsection: OutlineSubsection): WriterOutline {
    const outline = this.getOutline()
    if (!outline) { throw new Error('No outline to modify') }
    const section = outline.sections.find(s => s.id === sectionId)
    if (!section) { throw new Error(`Section not found: ${sectionId}`) }
    section.subsections.push(subsection)
    return this.updateOutline(outline)
  }

  removeSubsection(sectionId: string, subsectionId: string): WriterOutline {
    const outline = this.getOutline()
    if (!outline) { throw new Error('No outline to modify') }
    const section = outline.sections.find(s => s.id === sectionId)
    if (!section) { throw new Error(`Section not found: ${sectionId}`) }
    section.subsections = section.subsections.filter(ss => ss.id !== subsectionId)
    return this.updateOutline(outline)
  }

  persistOutline(outline: WriterOutline): void {
    const ws = getProjectWorkspaceService()
    const workspace = ws.ensureWorkspace(this.documentId, getActiveProjectPath()!)
    const outlinePath = join(workspace.laconPath, 'outline.json')
    writeFileSync(outlinePath, JSON.stringify(outline, null, 2), 'utf-8')
  }

  deletePersistedOutline(): void {
    try {
      const ws = getProjectWorkspaceService()
      const projectPath = getActiveProjectPath()
      if (projectPath) {
        const workspace = ws.ensureWorkspace(this.documentId, projectPath)
        const outlinePath = join(workspace.laconPath, 'outline.json')
        if (existsSync(outlinePath)) {
          unlinkSync(outlinePath)
          console.log('[WriterLoop] Deleted persisted outline.json on reset')
        }
      }
    } catch (err) {
      console.warn('[WriterLoop] Failed to delete outline.json:', err)
    }
  }
}

// ─────────────────────────── Helpers ───────────────────────────

function parseOutlineResponse(raw: string): WriterOutline | null {
  try {
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim()
    }

    // Strip any tool_call blocks that may appear before/around the JSON
    cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '').trim()
    cleaned = cleaned.replace(/<\/?tool_call>/gi, '').trim()

    // Remove AI preambles before the JSON (e.g., "AI analysis: Let me check...")
    cleaned = cleaned.replace(/^[\s\S]*?(?=\{)/m, '').trim()

    const parsed = JSON.parse(cleaned)
    if (!parsed.title || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return null
    }

    // Filter out sections with tool-call or invalid titles
    const validSections = parsed.sections.filter((s: any) => {
      const title = String(s.title || '')
      // Reject titles that look like tool calls, XML tags, or function names
      if (/<\/?tool_call>/i.test(title)) return false
      if (/^<[a-z_]+>/i.test(title)) return false
      if (/^(get_|set_|fetch_|call_|run_|search_|find_)/i.test(title)) return false
      if (/function_call/i.test(title)) return false
      if (title.length < 2) return false
      return true
    })

    if (validSections.length === 0) {
      return null
    }

    const sections: OutlineSection[] = validSections.map((s: any) => ({
      id: randomUUID(),
      title: String(s.title || 'Untitled Section'),
      keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints.map(String) : [],
      subsections: Array.isArray(s.subsections)
        ? s.subsections.map((ss: any) => ({
            id: randomUUID(),
            title: String(ss.title || 'Untitled Subsection'),
            keyPoints: Array.isArray(ss.keyPoints) ? ss.keyPoints.map(String) : [],
            estimatedWords: typeof ss.estimatedWords === 'number' ? ss.estimatedWords : 150,
          }))
        : [],
      estimatedWords: typeof s.estimatedWords === 'number' ? s.estimatedWords : 300,
    }))
    const totalEstimatedWords = sections.reduce((sum, s) => sum + s.estimatedWords, 0)
    return {
      title: String(parsed.title),
      sections,
      totalEstimatedWords,
      createdAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[Planner] Failed to parse LLM outline response:', err)
    return null
  }
}

function generateOutlineFallback(instruction: string, researchContext?: ResearchContext): WriterOutline {
  const title = instruction.length > 120 ? `${instruction.slice(0, 117)}...` : instruction
  const wordTarget = extractWordCountFromPrompt(instruction)
  const totalWords = wordTarget || 1200
  const sectionHints = instruction
    .split(/(?:\r?\n|;|(?:\d+\.\s))/)
    .map(s => s.trim())
    .filter(s => s.length > 3)

  let sections: OutlineSection[]
  if (sectionHints.length >= 2) {
    const wordsPerSection = Math.round(totalWords / sectionHints.length)
    sections = sectionHints.map((hint) => ({
      id: randomUUID(),
      title: hint,
      keyPoints: [`Develop the "${hint}" section`],
      subsections: [],
      estimatedWords: wordsPerSection,
    }))
  } else {
    sections = [{
      id: randomUUID(),
      title: title,
      keyPoints: ['Write the full piece based on the instruction'],
      subsections: [],
      estimatedWords: totalWords,
    }]
  }

  if (researchContext && researchContext.entries.length > 0) {
    const summaryHint = researchContext.summary
      ? `Incorporate research: ${researchContext.summary.slice(0, 200)}`
      : 'Incorporate available research findings'
    if (sections.length > 0) {
      sections[0].keyPoints.push(summaryHint)
    }
  }

  const totalEstimatedWords = sections.reduce((sum, s) => sum + s.estimatedWords, 0)
  return { title, sections, totalEstimatedWords, createdAt: new Date().toISOString() }
}

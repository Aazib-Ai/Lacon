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
  GenerationResult,
  OutlineSection,
  OutlineSubsection,
  ResearchContext,
  RollingSummary,
  SectionProgress,
  TokenUsage,
  WriterLoopStage,
  WriterOutline,
  WriterSession,
} from '../../shared/writer-types'
import { getProviderManager } from '../providers/provider-manager'
import { getActiveProjectPath, getProjectWorkspaceService } from '../services/project-workspace-service'
import { getResearchLogService } from '../services/research-log-service'

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
  | 'generation-progress'
  | 'generation-complete'
  | 'review-complete'
  | 'error'

export interface WriterLoopEvent {
  type: WriterLoopEventType
  documentId: string
  payload: any
}

export type WriterLoopListener = (event: WriterLoopEvent) => void

// ─────────────────────────── Planner Module ───────────────────────────

/**
 * Build the system prompt for outline generation.
 */
function buildOutlineSystemPrompt(composedSkillPrompt: string): string {
  const skillContext = composedSkillPrompt
    ? `\n\nThe writer has configured the following writing style/skill guidance. Use this to shape the outline structure, tone, and section focus:\n\n${composedSkillPrompt}`
    : ''

  return `You are an expert writing planner. The user will describe a topic or piece they want to write.
Your job is to analyze what they want to write about and produce a comprehensive, well-structured outline that covers all the relevant aspects, arguments, and supporting points for their topic.

Think deeply about:
- What are the key themes and subtopics related to this subject?
- What logical structure would make this piece most compelling?
- What supporting evidence, examples, or arguments should each section cover?
- What is the right scope and depth for each section?

Respond ONLY with valid JSON matching this exact schema (no markdown fences, no extra text):

{
  "title": "A compelling title for the piece",
  "sections": [
    {
      "title": "Section title",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "subsections": [
        {
          "title": "Subsection title",
          "keyPoints": ["Sub key point 1"],
          "estimatedWords": 150
        }
      ],
      "estimatedWords": 400
    }
  ]
}

Rules:
- Create between 3 and 8 sections depending on scope
- Each section should have 2-5 key points that describe what to cover
- Subsections are optional — only include them when a section is complex enough to warrant subdivision
- estimatedWords should reflect the relative depth of each section (100-800 range)
- Key points should be specific and actionable, not generic (e.g., "Analyze the impact of X on Y" not "Write about the topic")
- The outline should feel like it was crafted by a subject-matter expert who understands the topic deeply${skillContext}`
}

/**
 * Build the user message for outline generation.
 */
function buildOutlineUserMessage(instruction: string, researchContext?: ResearchContext): string {
  let message = `I want to write about: ${instruction}`

  if (researchContext && researchContext.entries.length > 0) {
    message += '\n\nResearch context available:'
    if (researchContext.summary) {
      message += `\nSummary: ${researchContext.summary}`
    }
    for (const entry of researchContext.entries.slice(0, 5)) {
      message += `\n- ${entry.query}: ${entry.excerpts.slice(0, 2).join('; ')}`
    }
  }

  return message
}

/**
 * Parse the LLM's JSON response into a WriterOutline.
 * Validates and assigns UUIDs to each section/subsection.
 */
function parseOutlineResponse(raw: string, _instruction: string): WriterOutline | null {
  try {
    // Strip markdown fences if present
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/, '')
        .replace(/```\s*$/, '')
        .trim()
    }

    const parsed = JSON.parse(cleaned)

    if (!parsed.title || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return null
    }

    const sections: OutlineSection[] = parsed.sections.map((s: any) => ({
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

/**
 * Generate a structured outline by calling the configured LLM provider.
 * Falls back to a deterministic template if no provider is available or the LLM call fails.
 */
export async function generateOutline(
  instruction: string,
  composedSkillPrompt: string,
  researchContext?: ResearchContext,
): Promise<WriterOutline> {
  // Try LLM-powered outline generation
  try {
    const pm = getProviderManager()
    const providers = pm.listProviders()
    const enabledProvider = providers.find(p => p.enabled)

    if (enabledProvider) {
      const modelId = enabledProvider.defaultModel || 'gpt-4o-mini'

      console.log(`[Planner] Generating outline via LLM (provider: ${enabledProvider.id}, model: ${modelId})`)

      const response = await pm.chatCompletion(
        enabledProvider.id,
        {
          model: modelId,
          messages: [
            { role: 'system', content: buildOutlineSystemPrompt(composedSkillPrompt) },
            { role: 'user', content: buildOutlineUserMessage(instruction, researchContext) },
          ],
          temperature: 0.7,
          maxTokens: 4000,
        },
        'outline-generation',
      )

      const content = response.choices?.[0]?.message?.content
      if (content) {
        const outline = parseOutlineResponse(content, instruction)
        if (outline) {
          console.log(
            `[Planner] LLM outline generated: ${outline.sections.length} sections, ~${outline.totalEstimatedWords} words`,
          )
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

  // Fallback: deterministic template
  return generateOutlineFallback(instruction, composedSkillPrompt, researchContext)
}

/**
 * Deterministic fallback outline generator (original Phase 2 logic).
 * Used when no LLM provider is configured or the LLM call fails.
 */
function generateOutlineFallback(
  instruction: string,
  _composedSkillPrompt: string,
  researchContext?: ResearchContext,
): WriterOutline {
  const title = instruction.length > 120 ? `${instruction.slice(0, 117)}...` : instruction

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
  private sectionProgress: SectionProgress = {
    totalSections: 0,
    completedSections: 0,
    currentSectionId: null,
    currentSectionTitle: null,
    results: [],
    status: 'idle',
  }
  private rollingSummary: RollingSummary = {
    summary: '',
    lastUpdated: '',
    sectionsCovered: [],
  }

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
    const projectPath = getActiveProjectPath()
    if (!projectPath) {throw new Error('No project is open')}
    return ws.getSession(this.documentId, projectPath)
  }

  getOutline(): WriterOutline | null {
    if (this.currentOutline) {
      return this.currentOutline
    }

    // Try loading from persisted session
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
    const projectPath = getActiveProjectPath()
    if (!projectPath) {throw new Error('No project is open')}
    const updated = ws.updateSession(this.documentId, projectPath, { stage: nextStage })

    this.emit('stage-changed', { from: current, to: nextStage })
    this.emit('session-updated', updated)

    return updated
  }

  // ── Planning ──

  /**
   * Start the planning stage: generate an outline from the instruction via LLM.
   */
  async startPlanning(
    instruction: string,
    composedSkillPrompt: string,
    researchContext?: ResearchContext,
  ): Promise<WriterOutline> {
    // Transition to planning
    this.transition('planning')

    // Generate outline (now async — calls LLM)
    const outline = await generateOutline(instruction, composedSkillPrompt, researchContext)
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
    if (!outline) {
      throw new Error('No outline to modify')
    }

    outline.sections.push(section)
    return this.updateOutline(outline)
  }

  /**
   * Remove a section by ID.
   */
  removeSection(sectionId: string): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {
      throw new Error('No outline to modify')
    }

    outline.sections = outline.sections.filter(s => s.id !== sectionId)
    return this.updateOutline(outline)
  }

  /**
   * Update a single section.
   */
  updateSection(sectionId: string, updates: Partial<OutlineSection>): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {
      throw new Error('No outline to modify')
    }

    const idx = outline.sections.findIndex(s => s.id === sectionId)
    if (idx === -1) {
      throw new Error(`Section not found: ${sectionId}`)
    }

    outline.sections[idx] = { ...outline.sections[idx], ...updates }
    return this.updateOutline(outline)
  }

  /**
   * Add a subsection to a section.
   */
  addSubsection(sectionId: string, subsection: OutlineSubsection): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {
      throw new Error('No outline to modify')
    }

    const section = outline.sections.find(s => s.id === sectionId)
    if (!section) {
      throw new Error(`Section not found: ${sectionId}`)
    }

    section.subsections.push(subsection)
    return this.updateOutline(outline)
  }

  /**
   * Remove a subsection.
   */
  removeSubsection(sectionId: string, subsectionId: string): WriterOutline {
    const outline = this.getOutline()
    if (!outline) {
      throw new Error('No outline to modify')
    }

    const section = outline.sections.find(s => s.id === sectionId)
    if (!section) {
      throw new Error(`Section not found: ${sectionId}`)
    }

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
    const session = this.transition('generating')

    // Fire-and-forget: auto-start content generation
    this.generateAll().catch(err => {
      console.error('[WriterLoop] Auto-generation failed:', err)
      this.emit('error', {
        message: `Generation failed: ${err?.message || 'Unknown error'}`,
        fatal: true,
      })
    })

    return session
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
    const projectPath = getActiveProjectPath()
    if (!projectPath) {throw new Error('No project is open')}
    const updated = ws.updateSession(this.documentId, projectPath, updates)
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
    if (stage === 'idle') {
      return this.getSession()
    }

    this.currentOutline = null
    this.sectionProgress = {
      totalSections: 0,
      completedSections: 0,
      currentSectionId: null,
      currentSectionTitle: null,
      results: [],
      status: 'idle',
    }
    this.rollingSummary = { summary: '', lastUpdated: '', sectionsCovered: [] }
    return this.transition('idle')
  }

  // ── Phase 3: Generation ──

  /** Whether a generation run is active */
  private generationAborted = false
  /** Guard: prevent multiple concurrent generateAll calls */
  private generationRunning = false

  /**
   * Build the system prompt for section content generation.
   */
  private buildSectionSystemPrompt(
    outline: WriterOutline,
    section: OutlineSection,
    neighborContext: string,
    contextSummary: string,
    researchContext: string,
  ): string {
    const researchBlock = researchContext
      ? `
Research material available for this section:
${researchContext}

IMPORTANT: Use this research to ground your writing in facts. Reference specific data, statistics, and findings where relevant. Do NOT fabricate information — if the research doesn't cover something, write from general knowledge.
`
      : ''

    return `You are an expert writer producing a section of a longer document.

Document title: "${outline.title}"
Current section: "${section.title}"
Target length: approximately ${section.estimatedWords} words.

${neighborContext ? `Context from neighboring sections:\n${neighborContext}\n` : ''}
${contextSummary ? `Summary of what has been written so far:\n${contextSummary}\n` : ''}
${researchBlock}
Key points to cover in this section:
${section.keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join('\n')}

${section.subsections.length > 0 ? `Subsections to include:\n${section.subsections.map(ss => `- ${ss.title} (~${ss.estimatedWords} words): ${ss.keyPoints.join('; ')}`).join('\n')}\n` : ''}

Rules:
- Write in clean, professional prose. Do NOT use markdown.
- Output raw HTML suitable for a rich text editor (use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <em>, <strong> tags).
- Start with <h2>${section.title}</h2> as the section heading.
- Write approximately ${section.estimatedWords} words.
- Be specific, detailed, and engaging. Avoid filler text.
- Output ONLY the HTML content. No explanations, no markdown fences.`
  }

  /**
   * Generate a deterministic fallback for a section (used when LLM is unavailable).
   */
  private generateSectionFallback(section: OutlineSection, neighborContext: string): string {
    const keyPointsHtml = section.keyPoints.map(kp => `<li>${kp}</li>`).join('\n')
    const subsectionsHtml = section.subsections
      .map(ss => {
        const ssPoints = ss.keyPoints.map(kp => `<p>${kp}.</p>`).join('\n')
        return `<h3>${ss.title}</h3>\n${ssPoints}`
      })
      .join('\n')
    return [
      `<h2>${section.title}</h2>`,
      subsectionsHtml,
      `<ol>\n${keyPointsHtml}\n</ol>`,
      `<p>This section covers approximately ${section.estimatedWords} words on the topic of "${section.title}".</p>`,
      neighborContext ? `<p><em>Context: ${neighborContext}</em></p>` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  /**
   * Generate content for a single section via LLM (async).
   * Falls back to a deterministic template if the LLM call fails.
   */
  async generateSection(sectionId: string): Promise<GenerationResult> {
    const stage = this.getStage()
    if (stage !== 'generating') {
      throw new Error(`Cannot generate in stage: ${stage}`)
    }
    const outline = this.getOutline()
    if (!outline) {
      throw new Error('No outline available')
    }
    const section = outline.sections.find(s => s.id === sectionId)
    if (!section) {
      throw new Error(`Section not found: ${sectionId}`)
    }

    const sectionIdx = outline.sections.indexOf(section)

    // Context assembly: neighboring section summaries + rolling summary
    const prevSection = sectionIdx > 0 ? outline.sections[sectionIdx - 1] : null
    const nextSection = sectionIdx < outline.sections.length - 1 ? outline.sections[sectionIdx + 1] : null
    const neighborContext = [
      prevSection ? `Previous section "${prevSection.title}": ${prevSection.keyPoints.join('; ')}` : '',
      nextSection ? `Next section "${nextSection.title}": ${nextSection.keyPoints.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    // Context window guard: if rolling summary is too large, truncate
    const MAX_CONTEXT_CHARS = 8000
    let contextSummary = this.rollingSummary.summary
    if (contextSummary.length > MAX_CONTEXT_CHARS) {
      contextSummary = contextSummary.slice(-MAX_CONTEXT_CHARS)
      contextSummary = `...${contextSummary.slice(contextSummary.indexOf(' ') + 1)}`
    }

    // Gather research context for this section
    let researchContext = ''
    try {
      const log = getResearchLogService().getLog(this.documentId)
      if (log.entries.length > 0) {
        const titleTerms = section.title
          .toLowerCase()
          .split(/\s+/)
          .filter(t => t.length > 3)

        // Priority 1: Entries explicitly linked to this section
        const linked = log.entries.filter(e => e.linkedSectionIds.includes(sectionId))

        // Priority 2: Entries matching section title (fuzzy)
        const relevant = log.entries.filter(e => {
          if (linked.find(l => l.id === e.id)) {return false}
          const text = (`${e.query  } ${  e.excerpts.join(' ')}`).toLowerCase()
          const matchCount = titleTerms.filter(t => text.includes(t)).length
          return titleTerms.length > 0 && matchCount / titleTerms.length > 0.3
        })

        // Priority 3: General unlinked research (fallback)
        const general = log.entries.filter(
          e =>
            e.linkedSectionIds.length === 0 && !linked.find(l => l.id === e.id) && !relevant.find(r => r.id === e.id),
        )

        // Combine: linked first, then relevant, then general (cap at 5)
        const all = [...linked, ...relevant.slice(0, 3), ...general.slice(0, 2)].slice(0, 5)

        if (all.length > 0) {
          researchContext = all.map(e => `[Source: ${e.query}]\n${e.excerpts.slice(0, 2).join('\n')}`).join('\n---\n')
          // Hard cap at 2000 chars to fit LLM context window
          if (researchContext.length > 2000) {
            researchContext = `${researchContext.slice(0, 2000)  }...`
          }
          console.log(`[Generator] Injecting ${all.length} research entries for "${section.title}"`)
        }
      }
    } catch (err) {
      // Research log may not exist — continue without
      console.warn('[Generator] Could not load research context:', err)
    }

    // Update progress: mark this section as in-progress
    this.sectionProgress.currentSectionId = sectionId
    this.sectionProgress.currentSectionTitle = section.title
    this.sectionProgress.status = 'generating'
    this.emit('generation-progress', { ...this.sectionProgress })

    let generatedContent: string
    let tokenUsage: TokenUsage
    let usedLLM = false

    // Attempt LLM generation
    try {
      const pm = getProviderManager()
      const providers = pm.listProviders()
      const enabledProvider = providers.find(p => p.enabled)

      if (enabledProvider) {
        const modelId = enabledProvider.defaultModel || 'gpt-4o-mini'
        const systemPrompt = this.buildSectionSystemPrompt(
          outline,
          section,
          neighborContext,
          contextSummary,
          researchContext,
        )

        console.log(
          `[Generator] Writing section "${section.title}" via LLM (provider: ${enabledProvider.id}, model: ${modelId})`,
        )

        const response = await pm.chatCompletion(
          enabledProvider.id,
          {
            model: modelId,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Write the "${section.title}" section now. Output only the HTML content.` },
            ],
            temperature: 0.75,
            maxTokens: Math.max(1000, section.estimatedWords * 3),
          },
          'section-generation',
        )

        const content = response.choices?.[0]?.message?.content
        if (content && content.trim().length > 20) {
          generatedContent = content.trim()
          // Strip markdown fences if present
          if (generatedContent.startsWith('```')) {
            generatedContent = generatedContent
              .replace(/^```(?:html)?\s*/, '')
              .replace(/```\s*$/, '')
              .trim()
          }
          tokenUsage = {
            inputTokens: response.usage?.promptTokens || 0,
            outputTokens: response.usage?.completionTokens || 0,
            model: modelId,
            estimatedCost:
              (response.usage?.promptTokens || 0) * 0.000003 + (response.usage?.completionTokens || 0) * 0.000015,
          }
          usedLLM = true
          console.log(`[Generator] Section "${section.title}" complete (${tokenUsage.outputTokens} tokens)`)
        } else {
          console.warn(`[Generator] LLM returned empty/short content for "${section.title}", using fallback`)
          throw new Error('LLM returned empty content')
        }
      } else {
        console.log(`[Generator] No enabled provider, using fallback for "${section.title}"`)
        throw new Error('No provider available')
      }
    } catch (err: any) {
      console.warn(`[Generator] LLM failed for "${section.title}", using deterministic fallback:`, err?.message || err)
      // Fallback to deterministic template
      generatedContent = this.generateSectionFallback(section, neighborContext)
      const inputTokens = Math.ceil((contextSummary.length + neighborContext.length) / 4)
      const outputTokens = Math.ceil(generatedContent.length / 4)
      tokenUsage = {
        inputTokens,
        outputTokens,
        model: 'fallback',
        estimatedCost: 0,
      }
      // Emit a non-fatal error so the UI can show a warning
      this.emit('error', {
        message: `Section "${section.title}" used fallback content: ${err?.message || 'LLM unavailable'}`,
        fatal: false,
        sectionId,
      })
    }

    const result: GenerationResult = {
      sectionId,
      content: generatedContent!,
      tokenUsage: tokenUsage!,
      generatedAt: new Date().toISOString(),
    }

    // Update rolling summary
    if (usedLLM) {
      // Summarize what was written for context in subsequent sections
      const plainText = generatedContent!
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      this.rollingSummary.summary += `\n[${section.title}]: ${plainText.slice(0, 300)}`
    } else {
      this.rollingSummary.summary += `\n[${section.title}]: ${section.keyPoints.join('; ')}`
    }
    this.rollingSummary.lastUpdated = new Date().toISOString()
    this.rollingSummary.sectionsCovered.push(sectionId)

    // Update progress
    this.sectionProgress.results.push(result)
    this.sectionProgress.completedSections += 1

    this.emit('generation-progress', { ...this.sectionProgress })
    return result
  }

  /**
   * Generate all sections sequentially (async, with per-section progress).
   */
  async generateAll(): Promise<SectionProgress> {
    const outline = this.getOutline()
    if (!outline) {
      throw new Error('No outline available')
    }

    this.generationAborted = false
    this.generationRunning = true
    this.sectionProgress = {
      totalSections: outline.sections.length,
      completedSections: 0,
      currentSectionId: null,
      currentSectionTitle: null,
      results: [],
      status: 'generating',
    }

    this.emit('generation-progress', { ...this.sectionProgress })
    console.log(`[Generator] Starting generation of ${outline.sections.length} sections`)

    for (const section of outline.sections) {
      if (this.generationAborted) {
        console.log(
          `[Generator] Generation aborted by user after ${this.sectionProgress.completedSections}/${outline.sections.length} sections`,
        )

        this.generationRunning = false
        this.sectionProgress.status = 'complete'
        this.sectionProgress.currentSectionId = null
        this.sectionProgress.currentSectionTitle = null

        // Snapshot whatever we have so far
        if (this.sectionProgress.results.length > 0) {
          const generatedContent = this.sectionProgress.results.map(r => r.content).join('\n\n')
          const snapshot = this.createSnapshot('after-generation', generatedContent)
          this.emit('snapshot-created', snapshot)
        }

        this.emit('generation-complete', this.sectionProgress)

        // Transition out of generating
        try {
          this.transition('reviewing')
        } catch {
          try {
            this.transition('idle')
          } catch {
            /* already idle */
          }
        }

        return this.sectionProgress
      }

      try {
        await this.generateSection(section.id)
      } catch (err: any) {
        console.error(`[Generator] Fatal error on section "${section.title}":`, err)
        this.emit('error', {
          message: `Generation failed on "${section.title}": ${err?.message || 'Unknown error'}`,
          fatal: true,
          sectionId: section.id,
        })
        // Continue to next section rather than aborting entirely
      }
    }

    this.generationRunning = false
    this.sectionProgress.status = 'complete'
    this.sectionProgress.currentSectionId = null
    this.sectionProgress.currentSectionTitle = null

    // Auto-snapshot after generation
    const generatedContent = this.sectionProgress.results.map(r => r.content).join('\n\n')
    const snapshot = this.createSnapshot('after-generation', generatedContent)
    this.emit('snapshot-created', snapshot)
    this.emit('generation-complete', this.sectionProgress)

    console.log(
      `[Generator] Generation complete: ${this.sectionProgress.completedSections}/${this.sectionProgress.totalSections} sections`,
    )

    // Auto-transition to complete (or reviewing if we add that later)
    try {
      this.transition('reviewing')
    } catch {
      // If transition fails, try complete
      try {
        this.transition('idle')
      } catch {
        /* already idle */
      }
    }

    return this.sectionProgress
  }

  /**
   * Abort an in-progress generation run.
   * Returns current progress with all completed section results.
   */
  abortGeneration(): SectionProgress {
    this.generationAborted = true
    console.log('[Generator] Abort requested')
    return { ...this.sectionProgress }
  }

  /** Get current generation progress. Auto-recovers stuck generating state. */
  getProgress(): SectionProgress {
    // Auto-recovery: if session says 'generating' but progress is idle, auto-kick generation
    const stage = this.getStage()
    const outline = this.getOutline()
    if (
      stage === 'generating' &&
      this.sectionProgress.status === 'idle' &&
      !this.generationRunning &&
      outline &&
      outline.sections.length > 0
    ) {
      console.log('[Generator] Auto-recovery: session is generating but progress is idle — kickstarting generateAll()')
      // Fire-and-forget
      this.generateAll().catch(err => {
        console.error('[Generator] Auto-recovery generateAll failed:', err)
      })
    }

    return { ...this.sectionProgress }
  }

  /** Accept a generated section (mark as finalized). */
  acceptGeneration(sectionId: string): GenerationResult | null {
    const result = this.sectionProgress.results.find(r => r.sectionId === sectionId)
    return result || null
  }

  /** Reject a generated section (remove from results). */
  rejectGeneration(sectionId: string): void {
    this.sectionProgress.results = this.sectionProgress.results.filter(r => r.sectionId !== sectionId)
    this.sectionProgress.completedSections = this.sectionProgress.results.length
  }

  // ── Snapshots ──

  createSnapshot(trigger: DocumentSnapshot['trigger'], content?: any): DocumentSnapshot {
    const ws = getProjectWorkspaceService()
    const projectPath = getActiveProjectPath()
    if (!projectPath) {throw new Error('No project is open')}
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

  // ── Persistence helpers ──

  private persistOutline(outline: WriterOutline): void {
    const ws = getProjectWorkspaceService()
    const workspace = ws.ensureWorkspace(this.documentId, getActiveProjectPath()!)
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

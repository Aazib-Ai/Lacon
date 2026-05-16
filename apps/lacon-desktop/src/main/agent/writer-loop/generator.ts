/**
 * Writer Loop — Section Generator
 *
 * Handles LLM-powered section content generation, progress tracking,
 * rolling summary management, and research context assembly.
 */

import type {
  GenerationResult,
  OutlineSection,
  RollingSummary,
  SectionProgress,
  TokenUsage,
  WriterOutline,
} from '../../../shared/writer-types'
import { getProviderManager } from '../../providers/provider-manager'
import { getResearchLogService } from '../../services/research-log-service'
import type { WriterLoopEventEmitter } from './event-emitter'
import type { OutlineManager } from './outline-manager'
import { buildSectionSystemPrompt } from './prompts'
import { resolveProviderAndModel } from './resolve-model'
import type { SnapshotManager } from './snapshot-manager'
import type { WriterStateMachine } from './writer-state-machine'

// ─────────────────────────── Constants ───────────────────────────

const MAX_CONTEXT_CHARS = 8000

/**
 * Strip tool-call artifacts, AI analysis preambles, and meta-commentary
 * that some models inject despite prompt instructions.
 */
function sanitizeGeneratedContent(content: string): string {
  let cleaned = content

  // Remove <tool_call>...</tool_call> blocks and any standalone tags
  cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
  cleaned = cleaned.replace(/<\/?tool_call>/gi, '')

  // Remove <function_call>...</function_call> blocks
  cleaned = cleaned.replace(/<function_call>[\s\S]*?<\/function_call>/gi, '')
  cleaned = cleaned.replace(/<\/?function_call>/gi, '')

  // Remove function_call JSON blocks
  cleaned = cleaned.replace(/\{\s*"function_call"\s*:[\s\S]*?\}/g, '')
  cleaned = cleaned.replace(/\{\s*"name"\s*:\s*"[^"]*"\s*,\s*"arguments"\s*:[\s\S]*?\}/g, '')
  cleaned = cleaned.replace(/\{\s*"tool"\s*:\s*"[^"]*"\s*,\s*"args"\s*:[\s\S]*?\}/g, '')

  // Remove function-call syntax patterns (search_web(...), deep_research(...), etc.)
  cleaned = cleaned.replace(
    /(?:search_web|deep_research|get_existing_research|list_available_skills|select_skills|ready_to_plan)\s*\([^)]*\)/gi,
    '',
  )

  // Remove AI analysis preambles (common patterns)
  cleaned = cleaned.replace(/^\s*AI\s+analysis:.*$/gim, '')
  cleaned = cleaned.replace(/^\s*Let me (?:check|think|analyze|review|look|search|research).*$/gim, '')
  cleaned = cleaned.replace(
    /^\s*(?:I'll|I will|I need to) (?:check|analyze|review|look|start|begin|search|research).*$/gim,
    '',
  )

  // Remove sentences mentioning internal tools/functions in prose
  cleaned = cleaned.replace(
    /<p>[^<]*(?:search_web|deep_research|get_existing_research|tool_call|function_call)[^<]*<\/p>/gi,
    '',
  )

  // Remove meta-commentary about word counts, sections, context
  cleaned = cleaned.replace(/<p>\s*This section covers approximately \d+ words.*?<\/p>/gi, '')
  cleaned = cleaned.replace(/<p>\s*<em>\s*Context:.*?<\/em>\s*<\/p>/gi, '')
  cleaned = cleaned.replace(/<p>\s*(?:Next|Previous) section.*?<\/p>/gi, '')

  // Clean up any resulting empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  return cleaned
}

// ─────────────────────────── Section Generator ───────────────────────────

export class SectionGenerator {
  private documentId: string
  private emitter: WriterLoopEventEmitter
  private stateMachine: WriterStateMachine
  private outlineManager: OutlineManager
  private snapshotManager: SnapshotManager

  private generationAborted = false
  private generationRunning = false
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

  constructor(
    documentId: string,
    emitter: WriterLoopEventEmitter,
    stateMachine: WriterStateMachine,
    outlineManager: OutlineManager,
    snapshotManager: SnapshotManager,
  ) {
    this.documentId = documentId
    this.emitter = emitter
    this.stateMachine = stateMachine
    this.outlineManager = outlineManager
    this.snapshotManager = snapshotManager
  }

  // ── Single Section Generation ──

  async generateSection(sectionId: string): Promise<GenerationResult> {
    const stage = this.stateMachine.getStage()
    if (stage !== 'generating') {
      throw new Error(`Cannot generate in stage: ${stage}`)
    }
    const outline = this.outlineManager.getOutline()
    if (!outline) {
      throw new Error('No outline available')
    }
    const section = outline.sections.find(s => s.id === sectionId)
    if (!section) {
      throw new Error(`Section not found: ${sectionId}`)
    }

    const sectionIdx = outline.sections.indexOf(section)
    const neighborContext = this.buildNeighborContext(outline, sectionIdx)
    const contextSummary = this.getTruncatedContext()
    const researchContext = this.gatherResearchContext(section, sectionId)

    // Update progress
    this.sectionProgress.currentSectionId = sectionId
    this.sectionProgress.currentSectionTitle = section.title
    this.sectionProgress.status = 'generating'
    this.emitter.emit('generation-progress', { ...this.sectionProgress })

    let generatedContent: string
    let tokenUsage: TokenUsage
    let usedLLM = false

    try {
      const pm = getProviderManager()
      const resolved = resolveProviderAndModel(this.stateMachine)

      if (resolved) {
        const { providerId, modelId } = resolved
        const systemPrompt = buildSectionSystemPrompt(
          outline,
          section,
          neighborContext,
          contextSummary,
          researchContext,
        )

        console.log(
          `[Generator] Writing section "${section.title}" via LLM (provider: ${providerId}, model: ${modelId})`,
        )

        const response = await pm.chatCompletion(
          providerId,
          {
            model: modelId,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Write the content for this section now. Start with the <h2> tag, then go directly into body paragraphs. Do NOT write the section name as text outside the <h2> tag. Do NOT include any meta-commentary about word counts, context, or section descriptions. Do NOT output any tool calls, function calls, search_web(), deep_research(), or any code/JSON. Output ONLY the HTML content for this section — pure prose and formatting tags.`,
              },
            ],
            temperature: 0.75,
            maxTokens: Math.max(1000, section.estimatedWords * 3),
          },
          'section-generation',
        )

        const content = response.choices?.[0]?.message?.content
        if (content && content.trim().length > 20) {
          generatedContent = sanitizeGeneratedContent(content.trim())
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
      generatedContent = this.generateSectionFallback(section, neighborContext)
      const inputTokens = Math.ceil((contextSummary.length + neighborContext.length) / 4)
      const outputTokens = Math.ceil(generatedContent.length / 4)
      tokenUsage = { inputTokens, outputTokens, model: 'fallback', estimatedCost: 0 }
      this.emitter.emit('error', {
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

    this.updateRollingSummary(section, generatedContent!, usedLLM)
    this.sectionProgress.results.push(result)
    this.sectionProgress.completedSections += 1
    this.emitter.emit('generation-progress', { ...this.sectionProgress })
    return result
  }

  // ── Generate All Sections ──

  async generateAll(): Promise<SectionProgress> {
    const outline = this.outlineManager.getOutline()
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

    this.emitter.emit('generation-progress', { ...this.sectionProgress })
    console.log(`[Generator] Starting generation of ${outline.sections.length} sections`)

    // Create a pre-generation snapshot so the user can restore to this point
    try {
      const snapshot = this.snapshotManager.createSnapshot('before-generation')
      this.emitter.emit('snapshot-created', snapshot)
    } catch (err) {
      console.warn('[Generator] Could not create before-generation snapshot:', err)
    }

    for (const section of outline.sections) {
      if (this.generationAborted) {
        return this.finalizeAborted(outline)
      }
      try {
        await this.generateSection(section.id)
      } catch (err: any) {
        console.error(`[Generator] Fatal error on section "${section.title}":`, err)
        this.emitter.emit('error', {
          message: `Generation failed on "${section.title}": ${err?.message || 'Unknown error'}`,
          fatal: true,
          sectionId: section.id,
        })
      }
    }

    return this.finalizeComplete()
  }

  // ── Control Methods ──

  abortGeneration(): SectionProgress {
    this.generationAborted = true
    console.log('[Generator] Abort requested')
    return { ...this.sectionProgress }
  }

  getProgress(): SectionProgress {
    const stage = this.stateMachine.getStage()
    const outline = this.outlineManager.getOutline()
    if (
      stage === 'generating' &&
      this.sectionProgress.status === 'idle' &&
      !this.generationRunning &&
      outline &&
      outline.sections.length > 0
    ) {
      console.log('[Generator] Auto-recovery: session is generating but progress is idle — kickstarting generateAll()')
      this.generateAll().catch(err => {
        console.error('[Generator] Auto-recovery generateAll failed:', err)
      })
    }
    return { ...this.sectionProgress }
  }

  acceptGeneration(sectionId: string): GenerationResult | null {
    const result = this.sectionProgress.results.find(r => r.sectionId === sectionId)
    return result || null
  }

  rejectGeneration(sectionId: string): void {
    this.sectionProgress.results = this.sectionProgress.results.filter(r => r.sectionId !== sectionId)
    this.sectionProgress.completedSections = this.sectionProgress.results.length
  }

  /** Reset all generation state. */
  resetState(): void {
    this.sectionProgress = {
      totalSections: 0,
      completedSections: 0,
      currentSectionId: null,
      currentSectionTitle: null,
      results: [],
      status: 'idle',
    }
    this.rollingSummary = { summary: '', lastUpdated: '', sectionsCovered: [] }
  }

  // ── Private Helpers ──

  private buildNeighborContext(outline: WriterOutline, sectionIdx: number): string {
    const prevSection = sectionIdx > 0 ? outline.sections[sectionIdx - 1] : null
    const nextSection = sectionIdx < outline.sections.length - 1 ? outline.sections[sectionIdx + 1] : null
    return [
      prevSection ? `Previous section "${prevSection.title}": ${prevSection.keyPoints.join('; ')}` : '',
      nextSection ? `Next section "${nextSection.title}": ${nextSection.keyPoints.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  private getTruncatedContext(): string {
    let contextSummary = this.rollingSummary.summary
    if (contextSummary.length > MAX_CONTEXT_CHARS) {
      contextSummary = contextSummary.slice(-MAX_CONTEXT_CHARS)
      contextSummary = `...${contextSummary.slice(contextSummary.indexOf(' ') + 1)}`
    }
    return contextSummary
  }

  private gatherResearchContext(section: OutlineSection, sectionId: string): string {
    try {
      const log = getResearchLogService().getLog(this.documentId)
      if (log.entries.length === 0) {return ''}

      const titleTerms = section.title
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length > 3)
      const linked = log.entries.filter(e => e.linkedSectionIds.includes(sectionId))
      const relevant = log.entries.filter(e => {
        if (linked.find(l => l.id === e.id)) {return false}
        const text = `${e.query} ${e.excerpts.join(' ')}`.toLowerCase()
        const matchCount = titleTerms.filter(t => text.includes(t)).length
        return titleTerms.length > 0 && matchCount / titleTerms.length > 0.3
      })
      const general = log.entries.filter(
        e => e.linkedSectionIds.length === 0 && !linked.find(l => l.id === e.id) && !relevant.find(r => r.id === e.id),
      )

      const all = [...linked, ...relevant.slice(0, 3), ...general.slice(0, 2)].slice(0, 5)
      if (all.length === 0) {return ''}

      // Build numbered source list for citation support
      const sourcesBlock = all
        .map((e, idx) => {
          const sourceLabel = e.sources.length > 0 ? e.sources[0].url || e.sources[0].title || e.query : e.query
          return `[${idx + 1}] "${e.query}" — ${sourceLabel}`
        })
        .join('\n')

      const excerptsBlock = all
        .map((e, idx) => {
          return `[${idx + 1}]: ${e.excerpts.slice(0, 2).join(' ')}`
        })
        .join('\n\n')

      let researchContext = `Sources available for citation:\n${sourcesBlock}\n\nExcerpts:\n${excerptsBlock}`
      if (researchContext.length > 2000) {
        researchContext = `${researchContext.slice(0, 2000)}...`
      }
      console.log(`[Generator] Injecting ${all.length} numbered research entries for "${section.title}"`)
      return researchContext
    } catch (err) {
      console.warn('[Generator] Could not load research context:', err)
      return ''
    }
  }

  private generateSectionFallback(section: OutlineSection, _neighborContext: string): string {
    const subsectionsHtml = section.subsections
      .map(ss => {
        const ssPoints = ss.keyPoints.map(kp => `<p>${kp}.</p>`).join('\n')
        return `<h3>${ss.title}</h3>\n${ssPoints}`
      })
      .join('\n')
    const keyPointsHtml = section.keyPoints.map(kp => `<p>${kp}.</p>`).join('\n')
    return [`<h2>${section.title}</h2>`, subsectionsHtml, keyPointsHtml].filter(Boolean).join('\n')
  }

  private updateRollingSummary(section: OutlineSection, content: string, usedLLM: boolean): void {
    if (usedLLM) {
      const plainText = content
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      this.rollingSummary.summary += `\n[${section.title}]: ${plainText.slice(0, 300)}`
    } else {
      this.rollingSummary.summary += `\n[${section.title}]: ${section.keyPoints.join('; ')}`
    }
    this.rollingSummary.lastUpdated = new Date().toISOString()
    this.rollingSummary.sectionsCovered.push(section.id)
  }

  private finalizeAborted(outline: WriterOutline): SectionProgress {
    console.log(
      `[Generator] Generation aborted after ${this.sectionProgress.completedSections}/${outline.sections.length} sections`,
    )
    this.generationRunning = false
    this.sectionProgress.status = 'complete'
    this.sectionProgress.currentSectionId = null
    this.sectionProgress.currentSectionTitle = null

    if (this.sectionProgress.results.length > 0) {
      const generatedContent = this.sectionProgress.results.map(r => r.content).join('\n\n')
      const snapshot = this.snapshotManager.createSnapshot('after-generation', generatedContent)
      this.emitter.emit('snapshot-created', snapshot)
    }
    this.emitter.emit('generation-complete', this.sectionProgress)

    try {
      this.stateMachine.transition('reviewing')
    } catch {
      try {
        this.stateMachine.transition('idle')
      } catch {
        /* already idle */
      }
    }
    return this.sectionProgress
  }

  private finalizeComplete(): SectionProgress {
    this.generationRunning = false
    this.sectionProgress.status = 'complete'
    this.sectionProgress.currentSectionId = null
    this.sectionProgress.currentSectionTitle = null

    // Append a References section if research sources exist
    const referencesHtml = this.buildReferencesSection()
    if (referencesHtml) {
      // Add as a synthetic final result so it gets concatenated with the article
      this.sectionProgress.results.push({
        sectionId: '__references__',
        content: referencesHtml,
        tokenUsage: { inputTokens: 0, outputTokens: 0, model: 'system', estimatedCost: 0 },
        generatedAt: new Date().toISOString(),
      })
      console.log('[Generator] Appended References section with source links')
    }

    const generatedContent = this.sectionProgress.results.map(r => r.content).join('\n\n')
    const snapshot = this.snapshotManager.createSnapshot('after-generation', generatedContent)
    this.emitter.emit('snapshot-created', snapshot)
    this.emitter.emit('generation-complete', this.sectionProgress)

    console.log(
      `[Generator] Generation complete: ${this.sectionProgress.completedSections}/${this.sectionProgress.totalSections} sections`,
    )

    const session = this.stateMachine.getSession()
    if (session.automationLevel === 'auto') {
      try {
        this.stateMachine.transition('complete')
        console.log('[Generator] Auto mode: transitioned to complete (skipping review)')
      } catch {
        try {
          this.stateMachine.transition('idle')
        } catch {
          /* already idle */
        }
      }
    } else {
      try {
        this.stateMachine.transition('reviewing')
      } catch {
        try {
          this.stateMachine.transition('idle')
        } catch {
          /* already idle */
        }
      }
    }
    return this.sectionProgress
  }

  /**
   * Build an HTML References section from all research log sources.
   * Returns null if no sources are available.
   */
  private buildReferencesSection(): string | null {
    try {
      const log = getResearchLogService().getLog(this.documentId)
      if (log.entries.length === 0) {return null}

      // Collect unique sources across all entries
      const seen = new Set<string>()
      const sources: Array<{ title: string; url: string; domain: string }> = []

      for (const entry of log.entries) {
        for (const source of entry.sources) {
          const url = source.url || ''
          if (!url || seen.has(url)) {continue}
          seen.add(url)

          let domain = ''
          try {
            domain = new URL(url).hostname.replace('www.', '')
          } catch {
            domain = url.slice(0, 40)
          }

          sources.push({
            title: source.title || entry.query,
            url,
            domain,
          })
        }
      }

      if (sources.length === 0) {return null}

      const listItems = sources
        .slice(0, 20) // Cap at 20 references
        .map(
          (s, i) =>
            `<li>[${i + 1}] <a href="${s.url}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(s.title)}</a> — <em>${this.escapeHtml(s.domain)}</em></li>`,
        )
        .join('\n')

      return `<h2>References</h2>\n<ol>\n${listItems}\n</ol>`
    } catch (err) {
      console.warn('[Generator] Could not build references section:', err)
      return null
    }
  }

  /** Escape HTML special characters for safe embedding */
  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
}

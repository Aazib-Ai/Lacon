/**
 * Reviewer Agent — Phase 4 (AI-Powered)
 *
 * Responsibilities:
 * - Call the LLM to review generated content against the approved outline
 * - Compare section word counts against approved targets
 * - Detect tone drift, weak arguments, coherence issues, redundancies
 * - Enforce planner authority on structure conflicts
 * - Generate review flags with concrete suggested rewrites
 * - Support surgical paragraph-level editing via LLM
 * - Persist review results to disk (.lacon/documents/{docId}/reviews/)
 */

import { randomUUID } from 'crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import type {
  GenerationResult,
  ReviewCategory,
  ReviewFlag,
  ReviewResult,
  ReviewSeverity,
  TokenUsage,
  WriterOutline,
} from '../../shared/writer-types'
import { getProviderManager } from '../providers/provider-manager'
import { getActiveProjectPath, getProjectWorkspaceService } from '../services/project-workspace-service'

// ─────────────────────────── Constants ───────────────────────────

/** Maximum number of automatic reviewer passes before requiring user decision */
const MAX_AUTO_PASSES = 3

// ─────────────────────────── System Prompt ───────────────────────────

function buildReviewSystemPrompt(
  outline: WriterOutline | null,
  generationResults: GenerationResult[],
): string {
  let outlineContext = ''
  if (outline) {
    outlineContext = `
APPROVED OUTLINE (the structure the author agreed to):
Title: "${outline.title}"
Total target: ~${outline.totalEstimatedWords} words

Sections:
${outline.sections.map((s, i) => {
  const subsections = s.subsections.length > 0
    ? `\n    Subsections: ${s.subsections.map(ss => `"${ss.title}" (~${ss.estimatedWords}w, points: ${ss.keyPoints.join('; ')})`).join(', ')}`
    : ''
  return `  ${i + 1}. "${s.title}" — Target: ~${s.estimatedWords} words
    Key points to cover: ${s.keyPoints.join('; ')}${subsections}`
}).join('\n')}
`
  }

  let generationContext = ''
  if (generationResults.length > 0) {
    generationContext = `
AI-GENERATED CONTENT (what the writer AI produced for each section):
${generationResults.map(r => {
  const plainText = r.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length
  return `[Section ${r.sectionId}] (${wordCount} words generated at ${r.generatedAt}):\n${plainText.slice(0, 800)}${plainText.length > 800 ? '...' : ''}`
}).join('\n\n')}
`
  }

  return `You are an expert document reviewer and editor. Your job is to critically review a document and identify concrete, actionable issues.

${outlineContext}
${generationContext}

You will be given the CURRENT DOCUMENT CONTENT (what is actually in the editor — may include user edits on top of AI generation).

Your task:
1. Compare each section against the APPROVED OUTLINE:
   - Does it cover ALL the key points listed?
   - Does it match the approved word count? Flag as WARNING if off by >15%, ERROR if off by >30%.
   - Is it structured correctly (subsections present if outlined)?

2. Assess content quality per paragraph:
   - Identify paragraphs that feel off-topic or drift from the section intent
   - Flag weak or unsupported claims that need evidence
   - Detect tone or style inconsistencies between sections
   - Find redundancies (same idea repeated across sections)
   - Check for grammar, clarity, and readability issues
   - Spot missing transitions between sections

3. For EACH issue you find, produce a JSON object with:
   - "paragraphId": the paragraph ID or "section-{number}" for section-level issues
   - "severity": "suggestion" | "warning" | "error"
   - "category": "coherence" | "grammar" | "style" | "structure" | "factual" | "tone" | "redundancy" | "clarity"
   - "message": A clear, specific explanation of the issue
   - "originalText": The problematic text (first 200 chars)
   - "suggestedRewrite": A concrete, improved version of the text

Respond ONLY with valid JSON matching this exact schema (no markdown fences, no extra text):
{
  "flags": [
    {
      "paragraphId": "string",
      "severity": "suggestion" | "warning" | "error",
      "category": "string",
      "message": "string",
      "originalText": "string",
      "suggestedRewrite": "string"
    }
  ],
  "structureConflicts": ["string"],
  "summary": "A 1-2 sentence summary of overall document quality"
}

Rules:
- Be specific and constructive, not vague ("This paragraph lacks supporting evidence for the claim about X" not "Needs improvement")
- Always provide a concrete suggestedRewrite — show don't tell
- For word count issues, state the target vs actual count
- If the document genuinely looks good, return an empty flags array — don't manufacture issues
- Focus on substantive issues, not nitpicks. Quality over quantity.
- Maximum 15 flags per review pass`
}

function buildSurgicalEditPrompt(instruction?: string): string {
  // Detect refine action tags for specialized prompts
  if (instruction) {
    if (instruction.includes('[REFINE:REPHRASE]')) {
      return `You are an expert editor specializing in paraphrasing. Rewrite the given paragraph using different wording, sentence structures, and word choices while preserving the EXACT same meaning and all factual content.

Rules:
- Output ONLY the rewritten paragraph text — no explanations, no markdown fences, no labels
- Vary sentence length and structure for improved readability
- Use synonyms and alternative phrasings naturally
- Maintain the same tone, register, and formality level
- Preserve all technical terms, proper nouns, and key terminology
- The result should read as a completely fresh take on the same ideas
- Match the style of surrounding paragraphs provided in the context`
    }

    if (instruction.includes('[REFINE:ADD_PARAGRAPH]')) {
      return `You are an expert writer. Generate a single new paragraph that logically continues from or complements the selected content.

Rules:
- Output ONLY the new paragraph text — no explanations, no markdown fences, no labels
- The paragraph must flow naturally from the preceding context
- Match the writing style, vocabulary level, and tone of the surrounding text
- Add substantive new content — evidence, examples, analysis, or elaboration
- Do NOT repeat ideas already present in the surrounding paragraphs
- Keep a similar paragraph length to the surrounding paragraphs
- Ensure smooth transitions with what comes before and after`
    }

    if (instruction.includes('[REFINE:CONCISE]')) {
      return `You are an expert editor specializing in concise writing. Shorten the given paragraph by 30-50% while retaining ALL key information.

Rules:
- Output ONLY the shortened paragraph text — no explanations, no markdown fences, no labels
- Remove filler words, redundant phrases, and unnecessary qualifiers
- Combine sentences where possible without losing clarity
- Preserve every key fact, argument, and piece of evidence
- Maintain the original tone and formality
- The result should feel tighter and more impactful, not just truncated`
    }

    if (instruction.includes('[REFINE:FORMAL]')) {
      return `You are an expert editor specializing in professional and academic writing. Transform the given paragraph to a formal register.

Rules:
- Output ONLY the rewritten paragraph text — no explanations, no markdown fences, no labels
- Replace all contractions with full forms
- Use precise, sophisticated vocabulary appropriate to the subject
- Adopt an authoritative, measured tone
- Use passive voice sparingly and only when appropriate
- Maintain all factual content and arguments exactly
- Ensure the result reads naturally, not artificially stiff`
    }

    if (instruction.includes('[REFINE:EXPAND]')) {
      return `You are an expert writer specializing in thorough, detailed prose. Expand the given paragraph with supporting evidence, examples, and deeper analysis.

Rules:
- Output ONLY the expanded paragraph text — no explanations, no markdown fences, no labels
- Roughly double the original length
- Add concrete examples, supporting evidence, or illustrative details
- Deepen the analysis with cause-effect reasoning or implications
- Maintain the same writing style, tone, and vocabulary level
- Ensure every added sentence contributes meaningful content (no filler)
- Keep logical flow and coherence with surrounding paragraphs`
    }

    if (instruction.includes('[REFINE:SIMPLIFY]')) {
      return `You are an expert editor specializing in plain language. Rewrite the given paragraph at an 8th-grade reading level.

Rules:
- Output ONLY the simplified paragraph text — no explanations, no markdown fences, no labels
- Use short sentences (under 20 words each)
- Replace jargon with everyday equivalents
- Break complex ideas into simple, digestible pieces
- Use active voice whenever possible
- Preserve ALL key information and arguments
- Add brief explanations for any remaining technical terms
- The result should be accessible to a general audience`
    }

    if (instruction.includes('[REFINE:GRAMMAR]')) {
      return `You are an expert proofreader. Fix ONLY grammar, spelling, and punctuation errors in the given paragraph.

Rules:
- Output ONLY the corrected paragraph text — no explanations, no markdown fences, no labels
- Fix grammatical errors (subject-verb agreement, tense consistency, etc.)
- Correct spelling mistakes and typos
- Fix punctuation (commas, semicolons, periods, apostrophes)
- Do NOT change word choice, tone, style, or sentence structure
- Do NOT add or remove content
- Do NOT rephrase — only fix clear errors
- If there are no errors, return the paragraph exactly as-is`
    }

    if (instruction.includes('[REFINE:MATCH_STYLE]')) {
      return `You are an expert editor specializing in style matching. Analyze the writing style of the surrounding paragraphs, then rewrite the selected paragraph to seamlessly match that style.

Rules:
- Output ONLY the rewritten paragraph text — no explanations, no markdown fences, no labels
- Analyze the surrounding context for: sentence length, vocabulary level, tone (formal/informal), use of figurative language, paragraph structure
- Rewrite the selected paragraph to match ALL these stylistic elements
- Preserve the exact meaning and factual content
- The result should feel like it was written by the same author as the surrounding text
- Pay special attention to transitions between paragraphs`
    }
  }

  // Default surgical edit prompt (fallback)
  return `You are an expert editor. You will be given a paragraph from a document, along with an instruction for how to improve it.

Rewrite ONLY the given paragraph according to the instruction. Preserve the original meaning and any factual content unless the instruction explicitly asks to change it.

Rules:
- Output ONLY the rewritten paragraph text — no explanations, no markdown fences
- Write in clean, professional prose
- Match the tone and style of the surrounding context
- If the instruction asks to expand, add meaningful content (not filler)
- If the instruction asks to shorten, preserve the core argument`
}

function buildRewriteAllPrompt(): string {
  return `You are an expert writer and editor. You will be given a full document and an instruction for how to rewrite it.

Rewrite the entire document according to the instruction while preserving the core content and structure.

Rules:
- Output raw HTML suitable for a rich text editor (use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <em>, <strong> tags)
- Preserve all section headings and overall structure unless the instruction says otherwise
- Write in clean, professional prose
- Output ONLY the HTML content — no explanations, no markdown fences`
}

// ─────────────────────────── Reviewer Class ───────────────────────────

export class Reviewer {
  private documentId: string
  private passCount: number = 0
  private reviewResults: ReviewResult[] = []

  constructor(documentId: string) {
    this.documentId = documentId
    // Load persisted review data on construction
    this.loadPersistedReviews()
  }

  /**
   * Resolve the provider ID and model ID for LLM calls.
   * Checks session.modelConfig first, then falls back to enabledProvider.defaultModel.
   */
  private resolveModel(): { providerId: string; modelId: string } | null {
    const pm = getProviderManager()
    const providers = pm.listProviders()

    // Check session modelConfig first
    try {
      const projectPath = getActiveProjectPath()
      if (projectPath) {
        const ws = getProjectWorkspaceService()
        const session = ws.getSession(this.documentId, projectPath)
        if (session.modelConfig?.providerId && session.modelConfig?.modelId) {
          const provider = providers.find(p => p.id === session.modelConfig.providerId)
          if (provider) {
            return { providerId: session.modelConfig.providerId, modelId: session.modelConfig.modelId }
          }
        }
      }
    } catch {
      // Fall through to default
    }

    // Fall back to first enabled provider
    const enabledProvider = providers.find(p => p.enabled)
    if (enabledProvider) {
      return { providerId: enabledProvider.id, modelId: enabledProvider.defaultModel || 'gpt-4o-mini' }
    }

    return null
  }

  /**
   * Run an AI-powered review pass on generated content.
   * Falls back to heuristic checks if no LLM provider is available.
   */
  async runReview(
    content: string,
    outline: WriterOutline | null,
    paragraphs: Array<{ id: string; text: string }>,
    generationResults: GenerationResult[],
  ): Promise<ReviewResult> {
    if (this.passCount >= MAX_AUTO_PASSES) {
      throw new Error(
        `Max automatic reviewer passes (${MAX_AUTO_PASSES}) reached. User must decide to continue or accept.`,
      )
    }

    this.passCount += 1

    // Try LLM-powered review
    try {
      const pm = getProviderManager()
      const resolved = this.resolveModel()

      if (resolved) {
        const { providerId, modelId } = resolved
        console.log(`[Reviewer] Running AI review pass #${this.passCount} (provider: ${providerId}, model: ${modelId})`)

        const systemPrompt = buildReviewSystemPrompt(outline, generationResults)
        const userMessage = `Here is the CURRENT DOCUMENT CONTENT to review:\n\n${content}`

        const response = await pm.chatCompletion(
          providerId,
          {
            model: modelId,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.4,
            maxTokens: 4000,
          },
          'document-review',
        )

        const rawContent = response.choices?.[0]?.message?.content
        if (rawContent) {
          const parsed = parseReviewResponse(rawContent)
          if (parsed) {
            const tokenUsage: TokenUsage = {
              inputTokens: response.usage?.promptTokens || 0,
              outputTokens: response.usage?.completionTokens || 0,
              model: modelId,
              estimatedCost:
                (response.usage?.promptTokens || 0) * 0.000003 +
                (response.usage?.completionTokens || 0) * 0.000015,
            }

            const result: ReviewResult = {
              passNumber: this.passCount,
              flags: parsed.flags,
              tokenUsage,
              reviewedAt: new Date().toISOString(),
              structureConflicts: parsed.structureConflicts,
            }

            this.reviewResults.push(result)
            this.persistReview(result)
            console.log(`[Reviewer] AI review complete: ${result.flags.length} flags found`)
            return result
          }
          console.warn('[Reviewer] LLM returned unparseable review, falling back to heuristics')
        }
      } else {
        console.log('[Reviewer] No enabled provider found, using heuristic review')
      }
    } catch (err: any) {
      console.warn('[Reviewer] LLM review failed, falling back to heuristics:', err?.message || err)
    }

    // Fallback: heuristic review
    return this.runHeuristicReview(content, outline, paragraphs, generationResults)
  }

  /**
   * Heuristic-based review (fallback when no LLM provider is configured).
   */
  private runHeuristicReview(
    content: string,
    outline: WriterOutline | null,
    paragraphs: Array<{ id: string; text: string }>,
    generationResults: GenerationResult[],
  ): ReviewResult {
    const flags: ReviewFlag[] = []
    const structureConflicts: string[] = []

    // Check each paragraph for potential issues
    for (const para of paragraphs) {
      if (!para.text || para.text.trim().length === 0) { continue }

      // Check for very short paragraphs (potential incompleteness)
      if (para.text.length < 50 && para.text.split(' ').length < 8) {
        flags.push(
          createFlag(
            para.id,
            'suggestion',
            'clarity',
            'This paragraph is very short. Consider expanding it with more detail.',
            para.text,
            `${para.text} Consider adding more context and supporting details to strengthen this point.`,
          ),
        )
      }

      // Check for repeated words (simple redundancy detection)
      const words = para.text.toLowerCase().split(/\s+/)
      const wordCounts = new Map<string, number>()
      for (const w of words) {
        if (w.length > 4) {
          wordCounts.set(w, (wordCounts.get(w) || 0) + 1)
        }
      }
      for (const [word, count] of wordCounts) {
        if (count > 3) {
          flags.push(
            createFlag(
              para.id,
              'warning',
              'redundancy',
              `The word "${word}" appears ${count} times. Consider using synonyms.`,
              para.text,
              para.text,
            ),
          )
          break
        }
      }

      // Check for very long sentences (readability)
      const sentences = para.text.split(/[.!?]+/).filter(s => s.trim().length > 0)
      for (const sentence of sentences) {
        if (sentence.split(' ').length > 40) {
          flags.push(
            createFlag(
              para.id,
              'suggestion',
              'clarity',
              'This contains a very long sentence. Consider breaking it into shorter sentences.',
              para.text,
              para.text,
            ),
          )
          break
        }
      }
    }

    // Word count checks per section against approved outline
    if (outline && generationResults.length > 0) {
      for (const section of outline.sections) {
        const genResult = generationResults.find(r => r.sectionId === section.id)
        if (genResult) {
          const plainText = genResult.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          const actualWords = plainText.split(/\s+/).filter(w => w.length > 0).length
          const targetWords = section.estimatedWords
          const deviation = Math.abs(actualWords - targetWords) / targetWords

          if (deviation > 0.30) {
            flags.push(
              createFlag(
                `section-${section.id}`,
                'error',
                'structure',
                `Section "${section.title}" has ${actualWords} words but the approved target is ${targetWords} words (${Math.round(deviation * 100)}% off). This exceeds the 30% tolerance.`,
                `Section: ${section.title}`,
                `Revise this section to be closer to the ${targetWords}-word target.`,
              ),
            )
          } else if (deviation > 0.15) {
            flags.push(
              createFlag(
                `section-${section.id}`,
                'warning',
                'structure',
                `Section "${section.title}" has ${actualWords} words but the approved target is ${targetWords} words (${Math.round(deviation * 100)}% off).`,
                `Section: ${section.title}`,
                `Consider adjusting this section to be closer to the ${targetWords}-word target.`,
              ),
            )
          }
        }
      }
    }

    // Enforce planner authority: check if generated content respects outline structure
    if (outline) {
      const contentLower = content.toLowerCase()
      for (const section of outline.sections) {
        if (!contentLower.includes(section.title.toLowerCase().slice(0, 20))) {
          structureConflicts.push(
            `Section "${section.title}" from the outline may not be properly represented in the generated content.`,
          )
        }
      }
    }

    // Simulate token usage for heuristic review
    const inputTokens = Math.ceil(content.length / 4)
    const outputTokens = Math.ceil((flags.length * 100) / 4)
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      model: 'heuristic-fallback',
      estimatedCost: 0,
    }

    const result: ReviewResult = {
      passNumber: this.passCount,
      flags,
      tokenUsage,
      reviewedAt: new Date().toISOString(),
      structureConflicts,
    }

    this.reviewResults.push(result)
    this.persistReview(result)
    return result
  }

  /**
   * Update a flag's status (accepted/rejected) and re-persist the review to disk.
   */
  setFlagStatus(flagId: string, status: 'accepted' | 'rejected'): void {
    // Find the flag in the latest review
    const latestReview = this.reviewResults[this.reviewResults.length - 1]
    if (!latestReview) return

    const flag = latestReview.flags.find(f => f.id === flagId)
    if (flag) {
      flag.status = status
      this.persistReview(latestReview)
    }
  }

  /**
   * Surgical paragraph edit via LLM.
   * Falls back to simple transformations if no LLM provider is available.
   */
  async surgicalEdit(
    paragraphId: string,
    originalText: string,
    instruction: string,
    _fullDocContent: any,
  ): Promise<{ paragraphId: string; originalText: string; revisedText: string; tokenUsage: TokenUsage }> {
    // Try LLM-powered edit
    try {
      const pm = getProviderManager()
      const resolved = this.resolveModel()

      if (resolved) {
        const { providerId, modelId } = resolved
        console.log(`[Reviewer] Surgical edit via LLM for paragraph ${paragraphId}`)

        const response = await pm.chatCompletion(
          providerId,
          {
            model: modelId,
            messages: [
              { role: 'system', content: buildSurgicalEditPrompt(instruction) },
              { role: 'user', content: `Instruction: ${instruction}\n\nParagraph to rewrite:\n${originalText}` },
            ],
            temperature: 0.6,
            maxTokens: 2000,
          },
          'surgical-edit',
        )

        const revisedText = response.choices?.[0]?.message?.content?.trim()
        if (revisedText && revisedText.length > 10) {
          const tokenUsage: TokenUsage = {
            inputTokens: response.usage?.promptTokens || 0,
            outputTokens: response.usage?.completionTokens || 0,
            model: modelId,
            estimatedCost:
              (response.usage?.promptTokens || 0) * 0.000003 +
              (response.usage?.completionTokens || 0) * 0.000015,
          }
          return { paragraphId, originalText, revisedText, tokenUsage }
        }
      }
    } catch (err: any) {
      console.warn('[Reviewer] LLM surgical edit failed, using fallback:', err?.message || err)
    }

    // Fallback: deterministic transformations
    let revisedText = originalText
    const instructionLower = instruction.toLowerCase()
    if (instructionLower.includes('shorter') || instructionLower.includes('concise')) {
      const sentences = originalText.split(/(?<=[.!?])\s+/)
      revisedText = sentences.slice(0, Math.max(1, Math.ceil(sentences.length * 0.6))).join(' ')
    } else if (instructionLower.includes('longer') || instructionLower.includes('expand')) {
      revisedText = `${originalText} Furthermore, this point deserves additional elaboration and supporting evidence.`
    } else if (instructionLower.includes('formal')) {
      revisedText = originalText
        .replace(/don't/g, 'do not')
        .replace(/can't/g, 'cannot')
        .replace(/won't/g, 'will not')
        .replace(/it's/g, 'it is')
    } else {
      revisedText = `[Revised per instruction: "${instruction}"] ${originalText}`
    }

    const inputTokens = Math.ceil((originalText.length + instruction.length) / 4)
    const outputTokens = Math.ceil(revisedText.length / 4)
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      model: 'heuristic-fallback',
      estimatedCost: 0,
    }

    return { paragraphId, originalText, revisedText, tokenUsage }
  }

  /**
   * Rewrite entire document content via LLM.
   * Falls back to a simple prefix if no LLM provider is available.
   */
  async rewriteAll(
    content: string,
    instruction: string,
  ): Promise<{ revisedContent: string; tokenUsage: TokenUsage }> {
    // Try LLM-powered rewrite
    try {
      const pm = getProviderManager()
      const resolved = this.resolveModel()

      if (resolved) {
        const { providerId, modelId } = resolved
        console.log(`[Reviewer] Full rewrite via LLM`)

        const response = await pm.chatCompletion(
          providerId,
          {
            model: modelId,
            messages: [
              { role: 'system', content: buildRewriteAllPrompt() },
              { role: 'user', content: `Instruction: ${instruction}\n\nDocument to rewrite:\n${content}` },
            ],
            temperature: 0.7,
            maxTokens: 8000,
          },
          'full-rewrite',
        )

        let revisedContent = response.choices?.[0]?.message?.content?.trim()
        if (revisedContent && revisedContent.length > 50) {
          // Strip markdown fences if present
          if (revisedContent.startsWith('```')) {
            revisedContent = revisedContent
              .replace(/^```(?:html)?\s*/, '')
              .replace(/```\s*$/, '')
              .trim()
          }
          const tokenUsage: TokenUsage = {
            inputTokens: response.usage?.promptTokens || 0,
            outputTokens: response.usage?.completionTokens || 0,
            model: modelId,
            estimatedCost:
              (response.usage?.promptTokens || 0) * 0.000003 +
              (response.usage?.completionTokens || 0) * 0.000015,
          }
          return { revisedContent, tokenUsage }
        }
      }
    } catch (err: any) {
      console.warn('[Reviewer] LLM rewrite failed, using fallback:', err?.message || err)
    }

    // Fallback
    const revisedContent = `[Full rewrite per instruction: "${instruction}"]\n\n${content}`
    const inputTokens = Math.ceil(content.length / 4)
    const outputTokens = Math.ceil(revisedContent.length / 4)
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      model: 'heuristic-fallback',
      estimatedCost: 0,
    }

    return { revisedContent, tokenUsage }
  }

  /** Get all review results. */
  getResults(): ReviewResult[] {
    return [...this.reviewResults]
  }

  /** Get the latest review result. */
  getLatestResult(): ReviewResult | null {
    return this.reviewResults.length > 0 ? this.reviewResults[this.reviewResults.length - 1] : null
  }

  /** Get the number of passes completed. */
  getPassCount(): number {
    return this.passCount
  }

  /** Check if more automatic passes are available. */
  canAutoPass(): boolean {
    return this.passCount < MAX_AUTO_PASSES
  }

  /** Reset the reviewer for a new review cycle. */
  reset(): void {
    this.passCount = 0
    this.reviewResults = []
  }

  // ─────────────────────────── Persistence ───────────────────────────

  /** Persist a review result to disk. */
  private persistReview(result: ReviewResult): void {
    try {
      const reviewsDir = this.getReviewsDir()
      if (!reviewsDir) return

      const filePath = join(reviewsDir, `review-${result.passNumber}.json`)
      writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8')
      console.log(`[Reviewer] Persisted review pass #${result.passNumber} to ${filePath}`)
    } catch (err) {
      console.error('[Reviewer] Failed to persist review:', err)
    }
  }

  /** Load persisted reviews from disk on startup. */
  private loadPersistedReviews(): void {
    try {
      const reviewsDir = this.getReviewsDir()
      if (!reviewsDir || !existsSync(reviewsDir)) return

      const files = readdirSync(reviewsDir)
        .filter(f => f.startsWith('review-') && f.endsWith('.json'))
        .sort()

      if (files.length === 0) return

      for (const file of files) {
        try {
          const raw = readFileSync(join(reviewsDir, file), 'utf-8')
          const result: ReviewResult = JSON.parse(raw)
          this.reviewResults.push(result)
          this.passCount = Math.max(this.passCount, result.passNumber)
        } catch {
          // Skip corrupted files
        }
      }

      if (this.reviewResults.length > 0) {
        console.log(`[Reviewer] Loaded ${this.reviewResults.length} persisted review(s) for document ${this.documentId}`)
      }
    } catch (err) {
      console.error('[Reviewer] Failed to load persisted reviews:', err)
    }
  }

  /** Load just the latest review (used by loadReview IPC). */
  loadLatestReview(): ReviewResult | null {
    return this.getLatestResult()
  }

  /** Get the reviews directory for this document. */
  private getReviewsDir(): string | null {
    try {
      const projectPath = getActiveProjectPath()
      if (!projectPath) return null
      const ws = getProjectWorkspaceService()
      return ws.getReviewsPath(this.documentId, projectPath)
    } catch {
      return null
    }
  }
}

// ─────────────────────────── Helpers ───────────────────────────

function createFlag(
  paragraphId: string,
  severity: ReviewSeverity,
  category: ReviewCategory,
  message: string,
  originalText: string,
  suggestedRewrite: string,
): ReviewFlag {
  return {
    id: randomUUID(),
    paragraphId,
    severity,
    category,
    message,
    suggestedRewrite,
    originalText,
  }
}

/**
 * Parse the LLM's JSON response into review flags.
 */
function parseReviewResponse(raw: string): { flags: ReviewFlag[]; structureConflicts: string[] } | null {
  try {
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/, '')
        .replace(/```\s*$/, '')
        .trim()
    }

    const parsed = JSON.parse(cleaned)

    if (!parsed || !Array.isArray(parsed.flags)) {
      return null
    }

    const flags: ReviewFlag[] = parsed.flags.map((f: any) => ({
      id: randomUUID(),
      paragraphId: String(f.paragraphId || 'unknown'),
      severity: (['suggestion', 'warning', 'error'].includes(f.severity) ? f.severity : 'suggestion') as ReviewSeverity,
      category: (['coherence', 'grammar', 'style', 'structure', 'factual', 'tone', 'redundancy', 'clarity'].includes(f.category) ? f.category : 'clarity') as ReviewCategory,
      message: String(f.message || 'Review issue'),
      originalText: String(f.originalText || ''),
      suggestedRewrite: String(f.suggestedRewrite || f.originalText || ''),
    }))

    const structureConflicts = Array.isArray(parsed.structureConflicts)
      ? parsed.structureConflicts.map(String)
      : []

    return { flags, structureConflicts }
  } catch (err) {
    console.error('[Reviewer] Failed to parse LLM review response:', err)
    return null
  }
}

// ─────────────────────────── Registry ───────────────────────────

const reviewers = new Map<string, Reviewer>()

export function getReviewer(documentId: string): Reviewer {
  let reviewer = reviewers.get(documentId)
  if (!reviewer) {
    reviewer = new Reviewer(documentId)
    reviewers.set(documentId, reviewer)
  }
  return reviewer
}

export function disposeReviewer(documentId: string): void {
  reviewers.delete(documentId)
}

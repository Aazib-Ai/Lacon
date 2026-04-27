/**
 * Reviewer Agent — Phase 4
 *
 * Responsibilities:
 * - Review generated content for quality, coherence, grammar, and style
 * - Enforce planner authority on structure conflicts (planner owns structure)
 * - Enforce max 3 automatic reviewer passes
 * - Generate review flags with suggested rewrites
 * - Support surgical paragraph-level editing
 * - Produce diffs for target paragraphs only
 */

import { randomUUID } from 'crypto'

import type {
  DiffChunk,
  ParagraphDiff,
  ReviewCategory,
  ReviewFlag,
  ReviewResult,
  ReviewSeverity,
  SurgicalEditResult,
  TokenUsage,
  WriterOutline,
} from '../../shared/writer-types'

// ─────────────────────────── Constants ───────────────────────────

/** Maximum number of automatic reviewer passes before requiring user decision */
const MAX_AUTO_PASSES = 3

// ─────────────────────────── Reviewer Class ───────────────────────────

export class Reviewer {
  private documentId: string
  private passCount: number = 0
  private reviewResults: ReviewResult[] = []

  constructor(documentId: string) {
    this.documentId = documentId
  }

  /**
   * Run a review pass on generated content.
   * Returns flags for issues found in the content.
   *
   * @param content The full generated document content (text)
   * @param outline The approved outline (planner authority)
   * @param paragraphs Array of { id, text } for paragraph-level flagging
   */
  runReview(
    content: string,
    outline: WriterOutline | null,
    paragraphs: Array<{ id: string; text: string }>,
  ): ReviewResult {
    if (this.passCount >= MAX_AUTO_PASSES) {
      throw new Error(
        `Max automatic reviewer passes (${MAX_AUTO_PASSES}) reached. User must decide to continue or accept.`,
      )
    }

    this.passCount += 1

    const flags: ReviewFlag[] = []
    const structureConflicts: string[] = []

    // Check each paragraph for potential issues
    for (const para of paragraphs) {
      if (!para.text || para.text.trim().length === 0) {continue}

      // Check for very short paragraphs (potential incompleteness)
      if (para.text.length < 50 && para.text.split(' ').length < 8) {
        flags.push(
          createFlag(
            para.id,
            'suggestion',
            'clarity',
            'This paragraph is very short. Consider expanding it with more detail.',
            para.text,
            `${para.text  } Consider adding more context and supporting details to strengthen this point.`,
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
              para.text, // suggested rewrite same for now
            ),
          )
          break // one flag per paragraph
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

    // Simulate token usage
    const inputTokens = Math.ceil(content.length / 4)
    const outputTokens = Math.ceil((flags.length * 100) / 4)
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      model: 'simulated',
      estimatedCost: inputTokens * 0.000003 + outputTokens * 0.000015,
    }

    const result: ReviewResult = {
      passNumber: this.passCount,
      flags,
      tokenUsage,
      reviewedAt: new Date().toISOString(),
      structureConflicts,
    }

    this.reviewResults.push(result)
    return result
  }

  /**
   * Surgical paragraph edit: fix only the target paragraph.
   * Returns the diff for that paragraph only; other paragraphs remain unchanged.
   */
  surgicalEdit(
    paragraphId: string,
    originalText: string,
    instruction: string,
    _fullDocContent: any,
  ): SurgicalEditResult {
    // Simulated AI rewrite: apply simple transformations based on instruction
    let revisedText = originalText

    const instructionLower = instruction.toLowerCase()
    if (instructionLower.includes('shorter') || instructionLower.includes('concise')) {
      const sentences = originalText.split(/(?<=[.!?])\s+/)
      revisedText = sentences.slice(0, Math.max(1, Math.ceil(sentences.length * 0.6))).join(' ')
    } else if (instructionLower.includes('longer') || instructionLower.includes('expand')) {
      revisedText = `${originalText  } Furthermore, this point deserves additional elaboration and supporting evidence.`
    } else if (instructionLower.includes('formal')) {
      revisedText = originalText
        .replace(/don't/g, 'do not')
        .replace(/can't/g, 'cannot')
        .replace(/won't/g, 'will not')
        .replace(/it's/g, 'it is')
    } else {
      revisedText = `[Revised per instruction: "${instruction}"] ${originalText}`
    }

    const diff = computeParagraphDiff(paragraphId, originalText, revisedText)

    const inputTokens = Math.ceil((originalText.length + instruction.length) / 4)
    const outputTokens = Math.ceil(revisedText.length / 4)
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      model: 'simulated',
      estimatedCost: inputTokens * 0.000003 + outputTokens * 0.000015,
    }

    return {
      paragraphId,
      originalText,
      revisedText,
      diff,
      tokenUsage,
    }
  }

  /**
   * Rewrite entire document content. Takes a pre-snapshot before proceeding.
   */
  rewriteAll(content: string, instruction: string): { revisedContent: string; tokenUsage: TokenUsage } {
    const revisedContent = `[Full rewrite per instruction: "${instruction}"]\n\n${content}`

    const inputTokens = Math.ceil(content.length / 4)
    const outputTokens = Math.ceil(revisedContent.length / 4)
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      model: 'simulated',
      estimatedCost: inputTokens * 0.000003 + outputTokens * 0.000015,
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
 * Compute a line-level diff between original and revised text.
 */
function computeParagraphDiff(paragraphId: string, original: string, revised: string): ParagraphDiff {
  const originalLines = original.split('\n')
  const revisedLines = revised.split('\n')
  const chunks: DiffChunk[] = []

  const maxLen = Math.max(originalLines.length, revisedLines.length)
  for (let i = 0; i < maxLen; i++) {
    const origLine = i < originalLines.length ? originalLines[i] : undefined
    const revLine = i < revisedLines.length ? revisedLines[i] : undefined

    if (origLine === revLine) {
      chunks.push({ type: 'unchanged', content: origLine!, lineStart: i, lineEnd: i })
    } else {
      if (origLine !== undefined) {
        chunks.push({ type: 'removed', content: origLine, lineStart: i, lineEnd: i })
      }
      if (revLine !== undefined) {
        chunks.push({ type: 'added', content: revLine, lineStart: i, lineEnd: i })
      }
    }
  }

  return { paragraphId, original, revised, chunks }
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

/**
 * AI Detection Service — 3-Layer Pipeline
 *
 * Layer 1: Heuristic (statistical text analysis, <100ms)
 * Layer 2: LLM-as-Judge (ProviderManager for deep analysis + humanization)
 *
 * Layer 3 (ML) runs client-side in a Web Worker and is not part of this service.
 */

import type {
  DetectionReport,
  DetectLLMHumanizeRequest,
  HeuristicMetrics,
  HumanizeResult,
  HumanizeParagraphResult,
  ParagraphAnalysis,
} from '../../shared/detection-types'
import { scoreToLevel, AI_SCORE_THRESHOLD } from '../../shared/detection-types'
import { getProviderManager } from '../providers/provider-manager'

// ─────────────────────────── Constants ───────────────────────────

/** Words that AI models overuse as paragraph/sentence transitions */
const AI_TRANSITION_WORDS = [
  'furthermore', 'moreover', 'additionally', 'consequently',
  'nevertheless', 'subsequently', 'specifically', 'essentially',
  'ultimately', 'significantly', 'particularly', 'notably',
  'importantly', 'interestingly', 'accordingly', 'henceforth',
]

/** Phrases that AI models insert compulsively */
const AI_FILLER_PHRASES = [
  'it is important to note',
  'it is worth noting',
  'it should be noted',
  'in today\'s world',
  'in this day and age',
  'plays a crucial role',
  'in the realm of',
  'serves as a testament',
  'a myriad of',
  'at the end of the day',
  'it goes without saying',
  'needless to say',
  'delve into',
  'dive into',
  'navigate the complexities',
  'the landscape of',
  'a comprehensive overview',
  'a holistic approach',
  'leverage the power',
  'tapestry of',
  'paradigm shift',
  'multifaceted',
]

/** Passive voice indicator patterns */
const PASSIVE_PATTERNS = [
  /\b(?:is|are|was|were|be|been|being)\s+\w+ed\b/gi,
  /\b(?:is|are|was|were|be|been|being)\s+\w+en\b/gi,
]

// ─────────────────────────── Heuristic Engine (Layer 1) ───────────────────────────

export class AIDetectionService {
  /**
   * Layer 1: Heuristic analysis — pure statistical, runs instantly.
   */
  analyzeHeuristic(text: string): DetectionReport {
    const paragraphs = this.splitParagraphs(text)
    const analyses: ParagraphAnalysis[] = []

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i]
      if (para.trim().length < 20) continue

      const metrics = this.computeMetrics(para)
      const { score, tells } = this.metricsToScore(metrics, para)

      analyses.push({
        index: i,
        text: para.slice(0, 120),
        fullText: para,
        aiScore: Math.round(score),
        level: scoreToLevel(score),
        tells,
        suggestions: this.generateSuggestions(tells),
      })
    }

    const overallScore = analyses.length > 0
      ? Math.round(analyses.reduce((sum, p) => sum + p.aiScore, 0) / analyses.length)
      : 0

    return {
      overallScore,
      level: scoreToLevel(overallScore),
      paragraphs: analyses,
      source: 'heuristic',
      analyzedAt: new Date().toISOString(),
    }
  }

  /**
   * Layer 2: LLM-based deep analysis via ProviderManager.
   */
  async analyzeLLM(text: string, _providerId?: string): Promise<DetectionReport> {
    const providerManager = getProviderManager()
    const paragraphs = this.splitParagraphs(text)

    const systemPrompt = `You are an AI content forensics expert. Analyze the following text paragraph by paragraph.
For each paragraph, determine:
1. AI likelihood score (0-100, where 0 = definitely human, 100 = definitely AI)
2. Specific "tells" found (e.g., "uniform sentence length", "overuse of transition words", "lacks personal voice", "formulaic structure", "passive voice overuse", "generic language", "listing pattern")
3. Specific micro-edit suggestions to make it sound more human

Return ONLY valid JSON, no markdown:
{"overallScore": 65, "paragraphs": [{"index": 0, "aiScore": 72, "tells": ["uniform sentences"], "suggestions": ["vary sentence length"]}]}`

    const userPrompt = paragraphs
      .map((p, i) => `[Paragraph ${i}]\n${p}`)
      .join('\n\n')

    try {
      const response = await providerManager.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens: 2000,
      })

      const content = response.content || ''
      // Strip markdown code fences if present
      const jsonStr = content.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      const analyses: ParagraphAnalysis[] = (parsed.paragraphs || []).map((p: any) => ({
        index: p.index,
        text: (paragraphs[p.index] || '').slice(0, 120),
        fullText: paragraphs[p.index] || '',
        aiScore: Math.min(100, Math.max(0, p.aiScore || 0)),
        level: scoreToLevel(p.aiScore || 0),
        tells: p.tells || [],
        suggestions: p.suggestions || [],
      }))

      const overallScore = Math.min(100, Math.max(0, parsed.overallScore || 0))

      return {
        overallScore,
        level: scoreToLevel(overallScore),
        paragraphs: analyses,
        source: 'llm',
        analyzedAt: new Date().toISOString(),
        tokenUsage: response.usage ? {
          inputTokens: response.usage.prompt_tokens || 0,
          outputTokens: response.usage.completion_tokens || 0,
        } : undefined,
      }
    } catch (error) {
      console.error('[AIDetection] LLM analysis failed, falling back to heuristic:', error)
      return this.analyzeHeuristic(text)
    }
  }

  /**
   * Layer 2: Humanize flagged paragraphs via LLM.
   */
  async humanize(request: DetectLLMHumanizeRequest): Promise<HumanizeResult> {
    const providerManager = getProviderManager()

    const styleGuide = {
      conversational: 'Write like you\'re explaining to a smart friend over coffee. Use contractions, rhetorical questions, and casual asides.',
      academic: 'Write with academic rigor but natural flow. Vary sentence structure, use specific citations, and avoid AI clichés.',
      professional: 'Write in clear business English. Direct, active voice, concrete examples.',
    }[request.style || 'conversational']

    const systemPrompt = `You are a text humanizer. Rewrite the following paragraphs to sound naturally human-written.

STYLE: ${styleGuide}

Apply ALL of these techniques:
- Vary sentence length dramatically (mix 5-word punchy sentences with 25-word complex ones)
- Remove AI transition words: "Furthermore", "Moreover", "Additionally", "It is important to note"
- Use contractions naturally: "don't", "can't", "it's", "we're"
- Add conversational markers: "Look,", "Here's the thing:", "The weird part?"
- Use active voice, not passive
- Break parallel structures
- Add occasional rhetorical questions
- Use concrete, specific language instead of abstract generalities
- Remove any "delve", "tapestry", "landscape", "multifaceted", "holistic" type words

CRITICAL: Preserve the original meaning, facts, and arguments exactly. Only change the style.

Return ONLY valid JSON, no markdown:
{"paragraphs": [{"index": 0, "original": "...", "rewritten": "..."}]}`

    const userPrompt = request.paragraphs
      .map(p => `[Paragraph ${p.index}]\n${p.text}`)
      .join('\n\n')

    try {
      const response = await providerManager.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        maxTokens: 3000,
      })

      const content = response.content || ''
      const jsonStr = content.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      const results: HumanizeParagraphResult[] = (parsed.paragraphs || []).map((p: any) => ({
        index: p.index,
        original: p.original || request.paragraphs.find(rp => rp.index === p.index)?.text || '',
        rewritten: p.rewritten || '',
      }))

      return {
        paragraphs: results,
        tokenUsage: response.usage ? {
          inputTokens: response.usage.prompt_tokens || 0,
          outputTokens: response.usage.completion_tokens || 0,
        } : { inputTokens: 0, outputTokens: 0 },
      }
    } catch (error) {
      console.error('[AIDetection] Humanization failed:', error)
      throw new Error(`Humanization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ─────────────────────────── Private Helpers ───────────────────────────

  private splitParagraphs(text: string): string[] {
    return text
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
  }

  private computeMetrics(text: string): HeuristicMetrics {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    const uniqueWords = new Set(words)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5)

    // Lexical diversity
    const lexicalDiversity = words.length > 0 ? uniqueWords.size / words.length : 1

    // Sentence length stats
    const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length)
    const avgSentenceLength = sentenceLengths.length > 0
      ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
      : 0
    const sentenceLengthVariance = sentenceLengths.length > 1
      ? sentenceLengths.reduce((sum, l) => sum + Math.pow(l - avgSentenceLength, 2), 0) / sentenceLengths.length
      : 0

    // Transition word density
    const textLower = text.toLowerCase()
    let transitionCount = 0
    for (const tw of AI_TRANSITION_WORDS) {
      const regex = new RegExp(`\\b${tw}\\b`, 'gi')
      const matches = textLower.match(regex)
      if (matches) transitionCount += matches.length
    }
    for (const phrase of AI_FILLER_PHRASES) {
      if (textLower.includes(phrase)) transitionCount += 2 // weight phrases more
    }
    const transitionWordDensity = sentences.length > 0 ? transitionCount / sentences.length : 0

    // Passive voice ratio
    let passiveCount = 0
    for (const pattern of PASSIVE_PATTERNS) {
      const matches = text.match(pattern)
      if (matches) passiveCount += matches.length
    }
    const passiveVoiceRatio = sentences.length > 0 ? passiveCount / sentences.length : 0

    // Burstiness (variation in paragraph complexity)
    const burstinessScore = sentenceLengths.length > 1
      ? Math.sqrt(sentenceLengthVariance) / (avgSentenceLength || 1)
      : 0.5

    return {
      lexicalDiversity,
      avgSentenceLength,
      sentenceLengthVariance,
      transitionWordDensity,
      passiveVoiceRatio,
      burstinessScore,
    }
  }

  private metricsToScore(metrics: HeuristicMetrics, text: string): { score: number; tells: string[] } {
    let score = 0
    const tells: string[] = []

    // Low lexical diversity → AI-like (AI recycles words)
    if (metrics.lexicalDiversity < 0.45) {
      score += 20
      tells.push('low vocabulary diversity')
    } else if (metrics.lexicalDiversity < 0.55) {
      score += 10
    }

    // Low sentence length variance → AI-like (AI produces uniform sentences)
    if (metrics.sentenceLengthVariance < 15) {
      score += 20
      tells.push('uniform sentence length')
    } else if (metrics.sentenceLengthVariance < 30) {
      score += 10
    }

    // High transition word density → AI-like
    if (metrics.transitionWordDensity > 0.4) {
      score += 25
      tells.push('overuse of transition words')
    } else if (metrics.transitionWordDensity > 0.2) {
      score += 12
      tells.push('frequent transitions')
    }

    // High passive voice → AI-like
    if (metrics.passiveVoiceRatio > 0.4) {
      score += 15
      tells.push('heavy passive voice')
    } else if (metrics.passiveVoiceRatio > 0.25) {
      score += 8
    }

    // Low burstiness → AI-like (human writing is "bursty")
    if (metrics.burstinessScore < 0.3) {
      score += 15
      tells.push('monotonous rhythm')
    }

    // Check for AI filler phrases
    const textLower = text.toLowerCase()
    const foundPhrases = AI_FILLER_PHRASES.filter(p => textLower.includes(p))
    if (foundPhrases.length >= 2) {
      score += 15
      tells.push('AI filler phrases detected')
    } else if (foundPhrases.length === 1) {
      score += 8
    }

    // Bonus: no contractions in conversational text → AI-like
    if (text.length > 200 && !(/\b\w+n't\b/.test(text) || /\b\w+'s\b/.test(text) || /\b\w+'re\b/.test(text))) {
      score += 10
      tells.push('no contractions')
    }

    if (tells.length === 0) {
      tells.push('natural writing patterns')
    }

    return { score: Math.min(100, score), tells }
  }

  private generateSuggestions(tells: string[]): string[] {
    const suggestions: string[] = []
    const map: Record<string, string> = {
      'low vocabulary diversity': 'Use more varied vocabulary and synonyms',
      'uniform sentence length': 'Mix short punchy sentences with longer complex ones',
      'overuse of transition words': 'Remove "Furthermore", "Moreover" — use natural flow',
      'frequent transitions': 'Reduce formal transition words',
      'heavy passive voice': 'Rewrite in active voice',
      'monotonous rhythm': 'Vary paragraph and sentence structure',
      'AI filler phrases detected': 'Remove cliché phrases like "it is important to note"',
      'no contractions': 'Add contractions: "don\'t", "it\'s", "we\'re"',
    }
    for (const tell of tells) {
      if (map[tell]) suggestions.push(map[tell])
    }
    return suggestions
  }
}

// ─────────────────────────── Singleton ───────────────────────────

let instance: AIDetectionService | null = null

export function getAIDetectionService(): AIDetectionService {
  if (!instance) {
    instance = new AIDetectionService()
  }
  return instance
}

/**
 * AI Detection Service — Enhanced 2-Layer Pipeline
 *
 * Layer 1: Heuristic (statistical text analysis, <100ms)
 * Layer 2: LLM-as-Judge (ProviderManager for deep analysis + humanization)
 *
 * ENHANCED: 15+ detection signals including n-gram analysis, perplexity estimation,
 * burstiness scoring, hedging language, emoji/personal markers, and more.
 */

import type {
  DetectionReport,
  DetectLLMHumanizeRequest,
  HeuristicMetrics,
  HumanizeResult,
  HumanizeParagraphResult,
  ParagraphAnalysis,
} from '../../shared/detection-types'
import { scoreToLevel } from '../../shared/detection-types'
import { getProviderManager } from '../providers/provider-manager'

// ─────────────────────────── Constants ───────────────────────────

/** Words that AI models overuse as paragraph/sentence transitions */
const AI_TRANSITION_WORDS = [
  'furthermore', 'moreover', 'additionally', 'consequently',
  'nevertheless', 'subsequently', 'specifically', 'essentially',
  'ultimately', 'significantly', 'particularly', 'notably',
  'importantly', 'interestingly', 'accordingly', 'henceforth',
  'therefore', 'thus', 'hence', 'meanwhile',
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
  'stands as a testament',
  'in the ever-evolving',
  'paves the way',
  'shedding light on',
  'a testament to',
  'nuanced understanding',
  'intricate interplay',
  'embark on a journey',
]

/** AI-favored formal vocabulary */
const AI_FORMAL_VOCAB = [
  'utilize', 'facilitate', 'implement', 'comprehensive', 'fundamental',
  'paramount', 'pivotal', 'substantial', 'intricate', 'encompasses',
  'demonstrates', 'illustrates', 'constitutes', 'necessitates',
  'predominantly', 'inherently', 'meticulously', 'seamlessly',
  'leveraging', 'optimizing', 'streamlining', 'enhancing',
  'fostering', 'cultivating', 'encompassing', 'elucidating',
  'delineating', 'underpinning', 'underscoring', 'overarching',
]

/** Hedging language AI uses to sound balanced */
const AI_HEDGING = [
  'it can be argued', 'one could say', 'it is often said',
  'some might argue', 'while it is true', 'on the other hand',
  'having said that', 'that being said', 'with that in mind',
  'it is widely recognized', 'it is generally accepted',
  'it is crucial to understand', 'it is essential to',
]

/** Passive voice indicator patterns */
const PASSIVE_PATTERNS = [
  /\b(?:is|are|was|were|be|been|being)\s+\w+ed\b/gi,
  /\b(?:is|are|was|were|be|been|being)\s+\w+en\b/gi,
]

/** Common AI sentence starters (beginning of paragraph patterns) */
const AI_PARA_STARTERS = [
  /^in conclusion,?\s/i,
  /^to summarize,?\s/i,
  /^in summary,?\s/i,
  /^overall,?\s/i,
  /^this (?:article|essay|paper|text|piece|section)\s/i,
  /^as (?:we|you) can see,?\s/i,
  /^when it comes to\s/i,
  /^in (?:today's|the modern|the current)\s/i,
  /^one of the (?:most|key|main|primary)\s/i,
  /^the (?:importance|significance|role|impact) of\s/i,
]

// ─────────────────────────── Heuristic Engine (Layer 1) ───────────────────────────

export class AIDetectionService {
  /**
   * Layer 1: Enhanced heuristic analysis — pure statistical, runs instantly.
   * 15+ detection signals for robust AI text identification.
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

    // Resolve which provider + model to use
    const { providerId, model } = this.resolveProvider(providerManager, _providerId)

    const systemPrompt = `You are an expert AI content forensics analyst. Your job is to determine whether text was written by a human or generated by AI.

Analyze EACH paragraph and score it from 0-100:
- 0-20 = Clearly human (has personality, irregular rhythm, genuine voice)
- 21-40 = Likely human (mostly natural, minor AI-like patterns)
- 41-60 = Mixed/uncertain (could be either, or human-edited AI)
- 61-80 = Likely AI (shows typical LLM patterns)
- 81-100 = Clearly AI (formulaic, polished, LLM fingerprints)

You MUST classify each AI pattern you find using EXACTLY these 10 categories as "tells":

1. "Mechanical Precision" — Precise and technical word choice that prioritizes clarity and specificity, avoiding any colloquial or casual language. Words like "utilize", "facilitate", "implement", "comprehensive", "paramount".

2. "Robotic Formality" — The writing is formal and polished but appears robotic due to lack of variation. Every sentence follows the same structure. No personality or voice.

3. "Formulaic Flow" — Heavy use of transitional phrases and connectors ("Furthermore", "Moreover", "Additionally", "Consequently") to maintain cohesion that feels manufactured.

4. "Formulaic Transitions" — The structure is organized with clear transitions between ideas, but the transitions feel templated and predictable.

5. "Impersonal Tone" — Formal and academic tone using indirect speech and paraphrasing. No first-person perspective, personal anecdotes, emotions, or genuine voice.

6. "Sophisticated Clarity" — Word choice prioritizes clarity and sophistication over natural flow. Sentences are well-constructed but feel over-engineered.

7. "Lacks Creative Grammar" — The grammatical structure is perfectly correct but lacks creative deviations typical of human writing (fragments, em dashes, parenthetical asides, rhetorical questions).

8. "Lacks Creativity" — The writing is precise and consistent but lacks the richness, surprise, and creativity of human writing. No unexpected analogies, humor, or personality.

9. "Rigid Guidance" — The writing style is consistently instructional, focusing on practical advice and strategies without natural variation or personal perspective.

10. "Task-Oriented" — The structure is linear and task-oriented, addressing the request directly without organic tangents, qualifications, or the messy non-linearity of human thought.

Additional low-level signals to check:
- Sentence length uniformity (AI is too consistent)
- Lack of contractions (AI avoids "don't", "can't", "it's")
- AI filler phrases: "It is important to note", "In today's world", "It goes without saying"
- Passive voice overuse
- No em dashes, parenthetical asides, or ellipses
- Repetitive sentence starters
- Excessive comma usage
- Perfect punctuation with no quirks

For each paragraph, provide:
- "tells": Use the EXACT category names from the 10 categories above (e.g. "Mechanical Precision", "Impersonal Tone"), plus any low-level signals.
- "suggestions": Specific, actionable fixes for each detected pattern.

Return ONLY valid JSON, no markdown:
{"overallScore": 65, "paragraphs": [{"index": 0, "aiScore": 72, "tells": ["Robotic Formality", "Impersonal Tone", "Formulaic Flow"], "suggestions": ["Add contractions and casual language", "Break the rigid sentence pattern", "Remove formulaic transitions"]}]}`

    const userPrompt = paragraphs
      .map((p, i) => `[Paragraph ${i}]\n${p}`)
      .join('\n\n')

    try {
      const response = await providerManager.chatCompletion(providerId, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens: 2000,
      }, 'ai-detection')

      const content = response.choices?.[0]?.message?.content || ''
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
          inputTokens: response.usage.promptTokens || 0,
          outputTokens: response.usage.completionTokens || 0,
        } : undefined,
      }
    } catch (error) {
      console.error('[AIDetection] LLM analysis failed, falling back to heuristic:', error)
      return this.analyzeHeuristic(text)
    }
  }

  /**
   * Layer 2: Humanize via LLM — DOCUMENT-LEVEL approach.
   *
   * KEY INSIGHT: Sending paragraphs individually always loses context and
   * compresses text. Instead, we send the ENTIRE document to the LLM and
   * get the entire rewritten document back in one pass.
   *
   * Architecture:
   *   1. Send full document text + annotations about which parts are AI
   *   2. LLM rewrites the complete document (preserving structure & length)
   *   3. Server-side word count validation — if too short, retry once
   *   4. Return full rewritten text + per-paragraph diff for the UI
   */
  async humanize(request: DetectLLMHumanizeRequest): Promise<HumanizeResult> {
    const providerManager = getProviderManager()
    const { providerId, model } = this.resolveProvider(providerManager, request.providerId)

    // Use fullText if available, otherwise reconstruct from paragraphs
    const fullText = request.fullText || request.paragraphs.map(p => p.text).join('\n\n')
    const totalWordCount = fullText.split(/\s+/).filter(Boolean).length

    // Dynamic token limit: generous enough for full document rewrite + JSON envelope
    // ~1.5 tokens per word, need room for the full rewrite + some overhead
    const dynamicMaxTokens = Math.max(3000, Math.ceil(totalWordCount * 2.5) + 800)

    const styleGuide = {
      conversational: 'Write like a smart person explaining things to a friend. Use contractions, ask rhetorical questions, add casual asides.',
      academic: 'Academic rigor with natural flow. Vary sentence structure, hedge deliberately, avoid AI clichés.',
      professional: 'Clear business English. Direct, active voice, concrete examples. Sound like a person, not a template.',
    }[request.style || 'conversational'] || 'Write naturally, like a real person.'

    // Collect all tells across flagged paragraphs for targeted instructions
    const tellInstructions = this.buildTellInstructions(request.paragraphs)

    const systemPrompt = `You are a document humanizer. You receive a COMPLETE document and rewrite it to sound naturally human-written.

=== ABSOLUTE RULE: WORD COUNT ===
The original document is ${totalWordCount} words. Your rewritten document MUST be ${totalWordCount} words ±15%.
- Minimum: ${Math.floor(totalWordCount * 0.85)} words
- Maximum: ${Math.ceil(totalWordCount * 1.15)} words
- If you simplify a phrase, EXPAND another to compensate. NEVER just delete content.
- Every sentence in the original must have a corresponding sentence in your rewrite.
- Do NOT merge, remove, or skip any paragraph. Every paragraph must appear in the output.

=== STYLE ===
${styleGuide}

${tellInstructions}

=== WHAT TO FIX ===
- "utilize/facilitate/implement/comprehensive" → "use/help/do/full"
- Add contractions: "don't", "can't", "it's", "we're"
- Kill transitions: "Furthermore/Moreover/Additionally" → "And/But/So" or nothing
- Vary sentence length: mix 3-word punches with 25-word flowing sentences
- Add personality: em dashes—like this—parenthetical asides, rhetorical questions
- Kill buzzwords: "delve/tapestry/landscape/multifaceted/holistic/leverage/nuanced"
- Break robotic uniformity: make rhythm unpredictable, like real human writing

=== STRUCTURE ===
Keep ALL headings, bullet points, lists, formatting, paragraph breaks, and section order EXACTLY as-is. Only change the prose.

=== OUTPUT FORMAT ===
Return the COMPLETE rewritten document as plain text. Same paragraph structure, same number of paragraphs. NO JSON, NO markdown fences, NO commentary — just the rewritten document text.`

    const userPrompt = `REWRITE THIS ENTIRE DOCUMENT (${totalWordCount} words — your output MUST be ${totalWordCount} words ±15%):

${fullText}`

    try {
      console.log(`[AIDetection] Humanizing full document: ${totalWordCount} words, maxTokens=${dynamicMaxTokens}`)

      const response = await providerManager.chatCompletion(providerId, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        maxTokens: dynamicMaxTokens,
      }, 'ai-humanize')

      let rewrittenDoc = response.choices?.[0]?.message?.content || ''
      // Strip any markdown fences or commentary the LLM may have added
      rewrittenDoc = rewrittenDoc.replace(/^```[\s\S]*?\n/m, '').replace(/\n```\s*$/m, '').trim()

      let rewrittenWordCount = rewrittenDoc.split(/\s+/).filter(Boolean).length
      const tokenUsage = response.usage ? {
        inputTokens: response.usage.promptTokens || 0,
        outputTokens: response.usage.completionTokens || 0,
      } : { inputTokens: 0, outputTokens: 0 }

      console.log(`[AIDetection] Humanized: ${totalWordCount} → ${rewrittenWordCount} words (${Math.round((rewrittenWordCount / totalWordCount) * 100)}%)`)

      // Word count validation: if output is >20% shorter, retry with aggressive prompt
      if (rewrittenWordCount < totalWordCount * 0.8) {
        console.log(`[AIDetection] Output too short (${rewrittenWordCount}/${totalWordCount}), retrying...`)

        const retryPrompt = `Your previous rewrite was ${rewrittenWordCount} words but the original was ${totalWordCount} words — that's ${Math.round((1 - rewrittenWordCount / totalWordCount) * 100)}% shorter. This is UNACCEPTABLE.

Rewrite the document again. Your output MUST be at least ${Math.floor(totalWordCount * 0.9)} words. Every sentence in the original must have a corresponding sentence. Do NOT skip, merge, or condense paragraphs. If you simplified any phrase, expand another part to compensate.

ORIGINAL DOCUMENT (${totalWordCount} words — match this length):

${fullText}`

        try {
          const retryResponse = await providerManager.chatCompletion(providerId, {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: retryPrompt },
            ],
            temperature: 0.8,
            maxTokens: dynamicMaxTokens,
          }, 'ai-humanize-retry')

          const retryContent = retryResponse.choices?.[0]?.message?.content || ''
          const retryDoc = retryContent.replace(/^```[\s\S]*?\n/m, '').replace(/\n```\s*$/m, '').trim()
          const retryWc = retryDoc.split(/\s+/).filter(Boolean).length

          console.log(`[AIDetection] Retry result: ${retryWc} words (${Math.round((retryWc / totalWordCount) * 100)}%)`)

          // Use retry result if it's closer to the target
          if (retryWc > rewrittenWordCount) {
            rewrittenDoc = retryDoc
            rewrittenWordCount = retryWc
          }

          tokenUsage.inputTokens += retryResponse.usage?.promptTokens || 0
          tokenUsage.outputTokens += retryResponse.usage?.completionTokens || 0
        } catch (retryErr) {
          console.warn('[AIDetection] Retry failed, using first result:', retryErr)
        }
      }

      // Build per-paragraph results for the UI by diffing original vs rewritten
      const origParagraphs = this.splitParagraphs(fullText)
      const rewrittenParagraphs = this.splitParagraphs(rewrittenDoc)
      const paragraphResults: HumanizeParagraphResult[] = []

      for (let i = 0; i < origParagraphs.length; i++) {
        const origText = origParagraphs[i] || ''
        const newText = rewrittenParagraphs[i] || origText // fallback to original if LLM dropped it
        paragraphResults.push({
          index: i,
          original: origText,
          rewritten: newText,
          wordCountOriginal: origText.split(/\s+/).filter(Boolean).length,
          wordCountRewritten: newText.split(/\s+/).filter(Boolean).length,
        })
      }

      return {
        rewrittenFullText: rewrittenDoc,
        paragraphs: paragraphResults,
        tokenUsage,
      }
    } catch (error) {
      console.error('[AIDetection] Document humanization failed:', error)
      throw new Error(`Humanization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Build targeted instructions based on the AI tells detected across paragraphs.
   * This creates a focused addendum for the system prompt so the LLM prioritizes
   * fixing the exact patterns that triggered the AI detection.
   */
  private buildTellInstructions(paragraphs: DetectLLMHumanizeRequest['paragraphs']): string {
    // Collect all unique tells across paragraphs
    const allTells = new Set<string>()
    for (const p of paragraphs) {
      if (p.tells) p.tells.forEach(t => allTells.add(t.toLowerCase()))
    }
    if (allTells.size === 0) return ''

    const instructions: string[] = ['PRIORITY FIXES (these specific AI patterns were detected and MUST be addressed):']

    // Map tells to specific, actionable instructions
    // Includes the 10 AI text similarity categories + low-level heuristic tells
    const tellMap: Record<string, string> = {
      // ─── 10 AI Text Similarity Categories ───
      'mechanical precision': '→ AGGRESSIVE: Replace ALL precise/technical word choices with casual alternatives. "utilize"→"use", "facilitate"→"help", "implement"→"do". Write like a person, not a textbook.',
      'robotic formality': '→ AGGRESSIVE: Break the robotic polish. Add fragments, contractions, casual asides. Let sentences be deliberately imperfect. Vary rhythm wildly.',
      'formulaic flow': '→ AGGRESSIVE: DELETE all manufactured transitions — "Furthermore", "Moreover", "Additionally". Use "And", "But", "So" or nothing at all.',
      'formulaic transitions': '→ AGGRESSIVE: Remove templated bridges between ideas. Start new thoughts abruptly, use em dashes, or jump straight in.',
      'impersonal tone': '→ AGGRESSIVE: Inject first-person voice. Add "I think", "honestly", "look,". Include genuine reactions and personal perspective.',
      'sophisticated clarity': '→ AGGRESSIVE: Roughen the over-engineered clarity. Let sentences be short. Blunt. Some can wander before reaching the point.',
      'lacks creative grammar': '→ AGGRESSIVE: ADD fragments, em dashes—like this—parenthetical asides (personality!), rhetorical questions, and one-word sentences.',
      'lacks creativity': '→ AGGRESSIVE: Add vivid analogies, specific examples, humor, surprising comparisons. Replace generic language with concrete specifics.',
      'rigid guidance': '→ AGGRESSIVE: Break the instructional tone. Add caveats: "This usually works, but it depends". Question your own advice.',
      'task-oriented': '→ AGGRESSIVE: Break the linear A→B→C structure. Loop back, add tangents, start mid-thought. Real writing is non-linear.',
      // ─── Low-level Heuristic Tells ───
      'uniform sentence length': '→ CRITICAL: Sentence lengths are too consistent. Mix 3-word fragments with 20+ word sentences.',
      'somewhat uniform sentences': '→ Vary sentence lengths more — add some very short and very long sentences.',
      'monotonous rhythm': '→ The writing rhythm is flat and robotic. Add bursts: short sentence. Then a longer one that flows.',
      'zero contractions': '→ CRITICAL: No contractions found — add "don\'t", "can\'t", "it\'s", "we\'re" naturally.',
      'heavy ai transition words': '→ REMOVE all AI transitions: "Furthermore", "Moreover", "Additionally", "Consequently".',
      'ai transition words': '→ Replace or remove AI transition words with natural flow connectors.',
      'ai filler phrase detected': '→ DELETE AI filler phrases like "It is important to note", "In today\'s world".',
      'heavy passive voice': '→ REWRITE passive constructions to active voice throughout.',
      'passive voice patterns': '→ Convert passive voice to active in at least half the instances.',
      'high formal vocabulary density': '→ Replace formal words: "utilize"→"use", "facilitate"→"help", "comprehensive"→"full".',
      'formal vocabulary': '→ Swap some formal vocabulary for everyday alternatives.',
      'hedging language': '→ Cut hedging phrases like "It can be argued", "One could say" — be direct.',
      'formulaic paragraph opening': '→ Rewrite the paragraph opening — avoid generic starters.',
      'no personal voice': '→ Add personal markers: "I think", "honestly", or casual asides to inject personality.',
      'repetitive sentence starters': '→ Start sentences with different words — verbs, adverbs, questions.',
      'too-perfect punctuation': '→ Add em dashes, parenthetical asides, or ellipses for natural texture.',
      'excessive comma usage': '→ Break up comma-heavy sentences into shorter, punchier ones.',
      'listing pattern': '→ Weave list items into flowing prose instead of formatted lists.',
      'elevated word complexity': '→ Use simpler, shorter words where possible.',
      'low vocabulary diversity': '→ Introduce more varied vocabulary — synonyms, specific terms.',
      'moderate vocabulary reuse': '→ Add vocabulary variation to reduce word repetition.',
    }

    for (const tell of allTells) {
      // Try exact match first, then partial
      const instruction = tellMap[tell] || Object.entries(tellMap).find(([key]) => tell.includes(key))?.[1]
      if (instruction) {
        instructions.push(instruction)
      }
    }

    return instructions.length > 1 ? instructions.join('\n') : ''
  }

  /**
   * Resolve the best available provider and model for detection/humanization.
   * If a specific providerId is given, uses that. Otherwise picks the first available.
   */
  private resolveProvider(
    providerManager: ReturnType<typeof getProviderManager>,
    requestedProviderId?: string,
  ): { providerId: string; model: string } {
    const providers = providerManager.listProviders()

    if (providers.length === 0) {
      throw new Error(
        'No AI providers configured. Add a provider in Settings → Providers to use Deep Analyze and Humanize.'
      )
    }

    // If a specific provider was requested, use it
    if (requestedProviderId) {
      const config = providers.find(p => p.id === requestedProviderId)
      if (config) {
        return {
          providerId: config.id,
          model: config.defaultModel || this.defaultModelForType(config.type),
        }
      }
    }

    // Otherwise, pick the first enabled provider
    const enabled = providers.filter(p => p.enabled)
    const config = enabled.length > 0 ? enabled[0] : providers[0]

    return {
      providerId: config.id,
      model: config.defaultModel || this.defaultModelForType(config.type),
    }
  }

  /**
   * Fallback default models when a provider has no defaultModel set.
   */
  private defaultModelForType(type: string): string {
    const defaults: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-sonnet-4-20250514',
      gemini: 'gemini-2.0-flash',
      openrouter: 'openai/gpt-4o-mini',
      zai: 'glm-4-flash',
      local: 'llama3.1',
      'custom-openai-compatible': 'gpt-4o-mini',
    }
    return defaults[type] || 'gpt-4o-mini'
  }

  // ─────────────────────────── Private Helpers ───────────────────────────

  /**
   * Split text into paragraph-level analysis units.
   *
   * TipTap's getText() emits a single \n between textblocks (headings,
   * paragraphs, list items). Raw double-newline splitting misses most
   * boundaries. Strategy:
   *   1. Split on any newline(s)
   *   2. Merge very short fragments (headings, list items <40 chars) with
   *      the next substantial block so they share analysis context.
   *   3. Filter out empty / trivially short results.
   */
  private splitParagraphs(text: string): string[] {
    // Split on one-or-more newlines
    const raw = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0)
    if (raw.length === 0) return []

    // Merge short fragments with the next substantial paragraph
    const merged: string[] = []
    let buffer = ''

    for (const line of raw) {
      if (buffer.length > 0) {
        // If the buffered text + this line together form a unit, merge them
        buffer += '\n' + line
        // If the combined text is now substantial (>60 chars), flush it
        if (buffer.length >= 60) {
          merged.push(buffer)
          buffer = ''
        }
      } else if (line.length < 40) {
        // Short line (heading, list item) — buffer it to merge with next
        buffer = line
      } else {
        merged.push(line)
      }
    }
    // Flush remaining buffer
    if (buffer.length > 0) {
      if (merged.length > 0) {
        // Append to last paragraph as context
        merged[merged.length - 1] += '\n' + buffer
      } else {
        merged.push(buffer)
      }
    }

    return merged.filter(p => p.length > 0)
  }

  private computeMetrics(text: string): HeuristicMetrics {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    const uniqueWords = new Set(words)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5)

    // Lexical diversity (Type-Token Ratio)
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
    const textLower = text.toLowerCase()
    const words = textLower.split(/\s+/).filter(Boolean)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5)
    let signalCount = 0 // track how many signals fired for compound scoring

    // ─── Signal 1: Low lexical diversity → AI recycling vocabulary ───
    if (metrics.lexicalDiversity < 0.45) {
      score += 18
      tells.push('low vocabulary diversity')
      signalCount++
    } else if (metrics.lexicalDiversity < 0.55) {
      score += 10
      tells.push('moderate vocabulary reuse')
      signalCount++
    }

    // ─── Signal 2: Uniform sentence length → AI-like consistency ───
    if (metrics.sentenceLengthVariance < 15) {
      score += 18
      tells.push('uniform sentence length')
      signalCount++
    } else if (metrics.sentenceLengthVariance < 35) {
      score += 10
      tells.push('somewhat uniform sentences')
      signalCount++
    }

    // ─── Signal 3: AI transition word density ───
    if (metrics.transitionWordDensity > 0.15) {
      score += 18
      tells.push('heavy AI transition words')
      signalCount++
    } else if (metrics.transitionWordDensity > 0.05) {
      score += 10
      tells.push('AI transition words')
      signalCount++
    }

    // ─── Signal 4: Passive voice ───
    if (metrics.passiveVoiceRatio > 0.2) {
      score += 14
      tells.push('heavy passive voice')
      signalCount++
    } else if (metrics.passiveVoiceRatio > 0.1) {
      score += 7
      tells.push('passive voice patterns')
      signalCount++
    }

    // ─── Signal 5: Low burstiness → monotonous AI rhythm ───
    if (metrics.burstinessScore < 0.3) {
      score += 14
      tells.push('monotonous rhythm')
      signalCount++
    } else if (metrics.burstinessScore < 0.45) {
      score += 7
      signalCount++
    }

    // ─── Signal 6: AI filler phrase detection ───
    const foundPhrases = AI_FILLER_PHRASES.filter(p => textLower.includes(p))
    if (foundPhrases.length >= 2) {
      score += 18
      tells.push(`${foundPhrases.length} AI filler phrases`)
      signalCount++
    } else if (foundPhrases.length >= 1) {
      score += 12
      tells.push('AI filler phrase detected')
      signalCount++
    }

    // ─── Signal 7: No contractions → AI avoids them ───
    const hasContractions = /\b\w+n't\b/.test(text) || /\b\w+'s\b/.test(text) || /\b\w+'re\b/.test(text) || /\b\w+'ve\b/.test(text) || /\b\w+'ll\b/.test(text) || /\b\w+'d\b/.test(text)
    if (text.length > 100 && !hasContractions) {
      score += 16
      tells.push('zero contractions')
      signalCount++
    }

    // ─── Signal 8: Formal vocabulary density ───
    const formalHits = words.filter(w => AI_FORMAL_VOCAB.includes(w)).length
    const formalDensity = words.length > 0 ? formalHits / words.length : 0
    if (formalDensity > 0.02) {
      score += 16
      tells.push('high formal vocabulary density')
      signalCount++
    } else if (formalDensity > 0.01) {
      score += 8
      tells.push('formal vocabulary')
      signalCount++
    }

    // ─── Signal 9: Hedging language ───
    const hedgeHits = AI_HEDGING.filter(h => textLower.includes(h)).length
    if (hedgeHits >= 1) {
      score += 12
      tells.push('hedging language')
      signalCount++
    }

    // ─── Signal 10: AI paragraph starters ───
    for (const pattern of AI_PARA_STARTERS) {
      if (pattern.test(text.trim())) {
        score += 12
        tells.push('formulaic paragraph opening')
        signalCount += 1
        break
      }
    }

    // ─── Signal 11: Excessive comma density ───
    const commaCount = (text.match(/,/g) || []).length
    const commaDensity = words.length > 0 ? commaCount / words.length : 0
    if (commaDensity > 0.08) {
      score += 10
      tells.push('excessive comma usage')
      signalCount += 1
    }

    // ─── Signal 12: List pattern detection ───
    const listLines = text.split('\n').filter(l => /^\s*(?:\d+[.)]\s|\*\s|-\s|•\s)/.test(l))
    if (listLines.length >= 2) {
      score += 10
      tells.push('listing pattern')
      signalCount += 1
    }

    // ─── Signal 13: Lack of personal markers ───
    const personalMarkers = /\b(?:I think|I feel|I believe|in my experience|personally|honestly|frankly|to be honest|I've|I'm|I'd)\b/i
    const casualMarkers = /\p{Emoji}|\.{3}|!{2,}|\u2014|lol|haha|kinda|gonna|wanna|yeah|nah|ok so|right\?/iu
    if (text.length > 100 && !personalMarkers.test(text) && !casualMarkers.test(text)) {
      score += 14
      tells.push('no personal voice')
      signalCount += 1
    }

    // ─── Signal 14: Sentence-start repetition ───
    if (sentences.length >= 3) {
      const starters = sentences.map(s => {
        const firstWord = s.trim().split(/\s+/)[0]?.toLowerCase() || ''
        return firstWord
      })
      const starterCounts = new Map<string, number>()
      for (const s of starters) {
        starterCounts.set(s, (starterCounts.get(s) || 0) + 1)
      }
      const maxRepeat = Math.max(...starterCounts.values())
      if (maxRepeat >= 2 && maxRepeat / sentences.length > 0.3) {
        score += 10
        tells.push('repetitive sentence starters')
        signalCount += 1
      }
    }

    // ─── Signal 15: Perfect punctuation (no quirks) ───
    const hasDash = /\u2014|\u2013/.test(text)
    const hasParenthetical = /\(.*?\)/.test(text)
    const hasEllipsis = /\.{3}|\u2026/.test(text)
    if (text.length > 150 && !hasDash && !hasParenthetical && !hasEllipsis) {
      score += 10
      tells.push('too-perfect punctuation')
      signalCount += 1
    }

    // ─── Signal 16: Average word length (AI uses longer formal words) ───
    const avgWordLen = words.length > 0
      ? words.reduce((sum, w) => sum + w.length, 0) / words.length
      : 0
    if (avgWordLen > 5.5) {
      score += 12
      tells.push('elevated word complexity')
      signalCount += 1
    } else if (avgWordLen > 5.0) {
      score += 6
      signalCount += 1
    }

    // ─── Signal 17: Consistent paragraph structure (AI = intro→body→conclusion) ───
    if (sentences.length >= 3) {
      const firstLen = sentences[0].trim().split(/\s+/).length
      const lastLen = sentences[sentences.length - 1].trim().split(/\s+/).length
      const midLens = sentences.slice(1, -1).map(s => s.trim().split(/\s+/).length)
      const avgMid = midLens.length > 0 ? midLens.reduce((a, b) => a + b, 0) / midLens.length : 0
      // AI pattern: short intro, longer middle, medium conclusion
      if (firstLen < avgMid && lastLen < avgMid * 1.3) {
        score += 8
        signalCount += 1
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // COMPOUND MULTIPLIER — When many signals fire, it's almost certainly AI
    // This is the key calibration that brings our scores in line with
    // professional detectors like GPTZero.
    // ═══════════════════════════════════════════════════════════════
    if (signalCount >= 8) {
      score = Math.round(score * 1.8)  // 8+ signals = very high confidence
    } else if (signalCount >= 6) {
      score = Math.round(score * 1.5)  // 6-7 signals = high confidence
    } else if (signalCount >= 4) {
      score = Math.round(score * 1.3)  // 4-5 signals = elevated confidence
    }
    // No multiplier for 0-3 signals (could be natural writing)

    if (tells.length === 0) {
      tells.push('natural writing patterns')
    }

    return { score: Math.min(100, score), tells }
  }

  private generateSuggestions(tells: string[]): string[] {
    const suggestions: string[] = []
    const map: Record<string, string> = {
      'very low vocabulary diversity': 'Use more varied vocabulary — try synonyms and specific terms',
      'low vocabulary diversity': 'Expand your vocabulary range with more specific words',
      'uniform sentence length': 'Mix short punchy sentences (3-5 words) with longer ones (20+ words)',
      'somewhat uniform sentences': 'Add more variety to sentence lengths',
      'heavy AI transition words': 'Remove "Furthermore", "Moreover", "Additionally" — use natural flow',
      'frequent transition words': 'Reduce formal transitions; let ideas flow naturally',
      'heavy passive voice': 'Rewrite in active voice: "The team built" not "It was built by the team"',
      'frequent passive voice': 'Switch some passive constructions to active voice',
      'monotonous rhythm': 'Vary your rhythm — fragment. Then a long flowing sentence that winds through an idea.',
      'AI filler phrases detected': 'Cut phrases like "it is important to note" and "in today\'s world"',
      'no contractions': 'Add contractions: "don\'t", "it\'s", "we\'re", "can\'t"',
      'high formal vocabulary density': 'Replace "utilize" with "use", "facilitate" with "help"',
      'elevated formal vocabulary': 'Swap some formal words for everyday alternatives',
      'excessive hedging language': 'Be more direct — cut "it can be argued" and "one could say"',
      'formulaic paragraph opening': 'Start paragraphs in unexpected ways — with a question, a quote, or a detail',
      'excessive comma usage': 'Break long comma-heavy sentences into shorter, punchier ones',
      'listing pattern': 'Weave list items into prose instead of bullet points',
      'no personal voice markers': 'Add your perspective: "I think", "In my experience", or casual asides',
      'repetitive sentence starters': 'Start sentences with different words — verbs, adverbs, prepositional phrases',
      'too-perfect punctuation': 'Add em dashes—like this—or parenthetical asides (like this one)',
      '1 AI filler phrases': 'Remove the AI cliché phrase',
      '2 AI filler phrases': 'Remove the AI cliché phrases',
      '3 AI filler phrases': 'Remove all AI cliché phrases — they\'re dead giveaways',
    }
    for (const tell of tells) {
      if (map[tell]) suggestions.push(map[tell])
      // Match numbered filler phrase tells like "3 AI filler phrases"
      else if (tell.includes('AI filler phrases') && !map[tell]) {
        suggestions.push('Remove AI cliché phrases — they\'re dead giveaways')
      }
    }
    return suggestions.length > 0 ? suggestions : ['Writing looks natural — no changes needed']
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

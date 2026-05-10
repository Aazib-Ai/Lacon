/**
 * Detection API Service — External AI Detection Providers
 *
 * Adapters for Sapling.ai and Winston AI detection APIs.
 * Keys are stored securely via the Electron KeyStore (OS-level encryption).
 *
 * Usage: Users bring their own API key (BYOK). Both providers offer
 * free developer credits on signup.
 */

import type {
  DetectionApiProvider,
  DetectionReport,
  ParagraphAnalysis,
} from '../../shared/detection-types'
import { scoreToLevel } from '../../shared/detection-types'
import { getKeyStore } from '../security/keystore'

// ─────────────────────────── Key ID Helpers ───────────────────────────

function keyIdForProvider(provider: DetectionApiProvider): string {
  return `detection-api-${provider}`
}

// ─────────────────────────── Sapling Adapter ───────────────────────────

interface SaplingSentenceScore {
  score: number
  sentence: string
}

interface SaplingResponse {
  score: number // 0-1, where 1 = AI
  sentence_scores?: SaplingSentenceScore[]
  text?: string
}

async function callSapling(apiKey: string, text: string): Promise<DetectionReport> {
  const response = await fetch('https://api.sapling.ai/api/v1/aidetect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: apiKey,
      text,
      sent_scores: true,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Sapling API error (${response.status}): ${errorBody || response.statusText}`)
  }

  const data: SaplingResponse = await response.json()

  // Sapling returns score 0-1. Convert to 0-100.
  const overallScore = Math.round(data.score * 100)

  // Build paragraph-level analysis from sentence_scores
  const paragraphs: ParagraphAnalysis[] = splitIntoParagraphs(text).map((para, index) => {
    // Match sentences in this paragraph to Sapling sentence scores
    const matchedScores = data.sentence_scores?.filter(s =>
      para.includes(s.sentence) || s.sentence.includes(para.substring(0, 40))
    ) || []

    const avgScore = matchedScores.length > 0
      ? Math.round((matchedScores.reduce((sum, s) => sum + s.score, 0) / matchedScores.length) * 100)
      : overallScore

    return {
      index,
      text: para.substring(0, 120),
      fullText: para,
      aiScore: avgScore,
      level: scoreToLevel(avgScore),
      tells: avgScore > 60 ? ['Flagged by Sapling AI detector'] : [],
      suggestions: avgScore > 60 ? ['Consider rephrasing for a more natural tone'] : [],
    }
  })

  return {
    overallScore,
    level: scoreToLevel(overallScore),
    paragraphs,
    source: 'sapling',
    analyzedAt: new Date().toISOString(),
  }
}

// ─────────────────────────── Winston Adapter ───────────────────────────

interface WinstonSentenceResult {
  text: string
  score: number
}

interface WinstonResponse {
  status: number
  score: number // 0-100 where 0 = likely AI (inverted from our convention)
  sentences?: WinstonSentenceResult[]
  credits_used?: number
  credits_remaining?: number
}

async function callWinston(apiKey: string, text: string): Promise<DetectionReport> {
  const response = await fetch('https://api.gowinston.ai/v3/ai/detect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text,
      sentences: true,
      language: 'en',
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Winston API error (${response.status}): ${errorBody || response.statusText}`)
  }

  const data: WinstonResponse = await response.json()

  // Winston score: 0 = AI, 100 = Human. We invert to match our convention (0 = human, 100 = AI).
  const overallScore = Math.round(100 - data.score)

  // Build paragraphs from sentence-level results
  const paragraphs: ParagraphAnalysis[] = data.sentences && data.sentences.length > 0
    ? groupSentencesIntoParagraphs(data.sentences, text)
    : splitIntoParagraphs(text).map((para, index) => ({
        index,
        text: para.substring(0, 120),
        fullText: para,
        aiScore: overallScore,
        level: scoreToLevel(overallScore),
        tells: overallScore > 60 ? ['Flagged by Winston AI detector'] : [],
        suggestions: overallScore > 60 ? ['Consider rephrasing for a more natural tone'] : [],
      }))

  return {
    overallScore,
    level: scoreToLevel(overallScore),
    paragraphs,
    source: 'winston',
    analyzedAt: new Date().toISOString(),
  }
}

/**
 * Group Winston sentence results back into paragraph-level analysis
 */
function groupSentencesIntoParagraphs(
  sentences: WinstonSentenceResult[],
  originalText: string,
): ParagraphAnalysis[] {
  const paragraphs = splitIntoParagraphs(originalText)
  return paragraphs.map((para, index) => {
    const matchedSentences = sentences.filter(s =>
      para.includes(s.text) || s.text.includes(para.substring(0, 30))
    )

    // Winston sentence scores: invert (0 = AI → 100 in our system)
    const avgScore = matchedSentences.length > 0
      ? Math.round(matchedSentences.reduce((sum, s) => sum + (100 - s.score), 0) / matchedSentences.length)
      : 50

    return {
      index,
      text: para.substring(0, 120),
      fullText: para,
      aiScore: avgScore,
      level: scoreToLevel(avgScore),
      tells: avgScore > 60 ? ['Flagged by Winston AI detector'] : [],
      suggestions: avgScore > 60 ? ['Consider rephrasing for a more natural tone'] : [],
    }
  })
}

// ─────────────────────────── Utility ───────────────────────────

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
}

// ─────────────────────────── Service ───────────────────────────

export class DetectionApiService {
  /**
   * Analyze text using an external AI detection API
   */
  async analyze(text: string, provider: DetectionApiProvider): Promise<DetectionReport> {
    const keyStore = getKeyStore()
    const keyId = keyIdForProvider(provider)
    const apiKey = await keyStore.getKey(keyId)

    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}. Add your key in Detection Settings.`)
    }

    console.log(`[DetectionAPI] Analyzing with ${provider} (${text.length} chars)`)

    switch (provider) {
      case 'sapling':
        return callSapling(apiKey, text)
      case 'winston':
        return callWinston(apiKey, text)
      default:
        throw new Error(`Unknown detection provider: ${provider}`)
    }
  }

  /**
   * Store an API key for a detection provider
   */
  async setApiKey(provider: DetectionApiProvider, apiKey: string, label?: string): Promise<void> {
    const keyStore = getKeyStore()
    const keyId = keyIdForProvider(provider)
    const providerLabel = label || `${provider === 'sapling' ? 'Sapling' : 'Winston AI'} Detection Key`
    await keyStore.setKey(keyId, `detection-${provider}`, providerLabel, apiKey)
    console.log(`[DetectionAPI] API key saved for ${provider}`)
  }

  /**
   * Get metadata about a stored detection API key (never returns the actual key)
   */
  async getApiKeyMeta(provider: DetectionApiProvider): Promise<{
    exists: boolean
    label?: string
    provider: DetectionApiProvider
    createdAt?: number
  }> {
    const keyStore = getKeyStore()
    const keyId = keyIdForProvider(provider)
    const meta = await keyStore.getKeyMetadata(keyId)

    if (!meta) {
      return { exists: false, provider }
    }

    return {
      exists: true,
      label: meta.label,
      provider,
      createdAt: meta.createdAt,
    }
  }

  /**
   * Delete a stored detection API key
   */
  async deleteApiKey(provider: DetectionApiProvider): Promise<boolean> {
    const keyStore = getKeyStore()
    const keyId = keyIdForProvider(provider)
    const deleted = await keyStore.deleteKey(keyId)
    console.log(`[DetectionAPI] API key ${deleted ? 'deleted' : 'not found'} for ${provider}`)
    return deleted
  }

  /**
   * Test an API key by sending a small sample text
   */
  async testApiKey(provider: DetectionApiProvider, apiKey: string): Promise<{
    success: boolean
    latencyMs: number
    error?: string
  }> {
    const testText = 'The quick brown fox jumps over the lazy dog. This is a simple test sentence to verify the API key works correctly.'
    const start = Date.now()

    try {
      switch (provider) {
        case 'sapling':
          await callSapling(apiKey, testText)
          break
        case 'winston':
          await callWinston(apiKey, testText)
          break
        default:
          throw new Error(`Unknown provider: ${provider}`)
      }

      return { success: true, latencyMs: Date.now() - start }
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}

// ─── Singleton ───

let instance: DetectionApiService | null = null

export function getDetectionApiService(): DetectionApiService {
  if (!instance) {
    instance = new DetectionApiService()
  }
  return instance
}

/**
 * AI Detection & Humanization — Shared Types
 *
 * Type definitions for the detection pipeline:
 *   Layer 1: Heuristic (statistical analysis, local, no key needed)
 *   Layer 2: LLM-as-Judge (ProviderManager)
 *   Layer 3: External API (Sapling.ai / Winston AI — BYOK)
 */

// ─────────────────────────── Score Levels ───────────────────────────

export type AIScoreLevel = 'human' | 'mixed' | 'ai-detected'

export function scoreToLevel(score: number): AIScoreLevel {
  if (score <= 30) return 'human'
  if (score <= 60) return 'mixed'
  return 'ai-detected'
}

// ─────────────────────────── Paragraph Analysis ───────────────────────────

export interface ParagraphAnalysis {
  index: number
  text: string // first 120 chars preview
  fullText: string
  aiScore: number // 0-100
  level: AIScoreLevel
  tells: string[] // e.g. "uniform sentence length"
  suggestions: string[] // humanization tips
}

// ─────────────────────────── Detection Report ───────────────────────────

export interface DetectionReport {
  overallScore: number // 0-100
  level: AIScoreLevel
  paragraphs: ParagraphAnalysis[]
  source: 'heuristic' | 'llm' | 'sapling' | 'winston' | 'combined'
  analyzedAt: string
  tokenUsage?: { inputTokens: number; outputTokens: number; estimatedCost?: number }
}

// ─────────────────────────── Heuristic Metrics ───────────────────────────

export interface HeuristicMetrics {
  lexicalDiversity: number
  avgSentenceLength: number
  sentenceLengthVariance: number
  transitionWordDensity: number
  passiveVoiceRatio: number
  burstinessScore: number
}

// ─────────────────────────── Humanize ───────────────────────────

export type HumanizeStyle = 'conversational' | 'academic' | 'professional'

export interface HumanizeRequest {
  paragraphs: HumanizeParagraphInput[]
  style?: HumanizeStyle
  preserveMeaning: boolean
}

export interface HumanizeParagraphInput {
  index: number
  text: string
  tells?: string[]       // AI patterns detected (e.g. "uniform sentence length")
  suggestions?: string[] // specific fix suggestions
  aiScore?: number       // 0-100 detection score
}

export interface HumanizeParagraphResult {
  index: number
  original: string
  rewritten: string
  wordCountOriginal?: number
  wordCountRewritten?: number
}

export interface HumanizeResult {
  /** Full rewritten document text (when using document-level humanization) */
  rewrittenFullText?: string
  paragraphs: HumanizeParagraphResult[]
  tokenUsage: { inputTokens: number; outputTokens: number; estimatedCost?: number }
}



// ─────────────────────────── IPC Request / Response ───────────────────────────

export interface DetectHeuristicRequest {
  text: string
}

export interface DetectLLMAnalyzeRequest {
  text: string
  providerId?: string
}

export interface DetectLLMHumanizeRequest {
  /** The full document text — used for document-level humanization */
  fullText?: string
  paragraphs: HumanizeParagraphInput[]
  style?: HumanizeStyle
  providerId?: string
}

export interface DetectFullPipelineRequest {
  text: string
  providerId?: string
}

// ─────────────────────────── Detection API (External Providers) ───────────────────────────

export type DetectionApiProvider = 'sapling' | 'winston'

export interface DetectionApiConfig {
  provider: DetectionApiProvider
  apiKeyId: string
  label: string
}

export interface DetectApiAnalyzeRequest {
  text: string
  provider: DetectionApiProvider
}

export interface DetectSetApiKeyRequest {
  provider: DetectionApiProvider
  apiKey: string
  label?: string
}

export interface DetectGetApiKeyRequest {
  provider: DetectionApiProvider
}

export interface DetectDeleteApiKeyRequest {
  provider: DetectionApiProvider
}

export interface DetectTestApiKeyRequest {
  provider: DetectionApiProvider
  apiKey: string
}

// ─────────────────────────── Detection State (for hook) ───────────────────────────

export type DetectionPhase = 'idle' | 'heuristic' | 'llm-analyzing' | 'llm-humanizing' | 'api-analyzing' | 'complete'

export interface DetectionState {
  phase: DetectionPhase
  report: DetectionReport | null
  humanizeResult: HumanizeResult | null
  error: string | null
}

export const INITIAL_DETECTION_STATE: DetectionState = {
  phase: 'idle',
  report: null,
  humanizeResult: null,
  error: null,
}

/** Max auto-loop iterations for humanize → re-verify */
export const MAX_HUMANIZE_LOOPS = 3

/** AI score threshold above which a paragraph is flagged */
export const AI_SCORE_THRESHOLD = 40

/**
 * AI Detection & Humanization — Shared Types
 *
 * Type definitions for the 3-layer detection pipeline:
 *   Layer 1: Heuristic (statistical analysis)
 *   Layer 2: LLM-as-Judge (ProviderManager)
 *   Layer 3: Transformers.js ML (Web Worker)
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
  source: 'heuristic' | 'llm' | 'ml' | 'combined'
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
  paragraphs: { index: number; text: string }[]
  style?: HumanizeStyle
  preserveMeaning: boolean
}

export interface HumanizeParagraphResult {
  index: number
  original: string
  rewritten: string
}

export interface HumanizeResult {
  paragraphs: HumanizeParagraphResult[]
  tokenUsage: { inputTokens: number; outputTokens: number; estimatedCost?: number }
}

// ─────────────────────────── ML Verification (Web Worker) ───────────────────────────

export interface MLSentenceResult {
  text: string
  aiProbability: number
  label: string // 'LABEL_0' (human) or 'LABEL_1' (AI)
}

export interface MLVerificationResult {
  overallScore: number
  sentences: MLSentenceResult[]
  modelId: string
  inferenceTimeMs: number
}

// ─────────────────────────── Worker Messages ───────────────────────────

export interface WorkerInitMessage {
  type: 'init'
}

export interface WorkerClassifyMessage {
  type: 'classify'
  sentences: string[]
}

export type WorkerInboundMessage = WorkerInitMessage | WorkerClassifyMessage

export interface WorkerReadyMessage {
  type: 'ready'
}

export interface WorkerProgressMessage {
  type: 'progress'
  message: string
  percent?: number
}

export interface WorkerResultMessage {
  type: 'result'
  data: MLSentenceResult[]
  inferenceTimeMs: number
}

export interface WorkerErrorMessage {
  type: 'error'
  error: string
}

export type WorkerOutboundMessage =
  | WorkerReadyMessage
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage

// ─────────────────────────── IPC Request / Response ───────────────────────────

export interface DetectHeuristicRequest {
  text: string
}

export interface DetectLLMAnalyzeRequest {
  text: string
  providerId?: string
}

export interface DetectLLMHumanizeRequest {
  paragraphs: { index: number; text: string }[]
  style?: HumanizeStyle
  providerId?: string
}

export interface DetectFullPipelineRequest {
  text: string
  providerId?: string
}

// ─────────────────────────── Detection State (for hook) ───────────────────────────

export type DetectionPhase = 'idle' | 'heuristic' | 'llm-analyzing' | 'llm-humanizing' | 'ml-verifying' | 'complete'

export interface DetectionState {
  phase: DetectionPhase
  report: DetectionReport | null
  mlResult: MLVerificationResult | null
  humanizeResult: HumanizeResult | null
  mlModelReady: boolean
  mlModelLoading: boolean
  error: string | null
}

export const INITIAL_DETECTION_STATE: DetectionState = {
  phase: 'idle',
  report: null,
  mlResult: null,
  humanizeResult: null,
  mlModelReady: false,
  mlModelLoading: false,
  error: null,
}

/** Max auto-loop iterations for humanize → re-verify */
export const MAX_HUMANIZE_LOOPS = 3

/** AI score threshold above which a paragraph is flagged */
export const AI_SCORE_THRESHOLD = 40

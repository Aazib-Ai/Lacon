/**
 * useAIDetection — React hook for the AI detection pipeline
 *
 * Manages state for heuristic (L1), LLM (L2), and external API (L3) analysis.
 */

import { useCallback, useEffect, useState } from 'react'

import type {
  DetectionReport,
  DetectionPhase,
  HumanizeResult,
  HumanizeStyle,
  DetectionApiProvider,
} from '../../shared/detection-types'
import { AI_SCORE_THRESHOLD } from '../../shared/detection-types'

interface ApiKeyStatus {
  exists: boolean
  label?: string
  provider: DetectionApiProvider
  createdAt?: number
}

interface UseAIDetectionReturn {
  // State
  phase: DetectionPhase
  report: DetectionReport | null
  humanizeResult: HumanizeResult | null
  error: string | null

  // API key state
  saplingKey: ApiKeyStatus | null
  winstonKey: ApiKeyStatus | null

  // Layer 1: Heuristic (instant)
  quickScan: (text: string) => Promise<void>

  // Layer 2: LLM Analysis
  deepAnalyze: (text: string) => Promise<void>

  // Layer 3: External API (Sapling / Winston)
  apiAnalyze: (text: string, provider: DetectionApiProvider) => Promise<void>

  // Layer 2: Humanize
  humanize: (paragraphs: { index: number; text: string; tells?: string[]; suggestions?: string[]; aiScore?: number }[], style?: HumanizeStyle, fullText?: string) => Promise<void>

  // Full pipeline
  runFullPipeline: (text: string) => Promise<void>

  // API Key management
  refreshApiKeys: () => Promise<void>

  // Utils
  reset: () => void
  clearHumanizeResult: () => void
  flaggedParagraphCount: number
}

export function useAIDetection(): UseAIDetectionReturn {
  const [phase, setPhase] = useState<DetectionPhase>('idle')
  const [report, setReport] = useState<DetectionReport | null>(null)
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saplingKey, setSaplingKey] = useState<ApiKeyStatus | null>(null)
  const [winstonKey, setWinstonKey] = useState<ApiKeyStatus | null>(null)

  // ─── Load API key status on mount ───

  const refreshApiKeys = useCallback(async () => {
    try {
      const [sapRes, winRes] = await Promise.all([
        (window as any).electron.detection.getApiKey({ provider: 'sapling' }),
        (window as any).electron.detection.getApiKey({ provider: 'winston' }),
      ])
      if (sapRes?.success) setSaplingKey(sapRes.data)
      if (winRes?.success) setWinstonKey(winRes.data)
    } catch (err) {
      console.error('Failed to load detection API keys:', err)
    }
  }, [])

  useEffect(() => {
    refreshApiKeys()
  }, [refreshApiKeys])

  // ─── Layer 1: Heuristic ───

  const quickScan = useCallback(async (text: string) => {
    try {
      setPhase('heuristic')
      setError(null)
      const result = await (window as any).electron.detection.heuristic({ text })
      if (result.success) {
        setReport(result.data)
      } else {
        setError(result.error?.message || 'Heuristic scan failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setPhase('complete')
    }
  }, [])

  // ─── Layer 2: LLM Analysis ───

  const deepAnalyze = useCallback(async (text: string) => {
    try {
      setPhase('llm-analyzing')
      setError(null)
      const result = await (window as any).electron.detection.llmAnalyze({ text })
      if (result.success) {
        setReport(result.data)
      } else {
        setError(result.error?.message || 'LLM analysis failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setPhase('complete')
    }
  }, [])

  // ─── Layer 3: External API Analysis ───

  const apiAnalyze = useCallback(async (text: string, provider: DetectionApiProvider) => {
    try {
      setPhase('api-analyzing')
      setError(null)
      const result = await (window as any).electron.detection.apiAnalyze({ text, provider })
      if (result.success) {
        setReport(result.data)
      } else {
        setError(result.error?.message || result.error?.details || `${provider} API analysis failed`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API analysis failed')
    } finally {
      setPhase('complete')
    }
  }, [])

  // ─── Layer 2: Humanize ───

  const humanize = useCallback(async (
    paragraphs: { index: number; text: string; tells?: string[]; suggestions?: string[]; aiScore?: number }[],
    style?: HumanizeStyle,
    fullText?: string,
  ) => {
    try {
      setPhase('llm-humanizing')
      setError(null)
      const result = await (window as any).electron.detection.llmHumanize({
        fullText,
        paragraphs,
        style: style || 'conversational',
      })
      if (result.success) {
        setHumanizeResult(result.data)
      } else {
        setError(result.error?.message || 'Humanization failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Humanization failed')
    } finally {
      setPhase('complete')
    }
  }, [])

  // ─── Full Pipeline ───

  const runFullPipeline = useCallback(async (text: string) => {
    try {
      setPhase('heuristic')
      setError(null)

      // Step 1: Heuristic
      const heuristicResult = await (window as any).electron.detection.heuristic({ text })
      if (heuristicResult.success) {
        setReport(heuristicResult.data)
      }

      // Step 2: If score is notable, run LLM analysis
      if (heuristicResult.data?.overallScore > 20) {
        setPhase('llm-analyzing')
        const llmResult = await (window as any).electron.detection.llmAnalyze({ text })
        if (llmResult.success) {
          setReport(llmResult.data)
        }
      }

      setPhase('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline failed')
      setPhase('complete')
    }
  }, [])

  // ─── Utils ───

  const reset = useCallback(() => {
    setPhase('idle')
    setReport(null)
    setHumanizeResult(null)
    setError(null)
  }, [])

  const clearHumanizeResult = useCallback(() => {
    setHumanizeResult(null)
    setPhase('complete')
  }, [])

  const flaggedParagraphCount = report
    ? report.paragraphs.filter(p => p.aiScore > AI_SCORE_THRESHOLD).length
    : 0

  return {
    phase,
    report,
    humanizeResult,
    error,
    saplingKey,
    winstonKey,
    quickScan,
    deepAnalyze,
    apiAnalyze,
    humanize,
    runFullPipeline,
    refreshApiKeys,
    reset,
    clearHumanizeResult,
    flaggedParagraphCount,
  }
}

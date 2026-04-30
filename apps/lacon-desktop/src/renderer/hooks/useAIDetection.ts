/**
 * useAIDetection — React hook for the 3-layer AI detection pipeline
 *
 * Manages state for heuristic (L1), LLM (L2), and ML (L3) analysis.
 * L3 runs in a Web Worker for non-blocking ML inference.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  DetectionReport,
  DetectionPhase,
  HumanizeResult,
  HumanizeStyle,
  MLVerificationResult,
  MLSentenceResult,
  WorkerOutboundMessage,
} from '../../shared/detection-types'
import { AI_SCORE_THRESHOLD, scoreToLevel } from '../../shared/detection-types'

interface UseAIDetectionReturn {
  // State
  phase: DetectionPhase
  report: DetectionReport | null
  mlResult: MLVerificationResult | null
  humanizeResult: HumanizeResult | null
  mlModelReady: boolean
  mlModelLoading: boolean
  mlProgress: string
  error: string | null

  // Layer 1: Heuristic (instant)
  quickScan: (text: string) => Promise<void>

  // Layer 2: LLM Analysis
  deepAnalyze: (text: string) => Promise<void>

  // Layer 2: Humanize
  humanize: (paragraphs: { index: number; text: string }[], style?: HumanizeStyle) => Promise<void>

  // Layer 3: ML Verification
  initMLModel: () => void
  verifyWithML: (text: string) => Promise<void>

  // Full pipeline
  runFullPipeline: (text: string) => Promise<void>

  // Utils
  reset: () => void
  flaggedParagraphCount: number
}

export function useAIDetection(): UseAIDetectionReturn {
  const [phase, setPhase] = useState<DetectionPhase>('idle')
  const [report, setReport] = useState<DetectionReport | null>(null)
  const [mlResult, setMlResult] = useState<MLVerificationResult | null>(null)
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null)
  const [mlModelReady, setMlModelReady] = useState(false)
  const [mlModelLoading, setMlModelLoading] = useState(false)
  const [mlProgress, setMlProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const mlResolveRef = useRef<((result: MLVerificationResult) => void) | null>(null)
  const mlRejectRef = useRef<((error: Error) => void) | null>(null)

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

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

  // ─── Layer 2: Humanize ───

  const humanize = useCallback(async (
    paragraphs: { index: number; text: string }[],
    style?: HumanizeStyle,
  ) => {
    try {
      setPhase('llm-humanizing')
      setError(null)
      const result = await (window as any).electron.detection.llmHumanize({
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

  // ─── Layer 3: ML Model ───

  const initMLModel = useCallback(() => {
    if (workerRef.current || mlModelReady) return

    setMlModelLoading(true)
    setMlProgress('Starting model download...')

    try {
      const worker = new Worker(
        new URL('../workers/ai-detection-worker.ts', import.meta.url),
        { type: 'module' },
      )

      worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
        const msg = event.data

        if (msg.type === 'ready') {
          setMlModelReady(true)
          setMlModelLoading(false)
          setMlProgress('')
        } else if (msg.type === 'progress') {
          setMlProgress(msg.message)
        } else if (msg.type === 'result') {
          const data = msg.data as MLSentenceResult[]
          const avgScore = data.length > 0
            ? Math.round(data.reduce((s, r) => s + r.aiProbability, 0) / data.length)
            : 0

          const result: MLVerificationResult = {
            overallScore: avgScore,
            sentences: data,
            modelId: 'roberta-base-openai-detector',
            inferenceTimeMs: msg.inferenceTimeMs,
          }
          setMlResult(result)
          setPhase('complete')
          mlResolveRef.current?.(result)
          mlResolveRef.current = null
        } else if (msg.type === 'error') {
          const errorMsg = msg.error
          setError(errorMsg)
          setMlModelLoading(false)
          setPhase('complete')
          mlRejectRef.current?.(new Error(errorMsg))
          mlRejectRef.current = null
        }
      }

      worker.onerror = (err) => {
        setError(`Worker error: ${err.message}`)
        setMlModelLoading(false)
      }

      workerRef.current = worker
      worker.postMessage({ type: 'init' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ML worker')
      setMlModelLoading(false)
    }
  }, [mlModelReady])

  const verifyWithML = useCallback(async (text: string) => {
    if (!workerRef.current || !mlModelReady) {
      setError('ML model not loaded. Click "Load Model" first.')
      return
    }

    setPhase('ml-verifying')
    setError(null)

    // Split text into sentences
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 10)

    return new Promise<void>((resolve, reject) => {
      mlResolveRef.current = () => resolve()
      mlRejectRef.current = (err) => reject(err)
      workerRef.current!.postMessage({ type: 'classify', sentences })
    })
  }, [mlModelReady])

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
    setMlResult(null)
    setHumanizeResult(null)
    setError(null)
  }, [])

  const flaggedParagraphCount = report
    ? report.paragraphs.filter(p => p.aiScore > AI_SCORE_THRESHOLD).length
    : 0

  return {
    phase,
    report,
    mlResult,
    humanizeResult,
    mlModelReady,
    mlModelLoading,
    mlProgress,
    error,
    quickScan,
    deepAnalyze,
    humanize,
    initMLModel,
    verifyWithML,
    runFullPipeline,
    reset,
    flaggedParagraphCount,
  }
}

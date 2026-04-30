/**
 * AI Detection IPC Handlers
 *
 * Bridge between renderer process and AIDetectionService.
 * Follows the exact pattern established in handlers.ts.
 */

import { ipcMain } from 'electron'

import type {
  DetectHeuristicRequest,
  DetectLLMAnalyzeRequest,
  DetectLLMHumanizeRequest,
  DetectFullPipelineRequest,
} from '../../shared/detection-types'
import { scoreToLevel } from '../../shared/detection-types'
import type { IpcResponse } from '../../shared/ipc-schema'
import { IPC_CHANNELS } from '../../shared/ipc-schema'
import { getAIDetectionService } from '../services/ai-detection-service'

/**
 * Register AI detection IPC handlers
 */
export function registerDetectionHandlers(): void {
  const service = getAIDetectionService()

  // Layer 1: Heuristic analysis (instant)
  ipcMain.handle(IPC_CHANNELS.DETECT_HEURISTIC, async (_event, payload: DetectHeuristicRequest) => {
    return handleDetection('detect:heuristic', payload, async () => {
      if (!payload?.text || typeof payload.text !== 'string') {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Text is required' } }
      }
      const report = service.analyzeHeuristic(payload.text)
      return { success: true, data: report }
    })
  })

  // Layer 2: LLM-based deep analysis
  ipcMain.handle(IPC_CHANNELS.DETECT_LLM_ANALYZE, async (_event, payload: DetectLLMAnalyzeRequest) => {
    return handleDetection('detect:llmAnalyze', payload, async () => {
      if (!payload?.text || typeof payload.text !== 'string') {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Text is required' } }
      }
      const report = await service.analyzeLLM(payload.text, payload.providerId)
      return { success: true, data: report }
    })
  })

  // Layer 2: LLM humanization
  ipcMain.handle(IPC_CHANNELS.DETECT_LLM_HUMANIZE, async (_event, payload: DetectLLMHumanizeRequest) => {
    return handleDetection('detect:llmHumanize', payload, async () => {
      if (!payload?.paragraphs || !Array.isArray(payload.paragraphs) || payload.paragraphs.length === 0) {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Paragraphs array is required' } }
      }
      const result = await service.humanize(payload)
      return { success: true, data: result }
    })
  })

  // Full pipeline: Layer 1 → Layer 2
  ipcMain.handle(IPC_CHANNELS.DETECT_FULL_PIPELINE, async (_event, payload: DetectFullPipelineRequest) => {
    return handleDetection('detect:fullPipeline', payload, async () => {
      if (!payload?.text || typeof payload.text !== 'string') {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Text is required' } }
      }

      // Step 1: Quick heuristic
      const heuristicReport = service.analyzeHeuristic(payload.text)

      // If heuristic says it's clearly human, skip LLM
      if (heuristicReport.overallScore < 20) {
        return { success: true, data: { ...heuristicReport, source: 'combined' as const } }
      }

      // Step 2: Deep LLM analysis
      try {
        const llmReport = await service.analyzeLLM(payload.text, payload.providerId)
        // Blend scores: 30% heuristic + 70% LLM
        const blendedParagraphs = llmReport.paragraphs.map(llmP => {
          const heuP = heuristicReport.paragraphs.find(h => h.index === llmP.index)
          const blendedScore = heuP
            ? Math.round(heuP.aiScore * 0.3 + llmP.aiScore * 0.7)
            : llmP.aiScore
          return {
            ...llmP,
            aiScore: blendedScore,
            level: scoreToLevel(blendedScore),
            tells: [...new Set([...(heuP?.tells || []), ...llmP.tells])],
          }
        })

        const overallScore = blendedParagraphs.length > 0
          ? Math.round(blendedParagraphs.reduce((s, p) => s + p.aiScore, 0) / blendedParagraphs.length)
          : 0

        return {
          success: true,
          data: {
            overallScore,
            level: scoreToLevel(overallScore),
            paragraphs: blendedParagraphs,
            source: 'combined' as const,
            analyzedAt: new Date().toISOString(),
            tokenUsage: llmReport.tokenUsage,
          },
        }
      } catch {
        // Fallback to heuristic if LLM fails
        return { success: true, data: heuristicReport }
      }
    })
  })

  console.log('[IPC] AI Detection handlers registered')
}

/**
 * Generic handler wrapper with logging and error handling
 */
async function handleDetection<T>(
  channel: string,
  payload: any,
  handler: () => Promise<IpcResponse<T>>,
): Promise<IpcResponse<T>> {
  try {
    console.log(`[Detection] ${channel}`, payload ? '(has payload)' : '(no payload)')
    const response = await handler()
    console.log(`[Detection] ${channel} -> ${response.success ? 'success' : 'failed'}`)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Detection] ${channel} error:`, message)
    return {
      success: false,
      error: {
        code: 'DETECTION_ERROR',
        message: 'AI detection failed',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    }
  }
}

/**
 * AI Detection IPC Handlers
 *
 * Bridge between renderer process and AIDetectionService + DetectionApiService.
 * Follows the exact pattern established in handlers.ts.
 */

import { ipcMain } from 'electron'

import type {
  DetectHeuristicRequest,
  DetectLLMAnalyzeRequest,
  DetectLLMHumanizeRequest,
  DetectFullPipelineRequest,
  DetectApiAnalyzeRequest,
  DetectSetApiKeyRequest,
  DetectGetApiKeyRequest,
  DetectDeleteApiKeyRequest,
  DetectTestApiKeyRequest,
} from '../../shared/detection-types'
import { scoreToLevel } from '../../shared/detection-types'
import type { IpcResponse } from '../../shared/ipc-schema'
import { IPC_CHANNELS } from '../../shared/ipc-schema'
import { getAIDetectionService } from '../services/ai-detection-service'
import { getDetectionApiService } from '../services/detection-api-service'

/**
 * Register AI detection IPC handlers
 */
export function registerDetectionHandlers(): void {
  const service = getAIDetectionService()
  const apiService = getDetectionApiService()

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

  // ─── External API Detection (Sapling / Winston) ───

  // Analyze text via external detection API
  ipcMain.handle(IPC_CHANNELS.DETECT_API_ANALYZE, async (_event, payload: DetectApiAnalyzeRequest) => {
    return handleDetection('detect:apiAnalyze', payload, async () => {
      if (!payload?.text || typeof payload.text !== 'string') {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Text is required' } }
      }
      if (!payload?.provider) {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Provider is required' } }
      }
      const report = await apiService.analyze(payload.text, payload.provider)
      return { success: true, data: report }
    })
  })

  // Store an API key for a detection provider
  ipcMain.handle(IPC_CHANNELS.DETECT_SET_API_KEY, async (_event, payload: DetectSetApiKeyRequest) => {
    return handleDetection('detect:setApiKey', payload, async () => {
      if (!payload?.provider || !payload?.apiKey) {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Provider and API key are required' } }
      }
      await apiService.setApiKey(payload.provider, payload.apiKey, payload.label)
      return { success: true, data: true }
    })
  })

  // Get stored key metadata (never returns the actual secret)
  ipcMain.handle(IPC_CHANNELS.DETECT_GET_API_KEY, async (_event, payload: DetectGetApiKeyRequest) => {
    return handleDetection('detect:getApiKey', payload, async () => {
      if (!payload?.provider) {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Provider is required' } }
      }
      const meta = await apiService.getApiKeyMeta(payload.provider)
      return { success: true, data: meta }
    })
  })

  // Delete a stored API key
  ipcMain.handle(IPC_CHANNELS.DETECT_DELETE_API_KEY, async (_event, payload: DetectDeleteApiKeyRequest) => {
    return handleDetection('detect:deleteApiKey', payload, async () => {
      if (!payload?.provider) {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Provider is required' } }
      }
      const deleted = await apiService.deleteApiKey(payload.provider)
      return { success: true, data: deleted }
    })
  })

  // Test an API key before saving
  ipcMain.handle(IPC_CHANNELS.DETECT_TEST_API_KEY, async (_event, payload: DetectTestApiKeyRequest) => {
    return handleDetection('detect:testApiKey', payload, async () => {
      if (!payload?.provider || !payload?.apiKey) {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Provider and API key are required' } }
      }
      const result = await apiService.testApiKey(payload.provider, payload.apiKey)
      return { success: true, data: result }
    })
  })

  console.log('[IPC] AI Detection handlers registered (heuristic + LLM + API)')
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

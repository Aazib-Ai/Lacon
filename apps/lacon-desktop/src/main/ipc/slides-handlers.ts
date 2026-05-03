/**
 * Slides IPC Handlers
 *
 * Registers IPC handlers for slide generation, saving, loading, and PPTX export.
 * Follows the same handleIpc pattern used in writer-loop-handlers.ts.
 */

import { ipcMain } from 'electron'

import { type IpcResponse, IPC_CHANNELS } from '@/shared/ipc-schema'
import type {
  SlidesGenerateRequest,
  SlidesGenerateResponse,
  SlidesSaveRequest,
  SlidesLoadRequest,
  SlidesExportPptxRequest,
  SlideDeck,
} from '@/shared/slides-types'

import { redactObject } from '../security/log-redaction'
import { getSlidesService } from '../services/slides-service'

/**
 * Generic handler wrapper (same pattern as writer-loop-handlers.ts)
 */
async function handleSlidesIpc<T>(
  channel: string,
  payload: any,
  handler: () => Promise<IpcResponse<T>>,
): Promise<IpcResponse<T>> {
  try {
    console.log(`[IPC] ${channel}`, redactObject(payload))
    const response = await handler()
    console.log(`[IPC] ${channel} -> success`)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[IPC] ${channel} error:`, message)
    return {
      success: false,
      error: {
        code: 'SLIDES_ERROR',
        message,
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    }
  }
}

/**
 * Register all slides IPC handlers.
 * Call this from the main process initialization.
 */
export function registerSlidesHandlers(): void {
  const service = getSlidesService()

  // ── slides:generate ──
  ipcMain.handle(
    IPC_CHANNELS.SLIDES_GENERATE,
    async (_event, payload: SlidesGenerateRequest) => {
      return handleSlidesIpc(IPC_CHANNELS.SLIDES_GENERATE, payload, async () => {
        const result = await service.generate(payload)
        return { success: true, data: result }
      })
    },
  )

  // ── slides:save ──
  ipcMain.handle(
    IPC_CHANNELS.SLIDES_SAVE,
    async (_event, payload: SlidesSaveRequest) => {
      return handleSlidesIpc(IPC_CHANNELS.SLIDES_SAVE, payload, async () => {
        const filePath = await service.save(payload.documentId, payload.deck)
        return { success: true, data: { filePath } }
      })
    },
  )

  // ── slides:load ──
  ipcMain.handle(
    IPC_CHANNELS.SLIDES_LOAD,
    async (_event, payload: SlidesLoadRequest) => {
      return handleSlidesIpc(IPC_CHANNELS.SLIDES_LOAD, payload, async () => {
        const deck = await service.load(payload.documentId)
        return { success: true, data: deck }
      })
    },
  )

  // ── slides:exportPptx ──
  ipcMain.handle(
    IPC_CHANNELS.SLIDES_EXPORT_PPTX,
    async (_event, payload: SlidesExportPptxRequest) => {
      return handleSlidesIpc(IPC_CHANNELS.SLIDES_EXPORT_PPTX, payload, async () => {
        const filePath = await service.exportPptx(payload)
        return { success: true, data: { filePath } }
      })
    },
  )

  console.log('[IPC] Slides handlers registered')
}

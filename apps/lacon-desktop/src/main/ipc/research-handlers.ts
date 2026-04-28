/**
 * Research & Citation IPC Handlers — Phase 5
 *
 * Registers IPC handlers for research log and citation operations:
 * - research:getLog         — Get full research log
 * - research:addEntry       — Add a research entry
 * - research:updateEntry    — Update an existing entry
 * - research:deleteEntry    — Delete an entry
 * - research:setMode        — Set research mode (auto/supervised/manual)
 * - research:importFile     — Import a file as research
 * - research:factCheck      — Fact-check a section
 * - citation:format         — Format a citation
 * - citation:getStyle       — Get current citation style
 * - citation:setStyle       — Set citation style
 */

import { ipcMain } from 'electron'

import { type IpcResponse, IPC_CHANNELS } from '@/shared/ipc-schema'

import { redactObject } from '../security/log-redaction'
import { getCitationService } from '../services/citation-service'
import { getResearchLogService } from '../services/research-log-service'

/**
 * Generic handler wrapper (same pattern as writer-loop-handlers.ts)
 */
async function handleResearchIpc<T>(
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
        code: 'RESEARCH_ERROR',
        message,
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    }
  }
}

/**
 * Register all research and citation IPC handlers.
 */
export function registerResearchHandlers(): void {
  const researchService = getResearchLogService()
  const citationService = getCitationService()

  // ── research:getLog ──
  ipcMain.handle(IPC_CHANNELS.RESEARCH_GET_LOG, async (_event, payload: { documentId: string }) => {
    return handleResearchIpc(IPC_CHANNELS.RESEARCH_GET_LOG, payload, async () => {
      const log = researchService.getLog(payload.documentId)
      return { success: true, data: log }
    })
  })

  // ── research:addEntry ──
  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_ADD_ENTRY,
    async (
      _event,
      payload: {
        documentId: string
        query: string
        sources?: any[]
        excerpts?: string[]
        linkedSectionIds?: string[]
        tags?: string[]
      },
    ) => {
      return handleResearchIpc(IPC_CHANNELS.RESEARCH_ADD_ENTRY, payload, async () => {
        const entry = researchService.addEntry(
          payload.documentId,
          payload.query,
          payload.sources,
          payload.excerpts,
          payload.linkedSectionIds,
          payload.tags,
        )
        return { success: true, data: entry }
      })
    },
  )

  // ── research:updateEntry ──
  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_UPDATE_ENTRY,
    async (_event, payload: { documentId: string; entryId: string; updates: any }) => {
      return handleResearchIpc(IPC_CHANNELS.RESEARCH_UPDATE_ENTRY, payload, async () => {
        const entry = researchService.updateEntry(payload.documentId, payload.entryId, payload.updates)
        return { success: true, data: entry }
      })
    },
  )

  // ── research:deleteEntry ──
  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_DELETE_ENTRY,
    async (_event, payload: { documentId: string; entryId: string }) => {
      return handleResearchIpc(IPC_CHANNELS.RESEARCH_DELETE_ENTRY, payload, async () => {
        researchService.deleteEntry(payload.documentId, payload.entryId)
        return { success: true, data: null }
      })
    },
  )

  // ── research:setMode ──
  ipcMain.handle(IPC_CHANNELS.RESEARCH_SET_MODE, async (_event, payload: { documentId: string; mode: any }) => {
    return handleResearchIpc(IPC_CHANNELS.RESEARCH_SET_MODE, payload, async () => {
      const log = researchService.setMode(payload.documentId, payload.mode)
      return { success: true, data: log }
    })
  })

  // ── research:importFile ──
  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_IMPORT_FILE,
    async (_event, payload: { documentId: string; filePath: string; fileType: any }) => {
      return handleResearchIpc(IPC_CHANNELS.RESEARCH_IMPORT_FILE, payload, async () => {
        const entry = researchService.importFile(payload.documentId, payload.filePath, payload.fileType)
        return { success: true, data: entry }
      })
    },
  )

  // ── research:factCheck ──
  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_FACT_CHECK,
    async (_event, payload: { documentId: string; sectionId: string; sectionContent: string }) => {
      return handleResearchIpc(IPC_CHANNELS.RESEARCH_FACT_CHECK, payload, async () => {
        const result = citationService.factCheck(payload.documentId, payload.sectionId, payload.sectionContent)
        return { success: true, data: result }
      })
    },
  )

  // ── citation:format ──
  ipcMain.handle(
    IPC_CHANNELS.CITATION_FORMAT,
    async (_event, payload: { documentId: string; entryId: string; style?: any }) => {
      return handleResearchIpc(IPC_CHANNELS.CITATION_FORMAT, payload, async () => {
        const log = researchService.getLog(payload.documentId)
        const entry = log.entries.find(e => e.id === payload.entryId)
        if (!entry) {
          throw new Error(`Research entry not found: ${payload.entryId}`)
        }
        const style = payload.style || log.citationStyle
        const formatted = citationService.formatCitation(entry, style)
        return { success: true, data: { entryId: payload.entryId, formatted } }
      })
    },
  )

  // ── citation:getStyle ──
  ipcMain.handle(IPC_CHANNELS.CITATION_GET_STYLE, async (_event, payload: { documentId: string }) => {
    return handleResearchIpc(IPC_CHANNELS.CITATION_GET_STYLE, payload, async () => {
      const style = citationService.getStyle(payload.documentId)
      return { success: true, data: { style } }
    })
  })

  // ── citation:setStyle ──
  ipcMain.handle(IPC_CHANNELS.CITATION_SET_STYLE, async (_event, payload: { documentId: string; style: any }) => {
    return handleResearchIpc(IPC_CHANNELS.CITATION_SET_STYLE, payload, async () => {
      citationService.setStyle(payload.documentId, payload.style)
      return { success: true, data: { style: payload.style } }
    })
  })

  console.log('[IPC] Research & citation handlers registered (Phase 5)')
}

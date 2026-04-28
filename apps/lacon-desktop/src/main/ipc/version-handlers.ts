/**
 * Version & UX IPC Handlers — Phase 6
 *
 * Registers IPC handlers for version history and UX operations:
 * - version:listSnapshots    — List all snapshots for a document
 * - version:getSnapshot      — Get full snapshot content
 * - version:restoreSnapshot  — Restore a snapshot (with safety snapshot)
 * - version:addMilestone     — Add milestone label to a snapshot
 * - version:deleteSnapshot   — Delete a snapshot
 * - ux:setZenMode            — Toggle Zen mode
 * - ux:getZenMode            — Get Zen mode state
 * - ux:toggleAssistant       — Toggle assistant panel
 */

import { ipcMain } from 'electron'

import { type IpcResponse, IPC_CHANNELS } from '@/shared/ipc-schema'

import { redactObject } from '../security/log-redaction'
import { getVersionService } from '../services/version-service'

// ── UX State (in-memory, per-process) ──
let zenModeEnabled = false
let assistantPanelVisible = true

/**
 * Generic handler wrapper.
 */
async function handleVersionIpc<T>(
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
        code: 'VERSION_ERROR',
        message,
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    }
  }
}

/**
 * Register all version and UX IPC handlers.
 */
export function registerVersionHandlers(): void {
  const versionService = getVersionService()

  // ── version:listSnapshots ──
  ipcMain.handle(IPC_CHANNELS.VERSION_LIST_SNAPSHOTS, async (_event, payload: { documentId: string }) => {
    return handleVersionIpc(IPC_CHANNELS.VERSION_LIST_SNAPSHOTS, payload, async () => {
      const snapshots = versionService.listSnapshots(payload.documentId)
      return { success: true, data: snapshots }
    })
  })

  // ── version:getSnapshot ──
  ipcMain.handle(
    IPC_CHANNELS.VERSION_GET_SNAPSHOT,
    async (_event, payload: { documentId: string; snapshotId: string }) => {
      return handleVersionIpc(IPC_CHANNELS.VERSION_GET_SNAPSHOT, payload, async () => {
        const snapshot = versionService.getSnapshot(payload.documentId, payload.snapshotId)
        return { success: true, data: snapshot }
      })
    },
  )

  // ── version:restoreSnapshot ──
  ipcMain.handle(
    IPC_CHANNELS.VERSION_RESTORE_SNAPSHOT,
    async (_event, payload: { documentId: string; snapshotId: string; currentContent: any }) => {
      return handleVersionIpc(IPC_CHANNELS.VERSION_RESTORE_SNAPSHOT, payload, async () => {
        const result = versionService.restoreSnapshot(payload.documentId, payload.snapshotId, payload.currentContent)
        return { success: true, data: result }
      })
    },
  )

  // ── version:addMilestone ──
  ipcMain.handle(
    IPC_CHANNELS.VERSION_ADD_MILESTONE,
    async (_event, payload: { documentId: string; snapshotId: string; label: string }) => {
      return handleVersionIpc(IPC_CHANNELS.VERSION_ADD_MILESTONE, payload, async () => {
        const snapshot = versionService.addMilestoneLabel(payload.documentId, payload.snapshotId, payload.label)
        return { success: true, data: snapshot }
      })
    },
  )

  // ── version:deleteSnapshot ──
  ipcMain.handle(
    IPC_CHANNELS.VERSION_DELETE_SNAPSHOT,
    async (_event, payload: { documentId: string; snapshotId: string }) => {
      return handleVersionIpc(IPC_CHANNELS.VERSION_DELETE_SNAPSHOT, payload, async () => {
        versionService.deleteSnapshot(payload.documentId, payload.snapshotId)
        return { success: true, data: null }
      })
    },
  )

  // ── ux:setZenMode ──
  ipcMain.handle(IPC_CHANNELS.UX_SET_ZEN_MODE, async (_event, payload: { enabled: boolean }) => {
    return handleVersionIpc(IPC_CHANNELS.UX_SET_ZEN_MODE, payload, async () => {
      zenModeEnabled = payload.enabled
      return { success: true, data: { enabled: zenModeEnabled } }
    })
  })

  // ── ux:getZenMode ──
  ipcMain.handle(IPC_CHANNELS.UX_GET_ZEN_MODE, async () => {
    return handleVersionIpc(IPC_CHANNELS.UX_GET_ZEN_MODE, {}, async () => {
      return { success: true, data: { enabled: zenModeEnabled } }
    })
  })

  // ── ux:toggleAssistant ──
  ipcMain.handle(IPC_CHANNELS.UX_TOGGLE_ASSISTANT, async (_event, payload: { visible?: boolean }) => {
    return handleVersionIpc(IPC_CHANNELS.UX_TOGGLE_ASSISTANT, payload, async () => {
      if (payload.visible !== undefined) {
        assistantPanelVisible = payload.visible
      } else {
        assistantPanelVisible = !assistantPanelVisible
      }
      return { success: true, data: { visible: assistantPanelVisible } }
    })
  })

  console.log('[IPC] Version & UX handlers registered (Phase 6)')
}

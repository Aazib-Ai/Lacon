/**
 * Phase 7 IPC Handlers — Security, Costing, Distribution
 *
 * Registers IPC handlers for:
 * - pricing:calculate         — Calculate cost for a single action
 * - pricing:getSessionCost    — Get running session cost for a project
 * - pricing:resetSession      — Reset session cost
 * - pricing:getGlobalSummary  — Get aggregate cost across all projects
 * - pricing:getAllModels       — Get all known model pricings
 * - pricing:recordAction      — Record a cost entry for a project
 * - provider:testConnection   — Test connection to a provider
 * - project:setModel          — Set model config for a project
 * - project:getModel          — Get model config for a project
 * - update:check              — Check for updates (manual link)
 * - update:getInfo            — Get current app version info
 */

import { app, ipcMain, shell } from 'electron'

import { type IpcResponse, IPC_CHANNELS } from '@/shared/ipc-schema'

import { getProviderManager } from '../providers/provider-manager'
import { redactObject } from '../security/log-redaction'
import { getPricingService } from '../services/pricing-service'
import { getProjectWorkspaceService } from '../services/project-workspace-service'

/**
 * Generic handler wrapper.
 */
async function handlePhase7Ipc<T>(
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
        code: 'PHASE7_ERROR',
        message,
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    }
  }
}

/**
 * Register all Phase 7 IPC handlers.
 */
export function registerPhase7Handlers(): void {
  const pricingService = getPricingService()

  // ── pricing:calculate ──
  ipcMain.handle(
    IPC_CHANNELS.PRICING_CALCULATE,
    async (
      _event,
      payload: {
        inputTokens: number
        outputTokens: number
        modelId: string
        provider: string
      },
    ) => {
      return handlePhase7Ipc(IPC_CHANNELS.PRICING_CALCULATE, payload, async () => {
        const cost = pricingService.calculateCost(
          payload.inputTokens,
          payload.outputTokens,
          payload.modelId,
          payload.provider,
        )
        return { success: true, data: cost }
      })
    },
  )

  // ── pricing:getSessionCost ──
  ipcMain.handle(IPC_CHANNELS.PRICING_GET_SESSION_COST, async (_event, payload: { documentId: string }) => {
    return handlePhase7Ipc(IPC_CHANNELS.PRICING_GET_SESSION_COST, payload, async () => {
      const sessionCost = pricingService.getSessionCost(payload.documentId)
      return { success: true, data: sessionCost }
    })
  })

  // ── pricing:resetSession ──
  ipcMain.handle(IPC_CHANNELS.PRICING_RESET_SESSION, async (_event, payload: { documentId: string }) => {
    return handlePhase7Ipc(IPC_CHANNELS.PRICING_RESET_SESSION, payload, async () => {
      pricingService.resetSessionCost(payload.documentId)
      return { success: true, data: null }
    })
  })

  // ── pricing:getGlobalSummary ──
  ipcMain.handle(IPC_CHANNELS.PRICING_GET_GLOBAL_SUMMARY, async () => {
    return handlePhase7Ipc(IPC_CHANNELS.PRICING_GET_GLOBAL_SUMMARY, {}, async () => {
      const summary = pricingService.getGlobalCostSummary()
      return { success: true, data: summary }
    })
  })

  // ── pricing:getAllModels ──
  ipcMain.handle(IPC_CHANNELS.PRICING_GET_ALL_MODELS, async () => {
    return handlePhase7Ipc(IPC_CHANNELS.PRICING_GET_ALL_MODELS, {}, async () => {
      const models = pricingService.getAllPricings()
      return { success: true, data: models }
    })
  })

  // ── pricing:recordAction ──
  ipcMain.handle(
    IPC_CHANNELS.PRICING_RECORD_ACTION,
    async (
      _event,
      payload: {
        documentId: string
        action: string
        inputTokens: number
        outputTokens: number
        modelId: string
        provider: string
      },
    ) => {
      return handlePhase7Ipc(IPC_CHANNELS.PRICING_RECORD_ACTION, payload, async () => {
        const session = pricingService.recordAction(
          payload.documentId,
          payload.action,
          payload.inputTokens,
          payload.outputTokens,
          payload.modelId,
          payload.provider,
        )
        return { success: true, data: session }
      })
    },
  )

  // ── provider:testConnection ──
  ipcMain.handle(IPC_CHANNELS.PROVIDER_TEST_CONNECTION, async (_event, payload: { providerId: string }) => {
    return handlePhase7Ipc(IPC_CHANNELS.PROVIDER_TEST_CONNECTION, payload, async () => {
      const providerManager = getProviderManager()
      const health = await providerManager.checkHealth(payload.providerId)
      return {
        success: true,
        data: {
          status: health.status,
          latencyMs: health.latencyMs,
          error: health.error,
          testedAt: new Date().toISOString(),
        },
      }
    })
  })

  // ── project:setModel ──
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SET_MODEL,
    async (_event, payload: { documentId: string; providerId: string; modelId: string }) => {
      return handlePhase7Ipc(IPC_CHANNELS.PROJECT_SET_MODEL, payload, async () => {
        const workspaceService = getProjectWorkspaceService()
        const session = workspaceService.getSession(payload.documentId)
        if (session) {
          session.modelConfig = {
            providerId: payload.providerId,
            modelId: payload.modelId,
          }
          workspaceService.updateSession(payload.documentId, {
            modelConfig: session.modelConfig,
          })
        }
        return { success: true, data: { providerId: payload.providerId, modelId: payload.modelId } }
      })
    },
  )

  // ── project:getModel ──
  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_MODEL, async (_event, payload: { documentId: string }) => {
    return handlePhase7Ipc(IPC_CHANNELS.PROJECT_GET_MODEL, payload, async () => {
      const workspaceService = getProjectWorkspaceService()
      const session = workspaceService.getSession(payload.documentId)
      return {
        success: true,
        data: session?.modelConfig || { providerId: '', modelId: '' },
      }
    })
  })

  // ── update:check ──
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    return handlePhase7Ipc(IPC_CHANNELS.UPDATE_CHECK, {}, async () => {
      // LACON uses manual update links — no auto-updater
      const updateUrl = 'https://lacon.app/download'
      await shell.openExternal(updateUrl)
      return { success: true, data: { url: updateUrl, opened: true } }
    })
  })

  // ── update:getInfo ──
  ipcMain.handle(IPC_CHANNELS.UPDATE_GET_INFO, async () => {
    return handlePhase7Ipc(IPC_CHANNELS.UPDATE_GET_INFO, {}, async () => {
      return {
        success: true,
        data: {
          currentVersion: app.getVersion(),
          platform: process.platform,
          arch: process.arch,
          isPackaged: app.isPackaged,
          updateUrl: 'https://lacon.app/download',
        },
      }
    })
  })

  console.log('[IPC] Phase 7 (Pricing, Security, Update) handlers registered')
}

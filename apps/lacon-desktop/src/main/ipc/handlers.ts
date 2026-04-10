/**
 * IPC handlers for Phase 2
 * Implements all IPC endpoints with validation and security
 */

import { ipcMain } from 'electron'

import type { AgentRuntimeConfig } from '@/shared/agent-types'
import {
  type AgentApproveRequestRequest,
  type AgentCancelRunRequest,
  type AgentGetRunStatusRequest,
  type AgentRegisterToolRequest,
  type AgentRejectRequestRequest,
  type AgentStartRunRequest,
  type DataDeleteRequest,
  type DataExportRequest,
  type DataImportRequest,
  type DataListRequest,
  type DataLoadRequest,
  type DataSaveRequest,
  type DocArchiveRequest,
  type DocClearRecoverySnapshotRequest,
  type DocCreateRequest,
  type DocDeleteRequest,
  type DocDuplicateRequest,
  type DocExportRequest,
  type DocImportRequest,
  type DocListRequest,
  type DocOpenRequest,
  type DocRenameRequest,
  type DocRestoreRequest,
  type DocSaveAsRequest,
  type DocSaveRequest,
  type DocScheduleAutosaveRequest,
  type DocSetLastOpenedRequest,
  type IpcResponse,
  type KeyDeleteRequest,
  type KeyGetMetadataRequest,
  type KeyHasRequest,
  type KeySetRequest,
  type SettingsGetRequest,
  type SettingsSetRequest,
  IPC_CHANNELS,
} from '@/shared/ipc-schema'

import { AgentOrchestrator } from '../agent/orchestrator'
import { COLLECTIONS } from '../data/schema'
import { getDataStore } from '../data/store'
import { getKeyStore } from '../security/keystore'
import { redactObject } from '../security/log-redaction'
import { DocumentService } from '../services/document-service'
import { ImportExportService } from '../services/import-export-service'
import { IpcValidationError, validateIpcRequest } from './ipc-validator'

// Service instances
let documentService: DocumentService | null = null
let importExportService: ImportExportService | null = null
let agentOrchestrator: AgentOrchestrator | null = null

function getDocumentService(): DocumentService {
  if (!documentService) {
    documentService = new DocumentService(getDataStore())
  }
  return documentService
}

function getImportExportService(): ImportExportService {
  if (!importExportService) {
    importExportService = new ImportExportService()
  }
  return importExportService
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  // Key management handlers
  ipcMain.handle(IPC_CHANNELS.KEY_SET, async (event, payload: KeySetRequest) => {
    return handleIpc(IPC_CHANNELS.KEY_SET, payload, async () => {
      const keyStore = getKeyStore()
      await keyStore.setKey(payload.id, payload.provider, payload.label, payload.value)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.KEY_GET_METADATA, async (event, payload: KeyGetMetadataRequest) => {
    return handleIpc(IPC_CHANNELS.KEY_GET_METADATA, payload, async () => {
      const keyStore = getKeyStore()
      const metadata = await keyStore.getKeyMetadata(payload.id)
      return { success: true, data: metadata }
    })
  })

  ipcMain.handle(IPC_CHANNELS.KEY_LIST, async (event, payload) => {
    return handleIpc(IPC_CHANNELS.KEY_LIST, payload, async () => {
      const keyStore = getKeyStore()
      const keys = await keyStore.listKeys()
      return { success: true, data: keys }
    })
  })

  ipcMain.handle(IPC_CHANNELS.KEY_DELETE, async (event, payload: KeyDeleteRequest) => {
    return handleIpc(IPC_CHANNELS.KEY_DELETE, payload, async () => {
      const keyStore = getKeyStore()
      const deleted = await keyStore.deleteKey(payload.id)
      return { success: true, data: deleted }
    })
  })

  ipcMain.handle(IPC_CHANNELS.KEY_HAS, async (event, payload: KeyHasRequest) => {
    return handleIpc(IPC_CHANNELS.KEY_HAS, payload, async () => {
      const keyStore = getKeyStore()
      const exists = await keyStore.hasKey(payload.id)
      return { success: true, data: exists }
    })
  })

  // Data operation handlers
  ipcMain.handle(IPC_CHANNELS.DATA_SAVE, async (event, payload: DataSaveRequest) => {
    return handleIpc(IPC_CHANNELS.DATA_SAVE, payload, async () => {
      const dataStore = getDataStore()
      await dataStore.save(payload.collection, payload.id, payload.data)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DATA_LOAD, async (event, payload: DataLoadRequest) => {
    return handleIpc(IPC_CHANNELS.DATA_LOAD, payload, async () => {
      const dataStore = getDataStore()
      const data = await dataStore.load(payload.collection, payload.id)
      return { success: true, data }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DATA_DELETE, async (event, payload: DataDeleteRequest) => {
    return handleIpc(IPC_CHANNELS.DATA_DELETE, payload, async () => {
      const dataStore = getDataStore()
      const deleted = await dataStore.delete(payload.collection, payload.id)
      return { success: true, data: deleted }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DATA_LIST, async (event, payload: DataListRequest) => {
    return handleIpc(IPC_CHANNELS.DATA_LIST, payload, async () => {
      const dataStore = getDataStore()
      const ids = await dataStore.list(payload.collection)
      return { success: true, data: ids }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DATA_EXPORT, async (event, payload: DataExportRequest) => {
    return handleIpc(IPC_CHANNELS.DATA_EXPORT, payload, async () => {
      const dataStore = getDataStore()
      await dataStore.export(payload.path)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT, async (event, payload: DataImportRequest) => {
    return handleIpc(IPC_CHANNELS.DATA_IMPORT, payload, async () => {
      const dataStore = getDataStore()
      await dataStore.import(payload.path)
      return { success: true }
    })
  })

  // Settings handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (event, payload: SettingsGetRequest) => {
    return handleIpc(IPC_CHANNELS.SETTINGS_GET, payload, async () => {
      const dataStore = getDataStore()
      const settings = await dataStore.load(COLLECTIONS.SETTINGS, 'default')
      const value = settings ? settings[payload.key] : undefined
      return { success: true, data: value }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (event, payload: SettingsSetRequest) => {
    return handleIpc(IPC_CHANNELS.SETTINGS_SET, payload, async () => {
      const dataStore = getDataStore()
      const settings = (await dataStore.load(COLLECTIONS.SETTINGS, 'default')) || {}
      settings[payload.key] = payload.value
      await dataStore.save(COLLECTIONS.SETTINGS, 'default', settings)
      return { success: true }
    })
  })

  // Document operation handlers (Phase 3)
  ipcMain.handle(IPC_CHANNELS.DOC_CREATE, async (event, payload: DocCreateRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_CREATE, payload, async () => {
      const docService = getDocumentService()
      const document = await docService.createDocument(payload.title)
      return { success: true, data: document }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_OPEN, async (event, payload: DocOpenRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_OPEN, payload, async () => {
      const docService = getDocumentService()
      const document = await docService.openDocument(payload.id)
      return { success: true, data: document }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_SAVE, async (event, payload: DocSaveRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_SAVE, payload, async () => {
      const docService = getDocumentService()
      await docService.saveDocument(payload.document)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_SAVE_AS, async (event, payload: DocSaveAsRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_SAVE_AS, payload, async () => {
      const docService = getDocumentService()
      const newDocument = await docService.saveDocumentAs(payload.document, payload.newTitle)
      return { success: true, data: newDocument }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_RENAME, async (event, payload: DocRenameRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_RENAME, payload, async () => {
      const docService = getDocumentService()
      await docService.renameDocument(payload.id, payload.newTitle)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_DUPLICATE, async (event, payload: DocDuplicateRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_DUPLICATE, payload, async () => {
      const docService = getDocumentService()
      const newDocument = await docService.duplicateDocument(payload.id)
      return { success: true, data: newDocument }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_ARCHIVE, async (event, payload: DocArchiveRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_ARCHIVE, payload, async () => {
      const docService = getDocumentService()
      await docService.archiveDocument(payload.id)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_RESTORE, async (event, payload: DocRestoreRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_RESTORE, payload, async () => {
      const docService = getDocumentService()
      await docService.restoreDocument(payload.id)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_DELETE, async (event, payload: DocDeleteRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_DELETE, payload, async () => {
      const docService = getDocumentService()
      await docService.deleteDocument(payload.id)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_LIST, async (event, payload: DocListRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_LIST, payload, async () => {
      const docService = getDocumentService()
      const documents = await docService.listDocuments(payload.includeArchived)
      return { success: true, data: documents }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_IMPORT, async (event, payload: DocImportRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_IMPORT, payload, async () => {
      const importExport = getImportExportService()
      const result = await importExport.importDocument(payload.data, payload.format, payload.title)
      return { success: true, data: result }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_EXPORT, async (event, payload: DocExportRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_EXPORT, payload, async () => {
      const importExport = getImportExportService()
      const result = await importExport.exportDocument(payload.document, payload.format)
      return { success: true, data: result }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_GET_LAST_OPENED, async (event, payload) => {
    return handleIpc(IPC_CHANNELS.DOC_GET_LAST_OPENED, payload, async () => {
      const docService = getDocumentService()
      const document = await docService.getLastOpenedDocument()
      return { success: true, data: document }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_SET_LAST_OPENED, async (event, payload: DocSetLastOpenedRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_SET_LAST_OPENED, payload, async () => {
      const docService = getDocumentService()
      await docService.setLastOpenedDocument(payload.id)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_SCHEDULE_AUTOSAVE, async (event, payload: DocScheduleAutosaveRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_SCHEDULE_AUTOSAVE, payload, async () => {
      const docService = getDocumentService()
      docService.scheduleAutosave(payload.document)
      return { success: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_GET_RECOVERY_SNAPSHOTS, async (event, payload) => {
    return handleIpc(IPC_CHANNELS.DOC_GET_RECOVERY_SNAPSHOTS, payload, async () => {
      const docService = getDocumentService()
      const snapshots = await docService.getRecoverySnapshots()
      return { success: true, data: snapshots }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DOC_CLEAR_RECOVERY_SNAPSHOT, async (event, payload: DocClearRecoverySnapshotRequest) => {
    return handleIpc(IPC_CHANNELS.DOC_CLEAR_RECOVERY_SNAPSHOT, payload, async () => {
      const docService = getDocumentService()
      await docService.clearRecoverySnapshot(payload.documentId)
      return { success: true }
    })
  })

  console.log('IPC handlers registered')
}

/**
 * Generic IPC handler wrapper with validation and error handling
 */
async function handleIpc<T>(
  channel: string,
  payload: any,
  handler: () => Promise<IpcResponse<T>>,
): Promise<IpcResponse<T>> {
  try {
    // Validate request
    validateIpcRequest(channel, payload)

    // Log request (with redaction)
    console.log(`[IPC] ${channel}`, redactObject(payload))

    // Execute handler
    const response = await handler()

    // Log response (with redaction)
    console.log(`[IPC] ${channel} -> success`, redactObject(response.data))

    return response
  } catch (error) {
    // Handle validation errors
    if (error instanceof IpcValidationError) {
      console.error(`[IPC] ${channel} validation error:`, error.message)
      return {
        success: false,
        error: error.toIpcError(),
      }
    }

    // Handle other errors
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[IPC] ${channel} error:`, message)

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    }
  }
}

/**
 * Get or create agent orchestrator instance
 * Phase 6: Agent Runtime Core
 */
function getAgentOrchestrator(): AgentOrchestrator {
  if (!agentOrchestrator) {
    const config: AgentRuntimeConfig = {
      maxConcurrentTools: 3,
      defaultToolTimeout: 30000, // 30 seconds
      maxRetries: 3,
      retryBackoffMs: 1000,
      approvalThreshold: 60, // Risk score threshold
      enableStreaming: true,
    }
    agentOrchestrator = new AgentOrchestrator(config)
  }
  return agentOrchestrator
}

/**
 * Register agent runtime IPC handlers
 * Phase 6: Epic P6-E3, Task P6-T8
 */
export function registerAgentIpcHandlers(): void {
  const orchestrator = getAgentOrchestrator()

  // Start agent run
  ipcMain.handle(IPC_CHANNELS.AGENT_START_RUN, async (event, payload: AgentStartRunRequest) => {
    return handleIpc(IPC_CHANNELS.AGENT_START_RUN, payload, async () => {
      const runId = await orchestrator.startRun(payload.instruction, payload.documentContext)
      return { success: true, data: runId }
    })
  })

  // Cancel agent run
  ipcMain.handle(IPC_CHANNELS.AGENT_CANCEL_RUN, async (event, payload: AgentCancelRunRequest) => {
    return handleIpc(IPC_CHANNELS.AGENT_CANCEL_RUN, payload, async () => {
      orchestrator.cancelRun(payload.runId, payload.reason)
      return { success: true }
    })
  })

  // Get run status
  ipcMain.handle(IPC_CHANNELS.AGENT_GET_RUN_STATUS, async (event, payload: AgentGetRunStatusRequest) => {
    return handleIpc(IPC_CHANNELS.AGENT_GET_RUN_STATUS, payload, async () => {
      const runContext = orchestrator.getRunContext(payload.runId)
      if (!runContext) {
        return {
          success: false,
          error: {
            code: 'RUN_NOT_FOUND',
            message: `Run not found: ${payload.runId}`,
          },
        }
      }
      return { success: true, data: runContext }
    })
  })

  // Approve request
  ipcMain.handle(IPC_CHANNELS.AGENT_APPROVE_REQUEST, async (event, payload: AgentApproveRequestRequest) => {
    return handleIpc(IPC_CHANNELS.AGENT_APPROVE_REQUEST, payload, async () => {
      orchestrator.getApprovalManager().approve(payload.requestId)
      return { success: true }
    })
  })

  // Reject request
  ipcMain.handle(IPC_CHANNELS.AGENT_REJECT_REQUEST, async (event, payload: AgentRejectRequestRequest) => {
    return handleIpc(IPC_CHANNELS.AGENT_REJECT_REQUEST, payload, async () => {
      orchestrator.getApprovalManager().reject(payload.requestId, payload.reason)
      return { success: true }
    })
  })

  // Get pending approvals
  ipcMain.handle(IPC_CHANNELS.AGENT_GET_PENDING_APPROVALS, async () => {
    return handleIpc(IPC_CHANNELS.AGENT_GET_PENDING_APPROVALS, {}, async () => {
      const approvals = orchestrator.getApprovalManager().getPendingApprovals()
      return { success: true, data: approvals }
    })
  })

  // Register tool
  ipcMain.handle(IPC_CHANNELS.AGENT_REGISTER_TOOL, async (event, payload: AgentRegisterToolRequest) => {
    return handleIpc(IPC_CHANNELS.AGENT_REGISTER_TOOL, payload, async () => {
      orchestrator.registerTool(payload.tool)
      return { success: true }
    })
  })
}

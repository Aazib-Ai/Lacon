/**
 * IPC handlers for Phase 2
 * Implements all IPC endpoints with validation and security
 */

import { ipcMain } from 'electron'

import {
  type DataDeleteRequest,
  type DataExportRequest,
  type DataImportRequest,
  type DataListRequest,
  type DataLoadRequest,
  type DataSaveRequest,
  type IpcResponse,
  type KeyDeleteRequest,
  type KeyGetMetadataRequest,
  type KeyHasRequest,
  type KeySetRequest,
  type SettingsGetRequest,
  type SettingsSetRequest,
  IPC_CHANNELS,
} from '@/shared/ipc-schema'

import { COLLECTIONS } from '../data/schema'
import { getDataStore } from '../data/store'
import { getKeyStore } from '../security/keystore'
import { redactObject } from '../security/log-redaction'
import { IpcValidationError, validateIpcRequest } from './ipc-validator'

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

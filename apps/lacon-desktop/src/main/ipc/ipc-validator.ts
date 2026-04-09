/**
 * IPC validation middleware for Phase 2
 * Validates all inbound IPC payloads against schemas
 */

import {
  type IpcChannel,
  type IpcError,
  IPC_CHANNELS,
  isDataDeleteRequest,
  isDataExportRequest,
  isDataImportRequest,
  isDataListRequest,
  isDataLoadRequest,
  isDataSaveRequest,
  isKeyDeleteRequest,
  isKeyGetMetadataRequest,
  isKeyHasRequest,
  isKeySetRequest,
  isSettingsGetRequest,
  isSettingsSetRequest,
  isValidChannel,
} from '@/shared/ipc-schema'

export class IpcValidationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
  ) {
    super(message)
    this.name = 'IpcValidationError'
  }

  toIpcError(): IpcError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

/**
 * Validate IPC channel name
 */
export function validateChannel(channel: string): void {
  if (!isValidChannel(channel)) {
    throw new IpcValidationError('INVALID_CHANNEL', `Unknown IPC channel: ${channel}`, { channel })
  }
}

/**
 * Validate IPC payload based on channel
 */
export function validatePayload(channel: IpcChannel, payload: any): void {
  switch (channel) {
    case IPC_CHANNELS.KEY_SET:
      if (!isKeySetRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid KEY_SET payload', {
          expected: 'KeySetRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.KEY_GET_METADATA:
      if (!isKeyGetMetadataRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid KEY_GET_METADATA payload', {
          expected: 'KeyGetMetadataRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.KEY_DELETE:
      if (!isKeyDeleteRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid KEY_DELETE payload', {
          expected: 'KeyDeleteRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.KEY_HAS:
      if (!isKeyHasRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid KEY_HAS payload', {
          expected: 'KeyHasRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.KEY_LIST:
      // No payload required
      break

    case IPC_CHANNELS.DATA_SAVE:
      if (!isDataSaveRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_SAVE payload', {
          expected: 'DataSaveRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_LOAD:
      if (!isDataLoadRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_LOAD payload', {
          expected: 'DataLoadRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_DELETE:
      if (!isDataDeleteRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_DELETE payload', {
          expected: 'DataDeleteRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_LIST:
      if (!isDataListRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_LIST payload', {
          expected: 'DataListRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_EXPORT:
      if (!isDataExportRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_EXPORT payload', {
          expected: 'DataExportRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_IMPORT:
      if (!isDataImportRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_IMPORT payload', {
          expected: 'DataImportRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SETTINGS_GET:
      if (!isSettingsGetRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SETTINGS_GET payload', {
          expected: 'SettingsGetRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SETTINGS_SET:
      if (!isSettingsSetRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SETTINGS_SET payload', {
          expected: 'SettingsSetRequest',
          received: typeof payload,
        })
      }
      break

    default:
      throw new IpcValidationError('UNHANDLED_CHANNEL', `No validator for channel: ${channel}`, { channel })
  }
}

/**
 * Validate complete IPC request
 */
export function validateIpcRequest(channel: string, payload: any): void {
  validateChannel(channel)
  validatePayload(channel as IpcChannel, payload)
}

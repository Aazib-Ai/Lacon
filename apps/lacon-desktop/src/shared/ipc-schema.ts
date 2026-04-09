/**
 * Typed IPC schema definitions for Phase 2
 * All IPC communication must conform to these schemas
 */

// IPC Channel names - centralized for type safety
export const IPC_CHANNELS = {
  // Key management
  KEY_SET: 'key:set',
  KEY_GET_METADATA: 'key:getMetadata',
  KEY_LIST: 'key:list',
  KEY_DELETE: 'key:delete',
  KEY_HAS: 'key:has',

  // Data operations (Phase 2)
  DATA_SAVE: 'data:save',
  DATA_LOAD: 'data:load',
  DATA_DELETE: 'data:delete',
  DATA_LIST: 'data:list',
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// Base types for all IPC messages
export interface IpcRequest<T = any> {
  channel: IpcChannel
  payload: T
}

export interface IpcResponse<T = any> {
  success: boolean
  data?: T
  error?: IpcError
}

export interface IpcError {
  code: string
  message: string
  details?: any
}

// Key management request/response types
export interface KeySetRequest {
  id: string
  provider: string
  label: string
  value: string
}

export interface KeyMetadata {
  id: string
  provider: string
  label: string
  createdAt: number
  updatedAt: number
}

export interface KeyGetMetadataRequest {
  id: string
}

export interface KeyDeleteRequest {
  id: string
}

export interface KeyHasRequest {
  id: string
}

export type KeySetResponse = IpcResponse<void>
export type KeyGetMetadataResponse = IpcResponse<KeyMetadata | null>
export type KeyListResponse = IpcResponse<KeyMetadata[]>
export type KeyDeleteResponse = IpcResponse<boolean>
export type KeyHasResponse = IpcResponse<boolean>

// Data operation types
export interface DataSaveRequest {
  collection: 'documents' | 'sessions' | 'traces' | 'settings'
  id: string
  data: any
}

export interface DataLoadRequest {
  collection: 'documents' | 'sessions' | 'traces' | 'settings'
  id: string
}

export interface DataDeleteRequest {
  collection: 'documents' | 'sessions' | 'traces' | 'settings'
  id: string
}

export interface DataListRequest {
  collection: 'documents' | 'sessions' | 'traces' | 'settings'
}

export interface DataExportRequest {
  path: string
}

export interface DataImportRequest {
  path: string
}

export type DataSaveResponse = IpcResponse<void>
export type DataLoadResponse = IpcResponse<any>
export type DataDeleteResponse = IpcResponse<boolean>
export type DataListResponse = IpcResponse<string[]>
export type DataExportResponse = IpcResponse<void>
export type DataImportResponse = IpcResponse<void>

// Settings types
export interface SettingsGetRequest {
  key: string
}

export interface SettingsSetRequest {
  key: string
  value: any
}

export type SettingsGetResponse = IpcResponse<any>
export type SettingsSetResponse = IpcResponse<void>

// Type guards for runtime validation
export function isValidChannel(channel: string): channel is IpcChannel {
  return Object.values(IPC_CHANNELS).includes(channel as IpcChannel)
}

export function isKeySetRequest(payload: any): payload is KeySetRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.id === 'string' &&
    typeof payload.provider === 'string' &&
    typeof payload.label === 'string' &&
    typeof payload.value === 'string'
  )
}

export function isKeyGetMetadataRequest(payload: any): payload is KeyGetMetadataRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isKeyDeleteRequest(payload: any): payload is KeyDeleteRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isKeyHasRequest(payload: any): payload is KeyHasRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isDataSaveRequest(payload: any): payload is DataSaveRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.collection === 'string' &&
    typeof payload.id === 'string' &&
    payload.data !== undefined
  )
}

export function isDataLoadRequest(payload: any): payload is DataLoadRequest {
  return typeof payload === 'object' && typeof payload.collection === 'string' && typeof payload.id === 'string'
}

export function isDataDeleteRequest(payload: any): payload is DataDeleteRequest {
  return typeof payload === 'object' && typeof payload.collection === 'string' && typeof payload.id === 'string'
}

export function isDataListRequest(payload: any): payload is DataListRequest {
  return typeof payload === 'object' && typeof payload.collection === 'string'
}

export function isDataExportRequest(payload: any): payload is DataExportRequest {
  return typeof payload === 'object' && typeof payload.path === 'string'
}

export function isDataImportRequest(payload: any): payload is DataImportRequest {
  return typeof payload === 'object' && typeof payload.path === 'string'
}

export function isSettingsGetRequest(payload: any): payload is SettingsGetRequest {
  return typeof payload === 'object' && typeof payload.key === 'string'
}

export function isSettingsSetRequest(payload: any): payload is SettingsSetRequest {
  return typeof payload === 'object' && typeof payload.key === 'string' && payload.value !== undefined
}

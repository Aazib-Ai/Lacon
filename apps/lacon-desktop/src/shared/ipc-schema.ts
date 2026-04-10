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

  // Document operations (Phase 3)
  DOC_CREATE: 'doc:create',
  DOC_OPEN: 'doc:open',
  DOC_SAVE: 'doc:save',
  DOC_SAVE_AS: 'doc:saveAs',
  DOC_RENAME: 'doc:rename',
  DOC_DUPLICATE: 'doc:duplicate',
  DOC_ARCHIVE: 'doc:archive',
  DOC_RESTORE: 'doc:restore',
  DOC_DELETE: 'doc:delete',
  DOC_LIST: 'doc:list',
  DOC_IMPORT: 'doc:import',
  DOC_EXPORT: 'doc:export',
  DOC_GET_LAST_OPENED: 'doc:getLastOpened',
  DOC_SET_LAST_OPENED: 'doc:setLastOpened',
  DOC_SCHEDULE_AUTOSAVE: 'doc:scheduleAutosave',
  DOC_GET_RECOVERY_SNAPSHOTS: 'doc:getRecoverySnapshots',
  DOC_CLEAR_RECOVERY_SNAPSHOT: 'doc:clearRecoverySnapshot',

  // Agent runtime operations (Phase 6)
  AGENT_START_RUN: 'agent:startRun',
  AGENT_CANCEL_RUN: 'agent:cancelRun',
  AGENT_GET_RUN_STATUS: 'agent:getRunStatus',
  AGENT_APPROVE_REQUEST: 'agent:approveRequest',

  // Provider operations (Phase 7)
  PROVIDER_REGISTER: 'provider:register',
  PROVIDER_UNREGISTER: 'provider:unregister',
  PROVIDER_LIST: 'provider:list',
  PROVIDER_GET_MODELS: 'provider:getModels',
  PROVIDER_CHECK_HEALTH: 'provider:checkHealth',
  PROVIDER_CHECK_ALL_HEALTH: 'provider:checkAllHealth',
  PROVIDER_SET_FALLBACK: 'provider:setFallback',
  PROVIDER_GET_USAGE: 'provider:getUsage',
  PROVIDER_GET_USAGE_SUMMARY: 'provider:getUsageSummary',
  PROVIDER_CHAT_COMPLETION: 'provider:chatCompletion',
  PROVIDER_STREAM_START: 'provider:streamStart',
  PROVIDER_STREAM_CHUNK: 'provider:streamChunk',
  PROVIDER_STREAM_COMPLETE: 'provider:streamComplete',
  PROVIDER_STREAM_ERROR: 'provider:streamError',
  AGENT_REJECT_REQUEST: 'agent:rejectRequest',
  AGENT_GET_PENDING_APPROVALS: 'agent:getPendingApprovals',
  AGENT_REGISTER_TOOL: 'agent:registerTool',
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

// Document operation types (Phase 3)
export interface DocCreateRequest {
  title?: string
}

export interface DocOpenRequest {
  id: string
}

export interface DocSaveRequest {
  document: any // LaconDocument
}

export interface DocSaveAsRequest {
  document: any // LaconDocument
  newTitle: string
}

export interface DocRenameRequest {
  id: string
  newTitle: string
}

export interface DocDuplicateRequest {
  id: string
}

export interface DocArchiveRequest {
  id: string
}

export interface DocRestoreRequest {
  id: string
}

export interface DocDeleteRequest {
  id: string
}

export interface DocListRequest {
  includeArchived?: boolean
}

export interface DocImportRequest {
  data: string
  format: 'json' | 'html' | 'markdown'
  title?: string
}

export interface DocExportRequest {
  document: any // LaconDocument
  format: 'json' | 'html' | 'markdown'
}

export interface DocSetLastOpenedRequest {
  id: string
}

export interface DocScheduleAutosaveRequest {
  document: any // LaconDocument
}

export interface DocClearRecoverySnapshotRequest {
  documentId: string
}

export type DocCreateResponse = IpcResponse<any> // LaconDocument
export type DocOpenResponse = IpcResponse<any | null> // LaconDocument | null
export type DocSaveResponse = IpcResponse<void>
export type DocSaveAsResponse = IpcResponse<any> // LaconDocument
export type DocRenameResponse = IpcResponse<void>
export type DocDuplicateResponse = IpcResponse<any> // LaconDocument
export type DocArchiveResponse = IpcResponse<void>
export type DocRestoreResponse = IpcResponse<void>
export type DocDeleteResponse = IpcResponse<void>
export type DocListResponse = IpcResponse<any[]> // DocumentListItem[]
export type DocImportResponse = IpcResponse<any> // ImportResult
export type DocExportResponse = IpcResponse<any> // ExportResult
export type DocGetLastOpenedResponse = IpcResponse<any | null> // LaconDocument | null
export type DocSetLastOpenedResponse = IpcResponse<void>
export type DocScheduleAutosaveResponse = IpcResponse<void>
export type DocGetRecoverySnapshotsResponse = IpcResponse<any[]> // RecoverySnapshot[]
export type DocClearRecoverySnapshotResponse = IpcResponse<void>

// Type guards for document operations
export function isDocCreateRequest(payload: any): payload is DocCreateRequest {
  return typeof payload === 'object'
}

export function isDocOpenRequest(payload: any): payload is DocOpenRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isDocSaveRequest(payload: any): payload is DocSaveRequest {
  return typeof payload === 'object' && payload.document !== undefined
}

export function isDocSaveAsRequest(payload: any): payload is DocSaveAsRequest {
  return typeof payload === 'object' && payload.document !== undefined && typeof payload.newTitle === 'string'
}

export function isDocRenameRequest(payload: any): payload is DocRenameRequest {
  return typeof payload === 'object' && typeof payload.id === 'string' && typeof payload.newTitle === 'string'
}

export function isDocDuplicateRequest(payload: any): payload is DocDuplicateRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isDocArchiveRequest(payload: any): payload is DocArchiveRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isDocRestoreRequest(payload: any): payload is DocRestoreRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isDocDeleteRequest(payload: any): payload is DocDeleteRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isDocListRequest(payload: any): payload is DocListRequest {
  return typeof payload === 'object'
}

export function isDocImportRequest(payload: any): payload is DocImportRequest {
  return typeof payload === 'object' && typeof payload.data === 'string' && typeof payload.format === 'string'
}

export function isDocExportRequest(payload: any): payload is DocExportRequest {
  return typeof payload === 'object' && payload.document !== undefined && typeof payload.format === 'string'
}

export function isDocSetLastOpenedRequest(payload: any): payload is DocSetLastOpenedRequest {
  return typeof payload === 'object' && typeof payload.id === 'string'
}

export function isDocScheduleAutosaveRequest(payload: any): payload is DocScheduleAutosaveRequest {
  return typeof payload === 'object' && payload.document !== undefined
}

export function isDocClearRecoverySnapshotRequest(payload: any): payload is DocClearRecoverySnapshotRequest {
  return typeof payload === 'object' && typeof payload.documentId === 'string'
}

// Agent runtime operation types (Phase 6)
export interface AgentStartRunRequest {
  instruction: string
  documentContext?: {
    documentId: string
    content: any
    selection?: { from: number; to: number }
  }
}

export interface AgentCancelRunRequest {
  runId: string
  reason?: string
}

export interface AgentGetRunStatusRequest {
  runId: string
}

export interface AgentApproveRequestRequest {
  requestId: string
}

export interface AgentRejectRequestRequest {
  requestId: string
  reason?: string
}

export interface AgentRegisterToolRequest {
  tool: any // ToolContract
}

export type AgentStartRunResponse = IpcResponse<string> // runId
export type AgentCancelRunResponse = IpcResponse<void>
export type AgentGetRunStatusResponse = IpcResponse<any> // AgentRunContext
export type AgentApproveRequestResponse = IpcResponse<void>
export type AgentRejectRequestResponse = IpcResponse<void>
export type AgentGetPendingApprovalsResponse = IpcResponse<any[]> // ApprovalRequest[]
export type AgentRegisterToolResponse = IpcResponse<void>

// Type guards for agent operations
export function isAgentStartRunRequest(payload: any): payload is AgentStartRunRequest {
  return typeof payload === 'object' && typeof payload.instruction === 'string'
}

export function isAgentCancelRunRequest(payload: any): payload is AgentCancelRunRequest {
  return typeof payload === 'object' && typeof payload.runId === 'string'
}

export function isAgentGetRunStatusRequest(payload: any): payload is AgentGetRunStatusRequest {
  return typeof payload === 'object' && typeof payload.runId === 'string'
}

export function isAgentApproveRequestRequest(payload: any): payload is AgentApproveRequestRequest {
  return typeof payload === 'object' && typeof payload.requestId === 'string'
}

export function isAgentRejectRequestRequest(payload: any): payload is AgentRejectRequestRequest {
  return typeof payload === 'object' && typeof payload.requestId === 'string'
}

export function isAgentRegisterToolRequest(payload: any): payload is AgentRegisterToolRequest {
  return typeof payload === 'object' && payload.tool !== undefined
}

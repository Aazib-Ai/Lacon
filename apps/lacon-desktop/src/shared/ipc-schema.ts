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

  // Tool operations (Phase 8)
  TOOLS_LIST: 'tools:list',
  TOOLS_LIST_BY_CATEGORY: 'tools:list-by-category',
  TOOLS_EXECUTE: 'tools:execute',
  TOOLS_AUTHORING: 'tools:authoring',
  TOOLS_WORKSPACE_QA: 'tools:workspace-qa',
  TOOLS_WEB_RESEARCH: 'tools:web-research',
  TOOLS_YOUTUBE_TRANSCRIPT: 'tools:youtube-transcript',
  TOOLS_TONE_ANALYZER: 'tools:tone-analyzer',
  TOOLS_BROLL_GENERATOR: 'tools:broll-generator',

  // Audit operations (Phase 9)
  AUDIT_QUERY: 'audit:query',
  AUDIT_GET_STATISTICS: 'audit:getStatistics',
  AUDIT_VERIFY_INTEGRITY: 'audit:verifyIntegrity',

  // Trace operations (Phase 9)
  TRACE_LIST_SESSIONS: 'trace:listSessions',
  TRACE_GET_TIMELINE: 'trace:getTimeline',
  TRACE_GET_METRICS: 'trace:getMetrics',
  TRACE_REPLAY: 'trace:replay',

  // Policy operations (Phase 9)
  POLICY_LIST_RULES: 'policy:listRules',
  POLICY_GET_RULE: 'policy:getRule',
  POLICY_REGISTER_RULE: 'policy:registerRule',
  POLICY_UNREGISTER_RULE: 'policy:unregisterRule',
  POLICY_EVALUATE: 'policy:evaluate',
  POLICY_GET_VIOLATIONS: 'policy:getViolations',
  POLICY_GET_STATISTICS: 'policy:getStatistics',

  // Release engineering operations (Phase 11)
  RELEASE_SET_PIPELINE_CONFIG: 'release:setPipelineConfig',
  RELEASE_GET_PIPELINE_CONFIG: 'release:getPipelineConfig',
  RELEASE_REGISTER_ARTIFACT: 'release:registerArtifact',
  RELEASE_VERIFY_ARTIFACT_INTEGRITY: 'release:verifyArtifactIntegrity',
  RELEASE_PUBLISH_CHANNEL_MANIFEST: 'release:publishChannelManifest',
  RELEASE_PROMOTE_CHANNEL: 'release:promoteChannel',
  RELEASE_EXECUTE_ROLLBACK: 'release:executeRollback',
  RELEASE_RECORD_CLIENT_ROLLBACK_VERIFICATION: 'release:recordClientRollbackVerification',
  RELEASE_CAPTURE_CRASH_EVENT: 'release:captureCrashEvent',
  RELEASE_CREATE_DIAGNOSTIC_BUNDLE: 'release:createDiagnosticBundle',
  RELEASE_CREATE_RC_GATE_REVIEW: 'release:createRcGateReview',
  RELEASE_CREATE_GA_CHECKLIST: 'release:createGaChecklist',
  RELEASE_COMPLETE_GA_CHECKLIST_ITEM: 'release:completeGaChecklistItem',
  RELEASE_SIGN_OFF_GA: 'release:signOffGa',
  RELEASE_BUILD_AUDIT_RECORD: 'release:buildAuditRecord',
  RELEASE_GET_INCIDENT_SEVERITY_MATRIX: 'release:getIncidentSeverityMatrix',
  RELEASE_GET_ESCALATION_MATRIX: 'release:getEscalationMatrix',
  RELEASE_CREATE_SUPPORT_TICKET: 'release:createSupportTicket',
  RELEASE_SET_SUPPORT_TRIAGE_TAXONOMY: 'release:setSupportTriageTaxonomy',
  RELEASE_GET_SUPPORT_TRIAGE_TAXONOMY: 'release:getSupportTriageTaxonomy',
  RELEASE_CREATE_ROLLBACK_RUNBOOK: 'release:createRollbackRunbook',
  RELEASE_LIST_ROLLBACK_RUNBOOKS: 'release:listRollbackRunbooks',
  RELEASE_RECORD_ROLLBACK_DRILL: 'release:recordRollbackDrill',
  RELEASE_LIST_ROLLBACK_DRILLS: 'release:listRollbackDrills',
  RELEASE_GET_DEFAULT_ROLLBACK_RUNBOOK_TEMPLATE: 'release:getDefaultRollbackRunbookTemplate',

  // Phase 12: Collaboration
  COLLAB_CREATE_SESSION: 'collab:createSession',
  COLLAB_GET_SESSION: 'collab:getSession',
  COLLAB_ADD_MEMBER: 'collab:addMember',
  COLLAB_UPDATE_MEMBER_ROLE: 'collab:updateMemberRole',
  COLLAB_UPDATE_PRESENCE: 'collab:updatePresence',
  COLLAB_LIST_PRESENCE: 'collab:listPresence',
  COLLAB_APPLY_OPERATION: 'collab:applyOperation',

  // Phase 12: Optional account and sync
  ACCOUNT_CREATE_TENANT: 'account:createTenant',
  ACCOUNT_CREATE_IDENTITY: 'account:createIdentity',
  ACCOUNT_CREATE_SESSION: 'account:createSession',
  ACCOUNT_ADD_RECOVERY_METHOD: 'account:addRecoveryMethod',
  SYNC_QUEUE_CHANGE: 'sync:queueChange',
  SYNC_PROCESS_QUEUE: 'sync:processQueue',
  SYNC_RESOLVE_CONFLICT: 'sync:resolveConflict',
  SYNC_CREATE_RESTORE_SNAPSHOT: 'sync:createRestoreSnapshot',
  SYNC_RESTORE_TO_DEVICE: 'sync:restoreToDevice',
  SYNC_GET_STATUS: 'sync:getStatus',

  // Phase 12: Compliance program
  COMPLIANCE_MAP_CONTROL: 'compliance:mapControl',
  COMPLIANCE_CAPTURE_EVIDENCE: 'compliance:captureEvidence',
  COMPLIANCE_RECORD_INTERNAL_AUDIT: 'compliance:recordInternalAudit',
  COMPLIANCE_BUILD_GAP_PLAN: 'compliance:buildGapPlan',
  COMPLIANCE_RUN_DRY_ASSESSMENT: 'compliance:runDryAssessment',
  COMPLIANCE_PREPARE_EXTERNAL_AUDIT: 'compliance:prepareExternalAudit',
  COMPLIANCE_GET_DASHBOARD: 'compliance:getDashboard',

  // Writer Harness: Skill operations (Phase 1)
  SKILL_LIST: 'skill:list',
  SKILL_GET: 'skill:get',
  SKILL_CREATE: 'skill:create',
  SKILL_COMPOSE: 'skill:compose',
  SKILL_RESEARCH: 'skill:research',

  // Writer Harness: Workspace operations (Phase 1)
  WORKSPACE_ENSURE: 'workspace:ensure',
  WORKSPACE_GET_SESSION: 'workspace:getSession',
  WORKSPACE_UPDATE_SESSION: 'workspace:updateSession',

  // Writer Harness: Writer Loop operations (Phase 2)
  WRITER_LOOP_GET_STATE: 'writerLoop:getState',
  WRITER_LOOP_START_PLANNING: 'writerLoop:startPlanning',
  WRITER_LOOP_GET_OUTLINE: 'writerLoop:getOutline',
  WRITER_LOOP_UPDATE_OUTLINE: 'writerLoop:updateOutline',
  WRITER_LOOP_UPDATE_SECTION: 'writerLoop:updateSection',
  WRITER_LOOP_ADD_SECTION: 'writerLoop:addSection',
  WRITER_LOOP_REMOVE_SECTION: 'writerLoop:removeSection',
  WRITER_LOOP_ADD_SUBSECTION: 'writerLoop:addSubsection',
  WRITER_LOOP_REMOVE_SUBSECTION: 'writerLoop:removeSubsection',
  WRITER_LOOP_APPROVE_OUTLINE: 'writerLoop:approveOutline',
  WRITER_LOOP_UPDATE_CONFIG: 'writerLoop:updateConfig',
  WRITER_LOOP_TRANSITION: 'writerLoop:transition',
  WRITER_LOOP_PAUSE: 'writerLoop:pause',
  WRITER_LOOP_RESET: 'writerLoop:reset',

  // Writer Harness: Generator operations (Phase 3)
  WRITER_LOOP_GENERATE_SECTION: 'writerLoop:generateSection',
  WRITER_LOOP_GENERATE_ALL: 'writerLoop:generateAll',
  WRITER_LOOP_GET_PROGRESS: 'writerLoop:getProgress',
  WRITER_LOOP_ACCEPT_GENERATION: 'writerLoop:acceptGeneration',
  WRITER_LOOP_REJECT_GENERATION: 'writerLoop:rejectGeneration',

  // Writer Harness: Reviewer operations (Phase 4)
  WRITER_LOOP_RUN_REVIEW: 'writerLoop:runReview',
  WRITER_LOOP_GET_REVIEW: 'writerLoop:getReview',
  WRITER_LOOP_ACCEPT_REVIEW_FLAG: 'writerLoop:acceptReviewFlag',
  WRITER_LOOP_REJECT_REVIEW_FLAG: 'writerLoop:rejectReviewFlag',
  WRITER_LOOP_SURGICAL_EDIT: 'writerLoop:surgicalEdit',
  WRITER_LOOP_REWRITE_ALL: 'writerLoop:rewriteAll',

  // Writer Harness: Research operations (Phase 5)
  RESEARCH_GET_LOG: 'research:getLog',
  RESEARCH_ADD_ENTRY: 'research:addEntry',
  RESEARCH_UPDATE_ENTRY: 'research:updateEntry',
  RESEARCH_DELETE_ENTRY: 'research:deleteEntry',
  RESEARCH_SET_MODE: 'research:setMode',
  RESEARCH_IMPORT_FILE: 'research:importFile',
  RESEARCH_FACT_CHECK: 'research:factCheck',

  // Writer Harness: Citation operations (Phase 5)
  CITATION_FORMAT: 'citation:format',
  CITATION_GET_STYLE: 'citation:getStyle',
  CITATION_SET_STYLE: 'citation:setStyle',

  // Writer Harness: Version operations (Phase 6)
  VERSION_LIST_SNAPSHOTS: 'version:listSnapshots',
  VERSION_GET_SNAPSHOT: 'version:getSnapshot',
  VERSION_RESTORE_SNAPSHOT: 'version:restoreSnapshot',
  VERSION_ADD_MILESTONE: 'version:addMilestone',
  VERSION_DELETE_SNAPSHOT: 'version:deleteSnapshot',

  // Writer Harness: UX operations (Phase 6)
  UX_SET_ZEN_MODE: 'ux:setZenMode',
  UX_GET_ZEN_MODE: 'ux:getZenMode',
  UX_TOGGLE_ASSISTANT: 'ux:toggleAssistant',

  // Writer Harness: Pricing operations (Phase 7)
  PRICING_CALCULATE: 'pricing:calculate',
  PRICING_GET_SESSION_COST: 'pricing:getSessionCost',
  PRICING_RESET_SESSION: 'pricing:resetSession',
  PRICING_GET_GLOBAL_SUMMARY: 'pricing:getGlobalSummary',
  PRICING_GET_ALL_MODELS: 'pricing:getAllModels',
  PRICING_RECORD_ACTION: 'pricing:recordAction',

  // Writer Harness: Provider test + model selection (Phase 7)
  PROVIDER_TEST_CONNECTION: 'provider:testConnection',
  PROJECT_SET_MODEL: 'project:setModel',
  PROJECT_GET_MODEL: 'project:getModel',

  // Writer Harness: Update operations (Phase 7)
  UPDATE_CHECK: 'update:check',
  UPDATE_GET_INFO: 'update:getInfo',
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

// Audit operation types (Phase 9)
export interface AuditQueryRequest {
  filter: any // AuditQueryFilter
}

export interface AuditVerifyIntegrityRequest {
  eventId: string
}

export type AuditQueryResponse = IpcResponse<any[]> // AuditEvent[]
export type AuditGetStatisticsResponse = IpcResponse<any> // AuditStatistics
export type AuditVerifyIntegrityResponse = IpcResponse<any> // IntegrityCheckResult

// Trace operation types (Phase 9)
export interface TraceListSessionsRequest {
  filter: any // TraceFilterOptions
}

export interface TraceGetTimelineRequest {
  sessionId: string
}

export interface TraceGetMetricsRequest {
  sessionId: string
}

export interface TraceReplayRequest {
  config: any // ReplayConfiguration
}

export type TraceListSessionsResponse = IpcResponse<any[]> // TraceSessionSummary[]
export type TraceGetTimelineResponse = IpcResponse<any[]> // TraceTimelineEntry[]
export type TraceGetMetricsResponse = IpcResponse<any> // TraceMetrics
export type TraceReplayResponse = IpcResponse<any> // ReplayDiagnostics

// Policy operation types (Phase 9)
export interface PolicyGetRuleRequest {
  ruleId: string
}

export interface PolicyRegisterRuleRequest {
  rule: any // PolicyRule
}

export interface PolicyUnregisterRuleRequest {
  ruleId: string
}

export interface PolicyEvaluateRequest {
  context: any // PolicyEvaluationContext
}

export interface PolicyGetViolationsRequest {
  limit?: number
}

export type PolicyListRulesResponse = IpcResponse<any[]> // PolicyRule[]
export type PolicyGetRuleResponse = IpcResponse<any> // PolicyRule
export type PolicyRegisterRuleResponse = IpcResponse<boolean>
export type PolicyUnregisterRuleResponse = IpcResponse<boolean>
export type PolicyEvaluateResponse = IpcResponse<any> // PolicyEvaluationResult
export type PolicyGetViolationsResponse = IpcResponse<any[]> // PolicyViolation[]
export type PolicyGetStatisticsResponse = IpcResponse<any> // PolicyStatistics

// Release operation types (Phase 11)
export interface ReleaseSetPipelineConfigRequest {
  config: any // Partial<SignedInstallerPipelineConfig>
}

export interface ReleaseRegisterArtifactRequest {
  filePath: string
  params: {
    version: string
    channel: 'stable' | 'beta'
    platform: 'win32' | 'darwin'
    arch: 'x64' | 'arm64'
    signed?: boolean
    notarized?: boolean
    signature?: any // ArtifactSignature
    metadata?: Record<string, unknown>
  }
}

export interface ReleaseVerifyArtifactIntegrityRequest {
  artifact: any // ReleaseArtifact
}

export interface ReleasePublishChannelManifestRequest {
  version: string
  channel: 'stable' | 'beta'
  feedUrl: string
  artifacts: any[] // ReleaseArtifact[]
  stagedRollout?: any // StagedRollout
}

export interface ReleasePromoteChannelRequest {
  request: any // ChannelPromotionRequest
}

export interface ReleaseExecuteRollbackRequest {
  plan: any // RollbackPlan
}

export interface ReleaseRecordClientRollbackVerificationRequest {
  verification: any // ClientRollbackVerification
}

export interface ReleaseCaptureCrashEventRequest {
  event: any // Omit<CrashCaptureEvent, 'id' | 'occurredAt'>
}

export interface ReleaseCreateDiagnosticBundleRequest {
  appVersion: string
  platform: 'win32' | 'darwin'
  arch: 'x64' | 'arm64'
  sourceFiles: string[]
}

export interface ReleaseCreateRcGateReviewRequest {
  version: string
  channel: 'stable' | 'beta'
  reviewedBy: string
  functional: any[] // GateReviewCheck[]
  security: any[] // GateReviewCheck[]
  performance: any[] // GateReviewCheck[]
}

export interface ReleaseCreateGaChecklistRequest {
  version: string
  signOffRequiredBy: string[]
}

export interface ReleaseCompleteGaChecklistItemRequest {
  version: string
  itemId: string
  completedBy: string
  evidence?: string[]
  notes?: string
}

export interface ReleaseSignOffGaRequest {
  version: string
  signOff: any // SignOffRecord
}

export interface ReleaseBuildAuditRecordRequest {
  version: string
  channel: 'stable' | 'beta'
  artifacts: any[] // ReleaseArtifact[]
  gateReview: any // ReleaseCandidateGateReview
  gaChecklist: any // GaLaunchChecklist
  rollbackPlan: any // RollbackPlan
}

export interface ReleaseCreateSupportTicketRequest {
  ticket: any // Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>
}

export interface ReleaseSetSupportTriageTaxonomyRequest {
  taxonomy: any // SupportTriageTaxonomy
}

export interface ReleaseCreateRollbackRunbookRequest {
  runbook: any // Omit<RollbackRunbook, 'id'>
}

export interface ReleaseRecordRollbackDrillRequest {
  drill: any // Omit<RollbackDrillRecord, 'id'>
}

export interface ReleaseGetDefaultRollbackRunbookTemplateRequest {
  channel: 'stable' | 'beta'
}

export type ReleaseSetPipelineConfigResponse = IpcResponse<any> // SignedInstallerPipelineConfig
export type ReleaseGetPipelineConfigResponse = IpcResponse<any> // SignedInstallerPipelineConfig
export type ReleaseRegisterArtifactResponse = IpcResponse<any> // ReleaseArtifact
export type ReleaseVerifyArtifactIntegrityResponse = IpcResponse<any> // ArtifactIntegrityResult
export type ReleasePublishChannelManifestResponse = IpcResponse<any> // ReleaseManifest
export type ReleasePromoteChannelResponse = IpcResponse<any> // ChannelPromotionResult
export type ReleaseExecuteRollbackResponse = IpcResponse<any> // RollbackExecutionResult
export type ReleaseRecordClientRollbackVerificationResponse = IpcResponse<any[]> // ClientRollbackVerification[]
export type ReleaseCaptureCrashEventResponse = IpcResponse<any> // CrashCaptureEvent
export type ReleaseCreateDiagnosticBundleResponse = IpcResponse<any> // DiagnosticBundle
export type ReleaseCreateRcGateReviewResponse = IpcResponse<any> // ReleaseCandidateGateReview
export type ReleaseCreateGaChecklistResponse = IpcResponse<any> // GaLaunchChecklist
export type ReleaseCompleteGaChecklistItemResponse = IpcResponse<any> // GaLaunchChecklist
export type ReleaseSignOffGaResponse = IpcResponse<any> // GaLaunchChecklist
export type ReleaseBuildAuditRecordResponse = IpcResponse<any> // ReleaseAuditRecord
export type ReleaseGetIncidentSeverityMatrixResponse = IpcResponse<any[]> // IncidentSeverityLevel[]
export type ReleaseGetEscalationMatrixResponse = IpcResponse<any[]> // EscalationRule[]
export type ReleaseCreateSupportTicketResponse = IpcResponse<any> // SupportTicket
export type ReleaseSetSupportTriageTaxonomyResponse = IpcResponse<any> // SupportTriageTaxonomy
export type ReleaseGetSupportTriageTaxonomyResponse = IpcResponse<any> // SupportTriageTaxonomy
export type ReleaseCreateRollbackRunbookResponse = IpcResponse<any> // RollbackRunbook
export type ReleaseListRollbackRunbooksResponse = IpcResponse<any[]> // RollbackRunbook[]
export type ReleaseRecordRollbackDrillResponse = IpcResponse<any> // RollbackDrillRecord
export type ReleaseListRollbackDrillsResponse = IpcResponse<any[]> // RollbackDrillRecord[]
export type ReleaseGetDefaultRollbackRunbookTemplateResponse = IpcResponse<any> // Omit<RollbackRunbook, 'id'>

// Type guards for audit operations
export function isAuditQueryRequest(payload: any): payload is AuditQueryRequest {
  return typeof payload === 'object'
}

export function isAuditVerifyIntegrityRequest(payload: any): payload is AuditVerifyIntegrityRequest {
  return typeof payload === 'object' && typeof payload.eventId === 'string'
}

// Type guards for trace operations
export function isTraceListSessionsRequest(payload: any): payload is TraceListSessionsRequest {
  return typeof payload === 'object'
}

export function isTraceGetTimelineRequest(payload: any): payload is TraceGetTimelineRequest {
  return typeof payload === 'object' && typeof payload.sessionId === 'string'
}

export function isTraceGetMetricsRequest(payload: any): payload is TraceGetMetricsRequest {
  return typeof payload === 'object' && typeof payload.sessionId === 'string'
}

export function isTraceReplayRequest(payload: any): payload is TraceReplayRequest {
  return typeof payload === 'object' && payload.config !== undefined
}

// Type guards for policy operations
export function isPolicyGetRuleRequest(payload: any): payload is PolicyGetRuleRequest {
  return typeof payload === 'object' && typeof payload.ruleId === 'string'
}

export function isPolicyRegisterRuleRequest(payload: any): payload is PolicyRegisterRuleRequest {
  return typeof payload === 'object' && payload.rule !== undefined
}

export function isPolicyUnregisterRuleRequest(payload: any): payload is PolicyUnregisterRuleRequest {
  return typeof payload === 'object' && typeof payload.ruleId === 'string'
}

export function isPolicyEvaluateRequest(payload: any): payload is PolicyEvaluateRequest {
  return typeof payload === 'object' && payload.context !== undefined
}

export function isPolicyGetViolationsRequest(payload: any): payload is PolicyGetViolationsRequest {
  return typeof payload === 'object'
}

// Type guards for release operations (Phase 11)
export function isReleaseSetPipelineConfigRequest(payload: any): payload is ReleaseSetPipelineConfigRequest {
  return typeof payload === 'object' && payload.config !== undefined
}

export function isReleaseRegisterArtifactRequest(payload: any): payload is ReleaseRegisterArtifactRequest {
  return typeof payload === 'object' && typeof payload.filePath === 'string' && typeof payload.params === 'object'
}

export function isReleaseVerifyArtifactIntegrityRequest(
  payload: any,
): payload is ReleaseVerifyArtifactIntegrityRequest {
  return typeof payload === 'object' && payload.artifact !== undefined
}

export function isReleasePromoteChannelRequest(payload: any): payload is ReleasePromoteChannelRequest {
  return typeof payload === 'object' && payload.request !== undefined
}

export function isReleaseExecuteRollbackRequest(payload: any): payload is ReleaseExecuteRollbackRequest {
  return typeof payload === 'object' && payload.plan !== undefined
}

export function isReleaseRecordClientRollbackVerificationRequest(
  payload: any,
): payload is ReleaseRecordClientRollbackVerificationRequest {
  return typeof payload === 'object' && payload.verification !== undefined
}

export function isReleaseCaptureCrashEventRequest(payload: any): payload is ReleaseCaptureCrashEventRequest {
  return typeof payload === 'object' && payload.event !== undefined
}

export function isReleaseCreateDiagnosticBundleRequest(payload: any): payload is ReleaseCreateDiagnosticBundleRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.appVersion === 'string' &&
    typeof payload.platform === 'string' &&
    typeof payload.arch === 'string' &&
    Array.isArray(payload.sourceFiles)
  )
}

export function isReleaseCreateRcGateReviewRequest(payload: any): payload is ReleaseCreateRcGateReviewRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.version === 'string' &&
    typeof payload.channel === 'string' &&
    typeof payload.reviewedBy === 'string' &&
    Array.isArray(payload.functional) &&
    Array.isArray(payload.security) &&
    Array.isArray(payload.performance)
  )
}

export function isReleaseCreateGaChecklistRequest(payload: any): payload is ReleaseCreateGaChecklistRequest {
  return typeof payload === 'object' && typeof payload.version === 'string' && Array.isArray(payload.signOffRequiredBy)
}

export function isReleaseCompleteGaChecklistItemRequest(
  payload: any,
): payload is ReleaseCompleteGaChecklistItemRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.version === 'string' &&
    typeof payload.itemId === 'string' &&
    typeof payload.completedBy === 'string'
  )
}

export function isReleaseSignOffGaRequest(payload: any): payload is ReleaseSignOffGaRequest {
  return typeof payload === 'object' && typeof payload.version === 'string' && payload.signOff !== undefined
}

export function isReleaseBuildAuditRecordRequest(payload: any): payload is ReleaseBuildAuditRecordRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.version === 'string' &&
    typeof payload.channel === 'string' &&
    Array.isArray(payload.artifacts) &&
    payload.gateReview !== undefined &&
    payload.gaChecklist !== undefined &&
    payload.rollbackPlan !== undefined
  )
}

export function isReleasePublishChannelManifestRequest(payload: any): payload is ReleasePublishChannelManifestRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.version === 'string' &&
    (payload.channel === 'stable' || payload.channel === 'beta') &&
    typeof payload.feedUrl === 'string' &&
    Array.isArray(payload.artifacts)
  )
}

export function isReleaseCreateSupportTicketRequest(payload: any): payload is ReleaseCreateSupportTicketRequest {
  return typeof payload === 'object' && payload.ticket !== undefined
}

export function isReleaseSetSupportTriageTaxonomyRequest(
  payload: any,
): payload is ReleaseSetSupportTriageTaxonomyRequest {
  return typeof payload === 'object' && payload.taxonomy !== undefined
}

export function isReleaseCreateRollbackRunbookRequest(payload: any): payload is ReleaseCreateRollbackRunbookRequest {
  return typeof payload === 'object' && payload.runbook !== undefined
}

export function isReleaseRecordRollbackDrillRequest(payload: any): payload is ReleaseRecordRollbackDrillRequest {
  return typeof payload === 'object' && payload.drill !== undefined
}

export function isReleaseGetDefaultRollbackRunbookTemplateRequest(
  payload: any,
): payload is ReleaseGetDefaultRollbackRunbookTemplateRequest {
  return typeof payload === 'object' && (payload.channel === 'stable' || payload.channel === 'beta')
}

// Phase 12 operation types
export interface CollaborationCreateSessionRequest {
  documentId: string
  owner: {
    userId: string
    displayName: string
  }
}

export interface CollaborationGetSessionRequest {
  documentId: string
}

export interface CollaborationAddMemberRequest {
  documentId: string
  member: {
    userId: string
    displayName: string
    role: 'owner' | 'editor' | 'commenter' | 'viewer'
  }
}

export interface CollaborationUpdateMemberRoleRequest {
  documentId: string
  userId: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
}

export interface CollaborationUpdatePresenceRequest {
  presence: {
    userId: string
    documentId: string
    status: 'active' | 'idle' | 'offline'
    cursorPos: number
    selection: {
      from: number
      to: number
    }
  }
}

export interface CollaborationListPresenceRequest {
  documentId: string
}

export interface CollaborationApplyOperationRequest {
  operation: {
    opId: string
    documentId: string
    actorId: string
    baseRevision: number
    timestamp: number
    patch: {
      from: number
      to: number
      insertText: string
    }
  }
}

export interface AccountCreateTenantRequest {
  tenantId: string
  workspaceId: string
  displayName: string
  createdBy: string
}

export interface AccountCreateIdentityRequest {
  email: string
  displayName: string
  tenantId: string
  mfaEnabled: boolean
}

export interface AccountCreateSessionRequest {
  accountId: string
  deviceId: string
  durationMs: number
}

export interface AccountAddRecoveryMethodRequest {
  accountId: string
  type: 'backup-code' | 'email-otp' | 'authenticator-app'
}

export interface SyncQueueChangeRequest {
  tenantId: string
  workspaceId: string
  deviceId: string
  documentId: string
  baseRevision: number
  plainPayload: string
  encryptionKey: string
}

export interface SyncResolveConflictRequest {
  strategy: 'last-writer-wins' | 'manual-merge'
  localPayload: string
  remotePayload: string
  localTimestamp: number
  remoteTimestamp: number
}

export interface SyncCreateRestoreSnapshotRequest {
  accountId: string
  tenantId: string
  workspaceId: string
  sourceDeviceId: string
  plainState: string
  encryptionKey: string
}

export interface SyncRestoreToDeviceRequest {
  snapshotId: string
  encryptionKey: string
}

export interface SyncGetStatusRequest {
  workspaceId: string
}

export interface ComplianceMapControlRequest {
  framework: 'SOC2' | 'ISO27001' | 'Internal'
  controlId: string
  owner: string
  description: string
}

export interface ComplianceCaptureEvidenceRequest {
  controlId: string
  artifactPath: string
  artifactHash: string
  capturedBy: string
}

export interface ComplianceRecordInternalAuditRequest {
  scope: string
  executedBy: string
  findings: string[]
}

export interface ComplianceBuildGapPlanRequest {
  gaps: string[]
}

export interface ComplianceRunDryAssessmentRequest {
  summary: string
}

export interface CompliancePrepareExternalAuditRequest {
  summary: string
}

export function isCollaborationCreateSessionRequest(payload: any): payload is CollaborationCreateSessionRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.documentId === 'string' &&
    typeof payload.owner === 'object' &&
    typeof payload.owner.userId === 'string' &&
    typeof payload.owner.displayName === 'string'
  )
}

export function isCollaborationGetSessionRequest(payload: any): payload is CollaborationGetSessionRequest {
  return typeof payload === 'object' && typeof payload.documentId === 'string'
}

export function isCollaborationAddMemberRequest(payload: any): payload is CollaborationAddMemberRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.documentId === 'string' &&
    typeof payload.member === 'object' &&
    typeof payload.member.userId === 'string' &&
    typeof payload.member.displayName === 'string' &&
    typeof payload.member.role === 'string'
  )
}

export function isCollaborationUpdateMemberRoleRequest(payload: any): payload is CollaborationUpdateMemberRoleRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.documentId === 'string' &&
    typeof payload.userId === 'string' &&
    typeof payload.role === 'string'
  )
}

export function isCollaborationUpdatePresenceRequest(payload: any): payload is CollaborationUpdatePresenceRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.presence === 'object' &&
    typeof payload.presence.userId === 'string' &&
    typeof payload.presence.documentId === 'string' &&
    typeof payload.presence.status === 'string' &&
    typeof payload.presence.cursorPos === 'number' &&
    typeof payload.presence.selection === 'object' &&
    typeof payload.presence.selection.from === 'number' &&
    typeof payload.presence.selection.to === 'number'
  )
}

export function isCollaborationListPresenceRequest(payload: any): payload is CollaborationListPresenceRequest {
  return typeof payload === 'object' && typeof payload.documentId === 'string'
}

export function isCollaborationApplyOperationRequest(payload: any): payload is CollaborationApplyOperationRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.operation === 'object' &&
    typeof payload.operation.opId === 'string' &&
    typeof payload.operation.documentId === 'string' &&
    typeof payload.operation.actorId === 'string' &&
    typeof payload.operation.baseRevision === 'number' &&
    typeof payload.operation.timestamp === 'number' &&
    typeof payload.operation.patch === 'object' &&
    typeof payload.operation.patch.from === 'number' &&
    typeof payload.operation.patch.to === 'number' &&
    typeof payload.operation.patch.insertText === 'string'
  )
}

export function isAccountCreateTenantRequest(payload: any): payload is AccountCreateTenantRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.tenantId === 'string' &&
    typeof payload.workspaceId === 'string' &&
    typeof payload.displayName === 'string' &&
    typeof payload.createdBy === 'string'
  )
}

export function isAccountCreateIdentityRequest(payload: any): payload is AccountCreateIdentityRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.email === 'string' &&
    typeof payload.displayName === 'string' &&
    typeof payload.tenantId === 'string' &&
    typeof payload.mfaEnabled === 'boolean'
  )
}

export function isAccountCreateSessionRequest(payload: any): payload is AccountCreateSessionRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.accountId === 'string' &&
    typeof payload.deviceId === 'string' &&
    typeof payload.durationMs === 'number'
  )
}

export function isAccountAddRecoveryMethodRequest(payload: any): payload is AccountAddRecoveryMethodRequest {
  return typeof payload === 'object' && typeof payload.accountId === 'string' && typeof payload.type === 'string'
}

export function isSyncQueueChangeRequest(payload: any): payload is SyncQueueChangeRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.tenantId === 'string' &&
    typeof payload.workspaceId === 'string' &&
    typeof payload.deviceId === 'string' &&
    typeof payload.documentId === 'string' &&
    typeof payload.baseRevision === 'number' &&
    typeof payload.plainPayload === 'string' &&
    typeof payload.encryptionKey === 'string'
  )
}

export function isSyncResolveConflictRequest(payload: any): payload is SyncResolveConflictRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.strategy === 'string' &&
    typeof payload.localPayload === 'string' &&
    typeof payload.remotePayload === 'string' &&
    typeof payload.localTimestamp === 'number' &&
    typeof payload.remoteTimestamp === 'number'
  )
}

export function isSyncCreateRestoreSnapshotRequest(payload: any): payload is SyncCreateRestoreSnapshotRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.accountId === 'string' &&
    typeof payload.tenantId === 'string' &&
    typeof payload.workspaceId === 'string' &&
    typeof payload.sourceDeviceId === 'string' &&
    typeof payload.plainState === 'string' &&
    typeof payload.encryptionKey === 'string'
  )
}

export function isSyncRestoreToDeviceRequest(payload: any): payload is SyncRestoreToDeviceRequest {
  return (
    typeof payload === 'object' && typeof payload.snapshotId === 'string' && typeof payload.encryptionKey === 'string'
  )
}

export function isSyncGetStatusRequest(payload: any): payload is SyncGetStatusRequest {
  return typeof payload === 'object' && typeof payload.workspaceId === 'string'
}

export function isComplianceMapControlRequest(payload: any): payload is ComplianceMapControlRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.framework === 'string' &&
    typeof payload.controlId === 'string' &&
    typeof payload.owner === 'string' &&
    typeof payload.description === 'string'
  )
}

export function isComplianceCaptureEvidenceRequest(payload: any): payload is ComplianceCaptureEvidenceRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.controlId === 'string' &&
    typeof payload.artifactPath === 'string' &&
    typeof payload.artifactHash === 'string' &&
    typeof payload.capturedBy === 'string'
  )
}

export function isComplianceRecordInternalAuditRequest(payload: any): payload is ComplianceRecordInternalAuditRequest {
  return (
    typeof payload === 'object' &&
    typeof payload.scope === 'string' &&
    typeof payload.executedBy === 'string' &&
    Array.isArray(payload.findings)
  )
}

export function isComplianceBuildGapPlanRequest(payload: any): payload is ComplianceBuildGapPlanRequest {
  return typeof payload === 'object' && Array.isArray(payload.gaps)
}

export function isComplianceRunDryAssessmentRequest(payload: any): payload is ComplianceRunDryAssessmentRequest {
  return typeof payload === 'object' && typeof payload.summary === 'string'
}

export function isCompliancePrepareExternalAuditRequest(
  payload: any,
): payload is CompliancePrepareExternalAuditRequest {
  return typeof payload === 'object' && typeof payload.summary === 'string'
}

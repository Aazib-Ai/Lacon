import { contextBridge, ipcRenderer } from 'electron'

import { type IpcChannel, IPC_CHANNELS, isValidChannel } from '@/shared/ipc-schema'
import type { IpcAPI, Phase12API, ReleaseAPI } from '@/shared/types'

// Whitelist of allowed IPC channels
const ALLOWED_CHANNELS = new Set(Object.values(IPC_CHANNELS))

/**
 * Validate that a channel is allowed
 */
function validateChannel(channel: string): void {
  if (!isValidChannel(channel) || !ALLOWED_CHANNELS.has(channel as IpcChannel)) {
    throw new Error(`IPC channel not allowed: ${channel}`)
  }
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: IpcAPI = {
  invoke: async (channel: string, payload?: any) => {
    validateChannel(channel)
    return ipcRenderer.invoke(channel, payload)
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    validateChannel(channel)
    ipcRenderer.on(channel, (event, ...args) => listener(...args))
  },
  removeListener: (channel: string, listener: (...args: any[]) => void) => {
    validateChannel(channel)
    ipcRenderer.removeListener(channel, listener)
  },
}

// Agent runtime API (Phase 6)
const agentAPI = {
  startRun: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_START_RUN, payload),
  cancelRun: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_CANCEL_RUN, payload),
  getRunStatus: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_RUN_STATUS, payload),
  approveRequest: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPROVE_REQUEST, payload),
  rejectRequest: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_REJECT_REQUEST, payload),
  getPendingApprovals: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_PENDING_APPROVALS),
  registerTool: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_REGISTER_TOOL, payload),
}

// Provider API (Phase 7)
const providerAPI = {
  register: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_REGISTER, config),
  unregister: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_UNREGISTER, providerId),
  list: () => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_LIST),
  getModels: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_GET_MODELS, providerId),
  checkHealth: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_CHECK_HEALTH, providerId),
  checkAllHealth: () => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_CHECK_ALL_HEALTH),
  setFallback: (primary: string, fallbacks: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_SET_FALLBACK, primary, fallbacks),
  getUsage: (filter?: any) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_GET_USAGE, filter),
  getUsageSummary: (providerId?: string) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_GET_USAGE_SUMMARY, providerId),
  chatCompletion: (providerId: string, request: any, feature: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_CHAT_COMPLETION, providerId, request, feature),
  streamStart: (providerId: string, request: any, feature: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_STREAM_START, providerId, request, feature),
  createKey: (providerId: string, providerType: string, label: string, apiKey: string) =>
    ipcRenderer.invoke('provider:createKey', providerId, providerType, label, apiKey),
  onStreamChunk: (callback: (streamId: string, chunk: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PROVIDER_STREAM_CHUNK, (event, streamId, chunk) => callback(streamId, chunk))
  },
  onStreamComplete: (callback: (streamId: string, usage: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PROVIDER_STREAM_COMPLETE, (event, streamId, usage) => callback(streamId, usage))
  },
  onStreamError: (callback: (streamId: string, error: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PROVIDER_STREAM_ERROR, (event, streamId, error) => callback(streamId, error))
  },
}

// Tool API (Phase 8)
const toolAPI = {
  list: () => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_LIST),
  listByCategory: (category: string) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_LIST_BY_CATEGORY, category),
  execute: (toolName: string, input: any) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_EXECUTE, toolName, input),
  authoring: (toolName: string, input: any) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_AUTHORING, toolName, input),
  workspaceQA: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_WORKSPACE_QA, input),
  webResearch: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_WEB_RESEARCH, input),
  youtubeTranscript: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_YOUTUBE_TRANSCRIPT, input),
  toneAnalyzer: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_TONE_ANALYZER, input),
  brollGenerator: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_BROLL_GENERATOR, input),
}

// Audit API (Phase 9)
const auditAPI = {
  query: (filter: any) => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_QUERY, { filter }),
  getStatistics: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_GET_STATISTICS),
  verifyIntegrity: (eventId: string) => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_VERIFY_INTEGRITY, { eventId }),
}

// Trace API (Phase 9)
const traceAPI = {
  listSessions: (filter: any) => ipcRenderer.invoke(IPC_CHANNELS.TRACE_LIST_SESSIONS, { filter }),
  getTimeline: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.TRACE_GET_TIMELINE, { sessionId }),
  getMetrics: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.TRACE_GET_METRICS, { sessionId }),
  replay: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.TRACE_REPLAY, { config }),
}

// Policy API (Phase 9)
const policyAPI = {
  listRules: () => ipcRenderer.invoke(IPC_CHANNELS.POLICY_LIST_RULES),
  getRule: (ruleId: string) => ipcRenderer.invoke(IPC_CHANNELS.POLICY_GET_RULE, { ruleId }),
  registerRule: (rule: any) => ipcRenderer.invoke(IPC_CHANNELS.POLICY_REGISTER_RULE, { rule }),
  unregisterRule: (ruleId: string) => ipcRenderer.invoke(IPC_CHANNELS.POLICY_UNREGISTER_RULE, { ruleId }),
  evaluate: (context: any) => ipcRenderer.invoke(IPC_CHANNELS.POLICY_EVALUATE, { context }),
  getViolations: (limit?: number) => ipcRenderer.invoke(IPC_CHANNELS.POLICY_GET_VIOLATIONS, { limit }),
  getStatistics: () => ipcRenderer.invoke(IPC_CHANNELS.POLICY_GET_STATISTICS),
}

// Release API (Phase 11)
const releaseAPI: ReleaseAPI = {
  setPipelineConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_SET_PIPELINE_CONFIG, { config }),
  getPipelineConfig: () => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_GET_PIPELINE_CONFIG),
  registerArtifact: (filePath: string, params: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_REGISTER_ARTIFACT, { filePath, params }),
  verifyArtifactIntegrity: (artifact: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_VERIFY_ARTIFACT_INTEGRITY, { artifact }),
  publishChannelManifest: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_PUBLISH_CHANNEL_MANIFEST, payload),
  promoteChannel: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_PROMOTE_CHANNEL, { request }),
  executeRollback: (plan: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_EXECUTE_ROLLBACK, { plan }),
  recordClientRollbackVerification: (verification: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_RECORD_CLIENT_ROLLBACK_VERIFICATION, { verification }),
  captureCrashEvent: (event: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_CAPTURE_CRASH_EVENT, { event }),
  createDiagnosticBundle: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_CREATE_DIAGNOSTIC_BUNDLE, payload),
  createRcGateReview: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_CREATE_RC_GATE_REVIEW, payload),
  createGaChecklist: (version: string, signOffRequiredBy: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_CREATE_GA_CHECKLIST, { version, signOffRequiredBy }),
  completeGaChecklistItem: (payload: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_COMPLETE_GA_CHECKLIST_ITEM, payload),
  signOffGa: (version: string, signOff: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_SIGN_OFF_GA, { version, signOff }),
  buildAuditRecord: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_BUILD_AUDIT_RECORD, payload),
  getIncidentSeverityMatrix: () => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_GET_INCIDENT_SEVERITY_MATRIX),
  getEscalationMatrix: () => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_GET_ESCALATION_MATRIX),
  createSupportTicket: (ticket: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_CREATE_SUPPORT_TICKET, { ticket }),
  setSupportTriageTaxonomy: (taxonomy: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_SET_SUPPORT_TRIAGE_TAXONOMY, { taxonomy }),
  getSupportTriageTaxonomy: () => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_GET_SUPPORT_TRIAGE_TAXONOMY),
  createRollbackRunbook: (runbook: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_CREATE_ROLLBACK_RUNBOOK, { runbook }),
  listRollbackRunbooks: () => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_LIST_ROLLBACK_RUNBOOKS),
  recordRollbackDrill: (drill: any) => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_RECORD_ROLLBACK_DRILL, { drill }),
  listRollbackDrills: () => ipcRenderer.invoke(IPC_CHANNELS.RELEASE_LIST_ROLLBACK_DRILLS),
  getDefaultRollbackRunbookTemplate: (channel: 'stable' | 'beta') =>
    ipcRenderer.invoke(IPC_CHANNELS.RELEASE_GET_DEFAULT_ROLLBACK_RUNBOOK_TEMPLATE, { channel }),
}

// Phase 12 API
const phase12API: Phase12API = {
  createCollabSession: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.COLLAB_CREATE_SESSION, payload),
  getCollabSession: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.COLLAB_GET_SESSION, { documentId }),
  addCollabMember: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.COLLAB_ADD_MEMBER, payload),
  updateCollabRole: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.COLLAB_UPDATE_MEMBER_ROLE, payload),
  updatePresence: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.COLLAB_UPDATE_PRESENCE, payload),
  listPresence: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.COLLAB_LIST_PRESENCE, { documentId }),
  applyOperation: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.COLLAB_APPLY_OPERATION, payload),
  createTenant: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_CREATE_TENANT, payload),
  createAccount: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_CREATE_IDENTITY, payload),
  createAccountSession: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_CREATE_SESSION, payload),
  addRecoveryMethod: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_ADD_RECOVERY_METHOD, payload),
  queueSyncChange: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_QUEUE_CHANGE, payload),
  processSyncQueue: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_PROCESS_QUEUE, {}),
  resolveSyncConflict: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RESOLVE_CONFLICT, payload),
  createRestoreSnapshot: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_CREATE_RESTORE_SNAPSHOT, payload),
  restoreToDevice: (snapshotId: string, encryptionKey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_RESTORE_TO_DEVICE, { snapshotId, encryptionKey }),
  getSyncStatus: (workspaceId: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS, { workspaceId }),
  mapControl: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.COMPLIANCE_MAP_CONTROL, payload),
  captureEvidence: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.COMPLIANCE_CAPTURE_EVIDENCE, payload),
  recordInternalAudit: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.COMPLIANCE_RECORD_INTERNAL_AUDIT, payload),
  buildGapPlan: (gaps: string[]) => ipcRenderer.invoke(IPC_CHANNELS.COMPLIANCE_BUILD_GAP_PLAN, { gaps }),
  runDryAssessment: (summary: string) => ipcRenderer.invoke(IPC_CHANNELS.COMPLIANCE_RUN_DRY_ASSESSMENT, { summary }),
  prepareExternalAudit: (summary: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMPLIANCE_PREPARE_EXTERNAL_AUDIT, { summary }),
  getComplianceDashboard: () => ipcRenderer.invoke(IPC_CHANNELS.COMPLIANCE_GET_DASHBOARD, {}),
}

// Skill API (Phase 1 - Writer Harness)
const skillAPI = {
  list: (payload?: any) => ipcRenderer.invoke(IPC_CHANNELS.SKILL_LIST, payload || {}),
  get: (id: string, documentId?: string) => ipcRenderer.invoke(IPC_CHANNELS.SKILL_GET, { id, documentId }),
  create: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.SKILL_CREATE, payload),
  compose: (skillIds: string[], documentId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILL_COMPOSE, { skillIds, documentId }),
  research: (topic: string, documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILL_RESEARCH, { topic, documentId }),
}

// Workspace API (Phase 1 - Writer Harness)
const workspaceAPI = {
  ensure: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ENSURE, { documentId }),
  getSession: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_SESSION, { documentId }),
  updateSession: (documentId: string, updates: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_SESSION, { documentId, updates }),
}

// Writer Loop API (Phase 2 - Writer Harness)
const writerLoopAPI = {
  getState: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_GET_STATE, { documentId }),
  startPlanning: (documentId: string, instruction: string, composedSkillPrompt?: string, researchContext?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_START_PLANNING, {
      documentId,
      instruction,
      composedSkillPrompt,
      researchContext,
    }),
  getOutline: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_GET_OUTLINE, { documentId }),
  updateOutline: (documentId: string, outline: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_UPDATE_OUTLINE, { documentId, outline }),
  updateSection: (documentId: string, sectionId: string, updates: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_UPDATE_SECTION, { documentId, sectionId, updates }),
  addSection: (documentId: string, section?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_ADD_SECTION, { documentId, section }),
  removeSection: (documentId: string, sectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_REMOVE_SECTION, { documentId, sectionId }),
  addSubsection: (documentId: string, sectionId: string, subsection?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_ADD_SUBSECTION, { documentId, sectionId, subsection }),
  removeSubsection: (documentId: string, sectionId: string, subsectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_REMOVE_SUBSECTION, { documentId, sectionId, subsectionId }),
  approveOutline: (documentId: string, documentContent?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_APPROVE_OUTLINE, { documentId, documentContent }),
  updateConfig: (documentId: string, config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_UPDATE_CONFIG, { documentId, ...config }),
  transition: (documentId: string, stage: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_TRANSITION, { documentId, stage }),
  pause: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_PAUSE, { documentId }),
  reset: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_RESET, { documentId }),
  // Phase 3: Generator
  generateSection: (documentId: string, sectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_GENERATE_SECTION, { documentId, sectionId }),
  generateAll: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_GENERATE_ALL, { documentId }),
  getProgress: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_GET_PROGRESS, { documentId }),
  acceptGeneration: (documentId: string, sectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_ACCEPT_GENERATION, { documentId, sectionId }),
  rejectGeneration: (documentId: string, sectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_REJECT_GENERATION, { documentId, sectionId }),
  // Phase 4: Reviewer
  runReview: (documentId: string, documentContent: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_RUN_REVIEW, { documentId, documentContent }),
  getReview: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_GET_REVIEW, { documentId }),
  acceptReviewFlag: (documentId: string, flagId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_ACCEPT_REVIEW_FLAG, { documentId, flagId }),
  rejectReviewFlag: (documentId: string, flagId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_REJECT_REVIEW_FLAG, { documentId, flagId }),
  surgicalEdit: (documentId: string, paragraphId: string, instruction: string, fullDocumentContent: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_SURGICAL_EDIT, {
      documentId,
      paragraphId,
      instruction,
      fullDocumentContent,
    }),
  rewriteAll: (documentId: string, instruction: string, documentContent: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITER_LOOP_REWRITE_ALL, { documentId, instruction, documentContent }),
}

// Research API (Phase 5 - Writer Harness)
const researchAPI = {
  getLog: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_GET_LOG, { documentId }),
  addEntry: (
    documentId: string,
    query: string,
    sources?: any[],
    excerpts?: string[],
    linkedSectionIds?: string[],
    tags?: string[],
  ) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_ADD_ENTRY, {
      documentId,
      query,
      sources,
      excerpts,
      linkedSectionIds,
      tags,
    }),
  updateEntry: (documentId: string, entryId: string, updates: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_UPDATE_ENTRY, { documentId, entryId, updates }),
  deleteEntry: (documentId: string, entryId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_DELETE_ENTRY, { documentId, entryId }),
  setMode: (documentId: string, mode: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_SET_MODE, { documentId, mode }),
  importFile: (documentId: string, filePath: string, fileType: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_IMPORT_FILE, { documentId, filePath, fileType }),
  factCheck: (documentId: string, sectionId: string, sectionContent: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_FACT_CHECK, { documentId, sectionId, sectionContent }),
}

// Citation API (Phase 5 - Writer Harness)
const citationAPI = {
  format: (documentId: string, entryId: string, style?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CITATION_FORMAT, { documentId, entryId, style }),
  getStyle: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.CITATION_GET_STYLE, { documentId }),
  setStyle: (documentId: string, style: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CITATION_SET_STYLE, { documentId, style }),
}

// Version API (Phase 6 - Writer Harness)
const versionAPI = {
  listSnapshots: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.VERSION_LIST_SNAPSHOTS, { documentId }),
  getSnapshot: (documentId: string, snapshotId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VERSION_GET_SNAPSHOT, { documentId, snapshotId }),
  restoreSnapshot: (documentId: string, snapshotId: string, currentContent: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.VERSION_RESTORE_SNAPSHOT, { documentId, snapshotId, currentContent }),
  addMilestone: (documentId: string, snapshotId: string, label: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VERSION_ADD_MILESTONE, { documentId, snapshotId, label }),
  deleteSnapshot: (documentId: string, snapshotId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VERSION_DELETE_SNAPSHOT, { documentId, snapshotId }),
}

// UX API (Phase 6 - Writer Harness)
const uxAPI = {
  setZenMode: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.UX_SET_ZEN_MODE, { enabled }),
  getZenMode: () => ipcRenderer.invoke(IPC_CHANNELS.UX_GET_ZEN_MODE),
  toggleAssistant: (visible?: boolean) => ipcRenderer.invoke(IPC_CHANNELS.UX_TOGGLE_ASSISTANT, { visible }),
}

// Pricing API (Phase 7 - Writer Harness)
const pricingAPI = {
  calculate: (inputTokens: number, outputTokens: number, modelId: string, provider: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRICING_CALCULATE, { inputTokens, outputTokens, modelId, provider }),
  getSessionCost: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.PRICING_GET_SESSION_COST, { documentId }),
  resetSession: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.PRICING_RESET_SESSION, { documentId }),
  getGlobalSummary: () => ipcRenderer.invoke(IPC_CHANNELS.PRICING_GET_GLOBAL_SUMMARY),
  getAllModels: () => ipcRenderer.invoke(IPC_CHANNELS.PRICING_GET_ALL_MODELS),
  recordAction: (
    documentId: string,
    action: string,
    inputTokens: number,
    outputTokens: number,
    modelId: string,
    provider: string,
  ) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRICING_RECORD_ACTION, {
      documentId,
      action,
      inputTokens,
      outputTokens,
      modelId,
      provider,
    }),
  testConnection: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_TEST_CONNECTION, { providerId }),
  setProjectModel: (documentId: string, providerId: string, modelId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SET_MODEL, { documentId, providerId, modelId }),
  getProjectModel: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_MODEL, { documentId }),
}

// Update API (Phase 7 - Writer Harness)
const updateAPI = {
  check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
  getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GET_INFO),
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('electron', {
  agent: agentAPI,
  provider: providerAPI,
  tool: toolAPI,
  audit: auditAPI,
  trace: traceAPI,
  policy: policyAPI,
  release: releaseAPI,
  phase12: phase12API,
  skill: skillAPI,
  workspace: workspaceAPI,
  writerLoop: writerLoopAPI,
  research: researchAPI,
  citation: citationAPI,
  version: versionAPI,
  ux: uxAPI,
  pricing: pricingAPI,
  update: updateAPI,
  invoke: api.invoke,
  onAgentStream: (callback: (chunk: any) => void) => {
    ipcRenderer.on('agent:stream', (event, chunk) => callback(chunk))
  },
})

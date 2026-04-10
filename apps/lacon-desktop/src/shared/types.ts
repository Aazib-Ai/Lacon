/**
 * Shared type definitions between main, preload, and renderer processes
 */

export interface IpcAPI {
  invoke: (channel: string, payload?: any) => Promise<any>
  on: (channel: string, listener: (...args: any[]) => void) => void
  removeListener: (channel: string, listener: (...args: any[]) => void) => void
}

// Agent runtime API (Phase 6)
export interface AgentAPI {
  startRun: (payload: any) => Promise<string>
  cancelRun: (payload: any) => Promise<void>
  getRunStatus: (payload: any) => Promise<any>
  approveRequest: (payload: any) => Promise<void>
  rejectRequest: (payload: any) => Promise<void>
  getPendingApprovals: () => Promise<any[]>
  registerTool: (payload: any) => Promise<void>
}

// Provider API (Phase 7)
export interface ProviderAPI {
  register: (config: any) => Promise<void>
  unregister: (providerId: string) => Promise<void>
  list: () => Promise<any[]>
  getModels: (providerId: string) => Promise<any[]>
  checkHealth: (providerId: string) => Promise<any>
  checkAllHealth: () => Promise<any[]>
  setFallback: (primary: string, fallbacks: string[]) => Promise<void>
  getUsage: (filter?: any) => Promise<any[]>
  getUsageSummary: (providerId?: string) => Promise<any>
  chatCompletion: (providerId: string, request: any, feature: string) => Promise<any>
  streamStart: (providerId: string, request: any, feature: string) => Promise<string>
  createKey: (providerId: string, providerType: string, label: string, apiKey: string) => Promise<string>
  onStreamChunk: (callback: (streamId: string, chunk: any) => void) => void
  onStreamComplete: (callback: (streamId: string, usage: any) => void) => void
  onStreamError: (callback: (streamId: string, error: string) => void) => void
}

// Tool API (Phase 8)
export interface ToolAPI {
  list: () => Promise<any>
  listByCategory: (category: string) => Promise<any>
  execute: (toolName: string, input: any) => Promise<any>
  authoring: (toolName: string, input: any) => Promise<any>
  workspaceQA: (input: any) => Promise<any>
  webResearch: (input: any) => Promise<any>
  youtubeTranscript: (input: any) => Promise<any>
  toneAnalyzer: (input: any) => Promise<any>
  brollGenerator: (input: any) => Promise<any>
}

// Audit API (Phase 9)
export interface AuditAPI {
  query: (filter: any) => Promise<any>
  getStatistics: () => Promise<any>
  verifyIntegrity: (eventId: string) => Promise<any>
}

// Trace API (Phase 9)
export interface TraceAPI {
  listSessions: (filter: any) => Promise<any>
  getTimeline: (sessionId: string) => Promise<any>
  getMetrics: (sessionId: string) => Promise<any>
  replay: (config: any) => Promise<any>
}

// Policy API (Phase 9)
export interface PolicyAPI {
  listRules: () => Promise<any>
  getRule: (ruleId: string) => Promise<any>
  registerRule: (rule: any) => Promise<any>
  unregisterRule: (ruleId: string) => Promise<any>
  evaluate: (context: any) => Promise<any>
  getViolations: (limit?: number) => Promise<any>
  getStatistics: () => Promise<any>
}

// Release API (Phase 11)
export interface ReleaseAPI {
  setPipelineConfig: (config: any) => Promise<any>
  getPipelineConfig: () => Promise<any>
  registerArtifact: (filePath: string, params: any) => Promise<any>
  verifyArtifactIntegrity: (artifact: any) => Promise<any>
  publishChannelManifest: (payload: any) => Promise<any>
  promoteChannel: (request: any) => Promise<any>
  executeRollback: (plan: any) => Promise<any>
  recordClientRollbackVerification: (verification: any) => Promise<any>
  captureCrashEvent: (event: any) => Promise<any>
  createDiagnosticBundle: (payload: any) => Promise<any>
  createRcGateReview: (payload: any) => Promise<any>
  createGaChecklist: (version: string, signOffRequiredBy: string[]) => Promise<any>
  completeGaChecklistItem: (payload: any) => Promise<any>
  signOffGa: (version: string, signOff: any) => Promise<any>
  buildAuditRecord: (payload: any) => Promise<any>
  getIncidentSeverityMatrix: () => Promise<any>
  getEscalationMatrix: () => Promise<any>
  createSupportTicket: (ticket: any) => Promise<any>
  setSupportTriageTaxonomy: (taxonomy: any) => Promise<any>
  getSupportTriageTaxonomy: () => Promise<any>
  createRollbackRunbook: (runbook: any) => Promise<any>
  listRollbackRunbooks: () => Promise<any[]>
  recordRollbackDrill: (drill: any) => Promise<any>
  listRollbackDrills: () => Promise<any[]>
  getDefaultRollbackRunbookTemplate: (channel: 'stable' | 'beta') => Promise<any>
}

// Phase 12 API
export interface Phase12API {
  createCollabSession: (payload: any) => Promise<any>
  getCollabSession: (documentId: string) => Promise<any>
  addCollabMember: (payload: any) => Promise<any>
  updateCollabRole: (payload: any) => Promise<any>
  updatePresence: (payload: any) => Promise<any>
  listPresence: (documentId: string) => Promise<any[]>
  applyOperation: (payload: any) => Promise<any>
  createTenant: (payload: any) => Promise<any>
  createAccount: (payload: any) => Promise<any>
  createAccountSession: (payload: any) => Promise<any>
  addRecoveryMethod: (payload: any) => Promise<any>
  queueSyncChange: (payload: any) => Promise<any>
  processSyncQueue: () => Promise<any[]>
  resolveSyncConflict: (payload: any) => Promise<string>
  createRestoreSnapshot: (payload: any) => Promise<any>
  restoreToDevice: (snapshotId: string, encryptionKey: string) => Promise<string>
  getSyncStatus: (workspaceId: string) => Promise<any>
  mapControl: (payload: any) => Promise<any>
  captureEvidence: (payload: any) => Promise<any>
  recordInternalAudit: (payload: any) => Promise<any>
  buildGapPlan: (gaps: string[]) => Promise<any>
  runDryAssessment: (summary: string) => Promise<any>
  prepareExternalAudit: (summary: string) => Promise<any>
  getComplianceDashboard: () => Promise<any>
}

// Extend Window interface to include our API
declare global {
  interface Window {
    api: IpcAPI
    electron: {
      agent: AgentAPI
      provider: ProviderAPI
      tool: ToolAPI
      audit: AuditAPI
      trace: TraceAPI
      policy: PolicyAPI
      release: ReleaseAPI
      phase12: Phase12API
      invoke: (channel: string, ...args: any[]) => Promise<any>
      onAgentStream: (callback: (chunk: any) => void) => void
    }
  }
}

export {}

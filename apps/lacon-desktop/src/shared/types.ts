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

// Skill API (Phase 1 - Writer Harness)
export interface SkillAPI {
  list: (payload?: any) => Promise<any>
  get: (id: string, documentId?: string) => Promise<any>
  create: (payload: any) => Promise<any>
  compose: (skillIds: string[], documentId?: string) => Promise<any>
  research: (topic: string, documentId: string) => Promise<any>
}

// Workspace API (Phase 1 - Writer Harness)
export interface WorkspaceAPI {
  ensure: (documentId: string) => Promise<any>
  getSession: (documentId: string) => Promise<any>
  updateSession: (documentId: string, updates: any) => Promise<any>
}

// Writer Loop API (Phase 2-4 - Writer Harness)
export interface WriterLoopAPI {
  getState: (documentId: string) => Promise<any>
  startPlanning: (
    documentId: string,
    instruction: string,
    composedSkillPrompt?: string,
    researchContext?: any,
  ) => Promise<any>
  getOutline: (documentId: string) => Promise<any>
  updateOutline: (documentId: string, outline: any) => Promise<any>
  updateSection: (documentId: string, sectionId: string, updates: any) => Promise<any>
  addSection: (documentId: string, section?: any) => Promise<any>
  removeSection: (documentId: string, sectionId: string) => Promise<any>
  addSubsection: (documentId: string, sectionId: string, subsection?: any) => Promise<any>
  removeSubsection: (documentId: string, sectionId: string, subsectionId: string) => Promise<any>
  approveOutline: (documentId: string, documentContent?: any) => Promise<any>
  updateConfig: (documentId: string, config: any) => Promise<any>
  transition: (documentId: string, stage: string) => Promise<any>
  pause: (documentId: string) => Promise<any>
  reset: (documentId: string) => Promise<any>
  // Phase 3: Generator
  generateSection: (documentId: string, sectionId: string) => Promise<any>
  generateAll: (documentId: string) => Promise<any>
  getProgress: (documentId: string) => Promise<any>
  acceptGeneration: (documentId: string, sectionId: string) => Promise<any>
  rejectGeneration: (documentId: string, sectionId: string) => Promise<any>
  // Phase 4: Reviewer
  runReview: (documentId: string, documentContent: any) => Promise<any>
  getReview: (documentId: string) => Promise<any>
  acceptReviewFlag: (documentId: string, flagId: string) => Promise<any>
  rejectReviewFlag: (documentId: string, flagId: string) => Promise<any>
  surgicalEdit: (documentId: string, paragraphId: string, instruction: string, fullDocumentContent: any) => Promise<any>
  rewriteAll: (documentId: string, instruction: string, documentContent: any) => Promise<any>
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
      skill: SkillAPI
      workspace: WorkspaceAPI
      writerLoop: WriterLoopAPI
      invoke: (channel: string, ...args: any[]) => Promise<any>
      onAgentStream: (callback: (chunk: any) => void) => void
    }
  }
}

export {}

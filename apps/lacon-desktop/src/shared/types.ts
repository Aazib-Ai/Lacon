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
      invoke: (channel: string, ...args: any[]) => Promise<any>
      onAgentStream: (callback: (chunk: any) => void) => void
    }
  }
}

export {}

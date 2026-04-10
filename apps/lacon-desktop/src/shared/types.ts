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

// Extend Window interface to include our API
declare global {
  interface Window {
    api: IpcAPI
    electron: {
      agent: AgentAPI
      provider: ProviderAPI
      onAgentStream: (callback: (chunk: any) => void) => void
    }
  }
}

export {}

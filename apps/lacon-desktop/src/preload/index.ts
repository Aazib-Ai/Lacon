import { contextBridge, ipcRenderer } from 'electron'

import { type IpcChannel, IPC_CHANNELS, isValidChannel } from '@/shared/ipc-schema'
import type { IpcAPI } from '@/shared/types'

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

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('electron', {
  agent: agentAPI,
  provider: providerAPI,
  tool: toolAPI,
  invoke: api.invoke,
  onAgentStream: (callback: (chunk: any) => void) => {
    ipcRenderer.on('agent:stream', (event, chunk) => callback(chunk))
  },
})

/**
 * Local data schema v1 for Phase 2
 * Defines the structure for documents, sessions, traces, and settings
 */

// Schema version for migration tracking
export const SCHEMA_VERSION = 1

// Document schema
export interface Document {
  metadata: {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    lastSavedAt?: number
    isDirty: boolean
    isArchived: boolean
    version: number
  }
  content: {
    type: 'doc'
    content: any[]
  }
}

// Agent session schema
export interface AgentSession {
  id: string
  documentId: string
  startedAt: number
  endedAt?: number
  status: 'active' | 'completed' | 'cancelled' | 'error'
  provider: string
  model: string
  messages: AgentMessage[]
  metadata: {
    totalTokens: number
    totalCost: number
    toolInvocations: number
  }
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  tokens?: number
}

// Tool trace schema
export interface ToolTrace {
  id: string
  sessionId: string
  toolName: string
  startedAt: number
  completedAt?: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  input: any
  output?: any
  error?: {
    code: string
    message: string
  }
  metadata: {
    duration: number
    approved: boolean
    approvedBy?: 'user' | 'auto'
  }
}

// Settings schema
export interface Settings {
  version: number
  appearance: {
    theme: 'light' | 'dark' | 'system'
    fontSize: number
    fontFamily: string
  }
  editor: {
    autosave: boolean
    autosaveInterval: number
    spellcheck: boolean
  }
  ai: {
    defaultProvider: string
    defaultModel: string
    autoApproveTools: string[]
    maxTokens: number
    temperature: number
  }
  privacy: {
    telemetryEnabled: boolean
    crashReportsEnabled: boolean
  }
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  version: SCHEMA_VERSION,
  appearance: {
    theme: 'system',
    fontSize: 16,
    fontFamily: 'system-ui',
  },
  editor: {
    autosave: true,
    autosaveInterval: 30000, // 30 seconds
    spellcheck: true,
  },
  ai: {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4',
    autoApproveTools: [],
    maxTokens: 4096,
    temperature: 0.7,
  },
  privacy: {
    telemetryEnabled: false,
    crashReportsEnabled: true,
  },
}

// Collection names
export const COLLECTIONS = {
  DOCUMENTS: 'documents',
  SESSIONS: 'sessions',
  TRACES: 'traces',
  SETTINGS: 'settings',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

// Type mapping for collections
export type CollectionData<T extends CollectionName> = T extends 'documents'
  ? Document
  : T extends 'sessions'
    ? AgentSession
    : T extends 'traces'
      ? ToolTrace
      : T extends 'settings'
        ? Settings
        : never

// Validation functions
export function isValidDocument(data: any): data is Document {
  return (
    typeof data === 'object' &&
    typeof data.metadata === 'object' &&
    typeof data.metadata.id === 'string' &&
    typeof data.metadata.title === 'string' &&
    typeof data.metadata.createdAt === 'number' &&
    typeof data.metadata.updatedAt === 'number' &&
    typeof data.metadata.isDirty === 'boolean' &&
    typeof data.metadata.isArchived === 'boolean' &&
    typeof data.metadata.version === 'number' &&
    typeof data.content === 'object' &&
    data.content.type === 'doc' &&
    Array.isArray(data.content.content)
  )
}

export function isValidAgentSession(data: any): data is AgentSession {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    typeof data.documentId === 'string' &&
    typeof data.startedAt === 'number' &&
    typeof data.status === 'string' &&
    typeof data.provider === 'string' &&
    typeof data.model === 'string' &&
    Array.isArray(data.messages)
  )
}

export function isValidToolTrace(data: any): data is ToolTrace {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    typeof data.sessionId === 'string' &&
    typeof data.toolName === 'string' &&
    typeof data.startedAt === 'number' &&
    typeof data.status === 'string'
  )
}

export function isValidSettings(data: any): data is Settings {
  return (
    typeof data === 'object' &&
    typeof data.version === 'number' &&
    typeof data.appearance === 'object' &&
    typeof data.editor === 'object' &&
    typeof data.ai === 'object' &&
    typeof data.privacy === 'object'
  )
}

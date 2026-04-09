/**
 * Document types and schemas for Phase 3
 * Canonical format is JSON
 */

export interface DocumentMetadata {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  lastSavedAt?: number
  isDirty: boolean
  isArchived: boolean
  version: number
}

export interface DocumentContent {
  type: 'doc'
  content: any[]
}

export interface LaconDocument {
  metadata: DocumentMetadata
  content: DocumentContent
}

export interface DocumentListItem {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  isArchived: boolean
}

export interface RecoverySnapshot {
  documentId: string
  content: DocumentContent
  timestamp: number
  reason: 'autosave' | 'crash'
}

export type ImportFormat = 'json' | 'html' | 'markdown'
export type ExportFormat = 'json' | 'html' | 'markdown'

export interface ImportResult {
  success: boolean
  document?: LaconDocument
  error?: string
}

export interface ExportResult {
  success: boolean
  data?: string
  error?: string
}

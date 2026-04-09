/**
 * Document Service - Main Process
 * Handles document CRUD, autosave, and recovery
 */

import type { DocumentContent, DocumentListItem, LaconDocument, RecoverySnapshot } from '../../shared/document-types'
import type { DataStore } from '../data/store'

export class DocumentService {
  private store: DataStore
  private autosaveTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private readonly AUTOSAVE_DELAY = 3000 // 3 seconds

  constructor(store: DataStore) {
    this.store = store
  }

  // Create new document
  async createDocument(title: string = 'Untitled'): Promise<LaconDocument> {
    const id = this.generateId()
    const now = Date.now()

    const document: LaconDocument = {
      metadata: {
        id,
        title,
        createdAt: now,
        updatedAt: now,
        isDirty: false,
        isArchived: false,
        version: 1,
      },
      content: {
        type: 'doc',
        content: [],
      },
    }

    await this.store.saveDocument(document)
    return document
  }

  // Open existing document
  async openDocument(id: string): Promise<LaconDocument | null> {
    return this.store.getDocument(id)
  }

  // Save document
  async saveDocument(document: LaconDocument): Promise<void> {
    document.metadata.lastSavedAt = Date.now()
    document.metadata.updatedAt = Date.now()
    document.metadata.isDirty = false
    document.metadata.version += 1

    await this.store.saveDocument(document)
    this.clearAutosaveTimer(document.metadata.id)
  }

  // Save as new document
  async saveDocumentAs(document: LaconDocument, newTitle: string): Promise<LaconDocument> {
    const newId = this.generateId()
    const now = Date.now()

    const newDocument: LaconDocument = {
      metadata: {
        ...document.metadata,
        id: newId,
        title: newTitle,
        createdAt: now,
        updatedAt: now,
        lastSavedAt: now,
        isDirty: false,
        version: 1,
      },
      content: document.content,
    }

    await this.store.saveDocument(newDocument)
    return newDocument
  }

  // Schedule autosave
  scheduleAutosave(document: LaconDocument): void {
    this.clearAutosaveTimer(document.metadata.id)

    const timer = setTimeout(async () => {
      document.metadata.isDirty = true
      await this.saveDocument(document)
    }, this.AUTOSAVE_DELAY)

    this.autosaveTimers.set(document.metadata.id, timer)
  }

  // Clear autosave timer
  private clearAutosaveTimer(documentId: string): void {
    const timer = this.autosaveTimers.get(documentId)
    if (timer) {
      clearTimeout(timer)
      this.autosaveTimers.delete(documentId)
    }
  }

  // Rename document
  async renameDocument(id: string, newTitle: string): Promise<void> {
    const document = await this.openDocument(id)
    if (!document) {
      throw new Error('Document not found')
    }

    document.metadata.title = newTitle
    document.metadata.updatedAt = Date.now()
    await this.store.saveDocument(document)
  }

  // Duplicate document
  async duplicateDocument(id: string): Promise<LaconDocument> {
    const document = await this.openDocument(id)
    if (!document) {
      throw new Error('Document not found')
    }

    return this.saveDocumentAs(document, `${document.metadata.title} (Copy)`)
  }

  // Archive document
  async archiveDocument(id: string): Promise<void> {
    const document = await this.openDocument(id)
    if (!document) {
      throw new Error('Document not found')
    }

    document.metadata.isArchived = true
    document.metadata.updatedAt = Date.now()
    await this.store.saveDocument(document)
  }

  // Restore document
  async restoreDocument(id: string): Promise<void> {
    const document = await this.openDocument(id)
    if (!document) {
      throw new Error('Document not found')
    }

    document.metadata.isArchived = false
    document.metadata.updatedAt = Date.now()
    await this.store.saveDocument(document)
  }

  // Delete document
  async deleteDocument(id: string): Promise<void> {
    await this.store.deleteDocument(id)
    this.clearAutosaveTimer(id)
  }

  // List documents
  async listDocuments(includeArchived: boolean = false): Promise<DocumentListItem[]> {
    return this.store.listDocuments(includeArchived)
  }

  // Save recovery snapshot
  async saveRecoverySnapshot(
    documentId: string,
    content: DocumentContent,
    reason: 'autosave' | 'crash',
  ): Promise<void> {
    const snapshot: RecoverySnapshot = {
      documentId,
      content,
      timestamp: Date.now(),
      reason,
    }

    await this.store.saveRecoverySnapshot(snapshot)
  }

  // Get recovery snapshots
  async getRecoverySnapshots(): Promise<RecoverySnapshot[]> {
    return this.store.getRecoverySnapshots()
  }

  // Clear recovery snapshot
  async clearRecoverySnapshot(documentId: string): Promise<void> {
    await this.store.clearRecoverySnapshot(documentId)
  }

  // Get last opened document
  async getLastOpenedDocument(): Promise<LaconDocument | null> {
    const lastDocId = await this.store.getLastOpenedDocumentId()
    if (!lastDocId) {
      return null
    }
    return this.openDocument(lastDocId)
  }

  // Set last opened document
  async setLastOpenedDocument(id: string): Promise<void> {
    await this.store.setLastOpenedDocumentId(id)
  }

  // Generate unique ID
  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Cleanup on shutdown
  cleanup(): void {
    for (const timer of this.autosaveTimers.values()) {
      clearTimeout(timer)
    }
    this.autosaveTimers.clear()
  }
}

/**
 * Document Service Tests - Phase 3
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DocumentService } from '../../src/main/services/document-service'
import type { LaconDocument } from '../../src/shared/document-types'

describe('DocumentService', () => {
  let documentService: DocumentService
  let mockStore: any

  beforeEach(() => {
    // Create mock store
    mockStore = {
      saveDocument: vi.fn(),
      getDocument: vi.fn(),
      deleteDocument: vi.fn(),
      listDocuments: vi.fn(),
      saveRecoverySnapshot: vi.fn(),
      getRecoverySnapshots: vi.fn(),
      clearRecoverySnapshot: vi.fn(),
      getLastOpenedDocumentId: vi.fn(),
      setLastOpenedDocumentId: vi.fn(),
    }

    documentService = new DocumentService(mockStore as any)
  })

  afterEach(() => {
    documentService.cleanup()
  })

  describe('createDocument', () => {
    it('should create a new document with default title', async () => {
      mockStore.saveDocument.mockResolvedValue(undefined)

      const doc = await documentService.createDocument()

      expect(doc.metadata.title).toBe('Untitled')
      expect(doc.metadata.id).toMatch(/^doc_/)
      expect(doc.metadata.isDirty).toBe(false)
      expect(doc.metadata.isArchived).toBe(false)
      expect(doc.content.type).toBe('doc')
      expect(mockStore.saveDocument).toHaveBeenCalledWith(doc)
    })

    it('should create a new document with custom title', async () => {
      mockStore.saveDocument.mockResolvedValue(undefined)

      const doc = await documentService.createDocument('My Document')

      expect(doc.metadata.title).toBe('My Document')
      expect(mockStore.saveDocument).toHaveBeenCalledWith(doc)
    })
  })

  describe('openDocument', () => {
    it('should open an existing document', async () => {
      const mockDoc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test Doc',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: { type: 'doc', content: [] },
      }

      mockStore.getDocument.mockResolvedValue(mockDoc)

      const doc = await documentService.openDocument('doc_123')

      expect(doc).toEqual(mockDoc)
      expect(mockStore.getDocument).toHaveBeenCalledWith('doc_123')
    })

    it('should return null for non-existent document', async () => {
      mockStore.getDocument.mockResolvedValue(null)

      const doc = await documentService.openDocument('nonexistent')

      expect(doc).toBeNull()
    })
  })

  describe('saveDocument', () => {
    it('should save document and update metadata', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: true,
          isArchived: false,
          version: 1,
        },
        content: { type: 'doc', content: [] },
      }

      mockStore.saveDocument.mockResolvedValue(undefined)

      await documentService.saveDocument(doc)

      expect(doc.metadata.isDirty).toBe(false)
      expect(doc.metadata.lastSavedAt).toBeDefined()
      expect(doc.metadata.version).toBe(2)
      expect(mockStore.saveDocument).toHaveBeenCalledWith(doc)
    })
  })

  describe('saveDocumentAs', () => {
    it('should create a copy with new title and ID', async () => {
      const originalDoc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Original',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 5,
        },
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      }

      mockStore.saveDocument.mockResolvedValue(undefined)

      const newDoc = await documentService.saveDocumentAs(originalDoc, 'Copy')

      expect(newDoc.metadata.id).not.toBe(originalDoc.metadata.id)
      expect(newDoc.metadata.title).toBe('Copy')
      expect(newDoc.metadata.version).toBe(1)
      expect(newDoc.content).toEqual(originalDoc.content)
      expect(mockStore.saveDocument).toHaveBeenCalledWith(newDoc)
    })
  })

  describe('renameDocument', () => {
    it('should rename an existing document', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Old Title',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: { type: 'doc', content: [] },
      }

      mockStore.getDocument.mockResolvedValue(doc)
      mockStore.saveDocument.mockResolvedValue(undefined)

      await documentService.renameDocument('doc_123', 'New Title')

      expect(doc.metadata.title).toBe('New Title')
      expect(mockStore.saveDocument).toHaveBeenCalledWith(doc)
    })

    it('should throw error for non-existent document', async () => {
      mockStore.getDocument.mockResolvedValue(null)

      await expect(documentService.renameDocument('nonexistent', 'New Title')).rejects.toThrow('Document not found')
    })
  })

  describe('duplicateDocument', () => {
    it('should create a duplicate with "(Copy)" suffix', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Original',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: { type: 'doc', content: [] },
      }

      mockStore.getDocument.mockResolvedValue(doc)
      mockStore.saveDocument.mockResolvedValue(undefined)

      const duplicate = await documentService.duplicateDocument('doc_123')

      expect(duplicate.metadata.title).toBe('Original (Copy)')
      expect(duplicate.metadata.id).not.toBe(doc.metadata.id)
    })
  })

  describe('archiveDocument', () => {
    it('should mark document as archived', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: { type: 'doc', content: [] },
      }

      mockStore.getDocument.mockResolvedValue(doc)
      mockStore.saveDocument.mockResolvedValue(undefined)

      await documentService.archiveDocument('doc_123')

      expect(doc.metadata.isArchived).toBe(true)
      expect(mockStore.saveDocument).toHaveBeenCalledWith(doc)
    })
  })

  describe('restoreDocument', () => {
    it('should unmark document as archived', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: true,
          version: 1,
        },
        content: { type: 'doc', content: [] },
      }

      mockStore.getDocument.mockResolvedValue(doc)
      mockStore.saveDocument.mockResolvedValue(undefined)

      await documentService.restoreDocument('doc_123')

      expect(doc.metadata.isArchived).toBe(false)
      expect(mockStore.saveDocument).toHaveBeenCalledWith(doc)
    })
  })

  describe('deleteDocument', () => {
    it('should delete document from store', async () => {
      mockStore.deleteDocument.mockResolvedValue(undefined)

      await documentService.deleteDocument('doc_123')

      expect(mockStore.deleteDocument).toHaveBeenCalledWith('doc_123')
    })
  })

  describe('autosave', () => {
    it('should schedule autosave with debounce', async () => {
      vi.useFakeTimers()

      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: { type: 'doc', content: [] },
      }

      mockStore.saveDocument.mockResolvedValue(undefined)

      documentService.scheduleAutosave(doc)

      // Should not save immediately
      expect(mockStore.saveDocument).not.toHaveBeenCalled()

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(3000)

      // Should save after delay
      expect(mockStore.saveDocument).toHaveBeenCalledWith(doc)

      vi.useRealTimers()
    })
  })
})

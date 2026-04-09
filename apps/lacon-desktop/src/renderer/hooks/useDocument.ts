/**
 * Document management hook - Phase 3
 * Handles document lifecycle operations via IPC
 */

import { useCallback, useEffect, useState } from 'react'

import type {
  DocumentContent,
  DocumentListItem,
  ExportFormat,
  ImportFormat,
  LaconDocument,
} from '../../shared/document-types'
import { IPC_CHANNELS } from '../../shared/ipc-schema'

export function useDocument() {
  const [currentDocument, setCurrentDocument] = useState<LaconDocument | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create new document
  const createDocument = useCallback(async (title?: string) => {
    try {
      setError(null)
      const response = await window.api.invoke(IPC_CHANNELS.DOC_CREATE, { title })
      if (response.success && response.data) {
        setCurrentDocument(response.data)
        setIsDirty(false)
        await window.api.invoke(IPC_CHANNELS.DOC_SET_LAST_OPENED, { id: response.data.metadata.id })
        return response.data
      }
      throw new Error(response.error?.message || 'Failed to create document')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create document'
      setError(message)
      throw err
    }
  }, [])

  // Open existing document
  const openDocument = useCallback(async (id: string) => {
    try {
      setError(null)
      const response = await window.api.invoke(IPC_CHANNELS.DOC_OPEN, { id })
      if (response.success && response.data) {
        setCurrentDocument(response.data)
        setIsDirty(false)
        await window.api.invoke(IPC_CHANNELS.DOC_SET_LAST_OPENED, { id })
        return response.data
      }
      throw new Error(response.error?.message || 'Failed to open document')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open document'
      setError(message)
      throw err
    }
  }, [])

  // Save document
  const saveDocument = useCallback(async () => {
    if (!currentDocument) {
      return
    }

    try {
      setError(null)
      setIsSaving(true)
      const response = await window.api.invoke(IPC_CHANNELS.DOC_SAVE, { document: currentDocument })
      if (response.success) {
        setIsDirty(false)
      } else {
        throw new Error(response.error?.message || 'Failed to save document')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save document'
      setError(message)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [currentDocument])

  // Save as new document
  const saveDocumentAs = useCallback(
    async (newTitle: string) => {
      if (!currentDocument) {
        return
      }

      try {
        setError(null)
        setIsSaving(true)
        const response = await window.api.invoke(IPC_CHANNELS.DOC_SAVE_AS, {
          document: currentDocument,
          newTitle,
        })
        if (response.success && response.data) {
          setCurrentDocument(response.data)
          setIsDirty(false)
          await window.api.invoke(IPC_CHANNELS.DOC_SET_LAST_OPENED, { id: response.data.metadata.id })
          return response.data
        }
        throw new Error(response.error?.message || 'Failed to save document as')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save document as'
        setError(message)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [currentDocument],
  )

  // Update document content
  const updateContent = useCallback(
    (content: DocumentContent) => {
      if (!currentDocument) {
        return
      }

      setCurrentDocument({
        ...currentDocument,
        content,
        metadata: {
          ...currentDocument.metadata,
          updatedAt: Date.now(),
        },
      })
    },
    [currentDocument],
  )

  // Mark document as dirty
  const markDirty = useCallback(() => {
    setIsDirty(true)
    if (currentDocument) {
      // Schedule autosave
      window.api.invoke(IPC_CHANNELS.DOC_SCHEDULE_AUTOSAVE, { document: currentDocument })
    }
  }, [currentDocument])

  // Rename document
  const renameDocument = useCallback(
    async (newTitle: string) => {
      if (!currentDocument) {
        return
      }

      try {
        setError(null)
        const response = await window.api.invoke(IPC_CHANNELS.DOC_RENAME, {
          id: currentDocument.metadata.id,
          newTitle,
        })
        if (response.success) {
          setCurrentDocument({
            ...currentDocument,
            metadata: {
              ...currentDocument.metadata,
              title: newTitle,
              updatedAt: Date.now(),
            },
          })
        } else {
          throw new Error(response.error?.message || 'Failed to rename document')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rename document'
        setError(message)
        throw err
      }
    },
    [currentDocument],
  )

  // List documents
  const listDocuments = useCallback(async (includeArchived = false): Promise<DocumentListItem[]> => {
    try {
      setError(null)
      const response = await window.api.invoke(IPC_CHANNELS.DOC_LIST, { includeArchived })
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error?.message || 'Failed to list documents')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list documents'
      setError(message)
      return []
    }
  }, [])

  // Import document
  const importDocument = useCallback(async (data: string, format: ImportFormat, title?: string) => {
    try {
      setError(null)
      const response = await window.api.invoke(IPC_CHANNELS.DOC_IMPORT, { data, format, title })
      if (response.success && response.data && response.data.success && response.data.document) {
        setCurrentDocument(response.data.document)
        setIsDirty(false)
        return response.data.document
      }
      throw new Error(response.data?.error || 'Failed to import document')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import document'
      setError(message)
      throw err
    }
  }, [])

  // Export document
  const exportDocument = useCallback(
    async (format: ExportFormat): Promise<string> => {
      if (!currentDocument) {
        throw new Error('No document to export')
      }

      try {
        setError(null)
        const response = await window.api.invoke(IPC_CHANNELS.DOC_EXPORT, {
          document: currentDocument,
          format,
        })
        if (response.success && response.data && response.data.success && response.data.data) {
          return response.data.data
        }
        throw new Error(response.data?.error || 'Failed to export document')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export document'
        setError(message)
        throw err
      }
    },
    [currentDocument],
  )

  // Load last opened document on mount
  useEffect(() => {
    const loadLastDocument = async () => {
      try {
        const response = await window.api.invoke(IPC_CHANNELS.DOC_GET_LAST_OPENED, {})
        if (response.success && response.data) {
          setCurrentDocument(response.data)
        } else {
          // Create a new document if none exists
          await createDocument('Welcome')
        }
      } catch (err) {
        console.error('Failed to load last document:', err)
        // Create a new document on error
        await createDocument('Welcome')
      }
    }

    loadLastDocument()
  }, [createDocument])

  return {
    currentDocument,
    isDirty,
    isSaving,
    error,
    createDocument,
    openDocument,
    saveDocument,
    saveDocumentAs,
    updateContent,
    markDirty,
    renameDocument,
    listDocuments,
    importDocument,
    exportDocument,
  }
}

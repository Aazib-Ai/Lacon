/**
 * useProject — Folder-based document system hook
 *
 * Manages the active project folder, file listing, file read/save,
 * and auto-save with debounce.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface ProjectFile {
  name: string
  path: string
  size: number
  extension: string
  modifiedAt: number
}

export interface ProjectInfo {
  path: string
  name: string
}

interface UseProjectReturn {
  /** Active project info (null if no project is open) */
  project: ProjectInfo | null
  /** Files in the project folder */
  files: ProjectFile[]
  /** Currently open file path */
  activeFilePath: string | null
  /** Content of the active file */
  activeFileContent: string | null
  /** Whether the active file has unsaved changes */
  isDirty: boolean
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Open a project folder via native dialog */
  openProject: () => Promise<void>
  /** Open a specific file */
  openFile: (filePath: string) => Promise<void>
  /** Create a new file in the project */
  createFile: (fileName: string) => Promise<ProjectFile | null>
  /** Save the active file */
  saveActiveFile: () => Promise<void>
  /** Update the active file content (triggers auto-save) */
  updateContent: (content: string) => void
  /** Delete a file */
  deleteFile: (filePath: string) => Promise<void>
  /** Rename a file */
  renameFile: (oldPath: string, newName: string) => Promise<void>
  /** Refresh the file list */
  refreshFiles: () => Promise<void>
}

const AUTOSAVE_DELAY = 1500

export function useProject(): UseProjectReturn {
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [activeFileContent, setActiveFileContent] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContentRef = useRef<string | null>(null)
  const activeFilePathRef = useRef<string | null>(null)

  // Keep ref in sync
  useEffect(() => {
    activeFilePathRef.current = activeFilePath
  }, [activeFilePath])

  // ─── Load active project on mount ───
  useEffect(() => {
    const loadProject = async () => {
      if (!window.electron?.project) return
      try {
        const result = await window.electron.project.getActive()
        if (result.success && result.data) {
          setProject(result.data)
        }
      } catch (err) {
        console.error('Failed to load active project:', err)
      }
    }
    loadProject()
  }, [])

  // ─── Load files when project changes ───
  const refreshFiles = useCallback(async () => {
    if (!window.electron?.project) return
    try {
      const result = await window.electron.project.listFiles()
      if (result.success && result.data) {
        setFiles(result.data.files || [])
        if (result.data.projectPath) {
          setProject({ path: result.data.projectPath, name: result.data.projectName })
        }
      }
    } catch (err) {
      console.error('Failed to list files:', err)
    }
  }, [])

  useEffect(() => {
    if (project) {
      refreshFiles()
    } else {
      setFiles([])
      setActiveFilePath(null)
      setActiveFileContent(null)
    }
  }, [project, refreshFiles])

  // ─── Auto-save logic ───
  const doSave = useCallback(async (filePath: string, content: string) => {
    if (!window.electron?.project) return
    try {
      const result = await window.electron.project.saveFile(filePath, content)
      if (result.success) {
        // Only clear dirty if the file hasn't changed since save started
        if (activeFilePathRef.current === filePath) {
          setIsDirty(false)
        }
      } else {
        setError(result.error?.message || 'Failed to save file')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file')
    }
  }, [])

  const scheduleAutosave = useCallback(
    (content: string) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      pendingContentRef.current = content
      autosaveTimerRef.current = setTimeout(() => {
        const filePath = activeFilePathRef.current
        const pendingContent = pendingContentRef.current
        if (filePath && pendingContent !== null) {
          doSave(filePath, pendingContent)
          pendingContentRef.current = null
        }
      }, AUTOSAVE_DELAY)
    },
    [doSave],
  )

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        // Save any pending changes on unmount
        const filePath = activeFilePathRef.current
        const pendingContent = pendingContentRef.current
        if (filePath && pendingContent !== null) {
          doSave(filePath, pendingContent)
        }
      }
    }
  }, [doSave])

  // ─── Open project folder ───
  const openProject = useCallback(async () => {
    if (!window.electron?.project) return
    try {
      setIsLoading(true)
      setError(null)

      // Save any pending changes before switching project
      if (activeFilePathRef.current && pendingContentRef.current !== null) {
        await doSave(activeFilePathRef.current, pendingContentRef.current)
        pendingContentRef.current = null
      }

      const result = await window.electron.project.openFolder()
      if (result.success && result.data) {
        setProject(result.data)
        setActiveFilePath(null)
        setActiveFileContent(null)
        setIsDirty(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open project')
    } finally {
      setIsLoading(false)
    }
  }, [doSave])

  // ─── Open a file ───
  const openFile = useCallback(
    async (filePath: string) => {
      if (!window.electron?.project) return
      try {
        setIsLoading(true)
        setError(null)

        // Save current file first if dirty
        if (activeFilePathRef.current && pendingContentRef.current !== null) {
          await doSave(activeFilePathRef.current, pendingContentRef.current)
          pendingContentRef.current = null
        }

        const result = await window.electron.project.readFile(filePath)
        if (result.success && result.data) {
          setActiveFilePath(filePath)
          setActiveFileContent(result.data.content)
          setIsDirty(false)
        } else {
          setError(result.error?.message || 'Failed to open file')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open file')
      } finally {
        setIsLoading(false)
      }
    },
    [doSave],
  )

  // ─── Create a new file ───
  const createFile = useCallback(
    async (fileName: string): Promise<ProjectFile | null> => {
      if (!window.electron?.project) return null
      try {
        setError(null)
        const result = await window.electron.project.createFile(fileName)
        if (result.success && result.data) {
          await refreshFiles()
          // Open the new file
          setActiveFilePath(result.data.path)
          setActiveFileContent(result.data.content)
          setIsDirty(false)
          return result.data
        } else {
          setError(result.error?.message || 'Failed to create file')
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create file')
        return null
      }
    },
    [refreshFiles],
  )

  // ─── Save active file ───
  const saveActiveFile = useCallback(async () => {
    if (!activeFilePath || activeFileContent === null) return
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    await doSave(activeFilePath, pendingContentRef.current ?? activeFileContent)
    pendingContentRef.current = null
  }, [activeFilePath, activeFileContent, doSave])

  // ─── Update content ───
  const updateContent = useCallback(
    (content: string) => {
      setActiveFileContent(content)
      setIsDirty(true)
      scheduleAutosave(content)
    },
    [scheduleAutosave],
  )

  // ─── Delete a file ───
  const deleteFile = useCallback(
    async (filePath: string) => {
      if (!window.electron?.project) return
      try {
        setError(null)
        const result = await window.electron.project.deleteFile(filePath)
        if (result.success) {
          // If we deleted the active file, clear editor
          if (filePath === activeFilePath) {
            setActiveFilePath(null)
            setActiveFileContent(null)
            setIsDirty(false)
          }
          await refreshFiles()
        } else {
          setError(result.error?.message || 'Failed to delete file')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete file')
      }
    },
    [activeFilePath, refreshFiles],
  )

  // ─── Rename a file ───
  const renameFile = useCallback(
    async (oldPath: string, newName: string) => {
      if (!window.electron?.project) return
      try {
        setError(null)
        const result = await window.electron.project.renameFile(oldPath, newName)
        if (result.success && result.data) {
          // If we renamed the active file, update the path
          if (oldPath === activeFilePath) {
            setActiveFilePath(result.data.path)
          }
          await refreshFiles()
        } else {
          setError(result.error?.message || 'Failed to rename file')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename file')
      }
    },
    [activeFilePath, refreshFiles],
  )

  return {
    project,
    files,
    activeFilePath,
    activeFileContent,
    isDirty,
    isLoading,
    error,
    openProject,
    openFile,
    createFile,
    saveActiveFile,
    updateContent,
    deleteFile,
    renameFile,
    refreshFiles,
  }
}

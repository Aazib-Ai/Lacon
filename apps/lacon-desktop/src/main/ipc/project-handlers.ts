/**
 * Project IPC handlers
 * Folder-based document system — writers open a folder and work with real files
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { basename, dirname, extname, join, normalize, relative, sep } from 'path'

import { IPC_CHANNELS } from '@/shared/ipc-schema'

/** Writer-friendly text file extensions */
const WRITER_EXTENSIONS = new Set([
  '.lacon',
  '.md', '.markdown', '.txt', '.rst', '.rtf', '.tex', '.bib',
  '.json', '.yaml', '.yml', '.csv',
  '.html', '.htm',
])

/** Settings file for persisting active project */
const SETTINGS_FILE = 'lacon-project-settings.json'

interface ProjectFileInfo {
  name: string
  path: string
  size: number
  extension: string
  modifiedAt: number
}

interface ProjectSettings {
  activeProjectPath: string | null
}

/**
 * Get the settings file path
 */
function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

/**
 * Load project settings
 */
async function loadSettings(): Promise<ProjectSettings> {
  try {
    const data = await fs.readFile(getSettingsPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return { activeProjectPath: null }
  }
}

/**
 * Save project settings
 */
async function saveSettings(settings: ProjectSettings): Promise<void> {
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

/**
 * Validate that a file path is within the project folder (prevent path traversal)
 */
function isPathWithinProject(filePath: string, projectPath: string): boolean {
  const normalizedFile = normalize(filePath)
  const normalizedProject = normalize(projectPath)
  const rel = relative(normalizedProject, normalizedFile)
  return !rel.startsWith('..') && !rel.includes('..' + sep)
}

/**
 * Ensure the .lacon/ sidecar folder structure exists in the project folder.
 * Creates config.json, skills/, and documents/ directories if missing.
 */
async function ensureLaconSidecar(projectPath: string): Promise<void> {
  const laconDir = join(projectPath, '.lacon')
  const dirs = [
    laconDir,
    join(laconDir, 'skills'),
    join(laconDir, 'documents'),
  ]

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch {
      // already exists
    }
  }

  // Create default config.json if missing
  const configPath = join(laconDir, 'config.json')
  try {
    await fs.access(configPath)
  } catch {
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          version: 1,
          provider: '',
          model: '',
          automationLevel: 'manual',
        },
        null,
        2,
      ),
      'utf-8',
    )
  }

  // Hide the .lacon folder on Windows
  if (process.platform === 'win32') {
    try {
      const { exec } = require('child_process')
      exec(`attrib +h "${laconDir}"`)
    } catch {
      // non-critical
    }
  }
}

/**
 * Ensure the per-document context folder exists inside .lacon/documents/.
 */
async function ensureDocumentContext(projectPath: string, fileName: string): Promise<void> {
  const docName = basename(fileName, extname(fileName))
  const docDir = join(projectPath, '.lacon', 'documents', docName)

  const dirs = [
    docDir,
    join(docDir, 'reviews'),
    join(docDir, 'snapshots'),
  ]

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch {
      // already exists
    }
  }

  // Create default session.json if missing
  const sessionPath = join(docDir, 'session.json')
  try {
    await fs.access(sessionPath)
  } catch {
    await fs.writeFile(
      sessionPath,
      JSON.stringify(
        {
          documentId: fileName,
          stage: 'idle',
          automationLevel: 'manual',
          activeSkillIds: [],
          wordTarget: 0,
          modelConfig: { providerId: '', modelId: '' },
          lastActivityAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf-8',
    )
  }
}

/**
 * Register project-related IPC handlers
 */
export function registerProjectHandlers(): void {

  // Open native folder picker and set as active project
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN_FOLDER, async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(focusedWindow!, {
        title: 'Open Project Folder',
        properties: ['openDirectory'],
        buttonLabel: 'Open Project',
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null }
      }

      const folderPath = result.filePaths[0]
      const settings = await loadSettings()
      settings.activeProjectPath = folderPath
      await saveSettings(settings)

      // Ensure .lacon/ sidecar exists in the project folder
      await ensureLaconSidecar(folderPath)

      return {
        success: true,
        data: {
          path: folderPath,
          name: basename(folderPath),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] project:openFolder error:', message)
      return {
        success: false,
        error: { code: 'DIALOG_ERROR', message: 'Failed to open folder dialog' },
      }
    }
  })

  // List all text files in the active project folder
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST_FILES, async () => {
    try {
      const settings = await loadSettings()
      if (!settings.activeProjectPath) {
        return { success: true, data: { files: [], projectPath: null, projectName: null } }
      }

      const projectPath = settings.activeProjectPath

      // Verify folder still exists
      try {
        const stat = await fs.stat(projectPath)
        if (!stat.isDirectory()) {
          return {
            success: false,
            error: { code: 'NOT_A_DIRECTORY', message: 'Project path is no longer a valid directory' },
          }
        }
      } catch {
        // Folder was deleted or moved
        settings.activeProjectPath = null
        await saveSettings(settings)
        return { success: true, data: { files: [], projectPath: null, projectName: null } }
      }

      const entries = await fs.readdir(projectPath, { withFileTypes: true })
      const files: ProjectFileInfo[] = []

      for (const entry of entries) {
        if (!entry.isFile()) continue
        // Skip hidden files
        if (entry.name.startsWith('.')) continue

        const ext = extname(entry.name).toLowerCase()
        if (!WRITER_EXTENSIONS.has(ext) && ext !== '') continue

        const filePath = join(projectPath, entry.name)
        try {
          const fileStat = await fs.stat(filePath)
          // Skip files larger than 10MB
          if (fileStat.size > 10 * 1024 * 1024) continue

          files.push({
            name: entry.name,
            path: filePath,
            size: fileStat.size,
            extension: ext,
            modifiedAt: fileStat.mtimeMs,
          })
        } catch {
          continue
        }
      }

      // Sort: most recently modified first
      files.sort((a, b) => b.modifiedAt - a.modifiedAt)

      return {
        success: true,
        data: {
          files,
          projectPath,
          projectName: basename(projectPath),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] project:listFiles error:', message)
      return {
        success: false,
        error: { code: 'LIST_ERROR', message: 'Failed to list project files' },
      }
    }
  })

  // Read a specific file
  ipcMain.handle(IPC_CHANNELS.PROJECT_READ_FILE, async (_event, payload: { filePath: string }) => {
    try {
      const { filePath } = payload
      const settings = await loadSettings()

      if (!settings.activeProjectPath) {
        return { success: false, error: { code: 'NO_PROJECT', message: 'No project is open' } }
      }

      if (!isPathWithinProject(filePath, settings.activeProjectPath)) {
        return { success: false, error: { code: 'PATH_TRAVERSAL', message: 'File is outside the project folder' } }
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const stat = await fs.stat(filePath)

      return {
        success: true,
        data: {
          content,
          name: basename(filePath),
          path: filePath,
          size: stat.size,
          modifiedAt: stat.mtimeMs,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] project:readFile error:', message)
      return {
        success: false,
        error: { code: 'READ_ERROR', message: 'Failed to read file' },
      }
    }
  })

  // Save content to a file
  ipcMain.handle(IPC_CHANNELS.PROJECT_SAVE_FILE, async (_event, payload: { filePath: string; content: string }) => {
    try {
      const { filePath, content } = payload
      const settings = await loadSettings()

      if (!settings.activeProjectPath) {
        return { success: false, error: { code: 'NO_PROJECT', message: 'No project is open' } }
      }

      if (!isPathWithinProject(filePath, settings.activeProjectPath)) {
        return { success: false, error: { code: 'PATH_TRAVERSAL', message: 'File is outside the project folder' } }
      }

      await fs.writeFile(filePath, content, 'utf-8')

      return { success: true, data: { path: filePath, savedAt: Date.now() } }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] project:saveFile error:', message)
      return {
        success: false,
        error: { code: 'SAVE_ERROR', message: 'Failed to save file' },
      }
    }
  })

  // Create a new file in the project folder
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE_FILE, async (_event, payload: { fileName: string }) => {
    try {
      let { fileName } = payload
      const settings = await loadSettings()

      if (!settings.activeProjectPath) {
        return { success: false, error: { code: 'NO_PROJECT', message: 'No project is open' } }
      }

      // Auto-append .lacon if no extension
      if (!extname(fileName)) {
        fileName = fileName + '.lacon'
      }

      const filePath = join(settings.activeProjectPath, fileName)

      if (!isPathWithinProject(filePath, settings.activeProjectPath)) {
        return { success: false, error: { code: 'PATH_TRAVERSAL', message: 'Invalid file name' } }
      }

      // Check if file already exists
      try {
        await fs.access(filePath)
        return {
          success: false,
          error: { code: 'FILE_EXISTS', message: `"${fileName}" already exists in this project` },
        }
      } catch {
        // File doesn't exist, good to create
      }

      // Create with HTML content — TipTap's native format
      const docTitle = basename(fileName, extname(fileName))
      const initialContent = `<h1>${docTitle}</h1><p></p>`
      await fs.writeFile(filePath, initialContent, 'utf-8')
      const stat = await fs.stat(filePath)

      // Ensure per-document .lacon/documents/<name>/ context folder
      await ensureDocumentContext(settings.activeProjectPath, fileName)

      return {
        success: true,
        data: {
          name: fileName,
          path: filePath,
          size: stat.size,
          extension: extname(fileName).toLowerCase(),
          modifiedAt: stat.mtimeMs,
          content: initialContent,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] project:createFile error:', message)
      return {
        success: false,
        error: { code: 'CREATE_ERROR', message: 'Failed to create file' },
      }
    }
  })

  // Delete a file
  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE_FILE, async (_event, payload: { filePath: string }) => {
    try {
      const { filePath } = payload
      const settings = await loadSettings()

      if (!settings.activeProjectPath) {
        return { success: false, error: { code: 'NO_PROJECT', message: 'No project is open' } }
      }

      if (!isPathWithinProject(filePath, settings.activeProjectPath)) {
        return { success: false, error: { code: 'PATH_TRAVERSAL', message: 'File is outside the project folder' } }
      }

      await fs.unlink(filePath)
      return { success: true, data: { deleted: filePath } }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] project:deleteFile error:', message)
      return {
        success: false,
        error: { code: 'DELETE_ERROR', message: 'Failed to delete file' },
      }
    }
  })

  // Rename a file
  ipcMain.handle(IPC_CHANNELS.PROJECT_RENAME_FILE, async (_event, payload: { oldPath: string; newName: string }) => {
    try {
      const { oldPath, newName } = payload
      const settings = await loadSettings()

      if (!settings.activeProjectPath) {
        return { success: false, error: { code: 'NO_PROJECT', message: 'No project is open' } }
      }

      if (!isPathWithinProject(oldPath, settings.activeProjectPath)) {
        return { success: false, error: { code: 'PATH_TRAVERSAL', message: 'File is outside the project folder' } }
      }

      const dir = dirname(oldPath)
      const newPath = join(dir, newName)

      if (!isPathWithinProject(newPath, settings.activeProjectPath)) {
        return { success: false, error: { code: 'PATH_TRAVERSAL', message: 'Invalid new file name' } }
      }

      // Check if target already exists
      try {
        await fs.access(newPath)
        return {
          success: false,
          error: { code: 'FILE_EXISTS', message: `"${newName}" already exists` },
        }
      } catch {
        // Good, doesn't exist
      }

      await fs.rename(oldPath, newPath)
      const stat = await fs.stat(newPath)

      return {
        success: true,
        data: {
          name: newName,
          path: newPath,
          oldPath,
          size: stat.size,
          extension: extname(newName).toLowerCase(),
          modifiedAt: stat.mtimeMs,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] project:renameFile error:', message)
      return {
        success: false,
        error: { code: 'RENAME_ERROR', message: 'Failed to rename file' },
      }
    }
  })

  // Get the active project
  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_ACTIVE, async () => {
    try {
      const settings = await loadSettings()
      if (!settings.activeProjectPath) {
        return { success: true, data: null }
      }

      // Verify folder still exists
      try {
        await fs.stat(settings.activeProjectPath)
      } catch {
        settings.activeProjectPath = null
        await saveSettings(settings)
        return { success: true, data: null }
      }

      return {
        success: true,
        data: {
          path: settings.activeProjectPath,
          name: basename(settings.activeProjectPath),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] project:getActive error:', message)
      return {
        success: false,
        error: { code: 'SETTINGS_ERROR', message: 'Failed to load project settings' },
      }
    }
  })

  console.log('Project IPC handlers registered')
}

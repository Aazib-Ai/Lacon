/**
 * Dialog IPC handlers
 * Native OS dialogs for folder selection and file reading
 */

import { BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { basename, extname, join } from 'path'

import { IPC_CHANNELS } from '@/shared/ipc-schema'

/** Text file extensions we recognize */
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.rst', '.rtf',
  '.json', '.csv', '.tsv', '.xml', '.yaml', '.yml',
  '.html', '.htm', '.css', '.js', '.ts', '.jsx', '.tsx',
  '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp',
  '.go', '.rs', '.swift', '.kt', '.scala',
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.sql', '.graphql', '.gql',
  '.env', '.ini', '.cfg', '.conf', '.toml',
  '.log', '.tex', '.bib',
])

interface FolderFileInfo {
  name: string
  path: string
  size: number
  content: string
  extension: string
}

/**
 * Register dialog-related IPC handlers
 */
export function registerDialogHandlers(): void {
  // Open native folder picker dialog
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(focusedWindow!, {
        title: 'Select a Folder',
        properties: ['openDirectory'],
        buttonLabel: 'Select Folder',
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null }
      }

      const folderPath = result.filePaths[0]
      const folderName = basename(folderPath)

      return {
        success: true,
        data: {
          path: folderPath,
          name: folderName,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] dialog:selectFolder error:', message)
      return {
        success: false,
        error: {
          code: 'DIALOG_ERROR',
          message: 'Failed to open folder dialog',
          details: process.env.NODE_ENV === 'development' ? message : undefined,
        },
      }
    }
  })

  // Read all text files from a folder
  ipcMain.handle(IPC_CHANNELS.DIALOG_READ_FOLDER_FILES, async (_event, payload: { folderPath: string }) => {
    try {
      const { folderPath } = payload
      if (!folderPath || typeof folderPath !== 'string') {
        return {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Folder path is required' },
        }
      }

      // Verify folder exists
      const stat = await fs.stat(folderPath)
      if (!stat.isDirectory()) {
        return {
          success: false,
          error: { code: 'NOT_A_DIRECTORY', message: 'The specified path is not a directory' },
        }
      }

      const entries = await fs.readdir(folderPath, { withFileTypes: true })
      const files: FolderFileInfo[] = []

      for (const entry of entries) {
        if (!entry.isFile()) continue

        const ext = extname(entry.name).toLowerCase()
        // Only process text files and files without extension (often text)
        if (!TEXT_EXTENSIONS.has(ext) && ext !== '') continue

        const filePath = join(folderPath, entry.name)
        try {
          const fileStat = await fs.stat(filePath)
          // Skip files larger than 5MB to avoid memory issues
          if (fileStat.size > 5 * 1024 * 1024) continue

          const content = await fs.readFile(filePath, 'utf-8')
          files.push({
            name: entry.name,
            path: filePath,
            size: fileStat.size,
            content,
            extension: ext,
          })
        } catch {
          // Skip files we can't read (permissions, encoding etc.)
          continue
        }
      }

      // Sort alphabetically
      files.sort((a, b) => a.name.localeCompare(b.name))

      return {
        success: true,
        data: {
          folderPath,
          folderName: basename(folderPath),
          files,
          totalFiles: files.length,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] dialog:readFolderFiles error:', message)
      return {
        success: false,
        error: {
          code: 'READ_ERROR',
          message: 'Failed to read folder contents',
          details: process.env.NODE_ENV === 'development' ? message : undefined,
        },
      }
    }
  })

  console.log('Dialog IPC handlers registered')
}

import { app, BrowserWindow } from 'electron'
import { join } from 'path'

import { AuditManager } from './audit/audit-manager'
import { getMigrationRunner } from './data/migrations'
import { getDataStore } from './data/store'
import { registerAuditHandlers } from './ipc/audit-handlers'
import { registerDetectionHandlers } from './ipc/detection-handlers'
import { registerDialogHandlers } from './ipc/dialog-handlers'
import { registerProjectHandlers } from './ipc/project-handlers'
import { registerAgentIpcHandlers, registerIpcHandlers } from './ipc/handlers'
import { registerPhase7Handlers } from './ipc/phase7-handlers'
import { registerPhase12Handlers } from './ipc/phase12-handlers'
import { registerProviderHandlers } from './ipc/provider-handlers'
import { getProviderManager } from './providers/provider-manager'
import { registerReleaseHandlers } from './ipc/release-handlers'
import { registerResearchHandlers } from './ipc/research-handlers'
import { registerSkillHandlers } from './ipc/skill-handlers'
import { registerToolHandlers } from './ipc/tool-handlers'
import { registerVersionHandlers } from './ipc/version-handlers'
import { registerWriterLoopHandlers } from './ipc/writer-loop-handlers'
import { registerSlidesHandlers } from './ipc/slides-handlers'
import { getReleaseOperationsService } from './release-engineering/release-operations-service'
import { getUpdaterService } from './release-engineering/updater-service'
import { getKeyStore } from './security/keystore'
import { createSafeLogger } from './security/log-redaction'
import { getSkillService } from './services/skill-service'

const logger = createSafeLogger('Main')

let mainWindow: BrowserWindow | null = null
let auditManager: AuditManager | null = null

async function initializeApp() {
  try {
    logger.info('Initializing application...')

    // Run database migrations
    const migrationRunner = getMigrationRunner()
    await migrationRunner.migrate()
    logger.info(`Database at version ${migrationRunner.getCurrentVersion()}`)

    // Initialize key store
    const keyStore = getKeyStore()
    await keyStore.initialize()
    logger.info('Key store initialized')

    // Initialize data store
    const dataStore = getDataStore()
    await dataStore.initialize()
    logger.info('Data store initialized')

    // Restore persisted providers (requires key store to be ready)
    const providerManager = getProviderManager()
    await providerManager.restoreProviders()
    logger.info('Provider manager initialized')

    // Initialize release operations (Phase 11)
    const releaseOperations = getReleaseOperationsService()
    await releaseOperations.initialize()
    logger.info('Release operations initialized')

    // Initialize updater service (Phase 11)
    const updater = getUpdaterService({
      currentVersion: app.getVersion(),
      channel: app.isPackaged ? 'stable' : 'beta',
      feeds: {
        stable: 'https://releases.lacon.app/stable',
        beta: 'https://releases.lacon.app/beta',
      },
      platform: process.platform === 'darwin' ? 'darwin' : 'win32',
      arch: process.arch === 'arm64' ? 'arm64' : 'x64',
      stagedRollout: {
        enabled: true,
        percentage: app.isPackaged ? 25 : 100,
        cohortKey: app.isPackaged ? 'stable-rollout' : 'beta-rollout',
      },
      allowPrerelease: !app.isPackaged,
      autoDownload: false,
      autoInstallOnAppQuit: false,
      allowDowngradeForRollback: true,
    })
    await updater.initialize()
    logger.info('Updater service initialized')

    // Wire updater event diagnostics hooks
    updater.on('error', payload => {
      releaseOperations.captureCrashEvent({
        processType: 'main',
        appVersion: app.getVersion(),
        platform: process.platform === 'darwin' ? 'darwin' : 'win32',
        reason: 'updater-error',
        message: payload.message,
        stack: payload.details,
      })
      logger.error('Updater event error:', payload)
    })

    // Initialize audit manager (Phase 9)
    auditManager = new AuditManager()
    logger.info('Audit manager initialized')

    // Register IPC handlers
    registerIpcHandlers()
    registerAgentIpcHandlers()
    registerProviderHandlers()
    registerReleaseHandlers()
    registerPhase12Handlers()

    // Register tool handlers (Phase 8)
    const workspaceRoot = app.getPath('userData')
    registerToolHandlers(workspaceRoot)

    // Initialize skill service (Phase 1 - Writer Harness)
    const skillService = getSkillService()
    await skillService.initialize()
    logger.info('Skill service initialized')

    // Register skill & workspace handlers (Phase 1)
    registerSkillHandlers()

    // Register writer loop handlers (Phase 2)
    registerWriterLoopHandlers()

    // Register research & citation handlers (Phase 5)
    registerResearchHandlers()

    // Register version & UX handlers (Phase 6)
    registerVersionHandlers()

    // Register pricing, security & update handlers (Phase 7)
    registerPhase7Handlers()

    // Register audit handlers (Phase 9)
    registerAuditHandlers(auditManager)

    // Register dialog handlers (folder picker)
    registerDialogHandlers()

    // Register project handlers (folder-based documents)
    registerProjectHandlers()

    // Register AI detection handlers
    registerDetectionHandlers()

    // Register slides handlers (Presentation Generator)
    registerSlidesHandlers()

    logger.info('IPC handlers registered')

    logger.info('Application initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize application:', error)
    throw error
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await initializeApp()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('render-process-gone', (_event, _webContents, details) => {
  try {
    const releaseOperations = getReleaseOperationsService()
    releaseOperations.captureCrashEvent({
      processType: 'renderer',
      appVersion: app.getVersion(),
      platform: process.platform === 'darwin' ? 'darwin' : 'win32',
      reason: `render-process-gone:${details.reason}`,
      message: details.exitCode
        ? `Renderer exited with code ${details.exitCode}`
        : 'Renderer process exited unexpectedly',
    })
  } catch (error) {
    logger.error('Failed to capture renderer crash event:', error)
  }
})

app.on('child-process-gone', (_event, details) => {
  try {
    const releaseOperations = getReleaseOperationsService()
    let processType: 'gpu' | 'utility' | 'unknown' = 'unknown'
    if (details.type === 'GPU') {
      processType = 'gpu'
    } else if (details.type === 'Utility') {
      processType = 'utility'
    }

    releaseOperations.captureCrashEvent({
      processType,
      appVersion: app.getVersion(),
      platform: process.platform === 'darwin' ? 'darwin' : 'win32',
      reason: `child-process-gone:${details.reason}`,
      message: details.exitCode
        ? `Child process exited with code ${details.exitCode}`
        : 'Child process exited unexpectedly',
    })
  } catch (error) {
    logger.error('Failed to capture child process crash event:', error)
  }
})

// Export audit manager for use in other modules
export function getAuditManager(): AuditManager {
  if (!auditManager) {
    throw new Error('Audit manager not initialized')
  }
  return auditManager
}

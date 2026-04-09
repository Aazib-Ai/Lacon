import { app, BrowserWindow } from 'electron'
import { join } from 'path'

import { getMigrationRunner } from './data/migrations'
import { getDataStore } from './data/store'
import { registerIpcHandlers } from './ipc/handlers'
import { getKeyStore } from './security/keystore'
import { createSafeLogger } from './security/log-redaction'

const logger = createSafeLogger('Main')

let mainWindow: BrowserWindow | null = null

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

    // Register IPC handlers
    registerIpcHandlers()
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

/**
 * Local data store implementation for Phase 2
 * Manages persistent storage of documents, sessions, traces, and settings
 */

import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

import {
  type CollectionName,
  COLLECTIONS,
  DEFAULT_SETTINGS,
  isValidAgentSession,
  isValidDocument,
  isValidSettings,
  isValidToolTrace,
  SCHEMA_VERSION,
} from './schema'

export class DataStore {
  private dataPath: string
  private initialized = false

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dataPath = join(userDataPath, 'data')
  }

  /**
   * Initialize the data store
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Create data directories
    if (!existsSync(this.dataPath)) {
      mkdirSync(this.dataPath, { recursive: true })
    }

    for (const collection of Object.values(COLLECTIONS)) {
      const collectionPath = join(this.dataPath, collection)
      if (!existsSync(collectionPath)) {
        mkdirSync(collectionPath, { recursive: true })
      }
    }

    this.initialized = true

    // Initialize settings if not exists
    const settingsPath = this.getItemPath(COLLECTIONS.SETTINGS, 'default')
    if (!existsSync(settingsPath)) {
      await this.save(COLLECTIONS.SETTINGS, 'default', DEFAULT_SETTINGS)
    }
  }

  /**
   * Save data to a collection
   */
  async save(collection: CollectionName, id: string, data: any): Promise<void> {
    this.ensureInitialized()
    this.validateData(collection, data)

    const filePath = this.getItemPath(collection, id)
    const json = JSON.stringify(data, null, 2)

    try {
      writeFileSync(filePath, json, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to save ${collection}/${id}: ${error}`)
    }
  }

  /**
   * Load data from a collection
   */
  async load(collection: CollectionName, id: string): Promise<any | null> {
    this.ensureInitialized()

    const filePath = this.getItemPath(collection, id)

    if (!existsSync(filePath)) {
      return null
    }

    try {
      const json = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(json)
      this.validateData(collection, data)
      return data
    } catch (error) {
      throw new Error(`Failed to load ${collection}/${id}: ${error}`)
    }
  }

  /**
   * Delete data from a collection
   */
  async delete(collection: CollectionName, id: string): Promise<boolean> {
    this.ensureInitialized()

    const filePath = this.getItemPath(collection, id)

    if (!existsSync(filePath)) {
      return false
    }

    try {
      unlinkSync(filePath)
      return true
    } catch (error) {
      throw new Error(`Failed to delete ${collection}/${id}: ${error}`)
    }
  }

  /**
   * List all IDs in a collection
   */
  async list(collection: CollectionName): Promise<string[]> {
    this.ensureInitialized()

    const collectionPath = join(this.dataPath, collection)

    try {
      const files = readdirSync(collectionPath)
      return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''))
    } catch (error) {
      throw new Error(`Failed to list ${collection}: ${error}`)
    }
  }

  /**
   * Export all data to a backup file
   */
  async export(exportPath: string): Promise<void> {
    this.ensureInitialized()

    const backup: any = {
      version: SCHEMA_VERSION,
      exportedAt: Date.now(),
      collections: {},
    }

    for (const collection of Object.values(COLLECTIONS)) {
      const ids = await this.list(collection)
      backup.collections[collection] = {}

      for (const id of ids) {
        const data = await this.load(collection, id)
        if (data) {
          backup.collections[collection][id] = data
        }
      }
    }

    try {
      const json = JSON.stringify(backup, null, 2)
      writeFileSync(exportPath, json, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to export data: ${error}`)
    }
  }

  /**
   * Import data from a backup file
   */
  async import(importPath: string): Promise<void> {
    this.ensureInitialized()

    if (!existsSync(importPath)) {
      throw new Error('Import file does not exist')
    }

    let backup: any

    try {
      const json = readFileSync(importPath, 'utf-8')
      backup = JSON.parse(json)
    } catch (error) {
      throw new Error(`Failed to read import file: ${error}`)
    }

    // Validate backup structure
    if (!backup.version || !backup.collections) {
      throw new Error('Invalid backup file format')
    }

    if (backup.version !== SCHEMA_VERSION) {
      throw new Error(`Incompatible backup version: ${backup.version} (expected ${SCHEMA_VERSION})`)
    }

    // Import each collection
    for (const [collection, items] of Object.entries(backup.collections)) {
      if (!Object.values(COLLECTIONS).includes(collection as CollectionName)) {
        console.warn(`Skipping unknown collection: ${collection}`)
        continue
      }

      for (const [id, data] of Object.entries(items as Record<string, any>)) {
        try {
          await this.save(collection as CollectionName, id, data)
        } catch (error) {
          console.error(`Failed to import ${collection}/${id}:`, error)
        }
      }
    }
  }

  private getItemPath(collection: CollectionName, id: string): string {
    return join(this.dataPath, collection, `${id}.json`)
  }

  private validateData(collection: CollectionName, data: any): void {
    let isValid = false

    switch (collection) {
      case COLLECTIONS.DOCUMENTS:
        isValid = isValidDocument(data)
        break
      case COLLECTIONS.SESSIONS:
        isValid = isValidAgentSession(data)
        break
      case COLLECTIONS.TRACES:
        isValid = isValidToolTrace(data)
        break
      case COLLECTIONS.SETTINGS:
        isValid = isValidSettings(data)
        break
    }

    if (!isValid) {
      throw new Error(`Invalid data for collection ${collection}`)
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('DataStore not initialized. Call initialize() first.')
    }
  }
}

// Singleton instance
let dataStoreInstance: DataStore | null = null

export function getDataStore(): DataStore {
  if (!dataStoreInstance) {
    dataStoreInstance = new DataStore()
  }
  return dataStoreInstance
}

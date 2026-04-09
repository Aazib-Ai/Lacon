/**
 * Encrypted key store implementation for Phase 2
 * Stores API keys and secrets securely in the main process only
 */

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface StoredKey {
  id: string
  provider: string
  label: string
  createdAt: number
  updatedAt: number
}

interface KeyStoreData {
  version: number
  keys: Record<
    string,
    {
      metadata: StoredKey
      encryptedValue: string
    }
  >
}

export class KeyStore {
  private storePath: string
  private data: KeyStoreData
  private initialized = false

  constructor() {
    const userDataPath = app.getPath('userData')
    const securityDir = join(userDataPath, 'security')

    if (!existsSync(securityDir)) {
      mkdirSync(securityDir, { recursive: true })
    }

    this.storePath = join(securityDir, 'keystore.enc')
    this.data = { version: 1, keys: {} }
  }

  /**
   * Initialize the keystore - must be called after app is ready
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('System encryption not available')
    }

    try {
      if (existsSync(this.storePath)) {
        await this.load()
      }
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize keystore:', error)
      // Attempt recovery by creating new store
      this.data = { version: 1, keys: {} }
      await this.save()
      this.initialized = true
    }
  }

  /**
   * Store a new API key
   */
  async setKey(id: string, provider: string, label: string, value: string): Promise<void> {
    this.ensureInitialized()

    const encryptedValue = safeStorage.encryptString(value).toString('base64')
    const now = Date.now()

    this.data.keys[id] = {
      metadata: {
        id,
        provider,
        label,
        createdAt: this.data.keys[id]?.metadata.createdAt ?? now,
        updatedAt: now,
      },
      encryptedValue,
    }

    await this.save()
    this.emitAuditEvent('key_created', id, provider)
  }

  /**
   * Retrieve a decrypted key value - ONLY for use in main process
   */
  async getKey(id: string): Promise<string | null> {
    this.ensureInitialized()

    const entry = this.data.keys[id]
    if (!entry) {
      return null
    }

    try {
      const buffer = Buffer.from(entry.encryptedValue, 'base64')
      return safeStorage.decryptString(buffer)
    } catch (error) {
      console.error(`Failed to decrypt key ${id}:`, error)
      return null
    }
  }

  /**
   * Get key metadata (safe to expose to renderer)
   */
  async getKeyMetadata(id: string): Promise<StoredKey | null> {
    this.ensureInitialized()

    const entry = this.data.keys[id]
    return entry ? entry.metadata : null
  }

  /**
   * List all key metadata (safe to expose to renderer)
   */
  async listKeys(): Promise<StoredKey[]> {
    this.ensureInitialized()

    return Object.values(this.data.keys).map(entry => entry.metadata)
  }

  /**
   * Delete a key
   */
  async deleteKey(id: string): Promise<boolean> {
    this.ensureInitialized()

    if (!this.data.keys[id]) {
      return false
    }

    const provider = this.data.keys[id].metadata.provider
    delete this.data.keys[id]
    await this.save()
    this.emitAuditEvent('key_deleted', id, provider)
    return true
  }

  /**
   * Check if a key exists
   */
  async hasKey(id: string): Promise<boolean> {
    this.ensureInitialized()
    return id in this.data.keys
  }

  private async load(): Promise<void> {
    try {
      const raw = readFileSync(this.storePath, 'utf-8')
      this.data = JSON.parse(raw)
    } catch (error) {
      throw new Error(`Failed to load keystore: ${error}`)
    }
  }

  private async save(): Promise<void> {
    try {
      const raw = JSON.stringify(this.data, null, 2)
      writeFileSync(this.storePath, raw, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to save keystore: ${error}`)
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('KeyStore not initialized. Call initialize() first.')
    }
  }

  private emitAuditEvent(action: string, keyId: string, provider: string): void {
    // Audit events will be integrated with audit log system in Phase 9
    console.log(`[AUDIT] ${action}: keyId=${keyId}, provider=${provider}, timestamp=${Date.now()}`)
  }
}

// Singleton instance
let keystoreInstance: KeyStore | null = null

export function getKeyStore(): KeyStore {
  if (!keystoreInstance) {
    keystoreInstance = new KeyStore()
  }
  return keystoreInstance
}

/**
 * Tests for encrypted key store
 */

import { safeStorage } from 'electron'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KeyStore } from '../../src/main/security/keystore'

// Mock Electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/lacon-test'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str: string) => Buffer.from(`encrypted:${str}`)),
    decryptString: vi.fn((buffer: Buffer) => {
      const str = buffer.toString()
      return str.replace('encrypted:', '')
    }),
  },
}))

describe('KeyStore', () => {
  let keyStore: KeyStore
  const testDataPath = '/tmp/lacon-test/security'

  beforeEach(async () => {
    // Reset mocks
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    vi.mocked(safeStorage.encryptString).mockImplementation((str: string) => Buffer.from(`encrypted:${str}`))
    vi.mocked(safeStorage.decryptString).mockImplementation((buffer: Buffer) => {
      const str = buffer.toString()
      return str.replace('encrypted:', '')
    })

    // Clean up test directory
    if (existsSync(testDataPath)) {
      rmSync(testDataPath, { recursive: true, force: true })
    }
    mkdirSync(testDataPath, { recursive: true })

    keyStore = new KeyStore()
    await keyStore.initialize()
  })

  afterEach(() => {
    // Clean up
    if (existsSync(testDataPath)) {
      rmSync(testDataPath, { recursive: true, force: true })
    }
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(keyStore).toBeDefined()
    })

    it('should throw if encryption not available', async () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
      const newStore = new KeyStore()
      await expect(newStore.initialize()).rejects.toThrow('System encryption not available')
    })

    it('should create security directory if not exists', async () => {
      expect(existsSync(testDataPath)).toBe(true)
    })
  })

  describe('setKey', () => {
    it('should store a key successfully', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')
      const metadata = await keyStore.getKeyMetadata('test-key')

      expect(metadata).toBeDefined()
      expect(metadata?.id).toBe('test-key')
      expect(metadata?.provider).toBe('openai')
      expect(metadata?.label).toBe('Test Key')
    })

    it('should update existing key', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')
      const firstMetadata = await keyStore.getKeyMetadata('test-key')

      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 10)
      })
      await keyStore.setKey('test-key', 'openai', 'Updated Key', 'sk-test456')
      const secondMetadata = await keyStore.getKeyMetadata('test-key')

      expect(secondMetadata?.label).toBe('Updated Key')
      expect(secondMetadata?.updatedAt).toBeGreaterThan(firstMetadata!.updatedAt)
      expect(secondMetadata?.createdAt).toBe(firstMetadata!.createdAt)
    })

    it('should encrypt key value', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')
      expect(safeStorage.encryptString).toHaveBeenCalledWith('sk-test123')
    })
  })

  describe('getKey', () => {
    it('should retrieve decrypted key value', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')
      const value = await keyStore.getKey('test-key')

      expect(value).toBe('sk-test123')
      expect(safeStorage.decryptString).toHaveBeenCalled()
    })

    it('should return null for non-existent key', async () => {
      const value = await keyStore.getKey('non-existent')
      expect(value).toBeNull()
    })

    it('should handle decryption errors', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')

      vi.mocked(safeStorage.decryptString).mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      const value = await keyStore.getKey('test-key')
      expect(value).toBeNull()
    })
  })

  describe('getKeyMetadata', () => {
    it('should return metadata without key value', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')
      const metadata = await keyStore.getKeyMetadata('test-key')

      expect(metadata).toBeDefined()
      expect(metadata).not.toHaveProperty('value')
      expect(metadata).not.toHaveProperty('encryptedValue')
    })

    it('should return null for non-existent key', async () => {
      const metadata = await keyStore.getKeyMetadata('non-existent')
      expect(metadata).toBeNull()
    })
  })

  describe('listKeys', () => {
    it('should return empty array when no keys', async () => {
      const keys = await keyStore.listKeys()
      expect(keys).toEqual([])
    })

    it('should list all key metadata', async () => {
      await keyStore.setKey('key1', 'openai', 'Key 1', 'sk-test1')
      await keyStore.setKey('key2', 'anthropic', 'Key 2', 'sk-test2')

      const keys = await keyStore.listKeys()

      expect(keys).toHaveLength(2)
      expect(keys.map(k => k.id)).toContain('key1')
      expect(keys.map(k => k.id)).toContain('key2')
    })

    it('should not include key values', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')
      const keys = await keyStore.listKeys()

      expect(keys[0]).not.toHaveProperty('value')
      expect(keys[0]).not.toHaveProperty('encryptedValue')
    })
  })

  describe('deleteKey', () => {
    it('should delete existing key', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')
      const deleted = await keyStore.deleteKey('test-key')

      expect(deleted).toBe(true)

      const metadata = await keyStore.getKeyMetadata('test-key')
      expect(metadata).toBeNull()
    })

    it('should return false for non-existent key', async () => {
      const deleted = await keyStore.deleteKey('non-existent')
      expect(deleted).toBe(false)
    })
  })

  describe('hasKey', () => {
    it('should return true for existing key', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')
      const exists = await keyStore.hasKey('test-key')
      expect(exists).toBe(true)
    })

    it('should return false for non-existent key', async () => {
      const exists = await keyStore.hasKey('non-existent')
      expect(exists).toBe(false)
    })
  })

  describe('persistence', () => {
    it('should persist keys across instances', async () => {
      await keyStore.setKey('test-key', 'openai', 'Test Key', 'sk-test123')

      // Create new instance
      const newStore = new KeyStore()
      await newStore.initialize()

      const metadata = await newStore.getKeyMetadata('test-key')
      expect(metadata).toBeDefined()
      expect(metadata?.id).toBe('test-key')
    })
  })
})

/**
 * Tests for data store
 */

import { existsSync, rmSync } from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COLLECTIONS, DEFAULT_SETTINGS } from '../../src/main/data/schema'
import { DataStore } from '../../src/main/data/store'

// Mock Electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/lacon-test-data'),
  },
}))

describe('DataStore', () => {
  let dataStore: DataStore
  const testDataPath = '/tmp/lacon-test-data/data'

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testDataPath)) {
      rmSync(testDataPath, { recursive: true, force: true })
    }

    dataStore = new DataStore()
    await dataStore.initialize()
  })

  afterEach(() => {
    // Clean up
    if (existsSync(testDataPath)) {
      rmSync(testDataPath, { recursive: true, force: true })
    }
  })

  describe('initialization', () => {
    it('should create data directories', async () => {
      expect(existsSync(testDataPath)).toBe(true)

      for (const collection of Object.values(COLLECTIONS)) {
        const collectionPath = `${testDataPath}/${collection}`
        expect(existsSync(collectionPath)).toBe(true)
      }
    })

    it('should initialize default settings', async () => {
      const settings = await dataStore.load(COLLECTIONS.SETTINGS, 'default')
      expect(settings).toBeDefined()
      expect(settings.version).toBe(DEFAULT_SETTINGS.version)
    })
  })

  describe('save and load', () => {
    it('should save and load a document', async () => {
      const document = {
        id: 'doc-1',
        title: 'Test Document',
        content: { type: 'doc', content: [] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          wordCount: 0,
          characterCount: 0,
          tags: [],
        },
      }

      await dataStore.save(COLLECTIONS.DOCUMENTS, 'doc-1', document)
      const loaded = await dataStore.load(COLLECTIONS.DOCUMENTS, 'doc-1')

      expect(loaded).toEqual(document)
    })

    it('should save and load a session', async () => {
      const session = {
        id: 'session-1',
        documentId: 'doc-1',
        startedAt: Date.now(),
        status: 'active' as const,
        provider: 'openai',
        model: 'gpt-4',
        messages: [],
        metadata: {
          totalTokens: 0,
          totalCost: 0,
          toolInvocations: 0,
        },
      }

      await dataStore.save(COLLECTIONS.SESSIONS, 'session-1', session)
      const loaded = await dataStore.load(COLLECTIONS.SESSIONS, 'session-1')

      expect(loaded).toEqual(session)
    })

    it('should return null for non-existent item', async () => {
      const loaded = await dataStore.load(COLLECTIONS.DOCUMENTS, 'non-existent')
      expect(loaded).toBeNull()
    })

    it('should validate data on save', async () => {
      const invalidDocument = {
        id: 'doc-1',
        // missing required fields
      }

      await expect(dataStore.save(COLLECTIONS.DOCUMENTS, 'doc-1', invalidDocument)).rejects.toThrow('Invalid data')
    })
  })

  describe('delete', () => {
    it('should delete existing item', async () => {
      const document = {
        id: 'doc-1',
        title: 'Test',
        content: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { wordCount: 0, characterCount: 0, tags: [] },
      }

      await dataStore.save(COLLECTIONS.DOCUMENTS, 'doc-1', document)
      const deleted = await dataStore.delete(COLLECTIONS.DOCUMENTS, 'doc-1')

      expect(deleted).toBe(true)

      const loaded = await dataStore.load(COLLECTIONS.DOCUMENTS, 'doc-1')
      expect(loaded).toBeNull()
    })

    it('should return false for non-existent item', async () => {
      const deleted = await dataStore.delete(COLLECTIONS.DOCUMENTS, 'non-existent')
      expect(deleted).toBe(false)
    })
  })

  describe('list', () => {
    it('should list all items in collection', async () => {
      const doc1 = {
        id: 'doc-1',
        title: 'Doc 1',
        content: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { wordCount: 0, characterCount: 0, tags: [] },
      }

      const doc2 = {
        id: 'doc-2',
        title: 'Doc 2',
        content: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { wordCount: 0, characterCount: 0, tags: [] },
      }

      await dataStore.save(COLLECTIONS.DOCUMENTS, 'doc-1', doc1)
      await dataStore.save(COLLECTIONS.DOCUMENTS, 'doc-2', doc2)

      const ids = await dataStore.list(COLLECTIONS.DOCUMENTS)

      expect(ids).toHaveLength(2)
      expect(ids).toContain('doc-1')
      expect(ids).toContain('doc-2')
    })

    it('should return empty array for empty collection', async () => {
      const ids = await dataStore.list(COLLECTIONS.TRACES)
      expect(ids).toEqual([])
    })
  })

  describe('export and import', () => {
    it('should export all data', async () => {
      const document = {
        id: 'doc-1',
        title: 'Test',
        content: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { wordCount: 0, characterCount: 0, tags: [] },
      }

      await dataStore.save(COLLECTIONS.DOCUMENTS, 'doc-1', document)

      const exportPath = '/tmp/lacon-test-data/backup.json'
      await dataStore.export(exportPath)

      expect(existsSync(exportPath)).toBe(true)
    })

    it('should import data from backup', async () => {
      const document = {
        id: 'doc-1',
        title: 'Test',
        content: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { wordCount: 0, characterCount: 0, tags: [] },
      }

      await dataStore.save(COLLECTIONS.DOCUMENTS, 'doc-1', document)

      const exportPath = '/tmp/lacon-test-data/backup.json'
      await dataStore.export(exportPath)

      // Delete original
      await dataStore.delete(COLLECTIONS.DOCUMENTS, 'doc-1')

      // Import
      await dataStore.import(exportPath)

      // Verify restored
      const loaded = await dataStore.load(COLLECTIONS.DOCUMENTS, 'doc-1')
      expect(loaded).toEqual(document)
    })

    it('should reject invalid backup file', async () => {
      const invalidPath = '/tmp/lacon-test-data/invalid.json'
      await expect(dataStore.import(invalidPath)).rejects.toThrow()
    })
  })

  describe('persistence', () => {
    it('should persist data across instances', async () => {
      const document = {
        id: 'doc-1',
        title: 'Test',
        content: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { wordCount: 0, characterCount: 0, tags: [] },
      }

      await dataStore.save(COLLECTIONS.DOCUMENTS, 'doc-1', document)

      // Create new instance
      const newStore = new DataStore()
      await newStore.initialize()

      const loaded = await newStore.load(COLLECTIONS.DOCUMENTS, 'doc-1')
      expect(loaded).toEqual(document)
    })
  })
})

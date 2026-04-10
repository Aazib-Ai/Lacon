/**
 * Tests for provider manager (Phase 7)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderManager } from '../../src/main/providers/provider-manager'
import type { ProviderConfig } from '../../src/shared/provider-types'

// Mock keystore
vi.mock('../../src/main/security/keystore', () => ({
  getKeyStore: () => ({
    getKey: vi.fn().mockResolvedValue('test-api-key'),
    setKey: vi.fn().mockResolvedValue(undefined),
    deleteKey: vi.fn().mockResolvedValue(true),
  }),
}))

describe('ProviderManager', () => {
  let manager: ProviderManager

  beforeEach(() => {
    manager = new ProviderManager()
  })

  describe('Provider Registration', () => {
    it('should register a provider successfully', async () => {
      const config: ProviderConfig = {
        id: 'test-provider',
        type: 'openai',
        name: 'Test Provider',
        apiKeyId: 'test-key-id',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await manager.registerProvider(config)

      const providers = manager.listProviders()
      expect(providers).toHaveLength(1)
      expect(providers[0].id).toBe('test-provider')
    })

    it('should throw error when registering provider without API key', async () => {
      const config: ProviderConfig = {
        id: 'test-provider',
        type: 'openai',
        name: 'Test Provider',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await expect(manager.registerProvider(config)).rejects.toThrow('Provider requires API key')
    })

    it('should unregister a provider', async () => {
      const config: ProviderConfig = {
        id: 'test-provider',
        type: 'openai',
        name: 'Test Provider',
        apiKeyId: 'test-key-id',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await manager.registerProvider(config)
      manager.unregisterProvider('test-provider')

      const providers = manager.listProviders()
      expect(providers).toHaveLength(0)
    })
  })

  describe('Fallback Chain', () => {
    it('should configure fallback chain', () => {
      manager.setFallbackChain('primary-provider', ['fallback-1', 'fallback-2'])

      // Fallback chain is internal, but we can test it indirectly through chat completion
      expect(() => manager.setFallbackChain('primary-provider', ['fallback-1'])).not.toThrow()
    })
  })

  describe('Usage Tracking', () => {
    it('should track usage records', () => {
      const records = manager.getUsageRecords()
      expect(Array.isArray(records)).toBe(true)
    })

    it('should filter usage records by provider', () => {
      const records = manager.getUsageRecords({ providerId: 'test-provider' })
      expect(Array.isArray(records)).toBe(true)
    })

    it('should get usage summary', () => {
      const summary = manager.getUsageSummary()
      expect(summary).toHaveProperty('totalTokens')
      expect(summary).toHaveProperty('totalCost')
      expect(summary).toHaveProperty('requestCount')
    })
  })
})

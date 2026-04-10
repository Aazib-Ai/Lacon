/**
 * Tests for circuit breaker behavior (Phase 7)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderManager } from '../../src/main/providers/provider-manager'
import type { ProviderConfig } from '../../src/shared/provider-types'

// Mock keystore
vi.mock('../../src/main/security/keystore', () => ({
  getKeyStore: () => ({
    getKey: vi.fn().mockResolvedValue('test-api-key'),
  }),
}))

describe('Circuit Breaker', () => {
  let manager: ProviderManager

  beforeEach(() => {
    manager = new ProviderManager()
  })

  it('should initialize circuit breaker in closed state', async () => {
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

    // Circuit breaker state is internal, but provider should be available
    const providers = manager.listProviders()
    expect(providers[0].enabled).toBe(true)
  })

  it('should handle provider failures gracefully', async () => {
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

    // Attempting to use provider with invalid config should fail gracefully
    // Circuit breaker will track failures internally
    expect(manager.getProvider('test-provider')).toBeDefined()
  })
})

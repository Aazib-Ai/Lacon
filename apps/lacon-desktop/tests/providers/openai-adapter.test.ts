/**
 * Tests for OpenAI adapter (Phase 7)
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { OpenAIAdapter } from '../../src/main/providers/openai-adapter'
import type { ProviderConfig } from '../../src/shared/provider-types'

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter

  beforeEach(() => {
    adapter = new OpenAIAdapter()
  })

  it('should have correct type and name', () => {
    expect(adapter.type).toBe('openai')
    expect(adapter.name).toBe('OpenAI')
  })

  it('should not be configured initially', () => {
    expect(adapter.isConfigured()).toBe(false)
  })

  it('should be configured after initialization', async () => {
    const config: ProviderConfig = {
      id: 'test-openai',
      type: 'openai',
      name: 'Test OpenAI',
      apiKeyId: 'test-key',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await adapter.initialize(config, 'test-api-key')
    expect(adapter.isConfigured()).toBe(true)
  })

  it('should return available models', async () => {
    const models = await adapter.getAvailableModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models[0]).toHaveProperty('id')
    expect(models[0]).toHaveProperty('name')
    expect(models[0]).toHaveProperty('contextWindow')
    expect(models[0]).toHaveProperty('supportsStreaming')
    expect(models[0]).toHaveProperty('supportsTools')
  })

  it('should throw error when calling methods before configuration', async () => {
    await expect(
      adapter.chatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow('OpenAI adapter not configured')
  })
})

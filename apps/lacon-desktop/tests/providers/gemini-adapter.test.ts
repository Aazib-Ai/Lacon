/**
 * Tests for Gemini provider adapter (Phase 10 - P10-T1.1)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GeminiAdapter } from '../../src/main/providers/gemini-adapter'
import type { ProviderConfig } from '../../src/shared/provider-types'

const mockConfig: ProviderConfig = {
  id: 'test-gemini',
  type: 'gemini',
  name: 'Test Gemini',
  apiKeyId: 'test-key',
  enabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter

  beforeEach(() => {
    adapter = new GeminiAdapter()
    vi.restoreAllMocks()
  })

  describe('Identity and configuration', () => {
    it('should have correct type and name', () => {
      expect(adapter.type).toBe('gemini')
      expect(adapter.name).toBe('Google Gemini')
    })

    it('should not be configured initially', () => {
      expect(adapter.isConfigured()).toBe(false)
    })

    it('should be configured after initialization', async () => {
      await adapter.initialize(mockConfig, 'AIza-test-key')
      expect(adapter.isConfigured()).toBe(true)
    })

    it('should throw when chatCompletion is called before initialization', async () => {
      await expect(
        adapter.chatCompletion({
          model: 'gemini-pro',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      ).rejects.toThrow()
    })
  })

  describe('Available models', () => {
    it('should return Gemini models', async () => {
      const models = await adapter.getAvailableModels()
      expect(models.length).toBeGreaterThan(0)
    })

    it('should include provider as gemini', async () => {
      const models = await adapter.getAvailableModels()
      for (const model of models) {
        expect(model.provider).toBe('gemini')
      }
    })

    it('should have required model properties', async () => {
      const models = await adapter.getAvailableModels()
      for (const model of models) {
        expect(model).toHaveProperty('id')
        expect(model).toHaveProperty('name')
        expect(model).toHaveProperty('contextWindow')
        expect(model.contextWindow).toBeGreaterThan(0)
      }
    })
  })

  describe('chatCompletion - mocked API', () => {
    beforeEach(async () => {
      await adapter.initialize(mockConfig, 'AIza-test-key')
    })

    it('should parse Gemini API response format', async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: { role: 'model', parts: [{ text: 'Gemini response' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse,
      } as Response)

      const response = await adapter.chatCompletion({
        model: 'gemini-pro',
        messages: [{ role: 'user', content: 'hello' }],
      })

      expect(response.choices[0].message.content).toBe('Gemini response')
      expect(response.choices[0].message.role).toBe('assistant')
    })

    it('should throw error on non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      } as unknown as Response)

      await expect(
        adapter.chatCompletion({
          model: 'gemini-pro',
          messages: [{ role: 'user', content: 'test' }],
        }),
      ).rejects.toThrow()
    })
  })
})

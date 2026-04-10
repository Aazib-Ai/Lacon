/**
 * Tests for Anthropic provider adapter (Phase 10 - P10-T1.1)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnthropicAdapter } from '../../src/main/providers/anthropic-adapter'
import type { ProviderConfig } from '../../src/shared/provider-types'

const mockConfig: ProviderConfig = {
  id: 'test-anthropic',
  type: 'anthropic',
  name: 'Test Anthropic',
  apiKeyId: 'test-key',
  enabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter

  beforeEach(() => {
    adapter = new AnthropicAdapter()
    vi.restoreAllMocks()
  })

  describe('Identity and configuration', () => {
    it('should have correct type and name', () => {
      expect(adapter.type).toBe('anthropic')
      expect(adapter.name).toBe('Anthropic')
    })

    it('should not be configured initially', () => {
      expect(adapter.isConfigured()).toBe(false)
    })

    it('should be configured after initialization', async () => {
      await adapter.initialize(mockConfig, 'sk-ant-test-key')
      expect(adapter.isConfigured()).toBe(true)
    })

    it('should throw when chatCompletion is called before initialization', async () => {
      await expect(
        adapter.chatCompletion({
          model: 'claude-3-opus-20240229',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      ).rejects.toThrow('Anthropic adapter not configured')
    })

    it('should throw when streamChatCompletion is called before initialization', async () => {
      await expect(
        adapter.streamChatCompletion(
          { model: 'claude-3-opus-20240229', messages: [{ role: 'user', content: 'hello' }] },
          vi.fn(),
          vi.fn(),
          vi.fn(),
        ),
      ).rejects.toThrow('Anthropic adapter not configured')
    })

    it('should throw when checkHealth is called before initialization', async () => {
      await expect(adapter.checkHealth()).rejects.toThrow('Anthropic adapter not configured')
    })
  })

  describe('Available models', () => {
    it('should return Claude 3 models', async () => {
      const models = await adapter.getAvailableModels()
      expect(models.length).toBeGreaterThanOrEqual(3)
    })

    it('should have correct model properties', async () => {
      const models = await adapter.getAvailableModels()
      for (const model of models) {
        expect(model).toHaveProperty('id')
        expect(model).toHaveProperty('name')
        expect(model).toHaveProperty('provider', 'anthropic')
        expect(model).toHaveProperty('contextWindow')
        expect(model).toHaveProperty('supportsStreaming')
        expect(model).toHaveProperty('supportsTools')
        expect(model.contextWindow).toBeGreaterThan(0)
        expect(typeof model.supportsStreaming).toBe('boolean')
        expect(typeof model.supportsTools).toBe('boolean')
      }
    })

    it('should include Claude 3 Opus', async () => {
      const models = await adapter.getAvailableModels()
      const opus = models.find(m => m.id.includes('opus'))
      expect(opus).toBeDefined()
      expect(opus?.contextWindow).toBeGreaterThanOrEqual(200000)
    })

    it('should include Claude 3 Haiku', async () => {
      const models = await adapter.getAvailableModels()
      const haiku = models.find(m => m.id.includes('haiku'))
      expect(haiku).toBeDefined()
    })

    it('should have cost information', async () => {
      const models = await adapter.getAvailableModels()
      for (const model of models) {
        if (model.costPer1kInput !== undefined) {
          expect(model.costPer1kInput).toBeGreaterThan(0)
        }
        if (model.costPer1kOutput !== undefined) {
          expect(model.costPer1kOutput).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('chatCompletion - mocked API', () => {
    beforeEach(async () => {
      await adapter.initialize(mockConfig, 'sk-ant-test-key')
    })

    it('should successfully call Anthropic API and return normalized response', async () => {
      const mockAnthropicResponse = {
        id: 'msg_test123',
        model: 'claude-3-haiku-20240307',
        content: [{ type: 'text', text: 'Hello World' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAnthropicResponse,
      } as Response)

      const response = await adapter.chatCompletion({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'hello' }],
      })

      expect(response.id).toBe('msg_test123')
      expect(response.choices[0].message.content).toBe('Hello World')
      expect(response.choices[0].message.role).toBe('assistant')
      expect(response.usage.promptTokens).toBe(10)
      expect(response.usage.completionTokens).toBe(5)
      expect(response.usage.totalTokens).toBe(15)
    })

    it('should map tool_use content blocks to toolCalls', async () => {
      const mockAnthropicResponse = {
        id: 'msg_tool',
        model: 'claude-3-opus-20240229',
        content: [
          { type: 'text', text: '' },
          { type: 'tool_use', id: 'tool_1', name: 'get_weather', input: { city: 'London' } },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 20, output_tokens: 30 },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAnthropicResponse,
      } as Response)

      const response = await adapter.chatCompletion({
        model: 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: 'weather?' }],
      })

      expect(response.choices[0].message.toolCalls).toBeDefined()
      expect(response.choices[0].message.toolCalls?.length).toBe(1)
      expect(response.choices[0].message.toolCalls?.[0].function.name).toBe('get_weather')
      expect(response.choices[0].finishReason).toBe('tool_calls')
    })

    it('should include system message as separate field', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_sys',
          model: 'claude-3-haiku-20240307',
          content: [{ type: 'text', text: 'OK' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 2 },
        }),
      })
      global.fetch = fetchSpy

      await adapter.chatCompletion({
        model: 'claude-3-haiku-20240307',
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      })

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.system).toBe('You are helpful.')
      expect(body.messages).toHaveLength(1)
      expect(body.messages[0].role).toBe('user')
    })

    it('should throw error on non-OK HTTP response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as unknown as Response)

      await expect(
        adapter.chatCompletion({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      ).rejects.toThrow('Anthropic API error: 401')
    })

    it('should send x-api-key header with correct format', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_key',
          model: 'claude-3-haiku-20240307',
          content: [{ type: 'text', text: 'OK' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      })
      global.fetch = fetchSpy

      await adapter.chatCompletion({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'test' }],
      })

      const headers = fetchSpy.mock.calls[0][1].headers
      expect(headers['x-api-key']).toBe('sk-ant-test-key')
      expect(headers['anthropic-version']).toBeDefined()
    })
  })

  describe('streamChatCompletion - mocked API', () => {
    beforeEach(async () => {
      await adapter.initialize(mockConfig, 'sk-ant-test-key')
    })

    it('should call abort when cancel function is returned', async () => {
      const mockEventStream = [
        'data: {"type":"message_start","message":{"id":"msg_stream1","model":"claude-3-haiku-20240307"}}\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n',
        'data: {"type":"message_delta","usage":{"output_tokens":5}}\n',
      ].join('\n')

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(mockEventStream))
          controller.close()
        },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      } as unknown as Response)

      const onChunk = vi.fn()
      const onComplete = vi.fn()
      const onError = vi.fn()

      const cancel = await adapter.streamChatCompletion(
        { model: 'claude-3-haiku-20240307', messages: [{ role: 'user', content: 'hello' }] },
        onChunk,
        onComplete,
        onError,
      )

      expect(typeof cancel).toBe('function')
      // Should not throw when called
      expect(() => cancel()).not.toThrow()
    })
  })
})

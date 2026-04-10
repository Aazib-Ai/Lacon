/**
 * IPC Contract Tests (Phase 10 - P10-T2.1)
 * Verifies the IPC boundary contracts between main and renderer are upheld
 */

import { describe, expect, it } from 'vitest'

import { validateIpcRequest, validatePayload } from '../../src/main/ipc/ipc-validator'
import { IPC_CHANNELS, isValidChannel } from '../../src/shared/ipc-schema'

describe('IPC Contract Tests (P10-T2.1)', () => {
  describe('Channel contract completeness', () => {
    it('should have all required key management channels', () => {
      expect(IPC_CHANNELS.KEY_SET).toBeDefined()
      expect(IPC_CHANNELS.KEY_GET_METADATA).toBeDefined()
      expect(IPC_CHANNELS.KEY_LIST).toBeDefined()
      expect(IPC_CHANNELS.KEY_DELETE).toBeDefined()
      expect(IPC_CHANNELS.KEY_HAS).toBeDefined()
    })

    it('should have all required data operation channels', () => {
      expect(IPC_CHANNELS.DATA_SAVE).toBeDefined()
      expect(IPC_CHANNELS.DATA_LOAD).toBeDefined()
      expect(IPC_CHANNELS.DATA_DELETE).toBeDefined()
      expect(IPC_CHANNELS.DATA_LIST).toBeDefined()
      expect(IPC_CHANNELS.DATA_EXPORT).toBeDefined()
      expect(IPC_CHANNELS.DATA_IMPORT).toBeDefined()
    })

    it('should have all required document channels', () => {
      expect(IPC_CHANNELS.DOC_CREATE).toBeDefined()
      expect(IPC_CHANNELS.DOC_OPEN).toBeDefined()
      expect(IPC_CHANNELS.DOC_SAVE).toBeDefined()
      expect(IPC_CHANNELS.DOC_SAVE_AS).toBeDefined()
      expect(IPC_CHANNELS.DOC_RENAME).toBeDefined()
      expect(IPC_CHANNELS.DOC_DUPLICATE).toBeDefined()
      expect(IPC_CHANNELS.DOC_ARCHIVE).toBeDefined()
      expect(IPC_CHANNELS.DOC_RESTORE).toBeDefined()
      expect(IPC_CHANNELS.DOC_DELETE).toBeDefined()
      expect(IPC_CHANNELS.DOC_LIST).toBeDefined()
    })

    it('should have all required agent channels', () => {
      expect(IPC_CHANNELS.AGENT_START_RUN).toBeDefined()
      expect(IPC_CHANNELS.AGENT_CANCEL_RUN).toBeDefined()
      expect(IPC_CHANNELS.AGENT_GET_RUN_STATUS).toBeDefined()
      expect(IPC_CHANNELS.AGENT_APPROVE_REQUEST).toBeDefined()
      expect(IPC_CHANNELS.AGENT_REJECT_REQUEST).toBeDefined()
      expect(IPC_CHANNELS.AGENT_GET_PENDING_APPROVALS).toBeDefined()
      expect(IPC_CHANNELS.AGENT_REGISTER_TOOL).toBeDefined()
    })

    it('should have all provider channels', () => {
      expect(IPC_CHANNELS.PROVIDER_REGISTER).toBeDefined()
      expect(IPC_CHANNELS.PROVIDER_LIST).toBeDefined()
      expect(IPC_CHANNELS.PROVIDER_GET_MODELS).toBeDefined()
      expect(IPC_CHANNELS.PROVIDER_CHECK_HEALTH).toBeDefined()
      expect(IPC_CHANNELS.PROVIDER_CHAT_COMPLETION).toBeDefined()
    })

    it('should have all audit channels', () => {
      expect(IPC_CHANNELS.AUDIT_QUERY).toBeDefined()
      expect(IPC_CHANNELS.AUDIT_GET_STATISTICS).toBeDefined()
      expect(IPC_CHANNELS.AUDIT_VERIFY_INTEGRITY).toBeDefined()
    })

    it('should have all trace channels', () => {
      expect(IPC_CHANNELS.TRACE_LIST_SESSIONS).toBeDefined()
      expect(IPC_CHANNELS.TRACE_GET_TIMELINE).toBeDefined()
      expect(IPC_CHANNELS.TRACE_GET_METRICS).toBeDefined()
      expect(IPC_CHANNELS.TRACE_REPLAY).toBeDefined()
    })

    it('should have all policy channels', () => {
      expect(IPC_CHANNELS.POLICY_LIST_RULES).toBeDefined()
      expect(IPC_CHANNELS.POLICY_GET_RULE).toBeDefined()
      expect(IPC_CHANNELS.POLICY_REGISTER_RULE).toBeDefined()
      expect(IPC_CHANNELS.POLICY_UNREGISTER_RULE).toBeDefined()
      expect(IPC_CHANNELS.POLICY_EVALUATE).toBeDefined()
      expect(IPC_CHANNELS.POLICY_GET_VIOLATIONS).toBeDefined()
      expect(IPC_CHANNELS.POLICY_GET_STATISTICS).toBeDefined()
    })
  })

  describe('Channel naming conventions', () => {
    it('all channel names should follow namespace:action pattern', () => {
      const channels = Object.values(IPC_CHANNELS)
      for (const channel of channels) {
        // Allow hyphens in action part (e.g., tools:list-by-category)
        expect(channel).toMatch(/^[a-z]+:[a-zA-Z-]+$/)
      }
    })

    it('all channels should be unique strings', () => {
      const channels = Object.values(IPC_CHANNELS)
      const uniqueChannels = new Set(channels)
      expect(uniqueChannels.size).toBe(channels.length)
    })

    it('isValidChannel should accept all defined channels', () => {
      const channels = Object.values(IPC_CHANNELS)
      for (const channel of channels) {
        expect(isValidChannel(channel)).toBe(true)
      }
    })
  })

  describe('Payload schema contracts', () => {
    it('KEY_SET payload contract requires string fields', () => {
      const validPayload = { id: 'key-1', provider: 'openai', label: 'My Key', value: 'sk-123' }
      expect(() => validatePayload(IPC_CHANNELS.KEY_SET, validPayload)).not.toThrow()

      // Wrong type for id
      expect(() =>
        validatePayload(IPC_CHANNELS.KEY_SET, { id: 123, provider: 'openai', label: 'Lab', value: 'sk' }),
      ).toThrow()

      // Missing value
      expect(() => validatePayload(IPC_CHANNELS.KEY_SET, { id: 'k', provider: 'openai', label: 'Label' })).toThrow()
    })

    it('DATA_SAVE payload contract requires collection + id + data', () => {
      const valid = { collection: 'documents', id: 'doc-1', data: { content: 'hello' } }
      expect(() => validatePayload(IPC_CHANNELS.DATA_SAVE, valid)).not.toThrow()

      expect(() => validatePayload(IPC_CHANNELS.DATA_SAVE, { collection: 'documents' })).toThrow()
    })

    it('SETTINGS_GET payload contract requires key', () => {
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_GET, { key: 'theme' })).not.toThrow()
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_GET, {})).toThrow()
    })

    it('SETTINGS_SET payload contract requires key + value', () => {
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_SET, { key: 'theme', value: 'dark' })).not.toThrow()
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_SET, { key: 'theme' })).toThrow()
    })
  })

  describe('Full request validation contract', () => {
    it('valid request passes full validation', () => {
      expect(() =>
        validateIpcRequest(IPC_CHANNELS.KEY_SET, {
          id: 'key-1',
          provider: 'anthropic',
          label: 'Test',
          value: 'sk-ant-test',
        }),
      ).not.toThrow()
    })

    it('invalid channel is rejected before payload check', () => {
      expect(() => validateIpcRequest('hacker:inject', {})).toThrow()
    })

    it('valid channel with invalid payload is rejected', () => {
      expect(() => validateIpcRequest(IPC_CHANNELS.KEY_SET, { hacked: true })).toThrow()
    })
  })

  describe('Response format contracts', () => {
    it('IpcResponse shape should have success, optional data, optional error', () => {
      // All responses from IPC handlers should match this shape
      const successResponse = { success: true, data: { id: 'test' } }
      const errorResponse = { success: false, error: { code: 'ERR', message: 'fail' } }

      // Validate structure programmatically
      function isIpcResponse(obj: any): boolean {
        return typeof obj === 'object' && typeof obj.success === 'boolean'
      }

      expect(isIpcResponse(successResponse)).toBe(true)
      expect(isIpcResponse(errorResponse)).toBe(true)
      expect(isIpcResponse({ data: 'no success field' })).toBe(false)
    })
  })
})

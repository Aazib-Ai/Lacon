/**
 * Tests for IPC validation
 */

import { describe, expect, it } from 'vitest'

import {
  IpcValidationError,
  validateChannel,
  validateIpcRequest,
  validatePayload,
} from '../../src/main/ipc/ipc-validator'
import { IPC_CHANNELS } from '../../src/shared/ipc-schema'

describe('IPC Validator', () => {
  describe('validateChannel', () => {
    it('should accept valid channels', () => {
      expect(() => validateChannel(IPC_CHANNELS.KEY_SET)).not.toThrow()
      expect(() => validateChannel(IPC_CHANNELS.KEY_LIST)).not.toThrow()
      expect(() => validateChannel(IPC_CHANNELS.DATA_SAVE)).not.toThrow()
    })

    it('should reject invalid channels', () => {
      expect(() => validateChannel('invalid:channel')).toThrow(IpcValidationError)
      expect(() => validateChannel('random')).toThrow(IpcValidationError)
      expect(() => validateChannel('')).toThrow(IpcValidationError)
    })

    it('should include channel name in error', () => {
      try {
        validateChannel('bad:channel')
      } catch (error) {
        expect(error).toBeInstanceOf(IpcValidationError)
        expect((error as IpcValidationError).message).toContain('bad:channel')
      }
    })
  })

  describe('validatePayload - KEY_SET', () => {
    it('should accept valid KEY_SET payload', () => {
      const payload = {
        id: 'test-key',
        provider: 'openai',
        label: 'Test Key',
        value: 'sk-test123',
      }
      expect(() => validatePayload(IPC_CHANNELS.KEY_SET, payload)).not.toThrow()
    })

    it('should reject KEY_SET with missing fields', () => {
      const payload = {
        id: 'test-key',
        provider: 'openai',
        // missing label and value
      }
      expect(() => validatePayload(IPC_CHANNELS.KEY_SET, payload)).toThrow(IpcValidationError)
    })

    it('should reject KEY_SET with wrong types', () => {
      const payload = {
        id: 123, // should be string
        provider: 'openai',
        label: 'Test',
        value: 'sk-test',
      }
      expect(() => validatePayload(IPC_CHANNELS.KEY_SET, payload)).toThrow(IpcValidationError)
    })
  })

  describe('validatePayload - KEY_GET_METADATA', () => {
    it('should accept valid KEY_GET_METADATA payload', () => {
      const payload = { id: 'test-key' }
      expect(() => validatePayload(IPC_CHANNELS.KEY_GET_METADATA, payload)).not.toThrow()
    })

    it('should reject KEY_GET_METADATA with missing id', () => {
      const payload = {}
      expect(() => validatePayload(IPC_CHANNELS.KEY_GET_METADATA, payload)).toThrow(IpcValidationError)
    })
  })

  describe('validatePayload - DATA_SAVE', () => {
    it('should accept valid DATA_SAVE payload', () => {
      const payload = {
        collection: 'documents',
        id: 'doc-1',
        data: { title: 'Test' },
      }
      expect(() => validatePayload(IPC_CHANNELS.DATA_SAVE, payload)).not.toThrow()
    })

    it('should reject DATA_SAVE with missing fields', () => {
      const payload = {
        collection: 'documents',
        // missing id and data
      }
      expect(() => validatePayload(IPC_CHANNELS.DATA_SAVE, payload)).toThrow(IpcValidationError)
    })

    it('should reject DATA_SAVE with wrong types', () => {
      const payload = {
        collection: 123, // should be string
        id: 'doc-1',
        data: {},
      }
      expect(() => validatePayload(IPC_CHANNELS.DATA_SAVE, payload)).toThrow(IpcValidationError)
    })
  })

  describe('validatePayload - KEY_LIST', () => {
    it('should accept KEY_LIST with no payload', () => {
      expect(() => validatePayload(IPC_CHANNELS.KEY_LIST, undefined)).not.toThrow()
      expect(() => validatePayload(IPC_CHANNELS.KEY_LIST, null)).not.toThrow()
      expect(() => validatePayload(IPC_CHANNELS.KEY_LIST, {})).not.toThrow()
    })
  })

  describe('validatePayload - SETTINGS_GET', () => {
    it('should accept valid SETTINGS_GET payload', () => {
      const payload = { key: 'theme' }
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_GET, payload)).not.toThrow()
    })

    it('should reject SETTINGS_GET with missing key', () => {
      const payload = {}
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_GET, payload)).toThrow(IpcValidationError)
    })
  })

  describe('validatePayload - SETTINGS_SET', () => {
    it('should accept valid SETTINGS_SET payload', () => {
      const payload = { key: 'theme', value: 'dark' }
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_SET, payload)).not.toThrow()
    })

    it('should accept SETTINGS_SET with any value type', () => {
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_SET, { key: 'theme', value: 'dark' })).not.toThrow()
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_SET, { key: 'count', value: 42 })).not.toThrow()
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_SET, { key: 'enabled', value: true })).not.toThrow()
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_SET, { key: 'config', value: {} })).not.toThrow()
    })

    it('should reject SETTINGS_SET with missing key', () => {
      const payload = { value: 'dark' }
      expect(() => validatePayload(IPC_CHANNELS.SETTINGS_SET, payload)).toThrow(IpcValidationError)
    })
  })

  describe('validateIpcRequest', () => {
    it('should validate both channel and payload', () => {
      const payload = {
        id: 'test-key',
        provider: 'openai',
        label: 'Test',
        value: 'sk-test',
      }
      expect(() => validateIpcRequest(IPC_CHANNELS.KEY_SET, payload)).not.toThrow()
    })

    it('should reject invalid channel', () => {
      const payload = { id: 'test' }
      expect(() => validateIpcRequest('invalid:channel', payload)).toThrow(IpcValidationError)
    })

    it('should reject invalid payload', () => {
      const payload = { wrong: 'fields' }
      expect(() => validateIpcRequest(IPC_CHANNELS.KEY_SET, payload)).toThrow(IpcValidationError)
    })
  })

  describe('IpcValidationError', () => {
    it('should create error with code and message', () => {
      const error = new IpcValidationError('TEST_CODE', 'Test message')
      expect(error.code).toBe('TEST_CODE')
      expect(error.message).toBe('Test message')
      expect(error.name).toBe('IpcValidationError')
    })

    it('should include details', () => {
      const details = { field: 'test' }
      const error = new IpcValidationError('TEST_CODE', 'Test message', details)
      expect(error.details).toEqual(details)
    })

    it('should convert to IpcError format', () => {
      const error = new IpcValidationError('TEST_CODE', 'Test message', { field: 'test' })
      const ipcError = error.toIpcError()

      expect(ipcError.code).toBe('TEST_CODE')
      expect(ipcError.message).toBe('Test message')
      expect(ipcError.details).toEqual({ field: 'test' })
    })
  })
})

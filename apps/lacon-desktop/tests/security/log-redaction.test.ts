/**
 * Tests for log redaction
 */

import { describe, expect, it } from 'vitest'

import { redactError, redactObject, redactString } from '../../src/main/security/log-redaction'

describe('Log Redaction', () => {
  describe('redactString', () => {
    it('should redact OpenAI-style API keys', () => {
      const input = 'Using key sk-1234567890abcdefghijklmnopqrstuvwxyz'
      const output = redactString(input)
      expect(output).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz')
      expect(output).toContain('[REDACTED]')
    })

    it('should redact Bearer tokens', () => {
      const input = 'Authorization: Bearer abc123def456ghi789'
      const output = redactString(input)
      expect(output).not.toContain('Bearer abc123def456ghi789')
      expect(output).toContain('[REDACTED]')
    })

    it('should redact api_key patterns', () => {
      const input = 'api_key: "secret123456789"'
      const output = redactString(input)
      expect(output).not.toContain('secret123456789')
      expect(output).toContain('[REDACTED]')
    })

    it('should redact email addresses', () => {
      const input = 'User email: user@example.com'
      const output = redactString(input)
      expect(output).not.toContain('user@example.com')
      expect(output).toContain('[REDACTED]')
    })

    it('should redact credit card numbers', () => {
      const input = 'Card: 4532-1234-5678-9010'
      const output = redactString(input)
      expect(output).not.toContain('4532-1234-5678-9010')
      expect(output).toContain('[REDACTED]')
    })

    it('should redact phone numbers', () => {
      const input = 'Phone: 555-123-4567'
      const output = redactString(input)
      expect(output).not.toContain('555-123-4567')
      expect(output).toContain('[REDACTED]')
    })

    it('should handle multiple sensitive patterns', () => {
      const input = 'api_key: sk-test123, email: user@test.com'
      const output = redactString(input)
      expect(output).not.toContain('sk-test123')
      expect(output).not.toContain('user@test.com')
      expect(output).toContain('[REDACTED]')
    })

    it('should not redact normal text', () => {
      const input = 'This is a normal log message'
      const output = redactString(input)
      expect(output).toBe(input)
    })
  })

  describe('redactObject', () => {
    it('should redact sensitive field names', () => {
      const input = {
        apiKey: 'secret123',
        username: 'john',
        password: 'pass123',
      }
      const output = redactObject(input)

      expect(output.apiKey).toBe('[REDACTED]')
      expect(output.password).toBe('[REDACTED]')
      expect(output.username).toBe('john')
    })

    it('should redact nested objects', () => {
      const input = {
        user: {
          name: 'john',
          credentials: {
            apiKey: 'secret123',
            token: 'token456',
          },
        },
      }
      const output = redactObject(input)

      expect(output.user.name).toBe('john')
      expect(output.user.credentials.apiKey).toBe('[REDACTED]')
      expect(output.user.credentials.token).toBe('[REDACTED]')
    })

    it('should redact arrays', () => {
      const input = {
        keys: [
          { id: '1', apiKey: 'secret1' },
          { id: '2', apiKey: 'secret2' },
        ],
      }
      const output = redactObject(input)

      expect(output.keys[0].id).toBe('1')
      expect(output.keys[0].apiKey).toBe('[REDACTED]')
      expect(output.keys[1].apiKey).toBe('[REDACTED]')
    })

    it('should redact string values with patterns', () => {
      const input = {
        message: 'Using key sk-test123456789',
        email: 'user@example.com',
      }
      const output = redactObject(input)

      expect(output.message).not.toContain('sk-test123456789')
      expect(output.email).not.toContain('user@example.com')
    })

    it('should handle null and undefined', () => {
      expect(redactObject(null)).toBeNull()
      expect(redactObject(undefined)).toBeUndefined()
    })

    it('should handle primitive types', () => {
      expect(redactObject('test')).toBe('test')
      expect(redactObject(123)).toBe(123)
      expect(redactObject(true)).toBe(true)
    })

    it('should redact all sensitive field variations', () => {
      const input = {
        apiKey: 'secret1',
        api_key: 'secret2',
        secretKey: 'secret3',
        secret_key: 'secret4',
        accessToken: 'secret5',
        access_token: 'secret6',
        privateKey: 'secret7',
        private_key: 'secret8',
      }
      const output = redactObject(input)

      Object.values(output).forEach(value => {
        expect(value).toBe('[REDACTED]')
      })
    })
  })

  describe('redactError', () => {
    it('should redact error message', () => {
      const error = new Error('API key sk-test123 is invalid')
      const output = redactError(error)

      expect(output.message).not.toContain('sk-test123')
      expect(output.message).toContain('[REDACTED]')
    })

    it('should redact stack trace', () => {
      const error = new Error('Error with key sk-test123')
      error.stack = 'Error: Error with key sk-test123\n    at test.ts:10:5'

      const output = redactError(error)

      expect(output.stack).not.toContain('sk-test123')
      expect(output.stack).toContain('[REDACTED]')
    })

    it('should preserve error name', () => {
      const error = new TypeError('Invalid key')
      const output = redactError(error)

      expect(output.name).toBe('TypeError')
    })

    it('should handle errors without stack', () => {
      const error = new Error('Test error')
      delete error.stack

      const output = redactError(error)

      expect(output.stack).toBeUndefined()
    })
  })
})

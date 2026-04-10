/**
 * IPC abuse and fuzz tests (Phase 10 - P10-T7)
 * Tests for invalid payload floods, unknown command injection, and concurrency abuse
 */

import { describe, expect, it } from 'vitest'

import {
  IpcValidationError,
  validateChannel,
  validateIpcRequest,
  validatePayload,
} from '../../src/main/ipc/ipc-validator'
import { IPC_CHANNELS, isValidChannel } from '../../src/shared/ipc-schema'

// --- P10-T7.1: Invalid payload floods ---

describe('IPC Security: Invalid Payload Floods (P10-T7.1)', () => {
  const fuzzPayloads = [
    null,
    undefined,
    '',
    0,
    false,
    [],
    [1, 2, 3],
    'malicious string',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    {},
    { __proto__: { admin: true } },
    { constructor: { prototype: { x: 1 } } },
    { id: '\0' },
    { id: '<script>alert(1)</script>' },
    { id: "'; DROP TABLE users; --" },
    { id: '../../../etc/passwd' },
    { id: 'A'.repeat(100000) },
    // Template injection attempt: build the string at runtime to satisfy lint rules
    { id: ['$', '{process.env.SECRET}'].join('') },
  ]

  it.each(fuzzPayloads.map((p, i) => [`fuzz-${i}`, p]))(
    'should reject fuzz payload %s for KEY_SET',
    (_name, payload) => {
      // All of these should throw some error (TypeError, IpcValidationError, etc.) — never succeed
      let threw = false
      try {
        validatePayload(IPC_CHANNELS.KEY_SET, payload)
      } catch (err) {
        threw = true
        // Must be some form of Error (could be TypeError for null, IpcValidationError for objects)
        expect(err).toBeInstanceOf(Error)
      }
      // All fuzz payloads should be rejected
      expect(threw).toBe(true)
    },
  )

  it('should handle 1000 rapid invalid payload calls without crashing', () => {
    let errorCount = 0
    for (let i = 0; i < 1000; i += 1) {
      try {
        validatePayload(IPC_CHANNELS.KEY_SET, { corrupted: true, index: i })
      } catch {
        errorCount += 1
      }
    }
    expect(errorCount).toBe(1000)
  })

  it('should not allow prototype pollution via KEY_SET payload', () => {
    const before = (Object.prototype as any).admin
    try {
      validatePayload(IPC_CHANNELS.KEY_SET, {
        __proto__: { admin: true },
        id: 'x',
        provider: 'y',
        label: 'z',
        value: 'v',
      })
    } catch {
      // expected
    }
    expect((Object.prototype as any).admin).toBe(before)
  })
})

// --- P10-T7.2: Unknown command injection attempts ---

describe('IPC Security: Unknown Command Injection (P10-T7.2)', () => {
  const injectionChannels = [
    '',
    'admin:bypass',
    'key:set; rm -rf /',
    'key:set\0malicious',
    '__proto__:pollute',
    'eval:code',
    'exec:shell',
    '../ipc:handler',
    'key:set\ninjected:channel',
    '<script>:run',
    'A'.repeat(10000),
  ]

  it.each(injectionChannels.map((c, i) => [`channel-${i}`, c]))(
    'should reject injected channel name %s',
    (_name, channel) => {
      expect(() => validateChannel(channel)).toThrow(IpcValidationError)
    },
  )

  it('should not expose internal channel lookup to unknown names', () => {
    expect(isValidChannel('admin:bypass')).toBe(false)
    expect(isValidChannel('eval:code')).toBe(false)
    expect(isValidChannel('key:set; rm -rf /')).toBe(false)
    expect(isValidChannel('')).toBe(false)
  })

  it('should accept all legitimate channels and reject all others', () => {
    const legit = Object.values(IPC_CHANNELS)
    for (const c of legit) {
      expect(isValidChannel(c)).toBe(true)
    }

    const fake = ['foo:bar', 'baz:qux', 'hack:break']
    for (const c of fake) {
      expect(isValidChannel(c)).toBe(false)
    }
  })
})

// --- P10-T7.3: Concurrency abuse scenarios ---

describe('IPC Security: Concurrency Abuse (P10-T7.3)', () => {
  it('should handle 100 concurrent validation calls safely', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      Promise.resolve().then(() => {
        try {
          validatePayload(IPC_CHANNELS.KEY_SET, {
            id: `key-${i}`,
            provider: 'openai',
            label: `Key ${i}`,
            value: `sk-${i}`,
          })
          return 'valid'
        } catch {
          return 'invalid'
        }
      }),
    )

    const results = await Promise.all(promises)
    // All should be 'valid' (proper payloads)
    expect(results.every(r => r === 'valid')).toBe(true)
  })

  it('should handle mixed valid/invalid concurrent calls safely', async () => {
    const validPayload = { id: 'key-1', provider: 'openai', label: 'Test', value: 'sk-test' }
    const invalidPayload = { corrupted: true }

    const results = await Promise.all([
      ...Array.from({ length: 50 }, () =>
        Promise.resolve().then(() => {
          try {
            validatePayload(IPC_CHANNELS.KEY_SET, validPayload)
            return 'valid'
          } catch {
            return 'error'
          }
        }),
      ),
      ...Array.from({ length: 50 }, () =>
        Promise.resolve().then(() => {
          try {
            validatePayload(IPC_CHANNELS.KEY_SET, invalidPayload)
            return 'valid'
          } catch {
            return 'error'
          }
        }),
      ),
    ])

    const validCount = results.filter(r => r === 'valid').length
    const errorCount = results.filter(r => r === 'error').length

    expect(validCount).toBe(50)
    expect(errorCount).toBe(50)
  })

  it('should validate full request concurrently without data corruption', async () => {
    const requests = Array.from({ length: 200 }, (_, i) => ({
      channel: IPC_CHANNELS.DATA_SAVE,
      payload: {
        collection: 'documents',
        id: `doc-${i}`,
        data: { content: `document ${i}`, index: i },
      },
    }))

    const results = await Promise.all(
      requests.map(req =>
        Promise.resolve().then(() => {
          try {
            validateIpcRequest(req.channel, req.payload)
            return req.payload.id
          } catch {
            return null
          }
        }),
      ),
    )

    // All 200 should pass validation
    const validResults = results.filter(r => r !== null)
    expect(validResults).toHaveLength(200)

    // Verify no data corruption (each result should match its original id)
    for (let i = 0; i < 200; i += 1) {
      expect(results[i]).toBe(`doc-${i}`)
    }
  })
})

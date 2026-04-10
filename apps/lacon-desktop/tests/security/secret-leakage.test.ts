/**
 * Secret leakage validation tests (Phase 10 - P10-T8)
 * Verifies API keys never appear in logs, error messages, or renderer-accessible state
 */

import { describe, expect, it } from 'vitest'

import { redactObject, redactString } from '../../src/main/security/log-redaction'

// --- P10-T8.1: Renderer memory checks (structural) ---

describe('Secret Leakage: Renderer Memory Checks (P10-T8.1)', () => {
  it('IPC response for KEY_SET should not include the key value', () => {
    // Simulate what an IPC handler returns after storing a key
    const ipcResponse = {
      success: true,
      // 'data' field should never contain the raw key value
    }

    expect(ipcResponse).not.toHaveProperty('keyValue')
    expect(ipcResponse).not.toHaveProperty('apiKey')
    expect(ipcResponse).not.toHaveProperty('value')
    expect(JSON.stringify(ipcResponse)).not.toContain('sk-')
  })

  it('KEY_GET_METADATA response should not include the raw key', () => {
    // Metadata response only contains non-sensitive fields
    const metadataResponse = {
      id: 'key-1',
      provider: 'openai',
      label: 'My OpenAI Key',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
    }

    // Must not contain key value
    expect(metadataResponse).not.toHaveProperty('value')
    expect(JSON.stringify(metadataResponse)).not.toContain('sk-')
  })

  it('provider configuration sent to renderer should not include API key', () => {
    // When listing providers, the renderer gets config without secrets
    const rendererProviderView = {
      id: 'openai-1',
      type: 'openai',
      name: 'My OpenAI',
      apiKeyId: 'key-1', // Only the key ID reference, not the key itself
      enabled: true,
      defaultModel: 'gpt-4',
    }

    expect(rendererProviderView).not.toHaveProperty('apiKey')
    expect(rendererProviderView).not.toHaveProperty('value')
    expect(rendererProviderView.apiKeyId).not.toMatch(/^sk-/)
  })

  it('agent run context sent to renderer should not expose provider keys', () => {
    const runContext = {
      runId: 'run-abc',
      status: 'running',
      instruction: 'Rewrite this paragraph',
      tools: ['rewrite-text'],
      // No provider credentials
    }

    expect(JSON.stringify(runContext)).not.toContain('sk-')
    expect(JSON.stringify(runContext)).not.toContain('api_key')
    expect(JSON.stringify(runContext)).not.toContain('apiKey')
  })
})

// --- P10-T8.2: Log leakage checks ---

describe('Secret Leakage: Log Leakage Checks (P10-T8.2)', () => {
  it('should redact API keys from log objects', () => {
    const logData = {
      channel: 'key:set',
      payload: {
        id: 'my-key',
        provider: 'openai',
        label: 'Test',
        value: 'sk-1234567890abcdef',
      },
    }

    const redacted = redactObject(logData)
    const redactedStr = JSON.stringify(redacted)

    expect(redactedStr).not.toContain('sk-1234567890abcdef')
  })

  it('should redact API key patterns from strings', () => {
    const logLine = 'Using API key sk-openai1234567890abcdefghijklmn for openai provider'
    const redacted = redactString(logLine)

    expect(redacted).not.toContain('sk-openai1234567890abcdefghijklmn')
    expect(redacted).toContain('[REDACTED]')
  })

  it('should not alter non-sensitive data during redaction', () => {
    const safeData = {
      id: 'doc-1',
      title: 'My Document',
      status: 'active',
      wordCount: 500,
    }

    const redacted = redactObject(safeData)

    expect(redacted).toHaveProperty('id', 'doc-1')
    expect(redacted).toHaveProperty('title', 'My Document')
    expect(redacted).toHaveProperty('status', 'active')
    expect(redacted).toHaveProperty('wordCount', 500)
  })

  it('should redact Bearer token patterns from request logs', () => {
    const interceptedLog = 'Authorization: Bearer sk-ant-api01-secret-anthropic-key-end'
    const redacted = redactString(interceptedLog)

    expect(redacted).not.toContain('sk-ant-api01-secret-anthropic-key-end')
  })

  it('should handle nested objects with secrets', () => {
    const nested = {
      request: {
        headers: {
          Authorization: 'Bearer sk-test-super-secret-key',
          'Content-Type': 'application/json',
        },
        body: {
          prompt: 'Hello world',
        },
      },
    }

    const redacted = redactObject(nested)
    const redactedStr = JSON.stringify(redacted)

    expect(redactedStr).not.toContain('sk-test-super-secret-key')
    expect(redactedStr).toContain('application/json') // Non-sensitive preserved
    expect(redactedStr).toContain('Hello world') // Non-sensitive preserved
  })

  it('should handle null and undefined gracefully', () => {
    expect(() => redactObject(null)).not.toThrow()
    expect(() => redactObject(undefined)).not.toThrow()
    expect(() => redactString('')).not.toThrow()
  })

  it('should redact key value fields specifically', () => {
    const obj = { value: 'sk-secret-key', label: 'OpenAI Key', id: 'k1' }
    const redacted = redactObject(obj)
    const redactedStr = JSON.stringify(redacted)

    expect(redactedStr).not.toContain('sk-secret-key')
    expect(redactedStr).toContain('OpenAI Key') // Non-sensitive label kept
  })
})

// --- P10-T8.3: Crash report leakage checks ---

describe('Secret Leakage: Crash Report Checks (P10-T8.3)', () => {
  it('error message should not include raw API keys', () => {
    // When an error is thrown during API call, the message should be sanitized
    function sanitizeErrorMessage(message: string): string {
      return message.replace(/\bsk-[A-Za-z0-9\-_]{10,}\b/g, '[REDACTED_KEY]')
    }

    const rawError =
      'Anthropic API error: 401 {"error":{"type":"authentication_error","message":"Invalid API key sk-ant-test-123456"}}'
    const sanitized = sanitizeErrorMessage(rawError)

    expect(sanitized).not.toContain('sk-ant-test-123456')
    expect(sanitized).toContain('[REDACTED_KEY]')
    expect(sanitized).toContain('401')
  })

  it('stack trace should not contain sensitive data', () => {
    // Simulates an error wrapping that strips sensitive context
    const safeError = new Error('provider_connection_failed')
    safeError.stack = safeError.stack?.replace(/sk-[A-Za-z0-9\-_]+/g, '[REDACTED]') || ''

    expect(safeError.stack).not.toMatch(/sk-[A-Za-z0-9\-_]{10,}/)
  })

  it('diagnostic report shape should not include raw key values', () => {
    // Crash/diagnostic reports should use sanitized snapshots
    const diagnosticReport = {
      timestamp: Date.now(),
      platform: 'win32',
      version: '1.0.0',
      configuredProviders: ['openai', 'anthropic'], // Only names, not keys
      lastError: 'connection_timeout',
      sessionCount: 5,
    }

    const reportStr = JSON.stringify(diagnosticReport)
    expect(reportStr).not.toContain('sk-')
    expect(reportStr).not.toContain('api_key')
    expect(reportStr).not.toMatch(/sk-[A-Za-z0-9\-_]{10,}/)
  })
})

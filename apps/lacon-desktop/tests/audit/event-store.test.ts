/**
 * Tests for Audit Event Store
 * Phase 9: Epic P9-E1
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { AuditEventStore } from '../../src/main/audit/event-store'

describe('AuditEventStore', () => {
  let store: AuditEventStore

  beforeEach(() => {
    store = new AuditEventStore({
      enabled: true,
      retentionDays: 90,
      archiveEnabled: false,
      autoCleanup: true,
    })
  })

  describe('Event Appending (P9-T2.1)', () => {
    it('should append events to store', () => {
      const event = store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Test prompt',
        metadata: {
          characterCount: 11,
          wordCount: 2,
        },
      })

      expect(event.id).toBeDefined()
      expect(event.type).toBe('prompt-submitted')
      expect(event.sessionId).toBe('session-1')
      expect(event.integrity).toBeDefined()
      expect(store.count()).toBe(1)
    })

    it('should make events immutable', () => {
      const event = store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Test',
        metadata: { characterCount: 4, wordCount: 1 },
      })

      expect(() => {
        // @ts-expect-error Testing immutability
        event.type = 'response-received'
      }).toThrow()
    })

    it('should generate unique event IDs', () => {
      const event1 = store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Test 1',
        metadata: { characterCount: 6, wordCount: 2 },
      })

      const event2 = store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Test 2',
        metadata: { characterCount: 6, wordCount: 2 },
      })

      expect(event1.id).not.toBe(event2.id)
    })
  })

  describe('Event Integrity (P9-T2.2)', () => {
    it('should calculate integrity hash', () => {
      const event = store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Test',
        metadata: { characterCount: 4, wordCount: 1 },
      })

      expect(event.integrity).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hash
    })

    it('should verify event integrity', () => {
      const event = store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Test',
        metadata: { characterCount: 4, wordCount: 1 },
      })

      const result = store.verifyIntegrity(event.id)
      expect(result.valid).toBe(true)
      expect(result.expectedHash).toBe(event.integrity)
      expect(result.actualHash).toBe(event.integrity)
    })

    it('should verify all events', () => {
      store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Test 1',
        metadata: { characterCount: 6, wordCount: 2 },
      })

      store.append('response-received', 'session-1', {
        type: 'response',
        content: 'Response 1',
        provider: 'openai',
        model: 'gpt-4',
        metadata: { tokens: 100, latencyMs: 500 },
      })

      const results = store.verifyAllIntegrity()
      expect(results).toHaveLength(2)
      expect(results.every(r => r.valid)).toBe(true)
    })
  })

  describe('Event Querying', () => {
    beforeEach(() => {
      // Add test events
      store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Prompt 1',
        metadata: { characterCount: 8, wordCount: 2 },
      })

      store.append('response-received', 'session-1', {
        type: 'response',
        content: 'Response 1',
        provider: 'openai',
        model: 'gpt-4',
        metadata: { tokens: 100, latencyMs: 500 },
      })

      store.append('tool-executed', 'session-1', {
        type: 'tool',
        toolName: 'test-tool',
        action: 'executed',
        input: {},
        output: {},
        metadata: {
          riskLevel: 'low',
          executionTimeMs: 100,
          retryCount: 0,
          approved: false,
        },
      })

      store.append('prompt-submitted', 'session-2', {
        type: 'prompt',
        content: 'Prompt 2',
        metadata: { characterCount: 8, wordCount: 2 },
      })
    })

    it('should query events by session', () => {
      const events = store.query({ sessionId: 'session-1' })
      expect(events).toHaveLength(3)
      expect(events.every(e => e.sessionId === 'session-1')).toBe(true)
    })

    it('should query events by type', () => {
      const events = store.query({ type: 'prompt-submitted' })
      expect(events).toHaveLength(2)
      expect(events.every(e => e.type === 'prompt-submitted')).toBe(true)
    })

    it('should query events by multiple types', () => {
      const events = store.query({ type: ['prompt-submitted', 'response-received'] })
      expect(events).toHaveLength(3)
    })

    it('should query events by time range', () => {
      const now = Date.now()
      const events = store.query({
        startTime: now - 1000,
        endTime: now + 1000,
      })
      expect(events).toHaveLength(4)
    })

    it('should apply pagination', () => {
      const page1 = store.query({ limit: 2, offset: 0 })
      const page2 = store.query({ limit: 2, offset: 2 })

      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(2)
      expect(page1[0].id).not.toBe(page2[0].id)
    })
  })

  describe('Retention Policy (P9-T2.3)', () => {
    it('should apply retention policy', () => {
      // Add old event
      const oldEvent = store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Old prompt',
        metadata: { characterCount: 10, wordCount: 2 },
      })

      // Manually set old timestamp
      // @ts-expect-error Accessing private field for testing
      const event = store.events.get(oldEvent.id)
      if (event) {
        // @ts-expect-error Modifying readonly for testing
        event.timestamp = Date.now() - 100 * 24 * 60 * 60 * 1000 // 100 days ago
      }

      const removed = store.applyRetentionPolicy()
      expect(removed).toBe(1)
      expect(store.count()).toBe(0)
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      store.append('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Test',
        metadata: { characterCount: 4, wordCount: 1 },
      })

      store.append('response-received', 'session-1', {
        type: 'response',
        content: 'Response',
        provider: 'openai',
        model: 'gpt-4',
        metadata: { tokens: 100, latencyMs: 500 },
      })

      store.append('tool-executed', 'session-1', {
        type: 'tool',
        toolName: 'test-tool',
        action: 'executed',
        input: {},
        metadata: {
          riskLevel: 'low',
          executionTimeMs: 100,
          retryCount: 0,
          approved: false,
        },
      })
    })

    it('should calculate statistics', () => {
      const stats = store.getStatistics()

      expect(stats.totalEvents).toBe(3)
      expect(stats.totalSessions).toBe(1)
      expect(stats.totalToolExecutions).toBe(1)
      expect(stats.eventsByType['prompt-submitted']).toBe(1)
      expect(stats.eventsByType['response-received']).toBe(1)
      expect(stats.eventsByType['tool-executed']).toBe(1)
    })
  })
})

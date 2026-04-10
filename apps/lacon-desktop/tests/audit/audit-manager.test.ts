/**
 * Tests for Audit Manager
 * Phase 9: Integration layer tests
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { AuditManager } from '../../src/main/audit/audit-manager'

describe('AuditManager', () => {
  let manager: AuditManager

  beforeEach(() => {
    manager = new AuditManager()
  })

  describe('Event Logging', () => {
    it('logs prompt events', () => {
      const event = manager.logEvent('prompt-submitted', 'session-1', {
        type: 'prompt',
        content: 'Hello world',
        metadata: { characterCount: 11, wordCount: 2 },
      })

      expect(event.type).toBe('prompt-submitted')
      expect(event.sessionId).toBe('session-1')
      expect(event.integrity).toBeDefined()
    })

    it('logs tool events', () => {
      const event = manager.logEvent('tool-executed', 'session-1', {
        type: 'tool',
        toolName: 'rewrite',
        action: 'executed',
        input: { text: 'Hello' },
        output: { text: 'Hi there' },
        metadata: { riskLevel: 'low', executionTimeMs: 100, retryCount: 0, approved: false },
      })

      expect(event.type).toBe('tool-executed')
    })

    it('logs approval events', () => {
      const event = manager.logEvent('approval-requested', 'session-1', {
        type: 'approval',
        action: 'requested',
        approvalId: 'apr-1',
        toolName: 'delete-document',
        input: {},
        riskScore: 0.95,
        reason: 'High-risk operation requires approval',
        metadata: { requestedAt: Date.now() },
      })

      expect(event.type).toBe('approval-requested')
    })

    it('logs document events', () => {
      const event = manager.logEvent('document-updated', 'session-1', {
        type: 'document',
        action: 'updated',
        documentId: 'doc-1',
        documentTitle: 'My Article',
        metadata: { triggeredBy: 'agent', toolName: 'rewrite' },
      })

      expect(event.type).toBe('document-updated')
    })
  })

  describe('Policy Gate (P9-T6.1)', () => {
    it('allows low-risk tool execution', () => {
      const result = manager.checkPolicy({
        type: 'tool',
        tool: { name: 'format-text', riskLevel: 'low', input: {} },
        session: { id: 'session-1', provider: 'openai', model: 'gpt-4' },
      })

      expect(result.allowed).toBe(true)
      expect(result.action).toBe('allow')
    })

    it('requires approval for high-risk tools (P9-T6.2)', () => {
      const result = manager.checkPolicy({
        type: 'tool',
        tool: { name: 'delete-document', riskLevel: 'high', input: {} },
        session: { id: 'session-1', provider: 'openai', model: 'gpt-4' },
      })

      expect(result.requiresApproval).toBe(true)
      expect(result.action).toBe('require-approval')
    })

    it('logs policy check event to audit store', () => {
      manager.checkPolicy({
        type: 'tool',
        tool: { name: 'rewrite', riskLevel: 'low', input: {} },
        session: { id: 'session-policy', provider: 'openai', model: 'gpt-4' },
      })

      const events = manager.getEventStore().query({ sessionId: 'session-policy' })
      const policyEvent = events.find(e => e.type === 'policy-check' || e.type === 'policy-violation')
      expect(policyEvent).toBeDefined()
    })

    it('logs policy-violation event for denied actions', () => {
      // Register a deny rule for testing
      manager.getPolicyEngine().registerRule({
        id: 'test-deny-rule',
        name: 'Test Deny Rule',
        description: 'Deny specific tool in tests',
        type: 'tool-access',
        enabled: true,
        priority: 200,
        conditions: [{ field: 'tool.name', operator: 'equals', value: 'forbidden-tool' }],
        action: 'deny',
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: ['test'] },
      })

      manager.checkPolicy({
        type: 'tool',
        tool: { name: 'forbidden-tool', riskLevel: 'low', input: {} },
        session: { id: 'session-deny', provider: 'openai', model: 'gpt-4' },
      })

      const events = manager.getEventStore().query({ sessionId: 'session-deny' })
      const violationEvent = events.find(e => e.type === 'policy-violation')
      expect(violationEvent).toBeDefined()
    })
  })

  describe('Rejection Fallback Guidance (P9-T6.3)', () => {
    it('provides a reason string when policy denies', () => {
      manager.getPolicyEngine().registerRule({
        id: 'deny-all-rule',
        name: 'Deny All Test',
        description: 'Test rule that denies everything',
        type: 'tool-access',
        enabled: true,
        priority: 999,
        conditions: [],
        action: 'deny',
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: ['test'] },
      })

      const result = manager.checkPolicy({
        type: 'tool',
        tool: { name: 'any-tool', riskLevel: 'low', input: {} },
      })

      expect(result.reason).toBeTruthy()
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
    })
  })

  describe('Audit Statistics', () => {
    it('returns audit statistics', () => {
      manager.logEvent('prompt-submitted', 'session-stats', {
        type: 'prompt',
        content: 'Test',
        metadata: { characterCount: 4, wordCount: 1 },
      })

      const stats = manager.getAuditStatistics()
      expect(stats.totalEvents).toBeGreaterThan(0)
    })

    it('returns policy statistics', () => {
      manager.checkPolicy({
        type: 'tool',
        tool: { name: 'test', riskLevel: 'low', input: {} },
      })

      const stats = manager.getPolicyStatistics()
      expect(stats.totalEvaluations).toBeGreaterThan(0)
    })
  })

  describe('Retention Policy', () => {
    it('removes zero events when all events are recent', () => {
      // All events added above are very recent - retention policy (90 days)
      // should remove nothing.
      manager.logEvent('prompt-submitted', 'session-recent', {
        type: 'prompt',
        content: 'Recent prompt',
        metadata: { characterCount: 13, wordCount: 2 },
      })

      const removed = manager.applyRetentionPolicy()
      expect(removed).toBe(0)
    })

    it('retention policy returns a count', () => {
      // Validate that applyRetentionPolicy() always returns a number.
      const count = manager.applyRetentionPolicy()
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Integrity Verification', () => {
    it('verifies event integrity through audit manager', () => {
      const event = manager.logEvent('response-received', 'session-integrity', {
        type: 'response',
        content: 'Test response',
        provider: 'openai',
        model: 'gpt-4',
        metadata: { tokens: 50, latencyMs: 300 },
      })

      const result = manager.getEventStore().verifyIntegrity(event.id)
      expect(result.valid).toBe(true)
    })
  })
})

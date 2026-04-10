/**
 * Tests for Trace Viewer Service
 * Phase 9: Epic P9-E2 (P9-T3, P9-T4)
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { AuditEventStore } from '../../src/main/audit/event-store'
import { TraceViewer } from '../../src/main/audit/trace-viewer'

function buildStore() {
  const store = new AuditEventStore({
    enabled: true,
    retentionDays: 90,
    archiveEnabled: false,
    autoCleanup: true,
  })
  return store
}

function seedSession(store: AuditEventStore, sessionId: string, provider = 'openai', model = 'gpt-4') {
  // Session started
  store.append('session-started', sessionId, {
    type: 'session',
    action: 'started',
    provider,
    model,
    metadata: { totalEvents: 0, totalTokens: 0, totalCost: 0, durationMs: 0 },
  })

  // Prompt submitted
  store.append('prompt-submitted', sessionId, {
    type: 'prompt',
    content: 'Hello, summarize this document.',
    documentId: 'doc-1',
    metadata: { characterCount: 33, wordCount: 5 },
  })

  // Tool requested
  store.append('tool-requested', sessionId, {
    type: 'tool',
    toolName: 'workspace-qa',
    action: 'requested',
    input: { query: 'summarize' },
    metadata: { riskLevel: 'low', executionTimeMs: 0, retryCount: 0, approved: false },
  })

  // Tool executed
  store.append('tool-executed', sessionId, {
    type: 'tool',
    toolName: 'workspace-qa',
    action: 'executed',
    input: { query: 'summarize' },
    output: { answer: 'Here is a summary...' },
    metadata: { riskLevel: 'low', executionTimeMs: 250, retryCount: 0, approved: false },
  })

  // Response received
  store.append('response-received', sessionId, {
    type: 'response',
    content: 'Here is a summary of the document.',
    provider,
    model,
    metadata: { tokens: 150, latencyMs: 800, cost: 0.003 },
  })

  // Session ended
  store.append('session-ended', sessionId, {
    type: 'session',
    action: 'ended',
    provider,
    model,
    metadata: { totalEvents: 5, totalTokens: 150, totalCost: 0.003, durationMs: 1200 },
  })
}

describe('TraceViewer', () => {
  let store: AuditEventStore
  let viewer: TraceViewer

  beforeEach(() => {
    store = buildStore()
    viewer = new TraceViewer(store)
  })

  // ---------- P9-T3.1: Session list and filters ----------
  describe('listSessions (P9-T3.1)', () => {
    beforeEach(() => {
      seedSession(store, 'session-1', 'openai', 'gpt-4')
      seedSession(store, 'session-2', 'anthropic', 'claude-3')
    })

    it('returns all sessions when no filter provided', () => {
      const sessions = viewer.listSessions({})
      expect(sessions).toHaveLength(2)
    })

    it('filters by sessionId', () => {
      const sessions = viewer.listSessions({ sessionId: 'session-1' })
      expect(sessions).toHaveLength(1)
      expect(sessions[0].sessionId).toBe('session-1')
    })

    it('filters by provider', () => {
      const sessions = viewer.listSessions({ provider: 'anthropic' })
      expect(sessions).toHaveLength(1)
      expect(sessions[0].provider).toBe('anthropic')
    })

    it('filters by model', () => {
      const sessions = viewer.listSessions({ model: 'gpt-4' })
      expect(sessions).toHaveLength(1)
      expect(sessions[0].model).toBe('gpt-4')
    })

    it('returns session statistics', () => {
      const sessions = viewer.listSessions({ sessionId: 'session-1' })
      const session = sessions[0]

      expect(session.statistics.totalEvents).toBeGreaterThan(0)
      expect(session.statistics.promptCount).toBe(1)
      expect(session.statistics.responseCount).toBe(1)
      expect(session.statistics.toolExecutions).toBeGreaterThan(0)
    })

    it('marks completed sessions', () => {
      const sessions = viewer.listSessions({ sessionId: 'session-1' })
      expect(sessions[0].status).toBe('completed')
    })

    it('marks active sessions (no end event)', () => {
      // Add a session without an end event
      store.append('session-started', 'session-active', {
        type: 'session',
        action: 'started',
        provider: 'openai',
        model: 'gpt-4',
        metadata: { totalEvents: 0, totalTokens: 0, totalCost: 0, durationMs: 0 },
      })

      const sessions = viewer.listSessions({ sessionId: 'session-active' })
      expect(sessions[0].status).toBe('active')
    })

    it('applies pagination', () => {
      const all = viewer.listSessions({})
      const page = viewer.listSessions({ limit: 1, offset: 0 })
      expect(page).toHaveLength(1)
      expect(all.length).toBeGreaterThan(page.length)
    })

    it('filters by searchQuery', () => {
      const sessions = viewer.listSessions({ searchQuery: 'anthropic' })
      expect(sessions).toHaveLength(1)
      expect(sessions[0].provider).toBe('anthropic')
    })
  })

  // ---------- P9-T3.2: Step-by-step timeline ----------
  describe('getTimeline (P9-T3.2)', () => {
    beforeEach(() => {
      seedSession(store, 'session-1')
    })

    it('returns timeline entries sorted by timestamp', () => {
      const timeline = viewer.getTimeline('session-1')
      expect(timeline.length).toBeGreaterThan(0)

      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].timestamp).toBeGreaterThanOrEqual(timeline[i - 1].timestamp)
      }
    })

    it('converts prompt events to timeline entries', () => {
      const timeline = viewer.getTimeline('session-1')
      const promptEntry = timeline.find(e => e.type === 'prompt')
      expect(promptEntry).toBeDefined()
      expect(promptEntry?.title).toBe('Prompt Submitted')
      expect(promptEntry?.status).toBe('success')
    })

    it('converts response events to timeline entries', () => {
      const timeline = viewer.getTimeline('session-1')
      const responseEntry = timeline.find(e => e.type === 'response')
      expect(responseEntry).toBeDefined()
      expect(responseEntry?.title).toBe('Response Received')
      expect(responseEntry?.status).toBe('success')
    })

    it('converts tool events to timeline entries', () => {
      const timeline = viewer.getTimeline('session-1')
      const toolEntry = timeline.find(e => e.type === 'tool')
      expect(toolEntry).toBeDefined()
      expect(toolEntry?.title).toContain('workspace-qa')
      expect(toolEntry?.status).toBe('success')
    })

    it('marks failed tools correctly', () => {
      store.append('tool-failed', 'session-fail', {
        type: 'tool',
        toolName: 'web-research',
        action: 'failed',
        input: {},
        error: { code: 'TIMEOUT', message: 'Request timed out' },
        metadata: { riskLevel: 'medium', executionTimeMs: 5000, retryCount: 3, approved: false },
      })

      const timeline = viewer.getTimeline('session-fail')
      const failedEntry = timeline.find(e => e.type === 'tool')
      expect(failedEntry?.status).toBe('failed')
    })

    it('returns empty for unknown session', () => {
      const timeline = viewer.getTimeline('nonexistent-session')
      expect(timeline).toHaveLength(0)
    })
  })

  // ---------- P9-T3.3: Expandable payload and metrics ----------
  describe('getMetrics (P9-T3.3)', () => {
    beforeEach(() => {
      seedSession(store, 'session-1')
    })

    it('returns token metrics', () => {
      const metrics = viewer.getMetrics('session-1')
      expect(metrics.sessionId).toBe('session-1')
      expect(metrics.tokenMetrics.totalTokens).toBe(150)
      expect(metrics.tokenMetrics.averageTokensPerResponse).toBe(150)
    })

    it('returns latency metrics', () => {
      const metrics = viewer.getMetrics('session-1')
      expect(metrics.latencyMetrics.averageLatency).toBe(800)
      expect(metrics.latencyMetrics.minLatency).toBe(800)
      expect(metrics.latencyMetrics.maxLatency).toBe(800)
    })

    it('returns cost metrics', () => {
      const metrics = viewer.getMetrics('session-1')
      expect(metrics.costMetrics.totalCost).toBeCloseTo(0.003)
      expect(metrics.costMetrics.costByProvider.openai).toBeCloseTo(0.003)
      expect(metrics.costMetrics.costByModel['gpt-4']).toBeCloseTo(0.003)
    })

    it('returns tool metrics', () => {
      const metrics = viewer.getMetrics('session-1')
      // Two tool events: requested + executed
      expect(metrics.toolMetrics.totalExecutions).toBeGreaterThan(0)
      expect(metrics.toolMetrics.executionsByTool['workspace-qa']).toBeGreaterThan(0)
    })

    it('returns approval metrics', () => {
      // Add approval events
      store.append('approval-requested', 'session-approval', {
        type: 'approval',
        action: 'requested',
        approvalId: 'apr-1',
        toolName: 'delete-document',
        input: {},
        riskScore: 0.9,
        reason: 'High-risk tool',
        metadata: { requestedAt: Date.now() },
      })
      store.append('approval-granted', 'session-approval', {
        type: 'approval',
        action: 'granted',
        approvalId: 'apr-1',
        toolName: 'delete-document',
        input: {},
        riskScore: 0.9,
        reason: 'User approved',
        metadata: { requestedAt: Date.now() - 5000, respondedAt: Date.now(), responseTimeMs: 5000 },
      })

      const metrics = viewer.getMetrics('session-approval')
      expect(metrics.approvalMetrics.totalRequests).toBe(1)
    })

    it('returns zero metrics for empty session', () => {
      const metrics = viewer.getMetrics('empty-session')
      expect(metrics.tokenMetrics.totalTokens).toBe(0)
      expect(metrics.costMetrics.totalCost).toBe(0)
      expect(metrics.toolMetrics.totalExecutions).toBe(0)
    })
  })

  // ---------- P9-T4: Replay diagnostics ----------
  describe('replaySession (P9-T4)', () => {
    beforeEach(() => {
      seedSession(store, 'session-replay')
    })

    it('returns replay diagnostics with matching status', async () => {
      const diagnostics = await viewer.replaySession({
        sessionId: 'session-replay',
        compareOutputs: true,
        comparePolicies: true,
        compareTools: true,
        stopOnDivergence: false,
      })

      expect(diagnostics.sessionId).toBe('session-replay')
      expect(diagnostics.status).toBe('completed')
      expect(diagnostics.replayRunId).not.toBe('session-replay')
      expect(diagnostics.summary.totalSteps).toBeGreaterThan(0)
    })

    it('returns zero divergences for exact replay', async () => {
      const diagnostics = await viewer.replaySession({
        sessionId: 'session-replay',
        compareOutputs: true,
        comparePolicies: true,
        compareTools: true,
        stopOnDivergence: false,
      })

      expect(diagnostics.summary.divergentSteps).toBe(0)
      expect(diagnostics.summary.matchRate).toBe(1)
    })

    it('respects startFromStep and endAtStep', async () => {
      const diagnostics = await viewer.replaySession({
        sessionId: 'session-replay',
        startFromStep: 0,
        endAtStep: 2,
        compareOutputs: false,
        comparePolicies: false,
        compareTools: false,
        stopOnDivergence: false,
      })

      expect(diagnostics.summary.totalSteps).toBe(2)
    })

    it('returns empty diagnostics for unknown session', async () => {
      const diagnostics = await viewer.replaySession({
        sessionId: 'unknown-session',
        compareOutputs: false,
        comparePolicies: false,
        compareTools: false,
        stopOnDivergence: false,
      })

      expect(diagnostics.summary.totalSteps).toBe(0)
    })
  })

  // ---------- Approval event timeline entries ----------
  describe('approval and policy timeline entries', () => {
    it('converts approval events to timeline entries', () => {
      store.append('approval-requested', 'session-apr', {
        type: 'approval',
        action: 'requested',
        approvalId: 'apr-1',
        toolName: 'delete-doc',
        input: {},
        riskScore: 0.9,
        reason: 'High-risk operation',
        metadata: { requestedAt: Date.now() },
      })

      const timeline = viewer.getTimeline('session-apr')
      const approvalEntry = timeline.find(e => e.type === 'approval')
      expect(approvalEntry).toBeDefined()
      expect(approvalEntry?.title).toContain('requested')
      expect(approvalEntry?.status).toBe('pending')
    })

    it('converts policy events to timeline entries', () => {
      store.append('policy-check', 'session-pol', {
        type: 'policy',
        action: 'check',
        policyId: 'high-risk-tools',
        policyName: 'High Risk Tools',
        target: { type: 'tool', id: 'rewrite' },
        result: 'allowed',
        metadata: { riskScore: 0.2, sensitiveDataDetected: false },
      })

      const timeline = viewer.getTimeline('session-pol')
      const policyEntry = timeline.find(e => e.type === 'policy')
      expect(policyEntry).toBeDefined()
      expect(policyEntry?.status).toBe('success')
    })

    it('converts document events to timeline entries', () => {
      store.append('document-updated', 'session-doc', {
        type: 'document',
        action: 'updated',
        documentId: 'doc-1',
        documentTitle: 'My Document',
        metadata: { triggeredBy: 'agent' },
      })

      const timeline = viewer.getTimeline('session-doc')
      const docEntry = timeline.find(e => e.type === 'document')
      expect(docEntry).toBeDefined()
      expect(docEntry?.description).toBe('My Document')
    })
  })
})

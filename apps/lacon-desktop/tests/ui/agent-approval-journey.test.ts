/**
 * Agent run and approval journey E2E tests (Phase 10 - P10-T3.2)
 * Tests the full agent execution + human approval workflow
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { ApprovalConfig } from '../../src/main/agent/approval-manager'
import { ApprovalManager } from '../../src/main/agent/approval-manager'
import type { ToolContract } from '../../src/shared/agent-types'

const defaultConfig: ApprovalConfig = {
  approvalThreshold: 60,
  autoApproveTools: ['safe-tool'],
}

function makeTool(name: string, riskLevel: 'low' | 'medium' | 'high'): ToolContract {
  return {
    name,
    description: `Test tool: ${name}`,
    riskLevel,
    inputSchema: {},
    outputSchema: {},
    execute: async () => ({ result: 'ok' }),
  } as any
}

describe('Agent Run and Approval Journey (P10-T3.2)', () => {
  let approvalManager: ApprovalManager

  beforeEach(() => {
    approvalManager = new ApprovalManager(defaultConfig)
  })

  describe('Approval request lifecycle', () => {
    it('should create a pending approval request', () => {
      const tool = makeTool('dangerous-tool', 'high')
      const request = approvalManager.createApprovalRequest('run-1', 'task-1', tool, { action: 'delete' })

      expect(request).toBeDefined()
      expect(request.id).toBeDefined()
      expect(request.runId).toBe('run-1')
      expect(request.toolName).toBe('dangerous-tool')
      expect(request.status).toBe('pending')
    })

    it('should list the pending approval', () => {
      const tool = makeTool('risky-tool', 'high')
      approvalManager.createApprovalRequest('run-2', 'task-2', tool, {})

      const pending = approvalManager.getPendingApprovals()
      expect(pending.length).toBeGreaterThanOrEqual(1)
    })

    it('should approve a pending request', () => {
      const tool = makeTool('tool-a', 'high')
      const request = approvalManager.createApprovalRequest('run-3', 'task-3', tool, {})

      approvalManager.approve(request.id)

      // After approval, request is removed from pending (status tracked on original object)
      const pending = approvalManager.getPendingApprovals()
      expect(pending.find(r => r.id === request.id)).toBeUndefined()
      expect(request.status).toBe('approved')
    })

    it('should reject a pending request', () => {
      const tool = makeTool('tool-b', 'high')
      const request = approvalManager.createApprovalRequest('run-4', 'task-4', tool, {})
      approvalManager.reject(request.id, 'User denied')

      expect(request.status).toBe('rejected')
    })

    it('should wait for approval asynchronously', async () => {
      const tool = makeTool('tool-c', 'high')
      const request = approvalManager.createApprovalRequest('run-5', 'task-5', tool, {})

      // Approve after small delay
      setTimeout(() => {
        approvalManager.approve(request.id)
      }, 50)

      const approved = await approvalManager.waitForApproval(request.id, 2000)
      expect(approved).toBe(true)
    })

    it('should time out if approval is not granted', async () => {
      const tool = makeTool('tool-d', 'high')
      const request = approvalManager.createApprovalRequest('run-6', 'task-6', tool, {})

      await expect(approvalManager.waitForApproval(request.id, 100)).rejects.toThrow('timeout')
    })

    it('should resolve waitForApproval to false when rejected', async () => {
      const tool = makeTool('tool-e', 'high')
      const request = approvalManager.createApprovalRequest('run-7', 'task-7', tool, {})

      setTimeout(() => {
        approvalManager.reject(request.id, 'too risky')
      }, 30)

      const approved = await approvalManager.waitForApproval(request.id, 1000)
      expect(approved).toBe(false)
    })
  })

  describe('Approval queue management', () => {
    it('approved requests should not appear in pending list', () => {
      const tool1 = makeTool('tool-3', 'high')
      const tool2 = makeTool('tool-4', 'high')
      const req1 = approvalManager.createApprovalRequest('run-C', 'task-c1', tool1, {})
      const req2 = approvalManager.createApprovalRequest('run-C', 'task-c2', tool2, {})

      approvalManager.approve(req1.id)

      const pending = approvalManager.getPendingApprovals()
      const pendingIds = pending.map(r => r.id)
      expect(pendingIds).not.toContain(req1.id)
      expect(pendingIds).toContain(req2.id)
    })
  })

  describe('Risk scoring', () => {
    it('low risk tools should not require approval', () => {
      const tool = makeTool('safe-op', 'low')
      const needsApproval = approvalManager.requiresApproval(tool, {})
      expect(needsApproval).toBe(false)
    })

    it('high risk tools should require approval', () => {
      const tool = makeTool('high-risk-op', 'high')
      const needsApproval = approvalManager.requiresApproval(tool, {})
      expect(needsApproval).toBe(true)
    })

    it('auto-approved tools should bypass approval', () => {
      const tool = makeTool('safe-tool', 'high') // even high-risk if auto-approved
      const needsApproval = approvalManager.requiresApproval(tool, {})
      expect(needsApproval).toBe(false)
    })

    it('risk score should be between 0 and 100', () => {
      const tool = makeTool('test', 'high')
      const score = approvalManager.calculateRiskScore(tool, { delete: true, file: '/path' })
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('high risk tool with destructive action should have elevated score', () => {
      const tool = makeTool('del-tool', 'high')
      const score = approvalManager.calculateRiskScore(tool, { action: 'delete files' })
      expect(score).toBeGreaterThan(50)
    })
  })

  describe('Approval subscriptions', () => {
    it('should notify subscriber when new request is created', () => {
      const received: string[] = []
      const unsubscribe = approvalManager.subscribe(req => received.push(req.toolName))

      const tool = makeTool('notify-tool', 'high')
      approvalManager.createApprovalRequest('run-X', 'task-x', tool, {})

      expect(received).toContain('notify-tool')
      unsubscribe()
    })

    it('should stop notifying after unsubscribe', () => {
      const received: string[] = []
      const unsubscribe = approvalManager.subscribe(req => received.push(req.toolName))

      unsubscribe()

      const tool = makeTool('ghost-tool', 'high')
      approvalManager.createApprovalRequest('run-Y', 'task-y', tool, {})

      expect(received).not.toContain('ghost-tool')
    })
  })
})

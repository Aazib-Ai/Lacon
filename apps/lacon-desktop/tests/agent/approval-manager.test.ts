/**
 * Tests for Approval Manager
 * Phase 6: Epic P6-E2, Task P6-T6
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { ApprovalManager } from '../../src/main/agent/approval-manager'
import type { ToolContract } from '../../src/shared/agent-types'

describe('ApprovalManager', () => {
  let manager: ApprovalManager

  beforeEach(() => {
    manager = new ApprovalManager({
      approvalThreshold: 60,
      autoApproveTools: ['safe-tool'],
    })
  })

  describe('P6-T6.1: Risk scoring', () => {
    it('should score low-risk tools below threshold', () => {
      const tool: ToolContract = {
        name: 'low-risk-tool',
        description: 'Low risk',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const score = manager.calculateRiskScore(tool, { action: 'read' })
      expect(score).toBeLessThan(60)
    })

    it('should score high-risk tools above threshold', () => {
      const tool: ToolContract = {
        name: 'high-risk-tool',
        description: 'High risk',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const score = manager.calculateRiskScore(tool, { action: 'delete' })
      expect(score).toBeGreaterThanOrEqual(60)
    })

    it('should increase score for destructive operations', () => {
      const tool: ToolContract = {
        name: 'tool',
        description: 'Tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const readScore = manager.calculateRiskScore(tool, { action: 'read' })
      const deleteScore = manager.calculateRiskScore(tool, { action: 'delete' })
      expect(deleteScore).toBeGreaterThan(readScore)
    })

    it('should increase score for file operations', () => {
      const tool: ToolContract = {
        name: 'tool',
        description: 'Tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const normalScore = manager.calculateRiskScore(tool, { action: 'process' })
      const fileScore = manager.calculateRiskScore(tool, { action: 'process', file: '/path/to/file' })
      expect(fileScore).toBeGreaterThan(normalScore)
    })
  })

  describe('P6-T6.1: Approval requirements', () => {
    it('should not require approval for auto-approved tools', () => {
      const tool: ToolContract = {
        name: 'safe-tool',
        description: 'Safe',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const required = manager.requiresApproval(tool, {})
      expect(required).toBe(false)
    })

    it('should require approval for high-risk operations', () => {
      const tool: ToolContract = {
        name: 'risky-tool',
        description: 'Risky',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const required = manager.requiresApproval(tool, { action: 'delete' })
      expect(required).toBe(true)
    })

    it('should not require approval for low-risk operations', () => {
      const tool: ToolContract = {
        name: 'safe-operation',
        description: 'Safe',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const required = manager.requiresApproval(tool, { action: 'read' })
      expect(required).toBe(false)
    })
  })

  describe('P6-T6.2: Approval workflow', () => {
    it('should create approval request', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const request = manager.createApprovalRequest('run-1', 'task-1', tool, { action: 'delete' })
      expect(request.runId).toBe('run-1')
      expect(request.taskId).toBe('task-1')
      expect(request.toolName).toBe('test-tool')
      expect(request.status).toBe('pending')
      expect(request.riskLevel).toBe('high')
    })

    it('should approve request', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const request = manager.createApprovalRequest('run-1', 'task-1', tool, {})
      manager.approve(request.id)

      const retrieved = manager.getRequest(request.id)
      expect(retrieved).toBeUndefined() // Removed after approval
    })

    it('should reject request', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const request = manager.createApprovalRequest('run-1', 'task-1', tool, {})
      manager.reject(request.id, 'User rejected')

      const retrieved = manager.getRequest(request.id)
      expect(retrieved).toBeUndefined() // Removed after rejection
    })
  })

  describe('P6-T6.3: Pending approvals', () => {
    it('should list pending approvals', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      manager.createApprovalRequest('run-1', 'task-1', tool, {})
      manager.createApprovalRequest('run-2', 'task-2', tool, {})

      const pending = manager.getPendingApprovals()
      expect(pending).toHaveLength(2)
    })

    it('should remove approved requests from pending', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const request = manager.createApprovalRequest('run-1', 'task-1', tool, {})
      expect(manager.getPendingApprovals()).toHaveLength(1)

      manager.approve(request.id)
      expect(manager.getPendingApprovals()).toHaveLength(0)
    })
  })

  describe('Approval listeners', () => {
    it('should notify listeners of new requests', () => {
      let notified = false
      let lastRequest: any = null

      manager.subscribe(request => {
        notified = true
        lastRequest = request
      })

      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test',
        riskLevel: 'high',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const request = manager.createApprovalRequest('run-1', 'task-1', tool, {})
      expect(notified).toBe(true)
      expect(lastRequest.id).toBe(request.id)
    })
  })
})

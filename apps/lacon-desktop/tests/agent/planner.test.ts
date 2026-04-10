/**
 * Tests for Agent Planner
 * Phase 6: Epic P6-E1, Task P6-T2
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { AgentPlanner } from '../../src/main/agent/planner'
import type { ToolContract } from '../../src/shared/agent-types'

describe('AgentPlanner', () => {
  let planner: AgentPlanner

  beforeEach(() => {
    planner = new AgentPlanner({
      maxRetries: 3,
      retryBackoffMs: 1000,
      retryMultiplier: 2,
    })
  })

  describe('P6-T2.1: Task decomposition', () => {
    it('should decompose instruction into tasks', () => {
      const tasks = planner.decompose('Test instruction', {})
      expect(tasks).toHaveLength(1)
      expect(tasks[0].type).toBe('tool-execution')
      expect(tasks[0].status).toBe('pending')
    })

    it('should include instruction in task input', () => {
      const instruction = 'Test instruction'
      const tasks = planner.decompose(instruction, {})
      expect((tasks[0].input as any).instruction).toBe(instruction)
    })

    it('should include context in task input', () => {
      const context = { key: 'value' }
      const tasks = planner.decompose('Test', context)
      expect((tasks[0].input as any).context).toEqual(context)
    })
  })

  describe('P6-T2.2: Tool routing', () => {
    it('should route task to specified tool', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      planner.registerTool(tool)

      const task = {
        id: 'task-1',
        type: 'tool-execution' as const,
        status: 'pending' as const,
        input: { toolName: 'test-tool' },
        createdAt: Date.now(),
      }

      const toolName = planner.route(task)
      expect(toolName).toBe('test-tool')
    })

    it('should return null for unknown tool', () => {
      const task = {
        id: 'task-1',
        type: 'tool-execution' as const,
        status: 'pending' as const,
        input: { toolName: 'unknown-tool' },
        createdAt: Date.now(),
      }

      const toolName = planner.route(task)
      expect(toolName).toBeNull()
    })
  })

  describe('P6-T2.3: Retry policy', () => {
    it('should calculate retry delay with exponential backoff', () => {
      const delay0 = planner.calculateRetryDelay(0)
      const delay1 = planner.calculateRetryDelay(1)
      const delay2 = planner.calculateRetryDelay(2)

      expect(delay1).toBeGreaterThan(delay0)
      expect(delay2).toBeGreaterThan(delay1)
      expect(delay1).toBeGreaterThanOrEqual(1000) // Base delay
      expect(delay2).toBeGreaterThanOrEqual(2000) // 2x base delay
    })

    it('should add jitter to retry delay', () => {
      const delays = Array.from({ length: 10 }, () => planner.calculateRetryDelay(1))
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).toBeGreaterThan(1) // Should have variation
    })

    it('should not retry after max retries', () => {
      const task = {
        id: 'task-1',
        type: 'tool-execution' as const,
        status: 'failed' as const,
        input: {},
        error: {
          code: 'ERROR',
          message: 'Test error',
          retryCount: 3,
        },
        createdAt: Date.now(),
      }

      const shouldRetry = planner.shouldRetry(task, new Error('Test error'))
      expect(shouldRetry).toBe(false)
    })

    it('should not retry validation errors', () => {
      const task = {
        id: 'task-1',
        type: 'tool-execution' as const,
        status: 'failed' as const,
        input: {},
        createdAt: Date.now(),
      }

      const shouldRetry = planner.shouldRetry(task, new Error('Validation failed'))
      expect(shouldRetry).toBe(false)
    })

    it('should retry timeout errors', () => {
      const task = {
        id: 'task-1',
        type: 'tool-execution' as const,
        status: 'failed' as const,
        input: {},
        createdAt: Date.now(),
      }

      const shouldRetry = planner.shouldRetry(task, new Error('Request timeout'))
      expect(shouldRetry).toBe(true)
    })
  })

  describe('Tool registry', () => {
    it('should register and retrieve tools', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      planner.registerTool(tool)
      const retrieved = planner.getTool('test-tool')
      expect(retrieved).toEqual(tool)
    })

    it('should return undefined for unregistered tool', () => {
      const retrieved = planner.getTool('unknown-tool')
      expect(retrieved).toBeUndefined()
    })

    it('should list all registered tools', () => {
      const tool1: ToolContract = {
        name: 'tool-1',
        description: 'Tool 1',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const tool2: ToolContract = {
        name: 'tool-2',
        description: 'Tool 2',
        riskLevel: 'medium',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      planner.registerTool(tool1)
      planner.registerTool(tool2)

      const tools = planner.getAllTools()
      expect(tools).toHaveLength(2)
      expect(tools.map(t => t.name)).toContain('tool-1')
      expect(tools.map(t => t.name)).toContain('tool-2')
    })
  })
})

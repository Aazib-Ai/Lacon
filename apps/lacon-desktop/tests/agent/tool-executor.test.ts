/**
 * Tests for Tool Executor
 * Phase 6: Epic P6-E2, Tasks P6-T4, P6-T5
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { ToolExecutor } from '../../src/main/agent/tool-executor'
import type { ToolContract, ToolExecutionContext } from '../../src/shared/agent-types'

describe('ToolExecutor', () => {
  let executor: ToolExecutor

  beforeEach(() => {
    executor = new ToolExecutor({
      defaultTimeout: 5000,
      maxConcurrentTools: 3,
    })
  })

  describe('P6-T4.1: Input validation', () => {
    it('should validate required fields', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test',
        riskLevel: 'low',
        inputSchema: {
          type: 'object',
          properties: { name: {} },
          required: ['name'],
        },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const result1 = executor.validateInput(tool, { name: 'test' })
      expect(result1.valid).toBe(true)

      const result2 = executor.validateInput(tool, {})
      expect(result2.valid).toBe(false)
      expect(result2.errors).toContain('Missing required field: name')
    })

    it('should reject non-object input', () => {
      const tool: ToolContract = {
        name: 'test-tool',
        description: 'Test',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      }

      const result = executor.validateInput(tool, 'not an object')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Input must be an object')
    })
  })

  describe('P6-T5.1: Timeout control', () => {
    it('should timeout long-running tools', async () => {
      const tool: ToolContract = {
        name: 'slow-tool',
        description: 'Slow tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => {
            setTimeout(resolve, 10000)
          })
          return {}
        },
        timeout: 100,
      }

      const context: ToolExecutionContext = {
        toolName: 'slow-tool',
        input: {},
        riskLevel: 'low',
        timeout: 100,
        startTime: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      }

      const result = await executor.execute(tool, {}, context)
      expect(result.status).toBe('failed')
      expect(result.error?.message).toContain('timeout')
    }, 10000)

    it('should complete fast tools within timeout', async () => {
      const tool: ToolContract = {
        name: 'fast-tool',
        description: 'Fast tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => ({ result: 'success' }),
      }

      const context: ToolExecutionContext = {
        toolName: 'fast-tool',
        input: {},
        riskLevel: 'low',
        timeout: 5000,
        startTime: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      }

      const result = await executor.execute(tool, {}, context)
      expect(result.status).toBe('success')
      expect(result.output).toEqual({ result: 'success' })
    })
  })

  describe('P6-T5.2: Idempotency', () => {
    it('should cache idempotent results', async () => {
      let callCount = 0

      const tool: ToolContract = {
        name: 'idempotent-tool',
        description: 'Idempotent tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => {
          callCount += 1
          return { count: callCount }
        },
      }

      const context1: ToolExecutionContext = {
        toolName: 'idempotent-tool',
        input: {},
        riskLevel: 'low',
        timeout: 5000,
        startTime: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: 'test-key',
      }

      const result1 = await executor.execute(tool, {}, context1)
      expect(result1.status).toBe('success')
      expect(callCount).toBe(1)

      const context2: ToolExecutionContext = {
        ...context1,
        startTime: Date.now(),
      }

      const result2 = await executor.execute(tool, {}, context2)
      expect(result2.status).toBe('success')
      expect(callCount).toBe(1) // Should not increment
      expect(result2.output).toEqual(result1.output)
    })
  })

  describe('P6-T5.3: Concurrency limits', () => {
    it('should enforce concurrency limits', async () => {
      const tool: ToolContract = {
        name: 'concurrent-tool',
        description: 'Concurrent tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => {
            setTimeout(resolve, 100)
          })
          return {}
        },
      }

      const context: ToolExecutionContext = {
        toolName: 'concurrent-tool',
        input: {},
        riskLevel: 'low',
        timeout: 5000,
        startTime: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      }

      // Start 3 concurrent executions (at limit)
      const promises = [
        executor.execute(tool, {}, context),
        executor.execute(tool, {}, context),
        executor.execute(tool, {}, context),
      ]

      // Try to start a 4th (should fail)
      const result4 = await executor.execute(tool, {}, context)
      expect(result4.status).toBe('failed')
      expect(result4.error?.code).toBe('CONCURRENCY_LIMIT_EXCEEDED')

      // Wait for others to complete
      await Promise.all(promises)
    })
  })

  describe('Error handling', () => {
    it('should handle tool execution errors', async () => {
      const tool: ToolContract = {
        name: 'error-tool',
        description: 'Error tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('Tool error')
        },
      }

      const context: ToolExecutionContext = {
        toolName: 'error-tool',
        input: {},
        riskLevel: 'low',
        timeout: 5000,
        startTime: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      }

      const result = await executor.execute(tool, {}, context)
      expect(result.status).toBe('failed')
      expect(result.error?.message).toBe('Tool error')
    })
  })

  describe('Cancellation', () => {
    it('should cancel all running tools', async () => {
      const tool: ToolContract = {
        name: 'long-tool',
        description: 'Long tool',
        riskLevel: 'low',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        errorSchema: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => {
            setTimeout(resolve, 5000)
          })
          return {}
        },
      }

      const context: ToolExecutionContext = {
        toolName: 'long-tool',
        input: {},
        riskLevel: 'low',
        timeout: 10000,
        startTime: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      }

      // Start execution
      const promise = executor.execute(tool, {}, context)

      // Cancel all
      executor.cancelAll()

      // Should complete with error
      const result = await promise
      expect(result.status).toBe('failed')
    })
  })
})

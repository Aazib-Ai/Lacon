/**
 * Performance benchmark suite (Phase 10 - P10-T5)
 * Benchmarks large documents, long sessions, and multi-tool runs
 * against defined performance budgets.
 */

import { describe, expect, it } from 'vitest'

import { assertWithinBudget, measureDurationMs, PERFORMANCE_BUDGETS } from '../../src/main/perf/performance-budgets'

// --- Helpers ---

function generateLargeDocument(wordCount: number) {
  const content = Array.from({ length: wordCount }, (_, i) => ({
    type: 'paragraph' as const,
    content: [
      {
        type: 'text',
        text: `Word${i + 1} `,
      },
    ],
  }))
  return { type: 'doc', content }
}

// --- Benchmark tests ---

describe('Performance Benchmarks (P10-T5)', () => {
  describe('P10-T5.1: Large document benchmark', () => {
    it('should serialize a 10,000-word document within budget', async () => {
      const doc = generateLargeDocument(10000)

      const durationMs = await measureDurationMs(async () => {
        JSON.stringify(doc)
      })

      console.log(
        `[P10-T5.1] 10k-word serialize: ${durationMs.toFixed(2)}ms (budget: ${PERFORMANCE_BUDGETS.LARGE_DOC_SERIALIZE_MS}ms)`,
      )
      assertWithinBudget('LARGE_DOC_SERIALIZE_MS', durationMs, '10k-word document')
    })

    it('should deserialize a 10,000-word document within budget', async () => {
      const doc = generateLargeDocument(10000)
      const serialized = JSON.stringify(doc)

      const durationMs = await measureDurationMs(async () => {
        JSON.parse(serialized)
      })

      console.log(`[P10-T5.1] 10k-word deserialize: ${durationMs.toFixed(2)}ms`)
      // Deserialization should be at least as fast as serialization
      expect(durationMs).toBeLessThan(PERFORMANCE_BUDGETS.LARGE_DOC_SERIALIZE_MS * 2)
    })

    it('should generate word count for a 10,000-word document within budget', async () => {
      const doc = generateLargeDocument(10000)

      const durationMs = await measureDurationMs(async () => {
        // Simulate the ContentAnalytics.analyze word counting logic
        let count = 0
        function walk(node: any) {
          if (node.type === 'text' && node.text) {
            count += node.text.trim().split(/\s+/).filter(Boolean).length
          }
          if (node.content) {node.content.forEach(walk)}
        }
        walk(doc)
        expect(count).toBeGreaterThan(5000) // rough check
      })

      console.log(`[P10-T5.1] 10k-word count: ${durationMs.toFixed(2)}ms`)
      expect(durationMs).toBeLessThan(500) // Should be fast (text processing)
    })
  })

  describe('P10-T5.2: Long session benchmark', () => {
    it('should not exceed memory growth expectations over 1000 doc saves', async () => {
      const initialMemoryMB = process.memoryUsage().heapUsed / (1024 * 1024)
      const savedDocs: any[] = []

      for (let i = 0; i < 1000; i += 1) {
        savedDocs.push(generateLargeDocument(100))
      }

      const afterMemoryMB = process.memoryUsage().heapUsed / (1024 * 1024)
      const growthMB = afterMemoryMB - initialMemoryMB

      console.log(`[P10-T5.2] Memory growth after 1000 docs: ${growthMB.toFixed(1)}MB`)
      // 1000 small docs should not leak more than 50MB
      expect(growthMB).toBeLessThan(50)

      // Clean up
      savedDocs.length = 0
    })

    it('should process repeated serializations without performance degradation', async () => {
      const doc = generateLargeDocument(500)
      const durations: number[] = []

      // Warm-up run (ignore first 5 to allow JIT compilation)
      for (let i = 0; i < 5; i += 1) {JSON.stringify(doc)}

      for (let i = 0; i < 100; i += 1) {
        const start = performance.now()
        JSON.stringify(doc)
        durations.push(performance.now() - start)
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      const max = Math.max(...durations)

      console.log(`[P10-T5.2] 100 serializations: avg=${avg.toFixed(2)}ms max=${max.toFixed(2)}ms`)

      // After warmup, max should not be more than 50ms (absolute cap for serializing 500 nodes)
      expect(max).toBeLessThan(50)
      expect(avg).toBeLessThan(20)
    })
  })

  describe('P10-T5.3: Multi-tool run benchmark', () => {
    it('should execute tool dispatch overhead within budget', async () => {
      // Simulate the overhead of tool lookup + input validation (not actual tool execution)
      const tools = new Map<string, { name: string; execute: (input: any) => Promise<any> }>()

      // Register 10 mock tools
      for (let i = 0; i < 10; i += 1) {
        tools.set(`tool-${i}`, {
          name: `tool-${i}`,
          execute: async input => ({ result: input }),
        })
      }

      const durationMs = await measureDurationMs(async () => {
        // Simulate running 5 tools sequentially (dispatch only)
        for (let i = 0; i < 5; i += 1) {
          const tool = tools.get(`tool-${i}`)
          expect(tool).toBeDefined()
          await tool!.execute({ query: `test query ${i}` })
        }
      })

      console.log(
        `[P10-T5.3] 5-tool dispatch overhead: ${durationMs.toFixed(2)}ms (budget: ${PERFORMANCE_BUDGETS.TOOL_EXECUTION_OVERHEAD_MS}ms)`,
      )
      assertWithinBudget('TOOL_EXECUTION_OVERHEAD_MS', durationMs, '5 sequential tools')
    })

    it('should measure IPC overhead for a simulated round-trip', async () => {
      // Simulate an IPC round-trip without actual Electron (validation only)
      const durationMs = await measureDurationMs(async () => {
        const payload = { id: 'key-1', provider: 'openai', label: 'Test', value: 'sk-test' }
        // Simulate validation overhead
        const isValid =
          typeof payload.id === 'string' &&
          typeof payload.provider === 'string' &&
          typeof payload.label === 'string' &&
          typeof payload.value === 'string'
        expect(isValid).toBe(true)
      })

      console.log(`[P10-T5.3] IPC validation overhead: ${durationMs.toFixed(2)}ms`)
      // Validation should be nearly instant
      expect(durationMs).toBeLessThan(10)
    })
  })

  describe('Performance budget definitions', () => {
    it('all budget values should be positive numbers', () => {
      for (const [_key, value] of Object.entries(PERFORMANCE_BUDGETS)) {
        expect(value).toBeGreaterThan(0)
        expect(typeof value).toBe('number')
      }
    })

    it('assertWithinBudget should pass when under budget', () => {
      expect(() => assertWithinBudget('TYPING_LATENCY_MAX_MS', 10)).not.toThrow()
    })

    it('assertWithinBudget should throw when over budget', () => {
      expect(() => assertWithinBudget('TYPING_LATENCY_MAX_MS', 999999)).toThrow('Performance budget exceeded')
    })
  })
})

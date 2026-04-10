/**
 * Performance Budgets Definition (Phase 10 - P10-T4)
 * Defines all performance budgets: startup, typing latency, stream responsiveness, memory
 */

/**
 * LACON Performance Budgets
 * These constants define the maximum acceptable durations and memory limits.
 * Any benchmark exceeding these values is a regression and must block release.
 */
export const PERFORMANCE_BUDGETS = {
  /** Time from app launch to interactive editor (ms) - P10-T4.1 */
  STARTUP_TO_INTERACTIVE_MS: 3000,

  /** Maximum additional delay caused by key-press handling in editor (ms) - P10-T4.2 */
  TYPING_LATENCY_MAX_MS: 50,

  /** Maximum time from stream start to first token displayed (ms) - P10-T4.3 */
  STREAM_FIRST_TOKEN_MS: 300,

  /** Maximum delay between consecutive stream token renders (ms) - P10-T4.3 */
  STREAM_TOKEN_INTERVAL_MAX_MS: 100,

  /** Maximum main process heap memory for a long editing session (MB) - P10-T4.4 */
  LONG_SESSION_MEMORY_MAIN_MB: 200,

  /** Maximum renderer process heap memory for a long editing session (MB) - P10-T4.4 */
  LONG_SESSION_MEMORY_RENDERER_MB: 300,

  /** Maximum time to open a 10,000-word document (ms) */
  LARGE_DOC_OPEN_MS: 1000,

  /** Maximum time to serialize a 10,000-word document to JSON (ms) */
  LARGE_DOC_SERIALIZE_MS: 100,

  /** Maximum time for IPC round-trip latency (ms) */
  IPC_ROUNDTRIP_MS: 50,

  /** Maximum time to run a single tool call end-to-end (excluding LLM time, ms) */
  TOOL_EXECUTION_OVERHEAD_MS: 200,
} as const

export type PerformanceBudgetKey = keyof typeof PERFORMANCE_BUDGETS

/**
 * Validates that a measured value is within the defined budget.
 * @throws Error if the budget is exceeded.
 */
export function assertWithinBudget(key: PerformanceBudgetKey, measuredMs: number, context?: string): void {
  const budget = PERFORMANCE_BUDGETS[key]
  if (measuredMs > budget) {
    throw new Error(
      `Performance budget exceeded: ${key} = ${measuredMs}ms (budget: ${budget}ms)${ 
        context ? ` [context: ${context}]` : ''}`,
    )
  }
}

/**
 * Measures the execution time of an async function.
 */
export async function measureDurationMs(fn: () => Promise<void>): Promise<number> {
  const start = performance.now()
  await fn()
  return performance.now() - start
}

/**
 * Simple memory usage tracker (Node.js/Electron main process).
 */
export function getHeapUsageMB(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / (1024 * 1024)
  }
  return 0
}

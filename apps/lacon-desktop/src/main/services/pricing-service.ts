/**
 * Pricing Service — Phase 7
 *
 * Calculates real cost from tokens + model pricing.
 * Provides per-action cost, session totals, and per-project cost isolation.
 *
 * The pricing table is versioned and can be updated per release cycle.
 */

// ─────────────────────────── Types ───────────────────────────

export interface ModelPricing {
  /** Model ID (e.g., 'gpt-4o', 'claude-sonnet-4-20250514') */
  modelId: string
  /** Human-readable name */
  displayName: string
  /** Provider type */
  provider: string
  /** Cost per 1K input tokens in USD */
  inputCostPer1k: number
  /** Cost per 1K output tokens in USD */
  outputCostPer1k: number
  /** Context window size */
  contextWindow: number
}

export interface CostBreakdown {
  /** Input token count */
  inputTokens: number
  /** Output token count */
  outputTokens: number
  /** Cost for input tokens (USD) */
  inputCost: number
  /** Cost for output tokens (USD) */
  outputCost: number
  /** Total cost (USD) */
  totalCost: number
  /** Model used */
  model: string
  /** Provider used */
  provider: string
}

export interface SessionCost {
  /** Document/project ID */
  documentId: string
  /** All cost entries for this session */
  entries: CostEntry[]
  /** Running total cost (USD) */
  totalCost: number
  /** Total input tokens */
  totalInputTokens: number
  /** Total output tokens */
  totalOutputTokens: number
  /** When the session started */
  startedAt: string
  /** Last entry timestamp */
  lastUpdatedAt: string
}

export interface CostEntry {
  /** Unique entry ID */
  id: string
  /** Action label (e.g., 'generateSection', 'runReview', 'surgicalEdit') */
  action: string
  /** Cost breakdown */
  cost: CostBreakdown
  /** When the action occurred */
  timestamp: string
}

// ─────────────────────────── Pricing Table ───────────────────────────

/** Versioned pricing table — update per release cycle */
const PRICING_TABLE_VERSION = '2026-04-28'

const PRICING_TABLE: ModelPricing[] = [
  // ── OpenAI ──
  {
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    inputCostPer1k: 0.0025,
    outputCostPer1k: 0.01,
    contextWindow: 128000,
  },
  {
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    contextWindow: 128000,
  },
  {
    modelId: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    provider: 'openai',
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    contextWindow: 128000,
  },
  {
    modelId: 'gpt-4-turbo-preview',
    displayName: 'GPT-4 Turbo Preview',
    provider: 'openai',
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    contextWindow: 128000,
  },
  {
    modelId: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    provider: 'openai',
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015,
    contextWindow: 16385,
  },
  {
    modelId: 'o1',
    displayName: 'o1',
    provider: 'openai',
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.06,
    contextWindow: 200000,
  },
  {
    modelId: 'o1-mini',
    displayName: 'o1 Mini',
    provider: 'openai',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.012,
    contextWindow: 128000,
  },
  {
    modelId: 'o3-mini',
    displayName: 'o3 Mini',
    provider: 'openai',
    inputCostPer1k: 0.0011,
    outputCostPer1k: 0.0044,
    contextWindow: 200000,
  },

  // ── Anthropic ──
  {
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    provider: 'anthropic',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    contextWindow: 200000,
  },
  {
    modelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    contextWindow: 200000,
  },
  {
    modelId: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.004,
    contextWindow: 200000,
  },
  {
    modelId: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    provider: 'anthropic',
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    contextWindow: 200000,
  },
  {
    modelId: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    provider: 'anthropic',
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    contextWindow: 200000,
  },

  // ── Google Gemini ──
  {
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'gemini',
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0.0004,
    contextWindow: 1000000,
  },
  {
    modelId: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
    contextWindow: 1000000,
  },
  {
    modelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'gemini',
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    contextWindow: 2000000,
  },
  {
    modelId: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'gemini',
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
    contextWindow: 1000000,
  },
]

// ─────────────────────────── Service ───────────────────────────

export class PricingService {
  /** Per-project session cost tracking */
  private sessionCosts = new Map<string, SessionCost>()

  /**
   * Get the pricing table version string.
   */
  getPricingTableVersion(): string {
    return PRICING_TABLE_VERSION
  }

  /**
   * Look up pricing for a model.
   * Falls back to a best-effort match (prefix) if no exact match.
   */
  getModelPricing(modelId: string): ModelPricing | null {
    // Exact match
    const exact = PRICING_TABLE.find(m => m.modelId === modelId)
    if (exact) {return exact}

    // Prefix match (e.g., 'gpt-4o-2024-...' → 'gpt-4o')
    const prefix = PRICING_TABLE.find(m => modelId.startsWith(m.modelId))
    if (prefix) {return prefix}

    // Reverse prefix (e.g., pricing entry 'claude-sonnet-4-20250514' startsWith check)
    const reverse = PRICING_TABLE.find(m => m.modelId.startsWith(modelId))
    if (reverse) {return reverse}

    return null
  }

  /**
   * Get all known model pricings.
   */
  getAllPricings(): ModelPricing[] {
    return [...PRICING_TABLE]
  }

  /**
   * Calculate the cost for a single action given token counts and model.
   */
  calculateCost(inputTokens: number, outputTokens: number, modelId: string, provider: string): CostBreakdown {
    const pricing = this.getModelPricing(modelId)

    let inputCostPer1k = 0
    let outputCostPer1k = 0

    if (pricing) {
      inputCostPer1k = pricing.inputCostPer1k
      outputCostPer1k = pricing.outputCostPer1k
    }

    const inputCost = (inputTokens / 1000) * inputCostPer1k
    const outputCost = (outputTokens / 1000) * outputCostPer1k

    return {
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      model: modelId,
      provider,
    }
  }

  /**
   * Record a cost entry for a project session.
   * Returns the updated session cost.
   */
  recordAction(
    documentId: string,
    action: string,
    inputTokens: number,
    outputTokens: number,
    modelId: string,
    provider: string,
  ): SessionCost {
    const cost = this.calculateCost(inputTokens, outputTokens, modelId, provider)
    const now = new Date().toISOString()

    let session = this.sessionCosts.get(documentId)
    if (!session) {
      session = {
        documentId,
        entries: [],
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        startedAt: now,
        lastUpdatedAt: now,
      }
      this.sessionCosts.set(documentId, session)
    }

    const entry: CostEntry = {
      id: crypto.randomUUID(),
      action,
      cost,
      timestamp: now,
    }

    session.entries.push(entry)
    session.totalCost += cost.totalCost
    session.totalInputTokens += inputTokens
    session.totalOutputTokens += outputTokens
    session.lastUpdatedAt = now

    return session
  }

  /**
   * Get the session cost for a project.
   */
  getSessionCost(documentId: string): SessionCost | null {
    return this.sessionCosts.get(documentId) || null
  }

  /**
   * Reset the session cost for a project.
   */
  resetSessionCost(documentId: string): void {
    this.sessionCosts.delete(documentId)
  }

  /**
   * Get an aggregate cost summary across all projects.
   */
  getGlobalCostSummary(): {
    totalCost: number
    totalInputTokens: number
    totalOutputTokens: number
    projectCount: number
  } {
    let totalCost = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const session of this.sessionCosts.values()) {
      totalCost += session.totalCost
      totalInputTokens += session.totalInputTokens
      totalOutputTokens += session.totalOutputTokens
    }

    return {
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      projectCount: this.sessionCosts.size,
    }
  }

  /**
   * Format a cost value as a human-readable string.
   */
  formatCost(costUsd: number): string {
    if (costUsd === 0) {return '$0.00'}
    if (costUsd < 0.001) {return `$${costUsd.toFixed(6)}`}
    if (costUsd < 0.01) {return `$${costUsd.toFixed(4)}`}
    return `$${costUsd.toFixed(4)}`
  }
}

// ── Singleton ──
let pricingServiceInstance: PricingService | null = null

export function getPricingService(): PricingService {
  if (!pricingServiceInstance) {
    pricingServiceInstance = new PricingService()
  }
  return pricingServiceInstance
}

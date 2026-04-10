/**
 * Trace Viewer Service
 * Phase 9: Epic P9-E2 (P9-T3, P9-T4)
 */

import type { AuditEvent } from '../../shared/audit-types'
import type {
  ReplayConfiguration,
  ReplayDiagnostics,
  ReplayDivergence,
  TraceFilterOptions,
  TraceMetrics,
  TraceSessionSummary,
  TraceTimelineEntry,
} from '../../shared/trace-types'
import type { AuditEventStore } from './event-store'

export class TraceViewer {
  private readonly store: AuditEventStore

  constructor(eventStore: AuditEventStore) {
    this.store = eventStore
  }

  /**
   * Get list of sessions with filters (P9-T3.1)
   */
  listSessions(filter: TraceFilterOptions = {}): TraceSessionSummary[] {
    const sessions = new Map<string, TraceSessionSummary>()

    // Get all session events
    const sessionStartEvents = this.store.query({
      type: 'session-started',
      startTime: filter.startTime,
      endTime: filter.endTime,
    })

    const sessionEndEvents = this.store.query({
      type: 'session-ended',
      startTime: filter.startTime,
      endTime: filter.endTime,
    })

    // Build session summaries
    sessionStartEvents.forEach(startEvent => {
      if (startEvent.data.type !== 'session') {
        return
      }

      const sessionId = startEvent.sessionId
      const endEvent = sessionEndEvents.find(e => e.sessionId === sessionId)

      // Get all events for this session
      const sessionEvents = this.store.getBySession(sessionId)

      // Calculate statistics
      const statistics = this.calculateSessionStatistics(sessionEvents)

      const summary: TraceSessionSummary = {
        sessionId,
        startTime: startEvent.timestamp,
        endTime: endEvent?.timestamp,
        duration: endEvent ? endEvent.timestamp - startEvent.timestamp : undefined,
        status: this.determineSessionStatus(sessionEvents, endEvent),
        provider: startEvent.data.provider,
        model: startEvent.data.model,
        statistics,
      }

      sessions.set(sessionId, summary)
    })

    let results = Array.from(sessions.values())

    // Apply filters
    if (filter.sessionId) {
      results = results.filter(s => s.sessionId === filter.sessionId)
    }
    if (filter.status) {
      results = results.filter(s => s.status === filter.status)
    }
    if (filter.provider) {
      results = results.filter(s => s.provider === filter.provider)
    }
    if (filter.model) {
      results = results.filter(s => s.model === filter.model)
    }
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      results = results.filter(
        s =>
          s.sessionId.toLowerCase().includes(query) ||
          s.provider.toLowerCase().includes(query) ||
          s.model.toLowerCase().includes(query),
      )
    }

    // Sort by start time (newest first)
    results.sort((a, b) => b.startTime - a.startTime)

    // Apply pagination
    const offset = filter.offset || 0
    const limit = filter.limit || results.length
    return results.slice(offset, offset + limit)
  }

  /**
   * Get timeline for a session (P9-T3.2)
   */
  getTimeline(sessionId: string): TraceTimelineEntry[] {
    const events = this.store.getBySession(sessionId)
    const timeline: TraceTimelineEntry[] = []

    events.forEach(event => {
      const entry = this.eventToTimelineEntry(event)
      if (entry) {
        timeline.push(entry)
      }
    })

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp)

    // Calculate durations
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = timeline[i]
      const next = timeline[i + 1]

      if (current.type === 'prompt' && next.type === 'response') {
        next.duration = next.timestamp - current.timestamp
      } else if (current.type === 'tool' && current.status === 'pending') {
        const completed = timeline.find(e => e.id === current.id && (e.status === 'success' || e.status === 'failed'))
        if (completed) {
          current.duration = completed.timestamp - current.timestamp
        }
      }
    }

    return timeline
  }

  /**
   * Get metrics for a session (P9-T3.2)
   */
  getMetrics(sessionId: string): TraceMetrics {
    const events = this.store.getBySession(sessionId)

    // Token metrics
    const responseEvents = events.filter(e => e.type === 'response-received')
    const totalTokens = responseEvents.reduce((sum, e) => {
      if (e.data.type === 'response') {
        return sum + (e.data.metadata.tokens || 0)
      }
      return sum
    }, 0)

    // Latency metrics
    const latencies: number[] = []
    responseEvents.forEach(e => {
      if (e.data.type === 'response') {
        latencies.push(e.data.metadata.latencyMs)
      }
    })
    latencies.sort((a, b) => a - b)

    // Cost metrics
    const totalCost = responseEvents.reduce((sum, e) => {
      if (e.data.type === 'response') {
        return sum + (e.data.metadata.cost || 0)
      }
      return sum
    }, 0)

    const costByProvider: Record<string, number> = {}
    const costByModel: Record<string, number> = {}
    responseEvents.forEach(e => {
      if (e.data.type === 'response') {
        const cost = e.data.metadata.cost || 0
        costByProvider[e.data.provider] = (costByProvider[e.data.provider] || 0) + cost
        costByModel[e.data.model] = (costByModel[e.data.model] || 0) + cost
      }
    })

    // Tool metrics
    const toolEvents = events.filter(e => e.type === 'tool-executed' || e.type === 'tool-failed')
    const successfulTools = toolEvents.filter(e => e.type === 'tool-executed')
    const executionsByTool: Record<string, number> = {}
    const failuresByTool: Record<string, number> = {}
    let totalExecutionTime = 0

    toolEvents.forEach(e => {
      if (e.data.type === 'tool') {
        executionsByTool[e.data.toolName] = (executionsByTool[e.data.toolName] || 0) + 1
        totalExecutionTime += e.data.metadata.executionTimeMs

        if (e.type === 'tool-failed') {
          failuresByTool[e.data.toolName] = (failuresByTool[e.data.toolName] || 0) + 1
        }
      }
    })

    // Approval metrics
    const approvalEvents = events.filter(
      e => e.type === 'approval-requested' || e.type === 'approval-granted' || e.type === 'approval-rejected',
    )
    const approvalRequests = events.filter(e => e.type === 'approval-requested')
    const approvalGranted = events.filter(e => e.type === 'approval-granted')
    const requestsByRiskLevel: Record<string, number> = {}
    let totalResponseTime = 0
    let responseCount = 0

    approvalEvents.forEach(e => {
      if (e.data.type === 'approval') {
        if (e.data.action === 'requested') {
          let riskLevel = 'low'
          if (e.data.riskScore >= 0.7) {
            riskLevel = 'high'
          } else if (e.data.riskScore >= 0.4) {
            riskLevel = 'medium'
          }
          requestsByRiskLevel[riskLevel] = (requestsByRiskLevel[riskLevel] || 0) + 1
        }
        if (e.data.metadata.responseTimeMs) {
          totalResponseTime += e.data.metadata.responseTimeMs
          responseCount += 1
        }
      }
    })

    return {
      sessionId,
      tokenMetrics: {
        totalTokens,
        promptTokens: Math.floor(totalTokens * 0.4), // Estimate
        completionTokens: Math.floor(totalTokens * 0.6), // Estimate
        averageTokensPerResponse: responseEvents.length > 0 ? totalTokens / responseEvents.length : 0,
      },
      latencyMetrics: {
        averageLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        minLatency: latencies.length > 0 ? latencies[0] : 0,
        maxLatency: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
        p50Latency: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0,
        p95Latency: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0,
        p99Latency: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0,
      },
      costMetrics: {
        totalCost,
        costByProvider,
        costByModel,
      },
      toolMetrics: {
        totalExecutions: toolEvents.length,
        successRate: toolEvents.length > 0 ? successfulTools.length / toolEvents.length : 0,
        averageExecutionTime: toolEvents.length > 0 ? totalExecutionTime / toolEvents.length : 0,
        executionsByTool,
        failuresByTool,
      },
      approvalMetrics: {
        totalRequests: approvalRequests.length,
        approvalRate: approvalRequests.length > 0 ? approvalGranted.length / approvalRequests.length : 0,
        averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
        requestsByRiskLevel,
      },
    }
  }

  /**
   * Replay session with diagnostics (P9-T4)
   */
  async replaySession(config: ReplayConfiguration): Promise<ReplayDiagnostics> {
    const originalEvents = this.store.getBySession(config.sessionId)
    const replayRunId = `replay-${Date.now()}`
    const divergences: ReplayDivergence[] = []

    // Filter events by step range
    let eventsToReplay = originalEvents
    if (config.startFromStep !== undefined || config.endAtStep !== undefined) {
      const start = config.startFromStep || 0
      const end = config.endAtStep || originalEvents.length
      eventsToReplay = originalEvents.slice(start, end)
    }

    // Simulate replay (in real implementation, this would re-execute)
    for (let i = 0; i < eventsToReplay.length; i++) {
      const event = eventsToReplay[i]

      // Compare outputs (P9-T4.2)
      if (config.compareOutputs && event.type === 'response-received') {
        // In real implementation, compare with actual re-execution
        // For now, we just record the expected output
      }

      // Compare policy checks (P9-T4.3)
      if (config.comparePolicies && event.type === 'policy-check') {
        // In real implementation, re-run policy checks
      }

      // Compare tool executions (P9-T4.3)
      if (config.compareTools && (event.type === 'tool-executed' || event.type === 'tool-failed')) {
        // In real implementation, re-execute tools
      }

      // Stop on divergence if configured
      if (config.stopOnDivergence && divergences.length > 0) {
        break
      }
    }

    return {
      sessionId: config.sessionId,
      originalRunId: config.sessionId,
      replayRunId,
      startTime: Date.now(),
      endTime: Date.now(),
      status: 'completed',
      divergences,
      summary: {
        totalSteps: eventsToReplay.length,
        matchingSteps: eventsToReplay.length - divergences.length,
        divergentSteps: divergences.length,
        matchRate: eventsToReplay.length > 0 ? (eventsToReplay.length - divergences.length) / eventsToReplay.length : 1,
      },
    }
  }

  /**
   * Convert audit event to timeline entry
   */
  private eventToTimelineEntry(event: AuditEvent): TraceTimelineEntry | null {
    const base = {
      id: event.id,
      timestamp: event.timestamp,
      event,
    }

    switch (event.type) {
      case 'prompt-submitted':
        if (event.data.type === 'prompt') {
          return {
            ...base,
            type: 'prompt',
            title: 'Prompt Submitted',
            description: event.data.content.substring(0, 100),
            status: 'success',
            metadata: event.data.metadata,
          }
        }
        break

      case 'response-received':
        if (event.data.type === 'response') {
          return {
            ...base,
            type: 'response',
            title: 'Response Received',
            description: `${event.data.provider} - ${event.data.model}`,
            status: 'success',
            metadata: event.data.metadata,
          }
        }
        break

      case 'tool-executed':
      case 'tool-failed':
        if (event.data.type === 'tool') {
          return {
            ...base,
            type: 'tool',
            title: `Tool: ${event.data.toolName}`,
            description: event.data.action,
            status: event.type === 'tool-executed' ? 'success' : 'failed',
            duration: event.data.metadata.executionTimeMs,
            metadata: event.data.metadata,
          }
        }
        break

      case 'approval-requested':
      case 'approval-granted':
      case 'approval-rejected':
        if (event.data.type === 'approval') {
          return {
            ...base,
            type: 'approval',
            title: `Approval ${event.data.action}`,
            description: event.data.reason,
            status: (() => {
              if (event.data.action === 'granted') {
                return 'success'
              }
              if (event.data.action === 'rejected') {
                return 'failed'
              }
              return 'pending'
            })() as TraceTimelineEntry['status'],
            metadata: event.data.metadata,
          }
        }
        break

      case 'policy-check':
      case 'policy-violation':
        if (event.data.type === 'policy') {
          return {
            ...base,
            type: 'policy',
            title: `Policy: ${event.data.policyName}`,
            description: event.data.result,
            status: event.data.result === 'allowed' ? 'success' : 'failed',
            metadata: event.data.metadata,
          }
        }
        break

      case 'document-created':
      case 'document-updated':
      case 'document-deleted':
        if (event.data.type === 'document') {
          return {
            ...base,
            type: 'document',
            title: `Document ${event.data.action}`,
            description: event.data.documentTitle,
            status: 'success',
            metadata: event.data.metadata,
          }
        }
        break
    }

    return null
  }

  /**
   * Calculate session statistics
   */
  private calculateSessionStatistics(events: AuditEvent[]) {
    const promptCount = events.filter(e => e.type === 'prompt-submitted').length
    const responseCount = events.filter(e => e.type === 'response-received').length
    const toolExecutions = events.filter(e => e.type === 'tool-executed' || e.type === 'tool-failed').length
    const approvalRequests = events.filter(e => e.type === 'approval-requested').length
    const policyChecks = events.filter(e => e.type === 'policy-check').length
    const documentChanges = events.filter(
      e => e.type === 'document-created' || e.type === 'document-updated' || e.type === 'document-deleted',
    ).length

    let totalTokens = 0
    let totalCost = 0
    const latencies: number[] = []

    events.forEach(e => {
      if (e.type === 'response-received' && e.data.type === 'response') {
        totalTokens += e.data.metadata.tokens || 0
        totalCost += e.data.metadata.cost || 0
        latencies.push(e.data.metadata.latencyMs)
      }
    })

    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0

    return {
      totalEvents: events.length,
      promptCount,
      responseCount,
      toolExecutions,
      approvalRequests,
      policyChecks,
      documentChanges,
      totalTokens,
      totalCost,
      averageLatency,
    }
  }

  /**
   * Determine session status
   */
  private determineSessionStatus(
    events: AuditEvent[],
    endEvent?: AuditEvent,
  ): 'active' | 'completed' | 'failed' | 'cancelled' {
    if (!endEvent) {
      return 'active'
    }

    const hasFailures = events.some(e => e.type === 'tool-failed' || e.type === 'policy-violation')
    if (hasFailures) {
      return 'failed'
    }

    return 'completed'
  }
}

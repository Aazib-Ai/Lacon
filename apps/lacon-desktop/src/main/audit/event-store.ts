/**
 * Immutable Audit Event Store
 * Phase 9: Epic P9-E1 (P9-T2)
 *
 * Implements append-only event storage with integrity checks
 */

import { createHash } from 'crypto'

import type {
  AuditEvent,
  AuditEventData,
  AuditEventType,
  AuditQueryFilter,
  AuditStatistics,
  IntegrityCheckResult,
  RetentionPolicy,
} from '../../shared/audit-types'

export class AuditEventStore {
  private events: Map<string, AuditEvent> = new Map()
  private eventsBySession: Map<string, string[]> = new Map()
  private eventsByType: Map<AuditEventType, string[]> = new Map()
  private retentionPolicy: RetentionPolicy

  constructor(retentionPolicy?: Partial<RetentionPolicy>) {
    this.retentionPolicy = {
      enabled: retentionPolicy?.enabled ?? true,
      retentionDays: retentionPolicy?.retentionDays ?? 90,
      archiveEnabled: retentionPolicy?.archiveEnabled ?? false,
      archivePath: retentionPolicy?.archivePath,
      autoCleanup: retentionPolicy?.autoCleanup ?? true,
    }
  }

  /**
   * Append event to store (P9-T2.1)
   * Events are immutable after write
   */
  append(type: AuditEventType, sessionId: string, data: AuditEventData, userId?: string): AuditEvent {
    const id = this.generateEventId()
    const timestamp = Date.now()

    // Create event without integrity hash first
    const eventData = {
      id,
      timestamp,
      type,
      sessionId,
      userId,
      data,
    }

    // Calculate integrity hash (P9-T2.2)
    const integrity = this.calculateIntegrity(eventData)

    // Create immutable event
    const event: AuditEvent = Object.freeze({
      ...eventData,
      integrity,
    })

    // Store event
    this.events.set(id, event)

    // Index by session
    if (!this.eventsBySession.has(sessionId)) {
      this.eventsBySession.set(sessionId, [])
    }
    this.eventsBySession.get(sessionId)!.push(id)

    // Index by type
    if (!this.eventsByType.has(type)) {
      this.eventsByType.set(type, [])
    }
    this.eventsByType.get(type)!.push(id)

    return event
  }

  /**
   * Query events with filters
   */
  query(filter: AuditQueryFilter = {}): AuditEvent[] {
    let results: AuditEvent[] = []

    // Filter by session
    if (filter.sessionId) {
      const eventIds = this.eventsBySession.get(filter.sessionId) || []
      results = eventIds.map(id => this.events.get(id)!).filter(Boolean)
    }
    // Filter by type
    else if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type]
      const eventIds = new Set<string>()
      types.forEach(type => {
        const ids = this.eventsByType.get(type) || []
        ids.forEach(id => eventIds.add(id))
      })
      results = Array.from(eventIds)
        .map(id => this.events.get(id)!)
        .filter(Boolean)
    }
    // All events
    else {
      results = Array.from(this.events.values())
    }

    // Filter by time range
    if (filter.startTime) {
      results = results.filter(e => e.timestamp >= filter.startTime!)
    }
    if (filter.endTime) {
      results = results.filter(e => e.timestamp <= filter.endTime!)
    }

    // Filter by user
    if (filter.userId) {
      results = results.filter(e => e.userId === filter.userId)
    }

    // Filter by tool name
    if (filter.toolName) {
      results = results.filter(e => {
        if (e.data.type === 'tool') {
          return e.data.toolName === filter.toolName
        }
        return false
      })
    }

    // Filter by document
    if (filter.documentId) {
      results = results.filter(e => {
        if (e.data.type === 'document') {
          return e.data.documentId === filter.documentId
        }
        if (e.data.type === 'prompt') {
          return e.data.documentId === filter.documentId
        }
        return false
      })
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp)

    // Apply pagination
    const offset = filter.offset || 0
    const limit = filter.limit || results.length
    return results.slice(offset, offset + limit)
  }

  /**
   * Get event by ID
   */
  getById(id: string): AuditEvent | undefined {
    return this.events.get(id)
  }

  /**
   * Get all events for a session
   */
  getBySession(sessionId: string): AuditEvent[] {
    return this.query({ sessionId })
  }

  /**
   * Verify event integrity (P9-T2.2)
   */
  verifyIntegrity(eventId: string): IntegrityCheckResult {
    const event = this.events.get(eventId)
    if (!event) {
      throw new Error(`Event not found: ${eventId}`)
    }

    const expectedHash = event.integrity
    const actualHash = this.calculateIntegrity({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      sessionId: event.sessionId,
      userId: event.userId,
      data: event.data,
    })

    return {
      eventId,
      valid: expectedHash === actualHash,
      expectedHash,
      actualHash,
      timestamp: Date.now(),
    }
  }

  /**
   * Verify integrity of all events
   */
  verifyAllIntegrity(): IntegrityCheckResult[] {
    return Array.from(this.events.keys()).map(id => this.verifyIntegrity(id))
  }

  /**
   * Get statistics
   */
  getStatistics(): AuditStatistics {
    const events = Array.from(this.events.values())
    const eventsByType: Record<string, number> = {}

    events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
    })

    const sessions = new Set(events.map(e => e.sessionId))
    const toolExecutions = events.filter(e => e.type === 'tool-executed').length
    const approvals = events.filter(e => e.type === 'approval-granted' || e.type === 'approval-rejected').length
    const policyViolations = events.filter(e => e.type === 'policy-violation').length

    const timestamps = events.map(e => e.timestamp)
    const start = timestamps.length > 0 ? Math.min(...timestamps) : Date.now()
    const end = timestamps.length > 0 ? Math.max(...timestamps) : Date.now()

    return {
      totalEvents: events.length,
      eventsByType: eventsByType as Record<AuditEventType, number>,
      totalSessions: sessions.size,
      totalToolExecutions: toolExecutions,
      totalApprovals: approvals,
      totalPolicyViolations: policyViolations,
      timeRange: { start, end },
    }
  }

  /**
   * Apply retention policy (P9-T2.3)
   */
  applyRetentionPolicy(): number {
    if (!this.retentionPolicy.enabled) {
      return 0
    }

    const cutoffTime = Date.now() - this.retentionPolicy.retentionDays * 24 * 60 * 60 * 1000
    const eventsToRemove: string[] = []

    this.events.forEach((event, id) => {
      if (event.timestamp < cutoffTime) {
        eventsToRemove.push(id)
      }
    })

    // Archive if enabled
    if (this.retentionPolicy.archiveEnabled && eventsToRemove.length > 0) {
      // Archive implementation would go here
      // For now, we just remove
    }

    // Remove old events
    eventsToRemove.forEach(id => {
      const event = this.events.get(id)
      if (event) {
        this.events.delete(id)

        // Remove from indexes
        const sessionEvents = this.eventsBySession.get(event.sessionId)
        if (sessionEvents) {
          const index = sessionEvents.indexOf(id)
          if (index > -1) {
            sessionEvents.splice(index, 1)
          }
        }

        const typeEvents = this.eventsByType.get(event.type)
        if (typeEvents) {
          const index = typeEvents.indexOf(id)
          if (index > -1) {
            typeEvents.splice(index, 1)
          }
        }
      }
    })

    return eventsToRemove.length
  }

  /**
   * Calculate integrity hash for event
   */
  private calculateIntegrity(eventData: Omit<AuditEvent, 'integrity'>): string {
    const payload = JSON.stringify(eventData)
    return createHash('sha256').update(payload).digest('hex')
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Clear all events (for testing only)
   */
  clear(): void {
    this.events.clear()
    this.eventsBySession.clear()
    this.eventsByType.clear()
  }

  /**
   * Get event count
   */
  count(): number {
    return this.events.size
  }
}

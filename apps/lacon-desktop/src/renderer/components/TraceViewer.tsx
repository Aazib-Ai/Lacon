/**
 * Trace Viewer Component
 * Phase 9: Epic P9-E2 (P9-T3)
 */

import React, { useEffect, useState } from 'react'

import { useTrace } from '../hooks/useAudit'

export const TraceViewer: React.FC = () => {
  const { sessions, timeline, metrics, loading, error, listSessions, getTimeline, getMetrics } = useTrace()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    listSessions({})
  }, [listSessions])

  useEffect(() => {
    if (selectedSessionId) {
      getTimeline(selectedSessionId)
      getMetrics(selectedSessionId)
    }
  }, [selectedSessionId, getTimeline, getMetrics])

  const filteredSessions = sessions.filter(
    session =>
      session.sessionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.model.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const formatDuration = (ms?: number) => {
    if (!ms) {return 'N/A'}
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="trace-viewer">
      <div className="trace-viewer-header">
        <h2>Trace Viewer</h2>
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="trace-search"
        />
      </div>

      {error && <div className="trace-error">{error}</div>}

      <div className="trace-content">
        {/* Session List */}
        <div className="trace-sessions">
          <h3>Sessions ({filteredSessions.length})</h3>
          {loading && !selectedSessionId && <div className="trace-loading">Loading sessions...</div>}
          <div className="trace-session-list">
            {filteredSessions.map(session => (
              <div
                key={session.sessionId}
                className={`trace-session-item ${selectedSessionId === session.sessionId ? 'selected' : ''}`}
                onClick={() => setSelectedSessionId(session.sessionId)}
              >
                <div className="session-header">
                  <span className={`session-status status-${session.status}`}>{session.status}</span>
                  <span className="session-time">{formatTimestamp(session.startTime)}</span>
                </div>
                <div className="session-details">
                  <div className="session-provider">
                    {session.provider} - {session.model}
                  </div>
                  <div className="session-stats">
                    <span>{session.statistics.totalEvents} events</span>
                    <span>{session.statistics.toolExecutions} tools</span>
                    <span>{formatDuration(session.duration)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline and Metrics */}
        {selectedSessionId && (
          <div className="trace-details">
            {/* Metrics */}
            {metrics && (
              <div className="trace-metrics">
                <h3>Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">Total Tokens</div>
                    <div className="metric-value">{metrics.tokenMetrics.totalTokens.toLocaleString()}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Avg Latency</div>
                    <div className="metric-value">{Math.round(metrics.latencyMetrics.averageLatency)}ms</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Total Cost</div>
                    <div className="metric-value">${metrics.costMetrics.totalCost.toFixed(4)}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Tool Success Rate</div>
                    <div className="metric-value">{(metrics.toolMetrics.successRate * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="trace-timeline">
              <h3>Timeline ({timeline.length} events)</h3>
              {loading && <div className="trace-loading">Loading timeline...</div>}
              <div className="timeline-list">
                {timeline.map(entry => (
                  <div key={entry.id} className={`timeline-entry type-${entry.type} status-${entry.status}`}>
                    <div className="timeline-marker" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-title">{entry.title}</span>
                        <span className="timeline-time">{formatTimestamp(entry.timestamp)}</span>
                      </div>
                      <div className="timeline-description">{entry.description}</div>
                      {entry.duration && <div className="timeline-duration">Duration: {entry.duration}ms</div>}
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <details className="timeline-metadata">
                          <summary>Metadata</summary>
                          <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

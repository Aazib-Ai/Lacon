/**
 * Trace Viewer Component
 * Session tracing with timeline, metrics, and search.
 */

import React, { useEffect, useState } from 'react'

import { cn } from '../lib/utils'
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

  const statusStyles: Record<string, string> = {
    active: 'bg-success/15 text-success',
    completed: 'bg-primary/15 text-primary',
    error: 'bg-destructive/15 text-destructive',
  }

  return (
    <div className="flex flex-col h-full" id="trace-viewer">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground m-0">Trace Viewer</h2>
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground w-56 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Session List */}
        <div className="w-72 border-r border-border flex flex-col flex-shrink-0">
          <div className="px-4 py-2.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground m-0">Sessions ({filteredSessions.length})</h3>
          </div>
          {loading && !selectedSessionId && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Loading sessions...</div>
          )}
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.map(session => (
              <div
                key={session.sessionId}
                className={cn(
                  'px-4 py-3 cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50',
                  selectedSessionId === session.sessionId && 'bg-primary/10 border-l-2 border-l-primary',
                )}
                onClick={() => setSelectedSessionId(session.sessionId)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                      statusStyles[session.status] || 'bg-muted text-muted-foreground',
                    )}
                  >
                    {session.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatTimestamp(session.startTime)}</span>
                </div>
                <div className="text-xs font-medium text-foreground mb-0.5">
                  {session.provider} - {session.model}
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span>{session.statistics.totalEvents} events</span>
                  <span>{session.statistics.toolExecutions} tools</span>
                  <span>{formatDuration(session.duration)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline and Metrics */}
        {selectedSessionId && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* Metrics */}
            {metrics && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 mt-0">Metrics</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total Tokens', value: metrics.tokenMetrics.totalTokens.toLocaleString() },
                    { label: 'Avg Latency', value: `${Math.round(metrics.latencyMetrics.averageLatency)}ms` },
                    { label: 'Total Cost', value: `$${metrics.costMetrics.totalCost.toFixed(4)}` },
                    { label: 'Tool Success Rate', value: `${(metrics.toolMetrics.successRate * 100).toFixed(1)}%` },
                  ].map(m => (
                    <div key={m.label} className="p-3 bg-card rounded-lg border border-border">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{m.label}</div>
                      <div className="text-lg font-bold text-foreground tabular-nums">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 mt-0">Timeline ({timeline.length} events)</h3>
              {loading && <div className="text-sm text-muted-foreground">Loading timeline...</div>}
              <div className="flex flex-col gap-2 relative before:absolute before:left-[7px] before:top-0 before:bottom-0 before:w-px before:bg-border">
                {timeline.map(entry => (
                  <div key={entry.id} className="flex gap-3 relative">
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 z-10',
                        entry.status === 'success' ? 'bg-success border-success' :
                        entry.status === 'error' ? 'bg-destructive border-destructive' :
                        'bg-card border-border',
                      )}
                    />
                    <div className="flex-1 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{entry.title}</span>
                        <span className="text-[10px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{entry.description}</div>
                      {entry.duration && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">Duration: {entry.duration}ms</div>
                      )}
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                            Metadata
                          </summary>
                          <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto text-foreground">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
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

/**
 * ResearchWorkbench — Phase 5
 *
 * Research timeline UI outside the writer loop.
 * Features: entry timeline, mode selector, citation style, file import, fact-check.
 */

import './ResearchWorkbench.css'

import React, { useState } from 'react'

import type { CitationStyle, FactCheckResult, ResearchLogEntry, ResearchMode } from '../../../shared/writer-types'
import { useResearch } from '../../hooks/useResearch'

interface ResearchWorkbenchProps {
  documentId: string
  sections?: Array<{ id: string; title: string; content: string }>
}

const MODE_LABELS: Record<ResearchMode, { label: string; desc: string }> = {
  auto: { label: 'Auto', desc: 'AI gathers research automatically' },
  supervised: { label: 'Supervised', desc: 'AI suggests, you approve' },
  manual: { label: 'Manual', desc: 'You add all research' },
}

const STYLE_LABELS: Record<CitationStyle, string> = {
  apa: 'APA',
  mla: 'MLA',
  chicago: 'Chicago',
  ieee: 'IEEE',
  inline: 'Inline',
}
const SOURCE_ICONS: Record<string, string> = { web: '🌐', file: '📄', manual: '✏️' }

function getEntryIcon(entry: ResearchLogEntry): string {
  const src = entry.sources[0]
  if (!src) {return '✏️'}
  return SOURCE_ICONS[src.type] || '📋'
}

// ── Sub-components (defined before use) ──

const FactCheckPanel: React.FC<{ result: FactCheckResult }> = ({ result }) => {
  const pct = Math.round(result.confidence * 100)
  let cls = 'low'
  if (pct >= 70) {cls = 'high'}
  else if (pct >= 40) {cls = 'medium'}

  return (
    <div className={`rw-fact-check-result rw-confidence-${cls}`}>
      <div className="rw-fc-header">
        <span>Fact-check</span>
        <span className={`rw-fc-badge rw-fc-${cls}`}>{pct}%</span>
      </div>
      <p className="rw-fc-summary">{result.summary}</p>
      {result.supportingSources.length > 0 && (
        <div className="rw-fc-sources">
          <h5>✅ Supporting</h5>
          {result.supportingSources.slice(0, 3).map(s => (
            <div key={s.entryId} className="rw-fc-source">
              <b>{s.sourceTitle}</b> ({Math.round(s.relevance * 100)}%)
              <p>{s.excerpt.slice(0, 120)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const EntryCard: React.FC<{
  entry: ResearchLogEntry
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}> = ({ entry, expanded, onToggle, onDelete }) => {
  const icon = getEntryIcon(entry)
  return (
    <div className={`rw-entry ${expanded ? 'rw-entry-expanded' : ''}`}>
      <div className="rw-entry-header" onClick={onToggle}>
        <span className="rw-entry-icon">{icon}</span>
        <div className="rw-entry-meta">
          <span className="rw-entry-query">{entry.query}</span>
          <span className="rw-entry-date">
            {new Date(entry.createdAt).toLocaleDateString()} · {entry.sources.length} src
          </span>
        </div>
        <div className="rw-entry-badges">
          {entry.tags.map(t => (
            <span key={t} className="rw-badge">
              {t}
            </span>
          ))}
          <span className={`rw-mode-badge rw-mode-${entry.mode}`}>{entry.mode}</span>
        </div>
        <button className="rw-entry-expand">{expanded ? '▲' : '▼'}</button>
      </div>
      {expanded && (
        <div className="rw-entry-body">
          {entry.sources.length > 0 && (
            <div className="rw-entry-section">
              <h5>Sources</h5>
              {entry.sources.map((s, i) => (
                <div key={i} className="rw-source">
                  <span>{SOURCE_ICONS[s.type] || '📋'}</span> {s.title}
                </div>
              ))}
            </div>
          )}
          {entry.excerpts.length > 0 && (
            <div className="rw-entry-section">
              <h5>Excerpts</h5>
              {entry.excerpts.map((e, i) => (
                <blockquote key={i} className="rw-excerpt">
                  {e.slice(0, 300)}
                </blockquote>
              ))}
            </div>
          )}
          {entry.citationFormatted && (
            <div className="rw-entry-section">
              <h5>Citation</h5>
              <code className="rw-citation">{entry.citationFormatted}</code>
            </div>
          )}
          <div className="rw-entry-actions">
            <button className="rw-btn rw-btn-danger rw-btn-sm" onClick={onDelete}>
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ──

export const ResearchWorkbench: React.FC<ResearchWorkbenchProps> = ({ documentId, sections = [] }) => {
  const {
    entries,
    mode,
    citationStyle,
    factCheckResult,
    loading,
    error,
    addEntry,
    deleteEntry,
    setMode,
    setCitationStyle,
    importFile,
    factCheck,
  } = useResearch(documentId)
  const [newQuery, setNewQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedSection, setSelectedSection] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!newQuery.trim()) {return}
    await addEntry(newQuery.trim())
    setNewQuery('')
    setShowAddForm(false)
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.pdf,.docx,.pptx'
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {return}
      const ext = file.name.split('.').pop()?.toLowerCase()
      const typeMap: Record<string, 'pdf' | 'docx' | 'txt' | 'pptx'> = {
        pdf: 'pdf',
        docx: 'docx',
        txt: 'txt',
        pptx: 'pptx',
      }
      // @ts-ignore — Electron file path
      await importFile(file.path || file.name, typeMap[ext || ''] || 'txt')
    }
    input.click()
  }

  const handleFactCheck = async () => {
    const s = sections.find(x => x.id === selectedSection)
    if (s) {await factCheck(s.id, s.content)}
  }

  return (
    <div className="research-workbench">
      <div className="rw-header">
        <h3 className="rw-title">
          🔬 Research Workbench <span className="rw-count">{entries.length}</span>
        </h3>
        <div className="rw-actions">
          <button className="rw-btn rw-btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            + Add
          </button>
          <button className="rw-btn rw-btn-secondary" onClick={handleImport}>
            📂 Import
          </button>
        </div>
      </div>

      <div className="rw-controls">
        <div className="rw-control-group">
          <label className="rw-label">Mode</label>
          <div className="rw-mode-selector">
            {(Object.keys(MODE_LABELS) as ResearchMode[]).map(m => (
              <button
                key={m}
                className={`rw-mode-btn ${mode === m ? 'rw-mode-active' : ''}`}
                onClick={() => setMode(m)}
                title={MODE_LABELS[m].desc}
              >
                {MODE_LABELS[m].label}
              </button>
            ))}
          </div>
        </div>
        <div className="rw-control-group">
          <label className="rw-label">Citation</label>
          <select
            className="rw-select"
            value={citationStyle}
            onChange={e => setCitationStyle(e.target.value as CitationStyle)}
          >
            {(Object.keys(STYLE_LABELS) as CitationStyle[]).map(s => (
              <option key={s} value={s}>
                {STYLE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {sections.length > 0 && (
          <div className="rw-control-group">
            <label className="rw-label">Fact-check</label>
            <div className="rw-fact-check">
              <select className="rw-select" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                <option value="">Select section...</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <button className="rw-btn rw-btn-accent" onClick={handleFactCheck} disabled={!selectedSection || loading}>
                🔍
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="rw-error">{error}</div>}

      {showAddForm && (
        <div className="rw-add-form">
          <input
            className="rw-input"
            placeholder="Research query or note..."
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button className="rw-btn rw-btn-primary" onClick={handleAdd} disabled={!newQuery.trim()}>
            Add
          </button>
          <button className="rw-btn rw-btn-ghost" onClick={() => setShowAddForm(false)}>
            Cancel
          </button>
        </div>
      )}

      {factCheckResult && <FactCheckPanel result={factCheckResult} />}

      <div className="rw-timeline">
        {entries.length === 0 ? (
          <div className="rw-empty">
            <span className="rw-empty-icon">📚</span>
            <p>No research entries yet.</p>
          </div>
        ) : (
          entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))
        )}
      </div>
      {loading && (
        <div className="rw-loading-overlay">
          <div className="rw-spinner" />
        </div>
      )}
    </div>
  )
}

export default ResearchWorkbench

/**
 * ResearchWorkbench — Research Timeline UI
 *
 * Research timeline outside the writer loop.
 * Features: entry timeline, mode selector, citation style, file import, fact-check.
 */

import React, { useState } from 'react'

import type { CitationStyle, FactCheckResult, ResearchLogEntry, ResearchMode } from '../../../shared/writer-types'
import { cn } from '../../lib/utils'
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

// ── Sub-components ──

const FactCheckPanel: React.FC<{ result: FactCheckResult }> = ({ result }) => {
  const pct = Math.round(result.confidence * 100)
  let level: 'high' | 'medium' | 'low' = 'low'
  if (pct >= 70) {level = 'high'}
  else if (pct >= 40) {level = 'medium'}

  const levelStyles = {
    high: 'border-success/20 bg-success/5',
    medium: 'border-warning/20 bg-warning/5',
    low: 'border-destructive/20 bg-destructive/5',
  }
  const badgeStyles = {
    high: 'bg-success/15 text-success',
    medium: 'bg-warning/15 text-warning',
    low: 'bg-destructive/15 text-destructive',
  }

  return (
    <div className={cn('rounded-lg border p-4 mb-3', levelStyles[level])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-foreground">Fact-check</span>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', badgeStyles[level])}>{pct}%</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed m-0">{result.summary}</p>
      {result.supportingSources.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-semibold text-success mb-1 mt-0">✅ Supporting</h5>
          {result.supportingSources.slice(0, 3).map(s => (
            <div key={s.entryId} className="text-xs text-muted-foreground mb-1">
              <b className="text-foreground">{s.sourceTitle}</b> ({Math.round(s.relevance * 100)}%)
              <p className="m-0 mt-0.5">{s.excerpt.slice(0, 120)}</p>
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
    <div className={cn('rounded-lg border border-border bg-card transition-all', expanded && 'ring-1 ring-primary/20')}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
        onClick={onToggle}
      >
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground block truncate">{entry.query}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(entry.createdAt).toLocaleDateString()} · {entry.sources.length} src
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {entry.tags.map(t => (
            <span key={t} className="text-[0.65rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {t}
            </span>
          ))}
          <span className={cn(
            'text-[0.65rem] px-1.5 py-0.5 rounded font-semibold uppercase',
            entry.mode === 'auto' ? 'bg-primary/10 text-primary' :
            entry.mode === 'supervised' ? 'bg-warning/10 text-warning' :
            'bg-muted text-muted-foreground'
          )}>
            {entry.mode}
          </span>
        </div>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 animate-in fade-in duration-200">
          {entry.sources.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1 mt-0">Sources</h5>
              {entry.sources.map((s, i) => (
                <div key={i} className="text-sm text-foreground">
                  <span>{SOURCE_ICONS[s.type] || '📋'}</span> {s.title}
                </div>
              ))}
            </div>
          )}
          {entry.excerpts.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1 mt-0">Excerpts</h5>
              {entry.excerpts.map((e, i) => (
                <blockquote key={i} className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3 my-1 italic">
                  {e.slice(0, 300)}
                </blockquote>
              ))}
            </div>
          )}
          {entry.citationFormatted && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1 mt-0">Citation</h5>
              <code className="text-xs bg-muted px-2 py-1 rounded block text-foreground">{entry.citationFormatted}</code>
            </div>
          )}
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
              onClick={onDelete}
            >
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 m-0">
          🔬 Research Workbench <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{entries.length}</span>
        </h3>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            + Add
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-muted transition-colors"
            onClick={handleImport}
          >
            📂 Import
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Mode</label>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(Object.keys(MODE_LABELS) as ResearchMode[]).map(m => (
              <button
                key={m}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium transition-colors',
                  mode === m ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
                )}
                onClick={() => setMode(m)}
                title={MODE_LABELS[m].desc}
              >
                {MODE_LABELS[m].label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Citation</label>
          <select
            className="px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-primary"
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
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">Fact-check</label>
            <div className="flex gap-1">
              <select
                className="px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
              >
                <option value="">Select section...</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button
                className="px-2 py-1 text-xs rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                onClick={handleFactCheck}
                disabled={!selectedSection || loading}
              >
                🔍
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="flex gap-2 px-4 py-3 border-b border-border">
          <input
            className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            placeholder="Research query or note..."
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
            onClick={handleAdd}
            disabled={!newQuery.trim()}
          >
            Add
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setShowAddForm(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {factCheckResult && <div className="px-4 pt-3"><FactCheckPanel result={factCheckResult} /></div>}

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-3xl mb-2">📚</span>
            <p className="text-sm m-0">No research entries yet.</p>
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
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

export default ResearchWorkbench

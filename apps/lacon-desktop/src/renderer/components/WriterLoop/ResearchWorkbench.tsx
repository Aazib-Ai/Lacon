/**
 * ResearchWorkbench — Research Timeline UI with Web Search
 *
 * Features:
 * - Web search (quick preview + deep research)
 * - URL auto-detection and direct import
 * - Entry timeline with source/excerpt display
 * - Mode selector, citation style, fact-check
 * - File import (txt, pdf, docx, pptx)
 * - Section linking for research entries
 */

import React, { useState } from 'react'

import type {
  CitationStyle,
  FactCheckResult,
  ResearchLogEntry,
  ResearchMode,
  WebSearchResult,
} from '../../../shared/writer-types'
import { useResearch } from '../../hooks/useResearch'
import { cn } from '../../lib/utils'

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

function getTagStyle(t: string): string {
  if (t === 'web-search') {return 'bg-blue-500/10 text-blue-400'}
  if (t === 'summarized') {return 'bg-green-500/10 text-green-400'}
  if (t === 'import' || t === 'pdf' || t === 'docx') {return 'bg-amber-500/10 text-amber-400'}
  if (t === 'url-import') {return 'bg-purple-500/10 text-purple-400'}
  return 'bg-muted text-muted-foreground'
}

function getModeStyle(mode: string): string {
  if (mode === 'auto') {return 'bg-primary/10 text-primary'}
  if (mode === 'supervised') {return 'bg-warning/10 text-warning'}
  return 'bg-muted text-muted-foreground'
}

function getEntryIcon(entry: ResearchLogEntry): string {
  const src = entry.sources[0]
  if (!src) {
    return '✏️'
  }
  return SOURCE_ICONS[src.type] || '📋'
}

// ── Sub-components ──

const FactCheckPanel: React.FC<{ result: FactCheckResult }> = ({ result }) => {
  const pct = Math.round(result.confidence * 100)
  let level: 'high' | 'medium' | 'low' = 'low'
  if (pct >= 70) {
    level = 'high'
  } else if (pct >= 40) {
    level = 'medium'
  }

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

/** Quick search result card */
const SearchResultCard: React.FC<{
  result: WebSearchResult
  onAdd: () => void
  adding?: boolean
}> = ({ result, onAdd, adding }) => (
  <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors overflow-hidden min-w-0">
    <span className="text-base mt-0.5 flex-shrink-0">{result.source === 'wikipedia' ? '📚' : '🌐'}</span>
    <div className="flex-1 min-w-0 overflow-hidden">
      <p className="text-sm font-medium text-foreground truncate m-0">{result.title}</p>
      <p className="text-xs text-muted-foreground line-clamp-2 m-0 mt-0.5">{result.snippet}</p>
      <span className="text-[0.6rem] text-muted-foreground/60 truncate block">{result.url?.slice(0, 60)}</span>
    </div>
    <button
      onClick={onAdd}
      disabled={adding}
      className="px-2 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0 disabled:opacity-40 whitespace-nowrap"
    >
      {adding ? '...' : '+ Add'}
    </button>
  </div>
)

/** Research entry card */
const EntryCard: React.FC<{
  entry: ResearchLogEntry
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  sections?: Array<{ id: string; title: string }>
  onLinkSection?: (sectionId: string) => void
}> = ({ entry, expanded, onToggle, onDelete, sections, onLinkSection }) => {
  const icon = getEntryIcon(entry)
  const hasSummary = entry.tags.includes('summarized')

  return (
    <div className={cn('rounded-lg border border-border bg-card transition-all overflow-hidden min-w-0', expanded && 'ring-1 ring-primary/20')}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
        onClick={onToggle}
      >
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0 overflow-hidden">
          <span className="text-sm font-medium text-foreground block truncate">{entry.query}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(entry.createdAt).toLocaleDateString()} · {entry.sources.length} src
            {entry.excerpts.length > 0 && ` · ${entry.excerpts.length} excerpts`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {entry.tags.map(t => (
            <span key={t} className={cn('text-[0.65rem] px-1.5 py-0.5 rounded font-medium', getTagStyle(t))}>
              {t}
            </span>
          ))}
          <span
            className={cn('text-[0.65rem] px-1.5 py-0.5 rounded font-semibold uppercase', getModeStyle(entry.mode))}
          >
            {entry.mode}
          </span>
        </div>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 animate-in fade-in duration-200">
          {/* Sources with clickable URLs */}
          {entry.sources.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1.5 mt-0">Sources</h5>
              {entry.sources.map((s, i) => (
                <div key={i} className="text-sm text-foreground mb-1">
                  <span>{SOURCE_ICONS[s.type] || '📋'}</span> <span className="font-medium">{s.title}</span>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary/70 hover:text-primary ml-2 break-all"
                      onClick={e => e.stopPropagation()}
                    >
                      ↗ {s.url.slice(0, 50)}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Excerpts — LLM summary first if available */}
          {entry.excerpts.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1.5 mt-0">
                {hasSummary ? 'AI Summary & Excerpts' : 'Excerpts'}
              </h5>
              {entry.excerpts.map((e, i) => (
                <blockquote
                  key={i}
                  className={cn(
                    'text-sm border-l-2 pl-3 my-1.5',
                    i === 0 && hasSummary
                      ? 'text-foreground border-primary/40 bg-primary/5 rounded-r-md py-2 pr-2'
                      : 'text-muted-foreground border-primary/20 italic',
                  )}
                >
                  {i === 0 && hasSummary && (
                    <span className="text-[0.65rem] font-semibold text-primary block mb-1">🤖 AI Summary</span>
                  )}
                  {e.slice(0, 400)}
                  {e.length > 400 ? '...' : ''}
                </blockquote>
              ))}
            </div>
          )}

          {/* Linked sections */}
          {entry.linkedSectionIds.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1 mt-0">Linked Sections</h5>
              <div className="flex flex-wrap gap-1">
                {entry.linkedSectionIds.map(sid => (
                  <span
                    key={sid}
                    className="text-[0.65rem] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                  >
                    📎 {sections?.find(s => s.id === sid)?.title || sid}
                  </span>
                ))}
              </div>
            </div>
          )}

          {entry.citationFormatted && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1 mt-0">Citation</h5>
              <code className="text-xs bg-muted px-2 py-1 rounded block text-foreground">
                {entry.citationFormatted}
              </code>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
              onClick={onDelete}
            >
              🗑 Delete
            </button>
            {sections && sections.length > 0 && onLinkSection && (
              <select
                className="px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                value=""
                onChange={e => {
                  if (e.target.value) {onLinkSection(e.target.value)}
                }}
              >
                <option value="">🔗 Link to section...</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
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
    searchResults,
    searching,
    deepResearching,
    autoResearching,
    loading,
    error,
    addEntry,
    deleteEntry,
    updateEntry,
    setMode,
    setCitationStyle,
    importFile,
    factCheck,
    webSearch,
    deepResearch,
    autoResearch,
    clearSearch,
  } = useResearch(documentId)

  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingResultUrl, setAddingResultUrl] = useState<string | null>(null)
  const [showAutoResearch, setShowAutoResearch] = useState(false)
  const [autoResearchTopic, setAutoResearchTopic] = useState('')

  // Search handler — detects URLs vs queries
  const handleSearch = async () => {
    const q = searchQuery.trim()
    if (!q) {return}

    // URL detection → deep research directly
    if (/^https?:\/\//.test(q)) {
      await deepResearch(q)
      setSearchQuery('')
      return
    }

    await webSearch(q)
  }

  // Deep research handler
  const handleDeepResearch = async () => {
    if (!searchQuery.trim()) {return}
    await deepResearch(searchQuery.trim())
    setSearchQuery('')
  }

  // Add a single search result as a research entry
  const handleAddResult = async (result: WebSearchResult) => {
    setAddingResultUrl(result.url)
    await addEntry(
      result.title,
      [{ url: result.url, title: result.title, type: 'web' }],
      [result.snippet],
      [],
      [result.source],
    )
    setAddingResultUrl(null)
  }

  // Manual note handler
  const handleAddNote = async () => {
    if (!noteText.trim()) {return}
    await addEntry(noteText.trim())
    setNoteText('')
    setShowNoteForm(false)
  }

  // File import handler
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

  // Link a research entry to an outline section
  const handleLinkSection = async (entryId: string, sectionId: string) => {
    const entry = entries.find(e => e.id === entryId)
    if (!entry) {return}
    const currentLinked = entry.linkedSectionIds || []
    if (currentLinked.includes(sectionId)) {return}
    await updateEntry(entryId, { linkedSectionIds: [...currentLinked, sectionId] })
  }

  return (
    <div className="flex flex-col h-full relative min-w-0 overflow-hidden" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border min-w-0 overflow-hidden gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 m-0">
          🔬 Research Workbench
          <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {entries.length}
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              showSearchPanel ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20',
            )}
            onClick={() => {
              setShowSearchPanel(!showSearchPanel)
              setShowNoteForm(false)
              clearSearch()
            }}
          >
            🔍 Search
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-muted transition-colors"
            onClick={() => {
              setShowNoteForm(!showNoteForm)
              setShowSearchPanel(false)
            }}
          >
            ✏️ Note
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-muted transition-colors"
            onClick={handleImport}
          >
            📂 Import
          </button>
          <button
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              showAutoResearch ? 'bg-green-600 text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20',
            )}
            onClick={() => {
              setShowAutoResearch(!showAutoResearch)
              setShowSearchPanel(false)
              setShowNoteForm(false)
            }}
          >
            🤖 Auto Research
          </button>
        </div>
      </div>


      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20">
          {error}
        </div>
      )}

      {/* Auto Research Panel */}
      {showAutoResearch && (
        <div className="px-4 py-3 border-b border-border bg-green-500/5">
          <p className="text-xs text-muted-foreground mb-2 m-0">
            🤖 Enter a topic and the AI will automatically search, extract articles, summarize findings, and generate sub-topic queries for comprehensive research coverage.
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
              placeholder="e.g. gaideism, quantum computing, stoicism..."
              value={autoResearchTopic}
              onChange={e => setAutoResearchTopic(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && autoResearchTopic.trim()) {
                  autoResearch(autoResearchTopic.trim())
                  setAutoResearchTopic('')
                }
              }}
              disabled={autoResearching}
              autoFocus
            />
            <button
              className="px-4 py-2 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
              onClick={() => {
                if (autoResearchTopic.trim()) {
                  autoResearch(autoResearchTopic.trim())
                  setAutoResearchTopic('')
                }
              }}
              disabled={!autoResearchTopic.trim() || autoResearching}
            >
              {autoResearching ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Researching...
                </>
              ) : (
                '🚀 Research'
              )}
            </button>
          </div>
          {autoResearching && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Searching web, extracting articles, generating sub-topics, and summarizing with AI...
            </div>
          )}
        </div>
      )}

      {/* Search Panel */}
      {showSearchPanel && (
        <div className="px-4 py-3 border-b border-border bg-muted/30 min-w-0 overflow-hidden">
          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              placeholder="Search the web or paste a URL..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              autoFocus
            />
            <button
              className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
              onClick={handleSearch}
              disabled={!searchQuery.trim() || searching}
            >
              {searching ? (
                <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                '🔍'
              )}
              Search
            </button>
          </div>

          {/* URL detection hint */}
          {searchQuery.trim().startsWith('http') && (
            <p className="text-[0.65rem] text-muted-foreground mb-2 m-0">
              🔗 URL detected — will extract article content directly
            </p>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <h5 className="text-xs font-semibold text-muted-foreground m-0">
                  {searchResults.length} results found
                </h5>
                <button className="text-[0.65rem] text-muted-foreground hover:text-foreground" onClick={clearSearch}>
                  Clear
                </button>
              </div>
              {searchResults.map((result, i) => (
                <SearchResultCard
                  key={`${result.url}-${i}`}
                  result={result}
                  onAdd={() => handleAddResult(result)}
                  adding={addingResultUrl === result.url}
                />
              ))}
              <button
                className="w-full px-4 py-2.5 text-xs font-semibold rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-40 mt-2"
                onClick={handleDeepResearch}
                disabled={deepResearching}
              >
                {deepResearching ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Extracting articles & summarizing with AI...
                  </span>
                ) : (
                  '🔬 Deep Research — Extract & Summarize All'
                )}
              </button>
            </div>
          )}

          {/* No results state */}
          {searchResults.length === 0 && !searching && searchQuery.trim() && (
            <p className="text-xs text-muted-foreground text-center py-2 m-0">
              Press Enter or click Search to find results
            </p>
          )}
        </div>
      )}

      {/* Manual Note Form */}
      {showNoteForm && (
        <div className="flex gap-2 px-4 py-3 border-b border-border">
          <input
            className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            placeholder="Add a research note..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
            autoFocus
          />
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
            onClick={handleAddNote}
            disabled={!noteText.trim()}
          >
            Add
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setShowNoteForm(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Fact Check Panel */}
      {factCheckResult && (
        <div className="px-4 pt-3">
          <FactCheckPanel result={factCheckResult} />
        </div>
      )}

      {/* Research Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-w-0">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-3xl mb-3">📚</span>
            <p className="text-sm font-medium m-0 mb-1">No research entries yet</p>
            <p className="text-xs text-muted-foreground/70 m-0 text-center max-w-[240px]">
              Use 🔍 Search to find web sources, ✏️ Note to add manual research, or 📂 Import to add files.
            </p>
          </div>
        ) : (
          entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              onDelete={() => deleteEntry(entry.id)}
              sections={sections}
              onLinkSection={sectionId => handleLinkSection(entry.id, sectionId)}
            />
          ))
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

export default ResearchWorkbench

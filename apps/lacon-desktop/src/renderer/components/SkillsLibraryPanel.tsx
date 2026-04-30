/**
 * SkillsLibraryPanel — Professional skills management UI
 *
 * Grid view with cards, detail view, composer bar, and create dialog.
 * Integrates with useSkills hook for all IPC operations.
 */

import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Filter,
  Layers,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import React, { useCallback, useState } from 'react'

import type { SkillListItem, SkillSource } from '../../shared/writer-types'
import { useSkills } from '../hooks/useSkills'
import { cn } from '../lib/utils'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ScrollArea } from './ui/ScrollArea'

interface SkillsLibraryPanelProps {
  documentId: string | undefined
}

// ── Source visual config ──
const sourceConfig: Record<SkillSource, { label: string; color: string; bg: string; icon: string }> = {
  'built-in': {
    label: 'Built-in',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    icon: '⚡',
  },
  user: {
    label: 'Custom',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    icon: '✏️',
  },
  'agent-generated': {
    label: 'AI Generated',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    icon: '🤖',
  },
}

// ── Skill icon by tags ──
function getSkillIcon(tags: string[]): string {
  const t = tags.map(s => s.toLowerCase())
  if (t.some(x => x.includes('essay') || x.includes('academic'))) return '📝'
  if (t.some(x => x.includes('story') || x.includes('fiction') || x.includes('creative'))) return '📖'
  if (t.some(x => x.includes('script') || x.includes('screen'))) return '🎬'
  if (t.some(x => x.includes('newsletter') || x.includes('email'))) return '📧'
  if (t.some(x => x.includes('blog'))) return '📰'
  if (t.some(x => x.includes('technical'))) return '⚙️'
  return '✨'
}

export function SkillsLibraryPanel({ documentId }: SkillsLibraryPanelProps) {
  const skills = useSkills(documentId)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSourceFilter, setShowSourceFilter] = useState(false)

  const handleBack = useCallback(() => {
    skills.selectSkill(null)
  }, [skills])

  // ── Detail View ──
  if (skills.selectedSkill) {
    const sk = skills.selectedSkill
    const src = sourceConfig[sk.source]
    const isActive = skills.activeSkillIds.includes(sk.id)

    return (
      <div className="flex flex-col h-full" id="skills-detail-view">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card/50">
          <button
            onClick={handleBack}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold truncate flex-1">{sk.name}</span>
          <Button
            size="sm"
            onClick={() => skills.toggleSkill(sk.id)}
            className={cn(
              'h-7 px-3 text-xs gap-1.5 transition-all duration-200',
              isActive
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
          >
            {isActive ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {isActive ? 'Active' : 'Activate'}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', src.bg, src.color)}>
                {src.icon} {src.label}
              </span>
              {sk.tags.map(tag => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Description */}
            <div className="p-3 rounded-lg bg-secondary/30 border border-border">
              <p className="text-sm text-foreground/90 leading-relaxed m-0">{sk.description}</p>
            </div>

            {/* Rubric */}
            {sk.rubric && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Zap className="h-3 w-3" /> Evaluation Rubric
                </h4>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-foreground/80 leading-relaxed m-0">{sk.rubric}</p>
                </div>
              </div>
            )}

            {/* Content */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" /> Skill Rules
              </h4>
              <div className="rounded-lg border border-border bg-card p-4 prose-skill">
                <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans m-0 break-words">
                  {sk.content}
                </pre>
              </div>
            </div>

            {/* Timestamps */}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 pt-2 border-t border-border/50">
              <span>Created: {new Date(sk.createdAt).toLocaleDateString()}</span>
              <span>Updated: {new Date(sk.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ── Grid View ──
  return (
    <div className="flex flex-col h-full" id="skills-library-panel">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold">Skills Library</span>
          <Badge variant="secondary" className="text-[10px] h-5">
            {skills.skills.length}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="h-7 px-2.5 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="px-3 py-2 flex gap-2 border-b border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search skills..."
            value={skills.searchQuery}
            onChange={e => skills.searchSkills(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm bg-secondary/50 border border-border rounded-md outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSourceFilter(!showSourceFilter)}
            className={cn(
              'h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-border text-xs transition-colors',
              skills.sourceFilter !== 'all'
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-secondary/50 text-muted-foreground hover:text-foreground',
            )}
          >
            <Filter className="h-3 w-3" />
            <ChevronDown className="h-3 w-3" />
          </button>
          {showSourceFilter && (
            <div className="absolute right-0 top-9 z-50 min-w-[140px] bg-popover border border-border rounded-lg shadow-lg py-1 animate-fade-in">
              {(['all', 'built-in', 'user', 'agent-generated'] as const).map(src => (
                <button
                  key={src}
                  onClick={() => {
                    skills.filterBySource(src)
                    setShowSourceFilter(false)
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs transition-colors',
                    skills.sourceFilter === src
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-secondary/80 text-foreground',
                  )}
                >
                  {src === 'all' ? '🌐 All Sources' : `${sourceConfig[src].icon} ${sourceConfig[src].label}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {skills.error && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-center justify-between">
          <span>{skills.error}</span>
          <button onClick={() => skills.loadSkills()} className="text-[10px] underline">
            Retry
          </button>
        </div>
      )}

      {/* Skills Grid */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {skills.loading && skills.filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
              <span className="text-xs text-muted-foreground">Loading skills...</span>
            </div>
          ) : skills.filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/10 to-orange-500/10 flex items-center justify-center mb-4">
                <Sparkles className="h-7 w-7 text-amber-500/60" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No skills found</p>
              <p className="text-xs text-muted-foreground">
                {skills.searchQuery
                  ? 'Try a different search term'
                  : 'Create your first custom skill'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {skills.filteredSkills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isActive={skills.activeSkillIds.includes(skill.id)}
                  onSelect={() => skills.selectSkill(skill.id)}
                  onToggle={() => skills.toggleSkill(skill.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Composer Bar */}
      {skills.activeSkillIds.length > 0 && (
        <ComposerBar
          activeSkillIds={skills.activeSkillIds}
          allSkills={skills.skills}
          composedSkill={skills.composedSkill}
          onDeactivate={skills.deactivateSkill}
        />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateSkillDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={async params => {
            const result = await skills.createSkill(params)
            if (result) setShowCreateDialog(false)
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────── Skill Card ───────────────────────────

interface SkillCardProps {
  skill: SkillListItem
  isActive: boolean
  onSelect: () => void
  onToggle: () => void
}

function SkillCard({ skill, isActive, onSelect, onToggle }: SkillCardProps) {
  const src = sourceConfig[skill.source]
  const icon = getSkillIcon(skill.tags)

  return (
    <div
      className={cn(
        'group relative rounded-xl border p-3.5 cursor-pointer transition-all duration-200',
        isActive
          ? 'border-primary/40 bg-primary/5 shadow-[0_0_15px_-3px] shadow-primary/10'
          : 'border-border/60 bg-card hover:border-border hover:bg-card/80 hover:shadow-md',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-transform duration-200 group-hover:scale-110',
            isActive
              ? 'bg-primary/15'
              : 'bg-secondary/80',
          )}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground truncate">{skill.name}</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0', src.bg, src.color)}>
              {src.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 m-0">
            {skill.description}
          </p>
          {skill.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              <Tag className="h-2.5 w-2.5 text-muted-foreground/40" />
              {skill.tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {skill.tags.length > 4 && (
                <span className="text-[9px] text-muted-foreground/50">+{skill.tags.length - 4}</span>
              )}
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={e => {
            e.stopPropagation()
            onToggle()
          }}
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
          title={isActive ? 'Deactivate skill' : 'Activate skill'}
        >
          {isActive ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      {/* Active indicator bar */}
      {isActive && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary" />
      )}
    </div>
  )
}

// ─────────────────────────── Composer Bar ───────────────────────────

interface ComposerBarProps {
  activeSkillIds: string[]
  allSkills: SkillListItem[]
  composedSkill: any
  onDeactivate: (id: string) => void
}

function ComposerBar({ activeSkillIds, allSkills, onDeactivate }: ComposerBarProps) {
  const activeSkills = activeSkillIds
    .map(id => allSkills.find(s => s.id === id))
    .filter(Boolean) as SkillListItem[]

  return (
    <div className="border-t border-border bg-card/90 backdrop-blur-sm px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Active Composition
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          ({activeSkillIds.length}/3)
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {activeSkills.map((skill, i) => (
          <div
            key={skill.id}
            className={cn(
              'flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg border text-xs transition-all',
              i === 0
                ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                : 'bg-secondary/60 border-border text-foreground/80',
            )}
          >
            {i === 0 && (
              <span className="text-[8px] font-bold uppercase tracking-wider opacity-60 mr-0.5">
                Primary
              </span>
            )}
            <span className="truncate max-w-[100px]">{skill.name}</span>
            <button
              onClick={() => onDeactivate(skill.id)}
              className="h-4 w-4 rounded flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────── Create Skill Dialog ───────────────────────────

interface CreateSkillDialogProps {
  onClose: () => void
  onCreate: (params: {
    name: string
    description: string
    content: string
    tags: string[]
    rubric?: string
  }) => Promise<void>
}

function CreateSkillDialog({ onClose, onCreate }: CreateSkillDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [rubric, setRubric] = useState('')
  const [loading, setLoading] = useState(false)

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring transition-all'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !content.trim()) return
    setLoading(true)
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        content: content.trim(),
        tags: tagsStr
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
        rubric: rubric.trim() || undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold m-0 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Create Writing Skill
          </h3>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Skill Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Blog Post Writing"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short description for the library"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Skill Rules (Markdown) *
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={"# Structure Rules\n\n1. Always include an introduction\n2. Use clear headings\n3. End with a conclusion"}
              required
              rows={8}
              className={cn(inputCls, 'resize-y min-h-[120px] font-mono text-xs')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={e => setTagsStr(e.target.value)}
              placeholder="blog, informal, marketing"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Evaluation Rubric (optional)
            </label>
            <input
              type="text"
              value={rubric}
              onChange={e => setRubric(e.target.value)}
              placeholder="Criteria for quality evaluation"
              className={inputCls}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !content.trim()}>
              {loading ? 'Creating...' : 'Create Skill'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

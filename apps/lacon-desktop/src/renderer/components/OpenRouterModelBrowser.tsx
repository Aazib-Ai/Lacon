/**
 * OpenRouter Model Browser — searchable model picker with filters & pricing.
 * Used inside ProviderSettings for both "Add Provider" and "Model" tab.
 */

import { Eye, Loader2, Search, Sparkles, Wrench } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import type { OpenRouterModelCategory, OpenRouterModelInfo } from '../../shared/provider-types'
import { cn } from '../lib/utils'
import { Badge } from './ui/Badge'

interface OpenRouterModelBrowserProps {
  /** Currently selected model ID */
  selectedModelId?: string
  /** Called when user picks a model */
  onSelectModel: (model: OpenRouterModelInfo) => void
  /** Optional: pre-fetched models (skips IPC call) */
  models?: OpenRouterModelInfo[]
  /** Optional: specific provider ID to fetch models for */
  providerId?: string
  /** Compact mode for inline usage */
  compact?: boolean
}

const CATEGORIES: { id: OpenRouterModelCategory; label: string }[] = [
  { id: 'popular', label: '⭐ Popular' },
  { id: 'free', label: '🆓 Free' },
  { id: 'gpt', label: 'GPT' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'open-source', label: '🔓 Open' },
  { id: 'all', label: 'All' },
]

type SortMode = 'name' | 'price-asc' | 'price-desc' | 'context'

function formatCtx(ctx: number): string {
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`
  if (ctx >= 1000) return `${Math.round(ctx / 1000)}K`
  return String(ctx)
}

function formatPrice(p: number): string {
  if (p === 0) return 'Free'
  if (p < 0.01) return '<$0.01'
  return `$${p.toFixed(2)}`
}

export const OpenRouterModelBrowser: React.FC<OpenRouterModelBrowserProps> = ({
  selectedModelId,
  onSelectModel,
  models: externalModels,
  providerId,
  compact = false,
}) => {
  const [models, setModels] = useState<OpenRouterModelInfo[]>(externalModels || [])
  const [loading, setLoading] = useState(!externalModels)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<OpenRouterModelCategory>('popular')
  const [sort, setSort] = useState<SortMode>('name')

  const fetchModels = useCallback(async () => {
    if (externalModels) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.electron.provider.fetchOpenRouterModels(providerId)
      if (result?.success && result.data) {
        setModels(result.data)
      } else {
        setError(result?.error?.message || 'Failed to load models')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load models')
    } finally {
      setLoading(false)
    }
  }, [externalModels, providerId])

  useEffect(() => { fetchModels() }, [fetchModels])
  useEffect(() => { if (externalModels) setModels(externalModels) }, [externalModels])

  const filtered = useMemo(() => {
    let list = models
    // Category filter
    if (category !== 'all') {
      list = list.filter(m => m.categories?.includes(category))
    }
    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    }
    // Sort
    switch (sort) {
      case 'price-asc':
        list = [...list].sort((a, b) => (a.pricing?.promptPer1M ?? 0) - (b.pricing?.promptPer1M ?? 0))
        break
      case 'price-desc':
        list = [...list].sort((a, b) => (b.pricing?.promptPer1M ?? 0) - (a.pricing?.promptPer1M ?? 0))
        break
      case 'context':
        list = [...list].sort((a, b) => b.contextWindow - a.contextWindow)
        break
      default:
        list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [models, category, search, sort])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-xs">Loading models from OpenRouter...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-destructive mb-2">{error}</p>
        <button type="button" onClick={fetchModels} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search models..."
          className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map(c => (
          <button
            type="button"
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'px-2 py-1 text-[10px] font-medium rounded-md transition-all',
              category === c.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      {!compact && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Sort:</span>
          {(['name', 'price-asc', 'price-desc', 'context'] as SortMode[]).map(s => (
            <button
              type="button"
              key={s}
              onClick={() => setSort(s)}
              className={cn('px-1.5 py-0.5 rounded', sort === s ? 'bg-muted text-foreground font-medium' : 'hover:text-foreground')}
            >
              {s === 'name' ? 'A–Z' : s === 'price-asc' ? '$ ↑' : s === 'price-desc' ? '$ ↓' : 'Ctx'}
            </button>
          ))}
          <span className="ml-auto">{filtered.length} models</span>
        </div>
      )}

      {/* Model list */}
      <div className={cn('flex flex-col gap-1 overflow-y-auto', compact ? 'max-h-48' : 'max-h-64')}>
        {filtered.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">No models match your search.</div>
        )}
        {filtered.map(model => {
          const isSelected = model.id === selectedModelId
          return (
            <button
              type="button"
              key={model.id}
              onClick={() => onSelectModel(model)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg border transition-all group',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border hover:bg-muted/50 hover:border-border/80',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-xs font-medium truncate', isSelected && 'text-primary')}>
                  {model.name}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {model.isFree && <Badge variant="success" className="text-[9px] px-1.5 py-0">Free</Badge>}
                  {model.supportsTools && <Wrench className="h-3 w-3 text-muted-foreground opacity-50" />}
                  {model.supportsVision && <Eye className="h-3 w-3 text-muted-foreground opacity-50" />}
                  {model.supportsStreaming && <Sparkles className="h-3 w-3 text-muted-foreground opacity-50" />}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span className="font-mono">{model.id}</span>
                <span>·</span>
                <span>{formatCtx(model.contextWindow)} ctx</span>
                <span>·</span>
                <span>
                  {formatPrice(model.pricing?.promptPer1M ?? 0)}/{formatPrice(model.pricing?.completionPer1M ?? 0)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

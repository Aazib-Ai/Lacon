/**
 * SlidesGeneratorDialog — Configuration modal for AI slide generation.
 *
 * Follows the same design patterns as NewDocumentDialog and CreateSkillDialog:
 * - Tailwind utility classes with design system tokens
 * - bg-card, border-border, text-foreground etc.
 * - Button component for actions
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Presentation,
  X,
  Sparkles,
  MessageSquare,
  FileText,
} from 'lucide-react'

import type { SlideDeck, SlideTheme } from '../../shared/slides-types'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'

// ────────────────────────────────────────────────────────────────────

interface SlidesGeneratorDialogProps {
  open: boolean
  onClose: () => void
  documentTitle: string
  documentContent: string
  documentId: string
  onGenerated: (deck: SlideDeck) => void
}

const SLIDE_COUNT_OPTIONS = [
  { value: 0, label: 'Auto' },
  { value: 5, label: '5 slides' },
  { value: 8, label: '8 slides' },
  { value: 10, label: '10 slides' },
  { value: 15, label: '15 slides' },
]

const THEME_OPTIONS: { value: SlideTheme; label: string; colors: { bg: string; accent: string; text: string } }[] = [
  { value: 'dark', label: 'Dark', colors: { bg: 'bg-slate-900', accent: 'bg-indigo-500', text: 'text-slate-300' } },
  { value: 'light', label: 'Light', colors: { bg: 'bg-white', accent: 'bg-blue-500', text: 'text-slate-700' } },
  { value: 'corporate', label: 'Corporate', colors: { bg: 'bg-stone-50', accent: 'bg-teal-500', text: 'text-stone-600' } },
]

export function SlidesGeneratorDialog({
  open,
  onClose,
  documentTitle,
  documentContent,
  documentId,
  onGenerated,
}: SlidesGeneratorDialogProps) {
  const [slideCount, setSlideCount] = useState(0)
  const [theme, setTheme] = useState<SlideTheme>('dark')
  const [includeNotes, setIncludeNotes] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const wordCount = documentContent.split(/\s+/).filter(Boolean).length

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, loading, onClose])

  // Reset state on open
  useEffect(() => {
    if (open) {
      setError(null)
      setLoading(false)
    }
  }, [open])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current && !loading) onClose()
    },
    [onClose, loading],
  )

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const electron = (window as any).electron
      const result = await electron.slides.generate({
        documentId,
        documentContent,
        documentTitle,
        slideCount,
        theme,
        includeNotes,
      })

      if (result?.success && result.data?.deck) {
        onGenerated(result.data.deck)
        onClose()
      } else {
        setError(result?.error?.message || 'Failed to generate slides. Please try again.')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [documentId, documentContent, documentTitle, slideCount, theme, includeNotes, onGenerated, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleOverlayClick}
      data-testid="slides-dialog-overlay"
    >
      <div
        className={cn(
          'bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-slide-in-up',
          'w-full max-w-lg mx-4 flex flex-col',
        )}
        data-testid="slides-dialog"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Presentation className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create Presentation</h2>
              <p className="text-xs text-muted-foreground">
                Transform your document into slides
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={loading}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          /* ─── Loading State ─── */
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-foreground mb-1">Generating your slides...</p>
            <p className="text-xs text-muted-foreground">
              Analyzing {wordCount.toLocaleString()} words and crafting {slideCount || 'optimal'} slides
            </p>
          </div>
        ) : (
          <>
            {/* ─── Body ─── */}
            <div className="p-6 space-y-5">
              {/* Error */}
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}

              {/* Slide Count */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Number of Slides
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SLIDE_COUNT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border',
                        slideCount === opt.value
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-secondary/50 text-secondary-foreground border-border hover:bg-secondary hover:border-border',
                      )}
                      onClick={() => setSlideCount(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {THEME_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={cn(
                        'group relative rounded-xl border-2 p-1.5 transition-all duration-200 cursor-pointer',
                        theme === opt.value
                          ? 'border-primary shadow-md shadow-primary/10'
                          : 'border-border hover:border-border/80 hover:shadow-sm',
                      )}
                      onClick={() => setTheme(opt.value)}
                    >
                      {/* Mini slide preview */}
                      <div className={cn(
                        'aspect-[16/9] rounded-lg overflow-hidden relative',
                        opt.colors.bg,
                      )}>
                        {/* Accent bar */}
                        <div className={cn(
                          'absolute top-0 left-0 right-0 h-[2px]',
                          opt.colors.accent,
                        )} />
                        {/* Fake text lines */}
                        <div className="absolute bottom-[35%] left-[12%] w-[60%] h-[3px] rounded-full opacity-30"
                          style={{ background: opt.value === 'light' ? '#334155' : '#cbd5e1' }}
                        />
                        <div className="absolute bottom-[22%] left-[12%] w-[40%] h-[3px] rounded-full opacity-20"
                          style={{ background: opt.value === 'light' ? '#334155' : '#cbd5e1' }}
                        />
                      </div>
                      <p className={cn(
                        'text-xs font-medium text-center mt-1.5',
                        theme === opt.value ? 'text-primary' : 'text-muted-foreground',
                      )}>
                        {opt.label}
                      </p>
                      {/* Active checkmark */}
                      {theme === opt.value && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speaker Notes Toggle */}
              <div
                className="flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setIncludeNotes(!includeNotes)}
              >
                <div className={cn(
                  'w-9 h-5 rounded-full relative transition-colors duration-200',
                  includeNotes ? 'bg-primary' : 'bg-secondary',
                )}>
                  <div className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                    includeNotes ? 'translate-x-4' : 'translate-x-0.5',
                  )} />
                </div>
                <span className="text-sm text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  Include speaker notes
                </span>
              </div>
            </div>

            {/* ─── Footer ─── */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/20">
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">{documentTitle}</strong> · {wordCount.toLocaleString()} words
              </div>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={wordCount < 10}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate Slides
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

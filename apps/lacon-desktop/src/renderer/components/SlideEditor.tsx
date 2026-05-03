/**
 * SlideEditor — Full-page slide editing experience.
 * Takes over the main editor area with: thumbnail strip | 16:9 preview | property panel
 */

import React, { useState, useCallback, useEffect } from 'react'
import { Presentation, Download, Plus, Trash2, ChevronLeft, Sparkles, ArrowUp, ArrowDown, X } from 'lucide-react'
import type { SlideDeck, SlideData, SlideLayout, SlideTheme } from '../../shared/slides-types'
import { SLIDE_CONSTRAINTS } from '../../shared/slides-types'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'

interface SlideEditorProps {
  deck: SlideDeck | null
  documentId: string
  onDeckChange: (deck: SlideDeck) => void
  onRequestGenerate: () => void
  onClose: () => void
}

const LAYOUTS: Record<SlideLayout, string> = { title: 'Title', content: 'Content', section: 'Section', 'two-column': '2-Column', closing: 'Closing' }
const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring transition-all'

export function SlideEditor({ deck, documentId, onDeckChange, onRequestGenerate, onClose }: SlideEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const selected = deck?.slides.find(s => s.id === selectedId) || deck?.slides[0] || null

  useEffect(() => { if (deck?.slides.length && !selectedId) setSelectedId(deck.slides[0].id) }, [deck])

  useEffect(() => {
    if (!deck || !documentId) return
    const t = setTimeout(async () => {
      try { setSaving(true); await (window as any).electron.slides.save({ documentId, deck }) } catch { /* auto-save silent */ } finally { setSaving(false) }
    }, 2000)
    return () => clearTimeout(t)
  }, [deck, documentId])

  const handleExport = useCallback(async () => {
    if (!deck) return
    try { setExporting(true); await (window as any).electron.slides.exportPptx({ deck, outputFileName: deck.source.documentTitle || 'presentation' }) }
    catch (e: any) { if (!e.message?.includes('cancelled')) console.error(e) }
    finally { setExporting(false) }
  }, [deck])

  const updateSlide = useCallback((id: string, u: Partial<SlideData>) => {
    if (!deck) return
    onDeckChange({ ...deck, slides: deck.slides.map(s => s.id === id ? { ...s, ...u } : s) })
  }, [deck, onDeckChange])

  const updateBullet = useCallback((id: string, bi: number, v: string, col: 'left'|'right' = 'left') => {
    if (!deck) return
    onDeckChange({ ...deck, slides: deck.slides.map(s => {
      if (s.id !== id) return s
      const key = col === 'right' ? 'bulletsRight' : 'bullets'
      const b = [...(col === 'right' ? (s.bulletsRight || []) : s.bullets)]
      b[bi] = v.slice(0, SLIDE_CONSTRAINTS.MAX_BULLET_CHARS)
      return { ...s, [key]: b }
    })})
  }, [deck, onDeckChange])

  const addBullet = useCallback((id: string, col: 'left'|'right' = 'left') => {
    if (!deck) return
    onDeckChange({ ...deck, slides: deck.slides.map(s => {
      if (s.id !== id) return s
      const b = col === 'right' ? (s.bulletsRight || []) : s.bullets
      if (b.length >= SLIDE_CONSTRAINTS.MAX_BULLETS) return s
      return col === 'right' ? { ...s, bulletsRight: [...b, ''] } : { ...s, bullets: [...b, ''] }
    })})
  }, [deck, onDeckChange])

  const removeBullet = useCallback((id: string, bi: number, col: 'left'|'right' = 'left') => {
    if (!deck) return
    onDeckChange({ ...deck, slides: deck.slides.map(s => {
      if (s.id !== id) return s
      const b = [...(col === 'right' ? (s.bulletsRight || []) : s.bullets)]
      b.splice(bi, 1)
      return col === 'right' ? { ...s, bulletsRight: b } : { ...s, bullets: b }
    })})
  }, [deck, onDeckChange])

  const removeSlide = useCallback((id: string) => {
    if (!deck || deck.slides.length <= 1) return
    const filtered = deck.slides.filter(s => s.id !== id).map((s, i) => ({ ...s, slideNumber: i + 1 }))
    onDeckChange({ ...deck, slides: filtered })
    if (selectedId === id) setSelectedId(filtered[0]?.id || null)
  }, [deck, onDeckChange, selectedId])

  const addSlide = useCallback((afterIdx: number) => {
    if (!deck) return
    const ns: SlideData = { id: `slide-${Date.now()}`, slideNumber: afterIdx + 2, layout: 'content', title: 'New Slide', bullets: [''] }
    const slides = [...deck.slides]; slides.splice(afterIdx + 1, 0, ns)
    slides.forEach((s, i) => { s.slideNumber = i + 1 })
    onDeckChange({ ...deck, slides })
    setSelectedId(ns.id)
  }, [deck, onDeckChange])

  const moveSlide = useCallback((id: string, dir: 'up'|'down') => {
    if (!deck) return
    const idx = deck.slides.findIndex(s => s.id === id); if (idx < 0) return
    const ni = dir === 'up' ? idx - 1 : idx + 1; if (ni < 0 || ni >= deck.slides.length) return
    const slides = [...deck.slides]; [slides[idx], slides[ni]] = [slides[ni], slides[idx]]
    slides.forEach((s, i) => { s.slideNumber = i + 1 })
    onDeckChange({ ...deck, slides })
  }, [deck, onDeckChange])

  // Empty state
  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-400/10 to-purple-500/10 flex items-center justify-center mb-6">
          <Presentation className="h-10 w-10 text-violet-500/60" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No Slides Yet</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">Generate a presentation from your document using AI.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="gap-1.5"><ChevronLeft className="h-3.5 w-3.5" /> Back to Editor</Button>
          <Button onClick={onRequestGenerate} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Sparkles className="h-3.5 w-3.5" /> Create Presentation</Button>
        </div>
      </div>
    )
  }

  const selectedIdx = deck.slides.findIndex(s => s.id === selected?.id)

  return (
    <div className="flex flex-col h-full bg-secondary/20">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 h-8 text-xs">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Editor
          </Button>
          <div className="w-px h-5 bg-border" />
          <Presentation className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">{deck.source.documentTitle || 'Presentation'}</span>
          <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{deck.slides.length} slides</span>
          {saving && <span className="text-[10px] text-muted-foreground italic">Saving...</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onRequestGenerate} className="h-8 text-xs gap-1.5"><Sparkles className="h-3 w-3" /> Regenerate</Button>
          <Button size="sm" onClick={handleExport} disabled={exporting} className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="h-3 w-3" /> {exporting ? 'Exporting...' : 'Export PPTX'}
          </Button>
        </div>
      </div>

      {/* ── Main Area: Thumbnails | Preview | Properties ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Thumbnail Strip */}
        <div className="w-[180px] flex-shrink-0 border-r border-border bg-card/50 overflow-y-auto p-2 space-y-1.5">
          {deck.slides.map((slide, i) => (
            <button key={slide.id} onClick={() => setSelectedId(slide.id)}
              className={cn('w-full rounded-lg overflow-hidden border-2 transition-all group', slide.id === selected?.id ? 'border-primary shadow-md shadow-primary/10' : 'border-transparent hover:border-border')}>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary/50">
                <span className="text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                <span className="text-[9px] text-foreground truncate flex-1">{slide.title.slice(0, 20)}</span>
              </div>
              <div className={cn('w-full relative', slide.id === selected?.id ? 'ring-0' : '')}
                style={{ aspectRatio: '16/9' }}>
                <div className={cn('absolute inset-0', deck.theme === 'dark' ? 'bg-slate-900 text-slate-200' : deck.theme === 'corporate' ? 'bg-stone-50 text-stone-700' : 'bg-white text-slate-800')}>
                  <ThumbPreview slide={slide} theme={deck.theme} />
                </div>
              </div>
            </button>
          ))}
          <button onClick={() => addSlide(deck.slides.length - 1)}
            className="w-full rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 py-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
            <Plus className="h-3 w-3" /> Add Slide
          </button>
        </div>

        {/* Center: Large 16:9 Preview */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          {selected && (
            <div className="w-full max-w-[800px]">
              <div className={cn('w-full rounded-xl shadow-2xl overflow-hidden relative',
                deck.theme === 'dark' ? 'bg-slate-900 text-slate-100' : deck.theme === 'corporate' ? 'bg-stone-50 text-stone-800' : 'bg-white text-slate-800',
              )} style={{ aspectRatio: '16/9' }}>
                <LargePreview slide={selected} theme={deck.theme} />
              </div>
              <div className="flex items-center justify-center gap-1 mt-3">
                <span className="text-xs text-muted-foreground">Slide {selected.slideNumber} of {deck.slides.length}</span>
                <span className="text-xs text-muted-foreground/50 mx-1">·</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{LAYOUTS[selected.layout]}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Properties Panel */}
        {selected && (
          <div className="w-[300px] flex-shrink-0 border-l border-border bg-card overflow-y-auto">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Slide {selected.slideNumber}</h3>
              <p className="text-[10px] text-muted-foreground">Edit slide properties</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Layout */}
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Layout</label>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(LAYOUTS) as SlideLayout[]).map(l => (
                    <button key={l} onClick={() => {
                      const u: Partial<SlideData> = { layout: l }
                      if (l === 'two-column' && !selected.bulletsRight?.length) u.bulletsRight = ['']
                      updateSlide(selected.id, u)
                    }} className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                      selected.layout === l ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/50 text-secondary-foreground border-border hover:bg-secondary'
                    )}>{LAYOUTS[l]}</button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Title <span className="text-muted-foreground/50">({selected.title.length}/{SLIDE_CONSTRAINTS.MAX_TITLE_CHARS})</span>
                </label>
                <input className={inputCls} value={selected.title}
                  onChange={e => updateSlide(selected.id, { title: e.target.value.slice(0, SLIDE_CONSTRAINTS.MAX_TITLE_CHARS) })} />
              </div>

              {/* Subtitle */}
              {['title', 'section', 'closing'].includes(selected.layout) && (
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Subtitle</label>
                  <input className={inputCls} value={selected.subtitle || ''}
                    onChange={e => updateSlide(selected.id, { subtitle: e.target.value.slice(0, SLIDE_CONSTRAINTS.MAX_SUBTITLE_CHARS) })} placeholder="Optional subtitle" />
                </div>
              )}

              {/* Bullets */}
              {['content', 'two-column', 'closing'].includes(selected.layout) && (
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    {selected.layout === 'two-column' ? 'Left Column' : 'Bullet Points'} ({selected.bullets.length}/{SLIDE_CONSTRAINTS.MAX_BULLETS})
                  </label>
                  <BulletList bullets={selected.bullets} onUpdate={(i, v) => updateBullet(selected.id, i, v, 'left')}
                    onAdd={() => addBullet(selected.id, 'left')} onRemove={i => removeBullet(selected.id, i, 'left')} />
                </div>
              )}

              {selected.layout === 'two-column' && (
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Right Column ({(selected.bulletsRight || []).length}/{SLIDE_CONSTRAINTS.MAX_BULLETS})
                  </label>
                  <BulletList bullets={selected.bulletsRight || []} onUpdate={(i, v) => updateBullet(selected.id, i, v, 'right')}
                    onAdd={() => addBullet(selected.id, 'right')} onRemove={i => removeBullet(selected.id, i, 'right')} />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Speaker Notes</label>
                <textarea className={cn(inputCls, 'resize-y min-h-[60px]')} rows={3} value={selected.notes || ''}
                  onChange={e => updateSlide(selected.id, { notes: e.target.value.slice(0, SLIDE_CONSTRAINTS.MAX_NOTES_CHARS) })} placeholder="Speaker notes..." />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border space-y-1.5">
                <div className="flex gap-1.5">
                  {selectedIdx > 0 && <Button variant="ghost" size="sm" onClick={() => moveSlide(selected.id, 'up')} className="h-7 text-[11px] gap-1 flex-1"><ArrowUp className="h-3 w-3" /> Up</Button>}
                  {selectedIdx < deck.slides.length - 1 && <Button variant="ghost" size="sm" onClick={() => moveSlide(selected.id, 'down')} className="h-7 text-[11px] gap-1 flex-1"><ArrowDown className="h-3 w-3" /> Down</Button>}
                </div>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => addSlide(selectedIdx)} className="h-7 text-[11px] gap-1 flex-1"><Plus className="h-3 w-3" /> Add Below</Button>
                  {deck.slides.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeSlide(selected.id)} className="h-7 text-[11px] gap-1 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── BulletList ──
function BulletList({ bullets, onUpdate, onAdd, onRemove }: {
  bullets: string[]; onUpdate: (i: number, v: string) => void; onAdd: () => void; onRemove: (i: number) => void
}) {
  return (
    <div className="space-y-1.5">
      {bullets.map((b, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
          <input className={cn(inputCls, 'flex-1 text-xs py-1.5')} value={b} onChange={e => onUpdate(i, e.target.value)} placeholder={`Point ${i + 1}`} />
          <button onClick={() => onRemove(i)} className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {bullets.length < SLIDE_CONSTRAINTS.MAX_BULLETS && (
        <button onClick={onAdd} className="text-[11px] text-primary/70 hover:text-primary font-medium px-1 py-0.5 transition-colors">+ Add point</button>
      )}
    </div>
  )
}

// ── Thumbnail Preview ──
function ThumbPreview({ slide, theme }: { slide: SlideData; theme: SlideTheme }) {
  const ac = theme === 'corporate' ? '#0d9488' : '#6366f1'
  const ts: React.CSSProperties = { fontSize: '0.35rem', fontWeight: 700, lineHeight: 1.2 }
  const bs: React.CSSProperties = { fontSize: '0.2rem', opacity: 0.6, margin: 0, paddingLeft: 6, listStyle: 'disc' }

  if (slide.layout === 'title') return (<>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: ac }} />
    <div style={{ position: 'absolute', bottom: '22%', left: '8%', right: '8%' }}>
      <div style={ts}>{slide.title}</div>
      {slide.subtitle && <div style={{ fontSize: '0.2rem', opacity: 0.5, marginTop: 1 }}>{slide.subtitle}</div>}
    </div>
  </>)
  if (slide.layout === 'section') return (
    <div style={{ position: 'absolute', left: '10%', top: '35%', right: '8%' }}>
      <div style={ts}>{slide.title}</div>
    </div>
  )
  return (<>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: ac }} />
    <div style={{ padding: '6% 6%' }}>
      <div style={ts}>{slide.title}</div>
      <ul style={bs}>{slide.bullets.slice(0, 3).map((b, i) => <li key={i}>{b.slice(0, 20)}</li>)}</ul>
    </div>
  </>)
}

// ── Large Preview ──
function LargePreview({ slide, theme }: { slide: SlideData; theme: SlideTheme }) {
  const ac = theme === 'corporate' ? '#0d9488' : '#6366f1'
  const titleStyle: React.CSSProperties = { fontSize: 'clamp(1rem, 2.5vw, 1.75rem)', fontWeight: 700, lineHeight: 1.3 }
  const subStyle: React.CSSProperties = { fontSize: 'clamp(0.65rem, 1.2vw, 0.9rem)', opacity: 0.6, marginTop: 8 }
  const bulletStyle: React.CSSProperties = { fontSize: 'clamp(0.6rem, 1.1vw, 0.85rem)', opacity: 0.8, margin: 0, paddingLeft: 24, listStyle: 'disc', lineHeight: 1.8 }

  switch (slide.layout) {
    case 'title': return (<>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ac }} />
      <div style={{ position: 'absolute', bottom: '18%', left: '8%', right: '8%' }}>
        <div style={titleStyle}>{slide.title}</div>
        {slide.subtitle && <div style={subStyle}>{slide.subtitle}</div>}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, background: ac }} />
    </>)
    case 'section': return (<>
      <div style={{ position: 'absolute', left: '6%', top: '40%', width: 12, height: 12, borderRadius: 3, background: ac }} />
      <div style={{ position: 'absolute', left: '12%', top: '36%', right: '10%' }}>
        <div style={titleStyle}>{slide.title}</div>
        {slide.subtitle && <div style={subStyle}>{slide.subtitle}</div>}
      </div>
    </>)
    case 'closing': return (<>
      <div style={{ position: 'absolute', top: '28%', width: '100%', textAlign: 'center', padding: '0 12%' }}>
        <div style={titleStyle}>{slide.title}</div>
        {slide.subtitle && <div style={subStyle}>{slide.subtitle}</div>}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, background: ac }} />
    </>)
    case 'two-column': return (<>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ac }} />
      <div style={{ padding: '5% 6%' }}>
        <div style={{ ...titleStyle, marginBottom: 12 }}>{slide.title}</div>
        <div style={{ display: 'flex', gap: '4%' }}>
          <div style={{ flex: 1 }}><ul style={bulletStyle}>{slide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
          <div style={{ width: 1, background: 'currentColor', opacity: 0.1 }} />
          <div style={{ flex: 1 }}><ul style={bulletStyle}>{(slide.bulletsRight || []).map((b, i) => <li key={i}>{b}</li>)}</ul></div>
        </div>
      </div>
    </>)
    default: return (<>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: ac }} />
      <div style={{ padding: '4% 6% 4% 5%' }}>
        <div style={{ ...titleStyle, marginBottom: 12 }}>{slide.title}</div>
        <div style={{ width: '40%', height: 1, background: 'currentColor', opacity: 0.1, marginBottom: 12 }} />
        <ul style={bulletStyle}>{slide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      </div>
    </>)
  }
}

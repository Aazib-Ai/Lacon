/**
 * OutlineEditor — Outline CRUD + Approval
 *
 * Displays and allows editing of a WriterOutline produced by the Planner.
 * Supports section title editing, key-point management, subsection management,
 * word count estimation, and approve/regenerate/reset actions.
 */

import React, { useCallback, useState } from 'react'

import type { AutomationLevel, OutlineSection, OutlineSubsection, SectionProgress, WriterLoopStage, WriterOutline } from '../../../shared/writer-types'
import { cn } from '../../lib/utils'

// ─────────────────────────── Props ───────────────────────────

interface OutlineEditorProps {
  outline: WriterOutline | null
  stage: WriterLoopStage
  loading: boolean
  error: string | null
  errorMeta?: {
    timestamp: number
    retryable: boolean
    action: string
    retryFn: (() => void) | null
  } | null
  progress?: SectionProgress | null
  /** Agentic pre-flight steps to show during planning */
  preflightSteps?: Array<{ id: number; type: string; tool?: string; message: string; timestamp: string }>
  /** Whether pre-flight is currently running */
  preflightRunning?: boolean
  onUpdateSection: (sectionId: string, updates: Partial<OutlineSection>) => void
  onAddSection: (section?: Partial<OutlineSection>) => void
  onRemoveSection: (sectionId: string) => void
  onAddSubsection: (sectionId: string, subsection?: Partial<OutlineSubsection>) => void
  onRemoveSubsection: (sectionId: string, subsectionId: string) => void
  onApprove: () => void
  onRegenerate: (instruction: string) => void
  onReset: () => void
  onAbort?: () => void
  onClearError?: () => void
  /** Current automation level (auto vs manual) */
  automationLevel?: AutomationLevel
  /** Callback to generate a single section (manual mode) */
  onGenerateSection?: (sectionId: string) => void
  /** Controlled instruction value (lifted from parent to survive tab switches) */
  editingInstruction?: string
  /** Callback when instruction changes (controlled mode) */
  onEditingInstructionChange?: (value: string) => void
}

// ─────────────────────────── Error Banner ───────────────────────────

function ErrorBanner({
  error,
  errorMeta,
  onDismiss,
}: {
  error: string
  errorMeta?: OutlineEditorProps['errorMeta']
  onDismiss?: () => void
}) {
  const actionLabel = errorMeta?.action
    ? errorMeta.action.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Action'

  return (
    <div
      className="flex gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-in fade-in slide-in-from-top-1"
      role="alert"
      id="outline-editor-error"
    >
      <div className="text-sm flex-shrink-0 leading-none font-bold text-foreground">!</div>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="text-sm font-bold text-destructive">{actionLabel} Failed</div>
        <div className="text-sm text-destructive/80 leading-snug break-words">{error}</div>
        <div className="text-xs text-muted-foreground leading-snug">
          Check that your AI provider is configured and your API key is valid in Settings.
        </div>
        <div className="flex gap-2 mt-1">
          {errorMeta?.retryable && errorMeta?.retryFn && (
            <button
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-opacity"
              onClick={errorMeta.retryFn}
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Outline Generating View ───────────────────────────

const outlineGenMessages = [
  'Reading your prompt…',
  'Analyzing your writing goals…',
  'Selecting the best approach…',
  'Researching relevant skills…',
  'Structuring your outline…',
  'Organizing sections & key points…',
  'Estimating word counts…',
  'Finalizing your outline…',
]

const outlineGenSteps = [
  { id: 'analyze', label: 'Analyzing prompt', icon: '🔍', durationHint: 3 },
  { id: 'skills', label: 'Selecting writing skills', icon: '✨', durationHint: 6 },
  { id: 'structure', label: 'Structuring outline', icon: '📐', durationHint: 12 },
  { id: 'finalize', label: 'Finalizing sections', icon: '✅', durationHint: 20 },
]

function OutlineGeneratingView({ label, preflightSteps }: { label: string; preflightSteps?: OutlineEditorProps['preflightSteps'] }) {
  const [elapsed, setElapsed] = useState(0)
  const [messageIdx, setMessageIdx] = useState(0)

  React.useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Rotate messages every 4 seconds
  React.useEffect(() => {
    const timer = setInterval(() => {
      setMessageIdx(prev => (prev + 1) % outlineGenMessages.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const hasSteps = preflightSteps && preflightSteps.length > 0

  return (
    <div className="flex flex-col gap-0 p-6 animate-in fade-in duration-500" id="outline-editor-loading">
      {/* ── Header ── */}
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <div className="relative w-14 h-14 flex items-center justify-center">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse" />
          {/* Inner spinning ring */}
          <div className="absolute inset-1 rounded-xl border-2 border-transparent border-t-primary border-r-primary/40 animate-spin" style={{ animationDuration: '1.2s' }} />
          {/* Center icon */}
          <span className="relative text-xl z-10">📝</span>
        </div>
        <div>
          <h3 className="text-base font-bold m-0 text-foreground">Generating Your Outline</h3>
          <p
            className="text-sm text-muted-foreground m-0 mt-1 transition-opacity duration-500"
            key={messageIdx}
            style={{ animation: 'fadeInUp 0.5s ease-out' }}
          >
            {outlineGenMessages[messageIdx]}
          </p>
        </div>
      </div>

      {/* ── Step Timeline ── */}
      <div className="flex flex-col gap-0 mb-6">
        {outlineGenSteps.map((step, idx) => {
          const isActive = elapsed >= step.durationHint && elapsed < (outlineGenSteps[idx + 1]?.durationHint ?? 999)
          const isComplete = outlineGenSteps[idx + 1] ? elapsed >= outlineGenSteps[idx + 1].durationHint : false
          const isPending = elapsed < step.durationHint

          return (
            <div key={step.id} className="flex items-stretch gap-3">
              {/* Vertical connector line + dot */}
              <div className="flex flex-col items-center w-6 flex-shrink-0">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 flex-shrink-0',
                    isComplete && 'bg-primary/15 text-primary',
                    isActive && 'bg-primary/10 text-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background',
                    isPending && 'bg-muted text-muted-foreground/40',
                  )}
                >
                  {isComplete ? '✓' : isActive ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                {idx < outlineGenSteps.length - 1 && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 min-h-[16px] transition-colors duration-500',
                      isComplete ? 'bg-primary/30' : 'bg-border',
                    )}
                  />
                )}
              </div>
              {/* Step content */}
              <div
                className={cn(
                  'flex items-center gap-2 pb-3 transition-all duration-500',
                  isPending && 'opacity-40',
                  isActive && 'opacity-100',
                  isComplete && 'opacity-70',
                )}
              >
                <span className="text-sm">{step.icon}</span>
                <span className={cn(
                  'text-sm font-medium',
                  isActive && 'text-foreground',
                  isComplete && 'text-muted-foreground',
                  isPending && 'text-muted-foreground/60',
                )}>
                  {step.label}
                </span>
                {isActive && (
                  <div className="flex gap-0.5 ml-1">
                    <div className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Agentic pre-flight steps (real data from backend) ── */}
      {hasSteps && (
        <div className="flex flex-col gap-1.5 mb-5">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            AI Agent Activity
          </div>
          {preflightSteps!.map(step => (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs animate-in fade-in slide-in-from-left-2 duration-300',
                step.type === 'tool-call' && 'bg-primary/5 border border-primary/10',
                step.type === 'tool-result' && 'bg-muted/50',
                step.type === 'thinking' && 'text-muted-foreground',
                step.type === 'ready' && 'bg-green-500/5 border border-green-500/15 text-green-600',
              )}
            >
              <span className="flex-1 leading-snug">{step.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Skeleton Preview (shows what the outline will look like) ── */}
      <div className="flex flex-col gap-2 mb-5">
        <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Preview
        </div>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card/50 animate-pulse"
            style={{ animationDelay: `${i * 200}ms`, animationDuration: '1.8s' }}
          >
            <div className="w-7 h-7 rounded-lg bg-muted flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3.5 rounded-md bg-muted/80" style={{ width: `${70 - i * 12}%` }} />
              <div className="h-2.5 rounded-md bg-muted/50" style={{ width: `${50 - i * 8}%` }} />
            </div>
            <div className="w-10 h-3 rounded bg-muted/40 flex-shrink-0" />
          </div>
        ))}
      </div>

      {/* ── Footer: elapsed + tip ── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
        <span className="tabular-nums font-medium">{formatElapsedLoading(elapsed)}</span>
        <span className="text-muted-foreground/40">·</span>
        <span>
          {elapsed > 30
            ? 'This is taking longer than usual — check your provider in Settings.'
            : elapsed > 15
              ? 'Still working — complex topics take a bit longer.'
              : 'AI is crafting your document structure…'}
        </span>
      </div>
    </div>
  )
}

function formatElapsedLoading(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─────────────────────────── Stage Badge ───────────────────────────

const stageBadgeStyles: Record<string, string> = {
  'awaiting-outline-approval': 'border-border text-muted-foreground',
  generating: 'border-border text-muted-foreground',
  complete: 'border-border text-muted-foreground',
  paused: 'border-border text-muted-foreground',
}

// ─────────────────────────── Generation Progress View ───────────────────────────

const progressMessages = [
  'Crafting your content…',
  'Weaving words together…',
  'Building your narrative…',
  'Composing thoughtfully…',
  'Shaping your ideas…',
  'Polishing each paragraph…',
]

function GenerationProgressView({
  progress,
  outline,
  onAbort,
}: {
  progress: SectionProgress | null
  outline: WriterOutline
  onAbort?: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [messageIdx, setMessageIdx] = useState(0)

  React.useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Rotate motivational messages every 8 seconds
  React.useEffect(() => {
    const timer = setInterval(() => {
      setMessageIdx(prev => (prev + 1) % progressMessages.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  const completed = progress?.completedSections || 0
  const total = progress?.totalSections || outline.sections.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const currentTitle = progress?.currentSectionTitle
  const isComplete = progress?.status === 'complete'

  return (
    <div className="flex flex-col gap-5 p-6 animate-in fade-in slide-in-from-top-2 duration-300" id="generation-progress">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-muted text-foreground">
            {isComplete ? '✓' : '…'}
          </div>
          <div>
            <h3 className="text-base font-bold m-0 text-foreground">
              {isComplete ? 'Generation Complete!' : 'Writing Your Document'}
            </h3>
            <p className="text-xs text-muted-foreground m-0 mt-0.5">
              {isComplete
                ? `All ${total} sections written successfully`
                : progressMessages[messageIdx]
              }
            </p>
          </div>
        </div>
        {!isComplete && onAbort && (
          <button
            onClick={onAbort}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground border border-border hover:text-foreground hover:bg-muted transition-all"
          >
            Stop
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            {completed} of {total} sections
          </span>
          <span className="text-foreground font-bold tabular-nums">{percent}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out bg-foreground'
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Current section indicator */}
      {!isComplete && currentTitle && (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-foreground font-medium">
            Writing: {currentTitle}
          </span>
        </div>
      )}

      {/* Section list with status */}
      <div className="flex flex-col gap-1">
        {outline.sections.map((section, idx) => {
          const isCompleted = progress?.results?.some(r => r.sectionId === section.id)
          const isCurrent = progress?.currentSectionId === section.id && !isComplete
          const isPending = !isCompleted && !isCurrent

          return (
            <div
              key={section.id}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-300',
                isCurrent && 'bg-primary/8 border border-primary/20',
                isCompleted && 'opacity-80',
                isPending && 'opacity-50',
              )}
            >
              {/* Status icon */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {isCompleted && (
                  <span className="text-foreground text-sm">✓</span>
                )}
                {isCurrent && (
                  <div className="w-3.5 h-3.5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                )}
                {isPending && (
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              {/* Section info */}
              <span className={cn(
                'flex-1 font-medium',
                isCurrent && 'text-foreground',
                isCompleted && 'text-muted-foreground',
                isPending && 'text-muted-foreground',
              )}>
                {section.title}
              </span>
              <span className="text-[0.65rem] text-muted-foreground tabular-nums">
                ~{section.estimatedWords}w
              </span>
            </div>
          )
        })}
      </div>

      {/* Elapsed timer */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
        <span className="tabular-nums">{formatElapsed(elapsed)}</span>
        <span>·</span>
        <span>
          {elapsed > 60
            ? 'This may take a few minutes for longer documents'
            : elapsed > 20
              ? 'AI is writing your content…'
              : 'Starting generation…'
          }
        </span>
      </div>
    </div>
  )
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─────────────────────────── Main Component ───────────────────────────

export function OutlineEditor({
  outline,
  stage,
  loading,
  error,
  errorMeta,
  progress,
  preflightSteps,
  preflightRunning,
  onUpdateSection,
  onAddSection,
  onRemoveSection,
  onAddSubsection,
  onRemoveSubsection,
  onApprove,
  onRegenerate,
  onReset,
  onAbort,
  onClearError,
  automationLevel,
  onGenerateSection,
  editingInstruction: controlledInstruction,
  onEditingInstructionChange,
}: OutlineEditorProps) {
  // Support controlled mode (parent owns state) or local state (backward-compat)
  const [localInstruction, setLocalInstruction] = useState('')
  const editingInstruction = controlledInstruction !== undefined ? controlledInstruction : localInstruction
  const setEditingInstruction = onEditingInstructionChange || setLocalInstruction
  const isEditable = stage === 'awaiting-outline-approval'

  // ── Error State (standalone — no outline present) ──
  if (!outline && error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[280px] text-center gap-3 p-6" id="outline-editor-error-state">
        <ErrorBanner error={error} errorMeta={errorMeta} onDismiss={onClearError} />
        <div className="flex flex-col gap-2 w-full max-w-md mt-4">
          <textarea
            id="outline-instruction-input"
            className="resize-y px-4 py-3 rounded-lg border border-border bg-card text-foreground text-sm font-inherit leading-relaxed transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            placeholder="Describe what you want to write…"
            value={editingInstruction}
            onChange={e => setEditingInstruction(e.target.value)}
            rows={3}
          />
          <button
            id="outline-generate-btn"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!editingInstruction.trim() || loading}
            onClick={() => {
              if (editingInstruction.trim()) {
                onRegenerate(editingInstruction.trim())
                setEditingInstruction('')
              }
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ── Empty State ──
  // Also catch stale 'planning' stage (e.g. app restarted mid-planning) — treat as idle
  if (!outline && (stage === 'idle' || stage === 'planning') && !loading && !preflightRunning) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] text-center gap-3 p-6" id="outline-editor-empty">
         <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground mb-2">W</div>
        <h3 className="text-xl font-semibold m-0 text-foreground">Start Writing</h3>
        <p className="text-sm text-muted-foreground m-0 mb-2 max-w-[360px]">
          {automationLevel === 'auto'
            ? 'Enter your writing instruction and AI will write it directly.'
            : 'Enter your writing instruction below to generate a structured outline.'}
        </p>
        <div className="flex flex-col gap-2 w-full max-w-md">
          <textarea
            id="outline-instruction-input"
            className="resize-y px-4 py-3 rounded-lg border border-border bg-card text-foreground text-sm font-inherit leading-relaxed transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            placeholder="Describe what you want to write…"
            value={editingInstruction}
            onChange={e => setEditingInstruction(e.target.value)}
            rows={3}
          />
          <button
            id="outline-generate-btn"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-background border border-border text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!editingInstruction.trim() || loading}
            onClick={() => {
              if (editingInstruction.trim()) {
                onRegenerate(editingInstruction.trim())
                setEditingInstruction('')
              }
            }}
          >
             {loading ? 'Generating…' : automationLevel === 'auto' ? 'Write' : 'Generate Outline'}
          </button>
        </div>
      </div>
    )
  }

  // ── Loading State (active planning in progress) ──
  // Only show when explicitly loading (user-triggered) or preflightRunning (active backend work)
  if (!outline && (loading || preflightRunning)) {
    const label = preflightRunning ? 'AI is analyzing your request…' : 'Generating outline…'
    return <OutlineGeneratingView label={label} preflightSteps={preflightSteps} />
  }

  if (!outline) {return null}

  // ── Generating State ──
  if (stage === 'generating' && outline) {
    // Manual mode: show per-section generation controls
    if (automationLevel === 'manual') {
      return (
        <div className="flex flex-col gap-4 p-6" id="outline-editor">
          {/* Error during generation */}
          {error && (
            <ErrorBanner error={error} errorMeta={errorMeta} onDismiss={onClearError} />
          )}

          {/* Header */}
          <div className="pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold m-0 text-foreground">{outline.title}</h2>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-semibold uppercase tracking-wide border border-border text-muted-foreground">
                Manual Mode — Write Section by Section
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 m-0">
              Click "Write" on each section to generate it. Review each section before moving to the next.
            </p>
          </div>

          {/* Sections with per-section controls */}
          <div className="flex flex-col gap-2">
            {outline.sections.map((section, idx) => {
              const isCompleted = progress?.results?.some(r => r.sectionId === section.id)
              const isCurrent = progress?.currentSectionId === section.id

              return (
                <div
                  key={section.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
                    isCompleted && 'bg-muted/30 border-border',
                    isCurrent && 'bg-primary/5 border-primary/20',
                    !isCompleted && !isCurrent && 'bg-card border-border hover:border-muted-foreground/30',
                  )}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-muted text-xs font-bold">
                    {isCompleted ? '✓' : isCurrent ? (
                      <div className="w-3.5 h-3.5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Section info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground">{section.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">~{section.estimatedWords}w</span>
                  </div>

                  {/* Action button */}
                  {isCompleted ? (
                    <span className="text-xs text-muted-foreground font-medium">Done</span>
                  ) : isCurrent ? (
                    <span className="text-xs text-primary font-medium">Writing…</span>
                  ) : (
                    <button
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={loading || isCurrent}
                      onClick={() => onGenerateSection?.(section.id)}
                    >
                      Write
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Reset button */}
          <div className="flex gap-2 mt-2 pt-3 border-t border-border">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-muted-foreground border border-border hover:text-foreground hover:bg-muted transition-all"
              onClick={onReset}
            >
              Reset
            </button>
          </div>
        </div>
      )
    }

    // Auto mode: show auto-progress view
    return (
      <div className="flex flex-col h-full" id="outline-editor">
        {error && (
          <div className="px-6 pt-4">
            <ErrorBanner error={error} errorMeta={errorMeta} onDismiss={onClearError} />
          </div>
        )}
        <GenerationProgressView
          progress={progress ?? null}
          outline={outline}
          onAbort={onAbort}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500" id="outline-editor">
      {/* ── Header ── */}
      <div className="pb-3 border-b border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold m-0 text-foreground">{outline.title}</h2>
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-semibold uppercase tracking-wide border border-border text-muted-foreground',
              stageBadgeStyles[stage],
            )}
            data-stage={stage}
          >
            {stageBadgeText(stage)}
          </span>
        </div>
         <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
           <span>{outline.sections.length} sections</span>
           <span>~{outline.totalEstimatedWords.toLocaleString()} words</span>
           <span>{new Date(outline.createdAt).toLocaleTimeString()}</span>
         </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <ErrorBanner error={error} errorMeta={errorMeta} onDismiss={onClearError} />
      )}

      {/* ── Sections List ── */}
      <div className="flex flex-col gap-2">
        {outline.sections.map((section, idx) => (
          <SectionCard
            key={section.id}
            section={section}
            index={idx}
            isEditable={isEditable}
            onUpdate={updates => onUpdateSection(section.id, updates)}
            onRemove={() => onRemoveSection(section.id)}
            onAddSubsection={sub => onAddSubsection(section.id, sub)}
            onRemoveSubsection={subId => onRemoveSubsection(section.id, subId)}
          />
        ))}
      </div>

      {/* ── Add Section ── */}
      {isEditable && (
        <button
          id="outline-add-section-btn"
           className="w-full py-3 rounded-lg border-2 border-dashed border-border text-center text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-muted/30 transition-all"
          onClick={() => onAddSection()}
        >
          + Add Section
        </button>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-2 mt-2 pt-3 border-t border-border flex-wrap">
        {isEditable && (
          <>
             <button
               id="outline-approve-btn"
               className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
               disabled={loading || outline.sections.length === 0}
               onClick={onApprove}
             >
               Approve & Start Generation
            </button>
            <button
              id="outline-regenerate-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-card text-foreground border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => {
                const instruction = window.prompt('Enter new instruction:')
                if (instruction?.trim()) {onRegenerate(instruction.trim())}
              }}
            >
               Regenerate
            </button>
          </>
        )}
        <button
          id="outline-reset-btn"
           className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-muted-foreground border border-border hover:text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
           disabled={loading}
           onClick={onReset}
         >
           Reset
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────── Section Card ───────────────────────────

/**
 * Curated palette for section number badges.
 * Each section gets a distinct color to visually differentiate them.
 */
const sectionBadgeColors = [
  'bg-muted text-foreground',
  'bg-muted text-foreground',
  'bg-muted text-foreground',
  'bg-muted text-foreground',
  'bg-muted text-foreground',
  'bg-muted text-foreground',
  'bg-muted text-foreground',
  'bg-muted text-foreground',
]

interface SectionCardProps {
  section: OutlineSection
  index: number
  isEditable: boolean
  onUpdate: (updates: Partial<OutlineSection>) => void
  onRemove: () => void
  onAddSubsection: (sub?: Partial<OutlineSubsection>) => void
  onRemoveSubsection: (subId: string) => void
}

function SectionCard({
  section,
  index,
  isEditable,
  onUpdate,
  onRemove,
  onAddSubsection,
  onRemoveSubsection,
}: SectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(section.title)
  const [newKeyPoint, setNewKeyPoint] = useState('')

  const handleTitleBlur = useCallback(() => {
    setEditingTitle(false)
    if (titleValue.trim() !== section.title) {
      onUpdate({ title: titleValue.trim() })
    }
  }, [titleValue, section.title, onUpdate])

  const addKeyPoint = useCallback(() => {
    if (!newKeyPoint.trim()) {return}
    onUpdate({ keyPoints: [...section.keyPoints, newKeyPoint.trim()] })
    setNewKeyPoint('')
  }, [newKeyPoint, section.keyPoints, onUpdate])

  const removeKeyPoint = useCallback(
    (idx: number) => {
      const updated = section.keyPoints.filter((_, i) => i !== idx)
      onUpdate({ keyPoints: updated })
    },
    [section.keyPoints, onUpdate],
  )

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden transition-all hover:border-muted-foreground/30 hover:shadow-md"
      id={`outline-section-${section.id}`}
    >
      {/* Section header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={cn('flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold flex-shrink-0', sectionBadgeColors[index % sectionBadgeColors.length])}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          {editingTitle && isEditable ? (
            <input
              className="flex-1 text-[0.95rem] font-semibold px-2 py-1 rounded-md border border-primary bg-background text-foreground font-inherit"
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={e => {
                if (e.key === 'Enter') {handleTitleBlur()}
                if (e.key === 'Escape') {
                  setTitleValue(section.title)
                  setEditingTitle(false)
                }
              }}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <h3
              className="text-[0.95rem] font-semibold m-0 text-foreground"
              onDoubleClick={() => isEditable && setEditingTitle(true)}
              title={isEditable ? 'Double-click to edit' : undefined}
            >
              {section.title}
            </h3>
          )}
          <span className="text-[0.7rem] text-muted-foreground whitespace-nowrap">~{section.estimatedWords} words</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground transition-transform">{isExpanded ? '▾' : '▸'}</span>
          {isEditable && (
            <button
              className="bg-transparent border-none text-muted-foreground cursor-pointer text-sm p-0.5 rounded hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove section"
              onClick={e => {
                e.stopPropagation()
                onRemove()
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Section body */}
      {isExpanded && (
        <div className="px-4 pb-4 pl-14 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Key Points */}
          <div>
            <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-0">Key Points</h4>
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
              {section.keyPoints.map((point, idx) => (
                <li key={idx} className="group flex items-start gap-2 text-sm text-foreground py-1 px-2 rounded-md bg-muted/50">
                  <span className="flex-1 leading-snug">{point}</span>
                  {isEditable && (
                    <button
                      className="bg-transparent border-none text-muted-foreground cursor-pointer text-[0.7rem] p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      onClick={() => removeKeyPoint(idx)}
                      title="Remove key point"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isEditable && (
              <div className="flex gap-1.5 mt-1">
                <input
                  className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground text-sm font-inherit transition-colors focus:outline-none focus:border-primary"
                  placeholder="Add a key point…"
                  value={newKeyPoint}
                  onChange={e => setNewKeyPoint(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {addKeyPoint()}
                  }}
                />
                <button
                  className="px-3 py-1.5 rounded-md border border-border bg-card text-primary font-semibold cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={addKeyPoint}
                  disabled={!newKeyPoint.trim()}
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Subsections */}
          {section.subsections.length > 0 && (
            <div>
              <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 mt-0">Subsections</h4>
              <div className="flex flex-col gap-1.5">
                {section.subsections.map(sub => (
                  <div
                    key={sub.id}
                    className="group rounded-md bg-muted/50 border border-transparent hover:border-border transition-colors overflow-hidden"
                    id={`outline-subsection-${sub.id}`}
                  >
                    {/* Subsection header row */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <span className="flex-1 text-sm font-medium text-foreground leading-snug">{sub.title}</span>
                      <span className="text-[0.7rem] text-muted-foreground whitespace-nowrap flex-shrink-0">~{sub.estimatedWords}w</span>
                      {isEditable && (
                        <button
                          className="bg-transparent border-none text-muted-foreground cursor-pointer text-[0.7rem] opacity-0 group-hover:opacity-100 hover:text-destructive transition-all flex-shrink-0"
                          onClick={() => onRemoveSubsection(sub.id)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {/* Key points below, properly separated */}
                    {sub.keyPoints.length > 0 && (
                      <ul className="list-disc text-xs pl-7 pr-2.5 pb-2 text-muted-foreground m-0 space-y-0.5">
                        {sub.keyPoints.map((p, i) => (
                          <li key={i} className="leading-snug">{p}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEditable && (
            <button
              className="self-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-md transition-colors"
              onClick={() => onAddSubsection()}
            >
              + Add Subsection
            </button>
          )}

          {/* Word estimate editor */}
          {isEditable && (
            <div className="flex items-center gap-2 mt-1">
              <label className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">Estimated Words</label>
              <input
                type="number"
                className="w-20 px-2 py-1 rounded-md border border-border bg-background text-foreground text-sm font-inherit focus:outline-none focus:border-primary"
                value={section.estimatedWords}
                min={50}
                step={50}
                onChange={e => onUpdate({ estimatedWords: Math.max(50, Number(e.target.value)) })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Helpers ───────────────────────────

function stageBadgeText(stage: WriterLoopStage): string {
  const map: Record<WriterLoopStage, string> = {
    idle: 'Idle',
    planning: 'Planning…',
    'awaiting-outline-approval': 'Awaiting Approval',
    generating: 'Generating…',
    reviewing: 'Reviewing…',
    'awaiting-user': 'Awaiting User',
    complete: 'Complete',
    paused: 'Paused',
  }
  return map[stage] || stage
}

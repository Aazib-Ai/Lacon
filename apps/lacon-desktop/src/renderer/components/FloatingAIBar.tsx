/**
 * FloatingAIBar — Context-aware AI input at the bottom of the editor
 *
 * Unified bar with two modes:
 *   - DEFAULT: "Tell AI what to write..." → triggers planning
 *   - REFINE:  Shows refine action buttons (Rephrase, Add Paragraph, More…)
 *              when a paragraph is selected. User can also type a custom instruction.
 *
 * The bar is ALWAYS visible. When text is selected, it seamlessly transforms
 * to show refine actions. When no text is selected, it returns to default.
 */

import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  ChevronDown,
  Expand,
  FileText,
  GraduationCap,
  Loader2,
  PenLine,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  SpellCheck,
  Square,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import { cn } from '@/renderer/lib/utils'

import { type RefineAction,buildRefineInstruction } from './RefineBar'
import type { SelectedParagraphData } from './RefineButton'
import { Button } from './ui/Button'

/* ─── More Actions for Refine Mode ─── */

interface RefineActionDef {
  id: RefineAction
  label: string
  icon: React.ElementType
  description: string
}

const MORE_ACTIONS: RefineActionDef[] = [
  {
    id: 'match-style',
    label: 'Match Writing Style',
    icon: PenLine,
    description: "Mirror the document's existing voice",
  },
  { id: 'make-concise', label: 'Make Concise', icon: Scissors, description: 'Shorten by 30-50%' },
  { id: 'make-formal', label: 'Make Formal', icon: GraduationCap, description: 'Professional/academic tone' },
  { id: 'expand', label: 'Expand', icon: Expand, description: 'Add detail and evidence' },
  { id: 'simplify', label: 'Simplify', icon: BookOpen, description: 'Plain language, short sentences' },
  { id: 'fix-grammar', label: 'Fix Grammar', icon: SpellCheck, description: 'Grammar & spelling only' },
]

/* ─── Props ─── */

interface FloatingAIBarProps {
  documentId: string | undefined
  writerStage: string
  onStartPlanning: (instruction: string) => void
  _onSurgicalEdit: (paragraphId: string, instruction: string, fullDocumentContent: any) => Promise<any>
  /** Optional: callback to abort an in-progress generation */
  onAbortGeneration?: () => Promise<any>
  /** Currently selected paragraph data (from editor) */
  refineParagraphData?: SelectedParagraphData | null
  /** Whether a refine action is in progress */
  refineLoading?: boolean
  /** Callback to trigger a refine action */
  onRefineAction?: (action: RefineAction, instruction: string) => void
  /** Trigger counter — increment to auto-expand with refine data */
  refineExpandTrigger?: number
  /** Pre-flight research progress steps */
  preflightSteps?: Array<{ id: number; type: string; tool?: string; message: string; timestamp: string }>
  /** Whether pre-flight research is currently running */
  preflightRunning?: boolean
}

/* ─── Component ─── */

export function FloatingAIBar({
  documentId,
  writerStage,
  onStartPlanning,
  _onSurgicalEdit,
  onAbortGeneration,
  refineParagraphData,
  refineLoading,
  onRefineAction,
  refineExpandTrigger,
  preflightSteps,
  preflightRunning,
}: FloatingAIBarProps) {
  /* ── State ── */
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showMore, setShowMore] = useState(false)

  /* ── Snapshot of refine data captured when bar expands ── */
  const capturedRefineDataRef = useRef<SelectedParagraphData | null>(null)

  /* ── Refs ── */
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Derived ── */
  const isGenerating = writerStage === 'generating'
  const isResearching = !!preflightRunning
  const isActive = isLoading || isGenerating || !!refineLoading || isResearching
  // Use the captured refine data when expanded (so it survives editor blur),
  // fall back to live refineParagraphData when collapsed
  const activeRefineData = isExpanded ? capturedRefineDataRef.current || refineParagraphData : refineParagraphData
  const hasRefineData = !!(activeRefineData && activeRefineData.text.trim().length > 0)

  // Auto-expand when refineExpandTrigger increments (RefineButton clicked)
  useEffect(() => {
    if (refineExpandTrigger && refineExpandTrigger > 0) {
      capturedRefineDataRef.current = refineParagraphData || null
      setIsExpanded(true)
    }
  }, [refineExpandTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+/ to focus / expand
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        setIsExpanded(true)
        requestAnimationFrame(() => {
          textareaRef.current?.focus()
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside to collapse (only if input is empty and not loading)
  useEffect(() => {
    if (!isExpanded) {return}

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && !input.trim() && !isActive) {
        setIsExpanded(false)
        setShowMore(false)
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded, input, isActive])

  // Close "More" menu on outside click
  useEffect(() => {
    if (!showMore) {return}
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inMenu = moreMenuRef.current?.contains(target)
      const inBtn = moreBtnRef.current?.contains(target)
      if (!inMenu && !inBtn) {
        setShowMore(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMore])

  // Track elapsed time during loading / generation
  useEffect(() => {
    if (!isActive) {
      setElapsed(0)
      return
    }
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [isActive])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  // Auto-focus textarea when expanded
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [isExpanded])

  /* ── Error helpers ── */

  const showError = (message: string) => {
    setError(message)
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
    }
    errorTimerRef.current = setTimeout(() => {
      setError(null)
      errorTimerRef.current = null
    }, 8000)
  }

  const dismissError = () => {
    setError(null)
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
  }

  /* ── Handlers ── */

  const handleExpand = useCallback(() => {
    if (!isExpanded) {
      // Capture the current refine data before expanding — this prevents
      // loss of selection state when the editor loses focus
      capturedRefineDataRef.current = refineParagraphData || null
      setIsExpanded(true)
    }
  }, [isExpanded, refineParagraphData])

  const handleCollapse = useCallback(() => {
    if (!isActive) {
      setIsExpanded(false)
      setInput('')
      setShowMore(false)
      capturedRefineDataRef.current = null
      dismissError()
    }
  }, [isActive])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || !documentId || isLoading) {return}

    // If we have refine data, submit as a custom refine action
    if (hasRefineData && onRefineAction && activeRefineData) {
      const instruction = buildRefineInstruction('custom', input.trim(), activeRefineData)
      onRefineAction('custom', instruction)
      setInput('')
      return
    }

    // Default: planning mode
    setIsLoading(true)
    dismissError()
    try {
      onStartPlanning(input.trim())
      setInput('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      showError(message)
      console.error('AI action failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefineQuickAction = useCallback(
    (action: RefineAction) => {
      if (isActive || !onRefineAction || !activeRefineData) {return}
      const instruction = buildRefineInstruction(action, '', activeRefineData)
      onRefineAction(action, instruction)
      setShowMore(false)
    },
    [isActive, onRefineAction, activeRefineData],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCollapse()
    }
  }

  const handleCancel = async () => {
    if (isCancelling) {return}
    setIsCancelling(true)
    try {
      if (onAbortGeneration) {
        await onAbortGeneration()
      }
    } catch (err) {
      console.error('Abort failed:', err)
    } finally {
      setIsCancelling(false)
      setIsLoading(false)
    }
  }

  /* ── Placeholder ── */

  const getPlaceholder = () => {
    if (hasRefineData) {return 'Refine selected content with AI…'}
    if (writerStage === 'idle') {return 'Describe what you want to write...'}
    return 'Tell AI what else needs to be changed...'
  }

  /* ── Preview snippet ── */
  const getPreviewText = () => {
    if (!activeRefineData?.text) {return ''}
    if (activeRefineData.text.length > 50) {return `${activeRefineData.text.slice(0, 50)  }…`}
    return activeRefineData.text
  }
  const previewText = getPreviewText()

  /* ── Render: Collapsed Pill ── */

  if (!isExpanded) {
    return (
      <div className="floating-ai-bar-wrapper" data-testid="floating-ai-bar">
        <button
          onMouseDown={e => {
            // Prevent editor blur so the text selection is preserved
            e.preventDefault()
          }}
          onClick={handleExpand}
          className={cn(
            'floating-ai-pill',
            hasRefineData && 'floating-ai-pill--selection',
            isGenerating && 'floating-ai-pill--generating',
          )}
          aria-label="Open AI input"
          data-testid="ai-pill-trigger"
        >
          {/* Sparkle icon */}
          <span className="floating-ai-pill__icon">
            {(() => {
              if (isResearching) {return <Search className="h-4 w-4 animate-pulse" />}
              if (isGenerating) {return <Loader2 className="h-4 w-4 animate-spin" />}
              return <Sparkles className="h-4 w-4" />
            })()}
          </span>

          {/* Label */}
          <span className="floating-ai-pill__label">
            {(() => {
              if (isResearching) {return `Researching${elapsed > 0 ? ` · ${elapsed}s` : '...'}`}
              if (isGenerating) {return `Generating${elapsed > 0 ? ` · ${elapsed}s` : '...'}`}
              if (hasRefineData) {return 'Refine selected text'}
              return 'Ask AI to write'
            })()}
          </span>

          {/* Selection badge */}
          {hasRefineData && !isGenerating && <span className="floating-ai-pill__badge">Selection</span>}

          {/* Keyboard hint */}
          <kbd className="floating-ai-pill__kbd">Ctrl+/</kbd>
        </button>
      </div>
    )
  }

  /* ── Render: Expanded Bar ── */

  return (
    <div
      ref={containerRef}
      className="floating-ai-bar-wrapper"
      data-testid="floating-ai-bar"
      onMouseDown={e => {
        // Prevent clicks in this bar from stealing editor focus/selection
        // Exception: allow clicks on the textarea so users can type
        if (!(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault()
        }
      }}
    >
      <div
        className={cn(
          'floating-ai-expanded',
          error && 'floating-ai-expanded--error',
          isActive && 'floating-ai-expanded--active',
          hasRefineData && 'floating-ai-expanded--selection',
        )}
      >
        {/* ── Refine actions row (only when paragraph is selected) ── */}
        {hasRefineData && !isActive && (
          <div className="refine-bar__actions">
            {/* Selection preview */}
            <div className="refine-bar__preview" title={activeRefineData?.text}>
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="refine-bar__preview-text">{previewText}</span>
            </div>

            <div className="refine-bar__action-buttons">
              {/* Add New Paragraph */}
              <button
                className="refine-bar__action-btn"
                onClick={() => handleRefineQuickAction('add-paragraph')}
                disabled={isActive}
                data-testid="refine-add-paragraph"
              >
                <FileText className="h-3.5 w-3.5" />
                Add Paragraph
              </button>

              {/* Rephrase */}
              <button
                className="refine-bar__action-btn refine-bar__action-btn--primary"
                onClick={() => handleRefineQuickAction('rephrase')}
                disabled={isActive}
                data-testid="refine-rephrase"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Rephrase
              </button>

              {/* More dropdown */}
              <div className="refine-bar__more-wrapper" ref={moreMenuRef}>
                <button
                  ref={moreBtnRef}
                  className="refine-bar__action-btn"
                  onClick={() => setShowMore(!showMore)}
                  disabled={isActive}
                  data-testid="refine-more"
                >
                  More
                  <ChevronDown className={cn('h-3 w-3 transition-transform', showMore && 'rotate-180')} />
                </button>

                {showMore &&
                  moreBtnRef.current &&
                  ReactDOM.createPortal(
                    <div
                      className="refine-bar__more-menu"
                      data-testid="refine-more-menu"
                      ref={moreMenuRef}
                      style={{
                        position: 'fixed',
                        bottom: `${window.innerHeight - moreBtnRef.current.getBoundingClientRect().top + 6}px`,
                        right: `${window.innerWidth - moreBtnRef.current.getBoundingClientRect().right}px`,
                      }}
                    >
                      {MORE_ACTIONS.map(action => (
                        <button
                          key={action.id}
                          className="refine-bar__more-item"
                          onClick={() => handleRefineQuickAction(action.id)}
                        >
                          <action.icon className="h-4 w-4 flex-shrink-0" />
                          <div className="refine-bar__more-item-content">
                            <span className="refine-bar__more-item-label">{action.label}</span>
                            <span className="refine-bar__more-item-desc">{action.description}</span>
                          </div>
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )}
              </div>
            </div>
          </div>
        )}

        {/* ── Input area ── */}
        <form onSubmit={handleSubmit} className="floating-ai-expanded__form">
          {/* Left icon */}
          <div
            className={cn(
              'floating-ai-expanded__icon-ring',
              (() => {
                if (error) {return 'floating-ai-expanded__icon-ring--error'}
                if (hasRefineData) {return 'floating-ai-expanded__icon-ring--selection'}
                return 'floating-ai-expanded__icon-ring--default'
              })(),
            )}
          >
            {(() => {
              if (isActive) {return <Loader2 className="h-4 w-4 animate-spin" />}
              if (error) {return <AlertCircle className="h-4 w-4" />}
              return <Sparkles className="h-4 w-4" />
            })()}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={isActive || !documentId}
            rows={1}
            className="floating-ai-expanded__textarea"
            aria-label="AI instruction input"
            data-testid="ai-input"
          />

          {/* Right action cluster */}
          <div className="floating-ai-expanded__actions">
            {/* Elapsed timer */}
            {isActive && elapsed > 2 && <span className="floating-ai-expanded__elapsed">{elapsed}s</span>}

            {/* Mode badge */}
            {hasRefineData && !isActive && <span className="floating-ai-expanded__mode-badge">Refine</span>}

            {/* Cancel button (visible during generation) */}
            {isActive && (
              <Button
                type="button"
                size="icon"
                onClick={handleCancel}
                disabled={isCancelling}
                className={cn('floating-ai-expanded__cancel-btn', isCancelling && 'opacity-50')}
                title="Cancel AI request"
                aria-label="Cancel AI request"
                data-testid="ai-cancel"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Submit button */}
            {!isActive && (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || !documentId}
                className={cn(
                  'floating-ai-expanded__submit-btn',
                  input.trim() ? 'floating-ai-expanded__submit-btn--ready' : 'floating-ai-expanded__submit-btn--idle',
                )}
                data-testid="ai-submit"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>

        {/* ── Research progress row (during preflight) ── */}
        {isResearching && preflightSteps && preflightSteps.length > 0 && (
          <div className="floating-ai-expanded__research-progress">
            <Search className="h-3.5 w-3.5 text-primary animate-pulse flex-shrink-0" />
            <span className="floating-ai-expanded__research-text">
              {preflightSteps[preflightSteps.length - 1].message}
            </span>
          </div>
        )}

        {/* ── Bottom row: hints + collapse ── */}
        <div className="floating-ai-expanded__footer">
          <div className="floating-ai-expanded__hints">
            {error ? (
              <div className="floating-ai-expanded__error-row">
                <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                <span className="floating-ai-expanded__error-text">{error}</span>
                <button
                  onClick={dismissError}
                  className="floating-ai-expanded__error-dismiss"
                  aria-label="Dismiss error"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <span className="floating-ai-expanded__hint">
                  <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> new line · <kbd>Esc</kbd> close
                </span>
              </>
            )}
          </div>

          {/* Collapse chevron */}
          {!isActive && (
            <button
              onClick={handleCollapse}
              className="floating-ai-expanded__collapse"
              aria-label="Collapse AI bar"
              data-testid="ai-collapse"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

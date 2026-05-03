/**
 * RefineBar — Bottom AI review bar for paragraph refinement
 *
 * Appears when the user clicks the floating "Refine" button.
 * Provides quick actions (Add Paragraph, Rephrase, More…) plus
 * a custom instruction input. Each action uses a tailored system
 * prompt and sends surrounding paragraph context to the LLM.
 *
 * Design: matches the Lacon FloatingAIBar glassmorphism style.
 */

import {
  ArrowUp,
  ChevronDown,
  FileText,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  X,
  GraduationCap,
  Scissors,
  Expand,
  BookOpen,
  SpellCheck,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/renderer/lib/utils'

import type { SelectedParagraphData } from './RefineButton'

/* ─── Refine Action Definitions ─── */

export type RefineAction =
  | 'rephrase'
  | 'add-paragraph'
  | 'make-concise'
  | 'make-formal'
  | 'expand'
  | 'simplify'
  | 'fix-grammar'
  | 'match-style'
  | 'custom'

interface RefineActionDef {
  id: RefineAction
  label: string
  icon: React.ElementType
  description: string
}

const MORE_ACTIONS: RefineActionDef[] = [
  { id: 'match-style', label: 'Match Writing Style', icon: PenLine, description: 'Mirror the document\'s existing voice' },
  { id: 'make-concise', label: 'Make Concise', icon: Scissors, description: 'Shorten by 30-50%' },
  { id: 'make-formal', label: 'Make Formal', icon: GraduationCap, description: 'Professional/academic tone' },
  { id: 'expand', label: 'Expand', icon: Expand, description: 'Add detail and evidence' },
  { id: 'simplify', label: 'Simplify', icon: BookOpen, description: 'Plain language, short sentences' },
  { id: 'fix-grammar', label: 'Fix Grammar', icon: SpellCheck, description: 'Grammar & spelling only' },
]

/**
 * Build a refine instruction string that includes the action and context.
 * This is what gets sent to the backend surgicalEdit.
 */
export function buildRefineInstruction(
  action: RefineAction,
  customPrompt: string,
  data: SelectedParagraphData,
): string {
  const contextBlock = [
    data.contextBefore ? `PRECEDING CONTEXT:\n${data.contextBefore}` : '',
    `PARAGRAPH TO REFINE:\n${data.text}`,
    data.contextAfter ? `FOLLOWING CONTEXT:\n${data.contextAfter}` : '',
  ].filter(Boolean).join('\n\n---\n\n')

  switch (action) {
    case 'rephrase':
      return `[REFINE:REPHRASE] Rewrite the following paragraph with different wording while preserving its exact meaning. Improve flow, clarity, and word choice. Do NOT change any facts or arguments.\n\n${contextBlock}`

    case 'add-paragraph':
      return `[REFINE:ADD_PARAGRAPH] Generate a new paragraph that logically continues from the selected content. It should match the writing style, tone, and vocabulary of the surrounding text and expand on the topic naturally.\n\n${contextBlock}`

    case 'make-concise':
      return `[REFINE:CONCISE] Reduce this paragraph's word count by 30-50% while preserving ALL key information and arguments. Cut filler words, redundant phrases, and unnecessary qualifiers. Keep the core message sharp.\n\n${contextBlock}`

    case 'make-formal':
      return `[REFINE:FORMAL] Transform this paragraph to a professional/academic register. Remove contractions, use precise vocabulary, adopt a measured and authoritative tone. Preserve the meaning exactly.\n\n${contextBlock}`

    case 'expand':
      return `[REFINE:EXPAND] Expand this paragraph with supporting evidence, examples, deeper analysis, and more detailed explanations. Roughly double the length while maintaining quality and relevance.\n\n${contextBlock}`

    case 'simplify':
      return `[REFINE:SIMPLIFY] Rewrite this paragraph at an 8th-grade reading level. Use short sentences, simple vocabulary, and no jargon. Break complex ideas into digestible pieces. Preserve all key information.\n\n${contextBlock}`

    case 'fix-grammar':
      return `[REFINE:GRAMMAR] Fix grammar, spelling, and punctuation errors ONLY. Do NOT change the meaning, style, tone, or word choice. Return the corrected version of the paragraph.\n\n${contextBlock}`

    case 'match-style':
      return `[REFINE:MATCH_STYLE] Analyze the writing style of the surrounding paragraphs (voice, tone, vocabulary level, sentence structure), then rewrite the selected paragraph to seamlessly match that style. Preserve the meaning.\n\n${contextBlock}`

    case 'custom':
      return `[REFINE:CUSTOM] ${customPrompt}\n\n${contextBlock}`

    default:
      return `[REFINE] ${customPrompt || 'Improve this paragraph.'}\n\n${contextBlock}`
  }
}

/* ─── Props ─── */

interface RefineBarProps {
  paragraphData: SelectedParagraphData
  isLoading: boolean
  onAction: (action: RefineAction, instruction: string) => void
  onClose: () => void
}

/* ─── Component ─── */

export function RefineBar({
  paragraphData,
  isLoading,
  onAction,
  onClose,
}: RefineBarProps) {
  const [customInput, setCustomInput] = useState('')
  const [showMore, setShowMore] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-focus the textarea
  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 80)}px`
    }
  }, [customInput])

  // Close "More" menu on outside click
  useEffect(() => {
    if (!showMore) return
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMore(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMore])

  const handleAction = useCallback(
    (action: RefineAction) => {
      if (isLoading) return
      const instruction = buildRefineInstruction(action, customInput, paragraphData)
      onAction(action, instruction)
      setShowMore(false)
    },
    [isLoading, customInput, paragraphData, onAction],
  )

  const handleCustomSubmit = useCallback(() => {
    if (!customInput.trim() || isLoading) return
    const instruction = buildRefineInstruction('custom', customInput.trim(), paragraphData)
    onAction('custom', instruction)
  }, [customInput, isLoading, paragraphData, onAction])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCustomSubmit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Preview snippet of selected text
  const previewText =
    paragraphData.text.length > 60
      ? paragraphData.text.slice(0, 60) + '…'
      : paragraphData.text

  return (
    <div
      ref={containerRef}
      className="refine-bar-wrapper"
      data-testid="refine-bar"
    >
      <div className={cn('refine-bar', isLoading && 'refine-bar--loading')}>
        {/* ── Top: Quick actions row ── */}
        <div className="refine-bar__actions">
          {/* Selection preview */}
          <div className="refine-bar__preview" title={paragraphData.text}>
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="refine-bar__preview-text">{previewText}</span>
          </div>

          <div className="refine-bar__action-buttons">
            {/* Add New Paragraph */}
            <button
              className="refine-bar__action-btn"
              onClick={() => handleAction('add-paragraph')}
              disabled={isLoading}
              data-testid="refine-add-paragraph"
            >
              <FileText className="h-3.5 w-3.5" />
              Add Paragraph
            </button>

            {/* Rephrase */}
            <button
              className="refine-bar__action-btn refine-bar__action-btn--primary"
              onClick={() => handleAction('rephrase')}
              disabled={isLoading}
              data-testid="refine-rephrase"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Rephrase
            </button>

            {/* More dropdown */}
            <div className="refine-bar__more-wrapper" ref={moreMenuRef}>
              <button
                className="refine-bar__action-btn"
                onClick={() => setShowMore(!showMore)}
                disabled={isLoading}
                data-testid="refine-more"
              >
                More
                <ChevronDown className={cn('h-3 w-3 transition-transform', showMore && 'rotate-180')} />
              </button>

              {showMore && (
                <div className="refine-bar__more-menu" data-testid="refine-more-menu">
                  {MORE_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      className="refine-bar__more-item"
                      onClick={() => handleAction(action.id)}
                    >
                      <action.icon className="h-4 w-4 flex-shrink-0" />
                      <div className="refine-bar__more-item-content">
                        <span className="refine-bar__more-item-label">{action.label}</span>
                        <span className="refine-bar__more-item-desc">{action.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom: Custom input row ── */}
        <div className="refine-bar__input-row">
          <textarea
            ref={textareaRef}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Refine selected content with AI…"
            disabled={isLoading}
            rows={1}
            className="refine-bar__textarea"
            aria-label="Custom refine instruction"
            data-testid="refine-custom-input"
          />

          <div className="refine-bar__input-actions">
            {isLoading ? (
              <div className="refine-bar__loading-indicator">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <button
                className={cn(
                  'refine-bar__submit-btn',
                  customInput.trim()
                    ? 'refine-bar__submit-btn--ready'
                    : 'refine-bar__submit-btn--idle',
                )}
                onClick={handleCustomSubmit}
                disabled={!customInput.trim()}
                data-testid="refine-submit"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}

            {/* Close button */}
            <button
              className="refine-bar__close-btn"
              onClick={onClose}
              disabled={isLoading}
              title="Close (Esc)"
              data-testid="refine-close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

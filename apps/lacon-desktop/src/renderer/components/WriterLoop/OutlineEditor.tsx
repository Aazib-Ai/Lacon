/**
 * OutlineEditor — Phase 2 Component
 *
 * Displays and allows editing of a WriterOutline produced by the Planner.
 * Supports:
 * - Section title editing
 * - Key-point editing (add, remove, reorder)
 * - Subsection management
 * - Estimated word count per section
 * - Approve / Regenerate / Reset actions
 */

import './OutlineEditor.css'

import React, { useCallback, useState } from 'react'

import type { OutlineSection, OutlineSubsection, WriterLoopStage, WriterOutline } from '../../../shared/writer-types'

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
  onUpdateSection: (sectionId: string, updates: Partial<OutlineSection>) => void
  onAddSection: (section?: Partial<OutlineSection>) => void
  onRemoveSection: (sectionId: string) => void
  onAddSubsection: (sectionId: string, subsection?: Partial<OutlineSubsection>) => void
  onRemoveSubsection: (sectionId: string, subsectionId: string) => void
  onApprove: () => void
  onRegenerate: (instruction: string) => void
  onReset: () => void
  onClearError?: () => void
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
    <div className="outline-editor__error-banner" role="alert" id="outline-editor-error">
      <div className="outline-editor__error-icon">⚠️</div>
      <div className="outline-editor__error-body">
        <div className="outline-editor__error-title">{actionLabel} Failed</div>
        <div className="outline-editor__error-message">{error}</div>
        <div className="outline-editor__error-hint">
          💡 Check that your AI provider is configured and your API key is valid in Settings.
        </div>
        <div className="outline-editor__error-actions">
          {errorMeta?.retryable && errorMeta?.retryFn && (
            <button
              className="outline-editor__btn outline-editor__btn--primary outline-editor__btn--sm"
              onClick={errorMeta.retryFn}
            >
              🔄 Retry
            </button>
          )}
          {onDismiss && (
            <button
              className="outline-editor__btn outline-editor__btn--ghost outline-editor__btn--sm"
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

// ─────────────────────────── Loading Indicator ───────────────────────────

function LoadingIndicator({ label }: { label: string }) {
  const [elapsed, setElapsed] = useState(0)

  React.useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="outline-editor outline-editor--loading" id="outline-editor-loading">
      <div className="outline-editor__spinner" />
      <p className="outline-editor__loading-label">{label}</p>
      {elapsed > 3 && (
        <p className="outline-editor__loading-elapsed">
          {elapsed}s elapsed…{elapsed > 15 ? ' This is taking longer than usual.' : ''}
        </p>
      )}
      {elapsed > 30 && (
        <p className="outline-editor__loading-hint">
          💡 If this takes too long, check your provider connection in Settings.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────── Main Component ───────────────────────────

export function OutlineEditor({
  outline,
  stage,
  loading,
  error,
  errorMeta,
  onUpdateSection,
  onAddSection,
  onRemoveSection,
  onAddSubsection,
  onRemoveSubsection,
  onApprove,
  onRegenerate,
  onReset,
  onClearError,
}: OutlineEditorProps) {
  const [editingInstruction, setEditingInstruction] = useState('')
  const isEditable = stage === 'awaiting-outline-approval'

  // ── Error State (standalone — no outline present) ──
  if (!outline && error && !loading) {
    return (
      <div className="outline-editor outline-editor--error" id="outline-editor-error-state">
        <ErrorBanner error={error} errorMeta={errorMeta} onDismiss={onClearError} />
        <div className="outline-editor__instruction-input" style={{ marginTop: '16px' }}>
          <textarea
            id="outline-instruction-input"
            className="outline-editor__textarea"
            placeholder="Describe what you want to write…"
            value={editingInstruction}
            onChange={e => setEditingInstruction(e.target.value)}
            rows={3}
          />
          <button
            id="outline-generate-btn"
            className="outline-editor__btn outline-editor__btn--primary"
            disabled={!editingInstruction.trim() || loading}
            onClick={() => {
              if (editingInstruction.trim()) {
                onRegenerate(editingInstruction.trim())
                setEditingInstruction('')
              }
            }}
          >
            ✨ Try Again
          </button>
        </div>
      </div>
    )
  }

  // ── Empty State ──
  if (!outline && stage === 'idle') {
    return (
      <div className="outline-editor outline-editor--empty" id="outline-editor-empty">
        <div className="outline-editor__empty-icon">📝</div>
        <h3 className="outline-editor__empty-title">Start Writing</h3>
        <p className="outline-editor__empty-desc">
          Enter your writing instruction below to generate a structured outline.
        </p>
        <div className="outline-editor__instruction-input">
          <textarea
            id="outline-instruction-input"
            className="outline-editor__textarea"
            placeholder="Describe what you want to write…"
            value={editingInstruction}
            onChange={e => setEditingInstruction(e.target.value)}
            rows={3}
          />
          <button
            id="outline-generate-btn"
            className="outline-editor__btn outline-editor__btn--primary"
            disabled={!editingInstruction.trim() || loading}
            onClick={() => {
              if (editingInstruction.trim()) {
                onRegenerate(editingInstruction.trim())
                setEditingInstruction('')
              }
            }}
          >
            {loading ? 'Generating…' : '✨ Generate Outline'}
          </button>
        </div>
      </div>
    )
  }

  // ── Loading State ──
  if (loading && !outline) {
    return <LoadingIndicator label="Generating outline…" />
  }

  if (!outline) {return null}

  return (
    <div className="outline-editor" id="outline-editor">
      {/* ── Header ── */}
      <div className="outline-editor__header">
        <div className="outline-editor__title-row">
          <h2 className="outline-editor__title">{outline.title}</h2>
          <span className="outline-editor__stage-badge" data-stage={stage}>
            {stageBadgeText(stage)}
          </span>
        </div>
        <div className="outline-editor__meta">
          <span className="outline-editor__meta-item">📄 {outline.sections.length} sections</span>
          <span className="outline-editor__meta-item">📝 ~{outline.totalEstimatedWords.toLocaleString()} words</span>
          <span className="outline-editor__meta-item">🕐 {new Date(outline.createdAt).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <ErrorBanner error={error} errorMeta={errorMeta} onDismiss={onClearError} />
      )}

      {/* ── Sections List ── */}
      <div className="outline-editor__sections">
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
          className="outline-editor__btn outline-editor__btn--ghost outline-editor__add-section"
          onClick={() => onAddSection()}
        >
          + Add Section
        </button>
      )}

      {/* ── Actions ── */}
      <div className="outline-editor__actions">
        {isEditable && (
          <>
            <button
              id="outline-approve-btn"
              className="outline-editor__btn outline-editor__btn--primary"
              disabled={loading || outline.sections.length === 0}
              onClick={onApprove}
            >
              ✅ Approve &amp; Start Generation
            </button>
            <button
              id="outline-regenerate-btn"
              className="outline-editor__btn outline-editor__btn--secondary"
              disabled={loading}
              onClick={() => {
                const instruction = window.prompt('Enter new instruction:')
                if (instruction?.trim()) {onRegenerate(instruction.trim())}
              }}
            >
              🔄 Regenerate
            </button>
          </>
        )}
        <button
          id="outline-reset-btn"
          className="outline-editor__btn outline-editor__btn--danger"
          disabled={loading || stage === 'idle'}
          onClick={onReset}
        >
          ⏹ Reset
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────── Section Card ───────────────────────────

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
    <div className="outline-section" id={`outline-section-${section.id}`}>
      {/* Section header */}
      <div className="outline-section__header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="outline-section__index">{index + 1}</span>
        <div className="outline-section__title-area">
          {editingTitle && isEditable ? (
            <input
              className="outline-section__title-input"
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
              className="outline-section__title"
              onDoubleClick={() => isEditable && setEditingTitle(true)}
              title={isEditable ? 'Double-click to edit' : undefined}
            >
              {section.title}
            </h3>
          )}
          <span className="outline-section__word-est">~{section.estimatedWords} words</span>
        </div>
        <div className="outline-section__controls">
          <span className="outline-section__chevron">{isExpanded ? '▾' : '▸'}</span>
          {isEditable && (
            <button
              className="outline-section__remove-btn"
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
        <div className="outline-section__body">
          {/* Key Points */}
          <div className="outline-section__key-points">
            <h4 className="outline-section__label">Key Points</h4>
            <ul className="outline-section__point-list">
              {section.keyPoints.map((point, idx) => (
                <li key={idx} className="outline-section__point">
                  <span className="outline-section__point-text">{point}</span>
                  {isEditable && (
                    <button
                      className="outline-section__point-remove"
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
              <div className="outline-section__add-point">
                <input
                  className="outline-section__add-point-input"
                  placeholder="Add a key point…"
                  value={newKeyPoint}
                  onChange={e => setNewKeyPoint(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {addKeyPoint()}
                  }}
                />
                <button className="outline-section__add-point-btn" onClick={addKeyPoint} disabled={!newKeyPoint.trim()}>
                  +
                </button>
              </div>
            )}
          </div>

          {/* Subsections */}
          {section.subsections.length > 0 && (
            <div className="outline-section__subsections">
              <h4 className="outline-section__label">Subsections</h4>
              {section.subsections.map(sub => (
                <div key={sub.id} className="outline-subsection" id={`outline-subsection-${sub.id}`}>
                  <span className="outline-subsection__title">{sub.title}</span>
                  <span className="outline-subsection__words">~{sub.estimatedWords}w</span>
                  {sub.keyPoints.length > 0 && (
                    <ul className="outline-subsection__points">
                      {sub.keyPoints.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {isEditable && (
                    <button className="outline-subsection__remove" onClick={() => onRemoveSubsection(sub.id)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isEditable && (
            <button
              className="outline-editor__btn outline-editor__btn--ghost outline-section__add-sub"
              onClick={() => onAddSubsection()}
            >
              + Add Subsection
            </button>
          )}

          {/* Word estimate editor */}
          {isEditable && (
            <div className="outline-section__word-editor">
              <label className="outline-section__label">Estimated Words</label>
              <input
                type="number"
                className="outline-section__word-input"
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

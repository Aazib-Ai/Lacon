/**
 * WriterLoopPanel — Phase 2
 *
 * Container component that wires the useWriterLoop hook to the OutlineEditor.
 * Integrates with the existing AppShell/AssistantPanel layout.
 *
 * Shows:
 * - Session config bar (word target, automation level, stage)
 * - OutlineEditor for outline CRUD + approval
 */

import './WriterLoopPanel.css'

import React, { useCallback } from 'react'

import type { AutomationLevel } from '../../../shared/writer-types'
import { useWriterLoop } from '../../hooks/useWriterLoop'
import { OutlineEditor } from './OutlineEditor'

interface WriterLoopPanelProps {
  documentId: string | undefined
}

export function WriterLoopPanel({ documentId }: WriterLoopPanelProps) {
  const loop = useWriterLoop(documentId)

  const handleRegenerate = useCallback(
    (instruction: string) => {
      loop.startPlanning(instruction)
    },
    [loop],
  )

  const handleApprove = useCallback(() => {
    loop.approveOutline()
  }, [loop])

  const handleReset = useCallback(() => {
    loop.reset()
  }, [loop])

  if (!documentId) {
    return (
      <div className="writer-loop-panel writer-loop-panel--empty" id="writer-loop-panel">
        <p className="writer-loop-panel__placeholder">Open a document to start writing.</p>
      </div>
    )
  }

  return (
    <div className="writer-loop-panel" id="writer-loop-panel">
      {/* ── Session Config Bar ── */}
      <SessionConfigBar
        session={loop.session}
        onUpdateConfig={loop.updateConfig}
        onPause={loop.pause}
        onReset={loop.reset}
      />

      {/* ── Outline Editor ── */}
      <OutlineEditor
        outline={loop.outline}
        stage={loop.stage}
        loading={loop.loading}
        error={loop.error}
        errorMeta={loop.errorMeta}
        onUpdateSection={loop.updateSection}
        onAddSection={loop.addSection}
        onRemoveSection={loop.removeSection}
        onAddSubsection={loop.addSubsection}
        onRemoveSubsection={loop.removeSubsection}
        onApprove={handleApprove}
        onRegenerate={handleRegenerate}
        onReset={handleReset}
        onClearError={() => {
          // Dispatch clear error via reset flow — the hook exposes error clearing through fetchState
          loop.fetchState()
        }}
      />
    </div>
  )
}

// ─────────────────────────── Session Config Bar ───────────────────────────

interface SessionConfigBarProps {
  session: any
  onUpdateConfig: (config: any) => void
  onPause: () => void
  onReset: () => void
}

function SessionConfigBar({ session, onUpdateConfig, onPause: _onPause, onReset: _onReset }: SessionConfigBarProps) {
  if (!session) {return null}

  const automationOptions: AutomationLevel[] = ['auto', 'supervised', 'manual']

  return (
    <div className="session-config-bar" id="session-config-bar">
      {/* Stage indicator */}
      <div className="session-config-bar__item">
        <span className="session-config-bar__label">Stage</span>
        <span className="session-config-bar__value" data-stage={session.stage}>
          {formatStage(session.stage)}
        </span>
      </div>

      {/* Automation level */}
      <div className="session-config-bar__item">
        <span className="session-config-bar__label">Mode</span>
        <select
          id="session-automation-select"
          className="session-config-bar__select"
          value={session.automationLevel}
          onChange={e => onUpdateConfig({ automationLevel: e.target.value })}
        >
          {automationOptions.map(opt => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Word target */}
      <div className="session-config-bar__item">
        <span className="session-config-bar__label">Target</span>
        <input
          id="session-word-target"
          type="number"
          className="session-config-bar__number-input"
          value={session.wordTarget}
          min={0}
          step={100}
          onChange={e => onUpdateConfig({ wordTarget: Math.max(0, Number(e.target.value)) })}
          placeholder="No target"
        />
        <span className="session-config-bar__unit">words</span>
      </div>

      {/* Skills count */}
      <div className="session-config-bar__item">
        <span className="session-config-bar__label">Skills</span>
        <span className="session-config-bar__value">{session.activeSkillIds?.length || 0}</span>
      </div>
    </div>
  )
}

function formatStage(stage: string): string {
  return stage.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

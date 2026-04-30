/**
 * WriterLoopPanel — Session Config + Outline Editor Container
 *
 * Container component that wires the useWriterLoop hook to the OutlineEditor.
 * Shows session config bar (word target, automation level, stage) + OutlineEditor.
 */

import React, { useCallback } from 'react'

import type { AutomationLevel } from '../../../shared/writer-types'
import { cn } from '../../lib/utils'
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
      <div className="flex flex-col items-center justify-center min-h-[200px] h-full" id="writer-loop-panel">
        <p className="text-sm text-muted-foreground">Open a document to start writing.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" id="writer-loop-panel">
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
        progress={loop.progress}
        onUpdateSection={loop.updateSection}
        onAddSection={loop.addSection}
        onRemoveSection={loop.removeSection}
        onAddSubsection={loop.addSubsection}
        onRemoveSubsection={loop.removeSubsection}
        onApprove={handleApprove}
        onRegenerate={handleRegenerate}
        onReset={handleReset}
        onAbort={loop.abortGeneration}
        onClearError={() => {
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

const stageColorMap: Record<string, string> = {
  idle: 'text-muted-foreground',
  generating: 'text-success',
  'awaiting-outline-approval': 'text-warning',
  reviewing: 'text-primary',
}

function SessionConfigBar({ session, onUpdateConfig, onPause: _onPause, onReset: _onReset }: SessionConfigBarProps) {
  if (!session) {return null}

  const automationOptions: AutomationLevel[] = ['auto', 'supervised', 'manual']

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 bg-secondary border-b border-border text-xs flex-wrap"
      id="session-config-bar"
    >
      {/* Stage indicator */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[0.625rem]">Stage</span>
        <span className={cn('font-semibold', stageColorMap[session.stage] || 'text-foreground')}>
          {formatStage(session.stage)}
        </span>
      </div>

      {/* Automation level */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[0.625rem]">Mode</span>
        <select
          id="session-automation-select"
          className="px-1.5 py-0.5 rounded-sm border border-border bg-background text-foreground text-xs font-inherit cursor-pointer transition-colors focus:outline-none focus:border-primary"
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
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[0.625rem]">Target</span>
        <input
          id="session-word-target"
          type="number"
          className="w-14 px-1.5 py-0.5 rounded-sm border border-border bg-background text-foreground text-xs font-inherit transition-colors focus:outline-none focus:border-primary"
          value={session.wordTarget}
          min={0}
          step={100}
          onChange={e => onUpdateConfig({ wordTarget: Math.max(0, Number(e.target.value)) })}
          placeholder="No target"
        />
        <span className="text-muted-foreground text-[0.65rem]">words</span>
      </div>

      {/* Skills count — clickable to open Skills tab */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[0.625rem]">Skills</span>
        <button
          onClick={() => {
            // Dispatch a custom event that LaconWorkspace listens for
            window.dispatchEvent(new CustomEvent('lacon:open-skills-tab'))
          }}
          className={cn(
            'font-semibold px-1.5 py-0.5 rounded-md transition-colors cursor-pointer',
            (session.activeSkillIds?.length || 0) > 0
              ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
              : 'text-foreground hover:bg-secondary',
          )}
          title="Open Skills Library"
        >
          ✨ {session.activeSkillIds?.length || 0}
        </button>
      </div>
    </div>
  )
}

function formatStage(stage: string): string {
  return stage.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * WriterLoopPanel — Session Config + Outline Editor Container
 *
 * Container component that wires the useWriterLoop hook to the OutlineEditor.
 * Shows session config bar (word target, automation level, stage) + OutlineEditor.
 *
 * Owns the `editingInstruction` state so it survives tab switches.
 * Composes active skills and research context before passing to startPlanning.
 */

import React, { useCallback, useState } from 'react'

import type { AutomationLevel, ResearchContext } from '../../../shared/writer-types'
import { cn } from '../../lib/utils'
import { useResearch } from '../../hooks/useResearch'
import { useSkills } from '../../hooks/useSkills'
import { useWriterLoop } from '../../hooks/useWriterLoop'
import { OutlineEditor } from './OutlineEditor'

interface WriterLoopPanelProps {
  documentId: string | undefined
}

export function WriterLoopPanel({ documentId }: WriterLoopPanelProps) {
  const loop = useWriterLoop(documentId)
  const skills = useSkills(documentId)
  const research = useResearch(documentId)

  // Lifted instruction state — persists across tab switches
  const [editingInstruction, setEditingInstruction] = useState('')

  const handleRegenerate = useCallback(
    (instruction: string) => {
      // 1. Get already-composed skill prompt (auto-composed on activeSkillIds change)
      const composedSkillPrompt = skills.composedSkill?.composedPrompt || ''

      // 2. Build research context from current entries
      let researchContext: ResearchContext | undefined
      if (research.entries.length > 0) {
        researchContext = {
          entries: research.entries.map(entry => ({
            id: entry.id,
            query: entry.query,
            excerpts: entry.excerpts,
            sources: entry.sources,
            createdAt: entry.createdAt,
          })),
          summary: research.entries.map(e => `[${e.query}]: ${e.excerpts[0] || ''}`).join('\n'),
        }
      }

      // 3. Pass everything to startPlanning
      console.log(
        `[WriterLoopPanel] startPlanning with skills=${skills.activeSkillIds.length}, ` +
        `research=${research.entries.length}, composedPrompt=${composedSkillPrompt.length} chars`
      )
      loop.startPlanning(instruction, composedSkillPrompt, researchContext)
    },
    [loop, skills, research],
  )

  const handleApprove = useCallback(() => {
    loop.approveOutline()
  }, [loop])

  const handleReset = useCallback(() => {
    loop.reset()
    setEditingInstruction('') // Clear instruction on reset
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
        activeSkillNames={
          skills.activeSkillIds
            .map(id => skills.skills.find(s => s.id === id)?.name)
            .filter(Boolean) as string[]
        }
        researchEntryCount={research.entries.length}
      />

      {/* ── Outline Editor ── */}
      <OutlineEditor
        outline={loop.outline}
        stage={loop.stage}
        loading={loop.loading}
        error={loop.error}
        errorMeta={loop.errorMeta}
        progress={loop.progress}
        preflightSteps={loop.preflightSteps}
        preflightRunning={loop.preflightRunning}
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
        automationLevel={loop.session?.automationLevel}
        onGenerateSection={loop.generateSection}
        editingInstruction={editingInstruction}
        onEditingInstructionChange={setEditingInstruction}
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
  /** Names of active skills for visual feedback */
  activeSkillNames?: string[]
  /** Number of research entries for visual feedback */
  researchEntryCount?: number
}

const stageColorMap: Record<string, string> = {
  idle: 'text-muted-foreground',
  generating: 'text-success',
  'awaiting-outline-approval': 'text-warning',
  reviewing: 'text-primary',
}

function SessionConfigBar({
  session,
  onUpdateConfig,
  onPause: _onPause,
  onReset: _onReset,
  activeSkillNames = [],
  researchEntryCount = 0,
}: SessionConfigBarProps) {
  if (!session) {return null}

  const automationOptions: AutomationLevel[] = ['auto', 'manual']

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

      {/* Skills — show names when active, otherwise just count */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[0.625rem]">Skills</span>
        <button
          onClick={() => {
            // Dispatch a custom event that LaconWorkspace listens for
            window.dispatchEvent(new CustomEvent('lacon:open-skills-tab'))
          }}
          className={cn(
            'font-semibold px-1.5 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1',
            activeSkillNames.length > 0
              ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
              : 'text-foreground hover:bg-secondary',
          )}
          title={
            activeSkillNames.length > 0
              ? `Active: ${activeSkillNames.join(', ')}`
              : 'Open Skills Library'
          }
        >
          ✨ {activeSkillNames.length > 0
            ? activeSkillNames.map(name => (
                <span key={name} className="truncate max-w-[60px] inline-block align-middle">{name}</span>
              )).reduce((prev: any, curr: any, i: number) => [prev, <span key={`sep-${i}`} className="text-amber-400/50 mx-0.5">·</span>, curr] as any)
            : '0'
          }
        </button>
      </div>

      {/* Research entry count */}
      {researchEntryCount > 0 && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('lacon:open-research-tab'))
            }}
            className="font-semibold px-1.5 py-0.5 rounded-md transition-colors cursor-pointer text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 flex items-center gap-1"
            title={`${researchEntryCount} research entries attached`}
          >
            🔬 {researchEntryCount}
          </button>
        </div>
      )}
    </div>
  )
}

function formatStage(stage: string): string {
  return stage.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * LaconStatusBar — Enhanced status bar with loop stage, cost, zen mode
 */

import { Eye,Settings, Zap } from 'lucide-react'
import React, { useEffect,useState } from 'react'

import { Badge } from './ui/Badge'

interface LaconStatusBarProps {
  documentId: string | undefined
  wordCount: number
  writerStage: string
  activeSkills: string[]
  zenMode: boolean
  onZenToggle: () => void
  onSettingsOpen: () => void
}

export function LaconStatusBar({
  documentId,
  wordCount,
  writerStage,
  activeSkills,
  zenMode,
  onZenToggle,
  onSettingsOpen,
}: LaconStatusBarProps) {
  const [sessionCost, setSessionCost] = useState<number>(0)
  const [modelName, setModelName] = useState<string>('')

  // Load session cost
  useEffect(() => {
    if (!documentId) {return}
    const loadCost = async () => {
      try {
        const result = await window.electron?.pricing?.getSessionCost(documentId)
        if (result?.success && result.data) {
          setSessionCost(result.data.totalCost || 0)
        }
        // eslint-disable-next-line no-empty
      } catch {}
    }
    loadCost()
    const interval = setInterval(loadCost, 10000) // refresh every 10s
    return () => clearInterval(interval)
  }, [documentId])

  // Load project model
  useEffect(() => {
    if (!documentId) {return}
    const loadModel = async () => {
      try {
        const result = await window.electron?.pricing?.getProjectModel(documentId)
        if (result?.success && result.data?.modelId) {
          setModelName(result.data.modelId)
        }
        // eslint-disable-next-line no-empty
      } catch {}
    }
    loadModel()
  }, [documentId])

  const formatStage = (stage: string) => {
    if (stage === 'idle') {return null}
    return stage.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const formatCost = (cost: number) => {
    if (cost === 0) {return '$0.00'}
    if (cost < 0.001) {return `$${cost.toFixed(6)}`}
    if (cost < 0.01) {return `$${cost.toFixed(4)}`}
    return `$${cost.toFixed(4)}`
  }

  const readingTime = Math.ceil(wordCount / 230)
  const speakingTime = Math.ceil(wordCount / 150)
  const stageLabel = formatStage(writerStage)

  if (zenMode) {
    return (
      <footer className="lacon-statusbar h-[var(--lacon-statusbar-height)] flex items-center justify-center px-4 text-xs text-muted-foreground/40 bg-transparent">
        <span className="zen-exit-hint">
          Press <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Esc</kbd> to exit Zen mode
        </span>
      </footer>
    )
  }

  return (
    <footer
      className="lacon-statusbar h-[var(--lacon-statusbar-height)] flex items-center justify-between px-4 text-xs text-muted-foreground border-t border-border bg-card/80 backdrop-blur-sm"
      role="status"
      aria-label="Status bar"
      data-testid="status-bar"
    >
      {/* Left: Word count & reading time */}
      <div className="flex items-center gap-3">
        <span>{wordCount.toLocaleString()} words</span>
        {wordCount > 0 && (
          <>
            <span className="text-border">·</span>
            <span>{readingTime} min read</span>
            <span className="text-border">·</span>
            <span>{speakingTime} min speak</span>
          </>
        )}
      </div>

      {/* Center: Writer stage + skills */}
      <div className="flex items-center gap-2">
        {stageLabel && (
          <Badge variant="accent" className="h-5 text-[10px] gap-1 cursor-pointer hover:opacity-80 transition-opacity">
            <Zap className="h-3 w-3" />
            {stageLabel}
          </Badge>
        )}
        {activeSkills.length > 0 && (
          <span className="text-muted-foreground/60">
            {activeSkills.length} skill{activeSkills.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Right: Cost + model + zen toggle + settings */}
      <div className="flex items-center gap-3">
        {sessionCost > 0 && (
          <span className="font-mono text-muted-foreground" title="Session cost">
            {formatCost(sessionCost)}
          </span>
        )}
        {modelName && (
          <span className="text-muted-foreground/60 truncate max-w-[100px]" title={modelName}>
            {modelName}
          </span>
        )}
        <button
          onClick={onZenToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Zen mode (F11)"
          data-testid="zen-toggle"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onSettingsOpen}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Settings (Ctrl+,)"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </footer>
  )
}

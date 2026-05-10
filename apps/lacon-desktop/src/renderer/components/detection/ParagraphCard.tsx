/**
 * ParagraphCard — Individual paragraph analysis result
 *
 * Shows AI detection score, tells, and a "Fix" button that triggers
 * context-aware humanization for that specific paragraph.
 */
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Wand2,
} from 'lucide-react'
import React from 'react'

import type { ParagraphAnalysis } from '../../../shared/detection-types'
import { AI_SCORE_THRESHOLD } from '../../../shared/detection-types'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

interface ParagraphCardProps {
  paragraph: ParagraphAnalysis
  isExpanded: boolean
  onToggle: () => void
  onHumanize: () => void
  isFixing?: boolean
}

export function ParagraphCard({ paragraph, isExpanded, onToggle, onHumanize, isFixing }: ParagraphCardProps) {
  const isFlagged = paragraph.aiScore > AI_SCORE_THRESHOLD

  const borderColor = paragraph.aiScore <= 30
    ? 'border-l-emerald-500'
    : paragraph.aiScore <= 60
      ? 'border-l-amber-500'
      : 'border-l-red-500'

  const scoreBg = paragraph.aiScore <= 30
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : paragraph.aiScore <= 60
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'bg-red-500/10 text-red-600 dark:text-red-400'

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-card/50 p-3 border-l-[3px] transition-all duration-200',
        'hover:bg-card/80 hover:border-border',
        isFixing && 'ring-1 ring-violet-500/30 border-l-violet-500',
        borderColor,
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">¶{paragraph.index + 1}</span>
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-md tabular-nums', scoreBg)}>
            {paragraph.aiScore}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isFlagged && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 text-[10px] gap-1.5 rounded-md font-medium transition-all',
                isFixing
                  ? 'text-violet-500 bg-violet-500/10 cursor-wait'
                  : 'text-primary hover:text-primary hover:bg-primary/10',
              )}
              disabled={isFixing}
              onClick={(e) => { e.stopPropagation(); onHumanize() }}
            >
              {isFixing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Fixing…
                </>
              ) : (
                <>
                  <Wand2 className="h-3 w-3" />
                  Fix
                </>
              )}
            </Button>
          )}
          {isExpanded
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Preview text */}
      <p className="text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-2 mt-1.5">
        {paragraph.text}
      </p>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 space-y-2.5 pt-2 border-t border-border/40 animate-fade-in">
          {/* AI Tells — reasons why this looks AI-generated */}
          {paragraph.tells.length > 0 && (
            <div>
              <span className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-1.5">
                AI Patterns Detected
              </span>
              <div className="flex flex-wrap gap-1">
                {paragraph.tells.map((tell, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px] h-5 px-2 font-normal bg-red-500/[0.06] text-red-500/80 dark:text-red-400/80 border-red-500/10">
                    {tell}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {/* Suggestions */}
          {paragraph.suggestions.length > 0 && (
            <div>
              <span className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-1.5">
                How to Fix
              </span>
              <div className="text-[10px] text-muted-foreground/70 space-y-1 pl-0.5">
                {paragraph.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-primary mt-px text-[8px] flex-shrink-0">→</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

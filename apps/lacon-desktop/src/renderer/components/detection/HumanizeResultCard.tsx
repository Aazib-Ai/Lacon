/**
 * HumanizeResultCard — Before/after comparison for humanized text
 *
 * Shows the original (struck-through) and rewritten (highlighted) text
 * with Accept and Reject actions, plus word count comparison.
 */
import { CheckCircle2, X } from 'lucide-react'
import React from 'react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

interface HumanizeResultCardProps {
  index: number
  original: string
  rewritten: string
  wordCountOriginal?: number
  wordCountRewritten?: number
  onAccept: () => void
  onReject?: () => void
}

export function HumanizeResultCard({
  index,
  original,
  rewritten,
  wordCountOriginal,
  wordCountRewritten,
  onAccept,
  onReject,
}: HumanizeResultCardProps) {
  // Calculate word counts if not provided
  const origWc = wordCountOriginal ?? original.split(/\s+/).filter(Boolean).length
  const newWc = wordCountRewritten ?? rewritten.split(/\s+/).filter(Boolean).length
  const wcDiff = origWc > 0 ? Math.round(((newWc - origWc) / origWc) * 100) : 0
  const wcStatus = Math.abs(wcDiff) <= 10 ? 'good' : Math.abs(wcDiff) <= 20 ? 'warn' : 'bad'

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">¶{index + 1} — Rewrite</span>
        {/* Word count badge */}
        <span className={cn(
          'text-[9px] font-medium px-1.5 py-0.5 rounded-full',
          wcStatus === 'good' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          wcStatus === 'warn' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          wcStatus === 'bad' && 'bg-red-500/10 text-red-600 dark:text-red-400',
        )}>
          {origWc}→{newWc} words ({wcDiff > 0 ? '+' : ''}{wcDiff}%)
        </span>
      </div>

      {/* Original */}
      <div className="rounded-md bg-red-500/5 border border-red-500/10 p-2.5">
        <span className="text-[9px] font-semibold text-red-500 uppercase tracking-wider block mb-1">
          Original
        </span>
        <p className="text-[11px] text-muted-foreground leading-relaxed line-through decoration-red-400/30">
          {original.slice(0, 250)}{original.length > 250 ? '…' : ''}
        </p>
      </div>

      {/* Rewritten */}
      <div className="rounded-md bg-emerald-500/5 border border-emerald-500/10 p-2.5">
        <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider block mb-1">
          Humanized
        </span>
        <p className="text-[11px] text-foreground leading-relaxed">
          {rewritten.slice(0, 250)}{rewritten.length > 250 ? '…' : ''}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        {onReject && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/30"
            onClick={onReject}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        )}
        <Button
          variant="default"
          size="sm"
          className="h-7 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={onAccept}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Apply to Editor
        </Button>
      </div>
    </div>
  )
}

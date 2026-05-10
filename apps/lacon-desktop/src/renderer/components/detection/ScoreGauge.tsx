/**
 * ScoreGauge — Clear, unambiguous AI detection score display
 *
 * Shows a horizontal spectrum bar: Human ← → AI
 * The score is displayed as "X% AI" with clear color coding.
 * No ambiguity about what the number means.
 */
import React from 'react'
import { cn } from '../../lib/utils'

interface ScoreGaugeProps {
  score: number
  level: string
  isScanning: boolean
}

export function ScoreGauge({ score, level, isScanning }: ScoreGaugeProps) {
  // Clear verdict text
  const verdict = score <= 20
    ? 'Likely Human-Written'
    : score <= 40
      ? 'Mostly Human'
      : score <= 60
        ? 'Mixed — Could Be Either'
        : score <= 80
          ? 'Likely AI-Generated'
          : 'Almost Certainly AI'

  const verdictColor = score <= 30
    ? 'text-emerald-500'
    : score <= 60
      ? 'text-amber-500'
      : 'text-red-500'

  const barColor = score <= 30
    ? 'bg-emerald-500'
    : score <= 60
      ? 'bg-amber-500'
      : 'bg-red-500'

  const bgGlow = score <= 30
    ? 'border-emerald-500/20'
    : score <= 60
      ? 'border-amber-500/20'
      : 'border-red-500/20'

  return (
    <div className={cn(
      'rounded-xl border p-4 mx-1 space-y-3',
      bgGlow,
      isScanning && 'animate-pulse',
    )}>
      {/* Verdict — the main message */}
      <div className="text-center">
        <p className={cn('text-sm font-bold', verdictColor)}>
          {isScanning ? 'Scanning…' : verdict}
        </p>
      </div>

      {/* Score bar — visual spectrum */}
      <div className="space-y-1.5">
        {/* Labels */}
        <div className="flex justify-between text-[9px] text-muted-foreground/60 uppercase tracking-widest font-medium">
          <span>Human</span>
          <span>AI</span>
        </div>
        {/* Bar */}
        <div className="relative h-2.5 rounded-full bg-secondary/60 overflow-hidden">
          {/* Gradient background hint */}
          <div className="absolute inset-0 rounded-full opacity-20"
            style={{
              background: 'linear-gradient(to right, #10b981, #f59e0b, #ef4444)',
            }}
          />
          {/* Score indicator */}
          <div
            className={cn('h-full rounded-full transition-all duration-1000 ease-out relative', barColor)}
            style={{ width: isScanning ? '50%' : `${Math.max(4, score)}%` }}
          >
            {/* Glow effect on bar end */}
            <div className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-background shadow-sm',
              barColor,
            )} />
          </div>
        </div>
      </div>

      {/* Score number — clearly labeled */}
      <div className="flex items-center justify-center gap-2">
        <span className={cn('text-2xl font-bold tabular-nums', verdictColor)}>
          {isScanning ? '—' : score}
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground/60 leading-tight">out of 100</span>
          <span className="text-[10px] text-muted-foreground/80 font-medium leading-tight">AI likelihood</span>
        </div>
      </div>

      {/* Explanation — removes all doubt */}
      <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
        {score <= 30
          ? 'Low AI signals detected. This text appears naturally written.'
          : score <= 60
            ? 'Some AI patterns found. This may be AI-assisted or lightly edited AI text.'
            : 'Strong AI patterns detected. This text shows clear signs of AI generation.'
        }
      </p>
    </div>
  )
}

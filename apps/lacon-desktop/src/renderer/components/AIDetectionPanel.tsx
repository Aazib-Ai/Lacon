/**
 * AIDetectionPanel — AI Detection & Humanization UI
 *
 * 4 states: Idle → Scanning → Results → Humanizing
 * Integrates with useAIDetection hook for all 3 layers.
 */

import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react'
import React, { useCallback, useState } from 'react'

import type { HumanizeStyle, ParagraphAnalysis } from '../../shared/detection-types'
import { AI_SCORE_THRESHOLD } from '../../shared/detection-types'
import { cn } from '../lib/utils'
import { useAIDetection } from '../hooks/useAIDetection'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Progress } from './ui/Progress'
import { ScrollArea } from './ui/ScrollArea'
import { Separator } from './ui/Separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/Tooltip'

interface AIDetectionPanelProps {
  documentId: string | undefined
  getEditorText?: () => string
  onReplaceText?: (index: number, newText: string) => void
}

export function AIDetectionPanel({ documentId, getEditorText, onReplaceText }: AIDetectionPanelProps) {
  const detection = useAIDetection()
  const [humanizeStyle, setHumanizeStyle] = useState<HumanizeStyle>('conversational')
  const [expandedParagraph, setExpandedParagraph] = useState<number | null>(null)

  const handleQuickScan = useCallback(() => {
    const text = getEditorText?.()
    if (!text || text.trim().length < 50) return
    detection.quickScan(text)
  }, [getEditorText, detection])

  const handleDeepAnalyze = useCallback(() => {
    const text = getEditorText?.()
    if (!text || text.trim().length < 50) return
    detection.deepAnalyze(text)
  }, [getEditorText, detection])

  const handleHumanizeParagraph = useCallback((para: ParagraphAnalysis) => {
    detection.humanize([{ index: para.index, text: para.fullText }], humanizeStyle)
  }, [detection, humanizeStyle])

  const handleHumanizeAll = useCallback(() => {
    if (!detection.report) return
    const flagged = detection.report.paragraphs
      .filter(p => p.aiScore > AI_SCORE_THRESHOLD)
      .map(p => ({ index: p.index, text: p.fullText }))
    if (flagged.length > 0) {
      detection.humanize(flagged, humanizeStyle)
    }
  }, [detection, humanizeStyle])

  const handleVerifyML = useCallback(() => {
    const text = getEditorText?.()
    if (!text) return
    detection.verifyWithML(text)
  }, [getEditorText, detection])

  const handleAcceptRewrite = useCallback((index: number, newText: string) => {
    onReplaceText?.(index, newText)
    detection.reset()
    // Re-scan after accepting
    setTimeout(() => {
      const text = getEditorText?.()
      if (text) detection.quickScan(text)
    }, 500)
  }, [onReplaceText, getEditorText, detection])

  if (!documentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] h-full" id="ai-detection-panel">
        <p className="text-sm text-muted-foreground">Open a document to scan for AI patterns.</p>
      </div>
    )
  }

  const isScanning = detection.phase === 'heuristic' || detection.phase === 'llm-analyzing'
  const isHumanizing = detection.phase === 'llm-humanizing'
  const isVerifying = detection.phase === 'ml-verifying'
  const flaggedCount = detection.flaggedParagraphCount

  return (
    <div className="flex flex-col h-full" id="ai-detection-panel">
      {/* ── Config Bar (matches SessionConfigBar pattern) ── */}
      <div className="flex items-center gap-3 px-3 py-2 bg-secondary border-b border-border text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium uppercase tracking-wider text-[0.625rem]">Style</span>
          <select
            className="px-1.5 py-0.5 rounded-sm border border-border bg-background text-foreground text-xs cursor-pointer transition-colors focus:outline-none focus:border-primary"
            value={humanizeStyle}
            onChange={e => setHumanizeStyle(e.target.value as HumanizeStyle)}
          >
            <option value="conversational">Conversational</option>
            <option value="academic">Academic</option>
            <option value="professional">Professional</option>
          </select>
        </div>
        {detection.report && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-muted-foreground font-medium uppercase tracking-wider text-[0.625rem]">Source</span>
            <Badge variant="secondary" className="text-[10px] h-5">
              {detection.report.source}
            </Badge>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* ── State: Idle ── */}
          {detection.phase === 'idle' && !detection.report && (
            <IdleState onQuickScan={handleQuickScan} />
          )}

          {/* ── Score Gauge ── */}
          {detection.report && (
            <ScoreGauge
              score={detection.report.overallScore}
              level={detection.report.level}
              isScanning={isScanning}
            />
          )}

          {/* ── Scanning Indicator ── */}
          {isScanning && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 animate-fade-in">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                {detection.phase === 'heuristic' ? 'Running heuristic analysis...' : 'Running deep LLM analysis...'}
              </span>
            </div>
          )}

          {/* ── Action Buttons ── */}
          {detection.report && !isScanning && !isHumanizing && !isVerifying && (
            <div className="grid grid-cols-3 gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-[11px] gap-1" onClick={handleQuickScan}>
                      <Zap className="h-3.5 w-3.5" />
                      Scan
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Quick heuristic scan (&lt;100ms)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="default" size="sm" className="text-[11px] gap-1" onClick={handleDeepAnalyze}>
                      <Brain className="h-3.5 w-3.5" />
                      Analyze
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Deep LLM-based analysis</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px] gap-1"
                      onClick={detection.mlModelReady ? handleVerifyML : detection.initMLModel}
                      disabled={detection.mlModelLoading}
                    >
                      {detection.mlModelLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Cpu className="h-3.5 w-3.5" />
                      )}
                      {detection.mlModelReady ? 'Verify' : 'ML'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {detection.mlModelReady ? 'Verify with RoBERTa ML model' : 'Load ML model (~125MB)'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* ── Paragraph Analysis List ── */}
          {detection.report && detection.report.paragraphs.length > 0 && !isHumanizing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider">
                  Paragraph Analysis
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {detection.report.paragraphs.length} paragraphs
                </span>
              </div>

              {detection.report.paragraphs.map(para => (
                <ParagraphCard
                  key={para.index}
                  paragraph={para}
                  isExpanded={expandedParagraph === para.index}
                  onToggle={() => setExpandedParagraph(expandedParagraph === para.index ? null : para.index)}
                  onHumanize={() => handleHumanizeParagraph(para)}
                  isFlagged={para.aiScore > AI_SCORE_THRESHOLD}
                />
              ))}
            </div>
          )}

          {/* ── Humanize All Button ── */}
          {flaggedCount > 0 && !isHumanizing && !isScanning && (
            <Button
              variant="default"
              className="w-full gap-2 text-sm"
              onClick={handleHumanizeAll}
            >
              <Sparkles className="h-4 w-4" />
              Humanize All Flagged ({flaggedCount})
            </Button>
          )}

          {/* ── Humanizing State ── */}
          {isHumanizing && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Rewriting text to sound more human...</span>
              </div>
              <Progress value={50} className="h-1.5" />
            </div>
          )}

          {/* ── Humanize Results ── */}
          {detection.humanizeResult && !isHumanizing && (
            <div className="space-y-3">
              <span className="text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider">
                Humanized Results
              </span>
              {detection.humanizeResult.paragraphs.map(para => (
                <HumanizeResultCard
                  key={para.index}
                  index={para.index}
                  original={para.original}
                  rewritten={para.rewritten}
                  onAccept={() => handleAcceptRewrite(para.index, para.rewritten)}
                />
              ))}
            </div>
          )}

          {/* ── ML Verification Section ── */}
          {detection.report && !isHumanizing && (
            <>
              <Separator />
              <MLSection
                mlResult={detection.mlResult}
                mlModelReady={detection.mlModelReady}
                mlModelLoading={detection.mlModelLoading}
                mlProgress={detection.mlProgress}
                isVerifying={isVerifying}
                onInitModel={detection.initMLModel}
                onVerify={handleVerifyML}
              />
            </>
          )}

          {/* ── Error Display ── */}
          {detection.error && (
            <div className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs animate-fade-in">
              {detection.error}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─────────────────────────── Sub-Components ───────────────────────────

function IdleState({ onQuickScan }: { onQuickScan: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4">
        <ShieldCheck className="h-8 w-8 text-primary/60" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">AI Detection</h3>
      <p className="text-xs text-muted-foreground max-w-[220px] mb-4 leading-relaxed">
        Scan your text for AI-generated patterns and humanize flagged paragraphs.
      </p>
      <Button variant="default" size="sm" className="gap-1.5" onClick={onQuickScan}>
        <Zap className="h-3.5 w-3.5" />
        Quick Scan
      </Button>
    </div>
  )
}

function ScoreGauge({ score, level, isScanning }: { score: number; level: string; isScanning: boolean }) {
  // SVG circular gauge
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const scoreColor = score <= 30
    ? 'text-success'
    : score <= 60
      ? 'text-warning'
      : 'text-destructive'

  const strokeColor = score <= 30
    ? 'stroke-success'
    : score <= 60
      ? 'stroke-warning'
      : 'stroke-destructive'

  const badgeVariant = level === 'human' ? 'success' : level === 'mixed' ? 'warning' : 'destructive'
  const badgeLabel = level === 'human' ? '🟢 Human-like' : level === 'mixed' ? '🟡 Mixed' : '🔴 AI Detected'

  return (
    <div className="flex flex-col items-center py-3 animate-fade-in">
      <div className="relative w-24 h-24 mb-2">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          {/* Background ring */}
          <circle
            cx="50" cy="50" r={radius}
            stroke="currentColor"
            className="text-border"
            strokeWidth="6"
            fill="none"
          />
          {/* Score ring */}
          <circle
            cx="50" cy="50" r={radius}
            className={cn(strokeColor, isScanning && 'animate-pulse')}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isScanning ? circumference * 0.7 : offset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        {/* Center score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold', scoreColor)}>
            {isScanning ? '...' : score}
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">AI Score</span>
        </div>
      </div>
      <Badge variant={badgeVariant} className="text-[10px]">{badgeLabel}</Badge>
    </div>
  )
}

function ParagraphCard({
  paragraph,
  isExpanded,
  onToggle,
  onHumanize,
  isFlagged,
}: {
  paragraph: ParagraphAnalysis
  isExpanded: boolean
  onToggle: () => void
  onHumanize: () => void
  isFlagged: boolean
}) {
  const borderColor = paragraph.aiScore <= 30
    ? 'border-l-success'
    : paragraph.aiScore <= 60
      ? 'border-l-warning'
      : 'border-l-destructive'

  const badgeVariant = paragraph.aiScore <= 30 ? 'success' : paragraph.aiScore <= 60 ? 'warning' : 'destructive'

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-2.5 border-l-[3px] transition-colors hover:bg-card/80',
        borderColor,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-foreground">¶{paragraph.index + 1}</span>
          <Badge variant={badgeVariant} className="text-[10px] h-4 px-1.5">
            {paragraph.aiScore}%
          </Badge>
        </div>
        {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </div>

      {/* Preview text */}
      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mb-1.5">
        {paragraph.text}
      </p>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {/* Tells */}
          <div className="flex flex-wrap gap-1">
            {paragraph.tells.map((tell, i) => (
              <Badge key={i} variant="secondary" className="text-[9px] h-4 px-1.5 font-normal">
                {tell}
              </Badge>
            ))}
          </div>
          {/* Suggestions */}
          {paragraph.suggestions.length > 0 && (
            <div className="text-[10px] text-muted-foreground/80 space-y-0.5">
              {paragraph.suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-1">
                  <span className="text-primary">›</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Humanize button (only for flagged) */}
      {isFlagged && (
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary" onClick={onHumanize}>
            <Wand2 className="h-3 w-3" />
            Humanize
          </Button>
        </div>
      )}
    </div>
  )
}

function HumanizeResultCard({
  index,
  original,
  rewritten,
  onAccept,
}: {
  index: number
  original: string
  rewritten: string
  onAccept: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 animate-fade-in">
      <span className="text-[11px] font-medium text-foreground">¶{index + 1}</span>
      {/* Original */}
      <div className="rounded-md bg-destructive/5 border border-destructive/15 p-2">
        <span className="text-[9px] font-medium text-destructive uppercase tracking-wider block mb-1">Original</span>
        <p className="text-[11px] text-muted-foreground leading-relaxed line-through decoration-destructive/30">{original.slice(0, 200)}</p>
      </div>
      {/* Rewritten */}
      <div className="rounded-md bg-success/5 border border-success/15 p-2">
        <span className="text-[9px] font-medium text-success uppercase tracking-wider block mb-1">Rewritten</span>
        <p className="text-[11px] text-foreground leading-relaxed">{rewritten.slice(0, 200)}</p>
      </div>
      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="default" size="sm" className="h-6 text-[10px] gap-1" onClick={onAccept}>
          <CheckCircle2 className="h-3 w-3" />
          Accept
        </Button>
      </div>
    </div>
  )
}

function MLSection({
  mlResult,
  mlModelReady,
  mlModelLoading,
  mlProgress,
  isVerifying,
  onInitModel,
  onVerify,
}: {
  mlResult: any
  mlModelReady: boolean
  mlModelLoading: boolean
  mlProgress: string
  isVerifying: boolean
  onInitModel: () => void
  onVerify: () => void
}) {
  return (
    <div className="space-y-2">
      <span className="text-[0.625rem] font-medium text-muted-foreground uppercase tracking-wider">
        ML Verification
      </span>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Cpu className="h-3.5 w-3.5" />
        <span>RoBERTa OpenAI Detector (q8)</span>
        {mlModelReady && <CheckCircle2 className="h-3 w-3 text-success ml-auto" />}
      </div>

      {/* Model loading progress */}
      {mlModelLoading && (
        <div className="space-y-1.5 animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-[11px] text-muted-foreground">{mlProgress || 'Loading model...'}</span>
          </div>
          <Progress value={30} className="h-1" />
        </div>
      )}

      {/* Action button */}
      {!mlModelReady && !mlModelLoading && (
        <Button variant="ghost" size="sm" className="w-full text-[11px] gap-1.5" onClick={onInitModel}>
          <Download className="h-3.5 w-3.5" />
          Download ML Model (~125MB)
        </Button>
      )}

      {mlModelReady && !isVerifying && (
        <Button variant="ghost" size="sm" className="w-full text-[11px] gap-1.5" onClick={onVerify}>
          <RefreshCw className="h-3.5 w-3.5" />
          Verify with ML
        </Button>
      )}

      {isVerifying && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Running ML classification...</span>
        </div>
      )}

      {/* ML Results */}
      {mlResult && (
        <div className="space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">ML Score</span>
            <Badge variant={mlResult.overallScore <= 30 ? 'success' : mlResult.overallScore <= 60 ? 'warning' : 'destructive'} className="text-[10px]">
              {mlResult.overallScore}%
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {mlResult.inferenceTimeMs}ms · {mlResult.sentences.length} sentences analyzed
          </div>
          {/* Top flagged sentences */}
          {mlResult.sentences
            .filter((s: any) => s.aiProbability > 50)
            .slice(0, 3)
            .map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', s.aiProbability > 70 ? 'bg-destructive' : 'bg-warning')}
                    style={{ width: `${s.aiProbability}%` }}
                  />
                </div>
                <span className="text-muted-foreground truncate flex-1">{s.text}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

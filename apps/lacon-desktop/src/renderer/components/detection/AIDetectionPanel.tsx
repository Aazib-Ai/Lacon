/**
 * AIDetectionPanel — AI Detection & Humanization UI
 *
 * States: Idle → Scanning → Results → Humanizing
 * Supports 3 layers: Heuristic (free) | LLM (provider) | API (Sapling/Winston)
 *
 * Fix flow: Per-paragraph inline fix with tells context → accept/reject in place.
 */

import {
  Brain,
  ChevronRight,
  Key,
  Loader2,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import type { DetectionApiProvider, HumanizeStyle, ParagraphAnalysis } from '../../../shared/detection-types'
import { AI_SCORE_THRESHOLD } from '../../../shared/detection-types'
import { cn } from '../../lib/utils'
import { useAIDetection } from '../../hooks/useAIDetection'
import { Button } from '../ui/Button'
import { Progress } from '../ui/Progress'
import { ScrollArea } from '../ui/ScrollArea'

import { ScoreGauge } from './ScoreGauge'
import { ParagraphCard } from './ParagraphCard'
import { HumanizeResultCard } from './HumanizeResultCard'
import { DetectionSettings } from './DetectionSettings'


interface AIDetectionPanelProps {
  documentId: string | undefined
  getEditorText?: () => string
  onReplaceText?: (index: number, newText: string) => void
  onReplaceFullText?: (newText: string) => void
}

export function AIDetectionPanel({ documentId, getEditorText, onReplaceText, onReplaceFullText }: AIDetectionPanelProps) {
  const detection = useAIDetection()
  const [humanizeStyle, setHumanizeStyle] = useState<HumanizeStyle>('conversational')
  const [expandedParagraph, setExpandedParagraph] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  // Per-paragraph fix state: tracks which paragraph is being fixed inline
  const [fixingParagraphIndex, setFixingParagraphIndex] = useState<number | null>(null)
  // Auto-apply mode: when true, humanize results are automatically applied to editor
  const [autoApplyMode, setAutoApplyMode] = useState(false)
  const [autoApplyProgress, setAutoApplyProgress] = useState<{ applied: number; total: number } | null>(null)

  // Determine which API provider is available
  const configuredProvider: DetectionApiProvider | null =
    detection.saplingKey?.exists ? 'sapling' :
    detection.winstonKey?.exists ? 'winston' :
    null

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

  const handleApiScan = useCallback(() => {
    if (!configuredProvider) {
      setShowSettings(true)
      return
    }
    const text = getEditorText?.()
    if (!text || text.trim().length < 50) return
    detection.apiAnalyze(text, configuredProvider)
  }, [getEditorText, detection, configuredProvider])

  /**
   * Fix a single paragraph — sends the paragraph text along with its AI tells
   * and suggestions so the LLM knows exactly what patterns to remove.
   */
  const handleFixParagraph = useCallback((para: ParagraphAnalysis) => {
    setFixingParagraphIndex(para.index)
    setExpandedParagraph(para.index)
    detection.humanize(
      [{
        index: para.index,
        text: para.fullText,
        tells: para.tells,
        suggestions: para.suggestions,
        aiScore: para.aiScore,
      }],
      humanizeStyle,
    )
  }, [detection, humanizeStyle])

  const handleHumanizeAll = useCallback(() => {
    if (!detection.report) return
    const fullText = getEditorText?.()
    const flagged = detection.report.paragraphs
      .filter(p => p.aiScore > AI_SCORE_THRESHOLD)
      .map(p => ({
        index: p.index,
        text: p.fullText,
        tells: p.tells,
        suggestions: p.suggestions,
        aiScore: p.aiScore,
      }))
    if (flagged.length > 0) {
      setFixingParagraphIndex(null) // humanizing all, not one specific
      detection.humanize(flagged, humanizeStyle, fullText)
    }
  }, [detection, humanizeStyle, getEditorText])

  /**
   * "Humanize It" — rewrite full document and auto-apply to editor.
   * Sends the entire document text for document-level humanization.
   */
  const handleHumanizeItAll = useCallback(() => {
    if (!detection.report) return
    const fullText = getEditorText?.()
    const flagged = detection.report.paragraphs
      .filter(p => p.aiScore > AI_SCORE_THRESHOLD)
      .map(p => ({
        index: p.index,
        text: p.fullText,
        tells: p.tells,
        suggestions: p.suggestions,
        aiScore: p.aiScore,
      }))
    if (flagged.length > 0) {
      setFixingParagraphIndex(null)
      setAutoApplyMode(true)
      setAutoApplyProgress({ applied: 0, total: flagged.length })
      detection.humanize(flagged, humanizeStyle, fullText)
    }
  }, [detection, humanizeStyle, getEditorText])

  // ── Auto-apply watcher: when results arrive in autoApplyMode, apply them all ──
  useEffect(() => {
    if (!autoApplyMode || !detection.humanizeResult || detection.phase === 'llm-humanizing') return

    const results = detection.humanizeResult.paragraphs
    if (results.length === 0) {
      setAutoApplyMode(false)
      setAutoApplyProgress(null)
      return
    }

    // Prefer document-level replacement (single atomic operation)
    if (detection.humanizeResult.rewrittenFullText && onReplaceFullText) {
      onReplaceFullText(detection.humanizeResult.rewrittenFullText)
    } else {
      // Fallback: per-paragraph replacement (reverse order to preserve indices)
      const sorted = [...results].sort((a, b) => b.index - a.index)
      for (const para of sorted) {
        if (para.rewritten && para.rewritten.trim()) {
          onReplaceText?.(para.index, para.rewritten)
        }
      }
    }

    setAutoApplyProgress({ applied: results.length, total: results.length })

    // Clear state and re-scan after a brief delay
    setTimeout(() => {
      setAutoApplyMode(false)
      setAutoApplyProgress(null)
      detection.reset()
      setTimeout(() => {
        const text = getEditorText?.()
        if (text) detection.quickScan(text)
      }, 300)
    }, 1500) // Show success message for 1.5s
  }, [autoApplyMode, detection.humanizeResult, detection.phase])

  /**
   * Accept a rewrite: apply to editor, then re-scan to update scores.
   */
  const handleAcceptRewrite = useCallback((index: number, newText: string) => {
    onReplaceText?.(index, newText)
    setFixingParagraphIndex(null)
    // Clear humanize result but keep report — re-scan to see updated scores
    detection.reset()
    setTimeout(() => {
      const text = getEditorText?.()
      if (text) detection.quickScan(text)
    }, 500)
  }, [onReplaceText, getEditorText, detection])

  /**
   * Reject a rewrite: dismiss the result, keep original text and report.
   */
  const handleRejectRewrite = useCallback(() => {
    setFixingParagraphIndex(null)
    detection.clearHumanizeResult()
  }, [detection])

  // ── Settings View ──
  if (showSettings) {
    return (
      <DetectionSettings
        onClose={() => setShowSettings(false)}
        onKeysChanged={() => detection.refreshApiKeys()}
      />
    )
  }

  // ── No document open ──
  if (!documentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] h-full" id="ai-detection-panel">
        <p className="text-sm text-muted-foreground">Open a document to scan for AI patterns.</p>
      </div>
    )
  }

  const isScanning = detection.phase === 'heuristic' || detection.phase === 'llm-analyzing' || detection.phase === 'api-analyzing'
  const isHumanizing = detection.phase === 'llm-humanizing'

  const flaggedCount = detection.flaggedParagraphCount

  // Source label for results
  const sourceLabel = detection.report?.source === 'sapling' ? 'Sapling AI'
    : detection.report?.source === 'winston' ? 'Winston AI'
    : detection.report?.source === 'llm' ? 'LLM'
    : detection.report?.source === 'combined' ? 'Combined'
    : 'Heuristic'

  // Find the humanize result for a specific paragraph (for inline display)
  const getHumanizeResultForPara = (paraIndex: number) => {
    if (!detection.humanizeResult) return null
    return detection.humanizeResult.paragraphs.find(p => p.index === paraIndex)
  }

  return (
    <div className="flex flex-col h-full" id="ai-detection-panel">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">

          {/* ── Idle State ── */}
          {detection.phase === 'idle' && !detection.report && (
            <div className="flex flex-col items-center relative">
              {/* Settings gear — top right */}
              <button
                onClick={() => setShowSettings(true)}
                className="absolute top-0 right-0 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                title="Detection Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>

              {/* Icon + header */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 via-violet-500/8 to-indigo-500/10 flex items-center justify-center mb-4 mt-2 ring-1 ring-blue-500/10">
                <ShieldCheck className="h-8 w-8 text-blue-500/60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1 tracking-tight">AI Detection</h3>
              <p className="text-xs text-muted-foreground/70 text-center max-w-[220px] mb-6 leading-relaxed">
                Scan your text for AI patterns and humanize flagged paragraphs.
              </p>

              {/* ── Scan Action Cards ── */}
              <div className="w-full space-y-2.5">

                {/* Quick Scan — Primary action */}
                <button
                  onClick={handleQuickScan}
                  className="detection-action-card group w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card/60 hover:bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200 text-left"
                  id="detection-quick-scan"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 flex items-center justify-center group-hover:from-blue-500/25 group-hover:to-blue-600/20 transition-colors">
                    <Zap className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-foreground block leading-tight">Quick Scan</span>
                    <span className="text-[11px] text-muted-foreground/70 leading-tight">Heuristic pattern analysis · Instant</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                </button>

                {/* Deep Analysis */}
                <button
                  onClick={handleDeepAnalyze}
                  className="detection-action-card group w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card/60 hover:bg-card hover:border-violet-500/30 hover:shadow-sm transition-all duration-200 text-left"
                  id="detection-deep-analyze"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-600/10 flex items-center justify-center group-hover:from-violet-500/25 group-hover:to-purple-600/20 transition-colors">
                    <Brain className="h-5 w-5 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-foreground block leading-tight">Deep Analysis</span>
                    <span className="text-[11px] text-muted-foreground/70 leading-tight">LLM-powered verification · Thorough</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-violet-500/60 transition-colors flex-shrink-0" />
                </button>

                {/* API Scan — if configured */}
                {configuredProvider ? (
                  <button
                    onClick={handleApiScan}
                    className="detection-action-card group w-full flex items-center gap-3 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] hover:border-emerald-500/30 hover:shadow-sm transition-all duration-200 text-left"
                    id="detection-api-scan"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-600/10 flex items-center justify-center group-hover:from-emerald-500/25 group-hover:to-teal-600/20 transition-colors">
                      <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-semibold text-foreground block leading-tight">
                        API Scan
                        <span className="text-[10px] font-medium text-emerald-500 ml-1.5 align-middle">
                          {configuredProvider === 'sapling' ? 'Sapling' : 'Winston'}
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground/70 leading-tight">Professional-grade · 99%+ accuracy</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-emerald-500/60 transition-colors flex-shrink-0" />
                  </button>
                ) : (
                  /* Add API Key — upsell card */
                  <button
                    onClick={() => setShowSettings(true)}
                    className="detection-action-card group w-full flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-border/60 bg-transparent hover:bg-primary/[0.03] hover:border-primary/30 transition-all duration-200 text-left"
                    id="detection-add-api"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Key className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground block leading-tight transition-colors">Add API Key</span>
                      <span className="text-[11px] text-muted-foreground/50 leading-tight">Unlock 99%+ accuracy with Sapling or Winston</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary/40 transition-colors flex-shrink-0" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Score Gauge ── */}
          {detection.report && (
            <div className="relative">
              <ScoreGauge
                score={detection.report.overallScore}
                level={detection.report.level}
                isScanning={isScanning}
              />
              {/* Source badge */}
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className={cn(
                  'text-[9px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider',
                  detection.report.source === 'sapling' || detection.report.source === 'winston'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {sourceLabel}
                </span>
                {/* Settings gear in results view */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                  title="Detection Settings"
                >
                  <Settings className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* ── Scanning Indicator ── */}
          {isScanning && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-xs text-muted-foreground">
                {detection.phase === 'heuristic'
                  ? 'Running pattern analysis...'
                  : detection.phase === 'api-analyzing'
                  ? `Analyzing with ${configuredProvider === 'sapling' ? 'Sapling' : 'Winston AI'}...`
                  : 'Deep LLM analysis in progress...'}
              </span>
            </div>
          )}

          {/* ── Action Buttons (after results) ── */}
          {detection.report && !isScanning && !isHumanizing && (
            <div className="space-y-1.5">
              {configuredProvider && (
                <button
                  onClick={handleApiScan}
                  className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] hover:border-emerald-500/25 transition-all text-left"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="text-[11px] font-medium text-foreground flex-1">API Scan</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                </button>
              )}
              <div className="flex gap-1.5">
                <button
                  onClick={handleQuickScan}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border/60 bg-card/60 hover:bg-card hover:border-border text-[11px] font-medium text-foreground transition-all"
                >
                  <Zap className="h-3.5 w-3.5 text-blue-500" />
                  Re-scan
                </button>
                <button
                  onClick={handleDeepAnalyze}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border/60 bg-card/60 hover:bg-card hover:border-border text-[11px] font-medium text-foreground transition-all"
                >
                  <Brain className="h-3.5 w-3.5 text-violet-500" />
                  Deep
                </button>
              </div>
            </div>
          )}

          {/* ── Style selector ── */}
          {detection.report && !isScanning && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Style</span>
              <select
                className="flex-1 px-2 py-1 rounded-md border border-border bg-background text-foreground text-[11px] cursor-pointer transition-colors focus:outline-none focus:border-primary"
                value={humanizeStyle}
                onChange={e => setHumanizeStyle(e.target.value as HumanizeStyle)}
              >
                <option value="conversational">Conversational</option>
                <option value="academic">Academic</option>
                <option value="professional">Professional</option>
              </select>
            </div>
          )}

          {/* ── Paragraph List ── */}
          {detection.report && detection.report.paragraphs.length > 0 && (!isHumanizing || fixingParagraphIndex !== null) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Paragraphs
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {detection.report.paragraphs.length} found · {flaggedCount} flagged
                </span>
              </div>

              {detection.report.paragraphs.map(para => {
                const inlineResult = getHumanizeResultForPara(para.index)
                return (
                  <div key={para.index}>
                    <ParagraphCard
                      paragraph={para}
                      isExpanded={expandedParagraph === para.index}
                      onToggle={() => setExpandedParagraph(expandedParagraph === para.index ? null : para.index)}
                      onHumanize={() => handleFixParagraph(para)}
                      isFixing={fixingParagraphIndex === para.index && isHumanizing}
                    />
                    {/* ── Inline Fix Result — shown directly under the paragraph card ── */}
                    {inlineResult && !isHumanizing && fixingParagraphIndex === para.index && (
                      <div className="ml-2 mt-1 animate-fade-in">
                        <HumanizeResultCard
                          index={inlineResult.index}
                          original={inlineResult.original}
                          rewritten={inlineResult.rewritten}
                          wordCountOriginal={inlineResult.wordCountOriginal}
                          wordCountRewritten={inlineResult.wordCountRewritten}
                          onAccept={() => handleAcceptRewrite(inlineResult.index, inlineResult.rewritten)}
                          onReject={handleRejectRewrite}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Humanize All Results (when not fixing a single paragraph) ── */}
          {detection.humanizeResult && !isHumanizing && fixingParagraphIndex === null && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Humanized Results
              </span>
              {detection.humanizeResult.paragraphs.map(para => (
                <HumanizeResultCard
                  key={para.index}
                  index={para.index}
                  original={para.original}
                  rewritten={para.rewritten}
                  wordCountOriginal={para.wordCountOriginal}
                  wordCountRewritten={para.wordCountRewritten}
                  onAccept={() => handleAcceptRewrite(para.index, para.rewritten)}
                  onReject={handleRejectRewrite}
                />
              ))}
            </div>
          )}

          {/* ── Humanize It (auto-apply) ── */}
          {flaggedCount > 0 && !isHumanizing && !isScanning && !detection.humanizeResult && !autoApplyMode && (
            <div className="space-y-1.5">
              <Button
                variant="default"
                className="w-full gap-2 text-[12px] h-10 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-sm shadow-violet-500/20"
                onClick={handleHumanizeItAll}
                id="detection-humanize-it"
              >
                <Wand2 className="h-4 w-4" />
                Humanize It — Fix All {flaggedCount} Paragraph{flaggedCount > 1 ? 's' : ''}
              </Button>
              <button
                onClick={handleHumanizeAll}
                className="w-full text-center text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
              >
                or review changes individually
              </button>
            </div>
          )}

          {/* ── Auto-apply success feedback ── */}
          {autoApplyProgress && !isHumanizing && autoApplyProgress.applied > 0 && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Applied {autoApplyProgress.applied} humanized paragraph{autoApplyProgress.applied > 1 ? 's' : ''} to editor
              </span>
            </div>
          )}

          {/* ── Humanizing State (batch only — single-fix shows inline on card) ── */}
          {isHumanizing && fixingParagraphIndex === null && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-violet-500/5 border border-violet-500/10">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                <span className="text-xs text-muted-foreground">
                  {autoApplyMode
                    ? 'Humanizing all flagged paragraphs — will auto-apply...'
                    : 'Rewriting to sound human...'
                  }
                </span>
              </div>
              <Progress value={autoApplyMode ? 40 : 50} className="h-1.5" />
            </div>
          )}

          {/* ── Error ── */}
          {detection.error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs">
              {detection.error}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

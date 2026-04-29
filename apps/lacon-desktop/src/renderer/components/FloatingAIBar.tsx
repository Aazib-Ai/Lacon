/**
 * FloatingAIBar — Context-aware AI input at the bottom of the editor
 *
 * - No selection: "Tell AI what to write..." → triggers planning
 * - Text selected: "How should AI change this?" → triggers surgical edit
 * - Shows error feedback when API calls fail
 * - Shows elapsed time for long operations
 */

import { AlertCircle, ArrowUp, Loader2,Sparkles, X } from 'lucide-react'
import React, { useEffect,useRef, useState } from 'react'

import { cn } from '@/renderer/lib/utils'

import { Button } from './ui/Button'

interface FloatingAIBarProps {
  documentId: string | undefined
  writerStage: string
  onStartPlanning: (instruction: string) => void
  _onSurgicalEdit: (paragraphId: string, instruction: string, fullDocumentContent: any) => Promise<any>
}

export function FloatingAIBar({ documentId, writerStage, onStartPlanning, _onSurgicalEdit }: FloatingAIBarProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Listen for text selection in the editor
  useEffect(() => {
    const checkSelection = () => {
      const selection = window.getSelection()
      setHasSelection(!!(selection && selection.toString().trim().length > 0))
    }
    document.addEventListener('selectionchange', checkSelection)
    return () => document.removeEventListener('selectionchange', checkSelection)
  }, [])

  // Ctrl+/ to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Track elapsed time during loading
  useEffect(() => {
    if (!isLoading) {
      setElapsed(0)
      return
    }
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [isLoading])

  // Auto-dismiss errors after 8 seconds
  const showError = (message: string) => {
    setError(message)
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
    }
    errorTimerRef.current = setTimeout(() => {
      setError(null)
      errorTimerRef.current = null
    }, 8000)
  }

  const dismissError = () => {
    setError(null)
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !documentId || isLoading) {return}

    setIsLoading(true)
    dismissError()
    try {
      if (hasSelection) {
        // Surgical edit mode — for now, just pass as planning instruction
        // In full integration, this would get the paragraph ID from the editor
        onStartPlanning(input.trim())
      } else {
        // Planning mode
        onStartPlanning(input.trim())
      }
      setInput('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      showError(message)
      console.error('AI action failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getPlaceholder = () => {
    if (hasSelection) {return 'How should AI change this selection?'}
    if (writerStage === 'idle') {return 'Describe what you want to write...'}
    return 'Tell AI what else needs to be changed...'
  }

  const placeholder = getPlaceholder()

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20 animate-slide-in-up" data-testid="floating-ai-bar">
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg border backdrop-blur-md transition-all duration-200 min-w-[560px] max-w-[700px]',
          'bg-card/95 border-border/60',
          'hover:shadow-xl hover:border-border',
          'focus-within:shadow-xl focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20',
          hasSelection && 'border-accent/40 focus-within:border-accent/60 focus-within:ring-accent/20',
          error && 'border-red-500/40',
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
            error ? 'bg-red-500/15 text-red-400' :
            hasSelection ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary',
          )}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
           error ? <AlertCircle className="h-4 w-4" /> :
           <Sparkles className="h-4 w-4" />}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading || !documentId}
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
          aria-label="AI instruction input"
          data-testid="ai-input"
        />

        {/* Loading elapsed indicator */}
        {isLoading && elapsed > 3 && (
          <span className="text-[10px] font-mono text-muted-foreground/60 flex-shrink-0 tabular-nums">
            {elapsed}s
          </span>
        )}

        {/* Mode badge */}
        {hasSelection && !isLoading && (
          <span className="text-[10px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full flex-shrink-0">
            Edit Selection
          </span>
        )}

        {/* Submit */}
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading || !documentId}
          className={cn(
            'h-8 w-8 rounded-full flex-shrink-0 transition-all',
            input.trim()
              ? 'bg-foreground text-background hover:bg-foreground/90 scale-100'
              : 'bg-muted text-muted-foreground scale-95',
          )}
          data-testid="ai-submit"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>

      {/* Error toast */}
      {error && (
        <div className="mt-2 mx-auto max-w-[600px] flex items-start gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-md animate-slide-in-up">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              Check your provider settings or try again.
            </p>
          </div>
          <button
            onClick={dismissError}
            className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Keyboard hint */}
      {!error && (
        <div className="text-center mt-1.5">
          <span className="text-[10px] text-muted-foreground/40">
            <kbd className="font-mono">Ctrl+/</kbd> to focus
          </span>
        </div>
      )}
    </div>
  )
}

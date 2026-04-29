/**
 * FloatingAIBar — Context-aware AI input at the bottom of the editor
 *
 * - No selection: "Tell AI what to write..." → triggers planning
 * - Text selected: "How should AI change this?" → triggers surgical edit
 */

import { ArrowUp, Loader2,Sparkles } from 'lucide-react'
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
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !documentId || isLoading) {return}

    setIsLoading(true)
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
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
            hasSelection ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary',
          )}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
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

        {/* Mode badge */}
        {hasSelection && (
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

      {/* Keyboard hint */}
      <div className="text-center mt-1.5">
        <span className="text-[10px] text-muted-foreground/40">
          <kbd className="font-mono">Ctrl+/</kbd> to focus
        </span>
      </div>
    </div>
  )
}

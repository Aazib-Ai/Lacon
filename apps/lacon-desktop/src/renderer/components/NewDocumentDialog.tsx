/**
 * NewDocumentDialog — Clean "New File" dialog
 *
 * Simple text input for the file name. Creates a new file
 * in the active project folder. Writer-friendly.
 */

import { FileText, Loader2, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/renderer/lib/utils'

import { Button } from './ui/Button'

interface NewDocumentDialogProps {
  open: boolean
  onClose: () => void
  onCreateFile: (fileName: string) => Promise<any>
}

export function NewDocumentDialog({ open, onClose, onCreateFile }: NewDocumentDialogProps) {
  const [fileName, setFileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Reset + focus when dialog opens
  useEffect(() => {
    if (open) {
      setFileName('')
      setError(null)
      setCreating(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Close on overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose],
  )

  const handleCreate = useCallback(async () => {
    const trimmed = fileName.trim()
    if (!trimmed) {
      setError('Please enter a file name')
      return
    }

    try {
      setCreating(true)
      setError(null)
      const result = await onCreateFile(trimmed)
      if (result) {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file')
    } finally {
      setCreating(false)
    }
  }, [fileName, onCreateFile, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleOverlayClick}
      data-testid="new-file-dialog-overlay"
    >
      <div
        className={cn(
          'bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-slide-in-up',
          'w-full max-w-md mx-4 flex flex-col',
        )}
        data-testid="new-file-dialog"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">New File</h2>
              <p className="text-xs text-muted-foreground">
                Create a new document in your project
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            data-testid="close-new-file-dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ─── Body ─── */}
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="new-file-name" className="block text-sm font-medium text-foreground mb-1.5">
              File name
            </label>
            <input
              ref={inputRef}
              id="new-file-name"
              type="text"
              value={fileName}
              onChange={e => {
                setFileName(e.target.value)
                setError(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !creating) handleCreate()
              }}
              placeholder="my-story"
              className={cn(
                'w-full h-10 px-3 text-sm bg-background border rounded-lg outline-none transition-all',
                'focus:ring-2 focus:ring-ring focus:border-transparent',
                'placeholder:text-muted-foreground/50',
                error ? 'border-destructive' : 'border-border',
              )}
              disabled={creating}
              autoComplete="off"
              data-testid="new-file-name-input"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {fileName.includes('.') ? '' : '.lacon will be added automatically'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-secondary/20">
          <Button variant="outline" size="sm" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !fileName.trim()}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="create-file-btn"
          >
            {creating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

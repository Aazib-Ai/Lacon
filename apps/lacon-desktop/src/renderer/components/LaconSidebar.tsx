/**
 * LaconSidebar — Project navigation with skill badges
 */

import { FileText, FolderOpen,Plus, Search, Settings, Sparkles } from 'lucide-react'
import React, { useState } from 'react'

import { cn } from '@/renderer/lib/utils'

import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ScrollArea } from './ui/ScrollArea'
import { Separator } from './ui/Separator'

interface LaconSidebarProps {
  documentId: string | undefined
  onNewDocument: () => void
  onOpenSettings: () => void
  writerStage: string
  activeSkillCount: number
}

export function LaconSidebar({
  documentId,
  onNewDocument,
  onOpenSettings,
  writerStage,
  activeSkillCount,
}: LaconSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Mock documents for now — will be replaced with real data from workspace service
  const documents = [{ id: 'doc-1', title: 'Welcome to LACON', updatedAt: new Date(), wordCount: 0 }]

  const filteredDocs = documents.filter(doc => doc.title.toLowerCase().includes(searchQuery.toLowerCase()))

  const formatStage = (stage: string): string => {
    if (stage === 'idle') {return ''}
    return stage.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <div className="flex flex-col h-full animate-fade-in" data-testid="sidebar-content">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 h-[var(--lacon-header-height)] border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">LACON</span>
        </div>
      </div>

      {/* ─── New Document ─── */}
      <div className="p-3">
        <Button
          onClick={onNewDocument}
          className="w-full justify-start gap-2 h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="new-document-btn"
        >
          <Plus className="h-4 w-4" />
          New Document
        </Button>
      </div>

      {/* ─── Search ─── */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm bg-secondary/50 border border-border rounded-md outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground/60"
            aria-label="Search documents"
            data-testid="sidebar-search"
          />
        </div>
      </div>

      <Separator />

      {/* ─── Document List ─── */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{searchQuery ? 'No documents found' : 'No documents yet'}</p>
            </div>
          ) : (
            filteredDocs.map(doc => (
              <button
                key={doc.id}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group',
                  documentId === doc.id ? 'bg-primary/10 text-foreground' : 'hover:bg-secondary/80 text-foreground/80',
                )}
                data-testid={`doc-${doc.id}`}
              >
                <div className="flex items-start gap-2.5">
                  <FileText
                    className={cn(
                      'h-4 w-4 mt-0.5 flex-shrink-0 transition-colors',
                      documentId === doc.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-sm font-medium truncate', documentId === doc.id && 'text-primary')}>
                      {doc.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* ─── Active Session Info ─── */}
      {writerStage !== 'idle' && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-foreground">{formatStage(writerStage)}</span>
          </div>
          {activeSkillCount > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                <Sparkles className="h-3 w-3" />
                {activeSkillCount} skill{activeSkillCount !== 1 ? 's' : ''} active
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* ─── Footer ─── */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          data-testid="settings-btn"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <span className="text-[10px] text-muted-foreground">v0.1.0</span>
      </div>
    </div>
  )
}

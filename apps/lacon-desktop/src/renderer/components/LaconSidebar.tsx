/**
 * LaconSidebar — Project file tree for writers
 *
 * Shows the active project folder's files.
 * Simple and clean — no unnecessary technical clutter.
 */

import {
  FileText,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react'
import React, { useCallback, useRef, useState } from 'react'

import { cn } from '@/renderer/lib/utils'

import type { ProjectFile, ProjectInfo } from '../hooks/useProject'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ScrollArea } from './ui/ScrollArea'
import { Separator } from './ui/Separator'

interface LaconSidebarProps {
  project: ProjectInfo | null
  files: ProjectFile[]
  activeFilePath: string | null
  isDirty: boolean
  writerStage: string
  activeSkillCount: number
  onOpenProject: () => void
  onOpenFile: (filePath: string) => void
  onNewFile: () => void
  onDeleteFile: (filePath: string) => void
  onRenameFile: (oldPath: string, newName: string) => void
  onOpenSettings: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function getFileIcon(ext: string) {
  const docExts = ['.md', '.markdown', '.txt', '.rst', '.rtf', '.tex']
  if (docExts.includes(ext)) return <FileText className="h-4 w-4" />
  return <Type className="h-4 w-4" />
}

function getExtBadgeClass(ext: string): string {
  const colors: Record<string, string> = {
    '.md': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    '.txt': 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
    '.markdown': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    '.tex': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    '.rst': 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    '.rtf': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    '.bib': 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  }
  return colors[ext] || 'bg-muted text-muted-foreground'
}

export function LaconSidebar({
  project,
  files,
  activeFilePath,
  isDirty,
  writerStage,
  activeSkillCount,
  onOpenProject,
  onOpenFile,
  onNewFile,
  onDeleteFile,
  onRenameFile,
  onOpenSettings,
}: LaconSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenuFile, setContextMenuFile] = useState<string | null>(null)
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const formatStage = (stage: string): string => {
    if (stage === 'idle') return ''
    return stage.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const handleStartRename = useCallback(
    (file: ProjectFile) => {
      setRenamingFile(file.path)
      setRenameValue(file.name)
      setContextMenuFile(null)
      setTimeout(() => renameInputRef.current?.select(), 50)
    },
    [],
  )

  const handleSubmitRename = useCallback(
    (oldPath: string) => {
      const trimmed = renameValue.trim()
      if (trimmed && trimmed !== files.find(f => f.path === oldPath)?.name) {
        onRenameFile(oldPath, trimmed)
      }
      setRenamingFile(null)
    },
    [renameValue, files, onRenameFile],
  )

  const handleDeleteConfirm = useCallback(
    (file: ProjectFile) => {
      if (window.confirm(`Delete "${file.name}"? This cannot be undone.`)) {
        onDeleteFile(file.path)
      }
      setContextMenuFile(null)
    },
    [onDeleteFile],
  )

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

      {/* ─── Project Section ─── */}
      {project ? (
        <>
          {/* Project name bar */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={onOpenProject}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors text-left group"
              title={`Project: ${project.path}\nClick to switch project`}
              data-testid="switch-project-btn"
            >
              <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{project.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {files.length} file{files.length !== 1 ? 's' : ''}
                </div>
              </div>
            </button>
          </div>

          {/* New file + search row */}
          <div className="px-3 pb-2 flex gap-2">
            <Button
              onClick={onNewFile}
              size="sm"
              className="flex-1 justify-start gap-2 h-8 bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="new-file-btn"
            >
              <Plus className="h-3.5 w-3.5" />
              New File
            </Button>
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                placeholder="Filter files..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-sm bg-secondary/50 border border-border rounded-md outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground/60"
                aria-label="Filter files"
                data-testid="sidebar-search"
              />
            </div>
          </div>

          <Separator />

          {/* ─── File List ─── */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Files
                </span>
              </div>

              {filteredFiles.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'No files match your search' : 'No files yet'}
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={onNewFile}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Create your first file
                    </Button>
                  )}
                </div>
              ) : (
                filteredFiles.map(file => (
                  <div key={file.path} className="relative group">
                    {renamingFile === file.path ? (
                      /* ── Rename inline input ── */
                      <div className="px-3 py-2">
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => handleSubmitRename(file.path)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSubmitRename(file.path)
                            if (e.key === 'Escape') setRenamingFile(null)
                          }}
                          className="w-full h-8 px-2.5 text-sm bg-background border-2 border-primary rounded-md outline-none"
                          autoFocus
                        />
                      </div>
                    ) : (
                      /* ── File row ── */
                      <button
                        onClick={() => onOpenFile(file.path)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group/file',
                          activeFilePath === file.path
                            ? 'bg-primary/10 text-foreground'
                            : 'hover:bg-secondary/80 text-foreground/80',
                        )}
                        data-testid={`file-${file.name}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              'flex-shrink-0 mt-0.5 transition-colors',
                              activeFilePath === file.path
                                ? 'text-primary'
                                : 'text-muted-foreground group-hover/file:text-foreground',
                            )}
                          >
                            {getFileIcon(file.extension)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'text-sm font-medium truncate flex-1',
                                  activeFilePath === file.path && 'text-primary',
                                )}
                              >
                                {file.name}
                              </span>
                              {activeFilePath === file.path && isDirty && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                                  title="Unsaved changes"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(file.modifiedAt)}
                              </span>
                              <span className="text-xs text-muted-foreground/60">·</span>
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                          </div>
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5',
                              getExtBadgeClass(file.extension),
                            )}
                          >
                            {file.extension || 'txt'}
                          </span>
                        </div>
                      </button>
                    )}

                    {/* ── Context menu trigger ── */}
                    {renamingFile !== file.path && (
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setContextMenuFile(
                              contextMenuFile === file.path ? null : file.path,
                            )
                          }}
                          className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                          data-testid={`file-menu-${file.name}`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>

                        {/* ── Dropdown menu ── */}
                        {contextMenuFile === file.path && (
                          <div className="absolute right-0 top-7 z-50 min-w-[140px] bg-popover border border-border rounded-lg shadow-lg py-1 animate-fade-in">
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                handleStartRename(file)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary/80 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Rename
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                handleDeleteConfirm(file)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      ) : (
        /* ─── No Project Open ─── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center mb-4">
            <FolderOpen className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Open a Project
          </h3>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Choose a folder to start writing.<br />
            Your files will live right there.
          </p>
          <Button
            onClick={onOpenProject}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="open-project-btn"
          >
            <FolderOpen className="h-4 w-4" />
            Open Folder
          </Button>
        </div>
      )}

      <Separator />

      {/* ─── Active Session Info ─── */}
      {writerStage !== 'idle' && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-foreground">
              {formatStage(writerStage)}
            </span>
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

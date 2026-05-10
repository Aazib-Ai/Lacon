/**
 * LaconWorkspace — Unified writer workspace
 *
 * Three-column layout: Sidebar | Editor | Right Panel (AI tabs)
 * Now powered by the folder-based project system.
 */

import {
  History,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/renderer/lib/utils'
import { countWords } from '@/renderer/utils/content-analytics'

import { useAIDetection } from '../hooks/useAIDetection'
import { useProject } from '../hooks/useProject'
import { useResearch } from '../hooks/useResearch'
import { useSkills } from '../hooks/useSkills'
import { useWriterLoop } from '../hooks/useWriterLoop'
import { AIDetectionPanel } from './AIDetectionPanel'
import { FloatingAIBar } from './FloatingAIBar'
import { LaconSidebar } from './LaconSidebar'
import { LaconStatusBar } from './LaconStatusBar'
import type { ModernEditorHandle } from './ModernEditor'
import { ModernEditor } from './ModernEditor'
import { NewDocumentDialog } from './NewDocumentDialog'
import { OnboardingBanner } from './OnboardingBanner'
import { ProviderSettings } from './ProviderSettings'
import { type RefineAction } from './RefineBar'
import type { SelectedParagraphData } from './RefineButton'
import { getSelectedParagraphData } from './RefineButton'
import { RefineDiffOverlay, type RefineDiffData } from './RefineDiffOverlay'
import { ReviewDiffOverlay, type ReviewDiffItem } from './ReviewDiffOverlay'
import { SkillsLibraryPanel } from './SkillsLibraryPanel'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ScrollArea } from './ui/ScrollArea'
import { Separator } from './ui/Separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs'
import { ResearchWorkbench } from './WriterLoop/ResearchWorkbench'
import { ReviewPanelWrapper as ReviewPanel } from './WriterLoop/ReviewPanelWrapper'
import { VersionHistory } from './WriterLoop/VersionHistory'
import { WriterLoopPanel } from './WriterLoop/WriterLoopPanel'
import type { SlideDeck } from '../../shared/slides-types'
import { SlidesGeneratorDialog } from './SlidesGeneratorDialog'
import { SlideEditor } from './SlideEditor'

/** Sidebar resize constraints */
const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 500
const SIDEBAR_DEFAULT_WIDTH = 260
const SIDEBAR_SNAP_THRESHOLD = 150

/** Right panel resize constraints */
const RPANEL_MIN_WIDTH = 280
const RPANEL_MAX_WIDTH = 600
const RPANEL_DEFAULT_WIDTH = 380
const RPANEL_SNAP_THRESHOLD = 200

export function LaconWorkspace() {
  // Layout state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('writer')
  const [zenMode, setZenMode] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const isResizingRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH)

  // Right panel resize state
  const [rightPanelWidth, setRightPanelWidth] = useState(RPANEL_DEFAULT_WIDTH)
  const isResizingRightRef = useRef(false)
  const resizeRightStartXRef = useRef(0)
  const resizeRightStartWidthRef = useRef(RPANEL_DEFAULT_WIDTH)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem('lacon-onboarding-dismissed')
    } catch {
      return true
    }
  })

  // ─── Project system ───
  const projectState = useProject()
  const {
    project,
    files,
    activeFilePath,
    activeFileContent,
    isDirty,
    error: projectError,
    openProject,
    openFile,
    createFile,
    saveActiveFile,
    updateContent: updateProjectContent,
    deleteFile,
    renameFile,
    refreshFiles: _refreshFiles,
  } = projectState

  // Derive a documentId for writer loop compatibility
  const documentId = activeFilePath || undefined

  // Writer harness hooks
  const writerLoop = useWriterLoop(documentId)
  const aiDetection = useAIDetection()
  const workspaceSkills = useSkills(documentId)
  const workspaceResearch = useResearch(documentId)

  // Editor ref for accessing getMarkdown/getHTML
  const editorRef = useRef<ModernEditorHandle>(null)

  // ─── Refine workflow state ───
  const [refineLoading, setRefineLoading] = useState(false)
  const [refineParagraphData, setRefineParagraphData] = useState<SelectedParagraphData | null>(null)
  const [refineDiff, setRefineDiff] = useState<RefineDiffData | null>(null)
  const [refineExpandTrigger, setRefineExpandTrigger] = useState(0)

  // ─── Review diff workflow state ───
  const [reviewDiffs, setReviewDiffs] = useState<ReviewDiffItem[]>([])
  /** Stores the editor HTML before any review edits were applied (for undo on reject) */
  const reviewUndoSnapshotRef = useRef<string | null>(null)

  // ─── Slides workflow state ───
  const [slidesDialogOpen, setSlidesDialogOpen] = useState(false)
  const [slideDeck, setSlideDeck] = useState<SlideDeck | null>(null)
  const [slidesEditorOpen, setSlidesEditorOpen] = useState(false)

  // Load existing slide deck when file changes
  useEffect(() => {
    if (!activeFilePath) {
      setSlideDeck(null)
      return
    }
    const electron = (window as any).electron
    electron.slides.load(activeFilePath).then((result: any) => {
      if (result?.success && result.data) {
        setSlideDeck(result.data)
      } else {
        setSlideDeck(null)
      }
    }).catch(() => setSlideDeck(null))
  }, [activeFilePath])

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Zen mode
  useEffect(() => {
    document.documentElement.setAttribute('data-zen', zenMode ? 'true' : 'false')
    if (zenMode) {
      setSidebarOpen(false)
      setRightPanelOpen(false)
    } else {
      setSidebarOpen(true)
      setRightPanelOpen(true)
    }
  }, [zenMode])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+B: Toggle sidebar (Ctrl+B is reserved for Bold in the editor)
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        setSidebarOpen(v => !v)
      }
      // Ctrl+J: Toggle right panel
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault()
        setRightPanelOpen(v => !v)
      }
      // F11: Toggle zen mode
      if (e.key === 'F11') {
        e.preventDefault()
        setZenMode(v => !v)
      }
      // Esc: Exit zen mode
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false)
        setSidebarOpen(true)
        setRightPanelOpen(true)
      }
      // Ctrl+S: Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        saveActiveFile()
      }
      // Ctrl+N: New file
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        if (project) {
          setNewFileDialogOpen(true)
        }
      }
      // Ctrl+Alt+1-4: Tab switching
      if (e.ctrlKey && e.altKey && e.key === '1') {
        e.preventDefault()
        setActiveTab('writer')
        setRightPanelOpen(true)
      }
      if (e.ctrlKey && e.altKey && e.key === '2') {
        e.preventDefault()
        setActiveTab('research')
        setRightPanelOpen(true)
      }
      if (e.ctrlKey && e.altKey && e.key === '3') {
        e.preventDefault()
        setActiveTab('review')
        setRightPanelOpen(true)
      }
      if (e.ctrlKey && e.altKey && e.key === '4') {
        e.preventDefault()
        setActiveTab('detect')
        setRightPanelOpen(true)
      }
      if (e.ctrlKey && e.altKey && e.key === '5') {
        e.preventDefault()
        setActiveTab('history')
        setRightPanelOpen(true)
      }
      if (e.ctrlKey && e.altKey && e.key === '6') {
        e.preventDefault()
        setActiveTab('skills')
        setRightPanelOpen(true)
      }
      // Ctrl+,: Settings
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    // Listen for custom event from WriterLoopPanel skills button
    const handleOpenSkills = () => {
      setActiveTab('skills')
      setRightPanelOpen(true)
    }
    window.addEventListener('lacon:open-skills-tab', handleOpenSkills)
    // Listen for custom event from WriterLoopPanel research button
    const handleOpenResearch = () => {
      setActiveTab('research')
      setRightPanelOpen(true)
    }
    window.addEventListener('lacon:open-research-tab', handleOpenResearch)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('lacon:open-skills-tab', handleOpenSkills)
      window.removeEventListener('lacon:open-research-tab', handleOpenResearch)
    }
  }, [zenMode, saveActiveFile, project])

  // Handle editor content changes — editor emits HTML directly now
  const handleEditorContentChange = useCallback(
    (html: string) => {
      if (!activeFilePath) {return}
      updateProjectContent(html)
      // Update word count from the editor's plain text
      const text = editorRef.current?.getText?.() || ''
      setWordCount(countWords(text))
    },
    [activeFilePath, updateProjectContent],
  )

  // ── Compute initial word count when a file loads ──
  useEffect(() => {
    if (!activeFilePath) {
      setWordCount(0)
      return
    }
    // Short delay to let the editor mount and parse content
    const timer = setTimeout(() => {
      const text = editorRef.current?.getText?.() || ''
      setWordCount(countWords(text))
    }, 100)
    return () => clearTimeout(timer)
  }, [activeFilePath])

  // ── Auto-write generated content to editor when generation completes ──
  const contentWrittenRef = useRef(false)
  const lastWrittenStageRef = useRef<string | null>(null)

  useEffect(() => {
    const progress = writerLoop.progress
    const stage = writerLoop.stage

    console.log(`[LaconWorkspace:ContentWriter] Effect fired — stage=${stage}, progress.status=${progress?.status}, results=${progress?.results?.length ?? 0}, contentWritten=${contentWrittenRef.current}, editorReady=${!!editorRef.current}`)

    // Reset the write guard whenever we leave the 'complete' stage (new cycle starting)
    if (stage !== 'complete' && stage !== lastWrittenStageRef.current) {
      if (contentWrittenRef.current) {
        console.log(`[LaconWorkspace:ContentWriter] Resetting contentWrittenRef (stage changed to ${stage})`)
      }
      contentWrittenRef.current = false
      lastWrittenStageRef.current = stage
    }

    // Safety: if we're in 'complete' stage but have no progress data, re-fetch it
    if (stage === 'complete' && (!progress || !progress.results?.length) && documentId) {
      console.log(`[LaconWorkspace:ContentWriter] Stage=complete but no progress results — fetching progress directly`)
      window.electron?.writerLoop?.getProgress(documentId).then((res: any) => {
        if (res?.success && res.data?.results?.length > 0) {
          console.log(`[LaconWorkspace:ContentWriter] Direct progress fetch returned ${res.data.results.length} results — writing now`)
          const allContent = res.data.results.map((r: any) => r.content).join('\n\n')
          if (allContent && editorRef.current && !contentWrittenRef.current) {
            contentWrittenRef.current = true
            lastWrittenStageRef.current = 'complete'
            console.log(`[LaconWorkspace:ContentWriter] ✅ Writing ${res.data.results.length} sections (${allContent.length} chars) via direct fetch`)
            editorRef.current.setHTML(allContent)
          }
        }
      }).catch(() => { /* ignore */ })
      return
    }

    if (!progress || progress.status !== 'complete' || !progress.results?.length) {
      console.log(`[LaconWorkspace:ContentWriter] Early return — progress=${!!progress}, status=${progress?.status}, results=${progress?.results?.length ?? 0}`)
      return
    }

    // Only write once per generation cycle
    if (contentWrittenRef.current) {
      console.log(`[LaconWorkspace:ContentWriter] Skipping — already written this cycle`)
      return
    }
    contentWrittenRef.current = true
    lastWrittenStageRef.current = 'complete'

    // Collect all section HTML and write to editor
    const allContent = progress.results.map((r: any) => r.content).join('\n\n')
    console.log(`[LaconWorkspace:ContentWriter] Writing ${progress.results.length} sections to editor (content length: ${allContent.length}, editorRef=${!!editorRef.current})`)

    if (allContent && editorRef.current) {
      console.log(`[LaconWorkspace:ContentWriter] ✅ Calling editorRef.current.setHTML() with ${allContent.length} chars`)
      editorRef.current.setHTML(allContent)
    } else {
      console.error(`[LaconWorkspace:ContentWriter] ❌ FAILED to write — allContent=${!!allContent} (len=${allContent?.length}), editorRef=${!!editorRef.current}`)
    }
  }, [writerLoop.progress, writerLoop.stage, documentId])

  const handleCreateFile = useCallback(
    async (fileName: string) => {
      const result = await createFile(fileName)
      return result
    },
    [createFile],
  )

  const handleDismissOnboarding = useCallback(() => {
    setShowOnboarding(false)
    try {
      localStorage.setItem('lacon-onboarding-dismissed', 'true')
    } catch {} // eslint-disable-line no-empty
  }, [])

  // ─── Refine workflow handlers ───

  // Track editor selection changes to auto-populate refine data.
  // DEBOUNCED (300ms) so we don't interfere with active drag-to-select.
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRefineTextRef = useRef<string | null>(null)

  useEffect(() => {
    const editor = editorRef.current?.getEditor?.()
    if (!editor) return

    const handleSelectionUpdate = () => {
      // Clear any pending update
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current)
      }

      // Debounce: only process after 300ms of no further selection changes
      selectionTimerRef.current = setTimeout(() => {
        const data = getSelectedParagraphData(editor)
        const newText = data?.text || null

        // Only update state if the selection actually changed
        if (newText !== lastRefineTextRef.current) {
          lastRefineTextRef.current = newText
          setRefineParagraphData(data)
        }
      }, 300)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current)
      }
    }
  }, [activeFilePath]) // Re-attach when file changes

  // Also called from RefineButton click (explicit trigger)
  const handleRefineOpen = useCallback((data: SelectedParagraphData) => {
    setRefineParagraphData(data)
    setRefineDiff(null)
    // Increment trigger to signal FloatingAIBar to auto-expand
    setRefineExpandTrigger(prev => prev + 1)
  }, [])

  const handleRefineAction = useCallback(
    async (action: RefineAction, instruction: string) => {
      if (!documentId || !refineParagraphData) return
      setRefineLoading(true)

      try {
        const docContent = editorRef.current?.getJSON?.() || { type: 'doc', content: [] }
        const result = await writerLoop.surgicalEdit(
          refineParagraphData.paragraphId,
          instruction,
          docContent,
          refineParagraphData.text,
        )

        if (result?.revisedText) {
          setRefineDiff({
            originalText: refineParagraphData.text,
            revisedText: result.revisedText,
            from: refineParagraphData.from,
            to: refineParagraphData.to,
            isAddParagraph: action === 'add-paragraph',
          })
        }
      } catch (err) {
        console.error('[LaconWorkspace] Refine action failed:', err)
      } finally {
        setRefineLoading(false)
      }
    },
    [documentId, refineParagraphData, writerLoop],
  )

  const handleRefineAccept = useCallback(() => {
    setRefineDiff(null)
    setRefineParagraphData(null)
  }, [])

  const handleRefineReject = useCallback(() => {
    setRefineDiff(null)
    setRefineParagraphData(null)
  }, [])

  // ─── Review diff workflow handlers ───

  /**
   * Called when a review surgical edit completes.
   * Strategy:
   * 1. Save an undo snapshot (only on the first edit in a batch)
   * 2. Apply the text change immediately via HTML replacement
   * 3. Find the revised text in the editor and highlight it
   * 4. Add to reviewDiffs for the overlay
   */
  const handleReviewDiffReady = useCallback(
    (data: { flagId: string; originalText: string; revisedText: string }) => {
      const editor = editorRef.current?.getEditor?.()
      if (!editor) return

      // 1. Save undo snapshot before first edit in this batch
      if (!reviewUndoSnapshotRef.current) {
        reviewUndoSnapshotRef.current = editor.getHTML()
      }

      // 2. Find the paragraph/textblock that contains the original text
      const searchNeedle = data.originalText.slice(0, 80)
      let targetBlockPos = -1
      let targetBlockEnd = -1

      editor.state.doc.descendants((node: any, pos: number) => {
        if (targetBlockPos !== -1) return false
        if (node.isTextblock) {
          const blockText = node.textContent
          if (blockText.includes(searchNeedle)) {
            targetBlockPos = pos
            targetBlockEnd = pos + node.nodeSize
            return false
          }
        }
        return undefined
      })

      if (targetBlockPos === -1) return

      // 3. Replace the paragraph's text content with the revised text
      const contentFrom = targetBlockPos + 1
      const contentTo = targetBlockEnd - 1

      try {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: contentFrom, to: contentTo })
          .deleteSelection()
          .insertContent(data.revisedText)
          .run()
      } catch {
        return
      }

      // 4. Re-find the inserted text and highlight it
      let highlightFrom = -1
      let highlightTo = -1
      const revisedNeedle = data.revisedText.slice(0, 80)

      editor.state.doc.descendants((node: any, pos: number) => {
        if (highlightFrom !== -1) return false
        if (node.isTextblock) {
          const blockText = node.textContent
          if (blockText.includes(revisedNeedle)) {
            highlightFrom = pos + 1
            highlightTo = pos + 1 + blockText.length
            return false
          }
        }
        return undefined
      })

      if (highlightFrom !== -1 && highlightTo !== -1) {
        try {
          editor
            .chain()
            .setTextSelection({ from: highlightFrom, to: highlightTo })
            .setHighlight({ color: 'review-pending' })
            .run()
        } catch {
          // Highlight is non-critical
        }
      }

      // 5. Add to diffs for overlay display
      const newDiff: ReviewDiffItem = {
        flagId: data.flagId,
        originalText: data.originalText,
        revisedText: data.revisedText,
        from: highlightFrom,
        to: highlightTo,
      }

      setReviewDiffs(prev => [...prev, newDiff])
    },
    [],
  )

  /** Accept All: keep the applied changes, just remove highlights */
  const handleReviewAcceptAll = useCallback(() => {
    const editor = editorRef.current?.getEditor?.()
    if (editor) {
      // Remove all review-pending highlights
      for (const diff of reviewDiffs) {
        if (diff.from !== -1 && diff.to !== -1) {
          try {
            editor
              .chain()
              .setTextSelection({ from: diff.from, to: diff.to })
              .unsetHighlight()
              .run()
          } catch {
            // Positions may have shifted
          }
        }
      }
    }
    setReviewDiffs([])
    reviewUndoSnapshotRef.current = null
  }, [reviewDiffs])

  /** Reject All: restore the undo snapshot (original HTML before any edits) */
  const handleReviewRejectAll = useCallback(() => {
    const editor = editorRef.current?.getEditor?.()
    if (editor && reviewUndoSnapshotRef.current) {
      editor.commands.setContent(reviewUndoSnapshotRef.current)
    }
    setReviewDiffs([])
    reviewUndoSnapshotRef.current = null
  }, [])

  // ─── Sidebar Resize Handlers ───
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      isResizingRef.current = true
      resizeStartXRef.current = e.clientX
      resizeStartWidthRef.current = sidebarWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isResizingRef.current) {return}
        const delta = ev.clientX - resizeStartXRef.current
        const newWidth = resizeStartWidthRef.current + delta

        if (newWidth < SIDEBAR_SNAP_THRESHOLD) {
          setSidebarOpen(false)
          setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
        } else {
          setSidebarOpen(true)
          setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, newWidth)))
        }
      }

      const handleMouseUp = () => {
        isResizingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [sidebarWidth],
  )

  // ─── Right Panel Resize Handlers ───
  const handleRightResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      isResizingRightRef.current = true
      resizeRightStartXRef.current = e.clientX
      resizeRightStartWidthRef.current = rightPanelWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isResizingRightRef.current) {return}
        const delta = resizeRightStartXRef.current - ev.clientX
        const newWidth = resizeRightStartWidthRef.current + delta

        if (newWidth < RPANEL_SNAP_THRESHOLD) {
          setRightPanelOpen(false)
          setRightPanelWidth(RPANEL_DEFAULT_WIDTH)
        } else {
          setRightPanelOpen(true)
          setRightPanelWidth(Math.min(RPANEL_MAX_WIDTH, Math.max(RPANEL_MIN_WIDTH, newWidth)))
        }
      }

      const handleMouseUp = () => {
        isResizingRightRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [rightPanelWidth],
  )

  // Derive display title
  let displayTitle = 'LACON'
  if (activeFilePath) {
    displayTitle =
      activeFilePath
        .split(/[/\\]/)
        .pop()
        ?.replace(/\.[^.]+$/, '') || 'LACON'
  } else if (project) {
    displayTitle = project.name
  }

  // Review flag count for badge
  const reviewFlagCount = writerLoop.review?.flags?.length || 0

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden" data-testid="lacon-workspace">
      {/* ─── Main 3-column layout ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT SIDEBAR ─── */}
        <aside
          className={cn(
            'lacon-sidebar flex-shrink-0 bg-card overflow-hidden relative',
            sidebarOpen || settingsOpen ? 'border-r border-border' : 'w-0 border-r-0',
          )}
          style={
            sidebarOpen || settingsOpen
              ? {
                  width: `${settingsOpen ? Math.max(sidebarWidth, 340) : sidebarWidth}px`,
                  transition: isResizingRef.current ? 'none' : 'width 300ms cubic-bezier(0.4,0,0.2,1)',
                }
              : { width: 0, transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)' }
          }
          data-testid="lacon-sidebar"
        >
          {settingsOpen ? <ProviderSettings onClose={() => setSettingsOpen(false)} documentId={documentId} /> : null}
          {!settingsOpen && sidebarOpen ? (
            <LaconSidebar
              project={project}
              files={files}
              activeFilePath={activeFilePath}
              isDirty={isDirty}
              writerStage={writerLoop.stage}
              activeSkillCount={writerLoop.session?.activeSkillIds?.length || 0}
              onOpenSkillsTab={() => {
                setActiveTab('skills')
                setRightPanelOpen(true)
              }}
              onOpenProject={openProject}
              onOpenFile={openFile}
              onNewFile={() => setNewFileDialogOpen(true)}
              onDeleteFile={deleteFile}
              onRenameFile={renameFile}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : null}
        </aside>

        {/* ─── SIDEBAR RESIZE HANDLE ─── */}
        {sidebarOpen && (
          <div
            className="sidebar-resize-handle flex-shrink-0 w-[5px] cursor-col-resize relative z-10 group"
            onMouseDown={handleResizeStart}
            data-testid="sidebar-resize-handle"
            title="Drag to resize sidebar"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-border group-hover:w-[3px] group-hover:bg-primary/40 group-active:bg-primary/60 transition-all duration-150 rounded-full" />
          </div>
        )}

        {/* ─── CENTER: Toolbar + Editor ─── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden" role="main">
          {/* Top toolbar strip */}
          <div
            className={cn(
              'lacon-toolbar flex items-center justify-between px-4 h-[var(--lacon-header-height)] border-b border-border bg-card/80 backdrop-blur-sm transition-opacity duration-300',
            )}
          >
            {/* Left controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? 'Close sidebar (Ctrl+Shift+B)' : 'Open sidebar (Ctrl+Shift+B)'}
                className="h-8 w-8"
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <span className="text-sm font-semibold text-foreground tracking-tight">{displayTitle}</span>

              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes (auto-saving...)" />
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZenMode(!zenMode)}
                title={zenMode ? 'Exit zen mode (Esc)' : 'Zen mode (F11)'}
                className="h-8 w-8"
              >
                {zenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
                title="Toggle theme"
                className="h-8 w-8"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                title={rightPanelOpen ? 'Close panel (Ctrl+J)' : 'Open panel (Ctrl+J)'}
                className="h-8 w-8"
              >
                {rightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Error banner */}
          {projectError && (
            <div
              className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-b border-destructive/20 animate-slide-in-up"
              role="alert"
            >
              {projectError}
            </div>
          )}

          {/* Onboarding banner */}
          {showOnboarding && (
            <OnboardingBanner
              onDismiss={handleDismissOnboarding}
              onOpenSettings={() => {
                setSettingsOpen(true)
                handleDismissOnboarding()
              }}
            />
          )}

          {/* Editor area */}
          <div className="flex-1 overflow-hidden">
            {slidesEditorOpen ? (
              <SlideEditor
                deck={slideDeck}
                documentId={activeFilePath || ''}
                onDeckChange={setSlideDeck}
                onRequestGenerate={() => setSlidesDialogOpen(true)}
                onClose={() => setSlidesEditorOpen(false)}
              />
            ) : activeFilePath ? (
              <ModernEditor
                key={activeFilePath}
                content={activeFileContent || ''}
                onChangeHTML={handleEditorContentChange}
                editorRef={editorRef}
                onRefine={handleRefineOpen}
                onCreateSlides={() => {
                  if (slideDeck) {
                    setSlidesEditorOpen(true)
                  } else {
                    setSlidesDialogOpen(true)
                  }
                }}
              />
            ) : (
              /* ── No file open empty state ── */
              <div className="flex-1 flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-6">
                  <PenLine className="h-10 w-10 text-primary/60" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {project ? 'Select a file to start writing' : 'Open a project to begin'}
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  {project
                    ? 'Choose a file from the sidebar or create a new one with Ctrl+N.'
                    : 'Click "Open Folder" in the sidebar to choose your writing project folder.'}
                </p>
              </div>
            )}
          </div>

          {/* Refine diff overlay (accept/reject AI revisions) */}
          {refineDiff && editorRef.current?.getEditor?.() && (
            <RefineDiffOverlay
              diff={refineDiff}
              editor={editorRef.current.getEditor()}
              onAccept={handleRefineAccept}
              onReject={handleRefineReject}
            />
          )}

          {/* Review diff overlay (accept/reject review fixes) */}
          {reviewDiffs.length > 0 && editorRef.current?.getEditor?.() && (
            <ReviewDiffOverlay
              diffs={reviewDiffs}
              editor={editorRef.current.getEditor()}
              onAcceptAll={handleReviewAcceptAll}
              onRejectAll={handleReviewRejectAll}
            />
          )}

          {/* Floating AI bar — always visible, context-aware */}
          {!zenMode && activeFilePath && (
            <FloatingAIBar
              documentId={documentId}
              writerStage={writerLoop.stage}
              onStartPlanning={instruction => {
                // Get already-composed skill prompt (auto-composed on activeSkillIds change)
                const composedSkillPrompt = workspaceSkills.composedSkill?.composedPrompt || ''
                // Build research context
                let researchContext: any
                if (workspaceResearch.entries.length > 0) {
                  researchContext = {
                    entries: workspaceResearch.entries.map(entry => ({
                      id: entry.id,
                      query: entry.query,
                      excerpts: entry.excerpts,
                      sources: entry.sources,
                      createdAt: entry.createdAt,
                    })),
                    summary: workspaceResearch.entries.map(e => `[${e.query}]: ${e.excerpts[0] || ''}`).join('\n'),
                  }
                }
                writerLoop.startPlanning(instruction, composedSkillPrompt, researchContext)
                setActiveTab('writer')
                setRightPanelOpen(true)
              }}
              _onSurgicalEdit={writerLoop.surgicalEdit}
              onAbortGeneration={writerLoop.abortGeneration}
              refineParagraphData={refineParagraphData}
              refineLoading={refineLoading}
              onRefineAction={handleRefineAction}
              refineExpandTrigger={refineExpandTrigger}
            />
          )}
        </main>

        {/* ─── RIGHT PANEL RESIZE HANDLE ─── */}
        {rightPanelOpen && (
          <div
            className="right-panel-resize-handle flex-shrink-0 w-[5px] cursor-col-resize relative z-10 group"
            onMouseDown={handleRightResizeStart}
            data-testid="right-panel-resize-handle"
            title="Drag to resize panel"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-border group-hover:w-[3px] group-hover:bg-primary/40 group-active:bg-primary/60 transition-all duration-150 rounded-full" />
          </div>
        )}

        {/* ─── RIGHT PANEL: AI Tabs ─── */}
        <aside
          className={cn(
            'lacon-right-panel flex-shrink-0 bg-card overflow-hidden relative',
            rightPanelOpen ? 'border-l border-border' : 'w-0 border-l-0',
          )}
          style={
            rightPanelOpen
              ? {
                  width: `${rightPanelWidth}px`,
                  transition: isResizingRightRef.current ? 'none' : 'width 300ms cubic-bezier(0.4,0,0.2,1)',
                }
              : { width: 0, transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)' }
          }
          data-testid="lacon-right-panel"
        >
          {rightPanelOpen && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-w-0 overflow-hidden w-full">
              {/* ── Panel Header ── */}
              <div className="flex-shrink-0 border-b border-border bg-card">
                {/* Tab Navigation */}
                <div className="px-1 pt-1">
                  <TabsList className="w-full grid grid-cols-6 h-9 bg-secondary/50 rounded-lg p-0.5 overflow-visible">
                    <TabsTrigger
                      value="writer"
                      className="text-[11px] font-medium gap-1.5 relative rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Writer
                      {writerLoop.stage !== 'idle' && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="research"
                      className="text-[11px] font-medium gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Research
                    </TabsTrigger>
                    <TabsTrigger
                      value="review"
                      className="text-[11px] font-medium gap-1.5 relative overflow-visible rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <MessageSquareText className="h-3.5 w-3.5" />
                      Review
                      {reviewFlagCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1.5 -right-2 h-4 min-w-4 text-[10px] p-0 flex items-center justify-center z-10 bg-secondary text-foreground font-semibold shadow-sm ring-1 ring-border"
                        >
                          {reviewFlagCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="detect"
                      className="text-[11px] font-medium gap-1.5 relative rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Detect
                      {aiDetection.report && aiDetection.report.overallScore > 50 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 h-4 min-w-4 text-[10px] p-0 flex items-center justify-center"
                        >
                          {aiDetection.report.overallScore}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="history"
                      className="text-[11px] font-medium gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <History className="h-3.5 w-3.5" />
                      History
                    </TabsTrigger>
                    <TabsTrigger
                      value="skills"
                      className="text-[11px] font-medium gap-1.5 relative rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Skills
                      {(writerLoop.session?.activeSkillIds?.length || 0) > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1 -right-1 h-4 min-w-4 text-[10px] p-0 flex items-center justify-center bg-amber-500/20 text-amber-500"
                        >
                          {writerLoop.session?.activeSkillIds?.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Active Tab Description Bar */}
                <div className="px-3 py-2 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-primary/60" />
                  <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
                    {activeTab === 'writer' && 'Planner · Generator · Reviewer'}
                    {activeTab === 'research' && 'Sources · Citations · Notes'}
                    {activeTab === 'review' && 'Flags · Suggestions · Diff'}
                    {activeTab === 'detect' && 'AI Score · Humanize · ML Verify'}
                    {activeTab === 'history' && 'Snapshots · Versions · Timeline'}
                    {activeTab === 'skills' && 'Library · Compose · Rules'}
                    {activeTab === 'slides' && 'Generate · Edit · Export PPTX'}
                  </span>
                </div>
              </div>

              {/* Tab contents */}
              <ScrollArea className="flex-1 min-w-0 overflow-hidden w-full">
                <TabsContent value="writer" className="mt-0 p-0 h-full">
                  <WriterLoopPanel documentId={documentId} />
                </TabsContent>

                <TabsContent value="research" forceMount className="mt-0 p-0 overflow-hidden w-full data-[state=inactive]:hidden">
                  <ResearchWorkbench documentId={documentId} />
                </TabsContent>

                <TabsContent value="review" className="mt-0 p-0">
                  <ReviewPanel
                    documentId={documentId}
                    getEditorJSON={() => editorRef.current?.getJSON?.() ?? { type: 'doc', content: [] }}
                    getEditorHTML={() => editorRef.current?.getHTML?.() ?? ''}
                    setEditorHTML={(html: string) => editorRef.current?.setHTML?.(html)}
                    onReviewDiffReady={handleReviewDiffReady}
                  />
                </TabsContent>

                <TabsContent value="detect" className="mt-0 p-0 h-full">
                  <AIDetectionPanel
                    documentId={documentId}
                    getEditorText={() => editorRef.current?.getText?.() || ''}
                    onReplaceText={(index, newText) => {
                      const editor = editorRef.current?.getEditor?.()
                      if (!editor) return

                      // The detection service splits text on \n{2,} (double+ newlines).
                      // editor.getText() returns text with \n between textblocks.
                      // We need to match detection paragraphs to editor positions using
                      // the same splitting logic, then find the character range in the
                      // full text and map it back to ProseMirror positions.

                      const fullText = editor.getText()

                      // Split the same way the detection service does:
                      // split on any newlines, merge short fragments (<40 chars)
                      const rawLines = fullText.split(/\n+/).map((l: string) => l.trim()).filter((l: string) => l.length > 0)
                      const merged: string[] = []
                      let mergeBuffer = ''
                      for (const line of rawLines) {
                        if (mergeBuffer.length > 0) {
                          mergeBuffer += '\n' + line
                          if (mergeBuffer.length >= 60) {
                            merged.push(mergeBuffer)
                            mergeBuffer = ''
                          }
                        } else if (line.length < 40) {
                          mergeBuffer = line
                        } else {
                          merged.push(line)
                        }
                      }
                      if (mergeBuffer.length > 0) {
                        if (merged.length > 0) {
                          merged[merged.length - 1] += '\n' + mergeBuffer
                        } else {
                          merged.push(mergeBuffer)
                        }
                      }

                      // Map each merged paragraph to its character range in fullText
                      const paragraphs: { text: string; startChar: number; endChar: number }[] = []
                      let searchFrom = 0
                      for (const para of merged) {
                        // Find the first line of this merged paragraph in fullText
                        const firstLine = para.split('\n')[0]
                        const startIdx = fullText.indexOf(firstLine, searchFrom)
                        if (startIdx === -1) continue
                        // Find the end by locating the last line
                        const lastLine = para.split('\n').pop() || firstLine
                        const lastLineStart = fullText.indexOf(lastLine, startIdx)
                        const endIdx = lastLineStart + lastLine.length
                        paragraphs.push({
                          text: para,
                          startChar: startIdx,
                          endChar: endIdx,
                        })
                        searchFrom = endIdx
                      }

                      // Filter the same way detection does (skip < 20 chars)
                      const filtered = paragraphs.filter(p => p.text.length >= 20)

                      if (index < 0 || index >= filtered.length) {
                        console.warn(`[Detection] Paragraph index ${index} out of range (${filtered.length} paragraphs)`)
                        return
                      }

                      const target = filtered[index]

                      // Map character positions to ProseMirror positions
                      // editor.getText() returns text where each textblock boundary = 1 char (\n)
                      // In ProseMirror, each textblock boundary = 2 positions (close + open tags)
                      // We walk the doc to build a char-to-pos mapping
                      let charOffset = 0
                      const charToPos: { charStart: number; charEnd: number; posFrom: number; posTo: number }[] = []

                      editor.state.doc.descendants((node: any, pos: number) => {
                        if (node.isTextblock) {
                          const nodeText = node.textContent
                          const from = pos + 1 // inside the node (after opening tag)
                          const to = pos + node.nodeSize - 1 // before closing tag
                          charToPos.push({
                            charStart: charOffset,
                            charEnd: charOffset + nodeText.length,
                            posFrom: from,
                            posTo: to,
                          })
                          charOffset += nodeText.length + 1 // +1 for the \n between blocks
                        }
                      })

                      // Find which textblocks overlap with our target character range
                      const overlapping = charToPos.filter(
                        b => b.charEnd > target.startChar && b.charStart < target.endChar
                      )

                      if (overlapping.length === 0) {
                        console.warn(`[Detection] No textblocks found for paragraph ${index}`)
                        return
                      }

                      // Replace the full range spanning all overlapping textblocks
                      const replaceFrom = overlapping[0].posFrom
                      const replaceTo = overlapping[overlapping.length - 1].posTo

                      // Build replacement content: split the new text by single newlines
                      // to create proper paragraph nodes
                      const newParagraphs = newText.split(/\n/).filter(s => s.trim().length > 0)

                      if (newParagraphs.length <= 1) {
                        // Single paragraph — simple replacement
                        editor.chain().focus()
                          .setTextSelection({ from: replaceFrom, to: replaceTo })
                          .deleteSelection()
                          .insertContent(newText.trim())
                          .run()
                      } else {
                        // Multiple paragraphs — create proper block structure
                        const content = newParagraphs.map(p => ({
                          type: 'paragraph',
                          content: [{ type: 'text', text: p.trim() }],
                        }))

                        editor.chain().focus()
                          .setTextSelection({ from: replaceFrom, to: replaceTo })
                          .deleteSelection()
                          .insertContent(content)
                          .run()
                      }
                    }}
                    onReplaceFullText={(newText) => {
                      const editor = editorRef.current?.getEditor?.()
                      if (!editor) return

                      // Build proper ProseMirror content from the rewritten document
                      // Split on newlines to create paragraph nodes
                      const paragraphs = newText.split(/\n+/).filter(s => s.trim().length > 0)

                      const content = paragraphs.map(p => ({
                        type: 'paragraph' as const,
                        content: [{ type: 'text' as const, text: p.trim() }],
                      }))

                      // Replace entire document content atomically
                      editor.chain().focus()
                        .setContent({ type: 'doc', content })
                        .run()

                      console.log(`[Detection] Replaced full document: ${paragraphs.length} paragraphs`)
                    }}
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-0 p-0">
                  <VersionHistory
                    documentId={documentId || ''}
                    getCurrentContent={() => editorRef.current?.getEditor?.()?.getJSON?.() ?? undefined}
                    onRestore={(content) => {
                      const editor = editorRef.current?.getEditor?.()
                      if (!editor) return
                      try {
                        // If content is a ProseMirror JSON doc, set it directly
                        if (content && typeof content === 'object' && content.type === 'doc') {
                          editor.commands.setContent(content)
                        } else if (typeof content === 'string') {
                          // If it's HTML, set as HTML
                          editor.commands.setContent(content)
                        } else {
                          console.warn('[VersionHistory] Unknown content format, skipping restore')
                        }
                      } catch (err) {
                        console.error('[VersionHistory] Failed to restore content:', err)
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="skills" className="mt-0 p-0 h-full">
                  <SkillsLibraryPanel documentId={documentId} />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </aside>
      </div>

      {/* ─── STATUS BAR ─── */}
      <LaconStatusBar
        documentId={documentId}
        wordCount={wordCount}
        writerStage={writerLoop.stage}
        activeSkills={writerLoop.session?.activeSkillIds || []}
        onOpenSkillsTab={() => {
          setActiveTab('skills')
          setRightPanelOpen(true)
        }}
        zenMode={zenMode}
        onZenToggle={() => setZenMode(!zenMode)}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      {/* Settings is now rendered inside the sidebar — see LEFT SIDEBAR section */}

      {/* ─── NEW FILE DIALOG ─── */}
      <NewDocumentDialog
        open={newFileDialogOpen}
        onClose={() => setNewFileDialogOpen(false)}
        onCreateFile={handleCreateFile}
      />

      {/* ─── SLIDES GENERATOR DIALOG ─── */}
      <SlidesGeneratorDialog
        open={slidesDialogOpen}
        onClose={() => setSlidesDialogOpen(false)}
        documentTitle={activeFilePath ? activeFilePath.split(/[\/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'Untitled' : 'Untitled'}
        documentContent={editorRef.current?.getText?.() || ''}
        documentId={activeFilePath || ''}
        onGenerated={(deck) => {
          setSlideDeck(deck)
          setSlidesEditorOpen(true)
        }}
      />
    </div>
  )
}

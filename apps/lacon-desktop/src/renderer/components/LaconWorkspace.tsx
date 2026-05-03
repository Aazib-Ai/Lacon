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

import { useAIDetection } from '../hooks/useAIDetection'
import { useProject } from '../hooks/useProject'
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

  // Editor ref for accessing getMarkdown/getHTML
  const editorRef = useRef<ModernEditorHandle>(null)

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
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('lacon:open-skills-tab', handleOpenSkills)
    }
  }, [zenMode, saveActiveFile, project])

  // Handle editor content changes — editor emits HTML directly now
  const handleEditorContentChange = useCallback(
    (html: string) => {
      if (!activeFilePath) {return}
      updateProjectContent(html)
    },
    [activeFilePath, updateProjectContent],
  )

  // ── Auto-write generated content to editor when generation completes ──
  const contentWrittenRef = useRef(false)

  useEffect(() => {
    const progress = writerLoop.progress
    if (!progress || progress.status !== 'complete' || !progress.results?.length) {
      // Reset the write guard when not in complete state
      if (progress?.status !== 'complete') {
        contentWrittenRef.current = false
      }
      return
    }

    // Only write once per generation cycle
    if (contentWrittenRef.current) {return}
    contentWrittenRef.current = true

    // Collect all section HTML and write to editor
    const allContent = progress.results.map((r: any) => r.content).join('\n\n')
    if (allContent && editorRef.current) {
      console.log(`[LaconWorkspace] Writing ${progress.results.length} sections to editor`)
      editorRef.current.setHTML(allContent)
    }
  }, [writerLoop.progress])

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
            {activeFilePath ? (
              <ModernEditor
                key={activeFilePath}
                content={activeFileContent || ''}
                onChangeHTML={handleEditorContentChange}
                editorRef={editorRef}
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

          {/* Floating AI bar */}
          {!zenMode && activeFilePath && (
            <FloatingAIBar
              documentId={documentId}
              writerStage={writerLoop.stage}
              onStartPlanning={instruction => {
                writerLoop.startPlanning(instruction)
                setActiveTab('writer')
                setRightPanelOpen(true)
              }}
              _onSurgicalEdit={writerLoop.surgicalEdit}
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              {/* ── Panel Header ── */}
              <div className="flex-shrink-0 border-b border-border bg-card">
                {/* Tab Navigation */}
                <div className="px-1 pt-1">
                  <TabsList className="w-full grid grid-cols-6 h-9 bg-secondary/50 rounded-lg p-0.5">
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
                      className="text-[11px] font-medium gap-1.5 relative rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <MessageSquareText className="h-3.5 w-3.5" />
                      Review
                      {reviewFlagCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 h-4 min-w-4 text-[10px] p-0 flex items-center justify-center"
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
                  </span>
                </div>
              </div>

              {/* Tab contents */}
              <ScrollArea className="flex-1">
                <TabsContent value="writer" className="mt-0 p-0 h-full">
                  <WriterLoopPanel documentId={documentId} />
                </TabsContent>

                <TabsContent value="research" className="mt-0 p-0">
                  <ResearchWorkbench documentId={documentId} />
                </TabsContent>

                <TabsContent value="review" className="mt-0 p-0">
                  <ReviewPanel
                    documentId={documentId}
                    getEditorJSON={() => editorRef.current?.getJSON?.() ?? { type: 'doc', content: [] }}
                  />
                </TabsContent>

                <TabsContent value="detect" className="mt-0 p-0 h-full">
                  <AIDetectionPanel
                    documentId={documentId}
                    getEditorText={() => editorRef.current?.getHTML?.() || ''}
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-0 p-0">
                  <VersionHistory documentId={documentId} />
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
        wordCount={0}
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
    </div>
  )
}

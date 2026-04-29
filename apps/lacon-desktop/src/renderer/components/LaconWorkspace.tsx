/**
 * LaconWorkspace — Unified writer workspace
 *
 * Three-column layout: Sidebar | Editor | Right Panel (AI tabs)
 * Replaces both ModernEditorDemo and AppContent.
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
  Sun,
} from 'lucide-react'
import React, { useCallback, useEffect,useState } from 'react'

import { cn } from '@/renderer/lib/utils'

import { useDocument } from '../hooks/useDocument'
import { useResearch } from '../hooks/useResearch'
import { useVersion } from '../hooks/useVersion'
import { useWriterLoop } from '../hooks/useWriterLoop'
import { FloatingAIBar } from './FloatingAIBar'
import { LaconSidebar } from './LaconSidebar'
import { LaconStatusBar } from './LaconStatusBar'
import { ModernEditor } from './ModernEditor'
import { OnboardingBanner } from './OnboardingBanner'
import { ProviderSettings } from './ProviderSettings'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ScrollArea } from './ui/ScrollArea'
import { Separator } from './ui/Separator'
import { Tabs, TabsContent,TabsList, TabsTrigger } from './ui/Tabs'
import { ResearchWorkbench } from './WriterLoop/ResearchWorkbench'
import { ReviewPanelWrapper as ReviewPanel } from './WriterLoop/ReviewPanelWrapper'
import { VersionHistory } from './WriterLoop/VersionHistory'
import { WriterLoopPanel } from './WriterLoop/WriterLoopPanel'

export function LaconWorkspace() {
  // Layout state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('writer')
  const [zenMode, setZenMode] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem('lacon-onboarding-dismissed')
    } catch {
      return true
    }
  })

  // Document state
  const { currentDocument, isDirty, error, createDocument, updateContent } = useDocument()
  const documentId = currentDocument?.metadata?.id

  // Writer harness hooks
  const writerLoop = useWriterLoop(documentId)
  useVersion(documentId)
  useResearch(documentId)

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
    }
  }, [zenMode])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B: Toggle sidebar
      if (e.ctrlKey && e.key === 'b') {
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
      // Ctrl+Alt+1: Writer tab
      if (e.ctrlKey && e.altKey && e.key === '1') {
        e.preventDefault()
        setActiveTab('writer')
        setRightPanelOpen(true)
      }
      // Ctrl+Alt+2: Research tab
      if (e.ctrlKey && e.altKey && e.key === '2') {
        e.preventDefault()
        setActiveTab('research')
        setRightPanelOpen(true)
      }
      // Ctrl+Alt+3: Review tab
      if (e.ctrlKey && e.altKey && e.key === '3') {
        e.preventDefault()
        setActiveTab('review')
        setRightPanelOpen(true)
      }
      // Ctrl+Alt+4: History tab
      if (e.ctrlKey && e.altKey && e.key === '4') {
        e.preventDefault()
        setActiveTab('history')
        setRightPanelOpen(true)
      }
      // Ctrl+,: Settings
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zenMode])

  const handleNewDocument = useCallback(async () => {
    if (isDirty && !window.confirm('You have unsaved changes. Create new document anyway?')) {return}
    try {
      await createDocument('Untitled')
    } catch (err) {
      console.error('Create failed:', err)
    }
  }, [isDirty, createDocument])

  const handleDismissOnboarding = useCallback(() => {
    setShowOnboarding(false)
    try {
      localStorage.setItem('lacon-onboarding-dismissed', 'true')
    } catch {} // eslint-disable-line no-empty
  }, [])

  // Review flag count for badge
  const reviewFlagCount = writerLoop.review?.flags?.length || 0

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden" data-testid="lacon-workspace">
      {/* ─── Main 3-column layout ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT SIDEBAR ─── */}
        <aside
          className={cn(
            'lacon-sidebar flex-shrink-0 border-r border-border bg-card transition-all duration-300 ease-in-out overflow-hidden',
            sidebarOpen ? 'w-[var(--lacon-sidebar-width)]' : 'w-0',
          )}
          data-testid="lacon-sidebar"
        >
          {sidebarOpen && (
            <LaconSidebar
              documentId={documentId}
              onNewDocument={handleNewDocument}
              onOpenSettings={() => setSettingsOpen(true)}
              writerStage={writerLoop.stage}
              activeSkillCount={writerLoop.session?.activeSkillIds?.length || 0}
            />
          )}
        </aside>

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
                title={sidebarOpen ? 'Close sidebar (Ctrl+B)' : 'Open sidebar (Ctrl+B)'}
                className="h-8 w-8"
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <span className="text-sm font-semibold text-foreground tracking-tight">
                {currentDocument?.metadata?.title || 'LACON'}
              </span>

              {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}
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
          {error && (
            <div
              className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-b border-destructive/20 animate-slide-in-up"
              role="alert"
            >
              {error}
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
          <div className="flex-1 overflow-y-auto">
            <ModernEditor content={currentDocument?.content} onChange={updateContent} />
          </div>

          {/* Floating AI bar */}
          {!zenMode && (
            <FloatingAIBar
              documentId={documentId}
              writerStage={writerLoop.stage}
              onStartPlanning={instruction => {
                writerLoop.startPlanning(instruction)
                setActiveTab('writer')
                setRightPanelOpen(true)
              }}
              onSurgicalEdit={writerLoop.surgicalEdit}
            />
          )}
        </main>

        {/* ─── RIGHT PANEL: AI Tabs ─── */}
        <aside
          className={cn(
            'lacon-right-panel flex-shrink-0 border-l border-border bg-card transition-all duration-300 ease-in-out overflow-hidden',
            rightPanelOpen ? 'w-[var(--lacon-panel-width)]' : 'w-0',
          )}
          data-testid="lacon-right-panel"
        >
          {rightPanelOpen && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              {/* Tab triggers */}
              <div className="flex-shrink-0 p-2 border-b border-border">
                <TabsList className="w-full grid grid-cols-4 h-9">
                  <TabsTrigger value="writer" className="text-xs gap-1 relative">
                    <PenLine className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Writer</span>
                    {writerLoop.stage !== 'idle' && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="research" className="text-xs gap-1">
                    <Search className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Research</span>
                  </TabsTrigger>
                  <TabsTrigger value="review" className="text-xs gap-1 relative">
                    <MessageSquareText className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Review</span>
                    {reviewFlagCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-4 min-w-4 text-[10px] p-0 flex items-center justify-center"
                      >
                        {reviewFlagCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs gap-1">
                    <History className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">History</span>
                  </TabsTrigger>
                </TabsList>
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
                  <ReviewPanel documentId={documentId} />
                </TabsContent>

                <TabsContent value="history" className="mt-0 p-0">
                  <VersionHistory documentId={documentId} />
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
        zenMode={zenMode}
        onZenToggle={() => setZenMode(!zenMode)}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      {/* ─── SETTINGS OVERLAY ─── */}
      {settingsOpen && <ProviderSettings onClose={() => setSettingsOpen(false)} documentId={documentId} />}
    </div>
  )
}

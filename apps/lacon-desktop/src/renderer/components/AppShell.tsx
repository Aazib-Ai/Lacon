/**
 * App Shell Component - Phase 4
 * Main desktop layout with sidebar, editor, and assistant panel
 */

import React, { useState } from 'react'

import { useTheme } from '../contexts/ThemeContext'
import { layout, spacing, typography } from '../design-system/tokens'
import { commonShortcuts, useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { AssistantPanel } from './AssistantPanel'
import type { Command } from './CommandPalette'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'

interface AppShellProps {
  children: React.ReactNode
  documents?: any[]
  currentDocumentId?: string
  onDocumentSelect?: (id: string) => void
  onNewDocument?: () => void
  messages?: any[]
  onSendMessage?: (content: string) => void
  statusBarProps?: any
}

export function AppShell({
  children,
  documents = [],
  currentDocumentId,
  onDocumentSelect = () => {},
  onNewDocument = () => {},
  messages = [],
  onSendMessage = () => {},
  statusBarProps = {},
}: AppShellProps) {
  const { theme, toggleTheme } = useTheme()
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)
  const [isAssistantVisible, setIsAssistantVisible] = useState(true)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)

  // Define commands for command palette
  const commands: Command[] = [
    {
      id: 'new-document',
      label: 'New Document',
      description: 'Create a new document',
      shortcut: 'Ctrl+N',
      category: 'Document',
      action: onNewDocument,
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      description: 'Show or hide the document sidebar',
      shortcut: 'Ctrl+B',
      category: 'View',
      action: () => setIsSidebarVisible(!isSidebarVisible),
    },
    {
      id: 'toggle-assistant',
      label: 'Toggle Assistant',
      description: 'Show or hide the AI assistant panel',
      shortcut: 'Ctrl+J',
      category: 'View',
      action: () => setIsAssistantVisible(!isAssistantVisible),
    },
    {
      id: 'toggle-theme',
      label: 'Toggle Theme',
      description: 'Switch between light and dark theme',
      category: 'Appearance',
      action: toggleTheme,
    },
    {
      id: 'command-palette',
      label: 'Command Palette',
      description: 'Open command palette',
      shortcut: 'Ctrl+Shift+P',
      category: 'General',
      action: () => setIsCommandPaletteOpen(true),
    },
  ]

  // Register keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...commonShortcuts.commandPalette,
      action: () => setIsCommandPaletteOpen(true),
    },
    {
      ...commonShortcuts.toggleSidebar,
      action: () => setIsSidebarVisible(!isSidebarVisible),
    },
    {
      ...commonShortcuts.toggleAssistant,
      action: () => setIsAssistantVisible(!isAssistantVisible),
    },
    {
      ...commonShortcuts.newDocument,
      action: onNewDocument,
    },
  ])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: theme.colors.bgPrimary,
        color: theme.colors.textPrimary,
      }}
    >
      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        {isSidebarVisible && (
          <Sidebar
            documents={documents}
            currentDocumentId={currentDocumentId}
            onDocumentSelect={onDocumentSelect}
            onNewDocument={onNewDocument}
          />
        )}

        {/* Center Editor Area */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          role="main"
        >
          {/* Header */}
          <header
            style={{
              height: layout.headerHeight,
              padding: `0 ${spacing[6]}`,
              borderBottom: `1px solid ${theme.colors.borderPrimary}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme.colors.bgSecondary,
            }}
            role="banner"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[4] }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: typography.fontSize.xl,
                  fontWeight: typography.fontWeight.semibold,
                }}
              >
                LACON
              </h1>
            </div>

            <div style={{ display: 'flex', gap: spacing[2] }}>
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  border: `1px solid ${theme.colors.borderPrimary}`,
                  borderRadius: '4px',
                  fontSize: typography.fontSize.sm,
                  cursor: 'pointer',
                }}
                title="Command Palette (Ctrl+Shift+P)"
                aria-label="Open command palette"
              >
                ⌘
              </button>
              <button
                onClick={toggleTheme}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  border: `1px solid ${theme.colors.borderPrimary}`,
                  borderRadius: '4px',
                  fontSize: typography.fontSize.sm,
                  cursor: 'pointer',
                }}
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                {theme.mode === 'light' ? '🌙' : '☀️'}
              </button>
            </div>
          </header>

          {/* Editor Content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: spacing[6],
            }}
          >
            {children}
          </div>
        </main>

        {/* Right Assistant Panel */}
        {isAssistantVisible && <AssistantPanel messages={messages} onSendMessage={onSendMessage} />}
      </div>

      {/* Status Bar */}
      <StatusBar {...statusBarProps} />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />
    </div>
  )
}

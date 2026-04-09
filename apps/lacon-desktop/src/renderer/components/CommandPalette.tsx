/**
 * Command Palette Component - Phase 4
 * Global command palette with fuzzy search
 */

import React, { useEffect, useRef, useState } from 'react'

import { useTheme } from '../contexts/ThemeContext'
import { borderRadius, spacing, typography, zIndex } from '../design-system/tokens'

export interface Command {
  id: string
  label: string
  description?: string
  shortcut?: string
  category?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: Command[]
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const { theme } = useTheme()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(cmd => {
        const searchText = `${cmd.label} ${cmd.description || ''} ${cmd.category || ''}`.toLowerCase()
        return searchText.includes(query.toLowerCase())
      })
    : commands

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        return
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : prev))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            onClose()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: zIndex.modal,
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '60vh',
          backgroundColor: theme.colors.bgPrimary,
          borderRadius: borderRadius.lg,
          boxShadow: `0 20px 25px -5px ${theme.colors.shadowLarge}`,
          zIndex: zIndex.modal + 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: spacing[4],
            borderBottom: `1px solid ${theme.colors.borderPrimary}`,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            style={{
              width: '100%',
              padding: `${spacing[3]} ${spacing[4]}`,
              backgroundColor: theme.colors.bgSecondary,
              color: theme.colors.textPrimary,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.base,
              outline: 'none',
            }}
            aria-label="Command search"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={
              filteredCommands[selectedIndex] ? `command-${filteredCommands[selectedIndex].id}` : undefined
            }
          />
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: spacing[2],
          }}
        >
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: spacing[8],
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: typography.fontSize.sm,
              }}
            >
              No commands found
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                id={`command-${command.id}`}
                role="option"
                aria-selected={index === selectedIndex}
                style={{
                  padding: `${spacing[3]} ${spacing[4]}`,
                  marginBottom: spacing[1],
                  backgroundColor: index === selectedIndex ? theme.colors.bgActive : 'transparent',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  transition: 'background-color 150ms',
                }}
                onClick={() => {
                  command.action()
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        color: theme.colors.textPrimary,
                        marginBottom: command.description ? spacing[1] : 0,
                      }}
                    >
                      {command.label}
                    </div>
                    {command.description && (
                      <div
                        style={{
                          fontSize: typography.fontSize.xs,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {command.description}
                      </div>
                    )}
                  </div>
                  {command.shortcut && (
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: theme.colors.textTertiary,
                        backgroundColor: theme.colors.bgSecondary,
                        padding: `${spacing[1]} ${spacing[2]}`,
                        borderRadius: borderRadius.sm,
                        fontFamily: typography.fontFamily.mono,
                      }}
                    >
                      {command.shortcut}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: spacing[3],
            borderTop: `1px solid ${theme.colors.borderPrimary}`,
            fontSize: typography.fontSize.xs,
            color: theme.colors.textTertiary,
            display: 'flex',
            gap: spacing[4],
            justifyContent: 'center',
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </>
  )
}

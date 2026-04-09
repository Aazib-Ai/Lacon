/**
 * Keyboard Shortcuts Hook - Phase 4
 * Global keyboard shortcut management
 */

import { useEffect } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  action: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl === undefined || shortcut.ctrl === (e.ctrlKey || e.metaKey)
        const shiftMatch = shortcut.shift === undefined || shortcut.shift === e.shiftKey
        const altMatch = shortcut.alt === undefined || shortcut.alt === e.altKey
        const metaMatch = shortcut.meta === undefined || shortcut.meta === e.metaKey
        const keyMatch = shortcut.key.toLowerCase() === e.key.toLowerCase()

        if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
          e.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

// Common keyboard shortcuts
export const commonShortcuts = {
  commandPalette: { key: 'p', ctrl: true, shift: true },
  save: { key: 's', ctrl: true },
  newDocument: { key: 'n', ctrl: true },
  search: { key: 'f', ctrl: true },
  toggleSidebar: { key: 'b', ctrl: true },
  toggleAssistant: { key: 'j', ctrl: true },
  focusEditor: { key: 'e', ctrl: true },
  undo: { key: 'z', ctrl: true },
  redo: { key: 'y', ctrl: true },
}

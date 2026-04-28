/**
 * useKeyboardShortcutsPhase6 — Phase 6 keyboard shortcuts
 *
 * Adds keyboard shortcuts for the LACON Writer's Harness:
 * - Ctrl+Alt+1: Switch to Editor panel
 * - Ctrl+Alt+2: Switch to Research panel
 * - Ctrl+Alt+3: Switch to Version History panel
 * - F11: Toggle Zen mode
 * - Esc: Exit Zen mode (when in Zen mode)
 *
 * Tab and Esc for ghost text accept/reject are already handled by Phase 0 extensions.
 */

import { useCallback, useEffect } from 'react'

export interface KeyboardShortcutCallbacks {
  /** Called when Ctrl+Alt+1 is pressed (switch to Editor) */
  onSwitchToEditor?: () => void
  /** Called when Ctrl+Alt+2 is pressed (switch to Research) */
  onSwitchToResearch?: () => void
  /** Called when Ctrl+Alt+3 is pressed (switch to Version History) */
  onSwitchToVersionHistory?: () => void
  /** Called when F11 is pressed (toggle Zen mode) */
  onToggleZenMode?: () => void
  /** Called when Esc is pressed in Zen mode */
  onExitZenMode?: () => void
  /** Whether Zen mode is currently active */
  zenModeActive?: boolean
}

export function useKeyboardShortcutsPhase6(callbacks: KeyboardShortcutCallbacks) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ctrl+Alt+1: Editor panel
      if (event.ctrlKey && event.altKey && event.key === '1') {
        event.preventDefault()
        callbacks.onSwitchToEditor?.()
        return
      }

      // Ctrl+Alt+2: Research panel
      if (event.ctrlKey && event.altKey && event.key === '2') {
        event.preventDefault()
        callbacks.onSwitchToResearch?.()
        return
      }

      // Ctrl+Alt+3: Version History panel
      if (event.ctrlKey && event.altKey && event.key === '3') {
        event.preventDefault()
        callbacks.onSwitchToVersionHistory?.()
        return
      }

      // F11: Toggle Zen mode
      if (event.key === 'F11') {
        event.preventDefault()
        callbacks.onToggleZenMode?.()
        return
      }

      // Esc: Exit Zen mode (only when in Zen mode and not in an input)
      if (event.key === 'Escape' && callbacks.zenModeActive) {
        const target = event.target as HTMLElement
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        if (!isInput) {
          event.preventDefault()
          callbacks.onExitZenMode?.()
        }
      }
    },
    [callbacks],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}

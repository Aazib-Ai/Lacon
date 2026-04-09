/**
 * Keyboard Shortcuts Tests - Phase 4
 */

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { commonShortcuts, useKeyboardShortcuts } from '../../src/renderer/hooks/useKeyboardShortcuts'

describe('Keyboard Shortcuts', () => {
  describe('useKeyboardShortcuts', () => {
    it('should call action when matching shortcut is pressed', () => {
      const action = vi.fn()
      const shortcuts = [{ key: 's', ctrl: true, action }]

      renderHook(() => useKeyboardShortcuts(shortcuts))

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })
      window.dispatchEvent(event)

      expect(action).toHaveBeenCalledTimes(1)
    })

    it('should not call action when shortcut does not match', () => {
      const action = vi.fn()
      const shortcuts = [{ key: 's', ctrl: true, action }]

      renderHook(() => useKeyboardShortcuts(shortcuts))

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
      })
      window.dispatchEvent(event)

      expect(action).not.toHaveBeenCalled()
    })

    it('should handle shift modifier', () => {
      const action = vi.fn()
      const shortcuts = [{ key: 'p', ctrl: true, shift: true, action }]

      renderHook(() => useKeyboardShortcuts(shortcuts))

      const event = new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        shiftKey: true,
      })
      window.dispatchEvent(event)

      expect(action).toHaveBeenCalledTimes(1)
    })

    it('should not trigger when disabled', () => {
      const action = vi.fn()
      const shortcuts = [{ key: 's', ctrl: true, action }]

      renderHook(() => useKeyboardShortcuts(shortcuts, false))

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })
      window.dispatchEvent(event)

      expect(action).not.toHaveBeenCalled()
    })

    it('should handle multiple shortcuts', () => {
      const action1 = vi.fn()
      const action2 = vi.fn()
      const shortcuts = [
        { key: 's', ctrl: true, action: action1 },
        { key: 'n', ctrl: true, action: action2 },
      ]

      renderHook(() => useKeyboardShortcuts(shortcuts))

      const event1 = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })
      window.dispatchEvent(event1)

      const event2 = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
      })
      window.dispatchEvent(event2)

      expect(action1).toHaveBeenCalledTimes(1)
      expect(action2).toHaveBeenCalledTimes(1)
    })
  })

  describe('commonShortcuts', () => {
    it('should have command palette shortcut', () => {
      expect(commonShortcuts.commandPalette).toEqual({
        key: 'p',
        ctrl: true,
        shift: true,
      })
    })

    it('should have save shortcut', () => {
      expect(commonShortcuts.save).toEqual({
        key: 's',
        ctrl: true,
      })
    })

    it('should have new document shortcut', () => {
      expect(commonShortcuts.newDocument).toEqual({
        key: 'n',
        ctrl: true,
      })
    })

    it('should have toggle sidebar shortcut', () => {
      expect(commonShortcuts.toggleSidebar).toEqual({
        key: 'b',
        ctrl: true,
      })
    })

    it('should have toggle assistant shortcut', () => {
      expect(commonShortcuts.toggleAssistant).toEqual({
        key: 'j',
        ctrl: true,
      })
    })
  })
})

/**
 * Theme System Tests - Phase 4
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { applyThemeToDocument, getStoredTheme, getTheme, storeTheme } from '../../src/renderer/design-system/theme'

describe('Theme System', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getTheme', () => {
    it('should return light theme', () => {
      const theme = getTheme('light')
      expect(theme.mode).toBe('light')
      expect(theme.colors.bgPrimary).toBe('#ffffff')
    })

    it('should return dark theme', () => {
      const theme = getTheme('dark')
      expect(theme.mode).toBe('dark')
      expect(theme.colors.bgPrimary).toBe('#1a1a1a')
    })
  })

  describe('getStoredTheme', () => {
    it('should return stored theme from localStorage', () => {
      localStorage.setItem('lacon-theme-mode', 'dark')
      const theme = getStoredTheme()
      expect(theme).toBe('dark')
    })

    it('should return light as default when no stored theme', () => {
      const theme = getStoredTheme()
      expect(theme).toBe('light')
    })

    it('should handle invalid stored values', () => {
      localStorage.setItem('lacon-theme-mode', 'invalid')
      const theme = getStoredTheme()
      expect(['light', 'dark']).toContain(theme)
    })
  })

  describe('storeTheme', () => {
    it('should store theme in localStorage', () => {
      storeTheme('dark')
      expect(localStorage.getItem('lacon-theme-mode')).toBe('dark')
    })

    it('should update stored theme', () => {
      storeTheme('light')
      expect(localStorage.getItem('lacon-theme-mode')).toBe('light')

      storeTheme('dark')
      expect(localStorage.getItem('lacon-theme-mode')).toBe('dark')
    })
  })

  describe('applyThemeToDocument', () => {
    it('should apply theme colors as CSS variables', () => {
      const theme = getTheme('light')
      applyThemeToDocument(theme)

      const root = document.documentElement
      expect(root.style.getPropertyValue('--color-bgPrimary')).toBe('#ffffff')
      expect(root.style.getPropertyValue('--color-textPrimary')).toBe('#1a1a1a')
    })

    it('should set data-theme attribute', () => {
      const theme = getTheme('dark')
      applyThemeToDocument(theme)

      const root = document.documentElement
      expect(root.getAttribute('data-theme')).toBe('dark')
    })
  })
})

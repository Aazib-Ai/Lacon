/**
 * Component States Tests - Phase 4
 */

import { describe, expect, it } from 'vitest'

import {
  getButtonStates,
  getInputStates,
  getListItemStates,
  getStatusStyles,
} from '../../src/renderer/design-system/component-states'
import { darkTheme, lightTheme } from '../../src/renderer/design-system/theme'

describe('Component States', () => {
  describe('getButtonStates', () => {
    it('should return all button states for light theme', () => {
      const states = getButtonStates(lightTheme)

      expect(states.default).toBeDefined()
      expect(states.hover).toBeDefined()
      expect(states.active).toBeDefined()
      expect(states.disabled).toBeDefined()
      expect(states.focus).toBeDefined()
    })

    it('should have correct cursor for disabled state', () => {
      const states = getButtonStates(lightTheme)
      expect(states.disabled.cursor).toBe('not-allowed')
    })

    it('should have focus outline', () => {
      const states = getButtonStates(lightTheme)
      expect(states.focus.outline).toContain('2px solid')
    })
  })

  describe('getInputStates', () => {
    it('should return all input states', () => {
      const states = getInputStates(lightTheme)

      expect(states.default).toBeDefined()
      expect(states.hover).toBeDefined()
      expect(states.active).toBeDefined()
      expect(states.disabled).toBeDefined()
      expect(states.focus).toBeDefined()
    })

    it('should have border color change on focus', () => {
      const states = getInputStates(lightTheme)
      expect(states.focus.borderColor).toBe(lightTheme.colors.borderFocus)
    })
  })

  describe('getListItemStates', () => {
    it('should return all list item states', () => {
      const states = getListItemStates(lightTheme)

      expect(states.default).toBeDefined()
      expect(states.hover).toBeDefined()
      expect(states.active).toBeDefined()
      expect(states.disabled).toBeDefined()
      expect(states.focus).toBeDefined()
    })

    it('should have transparent background by default', () => {
      const states = getListItemStates(lightTheme)
      expect(states.default.backgroundColor).toBe('transparent')
    })
  })

  describe('getStatusStyles', () => {
    it('should return success status styles', () => {
      const styles = getStatusStyles(lightTheme, 'success')
      expect(styles.color).toBe(lightTheme.colors.success)
      expect(styles.backgroundColor).toBe(lightTheme.colors.successBg)
    })

    it('should return error status styles', () => {
      const styles = getStatusStyles(lightTheme, 'error')
      expect(styles.color).toBe(lightTheme.colors.error)
      expect(styles.backgroundColor).toBe(lightTheme.colors.errorBg)
    })

    it('should return warning status styles', () => {
      const styles = getStatusStyles(lightTheme, 'warning')
      expect(styles.color).toBe(lightTheme.colors.warning)
      expect(styles.backgroundColor).toBe(lightTheme.colors.warningBg)
    })

    it('should return info status styles', () => {
      const styles = getStatusStyles(lightTheme, 'info')
      expect(styles.color).toBe(lightTheme.colors.info)
      expect(styles.backgroundColor).toBe(lightTheme.colors.infoBg)
    })
  })

  describe('Dark theme support', () => {
    it('should have different colors for dark theme', () => {
      const lightStates = getButtonStates(lightTheme)
      const darkStates = getButtonStates(darkTheme)

      expect(lightStates.default.backgroundColor).not.toBe(darkStates.default.backgroundColor)
    })
  })
})

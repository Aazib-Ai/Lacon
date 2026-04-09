/**
 * Theme System - Phase 4
 * Theme management and persistence
 */

import { colors } from './tokens'

export type ThemeMode = 'light' | 'dark'

export interface Theme {
  mode: ThemeMode
  colors: typeof colors.light | typeof colors.dark
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: colors.light,
}

export const darkTheme: Theme = {
  mode: 'dark',
  colors: colors.dark,
}

export function getTheme(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme
}

// Theme persistence key
const THEME_STORAGE_KEY = 'lacon-theme-mode'

export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch (e) {
    console.warn('Failed to read theme from storage:', e)
  }

  // Default to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export function storeTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch (e) {
    console.warn('Failed to store theme:', e)
  }
}

export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement

  // Apply CSS custom properties
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value)
  })

  // Set data attribute for CSS selectors
  root.setAttribute('data-theme', theme.mode)
}

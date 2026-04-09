/**
 * Theme Context - Phase 4
 * React context for theme management
 */

import type { ReactNode } from 'react'
import React, { createContext, useContext, useEffect, useState } from 'react'

import type { Theme, ThemeMode } from '../design-system/theme'
import { applyThemeToDocument, getStoredTheme, getTheme, storeTheme } from '../design-system/theme'

interface ThemeContextValue {
  theme: Theme
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredTheme())
  const [theme, setTheme] = useState<Theme>(() => getTheme(themeMode))

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode)
    storeTheme(mode)
    const newTheme = getTheme(mode)
    setTheme(newTheme)
    applyThemeToDocument(newTheme)
  }

  const toggleTheme = () => {
    setThemeMode(themeMode === 'light' ? 'dark' : 'light')
  }

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set a preference
      const stored = localStorage.getItem('lacon-theme-mode')
      if (!stored) {
        setThemeMode(e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

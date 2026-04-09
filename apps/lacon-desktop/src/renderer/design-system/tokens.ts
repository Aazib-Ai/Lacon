/**
 * Design System Tokens - Phase 4
 * Visual foundation for LACON desktop app
 */

// Typography Scale
export const typography = {
  fontFamily: {
    base: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'Courier New', 'Consolas', monospace",
  },
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '2rem', // 32px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const

// Spacing Scale
export const spacing = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
} as const

// Color Tokens
export const colors = {
  // Light theme
  light: {
    // Primary
    primary: '#0066cc',
    primaryHover: '#0052a3',
    primaryActive: '#003d7a',
    primaryDisabled: '#99c2e6',

    // Background
    bgPrimary: '#ffffff',
    bgSecondary: '#f5f5f5',
    bgTertiary: '#e8e8e8',
    bgHover: '#f0f0f0',
    bgActive: '#e0e0e0',

    // Text
    textPrimary: '#1a1a1a',
    textSecondary: '#666666',
    textTertiary: '#999999',
    textDisabled: '#cccccc',
    textInverse: '#ffffff',

    // Border
    borderPrimary: '#dddddd',
    borderSecondary: '#e8e8e8',
    borderFocus: '#0066cc',

    // Status
    success: '#22c55e',
    successBg: '#f0fdf4',
    warning: '#f59e0b',
    warningBg: '#fffbeb',
    error: '#ef4444',
    errorBg: '#fef2f2',
    info: '#3b82f6',
    infoBg: '#eff6ff',

    // Elevation
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowMedium: 'rgba(0, 0, 0, 0.15)',
    shadowLarge: 'rgba(0, 0, 0, 0.2)',
  },

  // Dark theme
  dark: {
    // Primary
    primary: '#3b82f6',
    primaryHover: '#60a5fa',
    primaryActive: '#2563eb',
    primaryDisabled: '#1e3a8a',

    // Background
    bgPrimary: '#1a1a1a',
    bgSecondary: '#262626',
    bgTertiary: '#333333',
    bgHover: '#2a2a2a',
    bgActive: '#3a3a3a',

    // Text
    textPrimary: '#f5f5f5',
    textSecondary: '#a3a3a3',
    textTertiary: '#737373',
    textDisabled: '#525252',
    textInverse: '#1a1a1a',

    // Border
    borderPrimary: '#404040',
    borderSecondary: '#333333',
    borderFocus: '#3b82f6',

    // Status
    success: '#22c55e',
    successBg: '#14532d',
    warning: '#f59e0b',
    warningBg: '#451a03',
    error: '#ef4444',
    errorBg: '#450a0a',
    info: '#3b82f6',
    infoBg: '#1e3a8a',

    // Elevation
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.4)',
    shadowLarge: 'rgba(0, 0, 0, 0.5)',
  },
} as const

// Elevation and Border
export const elevation = {
  none: 'none',
  sm: '0 1px 2px 0',
  base: '0 1px 3px 0',
  md: '0 4px 6px -1px',
  lg: '0 10px 15px -3px',
  xl: '0 20px 25px -5px',
} as const

export const borderRadius = {
  none: '0',
  sm: '0.125rem', // 2px
  base: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  full: '9999px',
} as const

export const borderWidth = {
  none: '0',
  thin: '1px',
  base: '2px',
  thick: '4px',
} as const

// Motion Tokens
export const motion = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const

// Z-index layers
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
} as const

// Layout dimensions
export const layout = {
  sidebarWidth: '280px',
  sidebarCollapsedWidth: '60px',
  assistantPanelWidth: '400px',
  statusBarHeight: '28px',
  headerHeight: '56px',
  toolbarHeight: '48px',
} as const

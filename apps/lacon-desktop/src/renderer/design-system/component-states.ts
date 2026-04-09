/**
 * Component State Specifications - Phase 4
 * Defines visual states for interactive components
 */

import type { Theme } from './theme'

export type ComponentState = 'default' | 'hover' | 'active' | 'disabled' | 'focus'

export interface StateStyles {
  backgroundColor?: string
  color?: string
  borderColor?: string
  opacity?: number
  cursor?: string
  outline?: string
  outlineOffset?: string
  boxShadow?: string
}

export function getButtonStates(theme: Theme): Record<ComponentState, StateStyles> {
  return {
    default: {
      backgroundColor: theme.colors.primary,
      color: theme.colors.textInverse,
      borderColor: theme.colors.primary,
      cursor: 'pointer',
    },
    hover: {
      backgroundColor: theme.colors.primaryHover,
      borderColor: theme.colors.primaryHover,
      cursor: 'pointer',
    },
    active: {
      backgroundColor: theme.colors.primaryActive,
      borderColor: theme.colors.primaryActive,
      cursor: 'pointer',
    },
    disabled: {
      backgroundColor: theme.colors.primaryDisabled,
      borderColor: theme.colors.primaryDisabled,
      opacity: 0.6,
      cursor: 'not-allowed',
    },
    focus: {
      outline: `2px solid ${theme.colors.borderFocus}`,
      outlineOffset: '2px',
    },
  }
}

export function getInputStates(theme: Theme): Record<ComponentState, StateStyles> {
  return {
    default: {
      backgroundColor: theme.colors.bgPrimary,
      color: theme.colors.textPrimary,
      borderColor: theme.colors.borderPrimary,
    },
    hover: {
      borderColor: theme.colors.borderFocus,
    },
    active: {
      borderColor: theme.colors.borderFocus,
    },
    disabled: {
      backgroundColor: theme.colors.bgSecondary,
      color: theme.colors.textDisabled,
      cursor: 'not-allowed',
      opacity: 0.6,
    },
    focus: {
      borderColor: theme.colors.borderFocus,
      outline: `2px solid ${theme.colors.borderFocus}`,
      outlineOffset: '0',
    },
  }
}

export function getListItemStates(theme: Theme): Record<ComponentState, StateStyles> {
  return {
    default: {
      backgroundColor: 'transparent',
      color: theme.colors.textPrimary,
      cursor: 'pointer',
    },
    hover: {
      backgroundColor: theme.colors.bgHover,
      cursor: 'pointer',
    },
    active: {
      backgroundColor: theme.colors.bgActive,
      cursor: 'pointer',
    },
    disabled: {
      color: theme.colors.textDisabled,
      cursor: 'not-allowed',
      opacity: 0.6,
    },
    focus: {
      outline: `2px solid ${theme.colors.borderFocus}`,
      outlineOffset: '-2px',
    },
  }
}

export type StatusType = 'success' | 'warning' | 'error' | 'info'

export function getStatusStyles(theme: Theme, type: StatusType): StateStyles {
  const statusMap = {
    success: {
      color: theme.colors.success,
      backgroundColor: theme.colors.successBg,
    },
    warning: {
      color: theme.colors.warning,
      backgroundColor: theme.colors.warningBg,
    },
    error: {
      color: theme.colors.error,
      backgroundColor: theme.colors.errorBg,
    },
    info: {
      color: theme.colors.info,
      backgroundColor: theme.colors.infoBg,
    },
  }

  return statusMap[type]
}

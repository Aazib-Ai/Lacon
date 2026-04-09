/**
 * Status Bar Component - Phase 4
 * Bottom status bar with editor stats and provider status
 */

import React from 'react'

import { useTheme } from '../contexts/ThemeContext'
import { layout, spacing, typography } from '../design-system/tokens'

interface StatusBarProps {
  cursorPosition?: { line: number; column: number }
  selectionLength?: number
  wordCount?: number
  speakingDuration?: number
  providerStatus?: 'idle' | 'connecting' | 'streaming' | 'error'
  providerName?: string
}

export function StatusBar({
  cursorPosition,
  selectionLength,
  wordCount = 0,
  speakingDuration = 0,
  providerStatus = 'idle',
  providerName,
}: StatusBarProps) {
  const { theme } = useTheme()

  const statusColors = {
    idle: theme.colors.textTertiary,
    connecting: theme.colors.info,
    streaming: theme.colors.success,
    error: theme.colors.error,
  }

  const statusLabels = {
    idle: 'Ready',
    connecting: 'Connecting...',
    streaming: 'Streaming',
    error: 'Error',
  }

  return (
    <footer
      style={{
        height: layout.statusBarHeight,
        backgroundColor: theme.colors.bgSecondary,
        borderTop: `1px solid ${theme.colors.borderPrimary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${spacing[4]}`,
        fontSize: typography.fontSize.xs,
        color: theme.colors.textSecondary,
      }}
      role="status"
      aria-label="Status bar"
    >
      {/* Left section - Cursor and selection */}
      <div style={{ display: 'flex', gap: spacing[4], alignItems: 'center' }}>
        {cursorPosition && (
          <span aria-label={`Line ${cursorPosition.line}, Column ${cursorPosition.column}`}>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        )}
        {selectionLength !== undefined && selectionLength > 0 && (
          <span aria-label={`${selectionLength} characters selected`}>{selectionLength} selected</span>
        )}
      </div>

      {/* Center section - Word count and duration */}
      <div style={{ display: 'flex', gap: spacing[4], alignItems: 'center' }}>
        <span aria-label={`${wordCount} words`}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        {speakingDuration > 0 && (
          <span aria-label={`Speaking duration: ${formatDuration(speakingDuration)}`}>
            ~{formatDuration(speakingDuration)} speaking
          </span>
        )}
      </div>

      {/* Right section - Provider status */}
      <div style={{ display: 'flex', gap: spacing[2], alignItems: 'center' }}>
        {providerName && <span style={{ color: theme.colors.textPrimary }}>{providerName}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: statusColors[providerStatus],
            }}
            aria-hidden="true"
          />
          <span aria-label={`Provider status: ${statusLabels[providerStatus]}`}>{statusLabels[providerStatus]}</span>
        </div>
      </div>
    </footer>
  )
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (minutes === 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}m ${remainingSeconds}s`
}

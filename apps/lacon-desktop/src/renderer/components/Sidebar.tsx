/**
 * Sidebar Component - Phase 4
 * Left navigation panel with document list and search
 */

import React, { useState } from 'react'

import { useTheme } from '../contexts/ThemeContext'
import { borderRadius, spacing, typography } from '../design-system/tokens'

interface Document {
  id: string
  title: string
  updatedAt: Date
  isArchived?: boolean
}

interface SidebarProps {
  documents: Document[]
  currentDocumentId?: string
  onDocumentSelect: (id: string) => void
  onNewDocument: () => void
  onDocumentRename?: (id: string) => void
  onDocumentArchive?: (id: string) => void
  onDocumentDelete?: (id: string) => void
}

export function Sidebar({ documents, currentDocumentId, onDocumentSelect, onNewDocument }: SidebarProps) {
  const { theme } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredDocs = documents.filter(doc => doc.title.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <aside
      style={{
        width: '280px',
        height: '100%',
        backgroundColor: theme.colors.bgSecondary,
        borderRight: `1px solid ${theme.colors.borderPrimary}`,
        display: 'flex',
        flexDirection: 'column',
      }}
      role="navigation"
      aria-label="Document navigation"
    >
      {/* Header */}
      <div
        style={{
          padding: spacing[4],
          borderBottom: `1px solid ${theme.colors.borderPrimary}`,
        }}
      >
        <button
          onClick={onNewDocument}
          style={{
            width: '100%',
            padding: `${spacing[2]} ${spacing[4]}`,
            backgroundColor: theme.colors.primary,
            color: theme.colors.textInverse,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            cursor: 'pointer',
            transition: 'background-color 200ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = theme.colors.primaryHover
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = theme.colors.primary
          }}
          aria-label="Create new document"
        >
          + New Document
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: spacing[4] }}>
        <input
          type="search"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: `${spacing[2]} ${spacing[3]}`,
            backgroundColor: theme.colors.bgPrimary,
            color: theme.colors.textPrimary,
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            outline: 'none',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = theme.colors.borderFocus
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = theme.colors.borderPrimary
          }}
          aria-label="Search documents"
        />
      </div>

      {/* Document List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: `0 ${spacing[2]}`,
        }}
        role="list"
        aria-label="Documents"
      >
        {filteredDocs.length === 0 ? (
          <div
            style={{
              padding: spacing[4],
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: typography.fontSize.sm,
            }}
          >
            {searchQuery ? 'No documents found' : 'No documents yet'}
          </div>
        ) : (
          filteredDocs.map(doc => (
            <div
              key={doc.id}
              role="listitem"
              style={{
                padding: `${spacing[2]} ${spacing[3]}`,
                marginBottom: spacing[1],
                backgroundColor: currentDocumentId === doc.id ? theme.colors.bgActive : 'transparent',
                borderRadius: borderRadius.md,
                cursor: 'pointer',
                transition: 'background-color 150ms',
              }}
              onClick={() => onDocumentSelect(doc.id)}
              onMouseEnter={e => {
                if (currentDocumentId !== doc.id) {
                  e.currentTarget.style.backgroundColor = theme.colors.bgHover
                }
              }}
              onMouseLeave={e => {
                if (currentDocumentId !== doc.id) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onDocumentSelect(doc.id)
                }
              }}
              aria-current={currentDocumentId === doc.id ? 'page' : undefined}
            >
              <div
                style={{
                  fontSize: typography.fontSize.sm,
                  fontWeight:
                    currentDocumentId === doc.id ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  color: theme.colors.textPrimary,
                  marginBottom: spacing[1],
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {doc.title}
              </div>
              <div
                style={{
                  fontSize: typography.fontSize.xs,
                  color: theme.colors.textTertiary,
                }}
              >
                {new Date(doc.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

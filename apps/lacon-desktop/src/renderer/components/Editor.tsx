/**
 * TipTap Editor Component - Phase 5
 * Advanced editor with tables, media, mentions, and creator utilities
 */

import { Editor as TiptapEditor } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import React, { useEffect, useRef, useState } from 'react'

import type { DocumentContent } from '../../shared/document-types'
import { MediaExtensions } from '../extensions/media-extension'
import { MentionExtension } from '../extensions/mention-extension'
import { TableExtensions } from '../extensions/table-extension'
import { calculateContentMetrics, formatDuration } from '../utils/content-analytics'

interface EditorProps {
  content: DocumentContent
  onChange: (content: DocumentContent) => void
  onDirty: () => void
  editable?: boolean
}

export function Editor({ content, onChange, onDirty, editable = true }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<TiptapEditor | null>(null)

  useEffect(() => {
    if (!editorRef.current) {
      return
    }

    const editor = new TiptapEditor({
      element: editorRef.current,
      extensions: [
        StarterKit.configure({
          history: {
            depth: 100,
          },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link',
          },
        }),
        ...TableExtensions,
        ...MediaExtensions,
        MentionExtension(),
      ],
      content,
      editable,
      onUpdate: ({ editor: editorInstance }) => {
        const json = editorInstance.getJSON()
        onChange(json as DocumentContent)
        onDirty()
      },
      editorProps: {
        attributes: {
          class: 'editor-content-inner',
        },
      },
    })

    editorInstanceRef.current = editor

    return () => {
      editor.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update editor content when prop changes
  useEffect(() => {
    const editor = editorInstanceRef.current
    if (editor && content) {
      const currentContent = editor.getJSON()
      if (JSON.stringify(currentContent) !== JSON.stringify(content)) {
        editor.commands.setContent(content)
      }
    }
  }, [content])

  // Update editable state
  useEffect(() => {
    const editor = editorInstanceRef.current
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editable])

  return (
    <div className="editor-wrapper">
      <EditorToolbar editor={editorInstanceRef.current} />
      <div className="editor-content" ref={editorRef} />
    </div>
  )
}

interface EditorToolbarProps {
  editor: TiptapEditor | null
}

function EditorToolbar({ editor }: EditorToolbarProps) {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showMediaMenu, setShowMediaMenu] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)

  // Force re-render when editor updates
  useEffect(() => {
    if (!editor) {
      return
    }

    const updateHandler = () => forceUpdate()
    editor.on('update', updateHandler)
    editor.on('selectionUpdate', updateHandler)

    return () => {
      editor.off('update', updateHandler)
      editor.off('selectionUpdate', updateHandler)
    }
  }, [editor])

  if (!editor) {
    return null
  }

  const metrics = calculateContentMetrics(editor)

  const insertTable = () => {
    ;(editor.chain().focus() as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    setShowTableMenu(false)
  }

  const insertImage = () => {
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
    setShowMediaMenu(false)
  }

  const insertYouTube = () => {
    const url = window.prompt('Enter YouTube URL:')
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run()
    }
    setShowMediaMenu(false)
  }

  return (
    <div className="editor-toolbar">
      {/* Basic formatting */}
      <button
        onClick={() => (editor.chain().focus() as any).toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
        title="Bold (Ctrl+B)"
      >
        B
      </button>
      <button
        onClick={() => (editor.chain().focus() as any).toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
        title="Italic (Ctrl+I)"
      >
        I
      </button>
      <button
        onClick={() => (editor.chain().focus() as any).toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
        title="Strikethrough"
      >
        S
      </button>
      <div className="toolbar-separator" />

      {/* Headings */}
      <button
        onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 1 }).run()}
        className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        title="Heading 1"
      >
        H1
      </button>
      <button
        onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
        title="Heading 2"
      >
        H2
      </button>
      <button
        onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
        title="Heading 3"
      >
        H3
      </button>
      <div className="toolbar-separator" />

      {/* Lists */}
      <button
        onClick={() => (editor.chain().focus() as any).toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        title="Bullet List"
      >
        •
      </button>
      <button
        onClick={() => (editor.chain().focus() as any).toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        title="Numbered List"
      >
        1.
      </button>
      <div className="toolbar-separator" />

      {/* Links */}
      <button
        onClick={() => {
          const url = window.prompt('Enter URL:')
          if (url) {
            ;(editor.chain().focus() as any).setLink({ href: url }).run()
          }
        }}
        className={editor.isActive('link') ? 'is-active' : ''}
        title="Insert Link"
      >
        Link
      </button>
      <button
        onClick={() => (editor.chain().focus() as any).unsetLink().run()}
        disabled={!editor.isActive('link')}
        title="Remove Link"
      >
        Unlink
      </button>
      <div className="toolbar-separator" />

      {/* Tables */}
      <div className="toolbar-dropdown">
        <button
          onClick={() => setShowTableMenu(!showTableMenu)}
          className={editor.isActive('table') ? 'is-active' : ''}
          title="Table"
        >
          Table
        </button>
        {showTableMenu && (
          <div className="toolbar-dropdown-menu">
            <button onClick={insertTable}>Insert Table (3x3)</button>
            {editor.isActive('table') && (
              <>
                <button onClick={() => (editor.chain().focus() as any).addColumnBefore().run()}>
                  Add Column Before
                </button>
                <button onClick={() => (editor.chain().focus() as any).addColumnAfter().run()}>Add Column After</button>
                <button onClick={() => (editor.chain().focus() as any).deleteColumn().run()}>Delete Column</button>
                <button onClick={() => (editor.chain().focus() as any).addRowBefore().run()}>Add Row Before</button>
                <button onClick={() => (editor.chain().focus() as any).addRowAfter().run()}>Add Row After</button>
                <button onClick={() => (editor.chain().focus() as any).deleteRow().run()}>Delete Row</button>
                <button onClick={() => (editor.chain().focus() as any).mergeCells().run()}>Merge Cells</button>
                <button onClick={() => (editor.chain().focus() as any).splitCell().run()}>Split Cell</button>
                <button onClick={() => (editor.chain().focus() as any).toggleHeaderRow().run()}>
                  Toggle Header Row
                </button>
                <button onClick={() => (editor.chain().focus() as any).deleteTable().run()}>Delete Table</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Media */}
      <div className="toolbar-dropdown">
        <button onClick={() => setShowMediaMenu(!showMediaMenu)} title="Insert Media">
          Media
        </button>
        {showMediaMenu && (
          <div className="toolbar-dropdown-menu">
            <button onClick={insertImage}>Insert Image</button>
            <button onClick={insertYouTube}>Insert YouTube Video</button>
          </div>
        )}
      </div>
      <div className="toolbar-separator" />

      {/* Undo/Redo */}
      <button
        onClick={() => (editor.chain().focus() as any).undo().run()}
        disabled={!(editor.can() as any).undo()}
        title="Undo (Ctrl+Z)"
      >
        ↶
      </button>
      <button
        onClick={() => (editor.chain().focus() as any).redo().run()}
        disabled={!(editor.can() as any).redo()}
        title="Redo (Ctrl+Y)"
      >
        ↷
      </button>
      <div className="toolbar-separator" />

      {/* Metrics */}
      <button onClick={() => setShowMetrics(!showMetrics)} title="Content Metrics">
        📊 Stats
      </button>
      {showMetrics && (
        <div className="toolbar-metrics">
          <div className="metric">
            <span className="metric-label">Words:</span>
            <span className="metric-value">{metrics.wordCount}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Characters:</span>
            <span className="metric-value">{metrics.characterCount}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Speaking:</span>
            <span className="metric-value">{formatDuration(metrics.speakingDuration)}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Reading:</span>
            <span className="metric-value">{formatDuration(metrics.readingDuration)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

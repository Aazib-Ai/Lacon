/**
 * TipTap Editor Component - Phase 3
 * Core editor with baseline commands and keyboard shortcuts
 */

import { Editor as TiptapEditor } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import React, { useEffect, useRef } from 'react'

import type { DocumentContent } from '../../shared/document-types'

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

  return (
    <div className="editor-toolbar">
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
    </div>
  )
}

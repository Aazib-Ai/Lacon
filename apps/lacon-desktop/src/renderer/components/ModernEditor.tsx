import Highlight from '@tiptap/extension-highlight'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { FontSize } from '@tiptap/extension-text-style/font-size'
import { TextStyle } from '@tiptap/extension-text-style/text-style'
import Underline from '@tiptap/extension-underline'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import { EditorToolbar } from './EditorToolbar'
import { RefineButton, getSelectedParagraphData, type SelectedParagraphData } from './RefineButton'
import { SelectionPersist } from '../extensions/SelectionPersist'

// ────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────

/** Fixed document width matching US Letter (8.5 in at 96 dpi) */
const DOC_WIDTH = 816
const DOC_PADDING_X = 115
const DOC_PADDING_Y = 96

// ────────────────────────────────────────────────────────────────────
// Editor extensions — HTML-native
// ────────────────────────────────────────────────────────────────────

const coreExtensions = [
  StarterKit.configure({}),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Underline,
  Highlight.configure({ multicolor: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextStyle,
  FontSize,
  SelectionPersist,
]

/**
 * Detect whether a content string looks like Markdown rather than HTML.
 * Used for backward-compat: open .md files gracefully, then save as HTML.
 */
function looksLikeMarkdown(content: string): boolean {
  if (!content || content.trim().length === 0) {return false}
  const trimmed = content.trimStart()
  if (trimmed.startsWith('<')) {return false}
  if (/^#{1,6}\s/.test(trimmed)) {return true}
  if (/^[-*+]\s/.test(trimmed)) {return true}
  if (/^\d+\.\s/.test(trimmed)) {return true}
  if (!/<[a-z][\s\S]*>/i.test(content)) {return true}
  return false
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

export interface ModernEditorHandle {
  getMarkdown: () => string
  getHTML: () => string
  getText: () => string
  getJSON: () => any
  setHTML: (html: string) => void
  appendHTML: (html: string) => void
  /** Access the raw TipTap editor instance (for refine workflow) */
  getEditor: () => any
  /** Get the currently selected paragraph data with context */
  getSelectedParagraphData: () => SelectedParagraphData | null
}

interface ModernEditorProps {
  content?: string
  onChangeHTML?: (html: string) => void
  editorRef?: React.Ref<ModernEditorHandle>
  /** Called when the user clicks the floating Refine button */
  onRefine?: (data: SelectedParagraphData) => void
  /** Called when the user clicks the Create Slides button */
  onCreateSlides?: () => void
}

export function ModernEditor({ content, onChangeHTML, editorRef, onRefine, onCreateSlides }: ModernEditorProps) {
  const [zoom, setZoom] = useState(100)
  const canvasRef = useRef<HTMLDivElement>(null)

  const isMarkdownContent = useMemo(() => looksLikeMarkdown(content || ''), [content])

  const extensions = useMemo(() => {
    if (isMarkdownContent) {
      return [...coreExtensions, Markdown]
    }
    return coreExtensions
  }, [isMarkdownContent])

  const editor = useEditor({
    extensions,
    content: content || '',
    onUpdate: ({ editor: editorInstance }: { editor: any }) => {
      if (onChangeHTML) {
        onChangeHTML(editorInstance.getHTML())
      }
    },
  })

  useImperativeHandle(
    editorRef,
    () => ({
      getMarkdown: () => editor?.getMarkdown?.() || '',
      getHTML: () => editor?.getHTML?.() || '',
      getText: () => editor?.getText?.() || '',
      getJSON: () => editor?.getJSON?.() || { type: 'doc', content: [] },
      setHTML: (html: string) => {
        if (editor) {
          editor.commands.setContent(html)
        }
      },
      appendHTML: (html: string) => {
        if (editor) {
          editor.commands.insertContentAt(editor.state.doc.content.size - 1, html)
        }
      },
      getEditor: () => editor,
      getSelectedParagraphData: () => editor ? getSelectedParagraphData(editor) : null,
    }),
    [editor],
  )

  // Ctrl+G keyboard shortcut to open Refine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        if (editor && onRefine) {
          const data = getSelectedParagraphData(editor)
          if (data) {
            onRefine(data)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor, onRefine])

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-col h-full bg-secondary/30">
      <EditorToolbar editor={editor} zoom={zoom} onZoomChange={handleZoomChange} onCreateSlides={onCreateSlides} />

      {/* Single continuous canvas — no page breaks */}
      <div ref={canvasRef} className="paginated-canvas flex-1 overflow-auto">
        <div
          className="paginated-zoom-sizer"
          style={{
            width: zoom !== 100 ? `${DOC_WIDTH * (zoom / 100) + 48}px` : undefined,
            margin: '0 auto',
            position: 'relative',
          }}
        >
          <div
            className="paginated-document-container"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
          >
            <div
              className="paginated-document"
              style={{ width: `${DOC_WIDTH}px` }}
            >
              <div
                className="paginated-editor-content"
                style={{
                  paddingLeft: `${DOC_PADDING_X}px`,
                  paddingRight: `${DOC_PADDING_X}px`,
                  paddingTop: `${DOC_PADDING_Y}px`,
                  paddingBottom: `${DOC_PADDING_Y}px`,
                }}
              >
                <EditorContent editor={editor} className="prose prose-lg max-w-none" />
                {onRefine && (
                  <RefineButton editor={editor} onRefine={onRefine} />
                )}
              </div>
            </div>

            <div style={{ height: '140px' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

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

// ────────────────────────────────────────────────────────────────────
// Page dimensions — US Letter at 96 DPI
// ────────────────────────────────────────────────────────────────────

/** Page geometry constants (US Letter, 96 dpi) */
const PAGE = {
  /** Full page width in px (8.5 in) */
  WIDTH: 816,
  /** Full page height in px (11 in) */
  HEIGHT: 1056,
  /** Top margin in px (1 in) */
  MARGIN_TOP: 96,
  /** Bottom margin in px (1 in) */
  MARGIN_BOTTOM: 96,
  /** Left margin in px (1.2 in) */
  MARGIN_LEFT: 115,
  /** Right margin in px (1.2 in) */
  MARGIN_RIGHT: 115,
  /** Usable content height per page (11in - 1in top - 1in bottom = 9in) */
  CONTENT_HEIGHT: 864,
  /** Gap between visual pages in px */
  GAP: 40,
} as const

// ────────────────────────────────────────────────────────────────────
// Editor extensions — HTML-native
// ────────────────────────────────────────────────────────────────────

/**
 * Editor extensions — HTML-native.
 * The Markdown extension is only included when loading legacy .md content
 * so that it can be parsed on first open. All saves use editor.getHTML().
 */
const coreExtensions = [
  StarterKit.configure({}),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Underline,
  Highlight.configure({ multicolor: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextStyle,
  FontSize,
]

/**
 * Detect whether a content string looks like Markdown rather than HTML.
 * Used for backward-compat: open .md files gracefully, then save as HTML.
 */
function looksLikeMarkdown(content: string): boolean {
  if (!content || content.trim().length === 0) return false
  const trimmed = content.trimStart()
  // If it starts with an HTML tag, it's HTML
  if (trimmed.startsWith('<')) return false
  // Common Markdown patterns
  if (/^#{1,6}\s/.test(trimmed)) return true
  if (/^[-*+]\s/.test(trimmed)) return true
  if (/^\d+\.\s/.test(trimmed)) return true
  // Plain text with no HTML tags at all — treat as Markdown
  if (!/<[a-z][\s\S]*>/i.test(content)) return true
  return false
}

// ────────────────────────────────────────────────────────────────────
// usePageBreaks — track content height → compute page count
// ────────────────────────────────────────────────────────────────────

function usePageBreaks(editorElement: HTMLElement | null) {
  const [pageCount, setPageCount] = useState(1)

  useEffect(() => {
    if (!editorElement) return

    const measure = () => {
      const height = editorElement.scrollHeight
      setPageCount(Math.max(1, Math.ceil(height / PAGE.CONTENT_HEIGHT)))
    }

    // Initial measurement
    measure()

    const observer = new ResizeObserver(() => {
      measure()
    })

    // Also listen for mutations (new nodes, text changes)
    const mutationObserver = new MutationObserver(() => {
      // requestAnimationFrame to batch with layout
      requestAnimationFrame(measure)
    })

    observer.observe(editorElement)
    mutationObserver.observe(editorElement, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [editorElement])

  return { pageCount }
}

// ────────────────────────────────────────────────────────────────────
// PageBreakOverlay — visual separator between pages
// ────────────────────────────────────────────────────────────────────

interface PageBreakOverlayProps {
  /** Which page this break comes after (1-indexed, so break after page 1 = 1) */
  afterPage: number
  /** Total number of pages */
  totalPages: number
}

function PageBreakOverlay({ afterPage, totalPages }: PageBreakOverlayProps) {
  const topPosition = afterPage * PAGE.CONTENT_HEIGHT

  return (
    <div
      className="page-break-overlay"
      style={{ top: `${topPosition}px` }}
      aria-hidden="true"
    >
      {/* Bottom shadow of the current page */}
      <div className="page-break-bottom-shadow" />

      {/* The gap between pages — grey canvas peek */}
      <div className="page-break-gap">
        <span className="page-number-label">
          {afterPage} / {totalPages}
        </span>
      </div>

      {/* Top shadow of the next page */}
      <div className="page-break-top-shadow" />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

export interface ModernEditorHandle {
  /** Get the current editor content as a markdown string */
  getMarkdown: () => string
  /** Get the current editor content as an HTML string */
  getHTML: () => string
  /** Get the current editor content as Tiptap JSON */
  getJSON: () => any
}

interface ModernEditorProps {
  /** Content string to display — HTML (.lacon files) or Markdown (.md backward compat) */
  content?: string
  /** Called whenever the content changes — receives the HTML string */
  onChangeHTML?: (html: string) => void
  /** Optional ref to access editor methods (getMarkdown, getHTML, getJSON) */
  editorRef?: React.Ref<ModernEditorHandle>
}

export function ModernEditor({ content, onChangeHTML, editorRef }: ModernEditorProps) {
  const [zoom, setZoom] = useState(100)
  const proseMirrorRef = useRef<HTMLElement | null>(null)
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  // Determine if content is Markdown (legacy) and include the Markdown extension for parsing
  const isMarkdownContent = useMemo(() => looksLikeMarkdown(content || ''), [content])

  const extensions = useMemo(() => {
    if (isMarkdownContent) {
      // Include Markdown extension so legacy .md content is parsed correctly on load
      return [...coreExtensions, Markdown]
    }
    return coreExtensions
  }, [isMarkdownContent])

  const editor = useEditor({
    extensions,
    // For Markdown content, pass as markdown so the extension parses it.
    // For HTML content (or empty), TipTap parses HTML natively.
    content: content || '',
    onUpdate: ({ editor: editorInstance }: { editor: any }) => {
      // Always save as HTML — lossless round-trip for all formatting
      if (onChangeHTML) {
        onChangeHTML(editorInstance.getHTML())
      }
    },
  })

  // Grab ProseMirror DOM element once editor mounts
  useEffect(() => {
    if (editor) {
      proseMirrorRef.current = editor.view.dom as HTMLElement
    }
  }, [editor])

  // Expose methods via ref
  useImperativeHandle(editorRef, () => ({
    getMarkdown: () => editor?.getMarkdown?.() || '',
    getHTML: () => editor?.getHTML?.() || '',
    getJSON: () => editor?.getJSON?.() || { type: 'doc', content: [] },
  }), [editor])

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  // Page break tracking
  const { pageCount } = usePageBreaks(proseMirrorRef.current)

  // Calculate the total height needed for the editor container to accommodate
  // all pages plus the page break gap overlays
  const totalEditorHeight = pageCount * PAGE.CONTENT_HEIGHT

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-col h-full bg-secondary/30">
      {/* Top Toolbar — data-driven component */}
      <EditorToolbar editor={editor} zoom={zoom} onZoomChange={handleZoomChange} />

      {/* Main Editor Area — Paginated Document Canvas */}
      <div className="paginated-canvas flex-1 overflow-y-auto">
        <div
          className="paginated-document-container"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* The document page area — white background with page-like appearance */}
          <div
            ref={editorWrapperRef}
            className="paginated-document"
            style={{
              width: `${PAGE.WIDTH}px`,
            }}
          >
            {/* Editor content — continuous, but padded per-page via CSS */}
            <div
              className="paginated-editor-content"
              style={{
                minHeight: `${totalEditorHeight}px`,
                paddingLeft: `${PAGE.MARGIN_LEFT}px`,
                paddingRight: `${PAGE.MARGIN_RIGHT}px`,
                paddingTop: `${PAGE.MARGIN_TOP}px`,
                paddingBottom: `${PAGE.MARGIN_BOTTOM}px`,
              }}
            >
              <EditorContent editor={editor} className="prose prose-lg max-w-none" />
            </div>

            {/* Page break overlays — rendered on top of the editor at fixed intervals */}
            {pageCount > 1 && Array.from({ length: pageCount - 1 }, (_, i) => (
              <PageBreakOverlay
                key={i + 1}
                afterPage={i + 1}
                totalPages={pageCount}
              />
            ))}

            {/* Page footer on the last page */}
            <div
              className="page-footer-indicator"
              style={{
                top: `${totalEditorHeight + PAGE.MARGIN_TOP - 30}px`,
              }}
            >
              <span className="page-number-bottom">
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              </span>
            </div>
          </div>

          {/* Bottom spacer so the last page has room to scroll */}
          <div style={{ height: '80px' }} />
        </div>
      </div>
    </div>
  )
}

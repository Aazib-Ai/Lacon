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
// Page dimensions
// ────────────────────────────────────────────────────────────────────

/** Page geometry constants */
const PAGE = {
  /** Full page width in px (8.5 in at 96 dpi) */
  WIDTH: 816,
  /** Top margin in px (1 in) */
  MARGIN_TOP: 96,
  /** Bottom margin in px (1 in) */
  MARGIN_BOTTOM: 96,
  /** Left margin in px (1.2 in) */
  MARGIN_LEFT: 115,
  /** Right margin in px (1.2 in) */
  MARGIN_RIGHT: 115,
  /** Gap between visual pages in px */
  GAP: 10,
  /** Minimum content height — the page is at least this tall */
  MIN_CONTENT_HEIGHT: 864,
  /** Container padding (top) used around the document */
  CONTAINER_PAD_TOP: 12,
  /** Container padding (bottom) used around the document */
  CONTAINER_PAD_BOTTOM: 24,
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
// useCanvasHeight — measure the visible canvas area
// ────────────────────────────────────────────────────────────────────

/**
 * Tracks the height of the scrollable canvas so the page can be
 * sized to fill the entire viewport. Returns the usable content
 * height per page (viewport minus margins and padding).
 */
function useCanvasHeight(canvasRef: React.RefObject<HTMLDivElement | null>) {
  const [contentHeight, setContentHeight] = useState(PAGE.MIN_CONTENT_HEIGHT)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const measure = () => {
      const canvasH = el.clientHeight
      // The page content height = canvas height minus:
      //   - container top + bottom padding
      //   - page top + bottom margins (which are part of the page chrome)
      const available = canvasH - PAGE.CONTAINER_PAD_TOP - PAGE.CONTAINER_PAD_BOTTOM
                        - PAGE.MARGIN_TOP - PAGE.MARGIN_BOTTOM
      setContentHeight(Math.max(PAGE.MIN_CONTENT_HEIGHT, available))
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [canvasRef])

  return contentHeight
}

// ────────────────────────────────────────────────────────────────────
// usePageCount — track content height → compute page count
// ────────────────────────────────────────────────────────────────────

function usePageCount(editorElement: HTMLElement | null, contentHeight: number) {
  const [pageCount, setPageCount] = useState(1)

  useEffect(() => {
    if (!editorElement) return

    const measure = () => {
      const height = editorElement.scrollHeight
      setPageCount(Math.max(1, Math.ceil(height / contentHeight)))
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
  }, [editorElement, contentHeight])

  return { pageCount }
}

// ────────────────────────────────────────────────────────────────────
// PageBreakOverlay — visual separator between pages (Google Docs style)
// ────────────────────────────────────────────────────────────────────

interface PageBreakOverlayProps {
  /** Which page this break comes after (1-indexed) */
  afterPage: number
  /** Content height per page (dynamic) */
  contentHeight: number
}

/**
 * Renders the gap between two pages. This overlay sits on top of the
 * continuous editor content at the boundary where one page ends and
 * the next begins. It masks the content with the canvas background
 * and paints drop-shadows on the edges to create the illusion of two
 * distinct paper sheets separated by a gap.
 */
function PageBreakOverlay({ afterPage, contentHeight }: PageBreakOverlayProps) {
  const contentBoundary = afterPage * contentHeight

  return (
    <div
      className="page-break-overlay"
      style={{
        top: `${contentBoundary}px`,
      }}
      aria-hidden="true"
    >
      {/* Bottom margin of the ending page — white band with bottom shadow */}
      <div className="page-break-bottom-shadow" />

      {/* The canvas gap between pages */}
      <div className="page-break-gap" />

      {/* Top margin of the starting page — white band with top shadow */}
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
  /** Set the editor content from an HTML string */
  setHTML: (html: string) => void
  /** Append HTML content at the end of the editor */
  appendHTML: (html: string) => void
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
  const canvasRef = useRef<HTMLDivElement>(null)

  // ── Dynamic page height: fill the viewport ──
  const contentHeight = useCanvasHeight(canvasRef)

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
  }), [editor])

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  // Page count tracking (uses dynamic contentHeight)
  const { pageCount } = usePageCount(proseMirrorRef.current, contentHeight)

  // Total continuous content height across all pages
  const totalContentHeight = pageCount * contentHeight
  // Each page break overlay adds (MARGIN_BOTTOM + GAP + MARGIN_TOP) of visual height
  const totalOverlayHeight = (pageCount - 1) * (PAGE.MARGIN_BOTTOM + PAGE.GAP + PAGE.MARGIN_TOP)
  const totalDocumentHeight = totalContentHeight + PAGE.MARGIN_TOP + PAGE.MARGIN_BOTTOM + totalOverlayHeight

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-col h-full bg-secondary/30">
      {/* Top Toolbar — data-driven component */}
      <EditorToolbar editor={editor} zoom={zoom} onZoomChange={handleZoomChange} />

      {/* Main Editor Area — Paginated Document Canvas */}
      <div ref={canvasRef} className="paginated-canvas flex-1 overflow-y-auto">
        <div
          className="paginated-document-container"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* The document — a single continuous white page.
              Page breaks are painted on top as overlays. */}
          <div
            ref={editorWrapperRef}
            className="paginated-document"
            style={{
              width: `${PAGE.WIDTH}px`,
              minHeight: `${totalDocumentHeight}px`,
            }}
          >
            {/* Editor content — continuous flow */}
            <div
              className="paginated-editor-content"
              style={{
                minHeight: `${totalContentHeight}px`,
                paddingLeft: `${PAGE.MARGIN_LEFT}px`,
                paddingRight: `${PAGE.MARGIN_RIGHT}px`,
                paddingTop: `${PAGE.MARGIN_TOP}px`,
                paddingBottom: `${PAGE.MARGIN_BOTTOM}px`,
              }}
            >
              <EditorContent editor={editor} className="prose prose-lg max-w-none" />
            </div>

            {/* Page break overlays — visual separators between pages */}
            {pageCount > 1 && Array.from({ length: pageCount - 1 }, (_, i) => (
              <PageBreakOverlay
                key={i + 1}
                afterPage={i + 1}
                contentHeight={contentHeight}
              />
            ))}
          </div>

          {/* Bottom spacer so the last page has room to scroll */}
          <div style={{ height: '80px' }} />
        </div>
      </div>
    </div>
  )
}

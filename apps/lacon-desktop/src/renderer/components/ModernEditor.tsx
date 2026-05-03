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

/** Full page break height: bottom margin + gap + top margin */
const PAGE_BREAK_HEIGHT = PAGE.MARGIN_BOTTOM + PAGE.GAP + PAGE.MARGIN_TOP

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
  if (!content || content.trim().length === 0) {return false}
  const trimmed = content.trimStart()
  // If it starts with an HTML tag, it's HTML
  if (trimmed.startsWith('<')) {return false}
  // Common Markdown patterns
  if (/^#{1,6}\s/.test(trimmed)) {return true}
  if (/^[-*+]\s/.test(trimmed)) {return true}
  if (/^\d+\.\s/.test(trimmed)) {return true}
  // Plain text with no HTML tags at all — treat as Markdown
  if (!/<[a-z][\s\S]*>/i.test(content)) {return true}
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
    if (!el) {return}

    const measure = () => {
      const canvasH = el.clientHeight
      // The page content height = canvas height minus:
      //   - container top + bottom padding
      //   - page top + bottom margins (which are part of the page chrome)
      const available =
        canvasH - PAGE.CONTAINER_PAD_TOP - PAGE.CONTAINER_PAD_BOTTOM - PAGE.MARGIN_TOP - PAGE.MARGIN_BOTTOM
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
// usePaginationGaps — push blocks past page boundaries
// ────────────────────────────────────────────────────────────────────

interface PageBreakInfo {
  /** Position of the gap center in document coordinates (relative to .paginated-document) */
  top: number
  /** Total gap height including margins */
  height: number
}

/**
 * After ProseMirror renders, walks all top-level block elements and
 * pushes any that straddle a page boundary to the next page by adding
 * margin-top. Returns the positions of the page break gaps for rendering
 * the grey separator overlays.
 */
function usePaginationGaps(editorElement: HTMLElement | null, contentHeight: number) {
  const [pageBreaks, setPageBreaks] = useState<PageBreakInfo[]>([])
  const [pageCount, setPageCount] = useState(1)
  const isPaginatingRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!editorElement || contentHeight <= 0) {return}

    const paginate = () => {
      if (isPaginatingRef.current) {return}
      isPaginatingRef.current = true

      try {
        const children = Array.from(editorElement.children) as HTMLElement[]

        // Step 1: Reset all previous pagination margins
        for (const child of children) {
          if (child.hasAttribute('data-page-gap')) {
            child.style.marginTop = ''
            child.removeAttribute('data-page-gap')
          }
        }

        // Step 2: Force reflow to get clean measurements
        // eslint-disable-next-line no-void
        void editorElement.offsetHeight

        // Step 3: Measure natural positions (no gaps applied)
        const naturalPositions = children.map(c => ({
          top: c.offsetTop,
          height: c.offsetHeight,
        }))

        // Step 4: Calculate gaps needed
        const gaps: { index: number; gap: number }[] = []
        const breaks: PageBreakInfo[] = []
        let accumulatedGap = 0
        let nextBoundary = contentHeight // first page boundary in text coords

        for (let i = 0; i < children.length; i++) {
          const pos = naturalPositions[i]
          // Simulated position after previous gaps
          const simTop = pos.top + accumulatedGap
          const simBottom = simTop + pos.height

          // Advance boundary if element starts past it
          while (simTop >= nextBoundary + accumulatedGap) {
            nextBoundary += contentHeight
          }

          const effectiveBoundary = nextBoundary + accumulatedGap

          // Does this element cross the page boundary?
          if (simBottom > effectiveBoundary && simTop < effectiveBoundary) {
            // Skip elements taller than a page — can't avoid splitting
            if (pos.height >= contentHeight) {
              nextBoundary += contentHeight
              continue
            }

            // Gap = push element to after the full page break
            const gap = effectiveBoundary - simTop + PAGE_BREAK_HEIGHT

            gaps.push({ index: i, gap })

            // The overlay top in document coords
            breaks.push({
              top: PAGE.MARGIN_TOP + effectiveBoundary + PAGE.MARGIN_BOTTOM,
              height: PAGE.GAP,
            })

            accumulatedGap += gap
            nextBoundary += contentHeight
          }
        }

        // Step 5: Apply all gaps
        for (const { index, gap } of gaps) {
          const child = children[index]
          const existingMargin = parseFloat(getComputedStyle(child).marginTop) || 0
          child.style.marginTop = `${existingMargin + gap}px`
          child.setAttribute('data-page-gap', String(gap))
        }

        // Calculate total page count
        // eslint-disable-next-line no-void
        void editorElement.offsetHeight
        const totalTextHeight = editorElement.scrollHeight
        const pages = Math.max(1, Math.ceil(totalTextHeight / (contentHeight + PAGE_BREAK_HEIGHT)))

        setPageBreaks(breaks)
        setPageCount(pages)
      } finally {
        // Release the lock after a short delay to avoid re-entrant calls
        // from our own margin changes triggering the mutation observer
        setTimeout(() => {
          isPaginatingRef.current = false
        }, 30)
      }
    }

    /** Debounced wrapper — batches rapid DOM changes (e.g. streaming AI content) */
    const schedulePaginate = () => {
      if (debounceRef.current) {clearTimeout(debounceRef.current)}
      debounceRef.current = setTimeout(() => {
        requestAnimationFrame(paginate)
      }, 80)
    }

    // Initial run
    requestAnimationFrame(paginate)

    // Watch for content changes (typing, agent writes, setContent)
    const mutationObserver = new MutationObserver(schedulePaginate)
    mutationObserver.observe(editorElement, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // Watch for size changes
    const resizeObserver = new ResizeObserver(schedulePaginate)
    resizeObserver.observe(editorElement)

    // Safety net: periodically check for missed updates (handles edge cases
    // where agent content is inserted via setContent which may not always
    // trigger MutationObserver if ProseMirror recreates the DOM tree)
    const interval = setInterval(() => {
      requestAnimationFrame(paginate)
    }, 500)

    return () => {
      if (debounceRef.current) {clearTimeout(debounceRef.current)}
      clearInterval(interval)
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      // Clean up pagination margins
      const cleanChildren = Array.from(editorElement.children) as HTMLElement[]
      for (const child of cleanChildren) {
        if (child.hasAttribute('data-page-gap')) {
          child.style.marginTop = ''
          child.removeAttribute('data-page-gap')
        }
      }
    }
  }, [editorElement, contentHeight])

  return { pageBreaks, pageCount }
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
  const [proseMirrorEl, setProseMirrorEl] = useState<HTMLElement | null>(null)
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
    content: content || '',
    onUpdate: ({ editor: editorInstance }: { editor: any }) => {
      if (onChangeHTML) {
        onChangeHTML(editorInstance.getHTML())
      }
    },
  })

  // Grab ProseMirror DOM element once editor mounts — use state so
  // the pagination hook re-runs when the element becomes available
  useEffect(() => {
    if (editor) {
      setProseMirrorEl(editor.view.dom as HTMLElement)
    }
  }, [editor])

  // Expose methods via ref
  useImperativeHandle(
    editorRef,
    () => ({
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
    }),
    [editor],
  )

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  // ── Pagination — push blocks past page boundaries ──
  const { pageBreaks, pageCount } = usePaginationGaps(proseMirrorEl, contentHeight)

  // Calculate total document height including all page breaks
  const totalDocumentHeight =
    PAGE.MARGIN_TOP + pageCount * contentHeight + pageBreaks.length * PAGE_BREAK_HEIGHT + PAGE.MARGIN_BOTTOM

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
            {/* Editor content — continuous flow with pagination gaps.
                The usePaginationGaps hook adds margin-top to block elements
                that would cross page boundaries, creating natural gaps. */}
            <div
              className="paginated-editor-content"
              style={{
                minHeight: `${totalDocumentHeight}px`,
                paddingLeft: `${PAGE.MARGIN_LEFT}px`,
                paddingRight: `${PAGE.MARGIN_RIGHT}px`,
                paddingTop: `${PAGE.MARGIN_TOP}px`,
                paddingBottom: `${PAGE.MARGIN_BOTTOM}px`,
              }}
            >
              <EditorContent editor={editor} className="prose prose-lg max-w-none" />
            </div>

            {/* Page break overlays — grey gap + margin bands at each page boundary */}
            {pageBreaks.map((pb, i) => (
              <div key={i} className="page-break-overlay" style={{ top: `${pb.top}px` }} aria-hidden="true">
                {/* Bottom margin of ending page */}
                <div className="page-break-bottom-margin" />
                {/* Grey gap between pages */}
                <div className="page-break-line" />
                {/* Top margin of starting page */}
                <div className="page-break-top-margin" />
              </div>
            ))}
          </div>

          {/* Bottom spacer so the last page has room to scroll past the FloatingAIBar */}
          <div style={{ height: '140px' }} />
        </div>
      </div>
    </div>
  )
}

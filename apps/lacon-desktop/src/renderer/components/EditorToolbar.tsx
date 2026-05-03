/**
 * EditorToolbar — Data-driven, scalable toolbar for the Tiptap editor.
 *
 * Architecture: Each tool is a plain config object in TOOL_GROUPS.
 * To add a new tool, append an entry to the relevant group array — no
 * other files need changes.
 *
 * Focus-safety: Every interactive element uses onMouseDown={preventDefault}
 * so the Tiptap editor never loses focus when the user clicks a toolbar button.
 */

/**
 * The editor arrives fully-configured from ModernEditor with all extensions.
 * We use a permissive type here because the generic `Editor` from @tiptap/core
 * doesn't carry the augmented command types from dynamically-registered extensions.
 * eslint-disable-next-line @typescript-eslint/no-explicit-any
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TiptapEditor = any
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AArrowDown,
  AArrowUp,
  Bold,
  CheckSquare,
  ChevronDown,
  Download,
  FileCode,
  FileText,
  FileType,
  Heading,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  Plus,
  Presentation,
  Redo2,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import React, { useCallback } from 'react'

import { cn } from '@/renderer/lib/utils'
import {
  exportAsPDF,
  exportAsHTML,
  exportAsDOCX,
  exportAsMarkdown,
  exportAsText,
} from '@/renderer/utils/exportEngine'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/DropdownMenu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/Tooltip'

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/** Prevent mousedown from stealing focus away from the Tiptap editor. */
const preventFocusLoss = (e: React.MouseEvent) => e.preventDefault()

/** Format a shortcut string for display (e.g. "Ctrl+B") */
const fmtShortcut = (s?: string) => (s ? ` (${s})` : '')

// ────────────────────────────────────────────────────────────────────
// Smart List Toggle — splits paragraphs into individual list items
// ────────────────────────────────────────────────────────────────────

/**
 * Before toggling a list, split a single selected paragraph into multiple
 * paragraphs so each sentence/line becomes its own list item.
 *
 * Split strategy:
 *  1. HardBreak nodes (Shift+Enter / `<br>`) → each line becomes a paragraph
 *  2. Sentence boundaries (`.` `!` `?` followed by space + uppercase) → each sentence becomes a paragraph
 *  3. If no split points found, do nothing (single-item list — standard behavior)
 */
function splitParagraphBeforeListToggle(editor: TiptapEditor): void {
  const { state } = editor
  const { from, to } = state.selection

  // Only process when there's a text selection
  if (from === to) return

  // Don't split if we're already inside a list (toggle will untoggle)
  if (editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList')) {
    return
  }

  // Collect paragraphs in the selection
  const paragraphs: { node: any; pos: number }[] = []
  state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (node.type.name === 'paragraph') {
      paragraphs.push({ node, pos })
      return false // don't descend
    }
  })

  // Only split when exactly one paragraph is selected
  // (multiple paragraphs already become separate list items by default)
  if (paragraphs.length !== 1) return

  const { node: para, pos: paraPos } = paragraphs[0]
  if (para.content.size < 2) return // too short to split

  // ── Strategy 1: split at hardBreak nodes ──
  const hardBreakOffsets: number[] = []
  para.forEach((child: any, offset: number) => {
    if (child.type.name === 'hardBreak') {
      hardBreakOffsets.push(offset)
    }
  })

  if (hardBreakOffsets.length > 0) {
    const { tr } = state
    // Process in reverse so earlier positions aren't invalidated
    for (let i = hardBreakOffsets.length - 1; i >= 0; i--) {
      const absPos = tr.mapping.map(paraPos + 1 + hardBreakOffsets[i])
      tr.delete(absPos, absPos + 1) // remove hardBreak
      tr.split(absPos)              // split into two paragraphs
    }
    // Select all the resulting paragraphs
    const newEnd = tr.mapping.map(paraPos + para.nodeSize)
    tr.setSelection(
      // @ts-ignore — TextSelection.create works fine with mapped positions
      editor.state.selection.constructor.create(tr.doc, paraPos + 1, newEnd - 1),
    )
    editor.view.dispatch(tr)
    return
  }

  // ── Strategy 2: split at sentence boundaries ──
  const text = para.textContent
  if (!text || text.length < 20) return // too short

  // Match: sentence-ending punctuation + whitespace + uppercase letter
  const boundaries: number[] = []
  const sentenceRx = /[.!?]\s+(?=[A-Z])/g
  let m: RegExpExecArray | null
  while ((m = sentenceRx.exec(text)) !== null) {
    boundaries.push(m.index + m[0].length) // position of the uppercase letter
  }
  if (boundaries.length === 0) return

  // Verify the paragraph only has text/mark nodes (no inline atoms that shift positions)
  let hasInlineAtoms = false
  para.forEach((child: any) => {
    if (!child.isText && child.type.name !== 'hardBreak') {
      hasInlineAtoms = true
    }
  })
  if (hasInlineAtoms) return // can't safely map text offsets

  const { tr } = state
  for (let i = boundaries.length - 1; i >= 0; i--) {
    const absPos = tr.mapping.map(paraPos + 1 + boundaries[i])
    tr.split(absPos)
  }
  const newEnd = tr.mapping.map(paraPos + para.nodeSize)
  tr.setSelection(
    // @ts-ignore
    editor.state.selection.constructor.create(tr.doc, paraPos + 1, newEnd - 1),
  )
  editor.view.dispatch(tr)
}

/**
 * Smart toggle: split paragraph into items, then toggle the list type.
 */
function smartToggleList(editor: TiptapEditor, type: 'bullet' | 'ordered' | 'task') {
  splitParagraphBeforeListToggle(editor)
  // After splitting, the editor state is updated synchronously
  switch (type) {
    case 'bullet':  return editor.chain().focus().toggleBulletList().run()
    case 'ordered': return editor.chain().focus().toggleOrderedList().run()
    case 'task':    return editor.chain().focus().toggleTaskList().run()
  }
}

// ────────────────────────────────────────────────────────────────────
// Reusable primitives
// ────────────────────────────────────────────────────────────────────

interface ToolbarIconButtonProps {
  icon: React.ElementType
  label: string
  shortcut?: string
  isActive?: boolean
  onClick: () => void
  className?: string
}

/** A single icon button with tooltip, active-state styling, and focus-prevention. */
function ToolbarIconButton({ icon: Icon, label, shortcut, isActive, onClick, className }: ToolbarIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={preventFocusLoss}
          onClick={onClick}
          aria-label={label}
          className={cn(
            'inline-flex items-center justify-center h-8 w-8 rounded-md text-sm transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isActive && 'bg-accent text-accent-foreground shadow-sm',
            className,
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}{fmtShortcut(shortcut)}
      </TooltipContent>
    </Tooltip>
  )
}

/** A thin vertical divider between tool groups. */
function ToolbarSeparator() {
  return <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />
}

// ────────────────────────────────────────────────────────────────────
// Font-size helpers
// ────────────────────────────────────────────────────────────────────

const DEFAULT_FONT_SIZE = 16
const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 72

/** Parse the current font-size from the editor's textStyle mark attributes. */
function getCurrentFontSize(editor: TiptapEditor): number {
  const attrs = editor.getAttributes('textStyle')
  if (attrs.fontSize) {
    const parsed = parseInt(attrs.fontSize, 10)
    if (!isNaN(parsed)) return parsed
  }
  return DEFAULT_FONT_SIZE
}

// Export helpers are in @/renderer/utils/exportEngine

// ────────────────────────────────────────────────────────────────────
// Highlight colors
// ────────────────────────────────────────────────────────────────────

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', color: '#fef08a' },
  { label: 'Green', color: '#86efac' },
  { label: 'Blue', color: '#93c5fd' },
  { label: 'Pink', color: '#fda4af' },
  { label: 'Purple', color: '#c4b5fd' },
  { label: 'Orange', color: '#fdba74' },
] as const

// ────────────────────────────────────────────────────────────────────
// Tool definitions (the registry)
// ────────────────────────────────────────────────────────────────────

interface ButtonTool {
  id: string
  type: 'button'
  label: string
  icon: React.ElementType
  shortcut?: string
  action: (editor: TiptapEditor) => void
  isActive?: (editor: TiptapEditor) => boolean
}

/**
 * The formatting button tools — easily extensible.
 * To add a new tool, append an object to this array.
 */
const FORMAT_TOOLS: ButtonTool[] = [
  {
    id: 'bold',
    type: 'button',
    label: 'Bold',
    icon: Bold,
    shortcut: 'Ctrl+B',
    action: (e) => e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive('bold'),
  },
  {
    id: 'italic',
    type: 'button',
    label: 'Italic',
    icon: Italic,
    shortcut: 'Ctrl+I',
    action: (e) => e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive('italic'),
  },
  {
    id: 'underline',
    type: 'button',
    label: 'Underline',
    icon: UnderlineIcon,
    shortcut: 'Ctrl+U',
    action: (e) => e.chain().focus().toggleUnderline().run(),
    isActive: (e) => e.isActive('underline'),
  },
  {
    id: 'strikethrough',
    type: 'button',
    label: 'Strikethrough',
    icon: Strikethrough,
    shortcut: 'Ctrl+Shift+S',
    action: (e) => e.chain().focus().toggleStrike().run(),
    isActive: (e) => e.isActive('strike'),
  },
]

const ALIGN_TOOLS: ButtonTool[] = [
  {
    id: 'align-left',
    type: 'button',
    label: 'Align Left',
    icon: AlignLeft,
    action: (e) => e.chain().focus().setTextAlign('left').run(),
    isActive: (e) => e.isActive({ textAlign: 'left' }),
  },
  {
    id: 'align-center',
    type: 'button',
    label: 'Align Center',
    icon: AlignCenter,
    action: (e) => e.chain().focus().setTextAlign('center').run(),
    isActive: (e) => e.isActive({ textAlign: 'center' }),
  },
  {
    id: 'align-right',
    type: 'button',
    label: 'Align Right',
    icon: AlignRight,
    action: (e) => e.chain().focus().setTextAlign('right').run(),
    isActive: (e) => e.isActive({ textAlign: 'right' }),
  },
  {
    id: 'align-justify',
    type: 'button',
    label: 'Justify',
    icon: AlignJustify,
    action: (e) => e.chain().focus().setTextAlign('justify').run(),
    isActive: (e) => e.isActive({ textAlign: 'justify' }),
  },
]

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  editor: TiptapEditor
  zoom: number
  onZoomChange: (zoom: number) => void
  onCreateSlides?: () => void
}

export function EditorToolbar({ editor, zoom, onZoomChange, onCreateSlides }: EditorToolbarProps) {
  // ── Font-size handlers ──
  const handleFontSizeIncrease = useCallback(() => {
    const current = getCurrentFontSize(editor)
    const next = Math.min(MAX_FONT_SIZE, current + 1)
    editor.chain().focus().setFontSize(`${next}px`).run()
  }, [editor])

  const handleFontSizeDecrease = useCallback(() => {
    const current = getCurrentFontSize(editor)
    const next = Math.max(MIN_FONT_SIZE, current - 1)
    if (next === DEFAULT_FONT_SIZE) {
      editor.chain().focus().unsetFontSize().run()
    } else {
      editor.chain().focus().setFontSize(`${next}px`).run()
    }
  }, [editor])

  // ── Font-size keyboard shortcuts ──
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+= → increase font size
      if (e.ctrlKey && e.shiftKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        handleFontSizeIncrease()
      }
      // Ctrl+Shift+- → decrease font size
      if (e.ctrlKey && e.shiftKey && e.key === '-') {
        e.preventDefault()
        handleFontSizeDecrease()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleFontSizeIncrease, handleFontSizeDecrease])

  const currentFontSize = getCurrentFontSize(editor)

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className="sticky top-0 z-10 bg-card border-b border-border shadow-sm"
        onMouseDown={preventFocusLoss}
        data-testid="editor-toolbar"
      >
        <div className="flex items-center gap-1 px-3 py-1.5 flex-wrap">

          {/* ── Group: Undo / Redo ── */}
          <ToolbarIconButton
            icon={Undo2}
            label="Undo"
            shortcut="Ctrl+Z"
            onClick={() => editor.chain().focus().undo().run()}
            className={!editor.can().undo() ? 'opacity-40 pointer-events-none' : ''}
          />
          <ToolbarIconButton
            icon={Redo2}
            label="Redo"
            shortcut="Ctrl+Shift+Z"
            onClick={() => editor.chain().focus().redo().run()}
            className={!editor.can().redo() ? 'opacity-40 pointer-events-none' : ''}
          />

          <ToolbarSeparator />

          {/* ── Group: Export ── */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md text-xs font-medium px-2 py-1.5 transition-colors gap-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Export document
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent onMouseDown={preventFocusLoss} align="start">
              <DropdownMenuItem onSelect={() => exportAsPDF(editor)}>
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAsDOCX(editor)}>
                <FileType className="h-4 w-4 mr-2" />
                Export as Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => exportAsHTML(editor)}>
                <FileCode className="h-4 w-4 mr-2" />
                Export as HTML
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAsMarkdown(editor)}>
                <FileText className="h-4 w-4 mr-2" />
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAsText(editor)}>
                <Type className="h-4 w-4 mr-2" />
                Export as Plain Text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ── Create Slides Button ── */}
          {onCreateSlides && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md text-xs font-medium px-2 py-1.5 transition-colors gap-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={preventFocusLoss}
                  onClick={onCreateSlides}
                >
                  <Presentation className="h-3.5 w-3.5" />
                  Slides
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Generate presentation slides with AI
              </TooltipContent>
            </Tooltip>
          )}

          <ToolbarSeparator />

          {/* ── Group: Zoom ── */}
          <div className="flex items-center gap-0.5">
            <ToolbarIconButton
              icon={Minus}
              label="Zoom Out"
              onClick={() => onZoomChange(Math.max(50, zoom - 10))}
            />
            <span
              className="text-xs font-medium min-w-[2.5rem] text-center text-muted-foreground select-none cursor-default"
              onMouseDown={preventFocusLoss}
            >
              {zoom}%
            </span>
            <ToolbarIconButton
              icon={Plus}
              label="Zoom In"
              onClick={() => onZoomChange(Math.min(200, zoom + 10))}
            />
          </div>

          <ToolbarSeparator />

          {/* ── Group: Block — Headings ── */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center justify-center h-8 rounded-md text-sm transition-colors px-2 gap-0.5',
                      'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      (editor.isActive('heading', { level: 1 }) ||
                        editor.isActive('heading', { level: 2 }) ||
                        editor.isActive('heading', { level: 3 })) &&
                        'bg-accent text-accent-foreground shadow-sm',
                    )}
                  >
                    <Heading className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Headings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent onMouseDown={preventFocusLoss} align="start">
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={cn(editor.isActive('heading', { level: 1 }) && 'bg-accent')}
              >
                <span className="font-bold text-lg mr-2">H1</span>
                Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={cn(editor.isActive('heading', { level: 2 }) && 'bg-accent')}
              >
                <span className="font-bold text-base mr-2">H2</span>
                Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={cn(editor.isActive('heading', { level: 3 }) && 'bg-accent')}
              >
                <span className="font-bold text-sm mr-2">H3</span>
                Heading 3
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().setParagraph().run()}
                className={cn(!editor.isActive('heading') && 'bg-accent')}
              >
                <Type className="h-4 w-4 mr-2" />
                Normal Text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ── Group: Block — Lists ── */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center justify-center h-8 rounded-md text-sm transition-colors px-2 gap-0.5',
                      'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      (editor.isActive('bulletList') ||
                        editor.isActive('orderedList') ||
                        editor.isActive('taskList')) &&
                        'bg-accent text-accent-foreground shadow-sm',
                    )}
                  >
                    <List className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Lists</TooltipContent>
            </Tooltip>
            <DropdownMenuContent onMouseDown={preventFocusLoss} align="start">
              <DropdownMenuItem
                onSelect={() => smartToggleList(editor, 'bullet')}
                className={cn(editor.isActive('bulletList') && 'bg-accent')}
              >
                <List className="h-4 w-4 mr-2" />
                Bullet List
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => smartToggleList(editor, 'ordered')}
                className={cn(editor.isActive('orderedList') && 'bg-accent')}
              >
                <ListOrdered className="h-4 w-4 mr-2" />
                Ordered List
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => smartToggleList(editor, 'task')}
                className={cn(editor.isActive('taskList') && 'bg-accent')}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Task List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ToolbarSeparator />

          {/* ── Group: Format ── */}
          {FORMAT_TOOLS.map((tool) => (
            <ToolbarIconButton
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              shortcut={tool.shortcut}
              isActive={tool.isActive?.(editor)}
              onClick={() => tool.action(editor)}
            />
          ))}

          {/* ── Highlight dropdown ── */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center justify-center h-8 rounded-md text-sm transition-colors px-2 gap-0.5',
                      'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      editor.isActive('highlight') && 'bg-accent text-accent-foreground shadow-sm',
                    )}
                  >
                    <Highlighter className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Highlight</TooltipContent>
            </Tooltip>
            <DropdownMenuContent onMouseDown={preventFocusLoss} align="start">
              {HIGHLIGHT_COLORS.map(({ label, color }) => (
                <DropdownMenuItem
                  key={color}
                  onSelect={() => editor.chain().focus().toggleHighlight({ color }).run()}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 rounded border border-border/50" style={{ backgroundColor: color }} />
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().unsetHighlight().run()}
                className="flex items-center gap-2"
              >
                <div className="w-4 h-4 rounded border border-border" />
                Remove Highlight
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ToolbarSeparator />

          {/* ── Group: Font Size ── */}
          <div className="flex items-center gap-0.5">
            <ToolbarIconButton
              icon={AArrowDown}
              label="Decrease Font Size"
              shortcut="Ctrl+Shift+−"
              onClick={handleFontSizeDecrease}
            />
            <span
              className="text-xs font-medium min-w-[2.5rem] text-center text-muted-foreground select-none cursor-default tabular-nums"
              onMouseDown={preventFocusLoss}
              title="Current font size"
            >
              {currentFontSize}px
            </span>
            <ToolbarIconButton
              icon={AArrowUp}
              label="Increase Font Size"
              shortcut="Ctrl+Shift+="
              onClick={handleFontSizeIncrease}
            />
          </div>

          <ToolbarSeparator />

          {/* ── Group: Alignment ── */}
          {ALIGN_TOOLS.map((tool) => (
            <ToolbarIconButton
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              shortcut={tool.shortcut}
              isActive={tool.isActive?.(editor)}
              onClick={() => tool.action(editor)}
            />
          ))}

          {/* Spacer to push nothing — future right-side tools can go here */}
          <div className="flex-1" />
        </div>
      </div>
    </TooltipProvider>
  )
}

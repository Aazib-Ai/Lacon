/**
 * RefineButton — Floating "Refine" pill that appears when text is selected
 *
 * Positioned below the text selection using the editor view's coordinate
 * system. Updates position on selection changes and scrolls.
 */

import { MessageSquare, Sparkles, SmilePlus } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

export interface SelectedParagraphData {
  /** Paragraph text content */
  text: string
  /** Surrounding context: 2 paragraphs before */
  contextBefore: string
  /** Surrounding context: 2 paragraphs after */
  contextAfter: string
  /** ProseMirror positions */
  from: number
  to: number
  /** Paragraph ID from the paragraphId extension, if available */
  paragraphId: string
}

interface RefineButtonProps {
  editor: any
  onRefine: (data: SelectedParagraphData) => void
}

/**
 * Extract the selected paragraph data with surrounding context.
 */
export function getSelectedParagraphData(editor: any): SelectedParagraphData | null {
  if (!editor) return null

  const { state } = editor
  const { from, to } = state.selection

  // Need an actual text selection
  if (from === to) return null

  const selectedText = state.doc.textBetween(from, to, '\n')
  if (!selectedText || selectedText.trim().length <= 10) return null

  // Find the paragraph node the selection starts in
  const $from = state.doc.resolve(from)
  const paragraphNode = $from.parent
  const paragraphId =
    paragraphNode?.attrs?.paragraphId || `auto-${$from.index($from.depth - 1)}`

  // Gather surrounding context (2 blocks before + 2 blocks after)
  const contextBefore: string[] = []
  const contextAfter: string[] = []
  let foundSelected = false
  let afterCount = 0

  state.doc.content.forEach((node: any, offset: number) => {
    const nodeStart = offset
    const nodeEnd = offset + node.nodeSize
    const nodeText = node.textContent?.trim()

    if (!nodeText) return

    // Check if this node contains/overlaps the selection
    if (nodeStart <= from && nodeEnd >= to) {
      foundSelected = true
      return
    }

    if (!foundSelected) {
      contextBefore.push(nodeText)
      if (contextBefore.length > 2) contextBefore.shift()
    } else if (afterCount < 2) {
      contextAfter.push(nodeText)
      afterCount += 1
    }
  })

  return {
    text: selectedText,
    contextBefore: contextBefore.join('\n\n'),
    contextAfter: contextAfter.join('\n\n'),
    from,
    to,
    paragraphId,
  }
}

/**
 * Compute button position from the editor view coordinates.
 * Returns viewport-relative fixed coordinates, accounting for zoom transforms.
 */
function getButtonPosition(editor: any): { top: number; left: number } | null {
  try {
    const { state, view } = editor
    const { from, to } = state.selection

    // Get the end-of-selection coordinates (viewport-relative)
    const endCoords = view.coordsAtPos(to)
    // Get the start-of-selection coordinates to center horizontally
    const startCoords = view.coordsAtPos(from)

    // Center the button horizontally between start and end of selection
    const centerX = (startCoords.left + endCoords.right) / 2

    return {
      top: endCoords.bottom + 8,
      left: centerX,
    }
  } catch {
    return null
  }
}

export function RefineButton({ editor, onRefine }: RefineButtonProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Update visibility + position on selection changes
  const updatePosition = useCallback(() => {
    if (!editor) return

    const { state } = editor
    const { from, to } = state.selection

    if (from === to) {
      setVisible(false)
      return
    }

    const text = state.doc.textBetween(from, to, '\n')
    if (!text || text.trim().length <= 10) {
      setVisible(false)
      return
    }

    const pos = getButtonPosition(editor)
    if (pos) {
      setPosition(pos)
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [editor])

  // Listen to selection changes AND scroll events (to reposition)
  useEffect(() => {
    if (!editor) return

    editor.on('selectionUpdate', updatePosition)

    // Also reposition on scroll in the editor's scroll parent
    const scrollParent = editor.view?.dom?.closest('.paginated-canvas')
    if (scrollParent) {
      scrollParent.addEventListener('scroll', updatePosition, { passive: true })
    }

    return () => {
      editor.off('selectionUpdate', updatePosition)
      if (scrollParent) {
        scrollParent.removeEventListener('scroll', updatePosition)
      }
    }
  }, [editor, updatePosition])

  // Handle editor blur — delay hide so clicking the button doesn't dismiss it
  useEffect(() => {
    if (!editor) return

    const handleBlur = () => {
      hideTimerRef.current = setTimeout(() => {
        if (!buttonRef.current?.matches(':hover')) {
          setVisible(false)
        }
      }, 300)
    }

    const handleFocus = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }

    editor.on('blur', handleBlur)
    editor.on('focus', handleFocus)

    return () => {
      editor.off('blur', handleBlur)
      editor.off('focus', handleFocus)
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [editor])

  const handleClick = useCallback(() => {
    const data = getSelectedParagraphData(editor)
    if (data) {
      setVisible(false)
      onRefine(data)
    }
  }, [editor, onRefine])

  if (!editor || !visible) return null

  return (
    <div
      ref={buttonRef}
      className="refine-button-group"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}
      data-testid="refine-trigger-wrapper"
    >
      {/* Main refine action */}
      <button
        className="refine-button"
        onMouseDown={(e) => {
          e.preventDefault() // Prevent editor blur
          e.stopPropagation()
        }}
        onClick={handleClick}
        data-testid="refine-trigger"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="refine-button__label">Refine</span>
        <kbd className="refine-button__kbd">Ctrl+G</kbd>
      </button>

      {/* Separator */}
      <div className="refine-button-sep" />

      {/* Quick icon buttons */}
      <button
        className="refine-button-icon"
        title="Add comment"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </button>
      <button
        className="refine-button-icon"
        title="Add reaction"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <SmilePlus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

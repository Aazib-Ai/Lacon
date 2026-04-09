/**
 * Mention List Component - Phase 5
 * Dropdown list for mention suggestions with keyboard navigation
 */

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

import type { MentionItem } from '../extensions/mention-extension'

export interface MentionListProps {
  items: MentionItem[]
  command: (item: MentionItem) => void
}

export const MentionList = forwardRef<any, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command(item)
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter') {
        enterHandler()
        return true
      }

      return false
    },
  }))

  if (props.items.length === 0) {
    return (
      <div className="mention-list">
        <div className="mention-list-empty">No results</div>
      </div>
    )
  }

  return (
    <div className="mention-list">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          className={`mention-list-item ${index === selectedIndex ? 'is-selected' : ''}`}
          onClick={() => selectItem(index)}
          type="button"
        >
          <span className="mention-list-item-label">{item.label}</span>
          {item.type && <span className="mention-list-item-type">{item.type}</span>}
        </button>
      ))}
    </div>
  )
})

MentionList.displayName = 'MentionList'

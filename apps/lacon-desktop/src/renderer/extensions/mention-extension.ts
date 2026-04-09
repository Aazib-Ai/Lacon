/**
 * Mention Extension Configuration - Phase 5
 * Mention support with suggestion dropdown
 */

import * as MentionModule from '@tiptap/extension-mention'
import * as ReactModule from '@tiptap/react'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import tippy, { type Instance as TippyInstance } from 'tippy.js'

import { MentionList } from '../components/MentionList'

const { Mention } = MentionModule as any
const { ReactRenderer } = ReactModule as any

export interface MentionItem {
  id: string
  label: string
  type?: 'user' | 'document' | 'tag'
}

export interface MentionSuggestionProps extends SuggestionProps<MentionItem> {
  items: MentionItem[]
}

/**
 * Default mention items - can be customized per use case
 */
export const defaultMentionItems: MentionItem[] = [
  { id: 'user-1', label: 'John Doe', type: 'user' },
  { id: 'user-2', label: 'Jane Smith', type: 'user' },
  { id: 'doc-1', label: 'Project Plan', type: 'document' },
  { id: 'doc-2', label: 'Meeting Notes', type: 'document' },
  { id: 'tag-1', label: 'Important', type: 'tag' },
  { id: 'tag-2', label: 'Follow-up', type: 'tag' },
]

/**
 * Create mention suggestion configuration
 */
export function createMentionSuggestion(
  items: MentionItem[] = defaultMentionItems,
): Omit<SuggestionOptions<MentionItem>, 'editor'> {
  return {
    items: ({ query }) => {
      return items.filter(item => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    },

    render: () => {
      let component: any | undefined
      let popup: TippyInstance[] | undefined

      return {
        onStart: props => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) {
            return
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },

        onUpdate(props) {
          component?.updateProps(props)

          if (!props.clientRect) {
            return
          }

          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          })
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }

          return (component?.ref as any)?.onKeyDown?.(props) ?? false
        },

        onExit() {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
  }
}

export const MentionExtension = (items?: MentionItem[]) =>
  Mention.configure({
    HTMLAttributes: {
      class: 'editor-mention',
    },
    suggestion: createMentionSuggestion(items),
  })

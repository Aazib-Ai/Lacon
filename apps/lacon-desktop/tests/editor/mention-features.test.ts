/**
 * Mention Features Tests - Phase 5
 * Tests for mention insertion and suggestion
 */

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'

import { defaultMentionItems, MentionExtension } from '../../src/renderer/extensions/mention-extension'

describe('Mention Features', () => {
  function createEditor(content?: any) {
    return new Editor({
      extensions: [StarterKit, MentionExtension()],
      content,
    })
  }

  it('should have default mention items', () => {
    expect(defaultMentionItems).toBeDefined()
    expect(defaultMentionItems.length).toBeGreaterThan(0)
    expect(defaultMentionItems[0]).toHaveProperty('id')
    expect(defaultMentionItems[0]).toHaveProperty('label')
  })

  it('should insert mention node', () => {
    const editor = createEditor()
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'mention',
        attrs: {
          id: 'user-1',
          label: 'John Doe',
        },
      })
      .run()

    const json = editor.getJSON()
    expect(json.content?.[0]?.content?.[0]?.type).toBe('mention')
    expect(json.content?.[0]?.content?.[0]?.attrs?.id).toBe('user-1')
  })

  it('should preserve mention in JSON roundtrip', () => {
    const editor = createEditor()
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'mention',
        attrs: {
          id: 'user-1',
          label: 'John Doe',
        },
      })
      .run()

    const json1 = editor.getJSON()
    const editor2 = createEditor(json1)
    const json2 = editor2.getJSON()

    expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
  })

  it('should support different mention types', () => {
    const editor = createEditor()

    // User mention
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'mention',
        attrs: {
          id: 'user-1',
          label: 'John Doe',
        },
      })
      .run()

    // Document mention
    editor
      .chain()
      .focus()
      .insertContent(' ')
      .insertContent({
        type: 'mention',
        attrs: {
          id: 'doc-1',
          label: 'Project Plan',
        },
      })
      .run()

    const json = editor.getJSON()
    expect(json.content?.[0]?.content?.length).toBeGreaterThan(1)
  })
})

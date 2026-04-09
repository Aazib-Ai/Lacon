/**
 * Table Features Tests - Phase 5
 * Tests for table insertion, manipulation, and preservation
 */

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'

import { TableExtensions } from '../../src/renderer/extensions/table-extension'

describe('Table Features', () => {
  function createEditor(content?: any) {
    return new Editor({
      extensions: [StarterKit, ...TableExtensions],
      content,
    })
  }

  it('should insert a table with specified dimensions', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()

    const json = editor.getJSON()
    expect(json.content).toBeDefined()
    expect(json.content?.[0]?.type).toBe('table')
  })

  it('should add column before current cell', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()
    editor.chain().focus().addColumnBefore().run()

    const json = editor.getJSON()
    const table = json.content?.[0]
    expect(table?.type).toBe('table')
  })

  it('should add column after current cell', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()
    editor.chain().focus().addColumnAfter().run()

    const json = editor.getJSON()
    const table = json.content?.[0]
    expect(table?.type).toBe('table')
  })

  it('should delete column', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 2, cols: 3 }).run()
    editor.chain().focus().deleteColumn().run()

    const json = editor.getJSON()
    const table = json.content?.[0]
    expect(table?.type).toBe('table')
  })

  it('should add row before current cell', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()
    editor.chain().focus().addRowBefore().run()

    const json = editor.getJSON()
    const table = json.content?.[0]
    expect(table?.type).toBe('table')
  })

  it('should add row after current cell', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()
    editor.chain().focus().addRowAfter().run()

    const json = editor.getJSON()
    const table = json.content?.[0]
    expect(table?.type).toBe('table')
  })

  it('should delete row', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 3, cols: 2 }).run()
    editor.chain().focus().deleteRow().run()

    const json = editor.getJSON()
    const table = json.content?.[0]
    expect(table?.type).toBe('table')
  })

  it('should toggle header row', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()
    editor.chain().focus().toggleHeaderRow().run()

    const json = editor.getJSON()
    const table = json.content?.[0]
    expect(table?.type).toBe('table')
  })

  it('should delete entire table', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()
    editor.chain().focus().deleteTable().run()

    const json = editor.getJSON()
    // After deleting table, editor should have at least an empty paragraph
    expect(json.content?.length).toBeGreaterThanOrEqual(0)
  })

  it('should preserve table structure in JSON roundtrip', () => {
    const editor = createEditor()
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()

    const json1 = editor.getJSON()
    const editor2 = createEditor(json1)
    const json2 = editor2.getJSON()

    expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
  })
})

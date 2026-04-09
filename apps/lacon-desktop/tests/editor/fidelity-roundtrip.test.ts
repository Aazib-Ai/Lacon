/**
 * Content Fidelity Roundtrip Tests - Phase 5
 * Tests for JSON, HTML, and Markdown import/export fidelity with advanced features
 */

import { Editor } from '@tiptap/core'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'

import { MediaExtensions } from '../../src/renderer/extensions/media-extension'
import { MentionExtension } from '../../src/renderer/extensions/mention-extension'
import { TableExtensions } from '../../src/renderer/extensions/table-extension'

describe('Content Fidelity Roundtrip Tests', () => {
  const extensions = [StarterKit, ...TableExtensions, ...MediaExtensions, MentionExtension()]

  function createEditor(content?: any) {
    return new Editor({
      extensions,
      content,
    })
  }

  describe('JSON Roundtrip - Complex Documents', () => {
    it('should preserve complex document with all features', () => {
      const editor = createEditor()

      // Build complex document
      editor.commands.setContent('<h1>Test Document</h1>')
      editor.commands.insertContent('<p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>')
      editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()
      editor.commands.insertContent('<p>After table</p>')
      editor.chain().focus().setImage({ src: 'https://example.com/image.jpg', alt: 'Test' }).run()
      editor.commands.insertContent('<p>After image</p>')

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should preserve table with merged cells', () => {
      const editor = createEditor()
      editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()
      editor.chain().focus().mergeCells().run()

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should preserve nested lists with formatting', () => {
      const editor = createEditor()
      editor.commands.setContent(`
        <ul>
          <li><strong>Bold item</strong></li>
          <li><em>Italic item</em>
            <ul>
              <li>Nested item 1</li>
              <li>Nested item 2</li>
            </ul>
          </li>
          <li>Regular item</li>
        </ul>
      `)

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should preserve mentions in content', () => {
      const editor = createEditor()
      editor.commands.setContent('<p>Hello </p>')
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'mention',
          attrs: { id: 'user-1', label: 'John' },
        })
        .run()
      editor.commands.insertContent(' how are you?')

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should preserve links with formatting', () => {
      const editor = createEditor()
      editor.commands.setContent(
        '<p>Check out <a href="https://example.com"><strong>this link</strong></a> for more info.</p>',
      )

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })
  })

  describe('HTML Roundtrip - Complex Documents', () => {
    it('should preserve structure in HTML export', () => {
      const editor = createEditor()
      editor.commands.setContent(`
        <h1>Title</h1>
        <p>Paragraph with <strong>bold</strong> and <em>italic</em>.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `)

      const html = generateHTML(editor.getJSON(), extensions)
      expect(html).toContain('<h1>Title</h1>')
      expect(html).toContain('<strong>bold</strong>')
      expect(html).toContain('<em>italic</em>')
      expect(html).toContain('<ul>')
      expect(html).toContain('Item 1')
      expect(html).toContain('Item 2')
    })

    it('should preserve table in HTML', () => {
      const editor = createEditor()
      editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()

      const html = generateHTML(editor.getJSON(), extensions)
      expect(html).toContain('<table')
      expect(html).toContain('<tr')
      expect(html).toContain('<th')
      expect(html).toContain('<td')
    })

    it('should preserve images in HTML', () => {
      const editor = createEditor()
      editor.chain().focus().setImage({ src: 'https://example.com/test.jpg', alt: 'Test image' }).run()

      const html = generateHTML(editor.getJSON(), extensions)
      expect(html).toContain('<img')
      expect(html).toContain('src="https://example.com/test.jpg"')
      expect(html).toContain('alt="Test image"')
    })

    it('should preserve links in HTML', () => {
      const editor = createEditor()
      editor.commands.setContent('<p><a href="https://example.com">Link text</a></p>')

      const html = generateHTML(editor.getJSON(), extensions)
      expect(html).toContain('<a')
      expect(html).toContain('href="https://example.com"')
      expect(html).toContain('Link text')
    })
  })

  describe('Content Preservation - Edge Cases', () => {
    it('should preserve empty paragraphs', () => {
      const editor = createEditor()
      editor.commands.setContent('<p>First</p><p></p><p>Third</p>')

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should preserve whitespace in code blocks', () => {
      const editor = createEditor()
      editor.commands.setContent('<pre><code>  indented code\n    more indent</code></pre>')

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should preserve special characters', () => {
      const editor = createEditor()
      editor.commands.setContent('<p>&lt;tag&gt; &amp; "quotes" \'apostrophes\'</p>')

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should handle very long documents', () => {
      const editor = createEditor()
      const longContent = `<p>${  'word '.repeat(10000)  }</p>`
      editor.commands.setContent(longContent)

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should handle deeply nested structures', () => {
      const editor = createEditor()
      editor.commands.setContent(`
        <ul>
          <li>Level 1
            <ul>
              <li>Level 2
                <ul>
                  <li>Level 3
                    <ul>
                      <li>Level 4</li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      `)

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })
  })

  describe('Regression Tests - Advanced Nodes', () => {
    it('should not lose table content on edit', () => {
      const editor = createEditor()
      editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()

      // Add content to cells
      editor.commands.setContent(`
        <table>
          <tr><td>Cell 1</td><td>Cell 2</td></tr>
          <tr><td>Cell 3</td><td>Cell 4</td></tr>
        </table>
      `)

      const json1 = editor.getJSON()

      // Simulate edit
      editor.commands.focus()

      const json2 = editor.getJSON()
      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should not lose image attributes on edit', () => {
      const editor = createEditor()
      editor
        .chain()
        .focus()
        .setImage({
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Image title',
        })
        .run()

      const json1 = editor.getJSON()
      editor.commands.focus()
      const json2 = editor.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })

    it('should not lose link attributes on edit', () => {
      const editor = createEditor()
      editor.commands.setContent('<p><a href="https://example.com" title="Link title">Link</a></p>')

      const json1 = editor.getJSON()
      editor.commands.focus()
      const json2 = editor.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })
  })
})

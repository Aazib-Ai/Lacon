/**
 * Script Helpers Tests - Phase 5
 * Tests for script templates and formatting macros
 */

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'

import {
  formattingMacros,
  insertHeading,
  insertNote,
  insertSceneMarker,
  insertScriptTemplate,
  insertTimestamp,
  scriptTemplates,
  youtubeTemplates,
} from '../../src/renderer/utils/script-helpers'

describe('Script Helpers', () => {
  function createEditor() {
    return new Editor({
      extensions: [StarterKit],
    })
  }

  describe('Script templates', () => {
    it('should have scene heading template', () => {
      const template = scriptTemplates.find(t => t.id === 'scene-heading')
      expect(template).toBeDefined()
      expect(template?.content).toContain('INT.')
    })

    it('should have dialogue template', () => {
      const template = scriptTemplates.find(t => t.id === 'dialogue')
      expect(template).toBeDefined()
      expect(template?.content).toContain('CHARACTER')
    })

    it('should have transition template', () => {
      const template = scriptTemplates.find(t => t.id === 'transition')
      expect(template).toBeDefined()
      expect(template?.content).toContain('CUT TO')
    })

    it('should insert script template', () => {
      const editor = createEditor()
      const template = scriptTemplates[0]
      insertScriptTemplate(editor, template)

      const text = editor.getText()
      expect(text).toContain(template.content.trim())
    })
  })

  describe('YouTube templates', () => {
    it('should have intro template', () => {
      const template = youtubeTemplates.find(t => t.id === 'intro')
      expect(template).toBeDefined()
      expect(template?.content).toContain('INTRO')
    })

    it('should have b-roll note template', () => {
      const template = youtubeTemplates.find(t => t.id === 'b-roll-note')
      expect(template).toBeDefined()
      expect(template?.content).toContain('B-ROLL')
    })

    it('should have CTA template', () => {
      const template = youtubeTemplates.find(t => t.id === 'cta')
      expect(template).toBeDefined()
      expect(template?.content).toContain('CALL TO ACTION')
    })
  })

  describe('Quick insert functions', () => {
    it('should insert heading', () => {
      const editor = createEditor()
      insertHeading(editor, 2, 'Test Heading')

      const json = editor.getJSON()
      expect(json.content?.[0]?.type).toBe('heading')
      expect(json.content?.[0]?.attrs?.level).toBe(2)
    })

    it('should insert scene marker', () => {
      const editor = createEditor()
      insertSceneMarker(editor, 1, 'Opening Scene')

      const text = editor.getText()
      expect(text).toContain('Scene 1')
      expect(text).toContain('Opening Scene')
    })

    it('should insert scene marker without title', () => {
      const editor = createEditor()
      insertSceneMarker(editor, 5)

      const text = editor.getText()
      expect(text).toContain('Scene 5')
    })

    it('should insert timestamp', () => {
      const editor = createEditor()
      insertTimestamp(editor, '10:30:00')

      const text = editor.getText()
      expect(text).toContain('[10:30:00]')
    })

    it('should insert note', () => {
      const editor = createEditor()
      insertNote(editor, 'This is a test note')

      const text = editor.getText()
      expect(text).toContain('Note:')
      expect(text).toContain('This is a test note')
    })
  })

  describe('Formatting macros', () => {
    it('should convert to scene heading', () => {
      const editor = createEditor()
      editor.commands.setContent('<p>int. coffee shop - day</p>')
      editor.commands.setTextSelection({ from: 1, to: 1 })

      formattingMacros.toSceneHeading(editor)

      const text = editor.getText()
      expect(text).toContain('INT. COFFEE SHOP - DAY')
    })

    it('should wrap in parentheses', () => {
      const editor = createEditor()
      editor.commands.setContent('<p>whispers</p>')
      editor.commands.setTextSelection({ from: 1, to: 9 })

      formattingMacros.toParenthetical(editor)

      const text = editor.getText()
      expect(text).toContain('(whispers)')
    })

    it('should insert scene break', () => {
      const editor = createEditor()
      formattingMacros.insertSceneBreak(editor)

      const json = editor.getJSON()
      expect(json.content?.[0]?.type).toBe('horizontalRule')
    })
  })
})

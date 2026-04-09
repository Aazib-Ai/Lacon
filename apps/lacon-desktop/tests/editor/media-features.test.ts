/**
 * Media Features Tests - Phase 5
 * Tests for image and YouTube embed features
 */

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'

import { isValidImageSource, isValidYouTubeUrl, MediaExtensions } from '../../src/renderer/extensions/media-extension'

describe('Media Features', () => {
  function createEditor(content?: any) {
    return new Editor({
      extensions: [StarterKit, ...MediaExtensions],
      content,
    })
  }

  describe('Image insertion', () => {
    it('should insert image with URL', () => {
      const editor = createEditor()
      editor.chain().focus().setImage({ src: 'https://example.com/image.jpg' }).run()

      const json = editor.getJSON()
      const hasImage = JSON.stringify(json).includes('https://example.com/image.jpg')
      expect(hasImage).toBe(true)
    })

    it('should insert image with alt text', () => {
      const editor = createEditor()
      editor.chain().focus().setImage({ src: 'https://example.com/image.jpg', alt: 'Test image' }).run()

      const json = editor.getJSON()
      const jsonStr = JSON.stringify(json)
      expect(jsonStr).toContain('Test image')
    })

    it('should preserve image in JSON roundtrip', () => {
      const editor = createEditor()
      editor.chain().focus().setImage({ src: 'https://example.com/image.jpg', alt: 'Test' }).run()

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })
  })

  describe('YouTube embed', () => {
    it('should insert YouTube video', () => {
      const editor = createEditor()
      editor.chain().focus().setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }).run()

      const json = editor.getJSON()
      expect(json.content?.[0]?.type).toBe('youtube')
    })

    it('should preserve YouTube embed in JSON roundtrip', () => {
      const editor = createEditor()
      editor.chain().focus().setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }).run()

      const json1 = editor.getJSON()
      const editor2 = createEditor(json1)
      const json2 = editor2.getJSON()

      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))
    })
  })

  describe('URL validation', () => {
    it('should validate YouTube URLs', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
      expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
      expect(isValidYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
      expect(isValidYouTubeUrl('https://example.com')).toBe(false)
      expect(isValidYouTubeUrl('not a url')).toBe(false)
    })

    it('should validate image sources', () => {
      expect(isValidImageSource('https://example.com/image.jpg')).toBe(true)
      expect(isValidImageSource('http://example.com/image.png')).toBe(true)
      expect(isValidImageSource('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
      expect(isValidImageSource('not a url')).toBe(false)
      expect(isValidImageSource('ftp://example.com/image.jpg')).toBe(false)
    })
  })
})

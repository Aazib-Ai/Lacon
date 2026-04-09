/**
 * Content Analytics Tests - Phase 5
 * Tests for word count, duration estimates, and readability
 */

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'

import {
  calculateContentMetrics,
  calculateReadabilityScore,
  countParagraphs,
  countSentences,
  countWords,
  formatDuration,
  getReadabilityLevel,
} from '../../src/renderer/utils/content-analytics'

describe('Content Analytics', () => {
  function createEditor(content?: string) {
    const editor = new Editor({
      extensions: [StarterKit],
    })
    if (content) {
      editor.commands.setContent(`<p>${content}</p>`)
    }
    return editor
  }

  describe('Word counting', () => {
    it('should count words correctly', () => {
      expect(countWords('Hello world')).toBe(2)
      expect(countWords('One two three four five')).toBe(5)
      expect(countWords('')).toBe(0)
      expect(countWords('   ')).toBe(0)
      expect(countWords('Word')).toBe(1)
    })

    it('should handle multiple spaces', () => {
      expect(countWords('Hello    world')).toBe(2)
      expect(countWords('  Hello  world  ')).toBe(2)
    })

    it('should handle newlines', () => {
      expect(countWords('Hello\nworld')).toBe(2)
      expect(countWords('One\n\nTwo\n\n\nThree')).toBe(3)
    })
  })

  describe('Sentence counting', () => {
    it('should count sentences correctly', () => {
      expect(countSentences('Hello world.')).toBe(1)
      expect(countSentences('First sentence. Second sentence.')).toBe(2)
      expect(countSentences('Question? Answer!')).toBe(2)
      expect(countSentences('')).toBe(0)
    })

    it('should handle multiple punctuation', () => {
      expect(countSentences('Really?! Yes!!')).toBe(2)
    })
  })

  describe('Paragraph counting', () => {
    it('should count paragraphs in editor', () => {
      const editor = createEditor('First paragraph')
      editor.commands.insertContent('<p>Second paragraph</p>')

      const count = countParagraphs(editor)
      expect(count).toBeGreaterThanOrEqual(1)
    })

    it('should not count empty paragraphs', () => {
      const editor = createEditor('')
      const count = countParagraphs(editor)
      expect(count).toBe(0)
    })
  })

  describe('Duration formatting', () => {
    it('should format seconds', () => {
      expect(formatDuration(30)).toBe('30s')
      expect(formatDuration(59)).toBe('59s')
    })

    it('should format minutes', () => {
      expect(formatDuration(60)).toBe('1m')
      expect(formatDuration(120)).toBe('2m')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1m 30s')
      expect(formatDuration(125)).toBe('2m 5s')
    })
  })

  describe('Content metrics', () => {
    it('should calculate comprehensive metrics', () => {
      const editor = createEditor('Hello world. This is a test.')
      const metrics = calculateContentMetrics(editor)

      expect(metrics.wordCount).toBeGreaterThan(0)
      expect(metrics.characterCount).toBeGreaterThan(0)
      expect(metrics.speakingDuration).toBeGreaterThan(0)
      expect(metrics.readingDuration).toBeGreaterThan(0)
    })

    it('should calculate speaking duration based on 150 WPM', () => {
      const editor = createEditor('word '.repeat(150)) // 150 words
      const metrics = calculateContentMetrics(editor)

      // 150 words at 150 WPM = 1 minute = 60 seconds
      expect(metrics.speakingDuration).toBe(60)
    })

    it('should calculate reading duration based on 200 WPM', () => {
      const editor = createEditor('word '.repeat(200)) // 200 words
      const metrics = calculateContentMetrics(editor)

      // 200 words at 200 WPM = 1 minute = 60 seconds
      expect(metrics.readingDuration).toBe(60)
    })

    it('should handle empty content', () => {
      const editor = createEditor('')
      const metrics = calculateContentMetrics(editor)

      expect(metrics.wordCount).toBe(0)
      expect(metrics.characterCount).toBe(0)
      expect(metrics.speakingDuration).toBe(0)
      expect(metrics.readingDuration).toBe(0)
    })
  })

  describe('Readability scoring', () => {
    it('should calculate readability score', () => {
      const text = 'The cat sat on the mat. It was a sunny day.'
      const score = calculateReadabilityScore(text)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should return 0 for empty text', () => {
      expect(calculateReadabilityScore('')).toBe(0)
    })

    it('should provide readability level descriptions', () => {
      expect(getReadabilityLevel(95)).toBe('Very Easy')
      expect(getReadabilityLevel(85)).toBe('Easy')
      expect(getReadabilityLevel(75)).toBe('Fairly Easy')
      expect(getReadabilityLevel(65)).toBe('Standard')
      expect(getReadabilityLevel(55)).toBe('Fairly Difficult')
      expect(getReadabilityLevel(35)).toBe('Difficult')
      expect(getReadabilityLevel(20)).toBe('Very Difficult')
    })
  })
})

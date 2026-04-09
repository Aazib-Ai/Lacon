/**
 * Content Analytics Utilities - Phase 5
 * Word count, speaking duration, and readability metrics
 */

import type { Editor } from '@tiptap/core'

export interface ContentMetrics {
  wordCount: number
  characterCount: number
  characterCountNoSpaces: number
  paragraphCount: number
  sentenceCount: number
  speakingDuration: number // in seconds
  readingDuration: number // in seconds
  readabilityScore?: number
}

/**
 * Calculate comprehensive content metrics
 */
export function calculateContentMetrics(editor: Editor): ContentMetrics {
  const text = editor.getText()
  const words = countWords(text)
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const paragraphs = countParagraphs(editor)
  const sentences = countSentences(text)

  // Average speaking rate: 150 words per minute
  const speakingDuration = Math.ceil((words / 150) * 60)

  // Average reading rate: 200 words per minute
  const readingDuration = Math.ceil((words / 200) * 60)

  return {
    wordCount: words,
    characterCount: characters,
    characterCountNoSpaces: charactersNoSpaces,
    paragraphCount: paragraphs,
    sentenceCount: sentences,
    speakingDuration,
    readingDuration,
  }
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0
  }
  // Split by whitespace and filter empty strings
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Count sentences in text
 */
export function countSentences(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0
  }
  // Split by sentence-ending punctuation
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  return sentences.length
}

/**
 * Count paragraphs in editor
 */
export function countParagraphs(editor: Editor): number {
  let count = 0
  editor.state.doc.descendants(node => {
    if (node.type.name === 'paragraph' && node.textContent.trim().length > 0) {
      count += 1
    }
  })
  return count
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Calculate Flesch Reading Ease score
 * Score ranges from 0-100, higher is easier to read
 */
export function calculateReadabilityScore(text: string): number {
  const words = countWords(text)
  const sentences = countSentences(text)
  const syllables = countSyllables(text)

  if (words === 0 || sentences === 0) {
    return 0
  }

  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Count syllables in text (approximation)
 */
function countSyllables(text: string): number {
  const words = text.toLowerCase().split(/\s+/)
  let syllableCount = 0

  for (const word of words) {
    if (word.length === 0) {
      continue
    }

    // Remove non-alphabetic characters
    const cleanWord = word.replace(/[^a-z]/g, '')
    if (cleanWord.length === 0) {
      continue
    }

    // Count vowel groups
    const vowelGroups = cleanWord.match(/[aeiouy]+/g)
    let count = vowelGroups ? vowelGroups.length : 0

    // Adjust for silent e
    if (cleanWord.endsWith('e')) {
      count -= 1
    }

    // Ensure at least 1 syllable per word
    syllableCount += Math.max(1, count)
  }

  return syllableCount
}

/**
 * Get readability level description
 */
export function getReadabilityLevel(score: number): string {
  if (score >= 90) {
    return 'Very Easy'
  }
  if (score >= 80) {
    return 'Easy'
  }
  if (score >= 70) {
    return 'Fairly Easy'
  }
  if (score >= 60) {
    return 'Standard'
  }
  if (score >= 50) {
    return 'Fairly Difficult'
  }
  if (score >= 30) {
    return 'Difficult'
  }
  return 'Very Difficult'
}

/**
 * Media Extension Configuration - Phase 5
 * Image and YouTube embed support with validation
 */

import { Image } from '@tiptap/extension-image'
import { isValidYoutubeUrl as isValidYouTubeUrlUtil, Youtube } from '@tiptap/extension-youtube'

export const MediaExtensions = [
  Image.configure({
    inline: true,
    allowBase64: true,
    HTMLAttributes: {
      class: 'editor-image',
    },
  }),
  Youtube.configure({
    controls: true,
    nocookie: true,
    HTMLAttributes: {
      class: 'editor-youtube',
    },
  }),
]

export interface MediaCommands {
  insertImage: (src: string, alt?: string, title?: string) => void
  insertYouTube: (url: string, width?: number, height?: number) => void
  updateImage: (attrs: { src?: string; alt?: string; title?: string }) => void
}

/**
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  return !!isValidYouTubeUrlUtil(url)
}

/**
 * Validate image URL or data URI
 */
export function isValidImageSource(src: string): boolean {
  // Data URI
  if (src.startsWith('data:image/')) {
    return true
  }
  // HTTP(S) URL
  try {
    const url = new URL(src)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

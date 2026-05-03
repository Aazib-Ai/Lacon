/**
 * ContentExtractorService — Article Text Extraction
 *
 * Fetches web pages and extracts clean article text using
 * JSDOM + Mozilla Readability. Falls back gracefully on
 * non-readable or non-HTML pages.
 */

import { isProbablyReaderable,Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

import type { ExtractedArticle } from '../../shared/writer-types'

const MAX_CONTENT_LENGTH = 3000
const FETCH_TIMEOUT_MS = 10000

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export class ContentExtractorService {
  /**
   * Extract clean article content from a URL.
   * Returns null on failure (network error, non-HTML, non-readable).
   */
  async extractArticle(url: string): Promise<ExtractedArticle | null> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
        redirect: 'follow',
      })
      clearTimeout(timeout)

      if (!response.ok) {
        console.warn(`[Extractor] HTTP ${response.status} for ${url}`)
        return null
      }

      // Check Content-Type — must be HTML
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) {
        console.warn(`[Extractor] Non-HTML content type: ${contentType} for ${url}`)
        return null
      }

      const html = await response.text()

      // Parse with linkedom (lightweight, bundle-friendly alternative to jsdom)
      const { document: doc } = parseHTML(html)

      // Check readability
      if (!isProbablyReaderable(doc as any)) {
        console.warn(`[Extractor] Page not readable: ${url}`)
        return null
      }

      // Extract with Readability
      const reader = new Readability(doc as any)
      const article = reader.parse()

      if (!article || !article.textContent || article.textContent.trim().length < 100) {
        console.warn(`[Extractor] No meaningful content extracted from ${url}`)
        return null
      }

      // Clean and truncate
      const textContent = article.textContent.replace(/\s+/g, ' ').trim().slice(0, MAX_CONTENT_LENGTH)

      const excerpt = (article.excerpt || textContent.slice(0, 200)).trim()

      console.log(`[Extractor] Extracted ${textContent.length} chars from ${url}`)

      return {
        title: article.title || url,
        textContent,
        excerpt,
        url,
        length: textContent.length,
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[Extractor] Timeout for ${url}`)
      } else {
        console.warn(`[Extractor] Error for ${url}:`, err.message)
      }
      return null
    }
  }

  /**
   * Extract articles from multiple URLs concurrently.
   * Processes up to `maxConcurrent` at a time.
   * Returns only successful extractions.
   */
  async extractMultiple(urls: string[], maxConcurrent = 3): Promise<ExtractedArticle[]> {
    const results: ExtractedArticle[] = []

    // Process in batches
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent)
      const batchResults = await Promise.allSettled(batch.map(url => this.extractArticle(url)))

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value)
        }
      }
    }

    return results
  }
}

// ── Singleton ──
let instance: ContentExtractorService | null = null

export function getContentExtractorService(): ContentExtractorService {
  if (!instance) {
    instance = new ContentExtractorService()
  }
  return instance
}

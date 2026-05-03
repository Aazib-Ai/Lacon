/**
 * WebSearchService — Free Web Search
 *
 * Provides search via DuckDuckGo HTML scraping and Wikipedia REST API.
 * No API keys required. Rate-limited to avoid IP blocking.
 */

import * as cheerio from 'cheerio'

import type { WebSearchOptions, WebSearchResult } from '../../shared/writer-types'

const DDG_URL = 'https://html.duckduckgo.com/html/'
const WIKI_URL = 'https://en.wikipedia.org/w/api.php'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Rate limiter
const DDG_MIN_INTERVAL_MS = 2000
const DDG_COOLDOWN_DURATION_MS = 30000

export class WebSearchService {
  private lastDDGRequest = 0
  private ddgCooldownUntil = 0

  /**
   * Search DuckDuckGo HTML.
   * Returns up to `max` results. Returns [] on error (never throws).
   */
  async searchDuckDuckGo(query: string, max = 8): Promise<WebSearchResult[]> {
    // Check cooldown
    if (Date.now() < this.ddgCooldownUntil) {
      console.log('[WebSearch] DDG in cooldown, skipping')
      return []
    }

    // Rate limit
    const elapsed = Date.now() - this.lastDDGRequest
    if (elapsed < DDG_MIN_INTERVAL_MS) {
      await new Promise<void>(resolve => {
        setTimeout(resolve, DDG_MIN_INTERVAL_MS - elapsed)
      })
    }
    this.lastDDGRequest = Date.now()

    try {
      const params = new URLSearchParams({ q: query })
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(`${DDG_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.status === 429 || response.status === 403) {
        console.warn(`[WebSearch] DDG rate limited (${response.status}), entering cooldown`)
        this.ddgCooldownUntil = Date.now() + DDG_COOLDOWN_DURATION_MS
        return []
      }

      if (!response.ok) {
        console.warn(`[WebSearch] DDG HTTP ${response.status}`)
        return []
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const results: WebSearchResult[] = []

      $('.result').each((_i, el) => {
        if (results.length >= max) {return false}

        const $el = $(el)
        const titleEl = $el.find('.result__title a, .result__a')
        const snippetEl = $el.find('.result__snippet')
        const urlEl = $el.find('.result__url')

        const title = titleEl.text().trim()
        const snippet = snippetEl.text().trim()
        let url = titleEl.attr('href') || urlEl.text().trim()

        // DDG sometimes wraps URLs in redirects
        if (url.includes('uddg=')) {
          try {
            const decoded = new URL(url)
            url = decoded.searchParams.get('uddg') || url
          } catch {
            /* use as-is */
          }
        }

        // Clean URL
        if (!url.startsWith('http')) {
          url = url.startsWith('//') ? `https:${url}` : `https://${url}`
        }

        if (title && url) {
          results.push({
            title,
            snippet: snippet || '',
            url,
            source: 'duckduckgo',
            relevanceScore: Math.max(0.5, 0.95 - results.length * 0.06),
          })
        }
      })

      console.log(`[WebSearch] DDG returned ${results.length} results for "${query}"`)
      return results
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn('[WebSearch] DDG request timed out')
      } else {
        console.warn('[WebSearch] DDG error:', err.message)
      }
      return []
    }
  }

  /**
   * Search Wikipedia REST API.
   * Returns up to `max` results. Returns [] on error (never throws).
   */
  async searchWikipedia(query: string, max = 3): Promise<WebSearchResult[]> {
    try {
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: String(max),
        format: 'json',
        origin: '*',
      })

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const response = await fetch(`${WIKI_URL}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        console.warn(`[WebSearch] Wikipedia HTTP ${response.status}`)
        return []
      }

      const data = await response.json()
      const results: WebSearchResult[] = (data.query?.search || []).map((item: any) => ({
        title: item.title,
        snippet: item.snippet.replace(/<[^>]+>/g, '').trim(),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        source: 'wikipedia' as const,
        relevanceScore: 0.7,
      }))

      console.log(`[WebSearch] Wikipedia returned ${results.length} results for "${query}"`)
      return results
    } catch (err: any) {
      console.warn('[WebSearch] Wikipedia error:', err.message)
      return []
    }
  }

  /**
   * Search all backends in parallel. Deduplicates by URL.
   * Never throws — always returns an array (possibly empty).
   */
  async searchAll(query: string, opts?: WebSearchOptions): Promise<WebSearchResult[]> {
    const maxDDG = opts?.maxDDG ?? 8
    const maxWiki = opts?.maxWiki ?? 3

    const promises: Promise<WebSearchResult[]>[] = []

    if (!opts?.skipDDG && Date.now() >= this.ddgCooldownUntil) {
      promises.push(this.searchDuckDuckGo(query, maxDDG))
    }
    promises.push(this.searchWikipedia(query, maxWiki))

    const settled = await Promise.allSettled(promises)
    const allResults: WebSearchResult[] = []

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value)
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>()
    const unique = allResults.filter(r => {
      const normalized = r.url.replace(/\/$/, '').toLowerCase()
      if (seen.has(normalized)) {return false}
      seen.add(normalized)
      return true
    })

    // Sort by relevance
    unique.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return unique
  }
}

// ── Singleton ──
let instance: WebSearchService | null = null

export function getWebSearchService(): WebSearchService {
  if (!instance) {
    instance = new WebSearchService()
  }
  return instance
}

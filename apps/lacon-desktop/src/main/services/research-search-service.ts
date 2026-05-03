/**
 * ResearchSearchService — Research Pipeline Orchestrator
 *
 * Coordinates web search, content extraction, LLM summarization,
 * and research log persistence. Provides both quick search (preview)
 * and deep research (full pipeline) modes.
 *
 * Also evaluates research coverage across current and sibling documents.
 */

import type {
  ExtractedArticle,
  ResearchCoverage,
  ResearchLogEntry,
  ResearchSource,
  WebSearchResult,
} from '../../shared/writer-types'
import { getProviderManager } from '../providers/provider-manager'
import { getContentExtractorService } from './content-extractor'
import { getResearchLogService } from './research-log-service'
import { getWebSearchService } from './web-search-service'

// Stop words to exclude from relevance scoring
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'all',
  'can',
  'had',
  'her',
  'was',
  'one',
  'our',
  'out',
  'has',
  'have',
  'been',
  'some',
  'them',
  'than',
  'its',
  'over',
  'such',
  'that',
  'this',
  'with',
  'will',
  'each',
  'from',
  'they',
  'were',
  'which',
  'their',
  'what',
  'about',
  'would',
  'there',
  'when',
  'make',
  'like',
  'could',
  'into',
  'time',
  'very',
  'just',
  'know',
  'take',
  'people',
  'come',
  'could',
  'think',
  'also',
])

/** Mutex for preventing concurrent deep research calls */
let researchLock = false

export class ResearchSearchService {
  /**
   * Quick search — returns raw web results for UI preview.
   * No extraction, no LLM, no persistence.
   */
  async quickSearch(query: string): Promise<WebSearchResult[]> {
    return getWebSearchService().searchAll(query)
  }

  /**
   * Deep research — full pipeline:
   * 1. Web search (DDG + Wikipedia)
   * 2. Content extraction (top 3 URLs)
   * 3. LLM summarization (if provider available)
   * 4. Persist as research entry
   */
  async deepResearch(query: string, documentId: string): Promise<ResearchLogEntry> {
    // Mutex — prevent concurrent deep research
    if (researchLock) {
      throw new Error('Another research operation is in progress. Please wait.')
    }
    researchLock = true

    try {
      // Check for duplicate queries
      if (this.isDuplicateQuery(documentId, query)) {
        const log = getResearchLogService().getLog(documentId)
        const existing = log.entries.find(e => this.queryOverlap(e.query, query) > 0.8)
        if (existing) {
          console.log(`[Research] Duplicate query detected, returning existing entry: ${existing.id}`)
          return existing
        }
      }

      // Detect if query is a URL — direct extraction
      const isURL = /^https?:\/\//.test(query.trim())

      let searchResults: WebSearchResult[] = []
      let articles: ExtractedArticle[] = []
      let sources: ResearchSource[] = []
      let excerpts: string[] = []
      const tags: string[] = []

      if (isURL) {
        // Direct URL import
        const article = await getContentExtractorService().extractArticle(query.trim())
        if (article) {
          articles = [article]
          sources = [
            {
              url: query.trim(),
              title: article.title,
              type: 'web',
            },
          ]
          excerpts = [article.textContent.slice(0, 2000)]
          tags.push('url-import')
        } else {
          // URL extraction failed — still create entry with URL reference
          sources = [{ url: query.trim(), title: query.trim(), type: 'web' }]
          excerpts = [`[Could not extract content from: ${query.trim()}]`]
          tags.push('url-import', 'extraction-failed')
        }
      } else {
        // Normal search flow
        tags.push('web-search')

        // Step 1: Web search
        searchResults = await getWebSearchService().searchAll(query)

        if (searchResults.length === 0) {
          // No results — create entry with note
          const entry = getResearchLogService().addEntry(
            documentId,
            query,
            [],
            ['No web results found. Check your internet connection or try a different query.'],
            [],
            ['web-search', 'no-results'],
          )
          return entry
        }

        // Build sources from search results
        sources = searchResults.slice(0, 8).map(r => ({
          url: r.url,
          title: r.title,
          type: 'web' as const,
        }))

        // Step 2: Extract content from top URLs
        const urlsToExtract = searchResults
          .slice(0, 5)
          .map(r => r.url)
          .filter(u => !u.includes('wikipedia.org')) // Wiki snippets are good enough

        articles = await getContentExtractorService().extractMultiple(urlsToExtract)

        // Build excerpts: extracted content first, then snippets for non-extracted
        excerpts = []
        for (const result of searchResults.slice(0, 5)) {
          const article = articles.find(a => a.url === result.url)
          if (article) {
            excerpts.push(article.textContent.slice(0, 800))
          } else {
            excerpts.push(result.snippet)
          }
        }
      }

      // Step 3: LLM summarization (if available)
      let summary: string | null = null
      try {
        summary = await this.llmSummarize(query, sources, excerpts)
        if (summary) {
          tags.push('summarized')
        }
      } catch (err) {
        console.warn('[Research] LLM summarization failed:', err)
      }

      // Step 4: Build final excerpts array (summary first if available)
      const finalExcerpts = summary ? [summary, ...excerpts.slice(0, 4)] : excerpts.slice(0, 6)

      // Step 5: Persist as research entry
      const entry = getResearchLogService().addEntry(documentId, query, sources, finalExcerpts, [], tags)

      console.log(
        `[Research] Deep research complete: ${entry.id} (${sources.length} sources, ${finalExcerpts.length} excerpts)`,
      )
      return entry
    } finally {
      researchLock = false
    }
  }

  /**
   * Evaluate research coverage for a list of section topics.
   * Checks both current document and sibling documents in the project.
   */
  evaluateResearchCoverage(documentId: string, topics: string[], projectPath?: string): ResearchCoverage[] {
    const researchService = getResearchLogService()
    const currentLog = researchService.getLog(documentId)

    // Get sibling research if project path is available
    let siblingEntries: { documentId: string; entries: ResearchLogEntry[] }[] = []
    if (projectPath) {
      try {
        siblingEntries = researchService.getProjectResearch(projectPath).filter(d => d.documentId !== documentId)
      } catch {
        // Project research scan failed — continue with current only
      }
    }

    return topics.map(topic => {
      const topicTerms = topic
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length > 3 && !STOP_WORDS.has(t))

      if (topicTerms.length === 0) {
        return { topic, score: 0, coverage: 'uncovered' as const, bestEntryId: null, bestSource: 'current' as const }
      }

      let bestScore = 0
      let bestEntryId: string | null = null
      let bestSource: 'current' | 'sibling' = 'current'

      // Check current document's research
      for (const entry of currentLog.entries) {
        const score = this.entryRelevance(entry, topicTerms)
        if (score > bestScore) {
          bestScore = score
          bestEntryId = entry.id
          bestSource = 'current'
        }
      }

      // Check sibling documents
      for (const doc of siblingEntries) {
        for (const entry of doc.entries) {
          const score = this.entryRelevance(entry, topicTerms)
          if (score > bestScore) {
            bestScore = score
            bestEntryId = entry.id
            bestSource = 'sibling'
          }
        }
      }

      let coverage: 'covered' | 'partial' | 'uncovered' = 'uncovered'
      if (bestScore > 0.3) {coverage = 'covered'}
      else if (bestScore > 0.1) {coverage = 'partial'}

      return { topic, score: bestScore, coverage, bestEntryId, bestSource }
    })
  }

  /**
   * Check if a similar query already exists in the research log.
   */
  private isDuplicateQuery(documentId: string, query: string): boolean {
    const log = getResearchLogService().getLog(documentId)
    return log.entries.some(e => this.queryOverlap(e.query, query) > 0.8)
  }

  /**
   * Calculate term overlap between two queries (0–1).
   */
  private queryOverlap(a: string, b: string): number {
    const termsA = new Set(
      a
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length > 3 && !STOP_WORDS.has(t)),
    )
    const termsB = new Set(
      b
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length > 3 && !STOP_WORDS.has(t)),
    )

    if (termsA.size === 0 || termsB.size === 0) {return 0}

    let matches = 0
    for (const term of termsA) {
      if (termsB.has(term)) {matches += 1}
    }

    return matches / Math.max(termsA.size, termsB.size)
  }

  /**
   * Score how relevant a research entry is to a set of topic terms.
   */
  private entryRelevance(entry: ResearchLogEntry, topicTerms: string[]): number {
    const entryText = (`${entry.query  } ${  entry.excerpts.join(' ')}`).toLowerCase()
    const matchCount = topicTerms.filter(t => entryText.includes(t)).length
    return matchCount / topicTerms.length
  }

  /**
   * Use the user's configured LLM to summarize research sources.
   * Model-agnostic — works with any provider (OpenAI, Anthropic, Gemini, local, etc).
   */
  private async llmSummarize(query: string, sources: ResearchSource[], excerpts: string[]): Promise<string | null> {
    const pm = getProviderManager()
    const providers = pm.listProviders()
    const provider = providers.find(p => p.enabled)

    if (!provider) {
      console.log('[Research] No LLM provider available, skipping summarization')
      return null
    }

    const sourcesText = sources
      .slice(0, 5)
      .map((s, i) => {
        const excerpt = excerpts[i] || ''
        return `[${i + 1}] ${s.title}\n${excerpt.slice(0, 600)}\nURL: ${s.url || 'N/A'}`
      })
      .join('\n\n')

    const response = await pm.chatCompletion(
      provider.id,
      {
        model: provider.defaultModel || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a research assistant. Synthesize the provided sources into a concise research brief.
Include key findings, data points, and statistics. Cite sources by number [1], [2], etc.
Keep the summary under 300 words. Be factual and specific.`,
          },
          {
            role: 'user',
            content: `Research query: "${query}"\n\nSources:\n${sourcesText}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 500,
      },
      'web-research',
    )

    const content = response.choices?.[0]?.message?.content
    return content?.trim() || null
  }
}

// ── Singleton ──
let instance: ResearchSearchService | null = null

export function getResearchSearchService(): ResearchSearchService {
  if (!instance) {
    instance = new ResearchSearchService()
  }
  return instance
}

/**
 * Citation Service — Phase 5
 *
 * Responsible for:
 * - Formatting citations in multiple styles (APA, MLA, Chicago, IEEE, Inline)
 * - Fact-checking sections against the research log
 * - Returning confidence scores with supporting/contradicting evidence
 */

import type {
  CitationStyle,
  FactCheckResult,
  FactCheckSource,
  ResearchLogEntry,
  ResearchSource,
} from '../../shared/writer-types'
import { getResearchLogService } from './research-log-service'

export class CitationService {
  /**
   * Format a single research entry as a citation string.
   */
  formatCitation(entry: ResearchLogEntry, style: CitationStyle): string {
    const source = entry.sources[0]
    if (!source) {
      return this.formatQueryCitation(entry.query, style, entry.createdAt)
    }
    return this.formatSourceCitation(source, style, entry.createdAt)
  }

  /**
   * Format a citation from a source reference.
   */
  private formatSourceCitation(source: ResearchSource, style: CitationStyle, date: string): string {
    const year = new Date(date).getFullYear()
    const title = source.title || 'Untitled'
    const location = source.url || source.filePath || ''

    switch (style) {
      case 'apa':
        return `${title}. (${year}). Retrieved from ${location}`

      case 'mla':
        return `"${title}." Web. ${new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}. <${location}>.`

      case 'chicago':
        return `"${title}." Accessed ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ${location}.`

      case 'ieee':
        return `"${title}," ${year}. [Online]. Available: ${location}.`

      case 'inline':
        return `[${title}, ${year}]`

      default:
        return `${title} (${year}) — ${location}`
    }
  }

  /**
   * Format a citation from just a query string (no source).
   */
  private formatQueryCitation(query: string, style: CitationStyle, date: string): string {
    const year = new Date(date).getFullYear()

    switch (style) {
      case 'apa':
        return `Research query: "${query}" (${year}).`
      case 'mla':
        return `"${query}." Research note. ${year}.`
      case 'chicago':
        return `"${query}." Research note, ${year}.`
      case 'ieee':
        return `"${query}," research note, ${year}.`
      case 'inline':
        return `[${query}, ${year}]`
      default:
        return `${query} (${year})`
    }
  }

  /**
   * Get the citation style for a document.
   */
  getStyle(documentId: string): CitationStyle {
    const log = getResearchLogService().getLog(documentId)
    return log.citationStyle
  }

  /**
   * Set the citation style for a document and reformat all citations.
   */
  setStyle(documentId: string, style: CitationStyle): void {
    const service = getResearchLogService()
    const log = service.setCitationStyle(documentId, style)

    // Reformat all existing citations
    for (const entry of log.entries) {
      const formatted = this.formatCitation(entry, style)
      service.updateEntry(documentId, entry.id, { citationFormatted: formatted })
    }
  }

  /**
   * Fact-check a section's content against the research log.
   *
   * Returns a confidence score (0–1) and lists of supporting/contradicting sources.
   * This is a heuristic-based check: it searches for keyword overlap between
   * the section content and research excerpts.
   */
  factCheck(documentId: string, sectionId: string, sectionContent: string): FactCheckResult {
    const log = getResearchLogService().getLog(documentId)

    if (log.entries.length === 0) {
      return {
        sectionId,
        confidence: 0,
        supportingSources: [],
        contradictingSources: [],
        summary: 'No research entries available for fact-checking.',
        checkedAt: new Date().toISOString(),
      }
    }

    const contentLower = sectionContent.toLowerCase()
    const contentTerms = contentLower
      .split(/\s+/)
      .filter(t => t.length > 3)
      .map(t => t.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)

    const supporting: FactCheckSource[] = []
    const contradicting: FactCheckSource[] = []

    for (const entry of log.entries) {
      const allExcerpts = entry.excerpts.join(' ').toLowerCase()
      const excerptTerms = allExcerpts
        .split(/\s+/)
        .filter(t => t.length > 3)
        .map(t => t.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean)

      if (excerptTerms.length === 0) {continue}

      // Calculate term overlap
      const commonTerms = contentTerms.filter(t => excerptTerms.includes(t))
      const relevance = contentTerms.length > 0 ? commonTerms.length / contentTerms.length : 0

      if (relevance > 0.05) {
        // Find the most relevant excerpt
        let bestExcerpt = entry.excerpts[0] || entry.query
        let bestScore = 0

        for (const excerpt of entry.excerpts) {
          const excLower = excerpt.toLowerCase()
          const matches = contentTerms.filter(t => excLower.includes(t)).length
          if (matches > bestScore) {
            bestScore = matches
            bestExcerpt = excerpt
          }
        }

        const source: FactCheckSource = {
          entryId: entry.id,
          sourceTitle: entry.sources[0]?.title || entry.query,
          excerpt: bestExcerpt.slice(0, 300),
          relevance,
          supports: true, // Heuristic: keyword overlap = support
        }

        supporting.push(source)
      }
    }

    // Sort by relevance
    supporting.sort((a, b) => b.relevance - a.relevance)

    // Overall confidence: weighted average of top sources
    const topSources = supporting.slice(0, 5)
    const confidence =
      topSources.length > 0 ? topSources.reduce((sum, s) => sum + s.relevance, 0) / topSources.length : 0

    const summary =
      supporting.length > 0
        ? `Found ${supporting.length} supporting source(s) with ${Math.round(confidence * 100)}% average relevance.`
        : 'No matching research found for this section content.'

    return {
      sectionId,
      confidence: Math.min(confidence, 1),
      supportingSources: supporting.slice(0, 10),
      contradictingSources: contradicting.slice(0, 10),
      summary,
      checkedAt: new Date().toISOString(),
    }
  }
}

// ── Singleton ──
let instance: CitationService | null = null

export function getCitationService(): CitationService {
  if (!instance) {
    instance = new CitationService()
  }
  return instance
}

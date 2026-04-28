/**
 * Research Log Service — Phase 5
 *
 * Manages the research log persisted in .lacon/research.json and .lacon/research.md.
 * Responsible for:
 * - CRUD operations on research entries
 * - Research mode management (auto/supervised/manual)
 * - File ingestion (TXT, PDF, DOCX, PPTX — text extraction)
 * - Exporting the log as human-readable markdown
 * - Linking research entries to document sections
 */

import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'

import type {
  CitationStyle,
  ResearchLog,
  ResearchLogEntry,
  ResearchMode,
  ResearchSource,
} from '../../shared/writer-types'
import { getProjectWorkspaceService } from './project-workspace-service'

/**
 * Default empty research log.
 */
function createDefaultLog(): ResearchLog {
  return {
    entries: [],
    summary: '',
    mode: 'supervised',
    citationStyle: 'apa',
    lastUpdatedAt: new Date().toISOString(),
  }
}

export class ResearchLogService {
  // ── Read / Write ──

  /**
   * Get the full research log for a document.
   */
  getLog(documentId: string): ResearchLog {
    const paths = getProjectWorkspaceService().getResearchPath(documentId)
    try {
      const raw = readFileSync(paths.json, 'utf-8')
      const parsed = JSON.parse(raw)
      // Migrate legacy format (ResearchContext → ResearchLog)
      if (!parsed.mode) {
        return {
          entries: (parsed.entries || []).map((e: any) => this.migrateEntry(e)),
          summary: parsed.summary || '',
          mode: 'supervised',
          citationStyle: 'apa',
          lastUpdatedAt: new Date().toISOString(),
        }
      }
      return parsed as ResearchLog
    } catch {
      const log = createDefaultLog()
      this.persistLog(documentId, log)
      return log
    }
  }

  /**
   * Add a new research entry.
   */
  addEntry(
    documentId: string,
    query: string,
    sources: ResearchSource[] = [],
    excerpts: string[] = [],
    linkedSectionIds: string[] = [],
    tags: string[] = [],
  ): ResearchLogEntry {
    const log = this.getLog(documentId)
    const now = new Date().toISOString()

    const entry: ResearchLogEntry = {
      id: randomUUID(),
      query,
      sources,
      excerpts,
      linkedSectionIds,
      tags,
      citationFormatted: '',
      mode: log.mode,
      createdAt: now,
      updatedAt: now,
    }

    log.entries.push(entry)
    log.summary = this.buildSummary(log.entries)
    log.lastUpdatedAt = now

    this.persistLog(documentId, log)
    this.exportToMarkdown(documentId, log)

    return entry
  }

  /**
   * Update an existing research entry.
   */
  updateEntry(documentId: string, entryId: string, updates: Partial<ResearchLogEntry>): ResearchLogEntry {
    const log = this.getLog(documentId)
    const idx = log.entries.findIndex(e => e.id === entryId)
    if (idx === -1) {
      throw new Error(`Research entry not found: ${entryId}`)
    }

    log.entries[idx] = {
      ...log.entries[idx],
      ...updates,
      id: entryId, // prevent ID overwrite
      updatedAt: new Date().toISOString(),
    }

    log.summary = this.buildSummary(log.entries)
    log.lastUpdatedAt = new Date().toISOString()

    this.persistLog(documentId, log)
    this.exportToMarkdown(documentId, log)

    return log.entries[idx]
  }

  /**
   * Delete a research entry.
   */
  deleteEntry(documentId: string, entryId: string): void {
    const log = this.getLog(documentId)
    log.entries = log.entries.filter(e => e.id !== entryId)
    log.summary = this.buildSummary(log.entries)
    log.lastUpdatedAt = new Date().toISOString()

    this.persistLog(documentId, log)
    this.exportToMarkdown(documentId, log)
  }

  /**
   * Set the research automation mode.
   */
  setMode(documentId: string, mode: ResearchMode): ResearchLog {
    const log = this.getLog(documentId)
    log.mode = mode
    log.lastUpdatedAt = new Date().toISOString()
    this.persistLog(documentId, log)
    return log
  }

  /**
   * Set the citation style.
   */
  setCitationStyle(documentId: string, style: CitationStyle): ResearchLog {
    const log = this.getLog(documentId)
    log.citationStyle = style
    log.lastUpdatedAt = new Date().toISOString()
    this.persistLog(documentId, log)
    return log
  }

  /**
   * Import a file as a research entry.
   * Extracts text content from TXT files.
   * For PDF/DOCX/PPTX, records the file reference with basic metadata.
   */
  importFile(documentId: string, filePath: string, fileType: 'pdf' | 'docx' | 'txt' | 'pptx'): ResearchLogEntry {
    const fileName = basename(filePath)
    let excerpts: string[] = []

    if (fileType === 'txt') {
      // Direct text extraction
      try {
        const content = readFileSync(filePath, 'utf-8')
        // Split into chunks of ~500 chars for excerpts
        const chunks = content.match(/.{1,500}/gs) || [content]
        excerpts = chunks.slice(0, 10) // Max 10 excerpts
      } catch {
        excerpts = [`[Could not read file: ${fileName}]`]
      }
    } else {
      // For binary formats, record file reference
      // Full parsing would require pdf-parse, mammoth, pptx-to-text libraries
      excerpts = [`[Imported ${fileType.toUpperCase()} file: ${fileName}]`]

      // Attempt basic text extraction for known formats
      try {
        const buffer = readFileSync(filePath)
        const textContent = this.extractBasicText(buffer, fileType)
        if (textContent) {
          const chunks = textContent.match(/.{1,500}/gs) || [textContent]
          excerpts = chunks.slice(0, 10)
        }
      } catch {
        // Keep the placeholder excerpt
      }
    }

    const source: ResearchSource = {
      filePath,
      title: fileName,
      type: 'file',
    }

    return this.addEntry(documentId, `Imported from ${fileName}`, [source], excerpts, [], [fileType, 'import'])
  }

  // ── Helpers ──

  /**
   * Attempt basic text extraction from binary file buffers.
   * This is a lightweight fallback; full parsing needs dedicated libraries.
   */
  private extractBasicText(buffer: Buffer, fileType: string): string | null {
    if (fileType === 'docx') {
      // DOCX is a ZIP containing XML; try to find readable text
      const str = buffer.toString('utf-8')
      const textMatches = str.match(/<w:t[^>]*>([^<]+)<\/w:t>/g)
      if (textMatches) {
        return textMatches
          .map(m => m.replace(/<[^>]+>/g, ''))
          .join(' ')
          .slice(0, 5000)
      }
    }
    return null
  }

  /**
   * Build a summary string from all research entries.
   */
  private buildSummary(entries: ResearchLogEntry[]): string {
    if (entries.length === 0) {return ''}
    return entries.map(e => `• ${e.query}${e.sources.length > 0 ? ` (${e.sources.length} sources)` : ''}`).join('\n')
  }

  /**
   * Migrate a legacy ResearchEntry to ResearchLogEntry.
   */
  private migrateEntry(entry: any): ResearchLogEntry {
    return {
      id: entry.id || randomUUID(),
      query: entry.query || '',
      sources: entry.sources || [],
      excerpts: entry.excerpts || [],
      linkedSectionIds: [],
      tags: [],
      citationFormatted: '',
      mode: 'manual',
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.createdAt || new Date().toISOString(),
    }
  }

  /**
   * Persist the research log to .lacon/research.json.
   */
  private persistLog(documentId: string, log: ResearchLog): void {
    const paths = getProjectWorkspaceService().getResearchPath(documentId)
    writeFileSync(paths.json, JSON.stringify(log, null, 2), 'utf-8')
  }

  /**
   * Export the research log as human-readable markdown to .lacon/research.md.
   */
  private exportToMarkdown(documentId: string, log: ResearchLog): void {
    const paths = getProjectWorkspaceService().getResearchPath(documentId)

    const lines: string[] = [
      '# Research Log',
      '',
      `> Mode: ${log.mode} | Citation style: ${log.citationStyle}`,
      `> Last updated: ${log.lastUpdatedAt}`,
      '',
    ]

    if (log.entries.length === 0) {
      lines.push('No research entries yet.')
    } else {
      for (const entry of log.entries) {
        lines.push(`## ${entry.query}`)
        lines.push(`*${entry.createdAt}* — Mode: ${entry.mode}`)
        lines.push('')

        if (entry.sources.length > 0) {
          lines.push('### Sources')
          for (const src of entry.sources) {
            const loc = src.url || src.filePath || 'unknown'
            lines.push(`- **${src.title}** (${src.type}) — ${loc}`)
          }
          lines.push('')
        }

        if (entry.excerpts.length > 0) {
          lines.push('### Excerpts')
          for (const ex of entry.excerpts) {
            lines.push(`> ${ex.slice(0, 200)}${ex.length > 200 ? '...' : ''}`)
          }
          lines.push('')
        }

        if (entry.linkedSectionIds.length > 0) {
          lines.push(`**Linked sections:** ${entry.linkedSectionIds.join(', ')}`)
          lines.push('')
        }

        if (entry.citationFormatted) {
          lines.push(`**Citation:** ${entry.citationFormatted}`)
          lines.push('')
        }

        lines.push('---')
        lines.push('')
      }
    }

    writeFileSync(paths.md, lines.join('\n'), 'utf-8')
  }
}

// ── Singleton ──
let instance: ResearchLogService | null = null

export function getResearchLogService(): ResearchLogService {
  if (!instance) {
    instance = new ResearchLogService()
  }
  return instance
}

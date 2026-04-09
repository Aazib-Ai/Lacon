/**
 * Import/Export Service - Main Process
 * Handles conversion between JSON, HTML, and Markdown formats
 */

import type {
  DocumentContent,
  ExportFormat,
  ExportResult,
  ImportFormat,
  ImportResult,
  LaconDocument,
} from '../../shared/document-types'

export class ImportExportService {
  // Import document from various formats
  async importDocument(data: string, format: ImportFormat, title: string = 'Imported Document'): Promise<ImportResult> {
    try {
      let content: DocumentContent

      switch (format) {
        case 'json':
          content = this.importFromJSON(data)
          break
        case 'html':
          content = this.importFromHTML(data)
          break
        case 'markdown':
          content = this.importFromMarkdown(data)
          break
        default:
          return { success: false, error: 'Unsupported import format' }
      }

      const document: LaconDocument = {
        metadata: {
          id: this.generateId(),
          title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content,
      }

      return { success: true, document }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Import failed' }
    }
  }

  // Export document to various formats
  async exportDocument(document: LaconDocument, format: ExportFormat): Promise<ExportResult> {
    try {
      let data: string

      switch (format) {
        case 'json':
          data = this.exportToJSON(document.content)
          break
        case 'html':
          data = this.exportToHTML(document.content)
          break
        case 'markdown':
          data = this.exportToMarkdown(document.content)
          break
        default:
          return { success: false, error: 'Unsupported export format' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' }
    }
  }

  // JSON Import - validate and parse
  private importFromJSON(data: string): DocumentContent {
    const parsed = JSON.parse(data)

    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON structure')
    }

    // If it's a full document, extract content
    if (parsed.content && parsed.content.type === 'doc') {
      return parsed.content
    }

    // If it's just content
    if (parsed.type === 'doc') {
      return parsed
    }

    throw new Error('Invalid document JSON format')
  }

  // JSON Export - format with proper structure
  private exportToJSON(content: DocumentContent): string {
    return JSON.stringify(content, null, 2)
  }

  // HTML Import - convert to ProseMirror structure
  private importFromHTML(html: string): DocumentContent {
    // Basic HTML to ProseMirror conversion
    // This is a simplified version - TipTap will handle the actual conversion in renderer
    const sanitized = this.sanitizeHTML(html)

    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: sanitized.replace(/<[^>]*>/g, ''), // Strip tags for now
            },
          ],
        },
      ],
    }
  }

  // HTML Export - convert from ProseMirror structure
  private exportToHTML(content: DocumentContent): string {
    // Basic ProseMirror to HTML conversion
    let html = ''

    if (!content.content || !Array.isArray(content.content)) {
      return html
    }

    for (const node of content.content) {
      html += this.nodeToHTML(node)
    }

    return html
  }

  // Markdown Import - convert to ProseMirror structure
  private importFromMarkdown(markdown: string): DocumentContent {
    // Basic Markdown to ProseMirror conversion
    const lines = markdown.split('\n')
    const content: any[] = []

    for (const line of lines) {
      if (line.trim() === '') {
        continue
      }

      // Headings
      if (line.startsWith('# ')) {
        content.push({
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: line.substring(2) }],
        })
      } else if (line.startsWith('## ')) {
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: line.substring(3) }],
        })
      } else if (line.startsWith('### ')) {
        content.push({
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: line.substring(4) }],
        })
      } else {
        // Regular paragraph
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        })
      }
    }

    return { type: 'doc', content }
  }

  // Markdown Export - convert from ProseMirror structure
  private exportToMarkdown(content: DocumentContent): string {
    let markdown = ''

    if (!content.content || !Array.isArray(content.content)) {
      return markdown
    }

    for (const node of content.content) {
      markdown += `${this.nodeToMarkdown(node)}\n\n`
    }

    return markdown.trim()
  }

  // Helper: Convert node to HTML
  private nodeToHTML(node: any): string {
    if (!node) {
      return ''
    }

    switch (node.type) {
      case 'paragraph':
        return `<p>${this.contentToHTML(node.content)}</p>`
      case 'heading': {
        const level = node.attrs?.level || 1
        return `<h${level}>${this.contentToHTML(node.content)}</h${level}>`
      }
      case 'text':
        return this.escapeHTML(node.text || '')
      case 'bulletList':
        return `<ul>${this.contentToHTML(node.content)}</ul>`
      case 'orderedList':
        return `<ol>${this.contentToHTML(node.content)}</ol>`
      case 'listItem':
        return `<li>${this.contentToHTML(node.content)}</li>`
      default:
        return this.contentToHTML(node.content)
    }
  }

  // Helper: Convert content array to HTML
  private contentToHTML(content: any[]): string {
    if (!content || !Array.isArray(content)) {
      return ''
    }
    return content.map(node => this.nodeToHTML(node)).join('')
  }

  // Helper: Convert node to Markdown
  private nodeToMarkdown(node: any): string {
    if (!node) {
      return ''
    }

    switch (node.type) {
      case 'paragraph':
        return this.contentToMarkdown(node.content)
      case 'heading': {
        const level = node.attrs?.level || 1
        const prefix = '#'.repeat(level)
        return `${prefix} ${this.contentToMarkdown(node.content)}`
      }
      case 'text':
        return node.text || ''
      case 'bulletList':
        return this.contentToMarkdown(node.content)
      case 'orderedList':
        return this.contentToMarkdown(node.content)
      case 'listItem':
        return `- ${this.contentToMarkdown(node.content)}`
      default:
        return this.contentToMarkdown(node.content)
    }
  }

  // Helper: Convert content array to Markdown
  private contentToMarkdown(content: any[]): string {
    if (!content || !Array.isArray(content)) {
      return ''
    }
    return content.map(node => this.nodeToMarkdown(node)).join('')
  }

  // Helper: Sanitize HTML
  private sanitizeHTML(html: string): string {
    // Basic sanitization - remove script tags and dangerous attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
  }

  // Helper: Escape HTML
  private escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, m => map[m])
  }

  // Helper: Generate unique ID
  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

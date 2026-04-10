/**
 * ContentAnalytics service for the main process (Phase 10 - P10-T1.3)
 * Analyzes Tiptap JSON document structures for metrics.
 */

export interface DocumentMetrics {
  wordCount: number
  characterCount: number
  paragraphCount: number
  speakingDurationMinutes: number
  readingDurationMinutes: number
}

const SPEAKING_WPM = 130
const READING_WPM = 200

export class ContentAnalytics {
  /**
   * Analyze a Tiptap JSON document and return metrics.
   */
  analyze(doc: any): DocumentMetrics {
    const text = this.extractText(doc)
    const words = text.trim().split(/\s+/).filter(Boolean)
    const wordCount = words.length
    const characterCount = text.length
    const paragraphCount = this.countParagraphs(doc)

    return {
      wordCount,
      characterCount,
      paragraphCount,
      speakingDurationMinutes: wordCount / SPEAKING_WPM,
      readingDurationMinutes: wordCount / READING_WPM,
    }
  }

  /**
   * Recursively extract plain text from a Tiptap node tree.
   */
  private extractText(node: any): string {
    if (!node) {return ''}
    if (node.type === 'text') {return node.text || ''}
    if (!node.content || !Array.isArray(node.content)) {return ''}
    return node.content.map((child: any) => this.extractText(child)).join(' ')
  }

  /**
   * Count top-level paragraph nodes.
   */
  private countParagraphs(node: any): number {
    if (!node || !node.content || !Array.isArray(node.content)) {return 0}
    let count = 0
    for (const child of node.content) {
      if (child.type === 'paragraph') {
        count += 1
      } else if (child.content) {
        count += this.countParagraphs(child)
      }
    }
    return count
  }
}

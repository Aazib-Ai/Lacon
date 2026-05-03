/**
 * Slides feature — Shared type definitions
 *
 * These types are the SINGLE SOURCE OF TRUTH for slide data.
 * Used by: LLM output parser, SlideEditor UI, PPTX exporter, visual preview.
 *
 * Design: No HTML intermediate. SlideData maps directly to pptxgenjs objects.
 */

// ────────────────────────────────────────────────────────────────────
// Slide layouts
// ────────────────────────────────────────────────────────────────────

export type SlideLayout = 'title' | 'content' | 'section' | 'two-column' | 'closing'

export type SlideTheme = 'dark' | 'light' | 'corporate'

// ────────────────────────────────────────────────────────────────────
// Slide data model (the core unit)
// ────────────────────────────────────────────────────────────────────

export interface SlideData {
  /** Unique id for React keys and editing */
  id: string
  /** 1-indexed slide number */
  slideNumber: number
  /** Slide layout type */
  layout: SlideLayout
  /** Main title text */
  title: string
  /** Subtitle (used in title/section/closing layouts) */
  subtitle?: string
  /** Bullet points — max 6 items, max ~15 words each */
  bullets: string[]
  /** Right-column bullets (two-column layout only) */
  bulletsRight?: string[]
  /** Speaker notes */
  notes?: string
}

// ────────────────────────────────────────────────────────────────────
// Slide deck (the full document)
// ────────────────────────────────────────────────────────────────────

export interface SlideDeck {
  /** Version for future migrations */
  version: 1
  /** Source document info */
  source: {
    documentId: string
    documentTitle: string
    generatedAt: string
  }
  /** Visual theme */
  theme: SlideTheme
  /** Ordered array of slides */
  slides: SlideData[]
}

// ────────────────────────────────────────────────────────────────────
// IPC request/response types
// ────────────────────────────────────────────────────────────────────

export interface SlidesGenerateRequest {
  /** The document file path (used as identifier) */
  documentId: string
  /** Plain text content of the document */
  documentContent: string
  /** Document title (for the title slide) */
  documentTitle: string
  /** Desired number of slides (0 = auto) */
  slideCount: number
  /** Visual theme */
  theme: SlideTheme
  /** Include speaker notes? */
  includeNotes: boolean
}

export interface SlidesGenerateResponse {
  /** The generated slide deck */
  deck: SlideDeck
  /** Path where the .slides.json was saved */
  filePath: string
}

export interface SlidesSaveRequest {
  /** The document file path (used to derive slides file path) */
  documentId: string
  /** The full slide deck to save */
  deck: SlideDeck
}

export interface SlidesLoadRequest {
  /** The document file path */
  documentId: string
}

export interface SlidesExportPptxRequest {
  /** The slide deck to export */
  deck: SlideDeck
  /** Desired output file name (without extension) */
  outputFileName: string
}

// ────────────────────────────────────────────────────────────────────
// Layout constraints (enforced by SlideEditor UI)
// ────────────────────────────────────────────────────────────────────

export const SLIDE_CONSTRAINTS = {
  /** Maximum bullet points per slide */
  MAX_BULLETS: 6,
  /** Maximum characters per bullet */
  MAX_BULLET_CHARS: 120,
  /** Maximum title characters */
  MAX_TITLE_CHARS: 80,
  /** Maximum subtitle characters */
  MAX_SUBTITLE_CHARS: 120,
  /** Maximum speaker notes characters */
  MAX_NOTES_CHARS: 500,
  /** Slide aspect ratio */
  ASPECT_RATIO: 16 / 9,
} as const

/**
 * Slides Service — Main Process
 *
 * Responsibilities:
 * 1. Build a structured system prompt for the LLM
 * 2. Call the LLM via ProviderManager.chatCompletion()
 * 3. Parse the JSON response into SlideData[]
 * 4. Save/load .slides.json files in the project folder
 * 5. Generate PPTX via pptxgenjs (direct SlideData → PPTX mapping)
 */

import { app, dialog } from 'electron'
import { existsSync, promises as fs } from 'fs'
import { basename, dirname, extname, join } from 'path'

import type {
  SlideDeck,
  SlideData,
  SlideLayout,
  SlideTheme,
  SlidesGenerateRequest,
  SlidesGenerateResponse,
  SlidesExportPptxRequest,
} from '../../shared/slides-types'
import { getProviderManager } from '../providers/provider-manager'

// ────────────────────────────────────────────────────────────────────
// LLM Prompt Construction
// ────────────────────────────────────────────────────────────────────

function buildSlidesSystemPrompt(slideCount: number, includeNotes: boolean): string {
  const countInstruction = slideCount > 0
    ? `Create exactly ${slideCount} slides.`
    : 'Decide the optimal number of slides based on the content (typically 6-15 slides).'

  const notesInstruction = includeNotes
    ? 'Include concise speaker notes (1-3 sentences) for each slide in the "notes" field.'
    : 'Do NOT include speaker notes. Omit the "notes" field.'

  return `You are an expert presentation designer. Your job is to analyze document content and create a structured slide deck.

## RULES
1. ${countInstruction}
2. ${notesInstruction}
3. Each slide MUST have a "layout" field: "title", "content", "section", "two-column", or "closing".
4. The FIRST slide must be layout "title" with the document title and a compelling subtitle.
5. The LAST slide must be layout "closing" with a summary or call-to-action.
6. Use "section" layout for major topic transitions.
7. Use "content" layout for main information slides (most common).
8. Use "two-column" layout when comparing two things or showing pros/cons.
9. BULLET CONSTRAINTS: Maximum 6 bullets per slide, each bullet max 15 words.
10. TITLE CONSTRAINTS: Max 80 characters per slide title.
11. Extract KEY INSIGHTS — don't just copy text. Distill, summarize, highlight.
12. Make titles engaging and action-oriented, not boring headers.

## OUTPUT FORMAT
Return ONLY a valid JSON array of slide objects. No markdown, no explanation, no code fences.

Each slide object:
{
  "slideNumber": 1,
  "layout": "title" | "content" | "section" | "two-column" | "closing",
  "title": "Slide Title",
  "subtitle": "Optional subtitle (for title/section/closing)",
  "bullets": ["Point 1", "Point 2"],
  "bulletsRight": ["Right col 1", "Right col 2"],
  "notes": "Optional speaker notes"
}

Rules for each layout:
- "title": Use title + subtitle. Bullets optional.
- "content": Use title + bullets (1-6 items). No subtitle.
- "section": Use title + subtitle. No bullets.
- "two-column": Use title + bullets (left) + bulletsRight (right).
- "closing": Use title + subtitle. Bullets optional (for key takeaways).`
}

function buildSlidesUserPrompt(documentTitle: string, documentContent: string): string {
  // Truncate very long documents to avoid token limits
  const maxChars = 30000
  const truncated = documentContent.length > maxChars
    ? documentContent.slice(0, maxChars) + '\n\n[... content truncated for length ...]'
    : documentContent

  return `Create a presentation slide deck from the following document.

DOCUMENT TITLE: ${documentTitle}

DOCUMENT CONTENT:
${truncated}`
}

// ────────────────────────────────────────────────────────────────────
// LLM Call + Parse
// ────────────────────────────────────────────────────────────────────

async function generateSlidesViaLLM(
  request: SlidesGenerateRequest,
): Promise<SlideData[]> {
  const providerManager = getProviderManager()
  const providers = providerManager.listProviders()

  if (providers.length === 0) {
    throw new Error('No AI provider configured. Please add a provider in Settings.')
  }

  const providerId = providers[0].id
  const models = await providerManager.getAvailableModels(providerId)
  if (models.length === 0) {
    throw new Error('No models available for the configured provider.')
  }

  const modelId = models[0].id

  const systemPrompt = buildSlidesSystemPrompt(request.slideCount, request.includeNotes)
  const userPrompt = buildSlidesUserPrompt(request.documentTitle, request.documentContent)

  console.log(`[SlidesService] Generating slides via ${providerId}/${modelId}`)

  const response = await providerManager.chatCompletion(
    providerId,
    {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    'slides-generation',
  )

  const content = response.choices?.[0]?.message?.content?.trim() || ''
  console.log(`[SlidesService] LLM response length: ${content.length} chars`)
  if (!content) {
    console.error('[SlidesService] Empty LLM response. Raw response keys:', Object.keys(response))
    throw new Error('AI returned an empty response. Please try again or check your provider settings.')
  }

  // Parse JSON — strip markdown fences if present
  let jsonStr = content
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  let slides: any[]
  try {
    slides = JSON.parse(jsonStr)
  } catch (err) {
    console.error('[SlidesService] Failed to parse LLM JSON:', jsonStr.slice(0, 200))
    throw new Error('Failed to parse slide data from AI response. Please try again.')
  }

  if (!Array.isArray(slides)) {
    throw new Error('AI response was not a valid slide array.')
  }

  // Normalize and validate
  return slides.map((s: any, i: number) => ({
    id: `slide-${Date.now()}-${i}`,
    slideNumber: i + 1,
    layout: validateLayout(s.layout),
    title: String(s.title || `Slide ${i + 1}`).slice(0, 80),
    subtitle: s.subtitle ? String(s.subtitle).slice(0, 120) : undefined,
    bullets: Array.isArray(s.bullets) ? s.bullets.map((b: any) => String(b).slice(0, 120)).slice(0, 6) : [],
    bulletsRight: Array.isArray(s.bulletsRight) ? s.bulletsRight.map((b: any) => String(b).slice(0, 120)).slice(0, 6) : undefined,
    notes: s.notes ? String(s.notes).slice(0, 500) : undefined,
  }))
}

function validateLayout(layout: any): SlideLayout {
  const valid: SlideLayout[] = ['title', 'content', 'section', 'two-column', 'closing']
  return valid.includes(layout) ? layout : 'content'
}

// ────────────────────────────────────────────────────────────────────
// File I/O — .slides.json
// ────────────────────────────────────────────────────────────────────

function getSlidesFilePath(documentId: string): string {
  const dir = dirname(documentId)
  const base = basename(documentId, extname(documentId))
  return join(dir, `${base}.slides.json`)
}

async function saveSlideDeck(documentId: string, deck: SlideDeck): Promise<string> {
  const filePath = getSlidesFilePath(documentId)
  await fs.writeFile(filePath, JSON.stringify(deck, null, 2), 'utf-8')
  console.log(`[SlidesService] Saved slide deck to ${filePath}`)
  return filePath
}

async function loadSlideDeck(documentId: string): Promise<SlideDeck | null> {
  const filePath = getSlidesFilePath(documentId)
  try {
    if (!existsSync(filePath)) return null
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as SlideDeck
  } catch (err) {
    console.error(`[SlidesService] Failed to load slide deck:`, err)
    return null
  }
}

// ────────────────────────────────────────────────────────────────────
// PPTX Export (direct SlideData → pptxgenjs mapping)
// ────────────────────────────────────────────────────────────────────

/** Theme color palettes for PPTX generation */
const THEME_COLORS: Record<SlideTheme, {
  bg: string
  titleColor: string
  textColor: string
  subtitleColor: string
  accentColor: string
  bulletColor: string
  sectionBg: string
}> = {
  dark: {
    bg: '0F172A',
    titleColor: 'F8FAFC',
    textColor: 'CBD5E1',
    subtitleColor: '94A3B8',
    accentColor: '6366F1',
    bulletColor: '818CF8',
    sectionBg: '1E293B',
  },
  light: {
    bg: 'FFFFFF',
    titleColor: '0F172A',
    textColor: '334155',
    subtitleColor: '64748B',
    accentColor: '3B82F6',
    bulletColor: '3B82F6',
    sectionBg: 'F1F5F9',
  },
  corporate: {
    bg: 'FAFAF9',
    titleColor: '1C1917',
    textColor: '44403C',
    subtitleColor: '78716C',
    accentColor: '0D9488',
    bulletColor: '0D9488',
    sectionBg: 'F5F5F4',
  },
}

async function exportToPptx(deck: SlideDeck, outputFileName: string): Promise<string> {
  // Dynamic import pptxgenjs (it's a large module)
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()

  const colors = THEME_COLORS[deck.theme] || THEME_COLORS.dark

  pptx.author = 'LACON'
  pptx.title = deck.source.documentTitle
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches (16:9)

  for (const slide of deck.slides) {
    const pptxSlide = pptx.addSlide()
    pptxSlide.background = { fill: colors.bg }

    switch (slide.layout) {
      case 'title':
        renderTitleSlide(pptxSlide, slide, colors)
        break
      case 'section':
        renderSectionSlide(pptxSlide, slide, colors)
        break
      case 'closing':
        renderClosingSlide(pptxSlide, slide, colors)
        break
      case 'two-column':
        renderTwoColumnSlide(pptxSlide, slide, colors)
        break
      case 'content':
      default:
        renderContentSlide(pptxSlide, slide, colors)
        break
    }

    // Speaker notes
    if (slide.notes) {
      pptxSlide.addNotes(slide.notes)
    }
  }

  // Save via dialog
  const savePath = await dialog.showSaveDialog({
    title: 'Export Presentation',
    defaultPath: join(app.getPath('documents'), `${outputFileName}.pptx`),
    filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
  })

  if (savePath.canceled || !savePath.filePath) {
    throw new Error('Export cancelled')
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  await fs.writeFile(savePath.filePath, buffer)
  console.log(`[SlidesService] Exported PPTX to ${savePath.filePath}`)
  return savePath.filePath
}

// ── PPTX Slide Renderers ──

function renderTitleSlide(slide: any, data: SlideData, colors: any): void {
  // Accent bar at top
  slide.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: colors.accentColor },
  })

  // Title
  slide.addText(data.title, {
    x: 0.8, y: 2.0, w: 11.5, h: 1.5,
    fontSize: 40, fontFace: 'Segoe UI',
    color: colors.titleColor,
    bold: true,
    align: 'left',
    valign: 'bottom',
  })

  // Subtitle
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 3.6, w: 11.5, h: 0.8,
      fontSize: 20, fontFace: 'Segoe UI',
      color: colors.subtitleColor,
      align: 'left',
      valign: 'top',
    })
  }

  // Bottom accent line
  slide.addShape('rect', {
    x: 0.8, y: 3.4, w: 2, h: 0.06,
    fill: { color: colors.accentColor },
  })
}

function renderContentSlide(slide: any, data: SlideData, colors: any): void {
  // Accent bar
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.08, h: '100%',
    fill: { color: colors.accentColor },
  })

  // Title
  slide.addText(data.title, {
    x: 0.6, y: 0.3, w: 12, h: 0.9,
    fontSize: 28, fontFace: 'Segoe UI',
    color: colors.titleColor,
    bold: true,
    align: 'left',
    valign: 'middle',
  })

  // Divider line
  slide.addShape('rect', {
    x: 0.6, y: 1.2, w: 12, h: 0.02,
    fill: { color: colors.accentColor + '40' },
  })

  // Bullets
  if (data.bullets.length > 0) {
    const bulletRows = data.bullets.map(b => ({
      text: b,
      options: {
        fontSize: 18,
        fontFace: 'Segoe UI',
        color: colors.textColor,
        bullet: { type: 'bullet' as const, color: colors.bulletColor },
        paraSpaceBefore: 8,
        paraSpaceAfter: 8,
      },
    }))
    slide.addText(bulletRows, {
      x: 0.8, y: 1.5, w: 11.5, h: 5.2,
      valign: 'top',
    })
  }
}

function renderSectionSlide(slide: any, data: SlideData, colors: any): void {
  slide.background = { fill: colors.sectionBg }

  // Large accent square
  slide.addShape('rect', {
    x: 0.8, y: 2.8, w: 0.5, h: 0.5,
    fill: { color: colors.accentColor },
    rectRadius: 0.05,
  })

  // Title
  slide.addText(data.title, {
    x: 1.6, y: 2.2, w: 10.5, h: 1.2,
    fontSize: 36, fontFace: 'Segoe UI',
    color: colors.titleColor,
    bold: true,
    align: 'left',
    valign: 'middle',
  })

  // Subtitle
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 1.6, y: 3.5, w: 10.5, h: 0.8,
      fontSize: 18, fontFace: 'Segoe UI',
      color: colors.subtitleColor,
      align: 'left',
      valign: 'top',
    })
  }
}

function renderTwoColumnSlide(slide: any, data: SlideData, colors: any): void {
  // Accent bar
  slide.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 0.06,
    fill: { color: colors.accentColor },
  })

  // Title
  slide.addText(data.title, {
    x: 0.6, y: 0.3, w: 12, h: 0.9,
    fontSize: 28, fontFace: 'Segoe UI',
    color: colors.titleColor,
    bold: true,
  })

  // Left column
  if (data.bullets.length > 0) {
    const leftRows = data.bullets.map(b => ({
      text: b,
      options: {
        fontSize: 16, fontFace: 'Segoe UI',
        color: colors.textColor,
        bullet: { type: 'bullet' as const, color: colors.bulletColor },
        paraSpaceBefore: 6, paraSpaceAfter: 6,
      },
    }))
    slide.addText(leftRows, {
      x: 0.6, y: 1.5, w: 5.8, h: 5.2,
      valign: 'top',
    })
  }

  // Right column
  if (data.bulletsRight && data.bulletsRight.length > 0) {
    const rightRows = data.bulletsRight.map(b => ({
      text: b,
      options: {
        fontSize: 16, fontFace: 'Segoe UI',
        color: colors.textColor,
        bullet: { type: 'bullet' as const, color: colors.bulletColor },
        paraSpaceBefore: 6, paraSpaceAfter: 6,
      },
    }))
    slide.addText(rightRows, {
      x: 6.8, y: 1.5, w: 5.8, h: 5.2,
      valign: 'top',
    })
  }

  // Column divider
  slide.addShape('rect', {
    x: 6.5, y: 1.5, w: 0.02, h: 5.0,
    fill: { color: colors.accentColor + '30' },
  })
}

function renderClosingSlide(slide: any, data: SlideData, colors: any): void {
  // Full accent bar at bottom
  slide.addShape('rect', {
    x: 0, y: 7.0, w: '100%', h: 0.5,
    fill: { color: colors.accentColor },
  })

  // Title
  slide.addText(data.title, {
    x: 0.8, y: 2.0, w: 11.5, h: 1.5,
    fontSize: 36, fontFace: 'Segoe UI',
    color: colors.titleColor,
    bold: true,
    align: 'center',
    valign: 'bottom',
  })

  // Subtitle
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 3.8, w: 11.5, h: 0.8,
      fontSize: 18, fontFace: 'Segoe UI',
      color: colors.subtitleColor,
      align: 'center',
    })
  }

  // Key takeaways
  if (data.bullets.length > 0) {
    const rows = data.bullets.map(b => ({
      text: b,
      options: {
        fontSize: 16, fontFace: 'Segoe UI',
        color: colors.textColor,
        bullet: { type: 'bullet' as const, color: colors.bulletColor },
        paraSpaceBefore: 6,
      },
    }))
    slide.addText(rows, {
      x: 2, y: 4.8, w: 9, h: 2.0,
      valign: 'top',
    })
  }
}

// ────────────────────────────────────────────────────────────────────
// Public API (used by IPC handlers)
// ────────────────────────────────────────────────────────────────────

export class SlidesService {
  async generate(request: SlidesGenerateRequest): Promise<SlidesGenerateResponse> {
    const slides = await generateSlidesViaLLM(request)

    const deck: SlideDeck = {
      version: 1,
      source: {
        documentId: request.documentId,
        documentTitle: request.documentTitle,
        generatedAt: new Date().toISOString(),
      },
      theme: request.theme,
      slides,
    }

    const filePath = await saveSlideDeck(request.documentId, deck)
    return { deck, filePath }
  }

  async save(documentId: string, deck: SlideDeck): Promise<string> {
    return saveSlideDeck(documentId, deck)
  }

  async load(documentId: string): Promise<SlideDeck | null> {
    return loadSlideDeck(documentId)
  }

  async exportPptx(request: SlidesExportPptxRequest): Promise<string> {
    return exportToPptx(request.deck, request.outputFileName)
  }
}

// Singleton
let slidesServiceInstance: SlidesService | null = null

export function getSlidesService(): SlidesService {
  if (!slidesServiceInstance) {
    slidesServiceInstance = new SlidesService()
  }
  return slidesServiceInstance
}

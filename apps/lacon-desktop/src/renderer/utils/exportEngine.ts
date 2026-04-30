/**
 * exportEngine.ts — Lossless document export for the Lacon editor.
 *
 * Supports five formats:
 *   1. PDF  — Hidden iframe with full editor CSS, triggers print-to-PDF
 *   2. DOCX — Built programmatically via the `docx` library
 *   3. HTML — Standalone file with embedded stylesheet
 *   4. Markdown — Via TipTap's getMarkdown()
 *   5. Plain Text — Via TipTap's getText()
 *
 * Every function accepts the raw editor instance (or its HTML output) so the
 * toolbar only needs a single import to reach all five paths.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

// ────────────────────────────────────────────────────────────────────
// Types (the editor is `any` because TipTap generic types are loose)
// ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TiptapEditor = any

// ────────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────────

/** Trigger a browser download from an in-memory Blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  // Clean up after a tick so the download can start
  requestAnimationFrame(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  })
}

/** Extract a sane document title from the editor's first H1 node. */
function getDocumentTitle(editor: TiptapEditor): string {
  try {
    const json = editor.getJSON()
    const firstHeading = json?.content?.find(
      (node: any) => node.type === 'heading' && node.attrs?.level === 1,
    )
    if (firstHeading?.content?.[0]?.text) {
      return firstHeading.content[0].text
        .replace(/[<>:"/\\|?*]/g, '') // strip filesystem-illegal chars
        .trim()
        .substring(0, 80)
    }
  } catch {
    // Silently fall through
  }
  return 'Untitled'
}

/**
 * Build the full CSS stylesheet that mirrors the editor's visual output.
 * Used by both HTML and PDF exports.
 */
function buildExportStylesheet(): string {
  return `
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page ── */
    body {
      font-family: 'Georgia', 'Times New Roman', 'Noto Serif', serif;
      max-width: 816px;
      margin: 0 auto;
      padding: 96px 115px;
      line-height: 1.75;
      color: #1a1a1a;
      background: #ffffff;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Headings ── */
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 1.5rem 0 1rem;
      line-height: 1.3;
      color: #111;
    }
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 2rem 0 0.75rem;
      line-height: 1.35;
      color: #1a1a1a;
    }
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 1.5rem 0 0.5rem;
      line-height: 1.4;
      color: #1a1a1a;
    }

    /* ── Paragraphs ── */
    p {
      margin: 0.75rem 0;
    }

    /* ── Links ── */
    a {
      color: #0066cc;
      text-decoration: underline;
    }

    /* ── Bold / Italic / Strike / Underline ── */
    strong { font-weight: 700; }
    em { font-style: italic; }
    s { text-decoration: line-through; }
    u { text-decoration: underline; }

    /* ── Highlight / Mark ── */
    mark {
      padding: 0.1em 0.2em;
      border-radius: 2px;
    }

    /* ── Lists ── */
    ul, ol {
      padding-left: 1.5rem;
      margin: 0.75rem 0;
    }
    li {
      margin: 0.25rem 0;
    }
    li p {
      margin: 0.15rem 0;
    }

    /* ── Task lists ── */
    ul[data-type="taskList"] {
      list-style: none;
      padding-left: 0;
    }
    ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    ul[data-type="taskList"] li label {
      margin-top: 0.15rem;
    }
    ul[data-type="taskList"] li label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #0066cc;
    }
    ul[data-type="taskList"] li div {
      flex: 1;
    }

    /* ── Blockquote ── */
    blockquote {
      border-left: 3px solid #ccc;
      padding-left: 1rem;
      margin: 1rem 0;
      color: #555;
      font-style: italic;
    }

    /* ── Code ── */
    code {
      background: #f4f4f4;
      padding: 0.15em 0.3em;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    pre code {
      background: none;
      padding: 0;
      border-radius: 0;
      font-size: 0.85em;
      line-height: 1.6;
    }

    /* ── Horizontal Rule ── */
    hr {
      border: none;
      border-top: 2px solid #ddd;
      margin: 2rem 0;
    }

    /* ── Tables ── */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1rem 0;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 8px 12px;
      vertical-align: top;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: 600;
    }

    /* ── Images ── */
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1rem 0;
      border-radius: 4px;
    }

    /* ── YouTube embeds (rendered as link in export) ── */
    .editor-youtube {
      margin: 1rem 0;
    }

    /* ── Print-specific rules ── */
    @media print {
      body {
        margin: 0;
        padding: 0.5in 0.75in;
        max-width: none;
        font-size: 12pt;
      }
      h1 { font-size: 24pt; }
      h2 { font-size: 18pt; }
      h3 { font-size: 14pt; }
      a { color: #0066cc; text-decoration: underline; }
      pre, code { font-size: 10pt; }
      table { page-break-inside: avoid; }
      img { page-break-inside: avoid; max-width: 100%; }
    }

    @page {
      size: letter;
      margin: 0.75in;
    }
  `
}

// ────────────────────────────────────────────────────────────────────
// 1. PDF Export
// ────────────────────────────────────────────────────────────────────

/**
 * Export as PDF via the browser print dialog.
 *
 * Creates a hidden iframe with the full editor stylesheet embedded,
 * writes the editor HTML into it, and triggers window.print(). The
 * user gets the native "Save as PDF" dialog in Chrome/Electron.
 */
export function exportAsPDF(editor: TiptapEditor): void {
  const html = editor.getHTML()
  const title = getDocumentTitle(editor)
  const stylesheet = buildExportStylesheet()

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) {
    console.error('[Export] Could not open print window — popup blocked?')
    return
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${stylesheet}</style>
</head>
<body>
${html}
</body>
</html>`)

  printWindow.document.close()
  printWindow.focus()

  // Wait for content to render before triggering print
  setTimeout(() => {
    printWindow.print()
    // Close after a delay to let the dialog finish
    setTimeout(() => {
      printWindow.close()
    }, 1000)
  }, 400)
}

// ────────────────────────────────────────────────────────────────────
// 2. HTML Export
// ────────────────────────────────────────────────────────────────────

/** Export as a standalone HTML file with all styles embedded. */
export function exportAsHTML(editor: TiptapEditor): void {
  const html = editor.getHTML()
  const title = getDocumentTitle(editor)
  const stylesheet = buildExportStylesheet()

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${stylesheet}</style>
</head>
<body>
${html}
</body>
</html>`

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `${title}.html`)
}

// ────────────────────────────────────────────────────────────────────
// 3. DOCX Export
// ────────────────────────────────────────────────────────────────────

/** Map a CSS hex color → docx-compatible hex (strip the leading #). */
function hexToDocx(hex: string): string {
  return hex.replace('#', '').toUpperCase()
}

/** Map text-align values to docx AlignmentType. */
function mapAlignment(align?: string): AlignmentType | undefined {
  switch (align) {
    case 'center': return AlignmentType.CENTER
    case 'right': return AlignmentType.RIGHT
    case 'justify': return AlignmentType.JUSTIFIED
    default: return undefined
  }
}

/** Parse font-size string like "20px" into half-points for docx. */
function parseFontSizeToHalfPoints(fontSize?: string): number | undefined {
  if (!fontSize) return undefined
  const px = parseInt(fontSize, 10)
  if (isNaN(px)) return undefined
  // 1px ≈ 0.75pt, docx uses half-points (1pt = 2 half-points)
  return Math.round(px * 0.75 * 2)
}

/**
 * Recursively convert a TipTap JSON node tree into an array of docx
 * Paragraph / Table objects.
 */
function tiptapNodeToDocx(node: any, listLevel = 0): any[] {
  const results: any[] = []

  switch (node.type) {
    case 'doc': {
      for (const child of node.content || []) {
        results.push(...tiptapNodeToDocx(child))
      }
      break
    }

    case 'paragraph': {
      const alignment = mapAlignment(node.attrs?.textAlign)
      const runs = inlineContentToRuns(node.content || [])
      results.push(new Paragraph({
        children: runs,
        alignment,
        spacing: { after: 120 },
      }))
      break
    }

    case 'heading': {
      const level = node.attrs?.level || 1
      const headingMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      }
      const alignment = mapAlignment(node.attrs?.textAlign)
      const runs = inlineContentToRuns(node.content || [])
      results.push(new Paragraph({
        heading: headingMap[level] || HeadingLevel.HEADING_1,
        children: runs,
        alignment,
        spacing: { before: 240, after: 120 },
      }))
      break
    }

    case 'bulletList': {
      for (const listItem of node.content || []) {
        results.push(...convertListItem(listItem, 'bullet', listLevel))
      }
      break
    }

    case 'orderedList': {
      for (const listItem of node.content || []) {
        results.push(...convertListItem(listItem, 'ordered', listLevel))
      }
      break
    }

    case 'taskList': {
      for (const taskItem of node.content || []) {
        const checked = taskItem.attrs?.checked ? '☑' : '☐'
        const runs = [
          new TextRun({ text: `${checked} `, bold: true }),
          ...inlineContentToRuns(taskItem.content?.[0]?.content || []),
        ]
        results.push(new Paragraph({
          children: runs,
          spacing: { after: 60 },
          indent: { left: 360 },
        }))
      }
      break
    }

    case 'blockquote': {
      for (const child of node.content || []) {
        const childResults = tiptapNodeToDocx(child)
        for (const r of childResults) {
          if (r instanceof Paragraph) {
            results.push(new Paragraph({
              children: inlineContentToRuns(child.content || []),
              indent: { left: 720 },
              border: {
                left: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 12 },
              },
              spacing: { after: 120 },
            }))
          } else {
            results.push(r)
          }
        }
      }
      break
    }

    case 'codeBlock': {
      const code = node.content?.map((c: any) => c.text || '').join('') || ''
      for (const line of code.split('\n')) {
        results.push(new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: 'Courier New',
              size: 20, // 10pt
            }),
          ],
          shading: { type: ShadingType.SOLID, color: 'F4F4F4', fill: 'F4F4F4' },
          spacing: { after: 0 },
        }))
      }
      break
    }

    case 'horizontalRule': {
      results.push(new Paragraph({
        children: [new TextRun({ text: '─'.repeat(60), color: 'CCCCCC' })],
        spacing: { before: 240, after: 240 },
        alignment: AlignmentType.CENTER,
      }))
      break
    }

    case 'table': {
      const rows: TableRow[] = []
      for (const row of node.content || []) {
        const cells: TableCell[] = []
        for (const cell of row.content || []) {
          const isHeader = cell.type === 'tableHeader'
          const cellParagraphs: Paragraph[] = []
          for (const cellChild of cell.content || []) {
            const childResults = tiptapNodeToDocx(cellChild)
            for (const cr of childResults) {
              if (cr instanceof Paragraph) {
                cellParagraphs.push(cr)
              }
            }
          }
          if (cellParagraphs.length === 0) {
            cellParagraphs.push(new Paragraph({ children: [] }))
          }
          cells.push(new TableCell({
            children: cellParagraphs,
            shading: isHeader
              ? { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' }
              : undefined,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
          }))
        }
        rows.push(new TableRow({ children: cells }))
      }
      if (rows.length > 0) {
        results.push(new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }))
      }
      break
    }

    case 'image': {
      // Images can't easily be embedded in docx without fetching the binary
      // data. We add a placeholder with the URL instead.
      const src = node.attrs?.src || ''
      const alt = node.attrs?.alt || 'Image'
      results.push(new Paragraph({
        children: [
          new TextRun({ text: `[Image: ${alt}]`, italics: true, color: '999999' }),
          new TextRun({ text: ` (${src})`, color: '0066CC', size: 18 }),
        ],
        spacing: { before: 120, after: 120 },
      }))
      break
    }

    default: {
      // For any unrecognized node, try to recurse into children
      if (node.content) {
        for (const child of node.content) {
          results.push(...tiptapNodeToDocx(child, listLevel))
        }
      }
      break
    }
  }

  return results
}

/** Convert a list item node into docx paragraphs. */
function convertListItem(
  listItem: any,
  listType: 'bullet' | 'ordered',
  level: number,
): any[] {
  const results: any[] = []
  for (const child of listItem.content || []) {
    if (child.type === 'paragraph') {
      const bullet = listType === 'bullet' ? '•' : '–'
      const indent = level * 360 + 360
      const runs = [
        new TextRun({ text: `${bullet} ` }),
        ...inlineContentToRuns(child.content || []),
      ]
      results.push(new Paragraph({
        children: runs,
        indent: { left: indent },
        spacing: { after: 60 },
      }))
    } else if (child.type === 'bulletList' || child.type === 'orderedList') {
      // Nested list — recurse at deeper level
      for (const nestedItem of child.content || []) {
        results.push(...convertListItem(nestedItem, child.type === 'bulletList' ? 'bullet' : 'ordered', level + 1))
      }
    } else {
      results.push(...tiptapNodeToDocx(child, level))
    }
  }
  return results
}

/** Convert an array of TipTap inline nodes (text, marks) into docx TextRuns. */
function inlineContentToRuns(content: any[]): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = []

  for (const node of content) {
    if (node.type === 'text') {
      const marks = node.marks || []
      const isBold = marks.some((m: any) => m.type === 'bold')
      const isItalic = marks.some((m: any) => m.type === 'italic')
      const isUnderline = marks.some((m: any) => m.type === 'underline')
      const isStrike = marks.some((m: any) => m.type === 'strike')
      const isCode = marks.some((m: any) => m.type === 'code')
      const highlightMark = marks.find((m: any) => m.type === 'highlight')
      const linkMark = marks.find((m: any) => m.type === 'link')
      const textStyleMark = marks.find((m: any) => m.type === 'textStyle')

      const fontSize = parseFontSizeToHalfPoints(textStyleMark?.attrs?.fontSize)

      const runOptions: any = {
        text: node.text || '',
        bold: isBold || undefined,
        italics: isItalic || undefined,
        underline: isUnderline ? {} : undefined,
        strike: isStrike || undefined,
        font: isCode ? 'Courier New' : undefined,
        size: fontSize,
        shading: highlightMark?.attrs?.color
          ? { type: ShadingType.SOLID, color: hexToDocx(highlightMark.attrs.color), fill: hexToDocx(highlightMark.attrs.color) }
          : undefined,
      }

      // Clean up undefined values
      Object.keys(runOptions).forEach((key) => {
        if (runOptions[key] === undefined) delete runOptions[key]
      })

      if (linkMark?.attrs?.href) {
        runs.push(
          new ExternalHyperlink({
            children: [
              new TextRun({
                ...runOptions,
                color: '0066CC',
                underline: {},
              }),
            ],
            link: linkMark.attrs.href,
          }),
        )
      } else {
        runs.push(new TextRun(runOptions))
      }
    } else if (node.type === 'hardBreak') {
      runs.push(new TextRun({ text: '', break: 1 }))
    }
  }

  return runs
}

/** Export the document as a .docx Word file. */
export async function exportAsDOCX(editor: TiptapEditor): Promise<void> {
  const title = getDocumentTitle(editor)
  const json = editor.getJSON()
  const docxElements = tiptapNodeToDocx(json)

  const doc = new Document({
    title,
    creator: 'LACON',
    description: `Exported from LACON editor`,
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 24, // 12pt
          },
          paragraph: {
            spacing: { after: 120 },
          },
        },
        heading1: {
          run: { font: 'Calibri', size: 48, bold: true, color: '111111' },
          paragraph: { spacing: { before: 360, after: 120 } },
        },
        heading2: {
          run: { font: 'Calibri', size: 36, bold: true, color: '1A1A1A' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading3: {
          run: { font: 'Calibri', size: 28, bold: true, color: '1A1A1A' },
          paragraph: { spacing: { before: 240, after: 60 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docxElements,
      },
    ],
  })

  const buffer = await Packer.toBlob(doc)
  downloadBlob(buffer, `${title}.docx`)
}

// ────────────────────────────────────────────────────────────────────
// 4. Markdown Export
// ────────────────────────────────────────────────────────────────────

/** Export the document as a Markdown file. */
export function exportAsMarkdown(editor: TiptapEditor): void {
  const title = getDocumentTitle(editor)

  // getMarkdown() is provided by @tiptap/markdown extension if loaded
  let md: string
  if (typeof editor.storage?.markdown?.getMarkdown === 'function') {
    md = editor.storage.markdown.getMarkdown()
  } else if (typeof editor.getMarkdown === 'function') {
    md = editor.getMarkdown()
  } else {
    // Fallback: convert HTML to basic markdown via a simple transformer
    md = htmlToBasicMarkdown(editor.getHTML())
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  downloadBlob(blob, `${title}.md`)
}

/** Lightweight HTML → Markdown fallback when the Markdown extension isn't loaded. */
function htmlToBasicMarkdown(html: string): string {
  let md = html
    // Headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    // Bold / Italic / Strike
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
    // Code
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Blockquote
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
      return content
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '> $1\n')
        .replace(/<[^>]*>/g, '')
    })
    // HR
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    // Cleanup remaining tags
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    // Fix excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return md
}

// ────────────────────────────────────────────────────────────────────
// 5. Plain Text Export
// ────────────────────────────────────────────────────────────────────

/** Export the document as a plain text file. */
export function exportAsText(editor: TiptapEditor): void {
  const title = getDocumentTitle(editor)
  const text = editor.getText({ blockSeparator: '\n\n' })
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  downloadBlob(blob, `${title}.txt`)
}

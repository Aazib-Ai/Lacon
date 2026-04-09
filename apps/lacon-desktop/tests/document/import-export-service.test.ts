/**
 * Import/Export Service Tests - Phase 3
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { ImportExportService } from '../../src/main/services/import-export-service'
import type { LaconDocument } from '../../src/shared/document-types'

describe('ImportExportService', () => {
  let service: ImportExportService

  beforeEach(() => {
    service = new ImportExportService()
  })

  describe('JSON import/export', () => {
    it('should import valid JSON document', async () => {
      const jsonData = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello World' }],
          },
        ],
      })

      const result = await service.importDocument(jsonData, 'json', 'Test')

      expect(result.success).toBe(true)
      expect(result.document).toBeDefined()
      expect(result.document?.metadata.title).toBe('Test')
      expect(result.document?.content.type).toBe('doc')
    })

    it('should export document to JSON', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello' }],
            },
          ],
        },
      }

      const result = await service.exportDocument(doc, 'json')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const parsed = JSON.parse(result.data!)
      expect(parsed.type).toBe('doc')
      expect(parsed.content).toHaveLength(1)
    })

    it('should handle invalid JSON', async () => {
      const result = await service.importDocument('invalid json', 'json')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should roundtrip JSON without data loss', async () => {
      const originalContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Content' }],
          },
        ],
      }

      const jsonData = JSON.stringify(originalContent)
      const importResult = await service.importDocument(jsonData, 'json', 'Test')

      expect(importResult.success).toBe(true)

      const exportResult = await service.exportDocument(importResult.document!, 'json')

      expect(exportResult.success).toBe(true)

      const roundtripped = JSON.parse(exportResult.data!)
      expect(roundtripped).toEqual(originalContent)
    })
  })

  describe('HTML import/export', () => {
    it('should import HTML', async () => {
      const html = '<p>Hello World</p>'

      const result = await service.importDocument(html, 'html', 'Test')

      expect(result.success).toBe(true)
      expect(result.document).toBeDefined()
      expect(result.document?.content.type).toBe('doc')
    })

    it('should export document to HTML', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Title' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Content' }],
            },
          ],
        },
      }

      const result = await service.exportDocument(doc, 'html')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data).toContain('<h1>')
      expect(result.data).toContain('Title')
      expect(result.data).toContain('<p>')
      expect(result.data).toContain('Content')
    })

    it('should sanitize dangerous HTML', async () => {
      const html = '<script>alert("xss")</script><p>Safe content</p>'

      const result = await service.importDocument(html, 'html', 'Test')

      expect(result.success).toBe(true)
      // Script tags should be removed
      const exportResult = await service.exportDocument(result.document!, 'html')
      expect(exportResult.data).not.toContain('<script>')
    })
  })

  describe('Markdown import/export', () => {
    it('should import Markdown', async () => {
      const markdown = '# Title\n\nThis is a paragraph.'

      const result = await service.importDocument(markdown, 'markdown', 'Test')

      expect(result.success).toBe(true)
      expect(result.document).toBeDefined()
      expect(result.document?.content.content).toHaveLength(2)
    })

    it('should export document to Markdown', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Title' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Subtitle' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Content' }],
            },
          ],
        },
      }

      const result = await service.exportDocument(doc, 'markdown')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data).toContain('# Title')
      expect(result.data).toContain('## Subtitle')
      expect(result.data).toContain('Content')
    })

    it('should handle lists in Markdown', async () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3'

      const result = await service.importDocument(markdown, 'markdown', 'Test')

      expect(result.success).toBe(true)
      expect(result.document?.content.content).toHaveLength(3)
    })
  })

  describe('Error handling', () => {
    it('should handle unsupported import format', async () => {
      const result = await service.importDocument('data', 'invalid' as any, 'Test')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported')
    })

    it('should handle unsupported export format', async () => {
      const doc: LaconDocument = {
        metadata: {
          id: 'doc_123',
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDirty: false,
          isArchived: false,
          version: 1,
        },
        content: { type: 'doc', content: [] },
      }

      const result = await service.exportDocument(doc, 'invalid' as any)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported')
    })
  })
})

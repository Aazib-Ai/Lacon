/**
 * Tests for Authoring Tools (Phase 8)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRewriteTool, createShortenTool, createExpandTool, createPolishTool, createToneAdjustTool } from '../../src/main/tools/authoring-tools'
import type { AuthoringToolInput } from '../../src/shared/tool-types'

describe('Authoring Tools', () => {
  const mockExecuteTransform = vi.fn()

  beforeEach(() => {
    mockExecuteTransform.mockClear()
  })

  describe('Rewrite Tool', () => {
    it('should rewrite text with default instruction', async () => {
      mockExecuteTransform.mockResolvedValue('Rewritten text')
      const tool = createRewriteTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'Original text',
        insertionMode: 'replace',
      }

      const result = await tool.execute(input)

      expect(result.originalText).toBe('Original text')
      expect(result.transformedText).toBe('Rewritten text')
      expect(result.insertionMode).toBe('replace')
      expect(result.metadata.transformationType).toBe('rewrite')
      expect(mockExecuteTransform).toHaveBeenCalledWith(
        'Original text',
        'Rewrite this text to improve clarity and readability'
      )
    })

    it('should rewrite text with custom instruction', async () => {
      mockExecuteTransform.mockResolvedValue('Custom rewritten text')
      const tool = createRewriteTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'Original text',
        instruction: 'Make it more concise',
        insertionMode: 'preview',
      }

      const result = await tool.execute(input)

      expect(result.transformedText).toBe('Custom rewritten text')
      expect(mockExecuteTransform).toHaveBeenCalledWith('Original text', 'Make it more concise')
    })
  })

  describe('Shorten Tool', () => {
    it('should shorten text to target length', async () => {
      mockExecuteTransform.mockResolvedValue('Short text')
      const tool = createShortenTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'This is a longer text that needs to be shortened',
        targetLength: 20,
        insertionMode: 'replace',
      }

      const result = await tool.execute(input)

      expect(result.transformedText).toBe('Short text')
      expect(result.metadata.transformationType).toBe('shorten')
      expect(mockExecuteTransform).toHaveBeenCalledWith(
        input.text,
        expect.stringContaining('20 characters')
      )
    })

    it('should use default target length (70% of original)', async () => {
      mockExecuteTransform.mockResolvedValue('Shortened')
      const tool = createShortenTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'A'.repeat(100),
        insertionMode: 'replace',
      }

      await tool.execute(input)

      expect(mockExecuteTransform).toHaveBeenCalledWith(
        input.text,
        expect.stringContaining('70 characters')
      )
    })
  })

  describe('Expand Tool', () => {
    it('should expand text with more detail', async () => {
      mockExecuteTransform.mockResolvedValue('Expanded text with more detail and examples')
      const tool = createExpandTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'Short text',
        insertionMode: 'insert-below',
      }

      const result = await tool.execute(input)

      expect(result.transformedText).toBe('Expanded text with more detail and examples')
      expect(result.metadata.transformationType).toBe('expand')
      expect(result.insertionMode).toBe('insert-below')
    })
  })

  describe('Polish Tool', () => {
    it('should polish text with default professional tone', async () => {
      mockExecuteTransform.mockResolvedValue('Polished professional text')
      const tool = createPolishTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'Rough text',
        insertionMode: 'preview',
      }

      const result = await tool.execute(input)

      expect(result.transformedText).toBe('Polished professional text')
      expect(mockExecuteTransform).toHaveBeenCalledWith(
        'Rough text',
        expect.stringContaining('professional tone')
      )
    })

    it('should polish text with custom tone', async () => {
      mockExecuteTransform.mockResolvedValue('Polished casual text')
      const tool = createPolishTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'Rough text',
        tone: 'casual',
        insertionMode: 'replace',
      }

      const result = await tool.execute(input)

      expect(mockExecuteTransform).toHaveBeenCalledWith(
        'Rough text',
        expect.stringContaining('casual tone')
      )
    })
  })

  describe('Tone Adjust Tool', () => {
    it('should adjust tone to specified style', async () => {
      mockExecuteTransform.mockResolvedValue('Friendly toned text')
      const tool = createToneAdjustTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'Original text',
        tone: 'friendly',
        insertionMode: 'replace',
      }

      const result = await tool.execute(input)

      expect(result.transformedText).toBe('Friendly toned text')
      expect(result.metadata.transformationType).toBe('tone-adjust')
      expect(mockExecuteTransform).toHaveBeenCalledWith(
        'Original text',
        expect.stringContaining('friendly')
      )
    })
  })

  describe('Tool Metadata', () => {
    it('should track original and transformed lengths', async () => {
      mockExecuteTransform.mockResolvedValue('Transformed')
      const tool = createRewriteTool(mockExecuteTransform)

      const input: AuthoringToolInput = {
        text: 'Original',
        insertionMode: 'replace',
      }

      const _result = await tool.execute(input)

      expect(_result.metadata.originalLength).toBe(8)
      expect(_result.metadata.transformedLength).toBe(11)
    })
  })

  describe('Tool Contracts', () => {
    it('should have correct tool properties', () => {
      const tool = createRewriteTool(mockExecuteTransform)

      expect(tool.name).toBe('rewrite-text')
      expect(tool.description).toContain('Rewrite')
      expect(tool.riskLevel).toBe('low')
      expect(tool.timeout).toBe(30000)
      expect(tool.inputSchema.required).toContain('text')
      expect(tool.inputSchema.required).toContain('insertionMode')
    })
  })
})

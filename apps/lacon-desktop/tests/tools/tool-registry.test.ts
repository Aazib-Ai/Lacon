/**
 * Tests for Tool Registry (Phase 8)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/main/tools/tool-registry'

describe('Tool Registry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry('/test/workspace')
  })

  describe('Tool Registration', () => {
    it('should register all Phase 8 tools', () => {
      const tools = registry.listTools()

      expect(tools.length).toBeGreaterThan(0)
      
      // Check authoring tools
      expect(tools.some(t => t.name === 'rewrite-text')).toBe(true)
      expect(tools.some(t => t.name === 'shorten-text')).toBe(true)
      expect(tools.some(t => t.name === 'expand-text')).toBe(true)
      expect(tools.some(t => t.name === 'polish-text')).toBe(true)
      expect(tools.some(t => t.name === 'tone-adjust')).toBe(true)

      // Check retrieval tools
      expect(tools.some(t => t.name === 'workspace-qa')).toBe(true)
      expect(tools.some(t => t.name === 'web-research')).toBe(true)

      // Check creator tools
      expect(tools.some(t => t.name === 'youtube-transcript')).toBe(true)
      expect(tools.some(t => t.name === 'tone-analyzer')).toBe(true)
      expect(tools.some(t => t.name === 'broll-generator')).toBe(true)
    })

    it('should get tool by name', () => {
      const tool = registry.getTool('rewrite-text')

      expect(tool).toBeDefined()
      expect(tool?.name).toBe('rewrite-text')
      expect(tool?.riskLevel).toBe('low')
    })

    it('should return undefined for non-existent tool', () => {
      const tool = registry.getTool('non-existent-tool')

      expect(tool).toBeUndefined()
    })
  })

  describe('Tool Categories', () => {
    it('should filter tools by authoring category', () => {
      const authoringTools = registry.getToolsByCategory('authoring')

      expect(authoringTools.length).toBeGreaterThan(0)
      expect(authoringTools.every(t => t.category === 'authoring')).toBe(true)
    })

    it('should filter tools by retrieval category', () => {
      const retrievalTools = registry.getToolsByCategory('retrieval')

      expect(retrievalTools.length).toBeGreaterThan(0)
      expect(retrievalTools.every(t => t.category === 'retrieval')).toBe(true)
    })

    it('should filter tools by creator category', () => {
      const creatorTools = registry.getToolsByCategory('creator')

      expect(creatorTools.length).toBeGreaterThan(0)
      expect(creatorTools.every(t => t.category === 'creator')).toBe(true)
    })
  })

  describe('Tool Metadata', () => {
    it('should include all required metadata', () => {
      const tools = registry.listTools()
      const tool = tools[0]

      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('category')
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('riskLevel')
      expect(tool).toHaveProperty('requiresApproval')
      expect(tool).toHaveProperty('inputSchema')
      expect(tool).toHaveProperty('outputSchema')
    })

    it('should mark high-risk tools as requiring approval', () => {
      const tools = registry.listTools()
      const highRiskTools = tools.filter(t => t.riskLevel === 'high')

      highRiskTools.forEach(tool => {
        expect(tool.requiresApproval).toBe(true)
      })
    })

    it('should not require approval for low-risk tools', () => {
      const tools = registry.listTools()
      const lowRiskTools = tools.filter(t => t.riskLevel === 'low')

      lowRiskTools.forEach(tool => {
        expect(tool.requiresApproval).toBe(false)
      })
    })
  })

  describe('Tool Schemas', () => {
    it('should have valid input schemas', () => {
      const tool = registry.getTool('rewrite-text')

      expect(tool?.inputSchema).toBeDefined()
      expect(tool?.inputSchema).toHaveProperty('type', 'object')
      expect(tool?.inputSchema).toHaveProperty('properties')
      expect(tool?.inputSchema).toHaveProperty('required')
    })

    it('should have valid output schemas', () => {
      const tool = registry.getTool('rewrite-text')

      expect(tool?.outputSchema).toBeDefined()
      expect(tool?.outputSchema).toHaveProperty('type', 'object')
      expect(tool?.outputSchema).toHaveProperty('properties')
    })

    it('should have valid error schemas', () => {
      const tool = registry.getTool('rewrite-text')

      expect(tool?.errorSchema).toBeDefined()
      expect(tool?.errorSchema).toHaveProperty('type', 'object')
      expect(tool?.errorSchema).toHaveProperty('properties')
    })
  })

  describe('Tool Execution', () => {
    it('should throw error for non-existent tool', async () => {
      await expect(
        registry.executeTool('non-existent-tool', {})
      ).rejects.toThrow('Tool not found')
    })
  })
})

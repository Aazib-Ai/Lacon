/**
 * Tool framework unit tests (Phase 10 - P10-T1.2)
 * Tests tool registry, execution, validation, and error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToolRegistry } from '../../src/main/tools/tool-registry'

// Mock provider manager to avoid real calls
vi.mock('../../src/main/providers/provider-manager', () => ({
  getProviderManager: () => ({
    listProviders: () => [
      {
        id: 'mock-provider',
        defaultModel: 'mock-model',
      },
    ],
    chatCompletion: vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'mock response' } }],
    }),
  }),
}))

describe('ToolRegistry - Framework Tests (P10-T1.2)', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry('/mock/workspace')
  })

  describe('Tool Registration and Discovery', () => {
    it('should register all tools on construction', () => {
      const tools = registry.listTools()
      expect(tools.length).toBeGreaterThan(0)
    })

    it('should have authoring tools registered', () => {
      const authoringTools = registry.getToolsByCategory('authoring')
      expect(authoringTools.length).toBeGreaterThan(0)
    })

    it('should have retrieval tools registered', () => {
      const retrievalTools = registry.getToolsByCategory('retrieval')
      expect(retrievalTools.length).toBeGreaterThan(0)
    })

    it('should have creator tools registered', () => {
      const creatorTools = registry.getToolsByCategory('creator')
      expect(creatorTools.length).toBeGreaterThan(0)
    })

    it('should return tool by name', () => {
      const tools = registry.listTools()
      const firstName = tools[0]?.name
      if (firstName) {
        const found = registry.getTool(firstName)
        expect(found).toBeDefined()
        expect(found?.name).toBe(firstName)
      }
    })

    it('should return undefined for unknown tool name', () => {
      const result = registry.getTool('nonexistent-tool-xyz')
      expect(result).toBeUndefined()
    })
  })

  describe('Tool Contract Structure', () => {
    it('each tool should have required properties', () => {
      const tools = registry.listTools()
      for (const tool of tools) {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('riskLevel')
        expect(tool).toHaveProperty('requiresApproval')
        expect(tool).toHaveProperty('inputSchema')
        expect(tool).toHaveProperty('outputSchema')
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
        expect(['low', 'medium', 'high']).toContain(tool.riskLevel)
        expect(typeof tool.requiresApproval).toBe('boolean')
      }
    })

    it('high-risk tools should require approval', () => {
      const tools = registry.listTools()
      for (const tool of tools) {
        if (tool.riskLevel === 'high') {
          expect(tool.requiresApproval).toBe(true)
        }
      }
    })

    it('tool names should be unique', () => {
      const tools = registry.listTools()
      const names = tools.map(t => t.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })
  })

  describe('Tool Execution - Error Handling', () => {
    it('should throw error when executing unknown tool', async () => {
      await expect(registry.executeTool('nonexistent-tool', {})).rejects.toThrow('Tool not found: nonexistent-tool')
    })
  })

  describe('Tool Category Filtering', () => {
    it('should return empty array for unknown category', () => {
      const tools = registry.getToolsByCategory('unknown-category')
      expect(tools).toEqual([])
    })

    it('sum of all categories should cover all tools', () => {
      const categories = ['authoring', 'retrieval', 'creator', 'general']
      const totalFromCategories = categories.reduce((sum, cat) => sum + registry.getToolsByCategory(cat).length, 0)
      const totalTools = registry.listTools().length
      expect(totalFromCategories).toBe(totalTools)
    })
  })
})

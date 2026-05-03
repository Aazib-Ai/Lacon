/**
 * Tool Registry and Manager
 * Phase 8: Central registry for all agent tools
 */

import type { ToolContract } from '../../shared/agent-types'
import type { ToolRegistryEntry } from '../../shared/tool-types'
import { getProviderManager } from '../providers/provider-manager'
import { getContentExtractorService } from '../services/content-extractor'
import { getWebSearchService } from '../services/web-search-service'
import {
  createExpandTool,
  createPolishTool,
  createRewriteTool,
  createShortenTool,
  createToneAdjustTool,
} from './authoring-tools'
import { createBRollGeneratorTool, createToneAnalyzerTool, createYouTubeTranscriptTool } from './creator-tools'
import { createWebResearchTool, createWorkspaceQATool } from './retrieval-tools'

export class ToolRegistry {
  private tools = new Map<string, ToolContract>()
  private workspaceRoot: string

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
    this.registerAllTools()
  }

  /**
   * Register all Phase 8 tools
   */
  private registerAllTools(): void {
    // Authoring tools (P8-E1)
    this.registerTool(createRewriteTool(this.executeTransform.bind(this)))
    this.registerTool(createShortenTool(this.executeTransform.bind(this)))
    this.registerTool(createExpandTool(this.executeTransform.bind(this)))
    this.registerTool(createPolishTool(this.executeTransform.bind(this)))
    this.registerTool(createToneAdjustTool(this.executeTransform.bind(this)))

    // Retrieval tools (P8-E2)
    this.registerTool(createWorkspaceQATool(this.workspaceRoot, this.executeQuery.bind(this)))
    this.registerTool(createWebResearchTool(this.executeWebSearch.bind(this), this.executeSummary.bind(this)))

    // Creator tools (P8-E3)
    this.registerTool(createYouTubeTranscriptTool(this.fetchYouTubeTranscript.bind(this)))
    this.registerTool(createToneAnalyzerTool(this.analyzeContent.bind(this)))
    this.registerTool(createBRollGeneratorTool(this.generateVisualCues.bind(this)))
  }

  /**
   * Register a tool
   */
  private registerTool(tool: ToolContract<any, any>): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolContract | undefined {
    return this.tools.get(name)
  }

  /**
   * List all registered tools
   */
  listTools(): ToolRegistryEntry[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      category: this.getToolCategory(tool.name) as any,
      description: tool.description,
      riskLevel: tool.riskLevel,
      requiresApproval: tool.riskLevel === 'high',
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    }))
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): ToolRegistryEntry[] {
    return this.listTools().filter(t => t.category === category)
  }

  /**
   * Execute a tool by name
   */
  async executeTool<TInput, TOutput>(name: string, input: TInput): Promise<TOutput> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }

    return tool.execute(input) as Promise<TOutput>
  }

  /**
   * Helper: Get tool category from name
   */
  private getToolCategory(name: string): string {
    if (
      name.includes('text') ||
      name.includes('rewrite') ||
      name.includes('shorten') ||
      name.includes('expand') ||
      name.includes('polish') ||
      name.includes('tone')
    ) {
      return 'authoring'
    }
    if (name.includes('workspace') || name.includes('web') || name.includes('research')) {
      return 'retrieval'
    }
    if (name.includes('youtube') || name.includes('analyzer') || name.includes('broll')) {
      return 'creator'
    }
    return 'general'
  }

  /**
   * Helper: Execute text transformation using provider
   */
  private async executeTransform(text: string, instruction: string): Promise<string> {
    const providerManager = getProviderManager()
    const providers = providerManager.listProviders()

    if (providers.length === 0) {
      throw new Error('No providers configured')
    }

    // Use first available provider
    const provider = providers[0]

    const response = await providerManager.chatCompletion(
      provider.id,
      {
        model: provider.defaultModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful writing assistant. Transform the text according to the instruction.',
          },
          {
            role: 'user',
            content: `${instruction}\n\nText:\n${text}`,
          },
        ],
        temperature: 0.7,
        maxTokens: 2000,
      },
      'authoring-tool',
    )

    return response.choices[0]?.message.content || ''
  }

  /**
   * Helper: Execute query with context
   */
  private async executeQuery(query: string, context: string): Promise<string> {
    const providerManager = getProviderManager()
    const providers = providerManager.listProviders()

    if (providers.length === 0) {
      throw new Error('No providers configured')
    }

    const provider = providers[0]

    const response = await providerManager.chatCompletion(
      provider.id,
      {
        model: provider.defaultModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions based on provided context.',
          },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQuestion: ${query}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 1000,
      },
      'workspace-qa',
    )

    return response.choices[0]?.message.content || ''
  }

  /**
   * Helper: Execute web search via WebSearchService
   */
  private async executeWebSearch(query: string): Promise<any[]> {
    const results = await getWebSearchService().searchAll(query)
    return results.map((r, i) => ({
      id: String(i + 1),
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      relevanceScore: r.relevanceScore,
    }))
  }

  /**
   * Helper: Execute summary generation
   */
  private async executeSummary(query: string, sources: any[]): Promise<string> {
    const providerManager = getProviderManager()
    const providers = providerManager.listProviders()

    if (providers.length === 0) {
      throw new Error('No providers configured')
    }

    const provider = providers[0]

    const sourcesText = await Promise.all(
      sources.slice(0, 3).map(async (s: any) => {
        // Try extracting full article text for richer summaries
        let content = s.snippet || ''
        try {
          if (s.url) {
            const article = await getContentExtractorService().extractArticle(s.url)
            if (article) {
              content = article.textContent.slice(0, 2000)
            }
          }
        } catch {
          /* use snippet */
        }
        return `${s.title}\n${content}\nURL: ${s.url}`
      }),
    )
    const sourcesBlock = sourcesText.join('\n\n')

    const response = await providerManager.chatCompletion(
      provider.id,
      {
        model: provider.defaultModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant. Summarize the sources to answer the query with citations.',
          },
          {
            role: 'user',
            content: `Query: ${query}\n\nSources:\n${sourcesBlock}`,
          },
        ],
        temperature: 0.5,
        maxTokens: 1500,
      },
      'web-research',
    )

    return response.choices[0]?.message.content || ''
  }

  /**
   * Helper: Fetch YouTube transcript (mock implementation)
   */
  private async fetchYouTubeTranscript(_videoId: string): Promise<any> {
    // Mock implementation - in production, integrate with YouTube API or transcript service
    return {
      title: 'Example Video Title',
      segments: [
        { text: 'Welcome to this video.', startTime: 0, endTime: 3 },
        { text: 'Today we will discuss important topics.', startTime: 3, endTime: 7 },
        { text: "Let's get started.", startTime: 7, endTime: 10 },
      ],
    }
  }

  /**
   * Helper: Analyze content
   */
  private async analyzeContent(text: string, analysisType: string): Promise<string> {
    const providerManager = getProviderManager()
    const providers = providerManager.listProviders()

    if (providers.length === 0) {
      throw new Error('No providers configured')
    }

    const provider = providers[0]

    const response = await providerManager.chatCompletion(
      provider.id,
      {
        model: provider.defaultModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a content analysis expert.',
          },
          {
            role: 'user',
            content: `${analysisType}\n\nText:\n${text}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 1000,
      },
      'content-analysis',
    )

    return response.choices[0]?.message.content || ''
  }

  /**
   * Helper: Generate visual cues
   */
  private async generateVisualCues(scriptText: string): Promise<string> {
    const providerManager = getProviderManager()
    const providers = providerManager.listProviders()

    if (providers.length === 0) {
      throw new Error('No providers configured')
    }

    const provider = providers[0]

    const response = await providerManager.chatCompletion(
      provider.id,
      {
        model: provider.defaultModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a video production assistant. Generate B-roll and visual cue suggestions for scripts.',
          },
          {
            role: 'user',
            content: `Generate B-roll and on-screen text suggestions for this script:\n\n${scriptText}`,
          },
        ],
        temperature: 0.7,
        maxTokens: 1500,
      },
      'visual-cues',
    )

    return response.choices[0]?.message.content || ''
  }
}

// Singleton instance
let toolRegistryInstance: ToolRegistry | null = null

export function getToolRegistry(workspaceRoot?: string): ToolRegistry {
  if (!toolRegistryInstance && workspaceRoot) {
    toolRegistryInstance = new ToolRegistry(workspaceRoot)
  }
  if (!toolRegistryInstance) {
    throw new Error('ToolRegistry not initialized. Call with workspaceRoot first.')
  }
  return toolRegistryInstance
}

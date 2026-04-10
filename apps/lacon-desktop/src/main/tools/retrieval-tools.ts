/**
 * Retrieval and Research Tools
 * Phase 8: Epic P8-E2
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import type { ToolContract } from '../../shared/agent-types'
import type { Citation, WebResearchInput, WebResearchOutput, WebSource, WorkspaceQAInput, WorkspaceQAOutput } from '../../shared/tool-types'

/**
 * P8-T4: Workspace QA Tool
 */
export function createWorkspaceQATool(
  workspaceRoot: string,
  executeQuery: (query: string, context: string) => Promise<string>,
): ToolContract<WorkspaceQAInput, WorkspaceQAOutput> {
  return {
    name: 'workspace-qa',
    description: 'Query and answer questions about workspace documents with citations',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number' },
        filePatterns: { type: 'array', items: { type: 'string' } },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        answer: { type: 'string' },
        citations: { type: 'array' },
        metadata: { type: 'object' },
      },
    },
    errorSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    async execute(input: WorkspaceQAInput): Promise<WorkspaceQAOutput> {
      const startTime = Date.now()
      const maxResults = input.maxResults || 5
      const filePatterns = input.filePatterns || ['**/*.md', '**/*.txt', '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']

      // P8-T4.1: Index local workspace docs
      const files = await indexWorkspaceFiles(workspaceRoot, filePatterns)
      
      // P8-T4.2: Search for relevant content
      const citations = await searchFiles(files, input.query, maxResults)
      
      // Build context from citations
      const context = citations
        .map(c => `File: ${c.filePath}\nLines ${c.lineStart}-${c.lineEnd}:\n${c.content}`)
        .join('\n\n')
      
      // Query with context
      const answer = await executeQuery(input.query, context)

      return {
        query: input.query,
        answer,
        citations,
        metadata: {
          filesSearched: files.length,
          matchesFound: citations.length,
          processingTimeMs: Date.now() - startTime,
        },
      }
    },
    timeout: 60000,
  }
}

/**
 * P8-T5: Web Research Tool
 */
export function createWebResearchTool(
  executeSearch: (query: string) => Promise<WebSource[]>,
  executeSummary: (query: string, sources: WebSource[]) => Promise<string>,
): ToolContract<WebResearchInput, WebResearchOutput> {
  return {
    name: 'web-research',
    description: 'Research web sources and provide summary with citations',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxSources: { type: 'number' },
        includeSnippets: { type: 'boolean' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        summary: { type: 'string' },
        sources: { type: 'array' },
        metadata: { type: 'object' },
      },
    },
    errorSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    async execute(input: WebResearchInput): Promise<WebResearchOutput> {
      const startTime = Date.now()
      const maxSources = input.maxSources || 5

      // P8-T5.1: Query planner for web lookups
      // P8-T5.2: Source collection and ranking
      const sources = await executeSearch(input.query)
      const topSources = sources.slice(0, maxSources)

      // P8-T5.3: Generate summary with citations
      const summary = await executeSummary(input.query, topSources)

      return {
        query: input.query,
        summary,
        sources: topSources,
        metadata: {
          sourcesCollected: topSources.length,
          processingTimeMs: Date.now() - startTime,
        },
      }
    },
    timeout: 60000,
  }
}

// Helper: Index workspace files
async function indexWorkspaceFiles(workspaceRoot: string, patterns: string[]): Promise<string[]> {
  const files: string[] = []
  
  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        // Skip node_modules, .git, dist, build
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '.turbo'].includes(entry.name)) {
            await walk(fullPath)
          }
        } else if (entry.isFile()) {
          // Check if file matches patterns
          const ext = path.extname(entry.name)
          if (matchesPatterns(entry.name, ext, patterns)) {
            files.push(fullPath)
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }
  
  await walk(workspaceRoot)
  return files
}

// Helper: Match file against patterns
function matchesPatterns(filename: string, ext: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
      if (regex.test(filename)) {
        return true
      }
    } else if (filename.endsWith(pattern) || ext === pattern) {
      return true
    }
  }
  return false
}

// Helper: Search files for relevant content
async function searchFiles(files: string[], query: string, maxResults: number): Promise<Citation[]> {
  const citations: Citation[] = []
  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)
  
  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      
      // Search for lines containing query terms
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineLower = line.toLowerCase()
        
        // Calculate relevance score
        let score = 0
        for (const term of queryTerms) {
          if (lineLower.includes(term)) {
            score += 1
          }
        }
        
        if (score > 0) {
          // Extract context (3 lines before and after)
          const start = Math.max(0, i - 3)
          const end = Math.min(lines.length - 1, i + 3)
          const contextLines = lines.slice(start, end + 1)
          
          citations.push({
            id: `${filePath}:${i}`,
            filePath,
            lineStart: start + 1,
            lineEnd: end + 1,
            content: contextLines.join('\n'),
            relevanceScore: score / queryTerms.length,
          })
        }
      }
    } catch {
      // Skip files we can't read
    }
  }
  
  // Sort by relevance and return top results
  citations.sort((a, b) => b.relevanceScore - a.relevanceScore)
  return citations.slice(0, maxResults)
}

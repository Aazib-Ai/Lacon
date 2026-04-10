/**
 * Agent Tool Types for Phase 8
 * Competitive Agent Tooling
 */

// Tool Categories
export type ToolCategory =
  | 'authoring' // In-editor text transformations
  | 'retrieval' // Workspace and web research
  | 'creator' // Creator-specialized tools

// Authoring Tool Types
export type AuthoringToolType =
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'polish'
  | 'tone-adjust'
  | 'apply-heading'
  | 'apply-list'
  | 'apply-emphasis'

// Insertion Modes
export type InsertionMode = 'replace' | 'insert-below' | 'preview'

// Authoring Tool Input
export interface AuthoringToolInput {
  text: string
  instruction?: string
  tone?: 'professional' | 'casual' | 'friendly' | 'formal' | 'creative'
  targetLength?: number
  insertionMode: InsertionMode
}

// Authoring Tool Output
export interface AuthoringToolOutput {
  originalText: string
  transformedText: string
  insertionMode: InsertionMode
  metadata: {
    originalLength: number
    transformedLength: number
    transformationType: AuthoringToolType
  }
}

// Workspace QA Tool Input
export interface WorkspaceQAInput {
  query: string
  maxResults?: number
  filePatterns?: string[]
}

// Workspace QA Citation
export interface Citation {
  id: string
  filePath: string
  lineStart: number
  lineEnd: number
  content: string
  relevanceScore: number
}

// Workspace QA Tool Output
export interface WorkspaceQAOutput {
  query: string
  answer: string
  citations: Citation[]
  metadata: {
    filesSearched: number
    matchesFound: number
    processingTimeMs: number
  }
}

// Web Research Tool Input
export interface WebResearchInput {
  query: string
  maxSources?: number
  includeSnippets?: boolean
}

// Web Source
export interface WebSource {
  id: string
  url: string
  title: string
  snippet: string
  relevanceScore: number
  publishedDate?: string
}

// Web Research Tool Output
export interface WebResearchOutput {
  query: string
  summary: string
  sources: WebSource[]
  metadata: {
    sourcesCollected: number
    processingTimeMs: number
  }
}

// YouTube Transcript Tool Input
export interface YouTubeTranscriptInput {
  url: string
  includeTimestamps?: boolean
}

// Transcript Segment
export interface TranscriptSegment {
  text: string
  startTime: number
  endTime: number
}

// YouTube Transcript Tool Output
export interface YouTubeTranscriptOutput {
  videoId: string
  url: string
  title?: string
  transcript: string
  segments?: TranscriptSegment[]
  metadata: {
    duration: number
    segmentCount: number
  }
}

// Tone Analyzer Tool Input
export interface ToneAnalyzerInput {
  text: string
  analyzeHook?: boolean
  analyzeTone?: boolean
}

// Tone Analysis Result
export interface ToneAnalysis {
  overallTone: string
  toneConsistency: number // 0-100
  detectedTones: Array<{
    tone: string
    confidence: number
    examples: string[]
  }>
}

// Hook Analysis Result
export interface HookAnalysis {
  hookStrength: number // 0-100
  hookType: string
  strengths: string[]
  improvements: string[]
}

// Tone Analyzer Tool Output
export interface ToneAnalyzerOutput {
  text: string
  toneAnalysis?: ToneAnalysis
  hookAnalysis?: HookAnalysis
  suggestions: Array<{
    type: 'tone' | 'hook' | 'consistency'
    description: string
    example?: string
  }>
}

// B-roll Generator Tool Input
export interface BRollGeneratorInput {
  scriptText: string
  includeOnScreenText?: boolean
  includeTimestamps?: boolean
}

// Visual Cue
export interface VisualCue {
  timestamp?: number
  sceneDescription: string
  visualType: 'b-roll' | 'on-screen-text' | 'overlay' | 'transition'
  content: string
  duration?: number
  notes?: string
}

// B-roll Generator Tool Output
export interface BRollGeneratorOutput {
  scriptText: string
  visualCues: VisualCue[]
  metadata: {
    totalScenes: number
    bRollCount: number
    onScreenTextCount: number
    estimatedDuration: number
  }
}

// Tool Registry Entry
export interface ToolRegistryEntry {
  name: string
  category: ToolCategory
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  requiresApproval: boolean
  inputSchema: unknown
  outputSchema: unknown
}

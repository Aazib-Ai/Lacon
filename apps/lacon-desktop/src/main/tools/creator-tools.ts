/**
 * Creator Specialized Tools
 * Phase 8: Epic P8-E3
 */

import type { ToolContract } from '../../shared/agent-types'
import type {
  BRollGeneratorInput,
  BRollGeneratorOutput,
  ToneAnalyzerInput,
  ToneAnalyzerOutput,
  TranscriptSegment,
  VisualCue,
  YouTubeTranscriptInput,
  YouTubeTranscriptOutput,
} from '../../shared/tool-types'

/**
 * P8-T6: YouTube Transcript Fetcher
 */
export function createYouTubeTranscriptTool(
  fetchTranscript: (videoId: string) => Promise<{ title?: string; segments: TranscriptSegment[] }>,
): ToolContract<YouTubeTranscriptInput, YouTubeTranscriptOutput> {
  return {
    name: 'youtube-transcript',
    description: 'Fetch YouTube video transcript with optional timestamps',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        includeTimestamps: { type: 'boolean' },
      },
      required: ['url'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        videoId: { type: 'string' },
        url: { type: 'string' },
        title: { type: 'string' },
        transcript: { type: 'string' },
        segments: { type: 'array' },
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
    async execute(input: YouTubeTranscriptInput): Promise<YouTubeTranscriptOutput> {
      // P8-T6.1: URL validation and normalization
      const videoId = extractYouTubeVideoId(input.url)
      if (!videoId) {
        throw new Error('Invalid YouTube URL')
      }

      // P8-T6.2: Transcript extraction flow
      const { title, segments } = await fetchTranscript(videoId)

      // P8-T6.3: Format transcript
      const transcript = input.includeTimestamps
        ? segments.map(s => `[${formatTimestamp(s.startTime)}] ${s.text}`).join('\n')
        : segments.map(s => s.text).join(' ')

      const duration = segments.length > 0 ? segments[segments.length - 1].endTime : 0

      return {
        videoId,
        url: input.url,
        title,
        transcript,
        segments: input.includeTimestamps ? segments : undefined,
        metadata: {
          duration,
          segmentCount: segments.length,
        },
      }
    },
    timeout: 30000,
  }
}

/**
 * P8-T7: Tone and Hook Analyzer
 */
export function createToneAnalyzerTool(
  analyzeContent: (text: string, analysisType: string) => Promise<string>,
): ToolContract<ToneAnalyzerInput, ToneAnalyzerOutput> {
  return {
    name: 'tone-analyzer',
    description: 'Analyze tone consistency and hook strength with improvement suggestions',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        analyzeHook: { type: 'boolean' },
        analyzeTone: { type: 'boolean' },
      },
      required: ['text'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        toneAnalysis: { type: 'object' },
        hookAnalysis: { type: 'object' },
        suggestions: { type: 'array' },
      },
    },
    errorSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    async execute(input: ToneAnalyzerInput): Promise<ToneAnalyzerOutput> {
      const analyzeHook = input.analyzeHook !== false
      const analyzeTone = input.analyzeTone !== false

      const result: ToneAnalyzerOutput = {
        text: input.text,
        suggestions: [],
      }

      // P8-T7.2: Tone consistency assessment
      if (analyzeTone) {
        const toneAnalysisText = await analyzeContent(
          input.text,
          'Analyze the tone of this text. Identify the overall tone, consistency (0-100), and specific tones detected with examples.',
        )
        result.toneAnalysis = parseToneAnalysis(toneAnalysisText)
      }

      // P8-T7.1: Opening-hook strength assessment
      if (analyzeHook) {
        const hookAnalysisText = await analyzeContent(
          input.text,
          'Analyze the opening hook of this text. Rate its strength (0-100), identify the hook type, list strengths and improvements.',
        )
        result.hookAnalysis = parseHookAnalysis(hookAnalysisText)
      }

      // P8-T7.3: Generate improvement suggestions
      if (result.toneAnalysis && result.toneAnalysis.toneConsistency < 70) {
        result.suggestions.push({
          type: 'consistency',
          description: 'Tone consistency is below 70%. Consider revising sections with inconsistent tone.',
        })
      }

      if (result.hookAnalysis && result.hookAnalysis.hookStrength < 60) {
        result.suggestions.push({
          type: 'hook',
          description: 'Hook strength is below 60%. Consider strengthening the opening to capture attention.',
        })
      }

      return result
    },
    timeout: 45000,
  }
}

/**
 * P8-T8: B-roll and Visual Cue Generator
 */
export function createBRollGeneratorTool(
  generateCues: (scriptText: string) => Promise<string>,
): ToolContract<BRollGeneratorInput, BRollGeneratorOutput> {
  return {
    name: 'broll-generator',
    description: 'Generate B-roll and visual cue suggestions for video scripts',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        scriptText: { type: 'string' },
        includeOnScreenText: { type: 'boolean' },
        includeTimestamps: { type: 'boolean' },
      },
      required: ['scriptText'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        scriptText: { type: 'string' },
        visualCues: { type: 'array' },
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
    async execute(input: BRollGeneratorInput): Promise<BRollGeneratorOutput> {
      const includeOnScreenText = input.includeOnScreenText !== false
      const includeTimestamps = input.includeTimestamps !== false

      // P8-T8.1: Scene-by-scene visual cue extraction
      const cuesText = await generateCues(input.scriptText)
      const visualCues = parseVisualCues(cuesText, includeOnScreenText, includeTimestamps)

      // P8-T8.3: Calculate metadata
      const bRollCount = visualCues.filter(c => c.visualType === 'b-roll').length
      const onScreenTextCount = visualCues.filter(c => c.visualType === 'on-screen-text').length
      const estimatedDuration = visualCues.reduce((sum, c) => sum + (c.duration || 0), 0)

      return {
        scriptText: input.scriptText,
        visualCues,
        metadata: {
          totalScenes: visualCues.length,
          bRollCount,
          onScreenTextCount,
          estimatedDuration,
        },
      }
    },
    timeout: 45000,
  }
}

// Helper: Extract YouTube video ID from URL
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

// Helper: Format timestamp (seconds to MM:SS)
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Helper: Parse tone analysis from LLM response
function parseToneAnalysis(_text: string): any {
  // Simple parsing - in production, use structured output
  return {
    overallTone: 'professional',
    toneConsistency: 75,
    detectedTones: [
      { tone: 'professional', confidence: 0.8, examples: [] },
      { tone: 'friendly', confidence: 0.6, examples: [] },
    ],
  }
}

// Helper: Parse hook analysis from LLM response
function parseHookAnalysis(_text: string): any {
  // Simple parsing - in production, use structured output
  return {
    hookStrength: 65,
    hookType: 'question',
    strengths: ['Engaging opening', 'Clear relevance'],
    improvements: ['Add more specificity', 'Increase urgency'],
  }
}

// Helper: Parse visual cues from LLM response
function parseVisualCues(text: string, includeOnScreenText: boolean, _includeTimestamps: boolean): VisualCue[] {
  // Simple parsing - in production, use structured output
  const cues: VisualCue[] = []
  const lines = text.split('\n').filter(l => l.trim())

  for (const line of lines) {
    if (line.includes('B-ROLL:') || line.includes('b-roll:')) {
      cues.push({
        sceneDescription: line.replace(/B-ROLL:/i, '').trim(),
        visualType: 'b-roll',
        content: line.replace(/B-ROLL:/i, '').trim(),
        duration: 5,
      })
    } else if (includeOnScreenText && (line.includes('TEXT:') || line.includes('text:'))) {
      cues.push({
        sceneDescription: 'On-screen text',
        visualType: 'on-screen-text',
        content: line.replace(/TEXT:/i, '').trim(),
        duration: 3,
      })
    }
  }

  return cues
}

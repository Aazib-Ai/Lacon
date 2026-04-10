/**
 * React hooks for Phase 8 Tools
 * Provides easy access to agent tools from renderer
 */

import { useCallback, useState } from 'react'

import type {
  AuthoringToolInput,
  AuthoringToolOutput,
  BRollGeneratorInput,
  BRollGeneratorOutput,
  ToneAnalyzerInput,
  ToneAnalyzerOutput,
  ToolRegistryEntry,
  WebResearchInput,
  WebResearchOutput,
  WorkspaceQAInput,
  WorkspaceQAOutput,
  YouTubeTranscriptInput,
  YouTubeTranscriptOutput,
} from '../../shared/tool-types'

/**
 * Hook for listing available tools
 */
export function useToolsList() {
  const [tools, setTools] = useState<ToolRegistryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTools = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('tools:list')

      if (result.success) {
        setTools(result.tools)
      } else {
        setError(result.error || 'Failed to load tools')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }, [])

  const getToolsByCategory = useCallback(async (category: string) => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('tools:list-by-category', category)

      if (result.success) {
        setTools(result.tools)
      } else {
        setError(result.error || 'Failed to load tools')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    tools,
    loading,
    error,
    loadTools,
    getToolsByCategory,
  }
}

/**
 * Hook for authoring tools (rewrite, shorten, expand, polish, tone-adjust)
 */
export function useAuthoringTools() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const executeTool = useCallback(
    async (toolName: string, input: AuthoringToolInput): Promise<AuthoringToolOutput | null> => {
      setLoading(true)
      setError(null)

      try {
        const result = await window.electron.invoke('tools:authoring', toolName, input)

        if (result.success) {
          return result.output as AuthoringToolOutput
        }
        setError(result.error || 'Tool execution failed')
        return null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tool execution failed')
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const rewrite = useCallback((input: AuthoringToolInput) => executeTool('rewrite-text', input), [executeTool])
  const shorten = useCallback((input: AuthoringToolInput) => executeTool('shorten-text', input), [executeTool])
  const expand = useCallback((input: AuthoringToolInput) => executeTool('expand-text', input), [executeTool])
  const polish = useCallback((input: AuthoringToolInput) => executeTool('polish-text', input), [executeTool])
  const toneAdjust = useCallback((input: AuthoringToolInput) => executeTool('tone-adjust', input), [executeTool])

  return {
    loading,
    error,
    rewrite,
    shorten,
    expand,
    polish,
    toneAdjust,
  }
}

/**
 * Hook for workspace QA tool
 */
export function useWorkspaceQA() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = useCallback(async (input: WorkspaceQAInput): Promise<WorkspaceQAOutput | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('tools:workspace-qa', input)

      if (result.success) {
        return result.output as WorkspaceQAOutput
      }
      setError(result.error || 'Workspace QA failed')
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace QA failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    query,
  }
}

/**
 * Hook for web research tool
 */
export function useWebResearch() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const research = useCallback(async (input: WebResearchInput): Promise<WebResearchOutput | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('tools:web-research', input)

      if (result.success) {
        return result.output as WebResearchOutput
      }
      setError(result.error || 'Web research failed')
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Web research failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    research,
  }
}

/**
 * Hook for YouTube transcript tool
 */
export function useYouTubeTranscript() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTranscript = useCallback(
    async (input: YouTubeTranscriptInput): Promise<YouTubeTranscriptOutput | null> => {
      setLoading(true)
      setError(null)

      try {
        const result = await window.electron.invoke('tools:youtube-transcript', input)

        if (result.success) {
          return result.output as YouTubeTranscriptOutput
        }
        setError(result.error || 'YouTube transcript fetch failed')
        return null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'YouTube transcript fetch failed')
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return {
    loading,
    error,
    fetchTranscript,
  }
}

/**
 * Hook for tone analyzer tool
 */
export function useToneAnalyzer() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (input: ToneAnalyzerInput): Promise<ToneAnalyzerOutput | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('tools:tone-analyzer', input)

      if (result.success) {
        return result.output as ToneAnalyzerOutput
      }
      setError(result.error || 'Tone analysis failed')
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tone analysis failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    analyze,
  }
}

/**
 * Hook for B-roll generator tool
 */
export function useBRollGenerator() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (input: BRollGeneratorInput): Promise<BRollGeneratorOutput | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('tools:broll-generator', input)

      if (result.success) {
        return result.output as BRollGeneratorOutput
      }
      setError(result.error || 'B-roll generation failed')
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'B-roll generation failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    generate,
  }
}

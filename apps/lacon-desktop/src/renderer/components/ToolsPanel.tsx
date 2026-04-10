/**
 * Tools Panel Component
 * Phase 8: UI for accessing agent tools
 */

import React, { useEffect, useState } from 'react'

import {
  useAuthoringTools,
  useBRollGenerator,
  useToneAnalyzer,
  useToolsList,
  useWebResearch,
  useWorkspaceQA,
  useYouTubeTranscript,
} from '../hooks/useTools'

export const ToolsPanel: React.FC = () => {
  const { tools, loading, error, loadTools, getToolsByCategory } = useToolsList()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    loadTools()
  }, [loadTools])

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    if (category === 'all') {
      loadTools()
    } else {
      getToolsByCategory(category)
    }
  }

  return (
    <div className="tools-panel">
      <div className="tools-header">
        <h2>Agent Tools</h2>
        <div className="category-filter">
          <button className={selectedCategory === 'all' ? 'active' : ''} onClick={() => handleCategoryChange('all')}>
            All
          </button>
          <button
            className={selectedCategory === 'authoring' ? 'active' : ''}
            onClick={() => handleCategoryChange('authoring')}
          >
            Authoring
          </button>
          <button
            className={selectedCategory === 'retrieval' ? 'active' : ''}
            onClick={() => handleCategoryChange('retrieval')}
          >
            Retrieval
          </button>
          <button
            className={selectedCategory === 'creator' ? 'active' : ''}
            onClick={() => handleCategoryChange('creator')}
          >
            Creator
          </button>
        </div>
      </div>

      {loading && <div className="loading">Loading tools...</div>}
      {error && <div className="error">{error}</div>}

      <div className="tools-list">
        {tools.map(tool => (
          <div key={tool.name} className="tool-card">
            <div className="tool-header">
              <h3>{tool.name}</h3>
              <span className={`risk-badge risk-${tool.riskLevel}`}>{tool.riskLevel}</span>
            </div>
            <p className="tool-description">{tool.description}</p>
            <div className="tool-meta">
              <span className="tool-category">{tool.category}</span>
              {tool.requiresApproval && <span className="approval-badge">Requires Approval</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Authoring Tools Panel
 */
export const AuthoringToolsPanel: React.FC<{
  selectedText: string
  onResult: (result: any) => void
}> = ({ selectedText, onResult }) => {
  const { rewrite, shorten, expand, polish, toneAdjust, loading, error } = useAuthoringTools()
  const [insertionMode, setInsertionMode] = useState<'replace' | 'insert-below' | 'preview'>('preview')
  const [tone, setTone] = useState<'professional' | 'casual' | 'friendly' | 'formal' | 'creative'>('professional')

  const handleRewrite = async () => {
    const result = await rewrite({ text: selectedText, insertionMode })
    if (result) {
      onResult(result)
    }
  }

  const handleShorten = async () => {
    const result = await shorten({ text: selectedText, insertionMode })
    if (result) {
      onResult(result)
    }
  }

  const handleExpand = async () => {
    const result = await expand({ text: selectedText, insertionMode })
    if (result) {
      onResult(result)
    }
  }

  const handlePolish = async () => {
    const result = await polish({ text: selectedText, tone, insertionMode })
    if (result) {
      onResult(result)
    }
  }

  const handleToneAdjust = async () => {
    const result = await toneAdjust({ text: selectedText, tone, insertionMode })
    if (result) {
      onResult(result)
    }
  }

  return (
    <div className="authoring-tools-panel">
      <h3>Authoring Tools</h3>

      <div className="tool-controls">
        <div className="control-group">
          <label>Insertion Mode:</label>
          <select value={insertionMode} onChange={e => setInsertionMode(e.target.value as any)}>
            <option value="preview">Preview</option>
            <option value="replace">Replace</option>
            <option value="insert-below">Insert Below</option>
          </select>
        </div>

        <div className="control-group">
          <label>Tone:</label>
          <select value={tone} onChange={e => setTone(e.target.value as any)}>
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
            <option value="creative">Creative</option>
          </select>
        </div>
      </div>

      <div className="tool-actions">
        <button onClick={handleRewrite} disabled={loading || !selectedText}>
          Rewrite
        </button>
        <button onClick={handleShorten} disabled={loading || !selectedText}>
          Shorten
        </button>
        <button onClick={handleExpand} disabled={loading || !selectedText}>
          Expand
        </button>
        <button onClick={handlePolish} disabled={loading || !selectedText}>
          Polish
        </button>
        <button onClick={handleToneAdjust} disabled={loading || !selectedText}>
          Adjust Tone
        </button>
      </div>

      {loading && <div className="loading">Processing...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  )
}

/**
 * Research Tools Panel
 */
export const ResearchToolsPanel: React.FC<{
  onResult: (result: any) => void
}> = ({ onResult }) => {
  const workspaceQA = useWorkspaceQA()
  const webResearch = useWebResearch()
  const [query, setQuery] = useState('')

  const handleWorkspaceQA = async () => {
    const result = await workspaceQA.query({ query })
    if (result) {
      onResult(result)
    }
  }

  const handleWebResearch = async () => {
    const result = await webResearch.research({ query })
    if (result) {
      onResult(result)
    }
  }

  return (
    <div className="research-tools-panel">
      <h3>Research Tools</h3>

      <div className="query-input">
        <input type="text" placeholder="Enter your query..." value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="tool-actions">
        <button onClick={handleWorkspaceQA} disabled={workspaceQA.loading || !query}>
          Search Workspace
        </button>
        <button onClick={handleWebResearch} disabled={webResearch.loading || !query}>
          Search Web
        </button>
      </div>

      {(workspaceQA.loading || webResearch.loading) && <div className="loading">Searching...</div>}
      {(workspaceQA.error || webResearch.error) && (
        <div className="error">{workspaceQA.error || webResearch.error}</div>
      )}
    </div>
  )
}

/**
 * Creator Tools Panel
 */
export const CreatorToolsPanel: React.FC<{
  scriptText: string
  onResult: (result: any) => void
}> = ({ scriptText, onResult }) => {
  const youtubeTranscript = useYouTubeTranscript()
  const toneAnalyzer = useToneAnalyzer()
  const brollGenerator = useBRollGenerator()
  const [youtubeUrl, setYoutubeUrl] = useState('')

  const handleFetchTranscript = async () => {
    const result = await youtubeTranscript.fetchTranscript({ url: youtubeUrl, includeTimestamps: true })
    if (result) {
      onResult(result)
    }
  }

  const handleAnalyzeTone = async () => {
    const result = await toneAnalyzer.analyze({ text: scriptText, analyzeHook: true, analyzeTone: true })
    if (result) {
      onResult(result)
    }
  }

  const handleGenerateBRoll = async () => {
    const result = await brollGenerator.generate({ scriptText, includeOnScreenText: true, includeTimestamps: true })
    if (result) {
      onResult(result)
    }
  }

  return (
    <div className="creator-tools-panel">
      <h3>Creator Tools</h3>

      <div className="tool-section">
        <h4>YouTube Transcript</h4>
        <input
          type="text"
          placeholder="Enter YouTube URL..."
          value={youtubeUrl}
          onChange={e => setYoutubeUrl(e.target.value)}
        />
        <button onClick={handleFetchTranscript} disabled={youtubeTranscript.loading || !youtubeUrl}>
          Fetch Transcript
        </button>
        {youtubeTranscript.loading && <div className="loading">Fetching...</div>}
        {youtubeTranscript.error && <div className="error">{youtubeTranscript.error}</div>}
      </div>

      <div className="tool-section">
        <h4>Tone & Hook Analysis</h4>
        <button onClick={handleAnalyzeTone} disabled={toneAnalyzer.loading || !scriptText}>
          Analyze Tone
        </button>
        {toneAnalyzer.loading && <div className="loading">Analyzing...</div>}
        {toneAnalyzer.error && <div className="error">{toneAnalyzer.error}</div>}
      </div>

      <div className="tool-section">
        <h4>B-roll Generator</h4>
        <button onClick={handleGenerateBRoll} disabled={brollGenerator.loading || !scriptText}>
          Generate B-roll Cues
        </button>
        {brollGenerator.loading && <div className="loading">Generating...</div>}
        {brollGenerator.error && <div className="error">{brollGenerator.error}</div>}
      </div>
    </div>
  )
}

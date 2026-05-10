/**
 * Agentic Pre-Flight Engine
 *
 * Before outline generation, the LLM receives a tool manifest and
 * autonomously decides whether to:
 * - Research a topic via web search
 * - Check existing research (uploaded PDFs, notes, etc.)
 * - Auto-select writing skills that match the task
 *
 * Runs in a loop (max iterations) until the LLM signals ready_to_plan.
 * Falls back gracefully if no provider is configured.
 */

import type {
  ResearchContext,
  ResearchLogEntry,
  SkillListItem,
} from '../../shared/writer-types'
import { getProviderManager } from '../providers/provider-manager'
import { getResearchLogService } from '../services/research-log-service'
import { getResearchSearchService } from '../services/research-search-service'
import { getSkillService } from '../services/skill-service'
import { getActiveProjectPath, getProjectWorkspaceService } from '../services/project-workspace-service'

// ─────────────────────────── Types ───────────────────────────

/** A single tool call parsed from LLM output */
export interface AgentToolCall {
  tool: string
  args: Record<string, any>
}

/** A step in the pre-flight execution log */
export interface PreflightStep {
  id: number
  type: 'thinking' | 'tool-call' | 'tool-result' | 'ready'
  tool?: string
  args?: Record<string, any>
  result?: string
  message: string
  timestamp: string
}

/** Result of the agentic pre-flight phase */
export interface PreflightResult {
  /** The enriched instruction (may include research insights) */
  enrichedInstruction: string
  /** Auto-composed skill prompt (if skills were auto-selected) */
  composedSkillPrompt: string
  /** Research context gathered during pre-flight */
  researchContext: ResearchContext | undefined
  /** Auto-selected skill IDs */
  autoSelectedSkillIds: string[]
  /** Execution log of all steps taken */
  steps: PreflightStep[]
  /** Whether the preflight actually ran (false if no provider) */
  didRun: boolean
}

/** Callback for real-time progress updates */
export type PreflightProgressCallback = (step: PreflightStep) => void

/** Input to the agentic pre-flight */
export interface PreflightInput {
  documentId: string
  instruction: string
  composedSkillPrompt: string
  existingResearch?: ResearchContext
  onProgress?: PreflightProgressCallback
}

// ─────────────────────────── Constants ───────────────────────────

const MAX_ITERATIONS = 5
const PREFLIGHT_TIMEOUT_MS = 120_000 // 2 minutes total max

// ─────────────────────────── Research Intent Detection ───────────────────────────

/**
 * Patterns that indicate the user explicitly wants research done on a topic.
 * Each pattern captures the topic in group 1.
 */
const RESEARCH_PATTERNS: RegExp[] = [
  /research\s+(?:about|on|into)\s+(.+?)(?:\s+and\s+(?:write|create|draft|compose|produce)|[.]|$)/i,
  /write\s+(?:an?\s+)?(?:article|paper|report|essay|piece|blog\s*post)\s+(?:about|on|regarding)\s+(.+?)(?:\s*[.]|$)/i,
  /investigate\s+(.+?)(?:\s+and\s+|[.]|$)/i,
  /deep\s+dive\s+(?:into|on)\s+(.+?)(?:\s+and\s+|[.]|$)/i,
  /explore\s+(?:the\s+topic\s+(?:of\s+)?)?(.+?)(?:\s+and\s+(?:write|create)|[.]|$)/i,
  /comprehensive\s+(?:article|paper|report|guide)\s+(?:about|on)\s+(.+?)(?:\s*[.]|$)/i,
  /(?:write|create)\s+(?:about|on)\s+(.+?)(?:\s+(?:based|using)\s+(?:on\s+)?research|[.]|$)/i,
]

/**
 * Detect whether the user's instruction implies a research phase.
 * Returns the detected topic if found.
 */
function detectResearchIntent(instruction: string): { detected: boolean; topic: string | null } {
  const trimmed = instruction.trim()
  for (const pattern of RESEARCH_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match && match[1]) {
      const topic = match[1].trim().replace(/[.,;:!?]+$/, '').trim()
      if (topic.length >= 2 && topic.length <= 200) {
        return { detected: true, topic }
      }
    }
  }
  return { detected: false, topic: null }
}

// ─────────────────────────── Tool Manifest ───────────────────────────

/**
 * System prompt that teaches the LLM about available tools.
 * Uses a portable JSON function-calling format (not OpenAI-specific).
 */
function buildPreflightSystemPrompt(): string {
  return `You are an intelligent writing assistant preparing to help the user write a document. Before generating an outline, you should analyze the user's request and gather any necessary context.

You have access to the following tools. To use a tool, respond with a JSON block:

\`\`\`tool_call
{"tool": "tool_name", "args": {"key": "value"}}
\`\`\`

## Available Tools

### search_web
Search the internet for relevant articles and information on a topic.
Args: {"query": "search query string"}
Use when: The topic requires factual information, statistics, recent events, or domain knowledge you should verify.

### deep_research
Perform deep research: search, extract full articles, and create an AI summary. More thorough than search_web.
Args: {"query": "research topic or URL"}
Use when: The topic is complex and needs comprehensive background research. You can also pass a URL to extract content directly.

### get_existing_research
Check what research materials the user has already uploaded or gathered (PDFs, notes, web research, imported files).
Args: {}
Use when: Always check this first — the user may have already provided relevant materials that should inform the writing.

### list_available_skills
List all available writing skills (genre guides, style rules, structural templates).
Args: {}
Use when: You want to see what specialized writing guidance is available before writing.

### select_skills
Auto-activate writing skills that match this task. Skills provide genre-specific rules (e.g., essay structure, story elements, technical writing conventions).
Args: {"skill_ids": ["skill-id-1", "skill-id-2"]}
Use when: You found skills that match the user's writing task and the user hasn't already selected them.

### ready_to_plan
Signal that you have gathered enough context and are ready to generate the outline.
Args: {"enriched_instruction": "The original instruction enriched with your research insights and context"}
Use when: You have all the context you need and are ready to proceed.

## Rules

1. You MUST call \`get_existing_research\` first to check if the user has already uploaded relevant materials.
2. You MUST call \`list_available_skills\` to check if a matching writing skill should be auto-activated.
3. Only call \`search_web\` or \`deep_research\` if the topic genuinely requires external information (e.g., factual claims, statistics, current events). Creative writing or personal essays typically don't need web research.
4. You MUST end by calling \`ready_to_plan\` with an enriched version of the user's instruction.
5. Keep your reasoning brief. Focus on tool calls, not lengthy explanations.
6. You can make multiple tool calls across multiple turns, but be efficient (max ${MAX_ITERATIONS} turns).

Respond with your reasoning first (1-2 sentences), then the tool call.`
}

// ─────────────────────────── Tool Executor ───────────────────────────

/**
 * Execute a tool call by delegating to existing services.
 */
async function executeTool(
  toolCall: AgentToolCall,
  documentId: string,
  autoSelectedSkillIds: string[],
): Promise<{ result: string; skillIds?: string[] }> {
  const projectPath = getActiveProjectPath()

  switch (toolCall.tool) {
    case 'search_web': {
      const query = toolCall.args.query
      if (!query) return { result: 'Error: query argument is required' }
      try {
        const results = await getResearchSearchService().quickSearch(query)
        if (results.length === 0) {
          return { result: `No web results found for "${query}". Try a different query or proceed without.` }
        }
        const summary = results
          .slice(0, 5)
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
          .join('\n\n')
        return { result: `Found ${results.length} results:\n\n${summary}` }
      } catch (err: any) {
        return { result: `Search failed: ${err.message}` }
      }
    }

    case 'deep_research': {
      const query = toolCall.args.query
      if (!query) return { result: 'Error: query argument is required' }
      try {
        const entry = await getResearchSearchService().deepResearch(query, documentId)
        const excerptPreview = entry.excerpts.slice(0, 2).join('\n\n')
        return {
          result: `Deep research complete. Added entry "${entry.query}" with ${entry.sources.length} sources.\n\nKey findings:\n${excerptPreview.slice(0, 800)}`,
        }
      } catch (err: any) {
        return { result: `Deep research failed: ${err.message}` }
      }
    }

    case 'get_existing_research': {
      try {
        const log = getResearchLogService().getLog(documentId)
        if (log.entries.length === 0) {
          return { result: 'No existing research found. The user has not uploaded any materials or conducted prior research for this document.' }
        }
        const summary = log.entries
          .map((e: ResearchLogEntry) => {
            const sourceCount = e.sources.length
            const tags = e.tags.length > 0 ? ` [${e.tags.join(', ')}]` : ''
            const excerpt = e.excerpts[0] ? `\n  Preview: ${e.excerpts[0].slice(0, 150)}...` : ''
            return `• "${e.query}" — ${sourceCount} sources${tags}${excerpt}`
          })
          .join('\n')
        return {
          result: `Found ${log.entries.length} existing research entries:\n\n${summary}\n\nYou should use this existing research to inform the outline.`,
        }
      } catch (err: any) {
        return { result: `Could not load research: ${err.message}` }
      }
    }

    case 'list_available_skills': {
      try {
        const skills = getSkillService().listSkills(projectPath || undefined)
        if (skills.length === 0) {
          return { result: 'No writing skills are available in this project. Proceed without skill guidance.' }
        }
        const list = skills
          .map((s: SkillListItem) => `• ${s.id}: "${s.name}" — ${s.description} [tags: ${s.tags.join(', ')}]`)
          .join('\n')
        return { result: `Available writing skills (${skills.length}):\n\n${list}\n\nUse select_skills to activate relevant ones.` }
      } catch (err: any) {
        return { result: `Could not list skills: ${err.message}` }
      }
    }

    case 'select_skills': {
      const ids = toolCall.args.skill_ids
      if (!Array.isArray(ids) || ids.length === 0) {
        return { result: 'Error: skill_ids must be a non-empty array' }
      }
      try {
        const composed = getSkillService().composeSkills(ids, projectPath || undefined)
        const newIds = [...new Set([...autoSelectedSkillIds, ...ids])]
        return {
          result: `Activated skills: ${composed.label}. These skill rules will be used to guide the outline and writing.`,
          skillIds: newIds,
        }
      } catch (err: any) {
        return { result: `Could not select skills: ${err.message}` }
      }
    }

    case 'ready_to_plan': {
      const enriched = toolCall.args.enriched_instruction
      return {
        result: enriched || 'Ready to generate outline.',
      }
    }

    default:
      return { result: `Unknown tool: ${toolCall.tool}. Available: search_web, deep_research, get_existing_research, list_available_skills, select_skills, ready_to_plan` }
  }
}

// ─────────────────────────── Response Parser ───────────────────────────

/**
 * Parse tool calls from LLM response text.
 * Looks for ```tool_call ... ``` blocks with JSON inside.
 */
function parseToolCalls(text: string): AgentToolCall[] {
  const calls: AgentToolCall[] = []

  // Pattern 1: ```tool_call\n{...}\n```
  const blockPattern = /```tool_call\s*\n?([\s\S]*?)```/g
  let match: RegExpExecArray | null = blockPattern.exec(text)
  while (match !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.tool) {
        calls.push({ tool: parsed.tool, args: parsed.args || {} })
      }
    } catch {
      // Malformed JSON — skip
    }
    match = blockPattern.exec(text)
  }

  // Pattern 2: Inline JSON (fallback) — {"tool": "...", "args": {...}}
  if (calls.length === 0) {
    const inlinePattern = /\{[\s\n]*"tool"\s*:\s*"(\w+)"[\s\S]*?\}/g
    match = inlinePattern.exec(text)
    while (match !== null) {
      try {
        const parsed = JSON.parse(match[0])
        if (parsed.tool) {
          calls.push({ tool: parsed.tool, args: parsed.args || {} })
        }
      } catch {
        // Malformed — skip
      }
      match = inlinePattern.exec(text)
    }
  }

  return calls
}

// ─────────────────────────── Main Pre-Flight Loop ───────────────────────────

/**
 * Run the agentic pre-flight phase.
 *
 * The LLM is given the user's instruction and a tool manifest.
 * It can call tools in a loop to gather context before outline generation.
 */
export async function runAgenticPreflight(input: PreflightInput): Promise<PreflightResult> {
  const { documentId, instruction, composedSkillPrompt, existingResearch, onProgress } = input

  const steps: PreflightStep[] = []
  let stepId = 0
  let autoSelectedSkillIds: string[] = []
  let enrichedInstruction = instruction
  let finalSkillPrompt = composedSkillPrompt
  let finalResearch = existingResearch

  const emitStep = (step: Omit<PreflightStep, 'id' | 'timestamp'>) => {
    const full: PreflightStep = {
      ...step,
      id: (stepId += 1) - 1,
      timestamp: new Date().toISOString(),
    }
    steps.push(full)
    onProgress?.(full)
    return full
  }

  // Check if we have an LLM provider
  const pm = getProviderManager()
  const providers = pm.listProviders()
  const enabledProvider = providers.find(p => p.enabled)

  if (!enabledProvider) {
    emitStep({
      type: 'thinking',
      message: 'No AI provider configured — skipping agentic pre-flight',
    })
    return {
      enrichedInstruction: instruction,
      composedSkillPrompt,
      researchContext: existingResearch,
      autoSelectedSkillIds: [],
      steps,
      didRun: false,
    }
  }

  // Resolve model: session.modelConfig takes priority over provider.defaultModel
  let resolvedProviderId = enabledProvider.id
  let modelId = enabledProvider.defaultModel || 'gpt-4o-mini'
  try {
    const projectPath = getActiveProjectPath()
    if (projectPath) {
      const ws = getProjectWorkspaceService()
      const session = ws.getSession(documentId, projectPath)
      if (session.modelConfig?.providerId && session.modelConfig?.modelId) {
        const sessionProvider = providers.find(p => p.id === session.modelConfig.providerId)
        if (sessionProvider) {
          resolvedProviderId = session.modelConfig.providerId
          modelId = session.modelConfig.modelId
          console.log(`[Preflight] Using session model config: provider=${resolvedProviderId}, model=${modelId}`)
        }
      }
    }
  } catch (err) {
    console.warn('[Preflight] Could not read session modelConfig, using default:', err)
  }

  emitStep({
    type: 'thinking',
    message: '🤔 Analyzing your request and checking available resources...',
  })

  // ── Keyword-based auto-skill selection (fallback for when LLM doesn't select skills) ──
  // This runs deterministically before the LLM loop to ensure obvious skill matches are caught
  if (!composedSkillPrompt) {
    const lowerInstruction = instruction.toLowerCase()
    const SKILL_KEYWORD_MAP: Record<string, string[]> = {
      'story': ['story', 'fiction', 'narrative', 'short story', 'tale', 'fable', 'fairy tale', 'novella', 'creative writing', 'write a story', 'once upon'],
      'essay': ['essay', 'argumentative', 'persuasive essay', 'expository', 'thesis'],
      'academic': ['academic', 'research paper', 'dissertation', 'scholarly', 'journal article', 'peer review', 'citation'],
      'newsletter': ['newsletter', 'email blast', 'subscriber', 'weekly update', 'monthly digest'],
      'script': ['script', 'screenplay', 'dialogue', 'scene', 'act 1', 'act 2', 'stage direction'],
    }

    const matchedSkillIds: string[] = []
    for (const [skillId, keywords] of Object.entries(SKILL_KEYWORD_MAP)) {
      if (keywords.some(kw => lowerInstruction.includes(kw))) {
        matchedSkillIds.push(skillId)
      }
    }

    if (matchedSkillIds.length > 0) {
      // Verify these skills actually exist before auto-selecting
      try {
        const projectPath = getActiveProjectPath()
        const availableSkills = getSkillService().listSkills(projectPath || undefined)
        const validIds = matchedSkillIds.filter(id => availableSkills.some(s => s.id === id))

        if (validIds.length > 0) {
          autoSelectedSkillIds = validIds.slice(0, 3) // max 3 skills
          const composed = getSkillService().composeSkills(autoSelectedSkillIds, projectPath || undefined)
          finalSkillPrompt = composed.composedPrompt

          emitStep({
            type: 'tool-call',
            tool: 'select_skills',
            args: { skill_ids: autoSelectedSkillIds },
            message: `✨ Auto-detected writing type — activating skill${autoSelectedSkillIds.length > 1 ? 's' : ''}: ${autoSelectedSkillIds.join(', ')}`,
          })

          console.log(`[Preflight] Keyword-based auto-selected skills: ${autoSelectedSkillIds.join(', ')}`)
        }
      } catch (err: any) {
        console.warn('[Preflight] Keyword skill auto-selection failed:', err.message)
      }
    }
  }

  // ── Research-Intent Detection (forced auto-research before LLM loop) ──
  // When the user explicitly asks to research a topic, we don't leave it to the LLM's discretion.
  // We force deep research immediately to ensure comprehensive coverage.
  const researchIntent = detectResearchIntent(instruction)
  if (researchIntent.detected && researchIntent.topic) {
    emitStep({
      type: 'tool-call',
      tool: 'deep_research',
      args: { query: researchIntent.topic },
      message: `🔬 Research intent detected — auto-researching: "${researchIntent.topic}"`,
    })

    try {
      const researchService = getResearchSearchService()
      const entries = await researchService.autoResearch(
        researchIntent.topic,
        documentId,
        (progress) => {
          emitStep({
            type: 'tool-result',
            tool: 'deep_research',
            result: progress.message,
            message: `🔬 ${progress.message} (${progress.current}/${progress.total})`,
          })
        },
      )

      // Update final research context from the log
      try {
        const log = getResearchLogService().getLog(documentId)
        if (log.entries.length > 0) {
          finalResearch = {
            entries: log.entries.map(e => ({
              id: e.id,
              query: e.query,
              sources: e.sources,
              excerpts: e.excerpts,
              createdAt: e.createdAt,
            })),
            summary: log.summary,
          }
        }
      } catch {
        // Keep existing research context
      }

      emitStep({
        type: 'tool-result',
        tool: 'deep_research',
        result: `${entries.length} research entries created`,
        message: `📊 Auto-research complete: ${entries.length} entries with ${entries.reduce((sum, e) => sum + e.sources.length, 0)} total sources`,
      })

      console.log(`[Preflight] Research-intent auto-research complete: ${entries.length} entries for "${researchIntent.topic}"`)
    } catch (err: any) {
      console.warn('[Preflight] Research-intent auto-research failed:', err.message)
      emitStep({
        type: 'tool-result',
        tool: 'deep_research',
        result: `Failed: ${err.message}`,
        message: `⚠️ Auto-research failed: ${err.message}. Will try via LLM loop.`,
      })
    }
  }

  // Build conversation history for multi-turn tool calling
  const skillStatusMsg = finalSkillPrompt
    ? `Writing skills are already active (auto-detected or user-selected): ${autoSelectedSkillIds.join(', ')}. No need to call list_available_skills or select_skills.\n\n`
    : 'The user has NOT selected any writing skills.\n\n'

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: buildPreflightSystemPrompt() },
    {
      role: 'user',
      content: `The user wants to write about:\n\n"${instruction}"\n\n${skillStatusMsg}${
        existingResearch && existingResearch.entries.length > 0
          ? `There are ${existingResearch.entries.length} existing research entries available.\n`
          : ''
      }Please analyze this request. Start by checking existing research${!finalSkillPrompt ? ' and available skills' : ''}, then decide if web research is needed.`,
    },
  ]

  // Timeout guard
  const startTime = Date.now()

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Timeout check
    if (Date.now() - startTime > PREFLIGHT_TIMEOUT_MS) {
      emitStep({
        type: 'thinking',
        message: '⏱ Pre-flight timeout reached — proceeding with gathered context',
      })
      break
    }

    // Call LLM
    let llmResponse: string
    try {
      const response = await pm.chatCompletion(
        resolvedProviderId,
        {
          model: modelId,
          messages,
          temperature: 0.3,
          maxTokens: 1000,
        },
        'agentic-preflight',
      )

      llmResponse = response.choices?.[0]?.message?.content || ''
    } catch (err: any) {
      console.error('[Preflight] LLM call failed:', err.message)
      emitStep({
        type: 'thinking',
        message: `⚠️ AI reasoning failed: ${err.message}. Proceeding with direct outline generation.`,
      })
      break
    }

    if (!llmResponse.trim()) {
      emitStep({
        type: 'thinking',
        message: '⚠️ Empty AI response — proceeding with direct outline generation',
      })
      break
    }

    // Parse tool calls from LLM response
    const toolCalls = parseToolCalls(llmResponse)

    if (toolCalls.length === 0) {
      // LLM responded without tool calls — treat as "ready to plan"
      emitStep({
        type: 'thinking',
        message: 'AI decided no additional tools needed — proceeding to outline',
      })
      // Add any reasoning text as enrichment
      if (llmResponse.length > 20 && llmResponse.length < 2000) {
        enrichedInstruction = `${instruction}\n\nAI analysis: ${llmResponse.slice(0, 500)}`
      }
      break
    }

    // Add LLM response to conversation history
    messages.push({ role: 'assistant', content: llmResponse })

    // Execute each tool call
    for (const call of toolCalls) {
      // Check for ready_to_plan — this ends the loop
      if (call.tool === 'ready_to_plan') {
        const enriched = call.args.enriched_instruction || instruction
        enrichedInstruction = enriched

        emitStep({
          type: 'ready',
          tool: 'ready_to_plan',
          message: '✅ Context gathering complete — generating outline',
        })

        // Build final research context from the log
        try {
          const log = getResearchLogService().getLog(documentId)
          if (log.entries.length > 0) {
            finalResearch = {
              entries: log.entries.map(e => ({
                id: e.id,
                query: e.query,
                sources: e.sources,
                excerpts: e.excerpts,
                createdAt: e.createdAt,
              })),
              summary: log.summary,
            }
          }
        } catch {
          // Keep existing research context
        }

        // Build final skill prompt if skills were auto-selected
        if (autoSelectedSkillIds.length > 0 && !composedSkillPrompt) {
          try {
            const projectPath = getActiveProjectPath()
            const composed = getSkillService().composeSkills(autoSelectedSkillIds, projectPath || undefined)
            finalSkillPrompt = composed.composedPrompt
          } catch {
            // Keep existing skill prompt
          }
        }

        return {
          enrichedInstruction,
          composedSkillPrompt: finalSkillPrompt,
          researchContext: finalResearch,
          autoSelectedSkillIds,
          steps,
          didRun: true,
        }
      }

      // Emit progress for this tool call
      const toolLabel = getToolLabel(call.tool, call.args)
      emitStep({
        type: 'tool-call',
        tool: call.tool,
        args: call.args,
        message: toolLabel,
      })

      // Execute the tool
      const { result, skillIds } = await executeTool(call, documentId, autoSelectedSkillIds)

      if (skillIds) {
        autoSelectedSkillIds = skillIds
      }

      emitStep({
        type: 'tool-result',
        tool: call.tool,
        result: result.slice(0, 300),
        message: getToolResultLabel(call.tool, result),
      })

      // Add tool result to conversation for next LLM turn
      messages.push({
        role: 'user',
        content: `Tool result for ${call.tool}:\n\n${result}`,
      })
    }
  }

  // If we exited the loop without ready_to_plan, still build final context
  try {
    const log = getResearchLogService().getLog(documentId)
    if (log.entries.length > 0) {
      finalResearch = {
        entries: log.entries.map(e => ({
          id: e.id,
          query: e.query,
          sources: e.sources,
          excerpts: e.excerpts,
          createdAt: e.createdAt,
        })),
        summary: log.summary,
      }
    }
  } catch {
    // Keep existing
  }

  if (autoSelectedSkillIds.length > 0 && !composedSkillPrompt) {
    try {
      const projectPath = getActiveProjectPath()
      const composed = getSkillService().composeSkills(autoSelectedSkillIds, projectPath || undefined)
      finalSkillPrompt = composed.composedPrompt
    } catch {
      // Keep existing
    }
  }

  emitStep({
    type: 'ready',
    message: '📝 Proceeding to outline generation...',
  })

  return {
    enrichedInstruction,
    composedSkillPrompt: finalSkillPrompt,
    researchContext: finalResearch,
    autoSelectedSkillIds,
    steps,
    didRun: true,
  }
}

// ─────────────────────────── UI Labels ───────────────────────────

function getToolLabel(tool: string, args: Record<string, any>): string {
  switch (tool) {
    case 'search_web':
      return `🔍 Searching the web: "${args.query || ''}"`
    case 'deep_research':
      return `🔬 Deep researching: "${args.query || ''}"`
    case 'get_existing_research':
      return '📚 Checking your uploaded research materials...'
    case 'list_available_skills':
      return '✨ Checking available writing skills...'
    case 'select_skills':
      return `✨ Auto-activating skills: ${(args.skill_ids || []).join(', ')}`
    case 'ready_to_plan':
      return '✅ Ready to generate outline'
    default:
      return `🔧 ${tool}`
  }
}

function getToolResultLabel(tool: string, result: string): string {
  switch (tool) {
    case 'search_web': {
      const countMatch = result.match(/Found (\d+) results/)
      return countMatch ? `📄 Found ${countMatch[1]} web results` : '📄 Search complete'
    }
    case 'deep_research':
      return '📊 Deep research complete — findings added to research log'
    case 'get_existing_research': {
      const entryMatch = result.match(/Found (\d+) existing/)
      return entryMatch ? `📚 Found ${entryMatch[1]} existing research entries` : '📚 No existing research found'
    }
    case 'list_available_skills': {
      const skillMatch = result.match(/\((\d+)\)/)
      return skillMatch ? `✨ ${skillMatch[1]} skills available` : '✨ No skills found'
    }
    case 'select_skills':
      return '✨ Skills activated'
    default:
      return `✅ ${tool} complete`
  }
}

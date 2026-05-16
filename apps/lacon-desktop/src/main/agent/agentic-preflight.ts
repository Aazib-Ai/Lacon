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

import type { ResearchContext, ResearchLogEntry, SkillListItem } from '../../shared/writer-types'
import { getProviderManager } from '../providers/provider-manager'
import { getActiveProjectPath, getProjectWorkspaceService } from '../services/project-workspace-service'
import { getResearchLogService } from '../services/research-log-service'
import { getResearchSearchService } from '../services/research-search-service'
import { getSkillService } from '../services/skill-service'

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

const MAX_ITERATIONS = 8
const PREFLIGHT_TIMEOUT_MS = 150_000 // 2.5 minutes total max

// ─────────────────────────── Tool Manifest ───────────────────────────

/**
 * System prompt that teaches the LLM about available tools.
 * The LLM is the SOLE decision-maker — no keyword/regex pre-processing.
 * It decides intelligently what tools to use based on the user's instruction.
 */
function buildPreflightSystemPrompt(): string {
  return `You are an intelligent AI writing agent preparing to help the user write a document. You must analyze the request and autonomously decide what preparation is needed BEFORE generating an outline.

You have access to the following tools. To use a tool, respond with a JSON block:

\`\`\`tool_call
{"tool": "tool_name", "args": {"key": "value"}}
\`\`\`

## Available Tools

### search_web
Search the internet for relevant articles and information on a topic.
Args: {"query": "search query string"}

### deep_research  
Perform deep research: search, extract full articles, and create an AI summary. More thorough than search_web.
Args: {"query": "research topic or question"}

### get_existing_research
Check what research materials the user has already gathered (PDFs, notes, web research).
Args: {}

### list_available_skills
List all available writing skills (genre guides, style rules, structural templates).
Args: {}

### select_skills
Activate writing skills that match this task. Skills provide genre-specific rules.
Args: {"skill_ids": ["skill-id-1", "skill-id-2"]}

### ready_to_plan
Signal that you have gathered enough context and are ready to generate the outline.
Args: {"enriched_instruction": "The original instruction enriched with your research insights"}

## Decision Framework

Follow this process for EVERY request:

**Step 1: Assess the request**
- What type of writing is this? (article, story, essay, report, blog post, etc.)
- Does this topic require factual information from external sources?
- Is this creative/personal writing or factual/informational writing?

**Step 2: Check existing resources**
- ALWAYS call \`get_existing_research\` first — the user may have already gathered materials.
- ALWAYS call \`list_available_skills\` — there may be genre-specific skills that improve quality.

**Step 3: Research if needed**
You MUST call \`deep_research\` if ANY of these are true:
- The user mentions "research", "researched", "research-based", "fact-based", "evidence-based", or similar
- The topic requires factual claims, statistics, dates, or verifiable information
- The topic is about a real-world subject (history, science, technology, current events, etc.)
- Writing an article, report, paper, or informational piece about a specific topic
- You are not confident you have accurate, up-to-date information on the topic

You should NOT research if:
- The user is writing fiction, poetry, or a personal narrative
- The topic is purely creative or opinion-based
- The user explicitly says no research is needed

When researching, break complex topics into 2-3 focused queries for better coverage.

**Step 4: Select skills if appropriate**
After seeing the skills list, select any that match the writing type. Examples:
- "Write a short story" → select the 'story' skill
- "Write a research paper" → select the 'academic' skill  
- No matching skill? That's fine — don't force it.

**Step 5: Signal ready**
Call \`ready_to_plan\` with an enriched version of the instruction that includes any key findings from your research.

## Rules
1. You are the SOLE decision-maker. Think carefully about what the user needs.
2. Be thorough but efficient — max ${MAX_ITERATIONS} turns.
3. Keep your reasoning brief (1-2 sentences), then make tool calls.
4. You MUST end by calling \`ready_to_plan\`.
5. You can call MULTIPLE tools in a single turn by including multiple tool_call blocks.

## Example

User: "Write a researched article about the history of quantum computing"

Your response should look like:

This is a factual article about a real-world topic that requires research. Let me check for existing materials first.

\`\`\`tool_call
{"tool": "get_existing_research", "args": {}}
\`\`\`

\`\`\`tool_call
{"tool": "list_available_skills", "args": {}}
\`\`\``
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
      if (!query) {return { result: 'Error: query argument is required' }}
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
      if (!query) {return { result: 'Error: query argument is required' }}
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
          return {
            result:
              'No existing research found. The user has not uploaded any materials or conducted prior research for this document.',
          }
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
        return {
          result: `Available writing skills (${skills.length}):\n\n${list}\n\nUse select_skills to activate relevant ones.`,
        }
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
      return {
        result: `Unknown tool: ${toolCall.tool}. Available: search_web, deep_research, get_existing_research, list_available_skills, select_skills, ready_to_plan`,
      }
  }
}

// ─────────────────────────── Response Parser ───────────────────────────

/**
 * Parse tool calls from LLM response text.
 * Looks for ```tool_call ... ``` blocks with JSON inside.
 */
function parseToolCalls(text: string): AgentToolCall[] {
  const calls: AgentToolCall[] = []

  // Pattern 0: <longcat_tool_call>tool_call\n{...}\n</tool_call> (openrouter/owl-alpha format)
  // This model wraps tool calls in XML-style tags
  const xmlTagPattern = /<(?:longcat_)?tool_call>\s*(?:tool_call)?\s*\n?([\s\S]*?)<\/tool_call>/g
  let match: RegExpExecArray | null = xmlTagPattern.exec(text)
  while (match !== null) {
    try {
      const jsonStr = match[1].trim()
      const parsed = JSON.parse(jsonStr)
      if (parsed.tool) {
        calls.push({ tool: parsed.tool, args: parsed.args || {} })
      }
    } catch {
      // Malformed JSON inside XML tags — skip
    }
    match = xmlTagPattern.exec(text)
  }

  // Pattern 1: ```tool_call\n{...}\n```
  if (calls.length === 0) {
    const blockPattern = /```tool_call\s*\n?([\s\S]*?)```/g
    match = blockPattern.exec(text)
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
  }

  // Pattern 2: ```json\n{...}\n``` (some models use ```json instead of ```tool_call)
  if (calls.length === 0) {
    const jsonBlockPattern = /```(?:json)?\s*\n?([\s\S]*?)```/g
    match = jsonBlockPattern.exec(text)
    while (match !== null) {
      try {
        const parsed = JSON.parse(match[1].trim())
        if (parsed.tool) {
          calls.push({ tool: parsed.tool, args: parsed.args || {} })
        }
      } catch {
        // Not valid JSON — skip
      }
      match = jsonBlockPattern.exec(text)
    }
  }

  // Pattern 3: Inline JSON — {"tool": "...", "args": {...}} with proper nested brace handling
  if (calls.length === 0) {
    // Find all JSON objects that have a "tool" key, handling nested braces
    const inlinePattern = /\{\s*"tool"\s*:\s*"(\w+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}/g
    match = inlinePattern.exec(text)
    while (match !== null) {
      try {
        const parsed = JSON.parse(match[0])
        if (parsed.tool) {
          calls.push({ tool: parsed.tool, args: parsed.args || {} })
        }
      } catch {
        // Try just the tool name + args separately
        try {
          const args = JSON.parse(match[2])
          calls.push({ tool: match[1], args })
        } catch {
          calls.push({ tool: match[1], args: {} })
        }
      }
      match = inlinePattern.exec(text)
    }
  }

  // Pattern 4: Function-call style — tool_name({...}) or tool_name: {...}
  if (calls.length === 0) {
    const funcPattern =
      /\b(search_web|deep_research|get_existing_research|list_available_skills|select_skills|ready_to_plan)\s*[:(]\s*(\{[^}]*\})/g
    match = funcPattern.exec(text)
    while (match !== null) {
      try {
        const args = JSON.parse(match[2])
        calls.push({ tool: match[1], args: args || {} })
      } catch {
        calls.push({ tool: match[1], args: {} })
      }
      match = funcPattern.exec(text)
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
    message: '🤔 Analyzing your request and deciding what preparation is needed...',
  })

  // Build conversation history for multi-turn tool calling
  // Do NOT pre-judge skills or research — let the LLM decide everything
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: buildPreflightSystemPrompt() },
    {
      role: 'user',
      content: `The user wants to write:\n\n"${instruction}"\n\n${
        composedSkillPrompt
          ? 'The user has already selected writing skills manually. You can skip list_available_skills/select_skills.\n\n'
          : ''
      }${
        existingResearch && existingResearch.entries.length > 0
          ? `There are ${existingResearch.entries.length} existing research entries available. Check them with get_existing_research.\n`
          : ''
      }Analyze this request. Start by checking existing research and available skills, then decide if web research is needed based on the topic.`,
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
    console.log(`[Preflight] LLM response (iteration ${iteration}): ${llmResponse.slice(0, 300)}...`)
    const toolCalls = parseToolCalls(llmResponse)
    console.log(`[Preflight] Parsed ${toolCalls.length} tool calls: ${toolCalls.map(t => t.tool).join(', ') || 'none'}`)

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

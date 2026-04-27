/**
 * Writer Types — Phase 1: Shared type definitions for the LACON writing harness
 *
 * These types are used across main, preload, and renderer processes.
 * They define the core domain model for skills, workspace, and the writer loop.
 */

// ─────────────────────────── Automation Levels ───────────────────────────

/** How much user involvement the writer loop requires */
export type AutomationLevel = 'auto' | 'supervised' | 'manual'

// ─────────────────────────── Skill Types ───────────────────────────

/** Where a skill originated from */
export type SkillSource = 'built-in' | 'user' | 'agent-generated'

/** A writing skill definition — the core unit of genre-aware AI guidance */
export interface WriterSkill {
  /** Unique identifier (slug) */
  id: string
  /** Human-readable name */
  name: string
  /** Short description for the skill library UI */
  description: string
  /** Detailed structural rules, examples, and evaluation criteria (markdown) */
  content: string
  /** Where this skill came from */
  source: SkillSource
  /** ISO timestamp of creation */
  createdAt: string
  /** ISO timestamp of last modification */
  updatedAt: string
  /** Optional evaluation rubric for the Reviewer */
  rubric?: string
  /** Tags for filtering/search */
  tags: string[]
}

/** Summary used in the skill library list (lighter than full WriterSkill) */
export interface SkillListItem {
  id: string
  name: string
  description: string
  source: SkillSource
  tags: string[]
}

/**
 * A composed skill set — up to 3 skills merged with priority ordering.
 * The first skill is the primary, the rest add supplementary rules.
 */
export interface ComposedSkill {
  /** Ordered list of skill IDs (max 3) */
  skillIds: string[]
  /** The merged prompt content ready to send to the LLM */
  composedPrompt: string
  /** Human-readable label for display */
  label: string
}

// ─────────────────────────── Workspace Types ───────────────────────────

/**
 * Project workspace metadata — represents the .lacon/ folder structure
 * associated with a document.
 */
export interface ProjectWorkspace {
  /** Absolute path to the project root directory */
  rootPath: string
  /** Absolute path to the .lacon/ directory */
  laconPath: string
  /** Document ID this workspace belongs to */
  documentId: string
  /** When the workspace was created */
  createdAt: string
}

/**
 * Session state persisted in .lacon/session.json
 */
export interface WriterSession {
  /** Document ID */
  documentId: string
  /** Current automation level */
  automationLevel: AutomationLevel
  /** Active composed skill IDs */
  activeSkillIds: string[]
  /** Word count target (0 = no target) */
  wordTarget: number
  /** Current stage of the writer loop */
  stage: WriterLoopStage
  /** Model provider + model ID for this project */
  modelConfig: ProjectModelConfig
  /** ISO timestamp of last session activity */
  lastActivityAt: string
}

/** Model configuration scoped to a single project */
export interface ProjectModelConfig {
  /** Provider ID (e.g., 'openai', 'anthropic') */
  providerId: string
  /** Model ID (e.g., 'gpt-4o', 'claude-sonnet-4-20250514') */
  modelId: string
}

// ─────────────────────────── Writer Loop Types ───────────────────────────

/** All possible stages of the writer loop state machine */
export type WriterLoopStage =
  | 'idle'
  | 'planning'
  | 'awaiting-outline-approval'
  | 'generating'
  | 'reviewing'
  | 'awaiting-user'
  | 'complete'
  | 'paused'

/** An outline section produced by the Planner */
export interface OutlineSection {
  id: string
  title: string
  keyPoints: string[]
  subsections: OutlineSubsection[]
  estimatedWords: number
}

export interface OutlineSubsection {
  id: string
  title: string
  keyPoints: string[]
  estimatedWords: number
}

/** A complete outline produced by the Planner */
export interface WriterOutline {
  title: string
  sections: OutlineSection[]
  totalEstimatedWords: number
  createdAt: string
}

// ─────────────────────────── Research Context ───────────────────────────

/** A single research entry in the research log */
export interface ResearchEntry {
  id: string
  query: string
  sources: ResearchSource[]
  excerpts: string[]
  createdAt: string
}

export interface ResearchSource {
  url?: string
  filePath?: string
  title: string
  type: 'web' | 'file' | 'manual'
}

/** Read-only research context passed into the writer loop */
export interface ResearchContext {
  entries: ResearchEntry[]
  summary: string
}

// ─────────────────────────── Snapshot Types ───────────────────────────

/** A document snapshot taken at key milestones */
export interface DocumentSnapshot {
  id: string
  documentId: string
  label: string
  content: any // TipTap JSON
  createdAt: string
  trigger: SnapshotTrigger
}

export type SnapshotTrigger = 'outline-approved' | 'before-generation' | 'after-generation' | 'before-review' | 'manual'

// ─────────────────────────── IPC Request/Response Types ───────────────────────────

export interface SkillListRequest {
  /** Optional source filter */
  source?: SkillSource
  /** Optional tag filter */
  tag?: string
}

export interface SkillGetRequest {
  id: string
}

export interface SkillCreateRequest {
  name: string
  description: string
  content: string
  tags: string[]
  rubric?: string
}

export interface SkillComposeRequest {
  /** Ordered skill IDs to compose (max 3) */
  skillIds: string[]
}

export interface SkillResearchRequest {
  /** The genre/topic to research and create a skill for */
  topic: string
}

// ─────────────────────────── Phase 2: Writer Loop IPC Types ───────────────────────────

export interface WriterLoopGetStateRequest {
  documentId: string
}

export interface WriterLoopStartPlanningRequest {
  documentId: string
  instruction: string
  composedSkillPrompt?: string
  researchContext?: ResearchContext
}

export interface WriterLoopGetOutlineRequest {
  documentId: string
}

export interface WriterLoopUpdateOutlineRequest {
  documentId: string
  outline: WriterOutline
}

export interface WriterLoopUpdateSectionRequest {
  documentId: string
  sectionId: string
  updates: Partial<OutlineSection>
}

export interface WriterLoopAddSectionRequest {
  documentId: string
  section?: Partial<OutlineSection>
}

export interface WriterLoopRemoveSectionRequest {
  documentId: string
  sectionId: string
}

export interface WriterLoopAddSubsectionRequest {
  documentId: string
  sectionId: string
  subsection?: Partial<OutlineSubsection>
}

export interface WriterLoopRemoveSubsectionRequest {
  documentId: string
  sectionId: string
  subsectionId: string
}

export interface WriterLoopApproveOutlineRequest {
  documentId: string
  documentContent?: any
}

export interface WriterLoopUpdateConfigRequest {
  documentId: string
  wordTarget?: number
  automationLevel?: AutomationLevel
  activeSkillIds?: string[]
  modelConfig?: ProjectModelConfig
}

export interface WriterLoopTransitionRequest {
  documentId: string
  stage: WriterLoopStage
}

export interface WriterLoopPauseRequest {
  documentId: string
}

export interface WriterLoopResetRequest {
  documentId: string
}

export interface WorkspaceUpdateSessionRequest {
  documentId: string
  updates: Partial<WriterSession>
}

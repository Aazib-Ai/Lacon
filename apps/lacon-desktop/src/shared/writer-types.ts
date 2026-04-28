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

// ─────────────────────────── Phase 3: Generator Types ───────────────────────────

/** Token usage for a single LLM action */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  model: string
  estimatedCost: number
}

/** Result of generating a single section */
export interface GenerationResult {
  sectionId: string
  content: string
  tokenUsage: TokenUsage
  generatedAt: string
}

/** Progress of section-by-section generation */
export interface SectionProgress {
  totalSections: number
  completedSections: number
  currentSectionId: string | null
  currentSectionTitle: string | null
  results: GenerationResult[]
  status: 'idle' | 'generating' | 'paused' | 'complete' | 'error'
  error?: string
}

/** Rolling summary for continuity across sections */
export interface RollingSummary {
  summary: string
  lastUpdated: string
  sectionsCovered: string[]
}

// ─────────────────────────── Phase 4: Reviewer Types ───────────────────────────

/** Severity of a reviewer flag */
export type ReviewSeverity = 'suggestion' | 'warning' | 'error'

/** Category of reviewer feedback */
export type ReviewCategory =
  | 'coherence'
  | 'grammar'
  | 'style'
  | 'structure'
  | 'factual'
  | 'tone'
  | 'redundancy'
  | 'clarity'

/** A single review flag from the Reviewer */
export interface ReviewFlag {
  id: string
  paragraphId: string
  severity: ReviewSeverity
  category: ReviewCategory
  message: string
  suggestedRewrite: string
  originalText: string
}

/** Result of a review pass */
export interface ReviewResult {
  passNumber: number
  flags: ReviewFlag[]
  tokenUsage: TokenUsage
  reviewedAt: string
  structureConflicts: string[]
}

/** A diff chunk for surgical paragraph editing */
export interface DiffChunk {
  type: 'unchanged' | 'added' | 'removed'
  content: string
  lineStart: number
  lineEnd: number
}

/** Diff for a specific paragraph */
export interface ParagraphDiff {
  paragraphId: string
  original: string
  revised: string
  chunks: DiffChunk[]
}

/** Request for a surgical AI edit of a specific paragraph */
export interface SurgicalEditRequest {
  documentId: string
  paragraphId: string
  instruction: string
  fullDocumentContent: any
}

/** Result of a surgical paragraph edit */
export interface SurgicalEditResult {
  paragraphId: string
  originalText: string
  revisedText: string
  diff: ParagraphDiff
  tokenUsage: TokenUsage
}

// ─────────────────────────── Phase 3: Generator IPC Types ───────────────────────────

export interface WriterLoopGenerateSectionRequest {
  documentId: string
  sectionId: string
}

export interface WriterLoopGenerateAllRequest {
  documentId: string
}

export interface WriterLoopGetProgressRequest {
  documentId: string
}

export interface WriterLoopAcceptGenerationRequest {
  documentId: string
  sectionId: string
}

export interface WriterLoopRejectGenerationRequest {
  documentId: string
  sectionId: string
}

// ─────────────────────────── Phase 4: Reviewer IPC Types ───────────────────────────

export interface WriterLoopRunReviewRequest {
  documentId: string
  documentContent: any
}

export interface WriterLoopGetReviewRequest {
  documentId: string
}

export interface WriterLoopAcceptReviewFlagRequest {
  documentId: string
  flagId: string
}

export interface WriterLoopRejectReviewFlagRequest {
  documentId: string
  flagId: string
}

export interface WriterLoopSurgicalEditRequest {
  documentId: string
  paragraphId: string
  instruction: string
  fullDocumentContent: any
}

export interface WriterLoopRewriteAllRequest {
  documentId: string
  instruction: string
  documentContent: any
}

// ─────────────────────────── Phase 5: Research + Citation Types ───────────────────────────

/** Available citation formatting styles */
export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee' | 'inline'

/** Research automation mode */
export type ResearchMode = 'auto' | 'supervised' | 'manual'

/** Extended research entry with section linkage and citation formatting */
export interface ResearchLogEntry {
  id: string
  query: string
  sources: ResearchSource[]
  excerpts: string[]
  /** Section IDs this research is linked to */
  linkedSectionIds: string[]
  /** Tags for filtering */
  tags: string[]
  /** Pre-formatted citation text */
  citationFormatted: string
  /** Research mode used to obtain this entry */
  mode: ResearchMode
  createdAt: string
  updatedAt: string
}

/** The full research log persisted in .lacon/research.json */
export interface ResearchLog {
  entries: ResearchLogEntry[]
  summary: string
  mode: ResearchMode
  citationStyle: CitationStyle
  lastUpdatedAt: string
}

/** Result of a fact-check operation */
export interface FactCheckResult {
  sectionId: string
  confidence: number // 0–1
  supportingSources: FactCheckSource[]
  contradictingSources: FactCheckSource[]
  summary: string
  checkedAt: string
}

export interface FactCheckSource {
  entryId: string
  sourceTitle: string
  excerpt: string
  relevance: number // 0–1
  supports: boolean
}

// ─────────────────────────── Phase 5: Research IPC Types ───────────────────────────

export interface ResearchGetLogRequest {
  documentId: string
}

export interface ResearchAddEntryRequest {
  documentId: string
  query: string
  sources?: ResearchSource[]
  excerpts?: string[]
  linkedSectionIds?: string[]
  tags?: string[]
}

export interface ResearchUpdateEntryRequest {
  documentId: string
  entryId: string
  updates: Partial<ResearchLogEntry>
}

export interface ResearchDeleteEntryRequest {
  documentId: string
  entryId: string
}

export interface ResearchSetModeRequest {
  documentId: string
  mode: ResearchMode
}

export interface ResearchImportFileRequest {
  documentId: string
  filePath: string
  fileType: 'pdf' | 'docx' | 'txt' | 'pptx'
}

export interface ResearchFactCheckRequest {
  documentId: string
  sectionId: string
  sectionContent: string
}

export interface CitationFormatRequest {
  documentId: string
  entryId: string
  style?: CitationStyle
}

export interface CitationGetStyleRequest {
  documentId: string
}

export interface CitationSetStyleRequest {
  documentId: string
  style: CitationStyle
}

// ─────────────────────────── Phase 6: Version + Snapshot Types ───────────────────────────

/** Extended snapshot with optional milestone label */
export interface VersionSnapshot extends DocumentSnapshot {
  milestoneLabel?: string
}

/** Lightweight snapshot summary for list views */
export interface SnapshotListItem {
  id: string
  documentId: string
  label: string
  trigger: SnapshotTrigger
  milestoneLabel?: string
  createdAt: string
}

/** Result of a snapshot restore operation */
export interface RestoreResult {
  restoredSnapshotId: string
  safetySnapshotId: string
  content: any
  restoredAt: string
}

// ─────────────────────────── Phase 6: Version IPC Types ───────────────────────────

export interface VersionListSnapshotsRequest {
  documentId: string
}

export interface VersionGetSnapshotRequest {
  documentId: string
  snapshotId: string
}

export interface VersionRestoreSnapshotRequest {
  documentId: string
  snapshotId: string
  currentContent: any
}

export interface VersionAddMilestoneRequest {
  documentId: string
  snapshotId: string
  label: string
}

export interface VersionDeleteSnapshotRequest {
  documentId: string
  snapshotId: string
}

export interface UxSetZenModeRequest {
  enabled: boolean
}

export interface UxToggleAssistantRequest {
  visible?: boolean
}

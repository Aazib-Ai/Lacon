/**
 * Shared release engineering and operations contracts (Phase 11)
 * Used across main, preload, renderer, and CI-facing automation code.
 */

export type ReleaseChannel = 'stable' | 'beta'

export type TargetPlatform = 'win32' | 'darwin'

export type TargetArch = 'x64' | 'arm64'

export interface ArtifactSignature {
  algorithm: 'sha256' | 'sha512' | 'codesign'
  value: string
  keyId?: string
  issuedAt?: number
}

export interface ReleaseArtifact {
  id: string
  version: string
  channel: ReleaseChannel
  platform: TargetPlatform
  arch: TargetArch
  fileName: string
  filePath: string
  mimeType: string
  sizeBytes: number
  checksumSha256: string
  checksumSha512?: string
  signature?: ArtifactSignature
  signed: boolean
  notarized?: boolean
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface WindowsSigningConfig {
  enabled: boolean
  certificateSubject?: string
  certificateThumbprint?: string
  timestampServerUrl?: string
  digestAlgorithm?: 'sha256' | 'sha1'
}

export interface MacSigningConfig {
  enabled: boolean
  identity?: string
  teamId?: string
  notarizationEnabled: boolean
  appleId?: string
  appSpecificPasswordRef?: string
  ascProvider?: string
}

export interface ArtifactIntegrityResult {
  artifactId: string
  fileName: string
  checksumValid: boolean
  signatureValid: boolean
  notarizationValid?: boolean
  warnings: string[]
  errors: string[]
  verifiedAt: number
}

export interface SignedInstallerPipelineConfig {
  windows: WindowsSigningConfig
  mac: MacSigningConfig
  requireSignedArtifactsForGa: boolean
  allowUnsignedForBeta: boolean
  requiredPlatforms: TargetPlatform[]
  requiredArchitectures: TargetArch[]
}

export interface StagedRollout {
  enabled: boolean
  percentage: number
  cohortKey?: string
  startedAt?: number
  completedAt?: number
}

export interface ChannelPublishConfig {
  channel: ReleaseChannel
  feedUrl: string
  publishUrl: string
  stagedRollout: StagedRollout
  autoPublish: boolean
  requireIntegrityVerification: boolean
}

export interface ChannelPromotionRequest {
  version: string
  fromChannel: ReleaseChannel
  toChannel: ReleaseChannel
  requestedBy: string
  reason: string
  requestedAt: number
}

export interface ChannelPromotionResult {
  approved: boolean
  promotedVersion?: string
  fromChannel: ReleaseChannel
  toChannel: ReleaseChannel
  evidenceArtifactIds: string[]
  notes?: string
  completedAt: number
}

export interface RollbackPlan {
  currentVersion: string
  targetVersion: string
  channel: ReleaseChannel
  reason: string
  initiatedBy: string
  initiatedAt: number
  fastPath: boolean
  clientMinVersion?: string
}

export interface RollbackExecutionResult {
  success: boolean
  currentVersion: string
  rollbackVersion: string
  channel: ReleaseChannel
  affectedPlatforms: TargetPlatform[]
  publishedAt?: number
  completedAt: number
  error?: string
}

export interface ClientRollbackVerification {
  platform: TargetPlatform
  arch: TargetArch
  fromVersion: string
  toVersion: string
  updateFeedRespected: boolean
  rollbackApplied: boolean
  evidence: string[]
  verifiedAt: number
}

export interface DiagnosticBundleFile {
  name: string
  relativePath: string
  bytes: number
  redacted: boolean
}

export interface DiagnosticBundle {
  id: string
  createdAt: number
  appVersion: string
  platform: TargetPlatform
  arch: TargetArch
  files: DiagnosticBundleFile[]
  outputPath: string
  redactionReport: SensitiveDataFilterReport
}

export interface CrashCaptureEvent {
  id: string
  occurredAt: number
  processType: 'main' | 'renderer' | 'gpu' | 'utility' | 'unknown'
  appVersion: string
  platform: TargetPlatform
  reason: string
  message: string
  stack?: string
  diagnosticBundleId?: string
}

export interface SensitiveDataFilterReport {
  redactedFields: string[]
  redactedPatterns: string[]
  redactedCount: number
  hasPotentialLeak: boolean
  notes?: string
}

export type SupportSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4'

export type SupportCategory =
  | 'startup'
  | 'install'
  | 'update'
  | 'rollback'
  | 'performance'
  | 'data-loss'
  | 'provider-integration'
  | 'security'
  | 'billing'
  | 'account-access'
  | 'feature-request'
  | 'documentation'
  | 'other'

export interface SupportTriageTaxonomy {
  categories: SupportCategory[]
  severityDefinitions: Record<SupportSeverity, string>
  defaultCategoryOwners: Partial<Record<SupportCategory, string>>
  routingRules: Array<{
    category: SupportCategory
    keywordMatches: string[]
    assignTo: string
    escalateToSeverity?: SupportSeverity
  }>
}

export interface SupportTicket {
  id: string
  title: string
  category: SupportCategory
  severity: SupportSeverity
  customerImpact: string
  owner: string
  createdAt: number
  updatedAt: number
  status: 'new' | 'triaged' | 'in-progress' | 'resolved' | 'closed'
  linkedIncidentId?: string
  diagnosticBundleId?: string
}

export interface IncidentSeverityLevel {
  level: SupportSeverity
  definition: string
  responseSlaMinutes: number
  updateCadenceMinutes: number
  escalationRequired: boolean
}

export interface EscalationRule {
  severity: SupportSeverity
  primaryOwner: string
  secondaryOwner?: string
  executiveNotify: boolean
  escalationAfterMinutes: number
}

export interface GateReviewCheck {
  name: string
  passed: boolean
  evidence: string[]
  notes?: string
}

export interface ReleaseCandidateGateReview {
  version: string
  channel: ReleaseChannel
  reviewedAt: number
  reviewedBy: string
  functional: GateReviewCheck[]
  security: GateReviewCheck[]
  performance: GateReviewCheck[]
  approvedForGa: boolean
}

export interface GaChecklistItem {
  id: string
  label: string
  completed: boolean
  completedBy?: string
  completedAt?: number
  evidence?: string[]
  notes?: string
}

export interface GaLaunchChecklist {
  version: string
  createdAt: number
  items: GaChecklistItem[]
  signOffRequiredBy: string[]
  signOffs: SignOffRecord[]
  fullyApproved: boolean
}

export interface SignOffRecord {
  owner: string
  role: string
  approved: boolean
  approvedAt?: number
  notes?: string
}

export interface RollbackRunbookStep {
  id: string
  title: string
  description: string
  ownerRole: string
  required: boolean
  evidenceRequired: boolean
}

export interface RollbackRunbook {
  id: string
  name: string
  channel: ReleaseChannel
  appliesToPlatforms: TargetPlatform[]
  appliesToArchitectures: TargetArch[]
  preChecks: RollbackRunbookStep[]
  executionSteps: RollbackRunbookStep[]
  postValidationSteps: RollbackRunbookStep[]
  communicationSteps: RollbackRunbookStep[]
  maxExecutionWindowMinutes: number
  requiresIncidentTicket: boolean
  lastReviewedAt?: number
  reviewedBy?: string
}

export interface RollbackDrillRecord {
  id: string
  runbookId: string
  channel: ReleaseChannel
  executedAt: number
  executedBy: string
  fromVersion: string
  toVersion: string
  success: boolean
  durationMinutes: number
  evidence: string[]
  issuesFound: string[]
  followUps: string[]
}

export interface ReleaseAuditRecord {
  id: string
  version: string
  channel: ReleaseChannel
  generatedAt: number
  artifacts: ReleaseArtifact[]
  integrityResults: ArtifactIntegrityResult[]
  gateReview: ReleaseCandidateGateReview
  gaChecklist: GaLaunchChecklist
  rollbackPlan: RollbackPlan
  rollbackRunbook?: RollbackRunbook
  rollbackDrill?: RollbackDrillRecord
}

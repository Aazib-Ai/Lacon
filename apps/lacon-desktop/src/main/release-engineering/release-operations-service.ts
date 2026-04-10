/**
 * Phase 11: Release Engineering and GA Launch
 * Service responsible for signed artifact validation, channel pipelines,
 * rollback controls, diagnostics bundles, and GA gate/checklist management.
 */

import { createHash, randomUUID } from 'crypto'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

import type {
  ArtifactIntegrityResult,
  ChannelPromotionRequest,
  ChannelPromotionResult,
  ClientRollbackVerification,
  CrashCaptureEvent,
  DiagnosticBundle,
  DiagnosticBundleFile,
  EscalationRule,
  GaChecklistItem,
  GaLaunchChecklist,
  GateReviewCheck,
  IncidentSeverityLevel,
  ReleaseArtifact,
  ReleaseAuditRecord,
  ReleaseCandidateGateReview,
  ReleaseChannel,
  RollbackDrillRecord,
  RollbackExecutionResult,
  RollbackPlan,
  RollbackRunbook,
  RollbackRunbookStep,
  SensitiveDataFilterReport,
  SignedInstallerPipelineConfig,
  SignOffRecord,
  StagedRollout,
  SupportTicket,
  SupportTriageTaxonomy,
  TargetArch,
  TargetPlatform,
} from '../../shared/release-types'
import { redactObject } from '../security/log-redaction'

type ReleaseManifest = {
  version: string
  channel: ReleaseChannel
  publishedAt: number
  feedUrl: string
  artifacts: ReleaseArtifact[]
  stagedRollout?: StagedRollout
}

const RELEASE_DATA_DIR = 'release'
const ARTIFACTS_DIR = 'artifacts'
const MANIFESTS_DIR = 'manifests'
const DIAGNOSTICS_DIR = 'diagnostics'
const AUDITS_DIR = 'audits'
const ROLLBACKS_DIR = 'rollbacks'
const GA_DIR = 'ga'

const ROLLBACK_VERIFICATION_INDEX_FILE = 'rollback-verification-index.json'
const CRASH_EVENTS_FILE = 'crash-events.json'
const SUPPORT_TICKETS_FILE = 'support-tickets.json'
const ROLLBACK_RUNBOOKS_FILE = 'rollback-runbooks.json'
const ROLLBACK_DRILLS_FILE = 'rollback-drills.json'
const SUPPORT_TAXONOMY_FILE = 'support-taxonomy.json'

const DEFAULT_PIPELINE_CONFIG: SignedInstallerPipelineConfig = {
  windows: {
    enabled: false,
    digestAlgorithm: 'sha256',
  },
  mac: {
    enabled: false,
    notarizationEnabled: false,
  },
  requireSignedArtifactsForGa: true,
  allowUnsignedForBeta: true,
  requiredPlatforms: ['win32', 'darwin'],
  requiredArchitectures: ['x64', 'arm64'],
}

const DEFAULT_GA_ITEMS: Array<Pick<GaChecklistItem, 'id' | 'label'>> = [
  { id: 'docs-complete', label: 'Documentation complete' },
  { id: 'known-issues-published', label: 'Known issues published' },
  { id: 'launch-communication-complete', label: 'Launch communication complete' },
  { id: 'signed-installers-validated', label: 'Signed installers validated' },
  { id: 'staged-rollout-validated', label: 'Staged rollout validated' },
  { id: 'rollback-drill-complete', label: 'Rollback drill completed' },
  { id: 'support-runbooks-ready', label: 'Support and incident runbooks finalized' },
]

export class ReleaseOperationsService {
  private readonly rootPath: string
  private readonly artifactsPath: string
  private readonly manifestsPath: string
  private readonly diagnosticsPath: string
  private readonly auditsPath: string
  private readonly rollbacksPath: string
  private readonly gaPath: string

  private initialized = false
  private pipelineConfig: SignedInstallerPipelineConfig = { ...DEFAULT_PIPELINE_CONFIG }

  constructor(basePath?: string) {
    const userData = basePath ?? app.getPath('userData')
    this.rootPath = join(userData, RELEASE_DATA_DIR)
    this.artifactsPath = join(this.rootPath, ARTIFACTS_DIR)
    this.manifestsPath = join(this.rootPath, MANIFESTS_DIR)
    this.diagnosticsPath = join(this.rootPath, DIAGNOSTICS_DIR)
    this.auditsPath = join(this.rootPath, AUDITS_DIR)
    this.rollbacksPath = join(this.rootPath, ROLLBACKS_DIR)
    this.gaPath = join(this.rootPath, GA_DIR)
  }

  async initialize(config?: Partial<SignedInstallerPipelineConfig>): Promise<void> {
    if (this.initialized) {
      return
    }

    this.ensureDir(this.rootPath)
    this.ensureDir(this.artifactsPath)
    this.ensureDir(this.manifestsPath)
    this.ensureDir(this.diagnosticsPath)
    this.ensureDir(this.auditsPath)
    this.ensureDir(this.rollbacksPath)
    this.ensureDir(this.gaPath)

    if (config) {
      this.pipelineConfig = this.mergeConfig(config)
    }

    this.ensureJsonFile(join(this.rollbacksPath, ROLLBACK_VERIFICATION_INDEX_FILE), [])
    this.ensureJsonFile(join(this.rootPath, CRASH_EVENTS_FILE), [])
    this.ensureJsonFile(join(this.rootPath, SUPPORT_TICKETS_FILE), [])
    this.ensureJsonFile(join(this.rollbacksPath, ROLLBACK_RUNBOOKS_FILE), [])
    this.ensureJsonFile(join(this.rollbacksPath, ROLLBACK_DRILLS_FILE), [])
    this.ensureJsonFile(join(this.rootPath, SUPPORT_TAXONOMY_FILE), this.defaultSupportTriageTaxonomy())

    this.initialized = true
  }

  setPipelineConfig(config: Partial<SignedInstallerPipelineConfig>): SignedInstallerPipelineConfig {
    this.ensureInitialized()
    this.pipelineConfig = this.mergeConfig(config)
    return this.pipelineConfig
  }

  getPipelineConfig(): SignedInstallerPipelineConfig {
    this.ensureInitialized()
    return this.pipelineConfig
  }

  registerArtifact(
    filePath: string,
    params: {
      version: string
      channel: ReleaseChannel
      platform: TargetPlatform
      arch: TargetArch
      signed?: boolean
      notarized?: boolean
      signature?: ReleaseArtifact['signature']
      metadata?: Record<string, unknown>
    },
  ): ReleaseArtifact {
    this.ensureInitialized()

    if (!existsSync(filePath)) {
      throw new Error(`Artifact file not found: ${filePath}`)
    }

    const data = readFileSync(filePath)
    const stats = statSync(filePath)
    const fileName = filePath.split(/[\\/]/).pop() || `${params.version}-${params.platform}-${params.arch}.bin`

    const artifact: ReleaseArtifact = {
      id: randomUUID(),
      version: params.version,
      channel: params.channel,
      platform: params.platform,
      arch: params.arch,
      fileName,
      filePath,
      mimeType: this.resolveMimeType(fileName),
      sizeBytes: stats.size,
      checksumSha256: createHash('sha256').update(data).digest('hex'),
      checksumSha512: createHash('sha512').update(data).digest('hex'),
      signature: params.signature,
      signed: Boolean(params.signed),
      notarized: params.notarized,
      createdAt: Date.now(),
      metadata: params.metadata,
    }

    const outFile = join(this.artifactsPath, `${artifact.id}.json`)
    this.writeJson(outFile, artifact)
    return artifact
  }

  verifyArtifactIntegrity(artifact: ReleaseArtifact): ArtifactIntegrityResult {
    this.ensureInitialized()

    const errors: string[] = []
    const warnings: string[] = []

    let checksumValid = false
    let signatureValid = false
    let notarizationValid: boolean | undefined

    if (!existsSync(artifact.filePath)) {
      errors.push(`Artifact file missing: ${artifact.filePath}`)
    } else {
      const data = readFileSync(artifact.filePath)
      const computedSha256 = createHash('sha256').update(data).digest('hex')
      checksumValid = computedSha256 === artifact.checksumSha256
      if (!checksumValid) {
        errors.push('SHA-256 checksum mismatch')
      }
    }

    signatureValid = this.validateArtifactSigning(artifact)
    if (!signatureValid) {
      errors.push('Signature validation failed')
    }

    if (artifact.platform === 'darwin') {
      notarizationValid = Boolean(artifact.notarized)
      if (!notarizationValid) {
        warnings.push('macOS artifact is not notarized')
      }
    }

    if (artifact.channel === 'stable' && this.pipelineConfig.requireSignedArtifactsForGa && !artifact.signed) {
      errors.push('Stable/GA artifact must be signed')
    }

    const result: ArtifactIntegrityResult = {
      artifactId: artifact.id,
      fileName: artifact.fileName,
      checksumValid,
      signatureValid,
      notarizationValid,
      warnings,
      errors,
      verifiedAt: Date.now(),
    }

    return result
  }

  publishChannelManifest(config: {
    version: string
    channel: ReleaseChannel
    feedUrl: string
    artifacts: ReleaseArtifact[]
    stagedRollout?: StagedRollout
  }): ReleaseManifest {
    this.ensureInitialized()

    const integrityResults = config.artifacts.map(artifact => this.verifyArtifactIntegrity(artifact))
    const hasIntegrityFailure = integrityResults.some(r => !r.checksumValid || !r.signatureValid)

    if (hasIntegrityFailure) {
      throw new Error('Cannot publish manifest with failing artifact integrity checks')
    }

    if (config.channel === 'stable') {
      this.assertGaArtifactCoverage(config.artifacts)
    }

    const manifest: ReleaseManifest = {
      version: config.version,
      channel: config.channel,
      publishedAt: Date.now(),
      feedUrl: config.feedUrl,
      artifacts: config.artifacts,
      stagedRollout: config.stagedRollout,
    }

    const filePath = join(this.manifestsPath, `${config.channel}.json`)
    this.writeJson(filePath, manifest)
    return manifest
  }

  promoteChannel(request: ChannelPromotionRequest): ChannelPromotionResult {
    this.ensureInitialized()

    if (request.fromChannel === request.toChannel) {
      throw new Error('fromChannel and toChannel must be different')
    }

    const fromManifest = this.readManifest(request.fromChannel)
    if (!fromManifest) {
      throw new Error(`No source manifest found for channel ${request.fromChannel}`)
    }

    if (fromManifest.version !== request.version) {
      throw new Error(`Version ${request.version} not found in source channel ${request.fromChannel}`)
    }

    const promoted = this.publishChannelManifest({
      version: fromManifest.version,
      channel: request.toChannel,
      feedUrl: fromManifest.feedUrl.replace(request.fromChannel, request.toChannel),
      artifacts: fromManifest.artifacts.map(a => ({ ...a, channel: request.toChannel })),
      stagedRollout:
        request.toChannel === 'stable'
          ? { enabled: true, percentage: 10, cohortKey: 'stable-canary', startedAt: Date.now() }
          : fromManifest.stagedRollout,
    })

    return {
      approved: true,
      promotedVersion: promoted.version,
      fromChannel: request.fromChannel,
      toChannel: request.toChannel,
      evidenceArtifactIds: promoted.artifacts.map(a => a.id),
      notes: `Promoted by ${request.requestedBy}. Reason: ${request.reason}`,
      completedAt: Date.now(),
    }
  }

  executeRollback(plan: RollbackPlan): RollbackExecutionResult {
    this.ensureInitialized()

    const targetManifest = this.findManifestByVersion(plan.targetVersion, plan.channel)
    if (!targetManifest) {
      return {
        success: false,
        currentVersion: plan.currentVersion,
        rollbackVersion: plan.targetVersion,
        channel: plan.channel,
        affectedPlatforms: [],
        completedAt: Date.now(),
        error: 'Target rollback version manifest not found',
      }
    }

    const outputManifest: ReleaseManifest = {
      ...targetManifest,
      publishedAt: Date.now(),
      stagedRollout: plan.fastPath
        ? {
            enabled: true,
            percentage: 100,
            cohortKey: 'rollback-fastpath',
            startedAt: Date.now(),
            completedAt: Date.now(),
          }
        : targetManifest.stagedRollout,
    }

    this.writeJson(join(this.manifestsPath, `${plan.channel}.json`), outputManifest)

    const recordPath = join(this.rollbacksPath, `${plan.channel}-${Date.now()}.json`)
    this.writeJson(recordPath, plan)

    const platforms = Array.from(new Set(outputManifest.artifacts.map(a => a.platform)))

    return {
      success: true,
      currentVersion: plan.currentVersion,
      rollbackVersion: plan.targetVersion,
      channel: plan.channel,
      affectedPlatforms: platforms,
      publishedAt: outputManifest.publishedAt,
      completedAt: Date.now(),
    }
  }

  recordClientRollbackVerification(entry: ClientRollbackVerification): ClientRollbackVerification[] {
    this.ensureInitialized()
    const file = join(this.rollbacksPath, ROLLBACK_VERIFICATION_INDEX_FILE)
    const current = this.readJson<ClientRollbackVerification[]>(file, [])
    const next = [...current, entry]
    this.writeJson(file, next)
    return next
  }

  captureCrashEvent(event: Omit<CrashCaptureEvent, 'id' | 'occurredAt'>): CrashCaptureEvent {
    this.ensureInitialized()
    const entry: CrashCaptureEvent = {
      ...event,
      id: randomUUID(),
      occurredAt: Date.now(),
      message: this.safeRedactText(event.message),
      stack: event.stack ? this.safeRedactText(event.stack) : undefined,
    }

    const file = join(this.rootPath, CRASH_EVENTS_FILE)
    const events = this.readJson<CrashCaptureEvent[]>(file, [])
    events.push(entry)
    this.writeJson(file, events)

    return entry
  }

  createDiagnosticBundle(params: {
    appVersion: string
    platform: TargetPlatform
    arch: TargetArch
    sourceFiles: string[]
  }): DiagnosticBundle {
    this.ensureInitialized()

    const bundleId = randomUUID()
    const bundleDir = join(this.diagnosticsPath, bundleId)
    this.ensureDir(bundleDir)

    const files: DiagnosticBundleFile[] = []
    let totalRedactions = 0
    const redactedFields = new Set<string>()

    for (const sourceFile of params.sourceFiles) {
      if (!existsSync(sourceFile)) {
        continue
      }

      const fileName = sourceFile.split(/[\\/]/).pop() || randomUUID()
      const outPath = join(bundleDir, fileName)
      const content = readFileSync(sourceFile, 'utf-8')
      const redacted = redactObject({ content }) as { content: string }

      if (redacted.content !== content) {
        totalRedactions += 1
        redactedFields.add(fileName)
      }

      writeFileSync(outPath, redacted.content, 'utf-8')
      files.push({
        name: fileName,
        relativePath: fileName,
        bytes: Buffer.byteLength(redacted.content),
        redacted: redacted.content !== content,
      })
    }

    const redactionReport: SensitiveDataFilterReport = {
      redactedFields: [...redactedFields],
      redactedPatterns: totalRedactions > 0 ? ['sensitive-content-pattern'] : [],
      redactedCount: totalRedactions,
      hasPotentialLeak: false,
    }

    const bundle: DiagnosticBundle = {
      id: bundleId,
      createdAt: Date.now(),
      appVersion: params.appVersion,
      platform: params.platform,
      arch: params.arch,
      files,
      outputPath: bundleDir,
      redactionReport,
    }

    this.writeJson(join(bundleDir, 'bundle.json'), bundle)
    return bundle
  }

  createReleaseCandidateGateReview(input: {
    version: string
    channel: ReleaseChannel
    reviewedBy: string
    functional: GateReviewCheck[]
    security: GateReviewCheck[]
    performance: GateReviewCheck[]
  }): ReleaseCandidateGateReview {
    this.ensureInitialized()

    const allChecks = [...input.functional, ...input.security, ...input.performance]
    const approvedForGa = allChecks.length > 0 && allChecks.every(check => check.passed)

    return {
      version: input.version,
      channel: input.channel,
      reviewedAt: Date.now(),
      reviewedBy: input.reviewedBy,
      functional: input.functional,
      security: input.security,
      performance: input.performance,
      approvedForGa,
    }
  }

  createGaChecklist(version: string, signOffRequiredBy: string[]): GaLaunchChecklist {
    this.ensureInitialized()

    const items: GaChecklistItem[] = DEFAULT_GA_ITEMS.map(item => ({
      id: item.id,
      label: item.label,
      completed: false,
    }))

    const checklist: GaLaunchChecklist = {
      version,
      createdAt: Date.now(),
      items,
      signOffRequiredBy,
      signOffs: [],
      fullyApproved: false,
    }

    this.writeJson(join(this.gaPath, `${version}-checklist.json`), checklist)
    return checklist
  }

  completeGaChecklistItem(
    version: string,
    itemId: string,
    completedBy: string,
    evidence?: string[],
    notes?: string,
  ): GaLaunchChecklist {
    this.ensureInitialized()
    const checklist = this.getGaChecklist(version)

    checklist.items = checklist.items.map(item =>
      item.id === itemId
        ? {
            ...item,
            completed: true,
            completedBy,
            completedAt: Date.now(),
            evidence: evidence ?? item.evidence,
            notes: notes ?? item.notes,
          }
        : item,
    )

    checklist.fullyApproved = this.computeGaApproval(checklist)
    this.writeJson(join(this.gaPath, `${version}-checklist.json`), checklist)
    return checklist
  }

  signOffGa(version: string, signOff: SignOffRecord): GaLaunchChecklist {
    this.ensureInitialized()
    const checklist = this.getGaChecklist(version)

    const existingIndex = checklist.signOffs.findIndex(s => s.owner === signOff.owner)
    const normalized: SignOffRecord = {
      ...signOff,
      approvedAt: signOff.approved ? Date.now() : signOff.approvedAt,
    }

    if (existingIndex >= 0) {
      checklist.signOffs[existingIndex] = normalized
    } else {
      checklist.signOffs.push(normalized)
    }

    checklist.fullyApproved = this.computeGaApproval(checklist)
    this.writeJson(join(this.gaPath, `${version}-checklist.json`), checklist)
    return checklist
  }

  buildReleaseAuditRecord(input: {
    version: string
    channel: ReleaseChannel
    artifacts: ReleaseArtifact[]
    gateReview: ReleaseCandidateGateReview
    gaChecklist: GaLaunchChecklist
    rollbackPlan: RollbackPlan
  }): ReleaseAuditRecord {
    this.ensureInitialized()

    const integrityResults = input.artifacts.map(artifact => this.verifyArtifactIntegrity(artifact))
    const record: ReleaseAuditRecord = {
      id: randomUUID(),
      version: input.version,
      channel: input.channel,
      generatedAt: Date.now(),
      artifacts: input.artifacts,
      integrityResults,
      gateReview: input.gateReview,
      gaChecklist: input.gaChecklist,
      rollbackPlan: input.rollbackPlan,
    }

    this.writeJson(join(this.auditsPath, `${record.id}.json`), record)
    return record
  }

  defaultIncidentSeverityMatrix(): IncidentSeverityLevel[] {
    return [
      {
        level: 'sev1',
        definition: 'Critical outage / data loss',
        responseSlaMinutes: 15,
        updateCadenceMinutes: 30,
        escalationRequired: true,
      },
      {
        level: 'sev2',
        definition: 'Major degradation / blocked workflows',
        responseSlaMinutes: 30,
        updateCadenceMinutes: 60,
        escalationRequired: true,
      },
      {
        level: 'sev3',
        definition: 'Partial impact / workaround available',
        responseSlaMinutes: 120,
        updateCadenceMinutes: 240,
        escalationRequired: false,
      },
      {
        level: 'sev4',
        definition: 'Minor issue / low impact',
        responseSlaMinutes: 480,
        updateCadenceMinutes: 1440,
        escalationRequired: false,
      },
    ]
  }

  defaultEscalationMatrix(): EscalationRule[] {
    return [
      {
        severity: 'sev1',
        primaryOwner: 'oncall-engineer',
        secondaryOwner: 'engineering-manager',
        executiveNotify: true,
        escalationAfterMinutes: 15,
      },
      {
        severity: 'sev2',
        primaryOwner: 'oncall-engineer',
        secondaryOwner: 'team-lead',
        executiveNotify: false,
        escalationAfterMinutes: 30,
      },
      {
        severity: 'sev3',
        primaryOwner: 'support-lead',
        secondaryOwner: 'product-manager',
        executiveNotify: false,
        escalationAfterMinutes: 120,
      },
      { severity: 'sev4', primaryOwner: 'support', executiveNotify: false, escalationAfterMinutes: 480 },
    ]
  }

  createSupportTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>): SupportTicket {
    this.ensureInitialized()
    const created: SupportTicket = {
      ...ticket,
      id: randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const file = join(this.rootPath, SUPPORT_TICKETS_FILE)
    const current = this.readJson<SupportTicket[]>(file, [])
    current.push(created)
    this.writeJson(file, current)
    return created
  }

  setSupportTriageTaxonomy(taxonomy: SupportTriageTaxonomy): SupportTriageTaxonomy {
    this.ensureInitialized()
    this.writeJson(join(this.rootPath, SUPPORT_TAXONOMY_FILE), taxonomy)
    return taxonomy
  }

  getSupportTriageTaxonomy(): SupportTriageTaxonomy {
    this.ensureInitialized()
    return this.readJson<SupportTriageTaxonomy>(
      join(this.rootPath, SUPPORT_TAXONOMY_FILE),
      this.defaultSupportTriageTaxonomy(),
    )
  }

  createRollbackRunbook(input: Omit<RollbackRunbook, 'id'>): RollbackRunbook {
    this.ensureInitialized()
    const runbook: RollbackRunbook = {
      ...input,
      id: randomUUID(),
    }

    const file = join(this.rollbacksPath, ROLLBACK_RUNBOOKS_FILE)
    const runbooks = this.readJson<RollbackRunbook[]>(file, [])
    runbooks.push(runbook)
    this.writeJson(file, runbooks)

    return runbook
  }

  listRollbackRunbooks(): RollbackRunbook[] {
    this.ensureInitialized()
    return this.readJson<RollbackRunbook[]>(join(this.rollbacksPath, ROLLBACK_RUNBOOKS_FILE), [])
  }

  recordRollbackDrill(input: Omit<RollbackDrillRecord, 'id'>): RollbackDrillRecord {
    this.ensureInitialized()
    const drillsFile = join(this.rollbacksPath, ROLLBACK_DRILLS_FILE)
    const drill: RollbackDrillRecord = {
      ...input,
      id: randomUUID(),
    }

    const drills = this.readJson<RollbackDrillRecord[]>(drillsFile, [])
    drills.push(drill)
    this.writeJson(drillsFile, drills)

    return drill
  }

  listRollbackDrills(): RollbackDrillRecord[] {
    this.ensureInitialized()
    return this.readJson<RollbackDrillRecord[]>(join(this.rollbacksPath, ROLLBACK_DRILLS_FILE), [])
  }

  private getGaChecklist(version: string): GaLaunchChecklist {
    const file = join(this.gaPath, `${version}-checklist.json`)
    if (!existsSync(file)) {
      throw new Error(`GA checklist not found for version ${version}`)
    }
    return this.readJson<GaLaunchChecklist>(file)
  }

  private computeGaApproval(checklist: GaLaunchChecklist): boolean {
    const itemsDone = checklist.items.every(i => i.completed)
    const requiredSignOffs = checklist.signOffRequiredBy.every(owner =>
      checklist.signOffs.some(s => s.owner === owner && s.approved),
    )
    return itemsDone && requiredSignOffs
  }

  private findManifestByVersion(version: string, channel: ReleaseChannel): ReleaseManifest | null {
    const manifest = this.readManifest(channel)
    if (!manifest) {
      return null
    }
    return manifest.version === version ? manifest : null
  }

  private readManifest(channel: ReleaseChannel): ReleaseManifest | null {
    const file = join(this.manifestsPath, `${channel}.json`)
    if (!existsSync(file)) {
      return null
    }
    return this.readJson<ReleaseManifest>(file)
  }

  private assertGaArtifactCoverage(artifacts: ReleaseArtifact[]): void {
    for (const platform of this.pipelineConfig.requiredPlatforms) {
      for (const arch of this.pipelineConfig.requiredArchitectures) {
        const found = artifacts.find(a => a.platform === platform && a.arch === arch)
        if (!found) {
          throw new Error(`GA publish blocked: missing artifact for ${platform}/${arch}`)
        }
      }
    }
  }

  private validateArtifactSigning(artifact: ReleaseArtifact): boolean {
    if (artifact.channel === 'beta' && this.pipelineConfig.allowUnsignedForBeta) {
      return true
    }

    if (artifact.platform === 'win32') {
      return this.pipelineConfig.windows.enabled
        ? Boolean(artifact.signed && artifact.signature)
        : Boolean(artifact.signed)
    }

    if (artifact.platform === 'darwin') {
      if (!this.pipelineConfig.mac.enabled) {
        return Boolean(artifact.signed)
      }
      if (this.pipelineConfig.mac.notarizationEnabled) {
        return Boolean(artifact.signed && artifact.notarized)
      }
      return Boolean(artifact.signed)
    }

    return Boolean(artifact.signed)
  }

  private resolveMimeType(fileName: string): string {
    if (fileName.endsWith('.dmg')) {
      return 'application/x-apple-diskimage'
    }
    if (fileName.endsWith('.exe')) {
      return 'application/vnd.microsoft.portable-executable'
    }
    if (fileName.endsWith('.zip')) {
      return 'application/zip'
    }
    if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
      return 'text/yaml'
    }
    return 'application/octet-stream'
  }

  private mergeConfig(config: Partial<SignedInstallerPipelineConfig>): SignedInstallerPipelineConfig {
    return {
      windows: { ...this.pipelineConfig.windows, ...(config.windows ?? {}) },
      mac: { ...this.pipelineConfig.mac, ...(config.mac ?? {}) },
      requireSignedArtifactsForGa:
        config.requireSignedArtifactsForGa ?? this.pipelineConfig.requireSignedArtifactsForGa,
      allowUnsignedForBeta: config.allowUnsignedForBeta ?? this.pipelineConfig.allowUnsignedForBeta,
      requiredPlatforms: config.requiredPlatforms ?? this.pipelineConfig.requiredPlatforms,
      requiredArchitectures: config.requiredArchitectures ?? this.pipelineConfig.requiredArchitectures,
    }
  }

  private defaultSupportTriageTaxonomy(): SupportTriageTaxonomy {
    return {
      categories: [
        'startup',
        'install',
        'update',
        'rollback',
        'performance',
        'data-loss',
        'provider-integration',
        'security',
        'billing',
        'account-access',
        'feature-request',
        'documentation',
        'other',
      ],
      severityDefinitions: {
        sev1: 'Critical impact: outage, severe data loss, or security incident',
        sev2: 'Major impact: core workflows blocked or heavily degraded',
        sev3: 'Moderate impact: workaround exists and partial functionality available',
        sev4: 'Low impact: minor issue, cosmetic bug, or question',
      },
      defaultCategoryOwners: {
        startup: 'desktop-runtime-team',
        install: 'release-engineering',
        update: 'release-engineering',
        rollback: 'release-engineering',
        performance: 'desktop-performance-team',
        'data-loss': 'storage-reliability-team',
        'provider-integration': 'providers-platform-team',
        security: 'security-response-team',
        billing: 'support-operations',
        'account-access': 'support-operations',
        'feature-request': 'product-team',
        documentation: 'docs-team',
        other: 'support-triage',
      },
      routingRules: [
        {
          category: 'security',
          keywordMatches: ['leak', 'breach', 'token exposed', 'credential', 'vulnerability'],
          assignTo: 'security-response-team',
          escalateToSeverity: 'sev1',
        },
        {
          category: 'data-loss',
          keywordMatches: ['lost document', 'missing content', 'recovery failed', 'corrupted'],
          assignTo: 'storage-reliability-team',
          escalateToSeverity: 'sev1',
        },
        {
          category: 'rollback',
          keywordMatches: ['rollback', 'downgrade', 'bad release'],
          assignTo: 'release-engineering',
          escalateToSeverity: 'sev2',
        },
        {
          category: 'update',
          keywordMatches: ['auto-update failed', 'cannot update', 'update loop'],
          assignTo: 'release-engineering',
          escalateToSeverity: 'sev2',
        },
      ],
    }
  }

  defaultRollbackRunbookTemplate(channel: ReleaseChannel): Omit<RollbackRunbook, 'id'> {
    const preChecks: RollbackRunbookStep[] = [
      {
        id: 'pre-1',
        title: 'Confirm incident severity and rollback trigger',
        description: 'Validate that incident conditions meet rollback threshold and obtain incident command approval.',
        ownerRole: 'incident-commander',
        required: true,
        evidenceRequired: true,
      },
      {
        id: 'pre-2',
        title: 'Identify target rollback version',
        description: 'Select last known good version for the same release channel and verify artifacts exist.',
        ownerRole: 'release-engineer',
        required: true,
        evidenceRequired: true,
      },
    ]

    const executionSteps: RollbackRunbookStep[] = [
      {
        id: 'exec-1',
        title: 'Publish rollback manifest',
        description: 'Publish target version to active channel using fast-path if customer impact is ongoing.',
        ownerRole: 'release-engineer',
        required: true,
        evidenceRequired: true,
      },
      {
        id: 'exec-2',
        title: 'Enable updater downgrade behavior',
        description: 'Ensure client updater downgrade/rollback path is active for impacted cohorts.',
        ownerRole: 'desktop-runtime-oncall',
        required: true,
        evidenceRequired: true,
      },
    ]

    const postValidationSteps: RollbackRunbookStep[] = [
      {
        id: 'post-1',
        title: 'Verify client rollback behavior',
        description: 'Validate rollback applied on representative Windows and macOS targets.',
        ownerRole: 'qa-release',
        required: true,
        evidenceRequired: true,
      },
      {
        id: 'post-2',
        title: 'Confirm incident mitigation',
        description: 'Confirm key error rates and support ticket volume return to baseline.',
        ownerRole: 'incident-commander',
        required: true,
        evidenceRequired: true,
      },
    ]

    const communicationSteps: RollbackRunbookStep[] = [
      {
        id: 'comm-1',
        title: 'Notify support and customer success',
        description: 'Share rollback status, affected versions, and customer guidance.',
        ownerRole: 'support-lead',
        required: true,
        evidenceRequired: false,
      },
      {
        id: 'comm-2',
        title: 'Publish external status update',
        description: 'Post concise incident update including mitigation and next expected update.',
        ownerRole: 'incident-communications',
        required: true,
        evidenceRequired: true,
      },
    ]

    return {
      name: `${channel.toUpperCase()} Rollback Runbook`,
      channel,
      appliesToPlatforms: ['win32', 'darwin'],
      appliesToArchitectures: ['x64', 'arm64'],
      preChecks,
      executionSteps,
      postValidationSteps,
      communicationSteps,
      maxExecutionWindowMinutes: 60,
      requiresIncidentTicket: true,
      lastReviewedAt: Date.now(),
      reviewedBy: 'release-engineering',
    }
  }

  private safeRedactText(value: string): string {
    const redacted = redactObject({ value }) as { value: string }
    return redacted.value
  }

  private ensureDir(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true })
    }
  }

  private ensureJsonFile(path: string, initialValue: unknown): void {
    if (!existsSync(path)) {
      this.writeJson(path, initialValue)
    }
  }

  private readJson<T>(path: string, fallback?: T): T {
    if (!existsSync(path)) {
      if (fallback !== undefined) {
        return fallback
      }
      throw new Error(`JSON file not found: ${path}`)
    }
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content) as T
  }

  private writeJson(path: string, value: unknown): void {
    writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8')
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ReleaseOperationsService not initialized. Call initialize() first.')
    }
  }
}

let releaseOperationsService: ReleaseOperationsService | null = null

/**
 * Get or create singleton ReleaseOperationsService instance.
 * Keeps release state consistent across IPC handlers and main process services.
 */
export function getReleaseOperationsService(basePath?: string): ReleaseOperationsService {
  if (!releaseOperationsService) {
    releaseOperationsService = new ReleaseOperationsService(basePath)
  }
  return releaseOperationsService
}

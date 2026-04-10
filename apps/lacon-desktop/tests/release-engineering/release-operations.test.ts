/**
 * Phase 11: Release Engineering and GA Launch
 * Tests signing/integrity validation, channel publish/promotion, rollback controls,
 * diagnostics redaction, and GA checklist/sign-off flows.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ReleaseOperationsService } from '../../src/main/release-engineering/release-operations-service'
import type { ReleaseArtifact, RollbackPlan } from '../../src/shared/release-types'

describe('ReleaseOperationsService (Phase 11)', () => {
  const testRoot = '/tmp/lacon-release-tests'
  const artifactsRoot = join(testRoot, 'artifacts-fixtures')

  let service: ReleaseOperationsService

  beforeEach(async () => {
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true })
    }

    mkdirSync(artifactsRoot, { recursive: true })

    service = new ReleaseOperationsService(testRoot)
    await service.initialize({
      windows: {
        enabled: true,
        digestAlgorithm: 'sha256',
        certificateSubject: 'CN=LACON Test Cert',
      },
      mac: {
        enabled: true,
        notarizationEnabled: true,
        identity: 'Developer ID Application: LACON (TEST)',
        teamId: 'TESTTEAMID',
      },
      requireSignedArtifactsForGa: true,
      allowUnsignedForBeta: true,
      requiredPlatforms: ['win32', 'darwin'],
      requiredArchitectures: ['x64', 'arm64'],
    })
  })

  afterEach(() => {
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  function createFixtureArtifact(name: string, content: string): string {
    const path = join(artifactsRoot, name)
    writeFileSync(path, content, 'utf-8')
    return path
  }

  function createSignedArtifact(params: {
    version: string
    channel: 'stable' | 'beta'
    platform: 'win32' | 'darwin'
    arch: 'x64' | 'arm64'
    fileName: string
    content: string
    signed?: boolean
    notarized?: boolean
  }): ReleaseArtifact {
    const filePath = createFixtureArtifact(params.fileName, params.content)
    return service.registerArtifact(filePath, {
      version: params.version,
      channel: params.channel,
      platform: params.platform,
      arch: params.arch,
      signed: params.signed ?? true,
      notarized: params.notarized,
      signature: {
        algorithm: 'sha256',
        value: 'sig-test-value',
        keyId: 'test-key',
      },
      metadata: {
        fixture: true,
      },
    })
  }

  describe('P11-T1: Signed installer generation & integrity', () => {
    it('registers artifact with checksums and validates integrity', () => {
      const artifact = createSignedArtifact({
        version: '1.0.0',
        channel: 'stable',
        platform: 'win32',
        arch: 'x64',
        fileName: 'LACON-1.0.0-x64-setup.exe',
        content: 'signed-windows-installer-content',
      })

      expect(artifact.id).toBeTruthy()
      expect(artifact.checksumSha256).toHaveLength(64)
      expect(artifact.checksumSha512).toHaveLength(128)
      expect(artifact.signed).toBe(true)

      const integrity = service.verifyArtifactIntegrity(artifact)
      expect(integrity.checksumValid).toBe(true)
      expect(integrity.signatureValid).toBe(true)
      expect(integrity.errors).toHaveLength(0)
    })

    it('fails integrity when artifact payload is tampered', () => {
      const artifact = createSignedArtifact({
        version: '1.0.0',
        channel: 'stable',
        platform: 'win32',
        arch: 'arm64',
        fileName: 'LACON-1.0.0-arm64-setup.exe',
        content: 'original-bytes',
      })

      writeFileSync(artifact.filePath, 'tampered-bytes', 'utf-8')

      const integrity = service.verifyArtifactIntegrity(artifact)
      expect(integrity.checksumValid).toBe(false)
      expect(integrity.errors.some(e => e.includes('checksum'))).toBe(true)
    })

    it('requires signed/notarized artifact for mac stable when config enforces it', () => {
      const unsignedMac = createSignedArtifact({
        version: '1.0.0',
        channel: 'stable',
        platform: 'darwin',
        arch: 'x64',
        fileName: 'LACON-1.0.0-x64.dmg',
        content: 'mac-installer-content',
        signed: false,
        notarized: false,
      })

      const integrity = service.verifyArtifactIntegrity(unsignedMac)
      expect(integrity.signatureValid).toBe(false)
      expect(integrity.errors).toContain('Signature validation failed')
      expect(integrity.warnings).toContain('macOS artifact is not notarized')
    })

    it('allows unsigned beta artifacts when configured', () => {
      const unsignedBeta = createSignedArtifact({
        version: '1.1.0-beta.1',
        channel: 'beta',
        platform: 'win32',
        arch: 'x64',
        fileName: 'LACON-1.1.0-beta.1-x64-setup.exe',
        content: 'beta-installer-content',
        signed: false,
      })

      const integrity = service.verifyArtifactIntegrity(unsignedBeta)
      expect(integrity.signatureValid).toBe(true)
      expect(integrity.errors).toHaveLength(0)
    })
  })

  describe('P11-T2: Update channels and promotion controls', () => {
    it('publishes beta channel manifest with staged rollout', () => {
      const artifacts = [
        createSignedArtifact({
          version: '1.2.0-beta.1',
          channel: 'beta',
          platform: 'win32',
          arch: 'x64',
          fileName: 'LACON-1.2.0-beta.1-win-x64.exe',
          content: 'beta-win-x64',
          signed: true,
        }),
      ]

      const manifest = service.publishChannelManifest({
        version: '1.2.0-beta.1',
        channel: 'beta',
        feedUrl: 'https://releases.lacon.app/beta',
        artifacts,
        stagedRollout: {
          enabled: true,
          percentage: 20,
          cohortKey: 'beta-cohort',
          startedAt: Date.now(),
        },
      })

      expect(manifest.channel).toBe('beta')
      expect(manifest.stagedRollout?.enabled).toBe(true)
      expect(manifest.stagedRollout?.percentage).toBe(20)
      expect(manifest.artifacts).toHaveLength(1)
    })

    it('promotes from beta to stable with evidence artifact ids', () => {
      const artifacts = [
        createSignedArtifact({
          version: '1.2.0',
          channel: 'beta',
          platform: 'win32',
          arch: 'x64',
          fileName: 'LACON-1.2.0-win-x64.exe',
          content: 'stable-candidate-win-x64',
        }),
        createSignedArtifact({
          version: '1.2.0',
          channel: 'beta',
          platform: 'win32',
          arch: 'arm64',
          fileName: 'LACON-1.2.0-win-arm64.exe',
          content: 'stable-candidate-win-arm64',
        }),
        createSignedArtifact({
          version: '1.2.0',
          channel: 'beta',
          platform: 'darwin',
          arch: 'x64',
          fileName: 'LACON-1.2.0-mac-x64.dmg',
          content: 'stable-candidate-mac-x64',
          notarized: true,
        }),
        createSignedArtifact({
          version: '1.2.0',
          channel: 'beta',
          platform: 'darwin',
          arch: 'arm64',
          fileName: 'LACON-1.2.0-mac-arm64.dmg',
          content: 'stable-candidate-mac-arm64',
          notarized: true,
        }),
      ]

      service.publishChannelManifest({
        version: '1.2.0',
        channel: 'beta',
        feedUrl: 'https://releases.lacon.app/beta',
        artifacts,
      })

      const result = service.promoteChannel({
        version: '1.2.0',
        fromChannel: 'beta',
        toChannel: 'stable',
        requestedBy: 'release-bot',
        reason: 'All RC gates passed',
        requestedAt: Date.now(),
      })

      expect(result.approved).toBe(true)
      expect(result.promotedVersion).toBe('1.2.0')
      expect(result.fromChannel).toBe('beta')
      expect(result.toChannel).toBe('stable')
      expect(result.evidenceArtifactIds.length).toBeGreaterThan(0)
    })

    it('blocks stable publish when required platform/arch coverage is missing', () => {
      const partialArtifacts = [
        createSignedArtifact({
          version: '2.0.0',
          channel: 'stable',
          platform: 'win32',
          arch: 'x64',
          fileName: 'LACON-2.0.0-win-x64.exe',
          content: 'only-one-artifact',
        }),
      ]

      expect(() =>
        service.publishChannelManifest({
          version: '2.0.0',
          channel: 'stable',
          feedUrl: 'https://releases.lacon.app/stable',
          artifacts: partialArtifacts,
        }),
      ).toThrow('GA publish blocked')
    })
  })

  describe('P11-T3: Rollback controls and drill evidence', () => {
    function seedRollbackVersion(version: string): ReleaseArtifact[] {
      return [
        createSignedArtifact({
          version,
          channel: 'stable',
          platform: 'win32',
          arch: 'x64',
          fileName: `LACON-${version}-win-x64.exe`,
          content: `payload-${version}-win-x64`,
        }),
        createSignedArtifact({
          version,
          channel: 'stable',
          platform: 'win32',
          arch: 'arm64',
          fileName: `LACON-${version}-win-arm64.exe`,
          content: `payload-${version}-win-arm64`,
        }),
        createSignedArtifact({
          version,
          channel: 'stable',
          platform: 'darwin',
          arch: 'x64',
          fileName: `LACON-${version}-mac-x64.dmg`,
          content: `payload-${version}-mac-x64`,
          notarized: true,
        }),
        createSignedArtifact({
          version,
          channel: 'stable',
          platform: 'darwin',
          arch: 'arm64',
          fileName: `LACON-${version}-mac-arm64.dmg`,
          content: `payload-${version}-mac-arm64`,
          notarized: true,
        }),
      ]
    }

    it('executes fast-path rollback when target manifest exists', () => {
      const targetArtifacts = seedRollbackVersion('1.0.1')

      service.publishChannelManifest({
        version: '1.0.1',
        channel: 'stable',
        feedUrl: 'https://releases.lacon.app/stable',
        artifacts: targetArtifacts,
      })

      const rollbackPlan: RollbackPlan = {
        currentVersion: '1.1.0',
        targetVersion: '1.0.1',
        channel: 'stable',
        reason: 'Critical startup crash in 1.1.0',
        initiatedBy: 'incident-commander',
        initiatedAt: Date.now(),
        fastPath: true,
      }

      const result = service.executeRollback(rollbackPlan)
      expect(result.success).toBe(true)
      expect(result.rollbackVersion).toBe('1.0.1')
      expect(result.affectedPlatforms).toContain('win32')
      expect(result.affectedPlatforms).toContain('darwin')
    })

    it('records client rollback verification evidence list', () => {
      const records = service.recordClientRollbackVerification({
        platform: 'win32',
        arch: 'x64',
        fromVersion: '1.1.0',
        toVersion: '1.0.1',
        updateFeedRespected: true,
        rollbackApplied: true,
        evidence: ['logs/windows-x64-rollback.log', 'screenshots/rollback-success.png'],
        verifiedAt: Date.now(),
      })

      expect(records.length).toBe(1)
      expect(records[0].rollbackApplied).toBe(true)
      expect(records[0].evidence).toHaveLength(2)
    })

    it('creates rollback runbook and drill record', () => {
      const template = service.defaultRollbackRunbookTemplate('stable')
      const runbook = service.createRollbackRunbook({
        ...template,
        reviewedBy: 'release-manager',
      })

      expect(runbook.id).toBeTruthy()
      expect(runbook.executionSteps.length).toBeGreaterThan(0)

      const drill = service.recordRollbackDrill({
        runbookId: runbook.id,
        channel: 'stable',
        executedAt: Date.now(),
        executedBy: 'qa-release',
        fromVersion: '1.1.0',
        toVersion: '1.0.1',
        success: true,
        durationMinutes: 22,
        evidence: ['drills/2026-04-11-rollout.md'],
        issuesFound: [],
        followUps: [],
      })

      expect(drill.id).toBeTruthy()
      expect(drill.success).toBe(true)

      const listedRunbooks = service.listRollbackRunbooks()
      const listedDrills = service.listRollbackDrills()
      expect(listedRunbooks.some(item => item.id === runbook.id)).toBe(true)
      expect(listedDrills.some(item => item.id === drill.id)).toBe(true)
    })
  })

  describe('P11-T4/P11-T5: Crash diagnostics and support workflows', () => {
    it('captures crash event with redacted sensitive data', () => {
      const event = service.captureCrashEvent({
        processType: 'main',
        appVersion: '1.3.0',
        platform: 'win32',
        reason: 'uncaught-exception',
        message: 'token="abc123-super-secret-token"',
        stack: 'Error: api_key=super-secret-key',
      })

      expect(event.id).toBeTruthy()
      expect(event.occurredAt).toBeGreaterThan(0)
      expect(event.message).not.toContain('super-secret-token')
      expect(event.stack).not.toContain('super-secret-key')
    })

    it('creates diagnostic bundle and redacts sensitive payloads', () => {
      const logFile = createFixtureArtifact('runtime.log', 'user email john@example.com api_key=topsecret')

      const bundle = service.createDiagnosticBundle({
        appVersion: '1.3.0',
        platform: 'darwin',
        arch: 'arm64',
        sourceFiles: [logFile],
      })

      expect(bundle.id).toBeTruthy()
      expect(bundle.files.length).toBe(1)
      expect(bundle.files[0].redacted).toBe(true)
      expect(bundle.redactionReport.redactedCount).toBeGreaterThan(0)
      expect(existsSync(join(bundle.outputPath, 'bundle.json'))).toBe(true)
    })

    it('stores and returns support triage taxonomy and support tickets', () => {
      const taxonomy = service.getSupportTriageTaxonomy()
      expect(taxonomy.categories).toContain('security')
      expect(taxonomy.severityDefinitions.sev1).toContain('Critical')

      const updatedTaxonomy = service.setSupportTriageTaxonomy({
        ...taxonomy,
        defaultCategoryOwners: {
          ...taxonomy.defaultCategoryOwners,
          update: 'release-oncall',
        },
      })

      expect(updatedTaxonomy.defaultCategoryOwners.update).toBe('release-oncall')

      const ticket = service.createSupportTicket({
        title: 'Rollback did not apply on one client',
        category: 'rollback',
        severity: 'sev2',
        customerImpact: 'User stuck on bad build',
        owner: 'support-lead',
        status: 'new',
      })

      expect(ticket.id).toBeTruthy()
      expect(ticket.category).toBe('rollback')
      expect(ticket.severity).toBe('sev2')
    })
  })

  describe('P11-T6/P11-T7: RC gate review and GA checklist sign-off', () => {
    it('approves RC gate review only when all gates pass', () => {
      const review = service.createReleaseCandidateGateReview({
        version: '2.1.0',
        channel: 'stable',
        reviewedBy: 'release-manager',
        functional: [{ name: 'Functional smoke suite', passed: true, evidence: ['tests/functional.xml'] }],
        security: [{ name: 'Security checks', passed: true, evidence: ['tests/security.xml'] }],
        performance: [{ name: 'Performance budget', passed: true, evidence: ['tests/perf.json'] }],
      })

      expect(review.approvedForGa).toBe(true)

      const rejected = service.createReleaseCandidateGateReview({
        version: '2.1.1',
        channel: 'stable',
        reviewedBy: 'release-manager',
        functional: [{ name: 'Functional smoke suite', passed: true, evidence: [] }],
        security: [{ name: 'Security checks', passed: false, evidence: ['security/failure.log'] }],
        performance: [{ name: 'Performance budget', passed: true, evidence: [] }],
      })

      expect(rejected.approvedForGa).toBe(false)
    })

    it('completes GA checklist items and requires all sign-offs for full approval', () => {
      const version = '2.2.0'
      let checklist = service.createGaChecklist(version, ['release-manager', 'security-lead'])

      for (const item of checklist.items) {
        checklist = service.completeGaChecklistItem(
          version,
          item.id,
          'release-bot',
          [`evidence/${item.id}.txt`],
          'done',
        )
      }

      expect(checklist.items.every(item => item.completed)).toBe(true)
      expect(checklist.fullyApproved).toBe(false)

      checklist = service.signOffGa(version, {
        owner: 'release-manager',
        role: 'Release Manager',
        approved: true,
      })

      expect(checklist.fullyApproved).toBe(false)

      checklist = service.signOffGa(version, {
        owner: 'security-lead',
        role: 'Security Lead',
        approved: true,
      })

      expect(checklist.fullyApproved).toBe(true)
      expect(checklist.signOffs.length).toBe(2)
    })
  })
})

import { randomUUID } from 'crypto'

// TODO: Define or import these types from the correct location
// import type {
//   ComplianceControl,
//   ComplianceEvidence,
//   ExternalReadinessItem,
//   InternalAuditRun,
// } from '@/shared/phase12-types'

interface ComplianceControl {
  controlId: string
  framework: string
  owner: string
  description: string
  mappedAt: number
}

interface ComplianceEvidence {
  evidenceId: string
  controlId: string
  artifactPath: string
  artifactHash: string
  capturedBy: string
  capturedAt: number
}

interface InternalAuditRun {
  auditId: string
  scope: string
  executedBy: string
  executedAt: number
  findings: string[]
}

interface ExternalReadinessItem {
  itemId: string
  category: 'gap-remediation' | 'dry-run' | 'external-audit'
  summary: string
  status: 'in-progress' | 'done'
  updatedAt: number
}

export class ComplianceService {
  private controls: ComplianceControl[] = []
  private evidenceCatalog: ComplianceEvidence[] = []
  private auditRuns: InternalAuditRun[] = []
  private readinessItems: ExternalReadinessItem[] = []

  mapControl(framework: ComplianceControl['framework'], controlId: string, owner: string, description: string) {
    const control: ComplianceControl = {
      controlId,
      framework,
      owner,
      description,
      mappedAt: Date.now(),
    }

    this.controls.push(control)
    return control
  }

  captureEvidence(controlId: string, artifactPath: string, artifactHash: string, capturedBy: string) {
    if (!this.controls.some(control => control.controlId === controlId)) {
      throw new Error(`Control not found: ${controlId}`)
    }

    const evidence: ComplianceEvidence = {
      evidenceId: `evidence_${randomUUID()}`,
      controlId,
      artifactPath,
      artifactHash,
      capturedBy,
      capturedAt: Date.now(),
    }

    this.evidenceCatalog.push(evidence)
    return evidence
  }

  recordInternalAudit(scope: string, executedBy: string, findings: string[]): InternalAuditRun {
    const audit: InternalAuditRun = {
      auditId: `audit_${randomUUID()}`,
      scope,
      executedBy,
      executedAt: Date.now(),
      findings,
    }

    this.auditRuns.push(audit)
    return audit
  }

  buildGapRemediationPlan(gaps: string[]): ExternalReadinessItem[] {
    const items = gaps.map(gap =>
      this.createReadinessItem({
        category: 'gap-remediation',
        summary: gap,
        status: 'in-progress',
      }),
    )

    this.readinessItems.push(...items)
    return items
  }

  runDryAssessment(summary: string): ExternalReadinessItem {
    const item = this.createReadinessItem({
      category: 'dry-run',
      summary,
      status: 'done',
    })

    this.readinessItems.push(item)
    return item
  }

  prepareExternalAudit(summary: string): ExternalReadinessItem {
    const item = this.createReadinessItem({
      category: 'external-audit',
      summary,
      status: 'in-progress',
    })

    this.readinessItems.push(item)
    return item
  }

  getDashboard() {
    return {
      controls: this.controls,
      evidenceCatalog: this.evidenceCatalog,
      auditRuns: this.auditRuns,
      readinessItems: this.readinessItems,
    }
  }

  private createReadinessItem(input: Omit<ExternalReadinessItem, 'itemId' | 'updatedAt'>): ExternalReadinessItem {
    return {
      itemId: `ready_${randomUUID()}`,
      ...input,
      updatedAt: Date.now(),
    }
  }
}

let complianceService: ComplianceService | null = null

export function getComplianceService(): ComplianceService {
  if (!complianceService) {
    complianceService = new ComplianceService()
  }

  return complianceService
}

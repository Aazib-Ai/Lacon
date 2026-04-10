import { describe, expect, it } from 'vitest'

import { ComplianceService } from '../../src/main/services/compliance-service'

describe('ComplianceService', () => {
  it('maps controls and captures evidence', () => {
    const service = new ComplianceService()

    const control = service.mapControl('SOC2', 'CC6.1', 'security', 'Access controls are enforced')
    const evidence = service.captureEvidence(control.controlId, '/evidence/control.png', 'abc123', 'auditor')

    expect(control.controlId).toBe('CC6.1')
    expect(evidence.controlId).toBe(control.controlId)
  })

  it('tracks internal audits and external readiness flow', () => {
    const service = new ComplianceService()

    service.mapControl('SOC2', 'CC7.2', 'security', 'Anomaly detection process')
    service.recordInternalAudit('Q2 controls', 'auditor', ['Need tighter rotation'])
    service.buildGapRemediationPlan(['Close key rotation evidence gap'])
    service.runDryAssessment('Dry run completed with one minor gap')
    service.prepareExternalAudit('Prepare auditor package and evidence index')

    const dashboard = service.getDashboard()

    expect(dashboard.auditRuns).toHaveLength(1)
    expect(dashboard.readinessItems.length).toBeGreaterThanOrEqual(3)
  })
})

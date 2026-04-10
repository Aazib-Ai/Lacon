import { useCallback, useMemo, useState } from 'react'

interface Phase12State {
  documentId: string | null
  collaborators: number
  sync: {
    queued: number
    applied: number
    latestRevision: number
  } | null
  compliance: {
    controls: number
    evidence: number
    audits: number
    readiness: number
  } | null
  error: string | null
}

export function usePhase12() {
  const [state, setState] = useState<Phase12State>({
    documentId: null,
    collaborators: 0,
    sync: null,
    compliance: null,
    error: null,
  })

  const bootstrapDocument = useCallback(async (documentId: string) => {
    try {
      const tenant = await window.electron.phase12.createTenant({
        tenantId: 'tenant-default',
        workspaceId: 'workspace-default',
        displayName: 'Default Workspace',
        createdBy: 'system',
      })

      const account = await window.electron.phase12.createAccount({
        email: 'owner@lacon.local',
        displayName: 'Owner',
        tenantId: tenant.tenantId,
        mfaEnabled: true,
      })

      await window.electron.phase12.createCollabSession({
        documentId,
        owner: {
          userId: account.accountId,
          displayName: account.displayName,
        },
      })

      await window.electron.phase12.mapControl({
        framework: 'SOC2',
        controlId: 'CC6.1',
        owner: 'security@lacon.local',
        description: 'Logical and physical access controls are enforced.',
      })

      const dashboard = await window.electron.phase12.getComplianceDashboard()
      setState(current => ({
        ...current,
        documentId,
        compliance: {
          controls: dashboard.controls.length,
          evidence: dashboard.evidenceCatalog.length,
          audits: dashboard.auditRuns.length,
          readiness: dashboard.readinessItems.length,
        },
        error: null,
      }))
    } catch (error) {
      setState(current => ({
        ...current,
        error: error instanceof Error ? error.message : 'Failed to initialize Phase 12 state',
      }))
    }
  }, [])

  const pushPresence = useCallback(async (input: { documentId: string; userId: string; cursorPos: number }) => {
    await window.electron.phase12.updatePresence({
      presence: {
        userId: input.userId,
        documentId: input.documentId,
        status: 'active',
        cursorPos: input.cursorPos,
        selection: { from: input.cursorPos, to: input.cursorPos },
      },
    })

    const presence = await window.electron.phase12.listPresence(input.documentId)
    setState(current => ({ ...current, collaborators: presence.length }))
  }, [])

  const queueSyncChange = useCallback(async (input: { documentId: string; plainPayload: string }) => {
    await window.electron.phase12.queueSyncChange({
      tenantId: 'tenant-default',
      workspaceId: 'workspace-default',
      deviceId: 'device-local',
      documentId: input.documentId,
      baseRevision: 0,
      plainPayload: input.plainPayload,
      encryptionKey: 'local-sync-key',
    })

    await window.electron.phase12.processSyncQueue()
    const sync = await window.electron.phase12.getSyncStatus('workspace-default')
    setState(current => ({ ...current, sync }))
  }, [])

  const summary = useMemo(
    () => ({
      collaborators: state.collaborators,
      queuedSync: state.sync?.queued ?? 0,
      latestSyncRevision: state.sync?.latestRevision ?? 0,
      complianceControls: state.compliance?.controls ?? 0,
    }),
    [state.collaborators, state.sync?.queued, state.sync?.latestRevision, state.compliance?.controls],
  )

  return {
    state,
    summary,
    bootstrapDocument,
    pushPresence,
    queueSyncChange,
  }
}

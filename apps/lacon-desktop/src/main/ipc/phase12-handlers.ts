import { ipcMain } from 'electron'

import {
  type AccountAddRecoveryMethodRequest,
  type AccountCreateIdentityRequest,
  type AccountCreateSessionRequest,
  type AccountCreateTenantRequest,
  type CollaborationAddMemberRequest,
  type CollaborationApplyOperationRequest,
  type CollaborationCreateSessionRequest,
  type CollaborationGetSessionRequest,
  type CollaborationListPresenceRequest,
  type CollaborationUpdateMemberRoleRequest,
  type CollaborationUpdatePresenceRequest,
  type ComplianceBuildGapPlanRequest,
  type ComplianceCaptureEvidenceRequest,
  type ComplianceMapControlRequest,
  type CompliancePrepareExternalAuditRequest,
  type ComplianceRecordInternalAuditRequest,
  type ComplianceRunDryAssessmentRequest,
  type SyncCreateRestoreSnapshotRequest,
  type SyncGetStatusRequest,
  type SyncQueueChangeRequest,
  type SyncResolveConflictRequest,
  type SyncRestoreToDeviceRequest,
  IPC_CHANNELS,
} from '../../shared/ipc-schema'
import { getAccountSyncService } from '../services/account-sync-service'
import { getCollaborationService } from '../services/collaboration-service'
import { getComplianceService } from '../services/compliance-service'

export function registerPhase12Handlers(): void {
  const collaboration = getCollaborationService()
  const accountSync = getAccountSyncService()
  const compliance = getComplianceService()

  ipcMain.handle(IPC_CHANNELS.COLLAB_CREATE_SESSION, (_, payload: CollaborationCreateSessionRequest) => {
    return collaboration.createSharedDocument(payload.documentId, payload.owner)
  })

  ipcMain.handle(IPC_CHANNELS.COLLAB_GET_SESSION, (_, payload: CollaborationGetSessionRequest) => {
    return collaboration.getSharedDocument(payload.documentId)
  })

  ipcMain.handle(IPC_CHANNELS.COLLAB_ADD_MEMBER, (_, payload: CollaborationAddMemberRequest) => {
    return collaboration.addMember(payload.documentId, payload.member)
  })

  ipcMain.handle(IPC_CHANNELS.COLLAB_UPDATE_MEMBER_ROLE, (_, payload: CollaborationUpdateMemberRoleRequest) => {
    return collaboration.updateMemberRole(payload.documentId, payload.userId, payload.role)
  })

  ipcMain.handle(IPC_CHANNELS.COLLAB_UPDATE_PRESENCE, (_, payload: CollaborationUpdatePresenceRequest) => {
    return collaboration.updatePresence(payload.presence)
  })

  ipcMain.handle(IPC_CHANNELS.COLLAB_LIST_PRESENCE, (_, payload: CollaborationListPresenceRequest) => {
    return collaboration.listPresence(payload.documentId)
  })

  ipcMain.handle(IPC_CHANNELS.COLLAB_APPLY_OPERATION, (_, payload: CollaborationApplyOperationRequest) => {
    return collaboration.applyOperation(payload.operation)
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_CREATE_TENANT, (_, payload: AccountCreateTenantRequest) => {
    return accountSync.createTenantWorkspace(
      payload.tenantId,
      payload.workspaceId,
      payload.displayName,
      payload.createdBy,
    )
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_CREATE_IDENTITY, (_, payload: AccountCreateIdentityRequest) => {
    return accountSync.registerAccount(payload.email, payload.displayName, payload.tenantId, payload.mfaEnabled)
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_CREATE_SESSION, (_, payload: AccountCreateSessionRequest) => {
    return accountSync.createSession(payload.accountId, payload.deviceId, payload.durationMs)
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_ADD_RECOVERY_METHOD, (_, payload: AccountAddRecoveryMethodRequest) => {
    return accountSync.addRecoveryMethod(payload.accountId, payload.type)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_QUEUE_CHANGE, (_, payload: SyncQueueChangeRequest) => {
    return accountSync.queueEncryptedSyncChange(payload)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_PROCESS_QUEUE, () => {
    return accountSync.processSyncQueue()
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_RESOLVE_CONFLICT, (_, payload: SyncResolveConflictRequest) => {
    return accountSync.resolveConflict(payload)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_CREATE_RESTORE_SNAPSHOT, (_, payload: SyncCreateRestoreSnapshotRequest) => {
    return accountSync.createRestoreSnapshot(payload)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_RESTORE_TO_DEVICE, (_, payload: SyncRestoreToDeviceRequest) => {
    return accountSync.restoreSnapshotToDevice(payload.snapshotId, payload.encryptionKey)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_STATUS, (_, payload: SyncGetStatusRequest) => {
    return accountSync.getSyncStatus(payload.workspaceId)
  })

  ipcMain.handle(IPC_CHANNELS.COMPLIANCE_MAP_CONTROL, (_, payload: ComplianceMapControlRequest) => {
    return compliance.mapControl(payload.framework, payload.controlId, payload.owner, payload.description)
  })

  ipcMain.handle(IPC_CHANNELS.COMPLIANCE_CAPTURE_EVIDENCE, (_, payload: ComplianceCaptureEvidenceRequest) => {
    return compliance.captureEvidence(payload.controlId, payload.artifactPath, payload.artifactHash, payload.capturedBy)
  })

  ipcMain.handle(IPC_CHANNELS.COMPLIANCE_RECORD_INTERNAL_AUDIT, (_, payload: ComplianceRecordInternalAuditRequest) => {
    return compliance.recordInternalAudit(payload.scope, payload.executedBy, payload.findings)
  })

  ipcMain.handle(IPC_CHANNELS.COMPLIANCE_BUILD_GAP_PLAN, (_, payload: ComplianceBuildGapPlanRequest) => {
    return compliance.buildGapRemediationPlan(payload.gaps)
  })

  ipcMain.handle(IPC_CHANNELS.COMPLIANCE_RUN_DRY_ASSESSMENT, (_, payload: ComplianceRunDryAssessmentRequest) => {
    return compliance.runDryAssessment(payload.summary)
  })

  ipcMain.handle(
    IPC_CHANNELS.COMPLIANCE_PREPARE_EXTERNAL_AUDIT,
    (_, payload: CompliancePrepareExternalAuditRequest) => {
      return compliance.prepareExternalAudit(payload.summary)
    },
  )

  ipcMain.handle(IPC_CHANNELS.COMPLIANCE_GET_DASHBOARD, () => {
    return compliance.getDashboard()
  })
}

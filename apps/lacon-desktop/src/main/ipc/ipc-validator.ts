/**
 * IPC validation middleware for Phase 2
 * Validates all inbound IPC payloads against schemas
 */

import {
  type IpcChannel,
  type IpcError,
  IPC_CHANNELS,
  isAccountAddRecoveryMethodRequest,
  isAccountCreateIdentityRequest,
  isAccountCreateSessionRequest,
  isAccountCreateTenantRequest,
  isCollaborationAddMemberRequest,
  isCollaborationApplyOperationRequest,
  isCollaborationCreateSessionRequest,
  isCollaborationGetSessionRequest,
  isCollaborationListPresenceRequest,
  isCollaborationUpdateMemberRoleRequest,
  isCollaborationUpdatePresenceRequest,
  isComplianceBuildGapPlanRequest,
  isComplianceCaptureEvidenceRequest,
  isComplianceMapControlRequest,
  isCompliancePrepareExternalAuditRequest,
  isComplianceRecordInternalAuditRequest,
  isComplianceRunDryAssessmentRequest,
  isDataDeleteRequest,
  isDataExportRequest,
  isDataImportRequest,
  isDataListRequest,
  isDataLoadRequest,
  isDataSaveRequest,
  isKeyDeleteRequest,
  isKeyGetMetadataRequest,
  isKeyHasRequest,
  isKeySetRequest,
  isReleaseBuildAuditRecordRequest,
  isReleaseCaptureCrashEventRequest,
  isReleaseCompleteGaChecklistItemRequest,
  isReleaseCreateDiagnosticBundleRequest,
  isReleaseCreateGaChecklistRequest,
  isReleaseCreateRcGateReviewRequest,
  isReleaseCreateRollbackRunbookRequest,
  isReleaseCreateSupportTicketRequest,
  isReleaseExecuteRollbackRequest,
  isReleaseGetDefaultRollbackRunbookTemplateRequest,
  isReleasePromoteChannelRequest,
  isReleasePublishChannelManifestRequest,
  isReleaseRecordClientRollbackVerificationRequest,
  isReleaseRecordRollbackDrillRequest,
  isReleaseRegisterArtifactRequest,
  isReleaseSetPipelineConfigRequest,
  isReleaseSetSupportTriageTaxonomyRequest,
  isReleaseSignOffGaRequest,
  isReleaseVerifyArtifactIntegrityRequest,
  isSettingsGetRequest,
  isSettingsSetRequest,
  isSyncCreateRestoreSnapshotRequest,
  isSyncGetStatusRequest,
  isSyncQueueChangeRequest,
  isSyncResolveConflictRequest,
  isSyncRestoreToDeviceRequest,
  isValidChannel,
} from '@/shared/ipc-schema'

export class IpcValidationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
  ) {
    super(message)
    this.name = 'IpcValidationError'
  }

  toIpcError(): IpcError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

/**
 * Validate IPC channel name
 */
export function validateChannel(channel: string): void {
  if (!isValidChannel(channel)) {
    throw new IpcValidationError('INVALID_CHANNEL', `Unknown IPC channel: ${channel}`, { channel })
  }
}

/**
 * Validate IPC payload based on channel
 */
export function validatePayload(channel: IpcChannel, payload: any): void {
  switch (channel) {
    case IPC_CHANNELS.KEY_SET:
      if (!isKeySetRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid KEY_SET payload', {
          expected: 'KeySetRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.KEY_GET_METADATA:
      if (!isKeyGetMetadataRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid KEY_GET_METADATA payload', {
          expected: 'KeyGetMetadataRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.KEY_DELETE:
      if (!isKeyDeleteRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid KEY_DELETE payload', {
          expected: 'KeyDeleteRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.KEY_HAS:
      if (!isKeyHasRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid KEY_HAS payload', {
          expected: 'KeyHasRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.KEY_LIST:
      // No payload required
      break

    case IPC_CHANNELS.DATA_SAVE:
      if (!isDataSaveRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_SAVE payload', {
          expected: 'DataSaveRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_LOAD:
      if (!isDataLoadRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_LOAD payload', {
          expected: 'DataLoadRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_DELETE:
      if (!isDataDeleteRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_DELETE payload', {
          expected: 'DataDeleteRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_LIST:
      if (!isDataListRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_LIST payload', {
          expected: 'DataListRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_EXPORT:
      if (!isDataExportRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_EXPORT payload', {
          expected: 'DataExportRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.DATA_IMPORT:
      if (!isDataImportRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid DATA_IMPORT payload', {
          expected: 'DataImportRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SETTINGS_GET:
      if (!isSettingsGetRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SETTINGS_GET payload', {
          expected: 'SettingsGetRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SETTINGS_SET:
      if (!isSettingsSetRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SETTINGS_SET payload', {
          expected: 'SettingsSetRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_SET_PIPELINE_CONFIG:
      if (!isReleaseSetPipelineConfigRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_SET_PIPELINE_CONFIG payload', {
          expected: 'ReleaseSetPipelineConfigRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_GET_PIPELINE_CONFIG:
      // No payload required
      break

    case IPC_CHANNELS.RELEASE_REGISTER_ARTIFACT:
      if (!isReleaseRegisterArtifactRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_REGISTER_ARTIFACT payload', {
          expected: 'ReleaseRegisterArtifactRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_VERIFY_ARTIFACT_INTEGRITY:
      if (!isReleaseVerifyArtifactIntegrityRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_VERIFY_ARTIFACT_INTEGRITY payload', {
          expected: 'ReleaseVerifyArtifactIntegrityRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_PUBLISH_CHANNEL_MANIFEST:
      if (!isReleasePublishChannelManifestRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_PUBLISH_CHANNEL_MANIFEST payload', {
          expected: 'ReleasePublishChannelManifestRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_PROMOTE_CHANNEL:
      if (!isReleasePromoteChannelRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_PROMOTE_CHANNEL payload', {
          expected: 'ReleasePromoteChannelRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_EXECUTE_ROLLBACK:
      if (!isReleaseExecuteRollbackRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_EXECUTE_ROLLBACK payload', {
          expected: 'ReleaseExecuteRollbackRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_RECORD_CLIENT_ROLLBACK_VERIFICATION:
      if (!isReleaseRecordClientRollbackVerificationRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_RECORD_CLIENT_ROLLBACK_VERIFICATION payload', {
          expected: 'ReleaseRecordClientRollbackVerificationRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_CAPTURE_CRASH_EVENT:
      if (!isReleaseCaptureCrashEventRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_CAPTURE_CRASH_EVENT payload', {
          expected: 'ReleaseCaptureCrashEventRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_CREATE_DIAGNOSTIC_BUNDLE:
      if (!isReleaseCreateDiagnosticBundleRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_CREATE_DIAGNOSTIC_BUNDLE payload', {
          expected: 'ReleaseCreateDiagnosticBundleRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_CREATE_RC_GATE_REVIEW:
      if (!isReleaseCreateRcGateReviewRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_CREATE_RC_GATE_REVIEW payload', {
          expected: 'ReleaseCreateRcGateReviewRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_CREATE_GA_CHECKLIST:
      if (!isReleaseCreateGaChecklistRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_CREATE_GA_CHECKLIST payload', {
          expected: 'ReleaseCreateGaChecklistRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_COMPLETE_GA_CHECKLIST_ITEM:
      if (!isReleaseCompleteGaChecklistItemRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_COMPLETE_GA_CHECKLIST_ITEM payload', {
          expected: 'ReleaseCompleteGaChecklistItemRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_SIGN_OFF_GA:
      if (!isReleaseSignOffGaRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_SIGN_OFF_GA payload', {
          expected: 'ReleaseSignOffGaRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_BUILD_AUDIT_RECORD:
      if (!isReleaseBuildAuditRecordRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_BUILD_AUDIT_RECORD payload', {
          expected: 'ReleaseBuildAuditRecordRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_GET_INCIDENT_SEVERITY_MATRIX:
    case IPC_CHANNELS.RELEASE_GET_ESCALATION_MATRIX:
      // No payload required
      break

    case IPC_CHANNELS.RELEASE_CREATE_SUPPORT_TICKET:
      if (!isReleaseCreateSupportTicketRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_CREATE_SUPPORT_TICKET payload', {
          expected: 'ReleaseCreateSupportTicketRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_SET_SUPPORT_TRIAGE_TAXONOMY:
      if (!isReleaseSetSupportTriageTaxonomyRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_SET_SUPPORT_TRIAGE_TAXONOMY payload', {
          expected: 'ReleaseSetSupportTriageTaxonomyRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_GET_SUPPORT_TRIAGE_TAXONOMY:
    case IPC_CHANNELS.RELEASE_LIST_ROLLBACK_RUNBOOKS:
    case IPC_CHANNELS.RELEASE_LIST_ROLLBACK_DRILLS:
      // No payload required
      break

    case IPC_CHANNELS.RELEASE_CREATE_ROLLBACK_RUNBOOK:
      if (!isReleaseCreateRollbackRunbookRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_CREATE_ROLLBACK_RUNBOOK payload', {
          expected: 'ReleaseCreateRollbackRunbookRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_RECORD_ROLLBACK_DRILL:
      if (!isReleaseRecordRollbackDrillRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid RELEASE_RECORD_ROLLBACK_DRILL payload', {
          expected: 'ReleaseRecordRollbackDrillRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.RELEASE_GET_DEFAULT_ROLLBACK_RUNBOOK_TEMPLATE:
      if (!isReleaseGetDefaultRollbackRunbookTemplateRequest(payload)) {
        throw new IpcValidationError(
          'INVALID_PAYLOAD',
          'Invalid RELEASE_GET_DEFAULT_ROLLBACK_RUNBOOK_TEMPLATE payload',
          {
            expected: 'ReleaseGetDefaultRollbackRunbookTemplateRequest',
            received: typeof payload,
          },
        )
      }
      break

    case IPC_CHANNELS.COLLAB_CREATE_SESSION:
      if (!isCollaborationCreateSessionRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COLLAB_CREATE_SESSION payload', {
          expected: 'CollaborationCreateSessionRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COLLAB_GET_SESSION:
      if (!isCollaborationGetSessionRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COLLAB_GET_SESSION payload', {
          expected: 'CollaborationGetSessionRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COLLAB_ADD_MEMBER:
      if (!isCollaborationAddMemberRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COLLAB_ADD_MEMBER payload', {
          expected: 'CollaborationAddMemberRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COLLAB_UPDATE_MEMBER_ROLE:
      if (!isCollaborationUpdateMemberRoleRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COLLAB_UPDATE_MEMBER_ROLE payload', {
          expected: 'CollaborationUpdateMemberRoleRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COLLAB_UPDATE_PRESENCE:
      if (!isCollaborationUpdatePresenceRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COLLAB_UPDATE_PRESENCE payload', {
          expected: 'CollaborationUpdatePresenceRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COLLAB_LIST_PRESENCE:
      if (!isCollaborationListPresenceRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COLLAB_LIST_PRESENCE payload', {
          expected: 'CollaborationListPresenceRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COLLAB_APPLY_OPERATION:
      if (!isCollaborationApplyOperationRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COLLAB_APPLY_OPERATION payload', {
          expected: 'CollaborationApplyOperationRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.ACCOUNT_CREATE_TENANT:
      if (!isAccountCreateTenantRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid ACCOUNT_CREATE_TENANT payload', {
          expected: 'AccountCreateTenantRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.ACCOUNT_CREATE_IDENTITY:
      if (!isAccountCreateIdentityRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid ACCOUNT_CREATE_IDENTITY payload', {
          expected: 'AccountCreateIdentityRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.ACCOUNT_CREATE_SESSION:
      if (!isAccountCreateSessionRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid ACCOUNT_CREATE_SESSION payload', {
          expected: 'AccountCreateSessionRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.ACCOUNT_ADD_RECOVERY_METHOD:
      if (!isAccountAddRecoveryMethodRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid ACCOUNT_ADD_RECOVERY_METHOD payload', {
          expected: 'AccountAddRecoveryMethodRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SYNC_QUEUE_CHANGE:
      if (!isSyncQueueChangeRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SYNC_QUEUE_CHANGE payload', {
          expected: 'SyncQueueChangeRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SYNC_PROCESS_QUEUE:
      // No payload required
      break

    case IPC_CHANNELS.SYNC_RESOLVE_CONFLICT:
      if (!isSyncResolveConflictRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SYNC_RESOLVE_CONFLICT payload', {
          expected: 'SyncResolveConflictRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SYNC_CREATE_RESTORE_SNAPSHOT:
      if (!isSyncCreateRestoreSnapshotRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SYNC_CREATE_RESTORE_SNAPSHOT payload', {
          expected: 'SyncCreateRestoreSnapshotRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SYNC_RESTORE_TO_DEVICE:
      if (!isSyncRestoreToDeviceRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SYNC_RESTORE_TO_DEVICE payload', {
          expected: 'SyncRestoreToDeviceRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.SYNC_GET_STATUS:
      if (!isSyncGetStatusRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid SYNC_GET_STATUS payload', {
          expected: 'SyncGetStatusRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COMPLIANCE_MAP_CONTROL:
      if (!isComplianceMapControlRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COMPLIANCE_MAP_CONTROL payload', {
          expected: 'ComplianceMapControlRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COMPLIANCE_CAPTURE_EVIDENCE:
      if (!isComplianceCaptureEvidenceRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COMPLIANCE_CAPTURE_EVIDENCE payload', {
          expected: 'ComplianceCaptureEvidenceRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COMPLIANCE_RECORD_INTERNAL_AUDIT:
      if (!isComplianceRecordInternalAuditRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COMPLIANCE_RECORD_INTERNAL_AUDIT payload', {
          expected: 'ComplianceRecordInternalAuditRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COMPLIANCE_BUILD_GAP_PLAN:
      if (!isComplianceBuildGapPlanRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COMPLIANCE_BUILD_GAP_PLAN payload', {
          expected: 'ComplianceBuildGapPlanRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COMPLIANCE_RUN_DRY_ASSESSMENT:
      if (!isComplianceRunDryAssessmentRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COMPLIANCE_RUN_DRY_ASSESSMENT payload', {
          expected: 'ComplianceRunDryAssessmentRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COMPLIANCE_PREPARE_EXTERNAL_AUDIT:
      if (!isCompliancePrepareExternalAuditRequest(payload)) {
        throw new IpcValidationError('INVALID_PAYLOAD', 'Invalid COMPLIANCE_PREPARE_EXTERNAL_AUDIT payload', {
          expected: 'CompliancePrepareExternalAuditRequest',
          received: typeof payload,
        })
      }
      break

    case IPC_CHANNELS.COMPLIANCE_GET_DASHBOARD:
      // No payload required
      break

    default:
      throw new IpcValidationError('UNHANDLED_CHANNEL', `No validator for channel: ${channel}`, { channel })
  }
}

/**
 * Validate complete IPC request
 */
export function validateIpcRequest(channel: string, payload: any): void {
  validateChannel(channel)
  validatePayload(channel as IpcChannel, payload)
}

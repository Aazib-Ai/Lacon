/**
 * IPC handlers for release engineering and GA launch controls (Phase 11)
 */

import { ipcMain } from 'electron'

import {
  type IpcResponse,
  type ReleaseBuildAuditRecordRequest,
  type ReleaseCaptureCrashEventRequest,
  type ReleaseCompleteGaChecklistItemRequest,
  type ReleaseCreateDiagnosticBundleRequest,
  type ReleaseCreateGaChecklistRequest,
  type ReleaseCreateRcGateReviewRequest,
  type ReleaseCreateRollbackRunbookRequest,
  type ReleaseCreateSupportTicketRequest,
  type ReleaseExecuteRollbackRequest,
  type ReleaseGetDefaultRollbackRunbookTemplateRequest,
  type ReleasePromoteChannelRequest,
  type ReleasePublishChannelManifestRequest,
  type ReleaseRecordClientRollbackVerificationRequest,
  type ReleaseRecordRollbackDrillRequest,
  type ReleaseRegisterArtifactRequest,
  type ReleaseSetPipelineConfigRequest,
  type ReleaseSetSupportTriageTaxonomyRequest,
  type ReleaseSignOffGaRequest,
  type ReleaseVerifyArtifactIntegrityRequest,
  IPC_CHANNELS,
} from '../../shared/ipc-schema'
import { getReleaseOperationsService } from '../release-engineering/release-operations-service'
import { IpcValidationError, validateIpcRequest } from './ipc-validator'

function internalError(error: unknown): IpcResponse {
  const message = error instanceof Error ? error.message : String(error)
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    },
  }
}

export function registerReleaseHandlers(): void {
  const releaseService = getReleaseOperationsService()

  // Ensure service storage structure exists before handling requests.
  // This is intentionally fire-and-forget because initialize() is idempotent
  // and each handler can still fail safely if initialization had an issue.
  releaseService.initialize().catch(error => {
    // eslint-disable-next-line no-console
    console.error('[ReleaseIPC] Failed to initialize release operations service:', error)
  })

  const withValidatedPayload = async <T>(
    channel: string,
    payload: unknown,
    handler: () => Promise<IpcResponse<T>>,
  ): Promise<IpcResponse<T>> => {
    try {
      validateIpcRequest(channel, payload)
      return await handler()
    } catch (error) {
      if (error instanceof IpcValidationError) {
        return {
          success: false,
          error: error.toIpcError(),
        } as IpcResponse<T>
      }

      return internalError(error) as IpcResponse<T>
    }
  }

  ipcMain.handle(IPC_CHANNELS.RELEASE_SET_PIPELINE_CONFIG, async (_event, payload: ReleaseSetPipelineConfigRequest) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_SET_PIPELINE_CONFIG, payload, async () => {
      const config = releaseService.setPipelineConfig(payload.config)
      return { success: true, data: config } as IpcResponse
    })
  })

  ipcMain.handle(IPC_CHANNELS.RELEASE_GET_PIPELINE_CONFIG, async (_event, payload) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_GET_PIPELINE_CONFIG, payload, async () => {
      const config = releaseService.getPipelineConfig()
      return { success: true, data: config } as IpcResponse
    })
  })

  ipcMain.handle(IPC_CHANNELS.RELEASE_REGISTER_ARTIFACT, async (_event, payload: ReleaseRegisterArtifactRequest) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_REGISTER_ARTIFACT, payload, async () => {
      const artifact = releaseService.registerArtifact(payload.filePath, payload.params)
      return { success: true, data: artifact } as IpcResponse
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_VERIFY_ARTIFACT_INTEGRITY,
    async (_event, payload: ReleaseVerifyArtifactIntegrityRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_VERIFY_ARTIFACT_INTEGRITY, payload, async () => {
        const result = releaseService.verifyArtifactIntegrity(payload.artifact)
        return { success: true, data: result } as IpcResponse
      })
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_PUBLISH_CHANNEL_MANIFEST,
    async (_event, payload: ReleasePublishChannelManifestRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_PUBLISH_CHANNEL_MANIFEST, payload, async () => {
        const manifest = releaseService.publishChannelManifest({
          version: payload.version,
          channel: payload.channel,
          feedUrl: payload.feedUrl,
          artifacts: payload.artifacts,
          stagedRollout: payload.stagedRollout,
        })

        return { success: true, data: manifest } as IpcResponse
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.RELEASE_PROMOTE_CHANNEL, async (_event, payload: ReleasePromoteChannelRequest) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_PROMOTE_CHANNEL, payload, async () => {
      const result = releaseService.promoteChannel(payload.request)
      return { success: true, data: result } as IpcResponse
    })
  })

  ipcMain.handle(IPC_CHANNELS.RELEASE_EXECUTE_ROLLBACK, async (_event, payload: ReleaseExecuteRollbackRequest) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_EXECUTE_ROLLBACK, payload, async () => {
      const result = releaseService.executeRollback(payload.plan)
      return { success: true, data: result } as IpcResponse
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_RECORD_CLIENT_ROLLBACK_VERIFICATION,
    async (_event, payload: ReleaseRecordClientRollbackVerificationRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_RECORD_CLIENT_ROLLBACK_VERIFICATION, payload, async () => {
        const results = releaseService.recordClientRollbackVerification(payload.verification)
        return { success: true, data: results } as IpcResponse
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.RELEASE_CAPTURE_CRASH_EVENT, async (_event, payload: ReleaseCaptureCrashEventRequest) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_CAPTURE_CRASH_EVENT, payload, async () => {
      const event = releaseService.captureCrashEvent(payload.event)
      return { success: true, data: event } as IpcResponse
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_CREATE_DIAGNOSTIC_BUNDLE,
    async (_event, payload: ReleaseCreateDiagnosticBundleRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_CREATE_DIAGNOSTIC_BUNDLE, payload, async () => {
        const bundle = releaseService.createDiagnosticBundle({
          appVersion: payload.appVersion,
          platform: payload.platform,
          arch: payload.arch,
          sourceFiles: payload.sourceFiles,
        })

        return { success: true, data: bundle } as IpcResponse
      })
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_CREATE_RC_GATE_REVIEW,
    async (_event, payload: ReleaseCreateRcGateReviewRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_CREATE_RC_GATE_REVIEW, payload, async () => {
        const review = releaseService.createReleaseCandidateGateReview({
          version: payload.version,
          channel: payload.channel,
          reviewedBy: payload.reviewedBy,
          functional: payload.functional,
          security: payload.security,
          performance: payload.performance,
        })

        return { success: true, data: review } as IpcResponse
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.RELEASE_CREATE_GA_CHECKLIST, async (_event, payload: ReleaseCreateGaChecklistRequest) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_CREATE_GA_CHECKLIST, payload, async () => {
      const checklist = releaseService.createGaChecklist(payload.version, payload.signOffRequiredBy)
      return { success: true, data: checklist } as IpcResponse
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_COMPLETE_GA_CHECKLIST_ITEM,
    async (_event, payload: ReleaseCompleteGaChecklistItemRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_COMPLETE_GA_CHECKLIST_ITEM, payload, async () => {
        const checklist = releaseService.completeGaChecklistItem(
          payload.version,
          payload.itemId,
          payload.completedBy,
          payload.evidence,
          payload.notes,
        )

        return { success: true, data: checklist } as IpcResponse
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.RELEASE_SIGN_OFF_GA, async (_event, payload: ReleaseSignOffGaRequest) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_SIGN_OFF_GA, payload, async () => {
      const checklist = releaseService.signOffGa(payload.version, payload.signOff)
      return { success: true, data: checklist } as IpcResponse
    })
  })

  ipcMain.handle(IPC_CHANNELS.RELEASE_BUILD_AUDIT_RECORD, async (_event, payload: ReleaseBuildAuditRecordRequest) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_BUILD_AUDIT_RECORD, payload, async () => {
      const auditRecord = releaseService.buildReleaseAuditRecord({
        version: payload.version,
        channel: payload.channel,
        artifacts: payload.artifacts,
        gateReview: payload.gateReview,
        gaChecklist: payload.gaChecklist,
        rollbackPlan: payload.rollbackPlan,
      })

      return { success: true, data: auditRecord } as IpcResponse
    })
  })

  ipcMain.handle(IPC_CHANNELS.RELEASE_GET_INCIDENT_SEVERITY_MATRIX, async (_event, payload) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_GET_INCIDENT_SEVERITY_MATRIX, payload, async () => {
      const matrix = releaseService.defaultIncidentSeverityMatrix()
      return { success: true, data: matrix } as IpcResponse
    })
  })

  ipcMain.handle(IPC_CHANNELS.RELEASE_GET_ESCALATION_MATRIX, async (_event, payload) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_GET_ESCALATION_MATRIX, payload, async () => {
      const matrix = releaseService.defaultEscalationMatrix()
      return { success: true, data: matrix } as IpcResponse
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_CREATE_SUPPORT_TICKET,
    async (_event, payload: ReleaseCreateSupportTicketRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_CREATE_SUPPORT_TICKET, payload, async () => {
        const ticket = releaseService.createSupportTicket(payload.ticket)
        return { success: true, data: ticket } as IpcResponse
      })
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_SET_SUPPORT_TRIAGE_TAXONOMY,
    async (_event, payload: ReleaseSetSupportTriageTaxonomyRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_SET_SUPPORT_TRIAGE_TAXONOMY, payload, async () => {
        const taxonomy = releaseService.setSupportTriageTaxonomy(payload.taxonomy)
        return { success: true, data: taxonomy } as IpcResponse
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.RELEASE_GET_SUPPORT_TRIAGE_TAXONOMY, async (_event, payload) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_GET_SUPPORT_TRIAGE_TAXONOMY, payload, async () => {
      const taxonomy = releaseService.getSupportTriageTaxonomy()
      return { success: true, data: taxonomy } as IpcResponse
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_CREATE_ROLLBACK_RUNBOOK,
    async (_event, payload: ReleaseCreateRollbackRunbookRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_CREATE_ROLLBACK_RUNBOOK, payload, async () => {
        const runbook = releaseService.createRollbackRunbook(payload.runbook)
        return { success: true, data: runbook } as IpcResponse
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.RELEASE_LIST_ROLLBACK_RUNBOOKS, async (_event, payload) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_LIST_ROLLBACK_RUNBOOKS, payload, async () => {
      const runbooks = releaseService.listRollbackRunbooks()
      return { success: true, data: runbooks } as IpcResponse
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_RECORD_ROLLBACK_DRILL,
    async (_event, payload: ReleaseRecordRollbackDrillRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_RECORD_ROLLBACK_DRILL, payload, async () => {
        const drill = releaseService.recordRollbackDrill(payload.drill)
        return { success: true, data: drill } as IpcResponse
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.RELEASE_LIST_ROLLBACK_DRILLS, async (_event, payload) => {
    return withValidatedPayload(IPC_CHANNELS.RELEASE_LIST_ROLLBACK_DRILLS, payload, async () => {
      const drills = releaseService.listRollbackDrills()
      return { success: true, data: drills } as IpcResponse
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_GET_DEFAULT_ROLLBACK_RUNBOOK_TEMPLATE,
    async (_event, payload: ReleaseGetDefaultRollbackRunbookTemplateRequest) => {
      return withValidatedPayload(IPC_CHANNELS.RELEASE_GET_DEFAULT_ROLLBACK_RUNBOOK_TEMPLATE, payload, async () => {
        const template = releaseService.defaultRollbackRunbookTemplate(payload.channel)
        return { success: true, data: template } as IpcResponse
      })
    },
  )
}

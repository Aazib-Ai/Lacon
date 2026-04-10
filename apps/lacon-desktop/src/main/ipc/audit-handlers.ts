/**
 * IPC Handlers for Audit, Trace, and Policy Operations
 * Phase 9: Auditability and Governance
 */

import { ipcMain } from 'electron'

import { type IpcResponse,IPC_CHANNELS } from '../../shared/ipc-schema'
import type { AuditManager } from '../audit/audit-manager'

export function registerAuditHandlers(auditManager: AuditManager): void {
  // Audit handlers
  ipcMain.handle(IPC_CHANNELS.AUDIT_QUERY, async (_event, payload) => {
    try {
      const events = auditManager.getEventStore().query(payload.filter || {})
      return {
        success: true,
        data: events,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUDIT_QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_GET_STATISTICS, async () => {
    try {
      const statistics = auditManager.getAuditStatistics()
      return {
        success: true,
        data: statistics,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUDIT_STATISTICS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_VERIFY_INTEGRITY, async (_event, payload) => {
    try {
      const result = auditManager.getEventStore().verifyIntegrity(payload.eventId)
      return {
        success: true,
        data: result,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUDIT_VERIFY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  // Trace handlers
  ipcMain.handle(IPC_CHANNELS.TRACE_LIST_SESSIONS, async (_event, payload) => {
    try {
      const sessions = auditManager.getTraceViewer().listSessions(payload.filter || {})
      return {
        success: true,
        data: sessions,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TRACE_LIST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.TRACE_GET_TIMELINE, async (_event, payload) => {
    try {
      const timeline = auditManager.getTraceViewer().getTimeline(payload.sessionId)
      return {
        success: true,
        data: timeline,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TRACE_TIMELINE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.TRACE_GET_METRICS, async (_event, payload) => {
    try {
      const metrics = auditManager.getTraceViewer().getMetrics(payload.sessionId)
      return {
        success: true,
        data: metrics,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TRACE_METRICS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.TRACE_REPLAY, async (_event, payload) => {
    try {
      const diagnostics = await auditManager.getTraceViewer().replaySession(payload.config)
      return {
        success: true,
        data: diagnostics,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TRACE_REPLAY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  // Policy handlers
  ipcMain.handle(IPC_CHANNELS.POLICY_LIST_RULES, async () => {
    try {
      const rules = auditManager.getPolicyEngine().getRules()
      return {
        success: true,
        data: rules,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POLICY_LIST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.POLICY_GET_RULE, async (_event, payload) => {
    try {
      const rule = auditManager.getPolicyEngine().getRule(payload.ruleId)
      return {
        success: true,
        data: rule,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POLICY_GET_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.POLICY_REGISTER_RULE, async (_event, payload) => {
    try {
      auditManager.getPolicyEngine().registerRule(payload.rule)
      return {
        success: true,
        data: true,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POLICY_REGISTER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.POLICY_UNREGISTER_RULE, async (_event, payload) => {
    try {
      auditManager.getPolicyEngine().unregisterRule(payload.ruleId)
      return {
        success: true,
        data: true,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POLICY_UNREGISTER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.POLICY_EVALUATE, async (_event, payload) => {
    try {
      const result = auditManager.checkPolicy(payload.context)
      return {
        success: true,
        data: result,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POLICY_EVALUATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.POLICY_GET_VIOLATIONS, async (_event, payload) => {
    try {
      const violations = auditManager.getPolicyEngine().getViolations(payload.limit)
      return {
        success: true,
        data: violations,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POLICY_VIOLATIONS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })

  ipcMain.handle(IPC_CHANNELS.POLICY_GET_STATISTICS, async () => {
    try {
      const statistics = auditManager.getPolicyStatistics()
      return {
        success: true,
        data: statistics,
      } as IpcResponse
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POLICY_STATISTICS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      } as IpcResponse
    }
  })
}

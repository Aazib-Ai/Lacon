/**
 * Skill IPC Handlers — Phase 1
 *
 * Registers IPC handlers for all skill-related channels:
 * - skill:list   — List available skills (built-in + project)
 * - skill:get    — Get full skill by ID
 * - skill:create — Create a new user skill
 * - skill:compose — Compose up to 3 skills into a merged prompt
 * - skill:research — Research and create a new skill (stub)
 * - workspace:ensure — Ensure workspace exists for document
 * - workspace:getSession — Get session state for document
 */

import { ipcMain } from 'electron'

import { IPC_CHANNELS, type IpcResponse } from '@/shared/ipc-schema'
import type {
  SkillListRequest,
  SkillGetRequest,
  SkillCreateRequest,
  SkillComposeRequest,
  SkillResearchRequest,
} from '@/shared/writer-types'

import { getSkillService } from '../services/skill-service'
import { getProjectWorkspaceService } from '../services/project-workspace-service'
import { redactObject } from '../security/log-redaction'

/**
 * Generic handler wrapper matching the pattern in handlers.ts
 */
async function handleSkillIpc<T>(
  channel: string,
  payload: any,
  handler: () => Promise<IpcResponse<T>>,
): Promise<IpcResponse<T>> {
  try {
    console.log(`[IPC] ${channel}`, redactObject(payload))
    const response = await handler()
    console.log(`[IPC] ${channel} -> success`)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[IPC] ${channel} error:`, message)
    return {
      success: false,
      error: {
        code: 'SKILL_ERROR',
        message,
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    }
  }
}

/**
 * Register all skill and workspace IPC handlers.
 * Call this from the main process initialization.
 */
export function registerSkillHandlers(): void {
  const skillService = getSkillService()

  // ── skill:list ──
  ipcMain.handle(
    IPC_CHANNELS.SKILL_LIST,
    async (_event, payload: SkillListRequest & { documentId?: string }) => {
      return handleSkillIpc(IPC_CHANNELS.SKILL_LIST, payload, async () => {
        const skills = skillService.listSkills(payload?.documentId, {
          source: payload?.source,
          tag: payload?.tag,
        })
        return { success: true, data: skills }
      })
    },
  )

  // ── skill:get ──
  ipcMain.handle(
    IPC_CHANNELS.SKILL_GET,
    async (_event, payload: SkillGetRequest & { documentId?: string }) => {
      return handleSkillIpc(IPC_CHANNELS.SKILL_GET, payload, async () => {
        const skill = skillService.getSkill(payload.id, payload.documentId)
        if (!skill) {
          return {
            success: false,
            error: {
              code: 'SKILL_NOT_FOUND',
              message: `Skill not found: ${payload.id}`,
            },
          }
        }
        return { success: true, data: skill }
      })
    },
  )

  // ── skill:create ──
  ipcMain.handle(
    IPC_CHANNELS.SKILL_CREATE,
    async (
      _event,
      payload: SkillCreateRequest & { documentId: string },
    ) => {
      return handleSkillIpc(IPC_CHANNELS.SKILL_CREATE, payload, async () => {
        if (!payload.documentId) {
          return {
            success: false,
            error: {
              code: 'MISSING_DOCUMENT_ID',
              message: 'documentId is required to create a skill',
            },
          }
        }
        const skill = skillService.createSkill(payload.documentId, {
          name: payload.name,
          description: payload.description,
          content: payload.content,
          tags: payload.tags,
          rubric: payload.rubric,
        })
        return { success: true, data: skill }
      })
    },
  )

  // ── skill:compose ──
  ipcMain.handle(
    IPC_CHANNELS.SKILL_COMPOSE,
    async (
      _event,
      payload: SkillComposeRequest & { documentId?: string },
    ) => {
      return handleSkillIpc(IPC_CHANNELS.SKILL_COMPOSE, payload, async () => {
        const composed = skillService.composeSkills(
          payload.skillIds,
          payload.documentId,
        )
        return { success: true, data: composed }
      })
    },
  )

  // ── skill:research ──
  ipcMain.handle(
    IPC_CHANNELS.SKILL_RESEARCH,
    async (
      _event,
      payload: SkillResearchRequest & { documentId: string },
    ) => {
      return handleSkillIpc(
        IPC_CHANNELS.SKILL_RESEARCH,
        payload,
        async () => {
          if (!payload.documentId) {
            return {
              success: false,
              error: {
                code: 'MISSING_DOCUMENT_ID',
                message: 'documentId is required to research a skill',
              },
            }
          }
          const skill = await skillService.researchAndCreateSkill(
            payload.documentId,
            payload.topic,
          )
          return { success: true, data: skill }
        },
      )
    },
  )

  // ── workspace:ensure ──
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_ENSURE,
    async (_event, payload: { documentId: string }) => {
      return handleSkillIpc(
        IPC_CHANNELS.WORKSPACE_ENSURE,
        payload,
        async () => {
          const ws = getProjectWorkspaceService()
          const workspace = ws.ensureWorkspace(payload.documentId)
          return { success: true, data: workspace }
        },
      )
    },
  )

  // ── workspace:getSession ──
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_GET_SESSION,
    async (_event, payload: { documentId: string }) => {
      return handleSkillIpc(
        IPC_CHANNELS.WORKSPACE_GET_SESSION,
        payload,
        async () => {
          const ws = getProjectWorkspaceService()
          const session = ws.getSession(payload.documentId)
          return { success: true, data: session }
        },
      )
    },
  )

  console.log('[IPC] Skill & workspace handlers registered')
}

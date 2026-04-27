/**
 * Writer Loop IPC Handlers — Phase 2
 *
 * Registers IPC handlers for all writer-loop and planner channels:
 * - writerLoop:getState        — Current loop stage + session
 * - writerLoop:startPlanning   — Begin planning → generate outline
 * - writerLoop:getOutline      — Retrieve current outline
 * - writerLoop:updateOutline   — Replace outline (full update)
 * - writerLoop:updateSection   — Edit a single section
 * - writerLoop:addSection      — Add a new section
 * - writerLoop:removeSection   — Remove a section
 * - writerLoop:addSubsection   — Add a subsection
 * - writerLoop:removeSubsection — Remove a subsection
 * - writerLoop:approveOutline  — Approve + auto-snapshot → generating
 * - writerLoop:updateConfig    — Update word target, automation level, etc.
 * - writerLoop:transition      — Force a manual stage transition
 * - writerLoop:pause           — Pause the loop
 * - writerLoop:reset           — Reset to idle
 * - workspace:updateSession    — Update session directly
 */

import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'

import { type IpcResponse, IPC_CHANNELS } from '@/shared/ipc-schema'
import type { OutlineSection, OutlineSubsection, WriterOutline } from '@/shared/writer-types'

import { getReviewer } from '../agent/reviewer'
import { getWriterLoop } from '../agent/writer-loop'
import { redactObject } from '../security/log-redaction'
import { getProjectWorkspaceService } from '../services/project-workspace-service'

/**
 * Generic handler wrapper (same pattern as skill-handlers.ts)
 */
async function handleWriterIpc<T>(
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
        code: 'WRITER_LOOP_ERROR',
        message,
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    }
  }
}

/**
 * Register all writer-loop IPC handlers.
 * Call this from the main process initialization.
 */
export function registerWriterLoopHandlers(): void {
  // ── writerLoop:getState ──
  ipcMain.handle(IPC_CHANNELS.WRITER_LOOP_GET_STATE, async (_event, payload: { documentId: string }) => {
    return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_GET_STATE, payload, async () => {
      const loop = getWriterLoop(payload.documentId)
      const session = loop.getSession()
      const outline = loop.getOutline()
      return { success: true, data: { session, outline } }
    })
  })

  // ── writerLoop:startPlanning ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_START_PLANNING,
    async (
      _event,
      payload: {
        documentId: string
        instruction: string
        composedSkillPrompt?: string
        researchContext?: any
      },
    ) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_START_PLANNING, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const outline = loop.startPlanning(
          payload.instruction,
          payload.composedSkillPrompt || '',
          payload.researchContext,
        )
        return { success: true, data: outline }
      })
    },
  )

  // ── writerLoop:getOutline ──
  ipcMain.handle(IPC_CHANNELS.WRITER_LOOP_GET_OUTLINE, async (_event, payload: { documentId: string }) => {
    return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_GET_OUTLINE, payload, async () => {
      const loop = getWriterLoop(payload.documentId)
      const outline = loop.getOutline()
      return { success: true, data: outline }
    })
  })

  // ── writerLoop:updateOutline ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_UPDATE_OUTLINE,
    async (_event, payload: { documentId: string; outline: WriterOutline }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_UPDATE_OUTLINE, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const updated = loop.updateOutline(payload.outline)
        return { success: true, data: updated }
      })
    },
  )

  // ── writerLoop:updateSection ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_UPDATE_SECTION,
    async (_event, payload: { documentId: string; sectionId: string; updates: Partial<OutlineSection> }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_UPDATE_SECTION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const updated = loop.updateSection(payload.sectionId, payload.updates)
        return { success: true, data: updated }
      })
    },
  )

  // ── writerLoop:addSection ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_ADD_SECTION,
    async (_event, payload: { documentId: string; section?: Partial<OutlineSection> }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_ADD_SECTION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const section: OutlineSection = {
          id: randomUUID(),
          title: payload.section?.title || 'New Section',
          keyPoints: payload.section?.keyPoints || [],
          subsections: [],
          estimatedWords: payload.section?.estimatedWords || 300,
        }
        const updated = loop.addSection(section)
        return { success: true, data: updated }
      })
    },
  )

  // ── writerLoop:removeSection ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_REMOVE_SECTION,
    async (_event, payload: { documentId: string; sectionId: string }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_REMOVE_SECTION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const updated = loop.removeSection(payload.sectionId)
        return { success: true, data: updated }
      })
    },
  )

  // ── writerLoop:addSubsection ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_ADD_SUBSECTION,
    async (
      _event,
      payload: {
        documentId: string
        sectionId: string
        subsection?: Partial<OutlineSubsection>
      },
    ) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_ADD_SUBSECTION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const subsection: OutlineSubsection = {
          id: randomUUID(),
          title: payload.subsection?.title || 'New Subsection',
          keyPoints: payload.subsection?.keyPoints || [],
          estimatedWords: payload.subsection?.estimatedWords || 150,
        }
        const updated = loop.addSubsection(payload.sectionId, subsection)
        return { success: true, data: updated }
      })
    },
  )

  // ── writerLoop:removeSubsection ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_REMOVE_SUBSECTION,
    async (_event, payload: { documentId: string; sectionId: string; subsectionId: string }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_REMOVE_SUBSECTION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const updated = loop.removeSubsection(payload.sectionId, payload.subsectionId)
        return { success: true, data: updated }
      })
    },
  )

  // ── writerLoop:approveOutline ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_APPROVE_OUTLINE,
    async (_event, payload: { documentId: string; documentContent?: any }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_APPROVE_OUTLINE, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const session = loop.approveOutline(payload.documentContent)
        return { success: true, data: session }
      })
    },
  )

  // ── writerLoop:updateConfig ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_UPDATE_CONFIG,
    async (
      _event,
      payload: {
        documentId: string
        wordTarget?: number
        automationLevel?: any
        activeSkillIds?: string[]
        modelConfig?: { providerId: string; modelId: string }
      },
    ) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_UPDATE_CONFIG, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const { documentId: _docId, ...updates } = payload
        const session = loop.updateSessionConfig(updates)
        return { success: true, data: session }
      })
    },
  )

  // ── writerLoop:transition ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_TRANSITION,
    async (_event, payload: { documentId: string; stage: string }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_TRANSITION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const session = loop.transition(payload.stage as any)
        return { success: true, data: session }
      })
    },
  )

  // ── writerLoop:pause ──
  ipcMain.handle(IPC_CHANNELS.WRITER_LOOP_PAUSE, async (_event, payload: { documentId: string }) => {
    return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_PAUSE, payload, async () => {
      const loop = getWriterLoop(payload.documentId)
      const session = loop.pause()
      return { success: true, data: session }
    })
  })

  // ── writerLoop:reset ──
  ipcMain.handle(IPC_CHANNELS.WRITER_LOOP_RESET, async (_event, payload: { documentId: string }) => {
    return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_RESET, payload, async () => {
      const loop = getWriterLoop(payload.documentId)
      const session = loop.reset()
      return { success: true, data: session }
    })
  })

  // ── workspace:updateSession ──
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_SESSION,
    async (_event, payload: { documentId: string; updates: any }) => {
      return handleWriterIpc(IPC_CHANNELS.WORKSPACE_UPDATE_SESSION, payload, async () => {
        const ws = getProjectWorkspaceService()
        const session = ws.updateSession(payload.documentId, payload.updates)
        return { success: true, data: session }
      })
    },
  )

  // ── Phase 3: Generator IPC ──

  // ── writerLoop:generateSection ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_GENERATE_SECTION,
    async (_event, payload: { documentId: string; sectionId: string }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_GENERATE_SECTION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const result = loop.generateSection(payload.sectionId)
        return { success: true, data: result }
      })
    },
  )

  // ── writerLoop:generateAll ──
  ipcMain.handle(IPC_CHANNELS.WRITER_LOOP_GENERATE_ALL, async (_event, payload: { documentId: string }) => {
    return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_GENERATE_ALL, payload, async () => {
      const loop = getWriterLoop(payload.documentId)
      const progress = loop.generateAll()
      return { success: true, data: progress }
    })
  })

  // ── writerLoop:getProgress ──
  ipcMain.handle(IPC_CHANNELS.WRITER_LOOP_GET_PROGRESS, async (_event, payload: { documentId: string }) => {
    return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_GET_PROGRESS, payload, async () => {
      const loop = getWriterLoop(payload.documentId)
      const progress = loop.getProgress()
      return { success: true, data: progress }
    })
  })

  // ── writerLoop:acceptGeneration ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_ACCEPT_GENERATION,
    async (_event, payload: { documentId: string; sectionId: string }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_ACCEPT_GENERATION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const result = loop.acceptGeneration(payload.sectionId)
        return { success: true, data: result }
      })
    },
  )

  // ── writerLoop:rejectGeneration ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_REJECT_GENERATION,
    async (_event, payload: { documentId: string; sectionId: string }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_REJECT_GENERATION, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        loop.rejectGeneration(payload.sectionId)
        return { success: true, data: null }
      })
    },
  )

  // ── Phase 4: Reviewer IPC ──

  // ── writerLoop:runReview ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_RUN_REVIEW,
    async (_event, payload: { documentId: string; documentContent: any }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_RUN_REVIEW, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const outline = loop.getOutline()
        const reviewer = getReviewer(payload.documentId)

        // Extract paragraphs from document content
        const paragraphs = extractParagraphs(payload.documentContent)

        // Create pre-review snapshot
        loop.createSnapshot('before-review', payload.documentContent)

        // Transition to reviewing if not already
        const stage = loop.getStage()
        if (stage === 'generating') {
          loop.transition('reviewing')
        }

        const contentText = paragraphs.map(p => p.text).join('\n\n')
        const result = reviewer.runReview(contentText, outline, paragraphs)
        return { success: true, data: result }
      })
    },
  )

  // ── writerLoop:getReview ──
  ipcMain.handle(IPC_CHANNELS.WRITER_LOOP_GET_REVIEW, async (_event, payload: { documentId: string }) => {
    return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_GET_REVIEW, payload, async () => {
      const reviewer = getReviewer(payload.documentId)
      const result = reviewer.getLatestResult()
      return {
        success: true,
        data: { result, passCount: reviewer.getPassCount(), canAutoPass: reviewer.canAutoPass() },
      }
    })
  })

  // ── writerLoop:acceptReviewFlag ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_ACCEPT_REVIEW_FLAG,
    async (_event, payload: { documentId: string; flagId: string }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_ACCEPT_REVIEW_FLAG, payload, async () => {
        // Flag acceptance is tracked by the UI; here we just acknowledge
        return { success: true, data: { flagId: payload.flagId, accepted: true } }
      })
    },
  )

  // ── writerLoop:rejectReviewFlag ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_REJECT_REVIEW_FLAG,
    async (_event, payload: { documentId: string; flagId: string }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_REJECT_REVIEW_FLAG, payload, async () => {
        return { success: true, data: { flagId: payload.flagId, accepted: false } }
      })
    },
  )

  // ── writerLoop:surgicalEdit ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_SURGICAL_EDIT,
    async (
      _event,
      payload: { documentId: string; paragraphId: string; instruction: string; fullDocumentContent: any },
    ) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_SURGICAL_EDIT, payload, async () => {
        const reviewer = getReviewer(payload.documentId)
        const paragraphs = extractParagraphs(payload.fullDocumentContent)
        const target = paragraphs.find(p => p.id === payload.paragraphId)
        if (!target) {
          throw new Error(`Paragraph not found: ${payload.paragraphId}`)
        }

        const result = reviewer.surgicalEdit(
          payload.paragraphId,
          target.text,
          payload.instruction,
          payload.fullDocumentContent,
        )
        return { success: true, data: result }
      })
    },
  )

  // ── writerLoop:rewriteAll ──
  ipcMain.handle(
    IPC_CHANNELS.WRITER_LOOP_REWRITE_ALL,
    async (_event, payload: { documentId: string; instruction: string; documentContent: any }) => {
      return handleWriterIpc(IPC_CHANNELS.WRITER_LOOP_REWRITE_ALL, payload, async () => {
        const loop = getWriterLoop(payload.documentId)
        const reviewer = getReviewer(payload.documentId)

        // Pre-snapshot before rewrite
        loop.createSnapshot('before-review', payload.documentContent)

        const contentText =
          typeof payload.documentContent === 'string'
            ? payload.documentContent
            : JSON.stringify(payload.documentContent)

        const result = reviewer.rewriteAll(contentText, payload.instruction)
        return { success: true, data: result }
      })
    },
  )

  console.log('[IPC] Writer loop handlers registered (Phases 2-4)')
}

/**
 * Extract paragraphs from TipTap JSON document content.
 */
function extractParagraphs(docContent: any): Array<{ id: string; text: string }> {
  if (!docContent || !docContent.content) {return []}
  const result: Array<{ id: string; text: string }> = []
  for (const node of docContent.content) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const id = node.attrs?.paragraphId || `auto-${result.length}`
      const text = extractNodeText(node)
      result.push({ id, text })
    }
  }
  return result
}

function extractNodeText(node: any): string {
  if (!node) {return ''}
  if (node.text) {return node.text}
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractNodeText).join('')
  }
  return ''
}

/**
 * Agent Context Assembly Pipeline
 * Phase 6: Epic P6-E1, Task P6-T3
 */

import type { AgentRunContext } from '../../shared/agent-types'

export interface AssembledContext {
  documentContext?: {
    documentId: string
    content: unknown
    selection?: { from: number; to: number }
  }
  userInstruction?: string
  toolMemory: Map<string, unknown>
  previousResults: unknown[]
}

export class ContextAssembler {
  /**
   * P6-T3.1: Extract document context
   */
  extractDocumentContext(runContext: AgentRunContext):
    | {
        documentId: string
        content: unknown
        selection?: { from: number; to: number }
      }
    | undefined {
    if (!runContext.documentContext) {
      return undefined
    }

    return {
      documentId: runContext.documentContext.documentId,
      content: runContext.documentContext.content,
      selection: runContext.documentContext.selection,
    }
  }

  /**
   * P6-T3.2: Extract user instruction context
   */
  extractUserInstruction(runContext: AgentRunContext): string | undefined {
    return runContext.userInstruction
  }

  /**
   * P6-T3.3: Extract tool memory and trace context
   */
  extractToolMemory(runContext: AgentRunContext): {
    memory: Map<string, unknown>
    previousResults: unknown[]
  } {
    const previousResults = runContext.tasks
      .filter(task => task.status === 'success' && task.output)
      .map(task => task.output)

    return {
      memory: runContext.toolMemory,
      previousResults,
    }
  }

  /**
   * Assemble complete context for agent execution
   */
  assemble(runContext: AgentRunContext): AssembledContext {
    const documentContext = this.extractDocumentContext(runContext)
    const userInstruction = this.extractUserInstruction(runContext)
    const { memory, previousResults } = this.extractToolMemory(runContext)

    return {
      documentContext,
      userInstruction,
      toolMemory: memory,
      previousResults,
    }
  }

  /**
   * Update tool memory with new result
   */
  updateToolMemory(runContext: AgentRunContext, toolName: string, result: unknown): void {
    runContext.toolMemory.set(toolName, result)
  }

  /**
   * Clear tool memory
   */
  clearToolMemory(runContext: AgentRunContext): void {
    runContext.toolMemory.clear()
  }

  /**
   * Get tool memory entry
   */
  getToolMemory(runContext: AgentRunContext, toolName: string): unknown {
    return runContext.toolMemory.get(toolName)
  }
}

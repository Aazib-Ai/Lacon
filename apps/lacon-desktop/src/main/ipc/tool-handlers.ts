/**
 * IPC Handlers for Phase 8 Tools
 * Exposes tool execution to renderer process
 */

import type { IpcMainInvokeEvent } from 'electron'
import { ipcMain } from 'electron'

import { getToolRegistry } from '../tools/tool-registry'

/**
 * Register all tool IPC handlers
 */
export function registerToolHandlers(workspaceRoot: string): void {
  const toolRegistry = getToolRegistry(workspaceRoot)

  // List all available tools
  ipcMain.handle('tools:list', async (_event: IpcMainInvokeEvent) => {
    try {
      return {
        success: true,
        tools: toolRegistry.listTools(),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tools',
      }
    }
  })

  // Get tools by category
  ipcMain.handle('tools:list-by-category', async (_event: IpcMainInvokeEvent, category: string) => {
    try {
      return {
        success: true,
        tools: toolRegistry.getToolsByCategory(category),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tools by category',
      }
    }
  })

  // Execute a tool
  ipcMain.handle('tools:execute', async (_event: IpcMainInvokeEvent, toolName: string, input: unknown) => {
    try {
      const tool = toolRegistry.getTool(toolName)
      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolName}`,
        }
      }

      const output = await toolRegistry.executeTool(toolName, input)

      return {
        success: true,
        output,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      }
    }
  })

  // Execute authoring tool (rewrite, shorten, expand, polish, tone-adjust)
  ipcMain.handle('tools:authoring', async (_event: IpcMainInvokeEvent, toolName: string, input: unknown) => {
    try {
      const validTools = ['rewrite-text', 'shorten-text', 'expand-text', 'polish-text', 'tone-adjust']
      if (!validTools.includes(toolName)) {
        return {
          success: false,
          error: `Invalid authoring tool: ${toolName}`,
        }
      }

      const output = await toolRegistry.executeTool(toolName, input)

      return {
        success: true,
        output,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authoring tool execution failed',
      }
    }
  })

  // Execute workspace QA
  ipcMain.handle('tools:workspace-qa', async (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const output = await toolRegistry.executeTool('workspace-qa', input)

      return {
        success: true,
        output,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Workspace QA failed',
      }
    }
  })

  // Execute web research
  ipcMain.handle('tools:web-research', async (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const output = await toolRegistry.executeTool('web-research', input)

      return {
        success: true,
        output,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Web research failed',
      }
    }
  })

  // Execute YouTube transcript fetch
  ipcMain.handle('tools:youtube-transcript', async (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const output = await toolRegistry.executeTool('youtube-transcript', input)

      return {
        success: true,
        output,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'YouTube transcript fetch failed',
      }
    }
  })

  // Execute tone analyzer
  ipcMain.handle('tools:tone-analyzer', async (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const output = await toolRegistry.executeTool('tone-analyzer', input)

      return {
        success: true,
        output,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tone analysis failed',
      }
    }
  })

  // Execute B-roll generator
  ipcMain.handle('tools:broll-generator', async (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const output = await toolRegistry.executeTool('broll-generator', input)

      return {
        success: true,
        output,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'B-roll generation failed',
      }
    }
  })
}

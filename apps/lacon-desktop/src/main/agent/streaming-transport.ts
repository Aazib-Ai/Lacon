/**
 * Streaming Transport for Agent Runtime
 * Phase 6: Epic P6-E3, Task P6-T7
 */

import type { BrowserWindow } from 'electron'

import type { StreamingToken } from '../../shared/agent-types'
import { StreamAccumulator } from './stream-accumulator'

export interface StreamChunk {
  runId: string
  taskId: string
  type: 'token' | 'partial' | 'complete' | 'error'
  data: unknown
  timestamp: number
}

export class StreamingTransport {
  private window: BrowserWindow | null = null
  private activeStreams: Map<string, StreamAccumulator> = new Map()

  /**
   * Set the target window for streaming
   */
  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  /**
   * P6-T7.1: Send token stream to renderer
   */
  sendToken(token: StreamingToken): void {
    if (!this.window) {
      console.warn('No window set for streaming transport')
      return
    }

    const chunk: StreamChunk = {
      runId: token.runId,
      taskId: token.taskId,
      type: 'token',
      data: token.token,
      timestamp: token.timestamp,
    }

    // P6-T7.2: Accumulate partial output
    this.accumulateToken(token)

    // Send to renderer
    this.window.webContents.send('agent:stream', chunk)
  }

  /**
   * P6-T7.2: Accumulate partial output
   */
  private accumulateToken(token: StreamingToken): void {
    const key = `${token.runId}-${token.taskId}`
    let accumulator = this.activeStreams.get(key)

    if (!accumulator) {
      accumulator = new StreamAccumulator(token.runId, token.taskId)
      this.activeStreams.set(key, accumulator)
    }

    accumulator.addToken(token.token)
  }

  /**
   * P6-T7.3: Finalize stream and send complete output
   */
  finalizeStream(runId: string, taskId: string, output: unknown): void {
    if (!this.window) {
      console.warn('No window set for streaming transport')
      return
    }

    const key = `${runId}-${taskId}`
    const accumulator = this.activeStreams.get(key)

    const chunk: StreamChunk = {
      runId,
      taskId,
      type: 'complete',
      data: {
        accumulated: accumulator?.getAccumulated() || '',
        final: output,
      },
      timestamp: Date.now(),
    }

    // Send to renderer
    this.window.webContents.send('agent:stream', chunk)

    // Clean up accumulator
    this.activeStreams.delete(key)
  }

  /**
   * Send error to renderer
   */
  sendError(runId: string, taskId: string, error: Error): void {
    if (!this.window) {
      console.warn('No window set for streaming transport')
      return
    }

    const chunk: StreamChunk = {
      runId,
      taskId,
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack,
      },
      timestamp: Date.now(),
    }

    this.window.webContents.send('agent:stream', chunk)

    // Clean up accumulator
    const key = `${runId}-${taskId}`
    this.activeStreams.delete(key)
  }

  /**
   * Send partial output update
   */
  sendPartial(runId: string, taskId: string, partial: unknown): void {
    if (!this.window) {
      console.warn('No window set for streaming transport')
      return
    }

    const chunk: StreamChunk = {
      runId,
      taskId,
      type: 'partial',
      data: partial,
      timestamp: Date.now(),
    }

    this.window.webContents.send('agent:stream', chunk)
  }

  /**
   * Clear all active streams
   */
  clearStreams(): void {
    this.activeStreams.clear()
  }

  /**
   * Get accumulated output for a stream
   */
  getAccumulated(runId: string, taskId: string): string {
    const key = `${runId}-${taskId}`
    const accumulator = this.activeStreams.get(key)
    return accumulator?.getAccumulated() || ''
  }
}

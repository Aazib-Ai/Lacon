/**
 * Writer Loop — Type-Safe Event Emitter
 *
 * Provides a minimal, focused event bus for the writer loop.
 * Decoupled from the loop class so it can be injected into sub-modules.
 */

// ─────────────────────────── Types ───────────────────────────

export type WriterLoopEventType =
  | 'stage-changed'
  | 'outline-generated'
  | 'outline-approved'
  | 'snapshot-created'
  | 'session-updated'
  | 'generation-progress'
  | 'generation-complete'
  | 'review-complete'
  | 'preflight-step'
  | 'preflight-complete'
  | 'error'

export interface WriterLoopEvent {
  type: WriterLoopEventType
  documentId: string
  payload: any
}

export type WriterLoopListener = (event: WriterLoopEvent) => void

// ─────────────────────────── Event Emitter ───────────────────────────

export class WriterLoopEventEmitter {
  private documentId: string
  private listeners: WriterLoopListener[] = []

  constructor(documentId: string) {
    this.documentId = documentId
  }

  on(listener: WriterLoopListener): void {
    this.listeners.push(listener)
  }

  off(listener: WriterLoopListener): void {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  emit(type: WriterLoopEventType, payload: any): void {
    const event: WriterLoopEvent = { type, documentId: this.documentId, payload }
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[WriterLoop] Listener error:', err)
      }
    }
  }
}

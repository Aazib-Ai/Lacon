/**
 * Writer Loop — Barrel Export
 *
 * Re-exports all public types and functions so that existing imports
 * like `from '../agent/writer-loop'` continue to work unchanged.
 */

// Core class
export { WriterLoop } from './writer-loop'

// Registry (main public API)
export { getWriterLoop, disposeWriterLoop } from './registry'

// Event types (used by IPC handlers and renderer)
export type {
  WriterLoopEventType,
  WriterLoopEvent,
  WriterLoopListener,
} from './event-emitter'

// Re-export outline generation for any direct callers
export { OutlineManager } from './outline-manager'
export { SectionGenerator } from './generator'
export { SnapshotManager } from './snapshot-manager'
export { WriterStateMachine } from './writer-state-machine'
export { WriterLoopEventEmitter } from './event-emitter'

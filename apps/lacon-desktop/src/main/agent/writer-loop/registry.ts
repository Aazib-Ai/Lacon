/**
 * Writer Loop — Registry
 *
 * Singleton registry that keeps one WriterLoop instance per documentId
 * so state isn't lost across IPC calls.
 */

import { WriterLoop } from './writer-loop'

const loops = new Map<string, WriterLoop>()

export function getWriterLoop(documentId: string): WriterLoop {
  let loop = loops.get(documentId)
  if (!loop) {
    loop = new WriterLoop(documentId)
    loops.set(documentId, loop)
  }
  return loop
}

export function disposeWriterLoop(documentId: string): void {
  loops.delete(documentId)
}

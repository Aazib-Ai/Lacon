import { describe, expect, it } from 'vitest'

import { CollaborationService } from '../../src/main/services/collaboration-service'

describe('CollaborationService', () => {
  it('creates a shared document session and adds members', () => {
    const service = new CollaborationService()

    service.createSharedDocument('doc-1', {
      userId: 'owner-1',
      displayName: 'Owner',
    })

    const updated = service.addMember('doc-1', {
      userId: 'editor-1',
      displayName: 'Editor',
      role: 'editor',
    })

    expect(updated.members).toHaveLength(2)
    expect(updated.members[1].role).toBe('editor')
  })

  it('tracks presence and resolves revision conflicts', () => {
    const service = new CollaborationService()
    service.createSharedDocument('doc-1', {
      userId: 'owner-1',
      displayName: 'Owner',
    })

    service.updatePresence({
      userId: 'owner-1',
      documentId: 'doc-1',
      status: 'active',
      cursorPos: 4,
      selection: { from: 4, to: 4 },
    })

    const first = service.applyOperation({
      opId: 'op-1',
      documentId: 'doc-1',
      actorId: 'owner-1',
      baseRevision: 0,
      timestamp: Date.now(),
      patch: { from: 0, to: 0, insertText: 'hello' },
    })

    const second = service.applyOperation({
      opId: 'op-2',
      documentId: 'doc-1',
      actorId: 'owner-1',
      baseRevision: 0,
      timestamp: Date.now(),
      patch: { from: 5, to: 5, insertText: ' world' },
    })

    expect(service.listPresence('doc-1')).toHaveLength(1)
    expect(first.revision).toBe(1)
    expect(second.conflict).toBeDefined()
    expect(second.content).toContain('hello world')
  })
})

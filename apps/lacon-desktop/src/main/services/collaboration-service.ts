import { randomUUID } from 'crypto'

import type {
  CollaborationMember,
  OperationConflict,
  PresenceIndicator,
  SharedDocumentModel,
  SharedDocumentOperation,
} from '../../shared/phase12-types'

export class CollaborationService {
  private sessions = new Map<string, SharedDocumentModel>()
  private presence = new Map<string, PresenceIndicator>()

  createSharedDocument(documentId: string, owner: Omit<CollaborationMember, 'role' | 'joinedAt'>): SharedDocumentModel {
    const now = Date.now()
    const session: SharedDocumentModel = {
      documentId,
      revision: 0,
      members: [{ ...owner, role: 'owner', joinedAt: now }],
      latestContent: '',
      operations: [],
      conflicts: [],
      updatedAt: now,
    }

    this.sessions.set(documentId, session)
    return session
  }

  getSharedDocument(documentId: string): SharedDocumentModel | null {
    return this.sessions.get(documentId) ?? null
  }

  addMember(documentId: string, member: Omit<CollaborationMember, 'joinedAt'>): SharedDocumentModel {
    const session = this.requireSession(documentId)
    const now = Date.now()

    if (session.members.some(m => m.userId === member.userId)) {
      return session
    }

    session.members.push({ ...member, joinedAt: now })
    session.updatedAt = now
    return session
  }

  updateMemberRole(documentId: string, userId: string, role: CollaborationMember['role']): SharedDocumentModel {
    const session = this.requireSession(documentId)
    const member = session.members.find(m => m.userId === userId)

    if (!member) {
      throw new Error(`Member not found: ${userId}`)
    }

    member.role = role
    session.updatedAt = Date.now()
    return session
  }

  updatePresence(indicator: Omit<PresenceIndicator, 'updatedAt'>): PresenceIndicator {
    this.requireSession(indicator.documentId)
    const entry: PresenceIndicator = {
      ...indicator,
      updatedAt: Date.now(),
    }

    this.presence.set(this.presenceKey(indicator.documentId, indicator.userId), entry)
    return entry
  }

  listPresence(documentId: string): PresenceIndicator[] {
    this.requireSession(documentId)
    return Array.from(this.presence.values())
      .filter(item => item.documentId === documentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  applyOperation(operation: SharedDocumentOperation): {
    revision: number
    content: string
    conflict?: OperationConflict
  } {
    const session = this.requireSession(operation.documentId)
    const now = Date.now()
    let conflict: OperationConflict | undefined

    if (operation.baseRevision !== session.revision) {
      conflict = {
        conflictId: `conflict_${randomUUID()}`,
        documentId: operation.documentId,
        incomingOpId: operation.opId,
        againstOpId: session.operations.at(-1)?.opId ?? 'none',
        strategy: 'last-writer-wins',
        resolved: true,
        resolvedPatch: operation.patch,
        createdAt: now,
      }
      session.conflicts.push(conflict)
    }

    const before = session.latestContent.slice(0, operation.patch.from)
    const after = session.latestContent.slice(operation.patch.to)
    session.latestContent = `${before}${operation.patch.insertText}${after}`

    session.operations.push(operation)
    session.revision += 1
    session.updatedAt = now

    return {
      revision: session.revision,
      content: session.latestContent,
      conflict,
    }
  }

  private requireSession(documentId: string): SharedDocumentModel {
    const session = this.sessions.get(documentId)
    if (!session) {
      throw new Error(`Shared document session not found: ${documentId}`)
    }

    return session
  }

  private presenceKey(documentId: string, userId: string): string {
    return `${documentId}:${userId}`
  }
}

let collaborationService: CollaborationService | null = null

export function getCollaborationService(): CollaborationService {
  if (!collaborationService) {
    collaborationService = new CollaborationService()
  }

  return collaborationService
}

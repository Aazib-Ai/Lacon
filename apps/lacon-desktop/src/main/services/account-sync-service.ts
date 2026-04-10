import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto'

import type {
  AccountIdentity,
  AccountSession,
  RecoveryMethod,
  RestoreSnapshot,
  SyncQueueItem,
  SyncRecord,
  TenantWorkspaceBoundary,
} from '../../shared/phase12-types'

interface EncryptedBlob {
  iv: string
  authTag: string
  value: string
}

export class AccountSyncService {
  private accounts = new Map<string, AccountIdentity>()
  private sessions = new Map<string, AccountSession>()
  private recoveryMethods = new Map<string, RecoveryMethod[]>()
  private tenantBoundaries = new Map<string, TenantWorkspaceBoundary>()
  private syncQueue: SyncQueueItem[] = []
  private syncRecords: SyncRecord[] = []
  private restoreSnapshots: RestoreSnapshot[] = []

  createTenantWorkspace(tenantId: string, workspaceId: string, displayName: string, createdBy: string) {
    const boundary: TenantWorkspaceBoundary = {
      tenantId,
      workspaceId,
      displayName,
      createdBy,
      createdAt: Date.now(),
    }

    this.tenantBoundaries.set(this.boundaryKey(tenantId, workspaceId), boundary)
    return boundary
  }

  registerAccount(email: string, displayName: string, tenantId: string, mfaEnabled: boolean): AccountIdentity {
    const account: AccountIdentity = {
      accountId: `acct_${randomUUID()}`,
      email,
      displayName,
      tenantId,
      createdAt: Date.now(),
      securityPosture: {
        mfaEnabled,
        riskLevel: mfaEnabled ? 'low' : 'medium',
      },
    }

    this.accounts.set(account.accountId, account)
    return account
  }

  createSession(accountId: string, deviceId: string, durationMs: number): AccountSession {
    const account = this.accounts.get(accountId)

    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    const now = Date.now()
    const session: AccountSession = {
      sessionId: `session_${randomUUID()}`,
      accountId,
      tenantId: account.tenantId,
      deviceId,
      createdAt: now,
      expiresAt: now + durationMs,
    }

    this.sessions.set(session.sessionId, session)
    return session
  }

  addRecoveryMethod(accountId: string, type: RecoveryMethod['type']): RecoveryMethod {
    if (!this.accounts.has(accountId)) {
      throw new Error(`Account not found: ${accountId}`)
    }

    const method: RecoveryMethod = {
      methodId: `recovery_${randomUUID()}`,
      accountId,
      type,
      enrolledAt: Date.now(),
    }

    const current = this.recoveryMethods.get(accountId) ?? []
    current.push(method)
    this.recoveryMethods.set(accountId, current)

    return method
  }

  queueEncryptedSyncChange(input: {
    tenantId: string
    workspaceId: string
    deviceId: string
    documentId: string
    baseRevision: number
    plainPayload: string
    encryptionKey: string
  }): SyncQueueItem {
    this.assertBoundary(input.tenantId, input.workspaceId)

    const encryptedPayload = this.encrypt(input.plainPayload, input.encryptionKey)
    const item: SyncQueueItem = {
      queueId: `syncq_${randomUUID()}`,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      deviceId: input.deviceId,
      documentId: input.documentId,
      baseRevision: input.baseRevision,
      encryptedPayload,
      enqueuedAt: Date.now(),
    }

    this.syncQueue.push(item)
    return item
  }

  processSyncQueue(limit: number = 50): SyncRecord[] {
    const applied: SyncRecord[] = []
    const items = this.syncQueue.splice(0, Math.max(0, limit))

    for (const item of items) {
      const latestRevision = this.syncRecords
        .filter(r => r.workspaceId === item.workspaceId && r.documentId === item.documentId)
        .reduce((max, record) => Math.max(max, record.revision), 0)

      const record: SyncRecord = {
        syncId: `sync_${randomUUID()}`,
        tenantId: item.tenantId,
        workspaceId: item.workspaceId,
        documentId: item.documentId,
        revision: latestRevision + 1,
        encryptedPayload: item.encryptedPayload,
        appliedAt: Date.now(),
      }

      this.syncRecords.push(record)
      applied.push(record)
    }

    return applied
  }

  resolveConflict(input: {
    strategy: 'last-writer-wins' | 'manual-merge'
    localPayload: string
    remotePayload: string
    localTimestamp: number
    remoteTimestamp: number
  }): string {
    if (input.strategy === 'manual-merge') {
      return `${input.localPayload}\n---\n${input.remotePayload}`
    }

    return input.localTimestamp >= input.remoteTimestamp ? input.localPayload : input.remotePayload
  }

  createRestoreSnapshot(input: {
    accountId: string
    tenantId: string
    workspaceId: string
    sourceDeviceId: string
    plainState: string
    encryptionKey: string
  }): RestoreSnapshot {
    if (!this.accounts.has(input.accountId)) {
      throw new Error(`Account not found: ${input.accountId}`)
    }

    this.assertBoundary(input.tenantId, input.workspaceId)

    const snapshot: RestoreSnapshot = {
      snapshotId: `snapshot_${randomUUID()}`,
      accountId: input.accountId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      sourceDeviceId: input.sourceDeviceId,
      encryptedState: this.encrypt(input.plainState, input.encryptionKey),
      createdAt: Date.now(),
    }

    this.restoreSnapshots.push(snapshot)
    return snapshot
  }

  restoreSnapshotToDevice(snapshotId: string, encryptionKey: string): string {
    const snapshot = this.restoreSnapshots.find(item => item.snapshotId === snapshotId)

    if (!snapshot) {
      throw new Error(`Restore snapshot not found: ${snapshotId}`)
    }

    return this.decrypt(snapshot.encryptedState, encryptionKey)
  }

  getSyncStatus(workspaceId: string): {
    queued: number
    applied: number
    latestRevision: number
  } {
    const queued = this.syncQueue.filter(item => item.workspaceId === workspaceId).length
    const appliedRecords = this.syncRecords.filter(item => item.workspaceId === workspaceId)

    return {
      queued,
      applied: appliedRecords.length,
      latestRevision: appliedRecords.reduce((max, item) => Math.max(max, item.revision), 0),
    }
  }

  private assertBoundary(tenantId: string, workspaceId: string): void {
    if (!this.tenantBoundaries.has(this.boundaryKey(tenantId, workspaceId))) {
      throw new Error(`Unknown tenant/workspace boundary: ${tenantId}/${workspaceId}`)
    }
  }

  private boundaryKey(tenantId: string, workspaceId: string): string {
    return `${tenantId}:${workspaceId}`
  }

  private encrypt(value: string, secret: string): string {
    const key = createHash('sha256').update(secret).digest()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    const blob: EncryptedBlob = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      value: encrypted.toString('base64'),
    }

    return JSON.stringify(blob)
  }

  private decrypt(value: string, secret: string): string {
    const blob = JSON.parse(value) as EncryptedBlob
    const key = createHash('sha256').update(secret).digest()
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'))

    const decrypted = Buffer.concat([decipher.update(Buffer.from(blob.value, 'base64')), decipher.final()])

    return decrypted.toString('utf8')
  }
}

let accountSyncService: AccountSyncService | null = null

export function getAccountSyncService(): AccountSyncService {
  if (!accountSyncService) {
    accountSyncService = new AccountSyncService()
  }

  return accountSyncService
}

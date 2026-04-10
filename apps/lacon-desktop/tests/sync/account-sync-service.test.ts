import { describe, expect, it } from 'vitest'

import { AccountSyncService } from '../../src/main/services/account-sync-service'

describe('AccountSyncService', () => {
  it('creates tenant/account/session and applies encrypted sync queue', () => {
    const service = new AccountSyncService()

    service.createTenantWorkspace('tenant-1', 'workspace-1', 'Workspace', 'owner')
    const account = service.registerAccount('user@example.com', 'User', 'tenant-1', true)
    const session = service.createSession(account.accountId, 'device-1', 60_000)

    const queue = service.queueEncryptedSyncChange({
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      deviceId: 'device-1',
      documentId: 'doc-1',
      baseRevision: 0,
      plainPayload: 'hello',
      encryptionKey: 'secret',
    })

    const applied = service.processSyncQueue()
    const status = service.getSyncStatus('workspace-1')

    expect(session.accountId).toBe(account.accountId)
    expect(queue.encryptedPayload).not.toBe('hello')
    expect(applied).toHaveLength(1)
    expect(status.latestRevision).toBe(1)
  })

  it('creates restore snapshot and decrypts back to original payload', () => {
    const service = new AccountSyncService()
    service.createTenantWorkspace('tenant-1', 'workspace-1', 'Workspace', 'owner')
    const account = service.registerAccount('user@example.com', 'User', 'tenant-1', true)

    const snapshot = service.createRestoreSnapshot({
      accountId: account.accountId,
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      sourceDeviceId: 'device-a',
      plainState: '{"doc":"value"}',
      encryptionKey: 'restore-key',
    })

    const restored = service.restoreSnapshotToDevice(snapshot.snapshotId, 'restore-key')

    expect(restored).toBe('{"doc":"value"}')
  })
})

/**
 * Phase 12 shared contracts: collaboration, account/sync, and compliance.
 */

export type CollaborationRole = 'owner' | 'editor' | 'commenter' | 'viewer'
export type PresenceStatus = 'active' | 'idle' | 'offline'

export interface CollaborationMember {
  userId: string
  displayName: string
  role: CollaborationRole
  joinedAt: number
}

export interface RemoteSelection {
  from: number
  to: number
}

export interface PresenceIndicator {
  userId: string
  documentId: string
  status: PresenceStatus
  cursorPos: number
  selection: RemoteSelection
  updatedAt: number
}

export interface SharedDocumentOperation {
  opId: string
  documentId: string
  actorId: string
  baseRevision: number
  timestamp: number
  patch: {
    from: number
    to: number
    insertText: string
  }
}

export interface OperationConflict {
  conflictId: string
  documentId: string
  incomingOpId: string
  againstOpId: string
  strategy: 'last-writer-wins' | 'manual-merge'
  resolved: boolean
  resolvedPatch?: SharedDocumentOperation['patch']
  createdAt: number
}

export interface SharedDocumentModel {
  documentId: string
  revision: number
  members: CollaborationMember[]
  latestContent: string
  operations: SharedDocumentOperation[]
  conflicts: OperationConflict[]
  updatedAt: number
}

export type AccountRiskLevel = 'low' | 'medium' | 'high'

export interface AccountIdentity {
  accountId: string
  email: string
  displayName: string
  tenantId: string
  createdAt: number
  securityPosture: {
    mfaEnabled: boolean
    riskLevel: AccountRiskLevel
  }
}

export interface AccountSession {
  sessionId: string
  accountId: string
  tenantId: string
  deviceId: string
  createdAt: number
  expiresAt: number
  revokedAt?: number
}

export interface RecoveryMethod {
  methodId: string
  accountId: string
  type: 'backup-code' | 'email-otp' | 'authenticator-app'
  enrolledAt: number
  lastUsedAt?: number
}

export interface TenantWorkspaceBoundary {
  tenantId: string
  workspaceId: string
  displayName: string
  createdBy: string
  createdAt: number
}

export interface SyncQueueItem {
  queueId: string
  tenantId: string
  workspaceId: string
  deviceId: string
  documentId: string
  baseRevision: number
  encryptedPayload: string
  enqueuedAt: number
}

export interface SyncRecord {
  syncId: string
  tenantId: string
  workspaceId: string
  documentId: string
  revision: number
  encryptedPayload: string
  appliedAt: number
}

export interface RestoreSnapshot {
  snapshotId: string
  accountId: string
  tenantId: string
  workspaceId: string
  sourceDeviceId: string
  encryptedState: string
  createdAt: number
}

export interface ComplianceControl {
  controlId: string
  framework: 'SOC2' | 'ISO27001' | 'Internal'
  owner: string
  description: string
  mappedAt: number
}

export interface ComplianceEvidence {
  evidenceId: string
  controlId: string
  artifactPath: string
  artifactHash: string
  capturedBy: string
  capturedAt: number
}

export interface InternalAuditRun {
  auditId: string
  scope: string
  executedBy: string
  executedAt: number
  findings: string[]
}

export interface ExternalReadinessItem {
  itemId: string
  category: 'gap-remediation' | 'dry-run' | 'external-audit'
  summary: string
  status: 'not-started' | 'in-progress' | 'done'
  updatedAt: number
}

/**
 * Approval Workflow Manager
 * Phase 6: Epic P6-E2, Task P6-T6
 */

import type { ApprovalRequest, ToolContract } from '../../shared/agent-types'

export interface ApprovalConfig {
  approvalThreshold: number // Risk score 0-100
  autoApproveTools: string[] // Tool names that don't require approval
}

export class ApprovalManager {
  private config: ApprovalConfig
  private pendingApprovals: Map<string, ApprovalRequest> = new Map()
  private approvalListeners: Set<(request: ApprovalRequest) => void> = new Set()

  constructor(config: ApprovalConfig) {
    this.config = config
  }

  /**
   * P6-T6.1: Calculate risk score before execution
   */
  calculateRiskScore(tool: ToolContract, input: unknown): number {
    let score = 0

    // Base score from tool risk level
    switch (tool.riskLevel) {
      case 'low':
        score = 20
        break
      case 'medium':
        score = 50
        break
      case 'high':
        score = 80
        break
    }

    // Increase score for destructive operations
    const inputStr = JSON.stringify(input).toLowerCase()
    if (inputStr.includes('delete') || inputStr.includes('remove')) {
      score += 20
    }

    // Increase score for file system operations
    if (inputStr.includes('file') || inputStr.includes('path')) {
      score += 10
    }

    // Increase score for network operations
    if (inputStr.includes('http') || inputStr.includes('url')) {
      score += 10
    }

    return Math.min(100, score)
  }

  /**
   * P6-T6.1: Check if tool execution requires approval
   */
  requiresApproval(tool: ToolContract, input: unknown): boolean {
    // Check if tool is in auto-approve list
    if (this.config.autoApproveTools.includes(tool.name)) {
      return false
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(tool, input)

    // Require approval if score exceeds threshold
    return riskScore >= this.config.approvalThreshold
  }

  /**
   * P6-T6.2: Create approval request
   */
  createApprovalRequest(runId: string, taskId: string, tool: ToolContract, input: unknown): ApprovalRequest {
    const riskScore = this.calculateRiskScore(tool, input)
    const reason = this.generateApprovalReason(tool, input, riskScore)

    const request: ApprovalRequest = {
      id: `approval-${Date.now()}-${Math.random()}`,
      runId,
      taskId,
      toolName: tool.name,
      input,
      riskLevel: tool.riskLevel,
      riskScore,
      reason,
      createdAt: Date.now(),
      status: 'pending',
    }

    this.pendingApprovals.set(request.id, request)
    this.notifyListeners(request)

    return request
  }

  /**
   * Generate human-readable approval reason
   */
  private generateApprovalReason(tool: ToolContract, input: unknown, riskScore: number): string {
    const reasons: string[] = []

    if (tool.riskLevel === 'high') {
      reasons.push('High-risk operation')
    }

    const inputStr = JSON.stringify(input).toLowerCase()
    if (inputStr.includes('delete') || inputStr.includes('remove')) {
      reasons.push('Destructive action')
    }

    if (inputStr.includes('file') || inputStr.includes('path')) {
      reasons.push('File system access')
    }

    if (inputStr.includes('http') || inputStr.includes('url')) {
      reasons.push('Network access')
    }

    if (reasons.length === 0) {
      reasons.push(`Risk score: ${riskScore}`)
    }

    return reasons.join(', ')
  }

  /**
   * P6-T6.2: Approve request
   */
  approve(requestId: string): void {
    const request = this.pendingApprovals.get(requestId)
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`)
    }

    request.status = 'approved'
    request.respondedAt = Date.now()
    this.pendingApprovals.delete(requestId)
  }

  /**
   * P6-T6.3: Reject request
   */
  reject(requestId: string, _reason?: string): void {
    const request = this.pendingApprovals.get(requestId)
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`)
    }

    request.status = 'rejected'
    request.respondedAt = Date.now()
    this.pendingApprovals.delete(requestId)
  }

  /**
   * Get approval request
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(requestId)
  }

  /**
   * Get all pending approvals
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values())
  }

  /**
   * Wait for approval decision
   */
  async waitForApproval(requestId: string, timeoutMs: number = 300000): Promise<boolean> {
    const request = this.pendingApprovals.get(requestId)
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`)
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(requestId)
        reject(new Error('Approval timeout'))
      }, timeoutMs)

      const checkInterval = setInterval(() => {
        const current = this.pendingApprovals.get(requestId)
        if (!current) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          resolve(request.status === 'approved')
        }
      }, 100)
    })
  }

  /**
   * Subscribe to approval requests
   */
  subscribe(listener: (request: ApprovalRequest) => void): () => void {
    this.approvalListeners.add(listener)
    return () => this.approvalListeners.delete(listener)
  }

  /**
   * Notify listeners of new approval request
   */
  private notifyListeners(request: ApprovalRequest): void {
    this.approvalListeners.forEach(listener => listener(request))
  }
}

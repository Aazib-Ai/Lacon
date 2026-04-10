/**
 * Phase 11: Auto-update channel and rollback-aware updater service.
 *
 * Responsibilities:
 * - Enforce stable/beta channel feed resolution
 * - Support staged rollout eligibility checks
 * - Coordinate safe update checks/download/install
 * - Provide rollback-aware controls and downgrade handling
 * - Emit operational events for observability
 */

import type { AppUpdater, UpdateInfo } from 'electron-updater'
import { autoUpdater as electronAutoUpdater } from 'electron-updater'
import { EventEmitter } from 'events'

import type {
  ReleaseChannel,
  RollbackExecutionResult,
  RollbackPlan,
  TargetArch,
  TargetPlatform,
} from '../../shared/release-types'
import { createSafeLogger } from '../security/log-redaction'
import { getReleaseOperationsService } from './release-operations-service'

type UpdaterEventMap = {
  checking: { channel: ReleaseChannel }
  available: { channel: ReleaseChannel; version: string }
  notAvailable: { channel: ReleaseChannel; currentVersion: string }
  downloadProgress: { percent: number; transferred: number; total: number }
  downloaded: { version: string; releaseDate?: string | Date }
  error: { message: string; details?: string }
  rollbackPrepared: { targetVersion: string; channel: ReleaseChannel }
  rollbackExecuted: RollbackExecutionResult
}

export interface ChannelFeedConfig {
  stable: string
  beta: string
}

export interface StagedRolloutPolicy {
  enabled: boolean
  percentage: number
  cohortKey?: string
}

export interface UpdaterServiceConfig {
  currentVersion: string
  channel: ReleaseChannel
  feeds: ChannelFeedConfig
  platform: TargetPlatform
  arch: TargetArch
  stagedRollout?: StagedRolloutPolicy
  allowPrerelease?: boolean
  autoDownload?: boolean
  autoInstallOnAppQuit?: boolean
  allowDowngradeForRollback?: boolean
  rolloutSeed?: string
}

export interface UpdateCheckSummary {
  checkedAt: number
  channel: ReleaseChannel
  eligibleForRollout: boolean
  updateAvailable: boolean
  targetVersion?: string
  message?: string
}

export class UpdaterService extends EventEmitter {
  private readonly logger = createSafeLogger('UpdaterService')
  private readonly updater: AppUpdater
  private readonly releaseOps = getReleaseOperationsService()

  private config: UpdaterServiceConfig
  private initialized = false
  private lastDownloadedVersion: string | null = null

  constructor(config: UpdaterServiceConfig, updater: AppUpdater = electronAutoUpdater) {
    super()
    this.config = config
    this.updater = updater
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.releaseOps.initialize()

    this.updater.autoDownload = this.config.autoDownload ?? false
    this.updater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit ?? false
    this.updater.allowPrerelease = this.config.allowPrerelease ?? this.config.channel === 'beta'

    this.bindUpdaterEvents()
    this.applyChannel(this.config.channel)

    this.initialized = true
    this.logger.info('Updater initialized', {
      channel: this.config.channel,
      platform: this.config.platform,
      arch: this.config.arch,
    })
  }

  setChannel(channel: ReleaseChannel): void {
    this.ensureInitialized()
    this.config.channel = channel
    this.applyChannel(channel)
  }

  getChannel(): ReleaseChannel {
    return this.config.channel
  }

  async checkForUpdates(): Promise<UpdateCheckSummary> {
    this.ensureInitialized()

    const rolloutAllowed = this.isEligibleForStagedRollout()
    this.emitTyped('checking', { channel: this.config.channel })

    if (!rolloutAllowed) {
      const summary: UpdateCheckSummary = {
        checkedAt: Date.now(),
        channel: this.config.channel,
        eligibleForRollout: false,
        updateAvailable: false,
        message: 'Client is outside rollout cohort for this channel',
      }
      this.logger.info('Skipping update check: not in rollout cohort', summary)
      return summary
    }

    try {
      const result = await this.updater.checkForUpdates()
      const updateInfo = result?.updateInfo

      if (!this.isUpdateInfoAvailable(updateInfo)) {
        const summary: UpdateCheckSummary = {
          checkedAt: Date.now(),
          channel: this.config.channel,
          eligibleForRollout: true,
          updateAvailable: false,
          message: 'No update info available from feed',
        }
        this.emitTyped('notAvailable', {
          channel: this.config.channel,
          currentVersion: this.config.currentVersion,
        })
        return summary
      }

      const updateAvailable = this.isVersionNewer(updateInfo.version, this.config.currentVersion)
      const summary: UpdateCheckSummary = {
        checkedAt: Date.now(),
        channel: this.config.channel,
        eligibleForRollout: true,
        updateAvailable,
        targetVersion: updateInfo.version,
      }

      if (updateAvailable) {
        this.emitTyped('available', { channel: this.config.channel, version: updateInfo.version })
      } else {
        this.emitTyped('notAvailable', {
          channel: this.config.channel,
          currentVersion: this.config.currentVersion,
        })
      }

      return summary
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.emitTyped('error', { message, details: 'checkForUpdates failed' })
      throw error
    }
  }

  async downloadUpdate(): Promise<string[]> {
    this.ensureInitialized()
    return this.updater.downloadUpdate()
  }

  quitAndInstall(): void {
    this.ensureInitialized()
    this.updater.quitAndInstall(false, true)
  }

  async prepareRollback(plan: RollbackPlan): Promise<RollbackExecutionResult> {
    this.ensureInitialized()

    const allowDowngrade = this.config.allowDowngradeForRollback ?? true
    if (!allowDowngrade) {
      throw new Error('Rollback is disabled by updater configuration')
    }

    const result = this.releaseOps.executeRollback(plan)
    if (!result.success) {
      this.emitTyped('error', {
        message: 'Rollback preparation failed',
        details: result.error,
      })
      return result
    }

    this.updater.allowDowngrade = true
    this.emitTyped('rollbackPrepared', {
      targetVersion: plan.targetVersion,
      channel: plan.channel,
    })

    return result
  }

  async executeRollbackAndRecheck(plan: RollbackPlan): Promise<RollbackExecutionResult> {
    this.ensureInitialized()

    const rollbackResult = await this.prepareRollback(plan)
    if (!rollbackResult.success) {
      return rollbackResult
    }

    this.applyChannel(plan.channel)
    await this.checkForUpdates()
    this.emitTyped('rollbackExecuted', rollbackResult)

    return rollbackResult
  }

  private applyChannel(channel: ReleaseChannel): void {
    const feedUrl = channel === 'beta' ? this.config.feeds.beta : this.config.feeds.stable

    this.updater.channel = channel
    this.updater.allowPrerelease = channel === 'beta' || Boolean(this.config.allowPrerelease)
    this.updater.setFeedURL({ provider: 'generic', url: feedUrl, channel })

    this.logger.info('Applied update channel feed', { channel, feedUrl })
  }

  private bindUpdaterEvents(): void {
    this.updater.on('error', error => {
      const message = error?.message || 'Unknown updater error'
      this.emitTyped('error', { message })
      this.logger.error('Updater error', { message })
    })

    this.updater.on('update-available', info => {
      this.emitTyped('available', { channel: this.config.channel, version: info.version })
      this.logger.info('Update available', { version: info.version, channel: this.config.channel })
    })

    this.updater.on('update-not-available', () => {
      this.emitTyped('notAvailable', {
        channel: this.config.channel,
        currentVersion: this.config.currentVersion,
      })
      this.logger.info('No update available', { channel: this.config.channel })
    })

    this.updater.on('download-progress', progress => {
      this.emitTyped('downloadProgress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      })
    })

    this.updater.on('update-downloaded', info => {
      this.lastDownloadedVersion = info.version
      this.emitTyped('downloaded', { version: info.version, releaseDate: info.releaseDate })
      this.logger.info('Update downloaded', { version: info.version })
    })
  }

  private isEligibleForStagedRollout(): boolean {
    const rollout = this.config.stagedRollout
    if (!rollout?.enabled) {
      return true
    }

    const pct = Math.max(0, Math.min(100, rollout.percentage))
    if (pct >= 100) {
      return true
    }
    if (pct <= 0) {
      return false
    }

    const seed = this.config.rolloutSeed ?? `${this.config.platform}:${this.config.arch}:${this.config.currentVersion}`
    const score = this.stableHashToPercent(`${rollout.cohortKey ?? 'default'}:${seed}`)
    return score < pct
  }

  private stableHashToPercent(input: string): number {
    let weightedSum = 0
    for (let i = 0; i < input.length; i += 1) {
      weightedSum += input.charCodeAt(i) * (i + 1)
    }
    const normalized = weightedSum % 10000
    return normalized / 100
  }

  private isUpdateInfoAvailable(info: UpdateInfo | null | undefined): info is UpdateInfo {
    return Boolean(info && typeof info.version === 'string' && info.version.length > 0)
  }

  private isVersionNewer(candidate: string, current: string): boolean {
    const c = this.parseSemver(candidate)
    const n = this.parseSemver(current)

    for (let i = 0; i < 3; i += 1) {
      if (c[i] > n[i]) {
        return true
      }
      if (c[i] < n[i]) {
        return false
      }
    }
    return false
  }

  private parseSemver(version: string): [number, number, number] {
    const core = version.split('-')[0]
    const parts = core.split('.').map(value => Number.parseInt(value, 10))
    return [
      Number.isFinite(parts[0]) ? parts[0] : 0,
      Number.isFinite(parts[1]) ? parts[1] : 0,
      Number.isFinite(parts[2]) ? parts[2] : 0,
    ]
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('UpdaterService not initialized. Call initialize() first.')
    }
  }

  private emitTyped<K extends keyof UpdaterEventMap>(event: K, payload: UpdaterEventMap[K]): void {
    this.emit(event, payload)
  }
}

let updaterServiceSingleton: UpdaterService | null = null

export function getUpdaterService(config?: UpdaterServiceConfig): UpdaterService {
  if (!updaterServiceSingleton) {
    if (!config) {
      throw new Error('UpdaterService has not been initialized. Provide configuration on first call.')
    }
    updaterServiceSingleton = new UpdaterService(config)
  }
  return updaterServiceSingleton
}

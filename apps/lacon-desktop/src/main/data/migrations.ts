/**
 * Database migration system for Phase 2
 * Handles schema version upgrades and rollbacks
 */

import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { SCHEMA_VERSION } from './schema'

interface MigrationMetadata {
  currentVersion: number
  lastMigrationAt: number
  migrationHistory: MigrationRecord[]
}

interface MigrationRecord {
  fromVersion: number
  toVersion: number
  migratedAt: number
  success: boolean
  error?: string
}

type MigrationFunction = () => Promise<void>

export class MigrationRunner {
  private metadataPath: string
  private metadata: MigrationMetadata
  private migrations: Map<number, MigrationFunction> = new Map()

  constructor() {
    const userDataPath = app.getPath('userData')
    const dataPath = join(userDataPath, 'data')

    if (!existsSync(dataPath)) {
      mkdirSync(dataPath, { recursive: true })
    }

    this.metadataPath = join(dataPath, 'migrations.json')
    this.metadata = this.loadMetadata()
    this.registerMigrations()
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    const currentVersion = this.metadata.currentVersion
    const targetVersion = SCHEMA_VERSION

    if (currentVersion === targetVersion) {
      console.log(`Database already at version ${targetVersion}`)
      return
    }

    if (currentVersion > targetVersion) {
      throw new Error(
        `Database version ${currentVersion} is newer than app version ${targetVersion}. ` +
          'Please update the application.',
      )
    }

    console.log(`Migrating database from v${currentVersion} to v${targetVersion}`)

    for (let version = currentVersion + 1; version <= targetVersion; version++) {
      await this.runMigration(version)
    }

    console.log('All migrations completed successfully')
  }

  /**
   * Rollback to a specific version
   */
  async rollback(targetVersion: number): Promise<void> {
    if (targetVersion >= this.metadata.currentVersion) {
      throw new Error('Target version must be lower than current version')
    }

    if (targetVersion < 1) {
      throw new Error('Cannot rollback below version 1')
    }

    console.log(`Rolling back from v${this.metadata.currentVersion} to v${targetVersion}`)

    // For v1, rollback is not implemented as there's no previous version
    // Future versions will implement rollback logic here

    throw new Error('Rollback not yet implemented for current version')
  }

  /**
   * Get current database version
   */
  getCurrentVersion(): number {
    return this.metadata.currentVersion
  }

  /**
   * Get migration history
   */
  getHistory(): MigrationRecord[] {
    return [...this.metadata.migrationHistory]
  }

  private async runMigration(version: number): Promise<void> {
    const migration = this.migrations.get(version)

    if (!migration) {
      throw new Error(`No migration defined for version ${version}`)
    }

    const record: MigrationRecord = {
      fromVersion: this.metadata.currentVersion,
      toVersion: version,
      migratedAt: Date.now(),
      success: false,
    }

    try {
      console.log(`Running migration to v${version}...`)
      await migration()

      record.success = true
      this.metadata.currentVersion = version
      this.metadata.lastMigrationAt = Date.now()
      this.metadata.migrationHistory.push(record)
      this.saveMetadata()

      console.log(`Migration to v${version} completed`)
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error)
      this.metadata.migrationHistory.push(record)
      this.saveMetadata()

      throw new Error(`Migration to v${version} failed: ${record.error}`)
    }
  }

  private registerMigrations(): void {
    // Migration to v1 (initial schema)
    this.migrations.set(1, async () => {
      // Initial schema - no migration needed
      console.log('Initializing schema v1')
    })

    // Future migrations will be registered here
    // Example:
    // this.migrations.set(2, async () => {
    //   // Migration logic from v1 to v2
    // })
  }

  private loadMetadata(): MigrationMetadata {
    if (!existsSync(this.metadataPath)) {
      return {
        currentVersion: 0,
        lastMigrationAt: Date.now(),
        migrationHistory: [],
      }
    }

    try {
      const json = readFileSync(this.metadataPath, 'utf-8')
      return JSON.parse(json)
    } catch (error) {
      console.error('Failed to load migration metadata:', error)
      return {
        currentVersion: 0,
        lastMigrationAt: Date.now(),
        migrationHistory: [],
      }
    }
  }

  private saveMetadata(): void {
    try {
      const json = JSON.stringify(this.metadata, null, 2)
      writeFileSync(this.metadataPath, json, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to save migration metadata: ${error}`)
    }
  }
}

// Singleton instance
let migrationRunnerInstance: MigrationRunner | null = null

export function getMigrationRunner(): MigrationRunner {
  if (!migrationRunnerInstance) {
    migrationRunnerInstance = new MigrationRunner()
  }
  return migrationRunnerInstance
}

/**
 * Privacy Guardrail Tests — Phase 7
 *
 * Verifies LACON's privacy contract:
 * - No telemetry/analytics
 * - No LACON backend calls
 * - No tracking scripts
 * - API keys only in main process
 */

import * as fs from 'fs'
import * as path from 'path'
import { describe, expect, it } from 'vitest'

// ── Patterns that violate privacy ──
const TELEMETRY_PATTERNS = [
  /google-analytics/i,
  /gtag\(/i,
  /\bga\s*\(/,
  /analytics\.js/i,
  /segment\.io/i,
  /segment\.com/i,
  /mixpanel/i,
  /amplitude/i,
  /heap\.io/i,
  /hotjar/i,
  /fullstory/i,
  /logrocket/i,
  /sentry\.io/i,
  /bugsnag/i,
  /datadog/i,
  /newrelic/i,
  /appsflyer/i,
  /adjust\.com/i,
  /facebook.*pixel/i,
  /fbevents/i,
  /intercom/i,
  /drift\.com/i,
  /crisp\.chat/i,
  /posthog/i,
]

const ANALYTICS_FUNCTION_PATTERNS = [
  /trackEvent\s*\(/i,
  /sendAnalytics\s*\(/i,
  /reportMetric\s*\(/i,
  /logTelemetry\s*\(/i,
  /captureEvent\s*\(/i,
  /recordEvent\s*\(/i,
]

const BACKEND_CALL_PATTERNS = [
  /lacon\.app\/api/i,
  /api\.lacon\.app/i,
  /lacon-backend/i,
  /lacon-cloud/i,
  /lacon-server/i,
]

/** Read all TypeScript/TSX source files recursively. */
function getSourceFiles(dir: string, exts: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) {return results}

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') {continue}
      results.push(...getSourceFiles(fullPath, exts))
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

describe('Privacy Guardrail Tests', () => {
  // Find source root
  const srcDir = path.resolve(__dirname, '..', 'src')

  describe('No telemetry or analytics SDKs', () => {
    it('source code should not import any telemetry/analytics SDK', () => {
      const files = getSourceFiles(srcDir)
      const violations: Array<{ file: string; line: number; pattern: string; content: string }> = []

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          for (const pattern of TELEMETRY_PATTERNS) {
            if (pattern.test(line)) {
              violations.push({
                file: path.relative(srcDir, filePath),
                line: i + 1,
                pattern: pattern.toString(),
                content: line.trim().slice(0, 100),
              })
            }
          }
        }
      }

      expect(violations).toEqual([])
    })
  })

  describe('No analytics function calls', () => {
    it('source code should not contain analytics tracking functions', () => {
      const files = getSourceFiles(srcDir)
      const violations: Array<{ file: string; line: number; pattern: string; content: string }> = []

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // Skip comments
          const trimmed = line.trim()
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {continue}

          for (const pattern of ANALYTICS_FUNCTION_PATTERNS) {
            if (pattern.test(line)) {
              violations.push({
                file: path.relative(srcDir, filePath),
                line: i + 1,
                pattern: pattern.toString(),
                content: line.trim().slice(0, 100),
              })
            }
          }
        }
      }

      expect(violations).toEqual([])
    })
  })

  describe('No LACON backend calls', () => {
    it('source code should not call any LACON cloud backend', () => {
      const files = getSourceFiles(srcDir)
      const violations: Array<{ file: string; line: number; pattern: string; content: string }> = []

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // Skip comments and the update URL (which is just a download link, not a data endpoint)
          const trimmed = line.trim()
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {continue}
          if (trimmed.includes('releases.lacon.app')) {continue} // Allowed: release manifest URL
          if (trimmed.includes('lacon.app/download')) {continue} // Allowed: manual download page

          for (const pattern of BACKEND_CALL_PATTERNS) {
            if (pattern.test(line)) {
              violations.push({
                file: path.relative(srcDir, filePath),
                line: i + 1,
                pattern: pattern.toString(),
                content: line.trim().slice(0, 100),
              })
            }
          }
        }
      }

      expect(violations).toEqual([])
    })
  })

  describe('API keys only in main process', () => {
    it('renderer code should never import keystore directly', () => {
      const rendererDir = path.join(srcDir, 'renderer')
      const files = getSourceFiles(rendererDir)
      const violations: string[] = []

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          // Only flag actual import statements from keystore module
          if (
            trimmed.startsWith('import') &&
            (trimmed.includes("from '") || trimmed.includes('from "')) &&
            trimmed.includes('keystore')
          ) {
            violations.push(path.relative(srcDir, filePath))
          }
        }
      }

      expect(violations).toEqual([])
    })

    it('preload code should never expose raw key values to renderer', () => {
      const preloadDir = path.join(srcDir, 'preload')
      const files = getSourceFiles(preloadDir)
      const violations: Array<{ file: string; content: string }> = []

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8')
        // getKey returns the actual decrypted value — it should never be exposed via IPC
        if (content.includes('getKey(') && !content.includes('getKeyMetadata(')) {
          // Check if it's a direct invoke to getKey (bad) vs getMetadata (ok)
          const lines = content.split('\n')
          for (const line of lines) {
            if (line.includes("'key:get'") && !line.includes('Metadata')) {
              violations.push({
                file: path.relative(srcDir, filePath),
                content: line.trim().slice(0, 100),
              })
            }
          }
        }
      }

      expect(violations).toEqual([])
    })
  })

  describe('No fetch/XMLHttpRequest to tracking domains', () => {
    it('renderer code should not make requests to tracking domains', () => {
      const rendererDir = path.join(srcDir, 'renderer')
      const files = getSourceFiles(rendererDir)
      const trackingDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'segment.io',
        'mixpanel.com',
        'amplitude.com',
        'hotjar.com',
        'fullstory.com',
        'logrocket.com',
        'posthog.com',
      ]

      const violations: string[] = []

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8')
        for (const domain of trackingDomains) {
          if (content.includes(domain)) {
            violations.push(`${path.relative(srcDir, filePath)}: references ${domain}`)
          }
        }
      }

      expect(violations).toEqual([])
    })
  })
})

/**
 * Tests for Policy Engine
 * Phase 9: Epic P9-E3
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { PolicyEngine } from '../../src/main/audit/policy-engine'
import type { PolicyEvaluationContext, PolicyRule } from '../../src/shared/policy-types'

describe('PolicyEngine', () => {
  let engine: PolicyEngine

  beforeEach(() => {
    engine = new PolicyEngine({
      enabled: true,
      strictMode: false,
      logAllEvaluations: true,
      defaultAction: 'allow',
      approvalThreshold: 0.7,
    })
  })

  describe('Rule Management', () => {
    it('should register rules', () => {
      const rule: PolicyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test rule description',
        type: 'tool-access',
        enabled: true,
        priority: 100,
        conditions: [],
        action: 'allow',
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: ['test'],
        },
      }

      engine.registerRule(rule)
      const rules = engine.getRules()
      expect(rules.some(r => r.id === 'test-rule')).toBe(true)
    })

    it('should unregister rules', () => {
      const rule: PolicyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test',
        type: 'tool-access',
        enabled: true,
        priority: 100,
        conditions: [],
        action: 'allow',
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: [],
        },
      }

      engine.registerRule(rule)
      engine.unregisterRule('test-rule')
      const rules = engine.getRules()
      expect(rules.some(r => r.id === 'test-rule')).toBe(false)
    })

    it('should get rule by ID', () => {
      const rule: PolicyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test',
        type: 'tool-access',
        enabled: true,
        priority: 100,
        conditions: [],
        action: 'allow',
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: [],
        },
      }

      engine.registerRule(rule)
      const retrieved = engine.getRule('test-rule')
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('Test Rule')
    })
  })

  describe('Policy Evaluation (P9-T6.1)', () => {
    it('should allow by default when no rules match', () => {
      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'test-tool',
          riskLevel: 'low',
          input: {},
        },
      }

      const result = engine.evaluate(context)
      expect(result.allowed).toBe(true)
      expect(result.action).toBe('allow')
    })

    it('should require approval for high-risk tools', () => {
      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'dangerous-tool',
          riskLevel: 'high',
          input: {},
        },
      }

      const result = engine.evaluate(context)
      expect(result.requiresApproval).toBe(true)
      expect(result.action).toBe('require-approval')
    })

    it('should deny when rule action is deny', () => {
      const rule: PolicyRule = {
        id: 'deny-rule',
        name: 'Deny Rule',
        description: 'Deny all',
        type: 'tool-access',
        enabled: true,
        priority: 100,
        conditions: [
          {
            field: 'tool.name',
            operator: 'equals',
            value: 'blocked-tool',
          },
        ],
        action: 'deny',
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: [],
        },
      }

      engine.registerRule(rule)

      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'blocked-tool',
          riskLevel: 'low',
          input: {},
        },
      }

      const result = engine.evaluate(context)
      expect(result.allowed).toBe(false)
      expect(result.action).toBe('deny')
    })

    it('should evaluate multiple conditions', () => {
      const rule: PolicyRule = {
        id: 'multi-condition-rule',
        name: 'Multi Condition Rule',
        description: 'Test multiple conditions',
        type: 'tool-access',
        enabled: true,
        priority: 100,
        conditions: [
          {
            field: 'tool.name',
            operator: 'equals',
            value: 'test-tool',
          },
          {
            field: 'tool.riskLevel',
            operator: 'equals',
            value: 'high',
          },
        ],
        action: 'deny',
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: [],
        },
      }

      engine.registerRule(rule)

      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'test-tool',
          riskLevel: 'high',
          input: {},
        },
      }

      const result = engine.evaluate(context)
      expect(result.action).toBe('deny')
    })
  })

  describe('Risk Scoring (P9-T5.1)', () => {
    it('should calculate risk score', () => {
      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'test-tool',
          riskLevel: 'high',
          input: {},
        },
      }

      const result = engine.evaluate(context)
      expect(result.riskScore).toBeGreaterThan(0)
    })

    it('should require approval when risk score exceeds threshold', () => {
      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'test-tool',
          riskLevel: 'high',
          input: {},
        },
      }

      const result = engine.evaluate(context)
      expect(result.riskScore).toBeGreaterThanOrEqual(0.7)
      expect(result.requiresApproval).toBe(true)
    })
  })

  describe('Sensitive Data Detection (P9-T5.2)', () => {
    it('should detect sensitive data patterns', () => {
      const context: PolicyEvaluationContext = {
        type: 'data',
        data: {
          content: 'My email is test@example.com and my API key is abcd1234567890abcd1234567890abcd',
          metadata: {},
        },
      }

      const result = engine.evaluate(context)
      expect(result.sensitiveDataDetected).toBe(true)
      expect(result.sensitiveDataMatches.length).toBeGreaterThan(0)
    })

    it('should redact sensitive data', () => {
      const context: PolicyEvaluationContext = {
        type: 'data',
        data: {
          content: 'API key: abcd1234567890abcd1234567890abcd',
          metadata: {},
        },
      }

      const result = engine.evaluate(context)
      const apiKeyMatch = result.sensitiveDataMatches.find(m => m.pattern === 'API Key')
      expect(apiKeyMatch?.value).toBe('[REDACTED]')
    })
  })

  describe('Statistics', () => {
    it('should track evaluation statistics', () => {
      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'test-tool',
          riskLevel: 'low',
          input: {},
        },
      }

      engine.evaluate(context)
      engine.evaluate(context)

      const stats = engine.getStatistics()
      expect(stats.totalEvaluations).toBe(2)
      expect(stats.allowedCount).toBeGreaterThan(0)
    })

    it('should track violations', () => {
      const rule: PolicyRule = {
        id: 'deny-rule',
        name: 'Deny Rule',
        description: 'Deny',
        type: 'tool-access',
        enabled: true,
        priority: 100,
        conditions: [
          {
            field: 'tool.name',
            operator: 'equals',
            value: 'blocked-tool',
          },
        ],
        action: 'deny',
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: [],
        },
      }

      engine.registerRule(rule)

      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'blocked-tool',
          riskLevel: 'low',
          input: {},
        },
      }

      engine.evaluate(context)

      const violations = engine.getViolations()
      expect(violations.length).toBe(1)
      expect(violations[0].action).toBe('blocked')
    })
  })

  describe('Policy Engine Configuration', () => {
    it('should respect enabled flag', () => {
      const disabledEngine = new PolicyEngine({
        enabled: false,
      })

      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'test-tool',
          riskLevel: 'high',
          input: {},
        },
      }

      const result = disabledEngine.evaluate(context)
      expect(result.allowed).toBe(true)
      expect(result.reason).toContain('disabled')
    })

    it('should respect strict mode', () => {
      const strictEngine = new PolicyEngine({
        enabled: true,
        strictMode: true,
        defaultAction: 'allow',
      })

      const context: PolicyEvaluationContext = {
        type: 'tool',
        tool: {
          name: 'unknown-tool',
          riskLevel: 'low',
          input: {},
        },
      }

      const result = strictEngine.evaluate(context)
      // In strict mode with no matching rules, should deny
      expect(result.action).toBe('deny')
    })
  })
})

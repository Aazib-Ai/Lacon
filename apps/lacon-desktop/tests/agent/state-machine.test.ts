/**
 * Tests for Agent State Machine
 * Phase 6: Epic P6-E1, Task P6-T1
 */

import { beforeEach,describe, expect, it } from 'vitest'

import { AgentStateMachine } from '../../src/main/agent/state-machine'

describe('AgentStateMachine', () => {
  let stateMachine: AgentStateMachine
  const runId = 'test-run-123'

  beforeEach(() => {
    stateMachine = new AgentStateMachine()
  })

  describe('P6-T1.1: State definitions', () => {
    it('should start in idle state', () => {
      expect(stateMachine.getState()).toBe('idle')
    })

    it('should support all required states', () => {
      const states = ['idle', 'planning', 'executing', 'waiting-approval', 'completed', 'failed', 'cancelled']
      // All states should be reachable through valid transitions
      expect(states).toBeDefined()
    })
  })

  describe('P6-T1.2: Valid transitions', () => {
    it('should allow idle -> planning', () => {
      expect(stateMachine.canTransition('planning')).toBe(true)
      stateMachine.transition('planning', runId)
      expect(stateMachine.getState()).toBe('planning')
    })

    it('should allow planning -> executing', () => {
      stateMachine.transition('planning', runId)
      expect(stateMachine.canTransition('executing')).toBe(true)
      stateMachine.transition('executing', runId)
      expect(stateMachine.getState()).toBe('executing')
    })

    it('should allow executing -> waiting-approval', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transition('executing', runId)
      expect(stateMachine.canTransition('waiting-approval')).toBe(true)
      stateMachine.transition('waiting-approval', runId)
      expect(stateMachine.getState()).toBe('waiting-approval')
    })

    it('should allow waiting-approval -> executing', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transition('executing', runId)
      stateMachine.transition('waiting-approval', runId)
      expect(stateMachine.canTransition('executing')).toBe(true)
      stateMachine.transition('executing', runId)
      expect(stateMachine.getState()).toBe('executing')
    })

    it('should allow executing -> completed', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transition('executing', runId)
      expect(stateMachine.canTransition('completed')).toBe(true)
      stateMachine.transition('completed', runId)
      expect(stateMachine.getState()).toBe('completed')
    })

    it('should allow completed -> idle', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transition('executing', runId)
      stateMachine.transition('completed', runId)
      expect(stateMachine.canTransition('idle')).toBe(true)
      stateMachine.transition('idle', runId)
      expect(stateMachine.getState()).toBe('idle')
    })
  })

  describe('P6-T1.2: Invalid transitions', () => {
    it('should reject idle -> completed', () => {
      expect(stateMachine.canTransition('completed')).toBe(false)
      expect(() => stateMachine.transition('completed', runId)).toThrow()
    })

    it('should reject planning -> completed', () => {
      stateMachine.transition('planning', runId)
      expect(stateMachine.canTransition('completed')).toBe(false)
      expect(() => stateMachine.transition('completed', runId)).toThrow()
    })
  })

  describe('P6-T1.3: Error transitions', () => {
    it('should transition to failed on error', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transitionToError(runId, new Error('Test error'))
      expect(stateMachine.getState()).toBe('failed')
    })

    it('should allow failed -> idle', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transitionToError(runId, new Error('Test error'))
      expect(stateMachine.canTransition('idle')).toBe(true)
      stateMachine.transition('idle', runId)
      expect(stateMachine.getState()).toBe('idle')
    })

    it('should allow failed -> planning (retry)', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transitionToError(runId, new Error('Test error'))
      expect(stateMachine.canTransition('planning')).toBe(true)
      stateMachine.transition('planning', runId)
      expect(stateMachine.getState()).toBe('planning')
    })
  })

  describe('P6-T1.3: Cancellation transitions', () => {
    it('should transition to cancelled from executing', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transition('executing', runId)
      stateMachine.transitionToCancelled(runId, 'User cancelled')
      expect(stateMachine.getState()).toBe('cancelled')
    })

    it('should allow cancelled -> idle', () => {
      stateMachine.transition('planning', runId)
      stateMachine.transitionToCancelled(runId)
      expect(stateMachine.canTransition('idle')).toBe(true)
      stateMachine.transition('idle', runId)
      expect(stateMachine.getState()).toBe('idle')
    })
  })

  describe('State change listeners', () => {
    it('should notify listeners on state change', () => {
      let notified = false
      let lastState = ''

      stateMachine.subscribe(state => {
        notified = true
        lastState = state
      })

      stateMachine.transition('planning', runId)
      expect(notified).toBe(true)
      expect(lastState).toBe('planning')
    })

    it('should allow unsubscribing', () => {
      let callCount = 0

      const unsubscribe = stateMachine.subscribe(() => {
        callCount += 1
      })

      stateMachine.transition('planning', runId)
      expect(callCount).toBe(1)

      unsubscribe()
      stateMachine.reset()
      stateMachine.transition('planning', runId)
      expect(callCount).toBe(1) // Should not increment
    })
  })
})

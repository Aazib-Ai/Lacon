/**
 * Agent Runtime State Machine
 * Phase 6: Epic P6-E1, Task P6-T1
 */

import type { AgentRuntimeState, AgentTraceEvent, StateTransition } from '../../shared/agent-types'

export class AgentStateMachine {
  private currentState: AgentRuntimeState = 'idle'
  private transitions: Map<string, StateTransition[]> = new Map()
  private listeners: Set<(state: AgentRuntimeState, event: AgentTraceEvent) => void> = new Set()

  constructor() {
    this.defineTransitions()
  }

  /**
   * P6-T1.1: Define valid states and transitions
   */
  private defineTransitions(): void {
    // From idle
    this.addTransition({ from: 'idle', to: 'planning' })

    // From planning
    this.addTransition({ from: 'planning', to: 'executing' })
    this.addTransition({ from: 'planning', to: 'failed' })
    this.addTransition({ from: 'planning', to: 'cancelled' })

    // From executing
    this.addTransition({ from: 'executing', to: 'waiting-approval' })
    this.addTransition({ from: 'executing', to: 'completed' })
    this.addTransition({ from: 'executing', to: 'failed' })
    this.addTransition({ from: 'executing', to: 'cancelled' })

    // From waiting-approval
    this.addTransition({ from: 'waiting-approval', to: 'executing' })
    this.addTransition({ from: 'waiting-approval', to: 'failed' })
    this.addTransition({ from: 'waiting-approval', to: 'cancelled' })

    // From completed
    this.addTransition({ from: 'completed', to: 'idle' })

    // From failed
    this.addTransition({ from: 'failed', to: 'idle' })
    this.addTransition({ from: 'failed', to: 'planning' }) // Retry

    // From cancelled
    this.addTransition({ from: 'cancelled', to: 'idle' })
  }

  /**
   * P6-T1.2: Add transition with optional guard
   */
  private addTransition(transition: StateTransition): void {
    const key = transition.from
    const existing = this.transitions.get(key) || []
    existing.push(transition)
    this.transitions.set(key, existing)
  }

  /**
   * P6-T1.2: Check if transition is valid
   */
  canTransition(to: AgentRuntimeState): boolean {
    const validTransitions = this.transitions.get(this.currentState) || []
    const transition = validTransitions.find(t => t.to === to)

    if (!transition) {
      return false
    }

    if (transition.guard) {
      return transition.guard()
    }

    return true
  }

  /**
   * P6-T1.2: Execute state transition
   */
  transition(to: AgentRuntimeState, runId: string): void {
    if (!this.canTransition(to)) {
      throw new Error(`Invalid transition from ${this.currentState} to ${to}`)
    }

    const validTransitions = this.transitions.get(this.currentState) || []
    const transition = validTransitions.find(t => t.to === to)

    const previousState = this.currentState
    this.currentState = to

    if (transition?.action) {
      transition.action()
    }

    // Emit trace event
    const event: AgentTraceEvent = {
      id: `${Date.now()}-${Math.random()}`,
      runId,
      timestamp: Date.now(),
      type: 'state-transition',
      data: {
        from: previousState,
        to: this.currentState,
      },
    }

    this.notifyListeners(this.currentState, event)
  }

  /**
   * P6-T1.3: Handle error transitions
   */
  transitionToError(runId: string, error: Error): void {
    if (this.canTransition('failed')) {
      const event: AgentTraceEvent = {
        id: `${Date.now()}-${Math.random()}`,
        runId,
        timestamp: Date.now(),
        type: 'error',
        data: {
          from: this.currentState,
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
      }

      this.currentState = 'failed'
      this.notifyListeners(this.currentState, event)
    }
  }

  /**
   * P6-T1.3: Handle cancellation transitions
   */
  transitionToCancelled(runId: string, reason?: string): void {
    if (this.canTransition('cancelled')) {
      const event: AgentTraceEvent = {
        id: `${Date.now()}-${Math.random()}`,
        runId,
        timestamp: Date.now(),
        type: 'cancellation',
        data: {
          from: this.currentState,
          reason,
        },
      }

      this.currentState = 'cancelled'
      this.notifyListeners(this.currentState, event)
    }
  }

  /**
   * Get current state
   */
  getState(): AgentRuntimeState {
    return this.currentState
  }

  /**
   * Reset to idle state
   */
  reset(): void {
    this.currentState = 'idle'
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AgentRuntimeState, event: AgentTraceEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(state: AgentRuntimeState, event: AgentTraceEvent): void {
    this.listeners.forEach(listener => listener(state, event))
  }
}

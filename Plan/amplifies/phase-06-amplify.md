# Phase 06 Amplify: Agent Runtime Core

Phase ID: P6
Status: Not Started
Depends on: P3 and P4
Blocks: P7, P8, P9

## Mission

Implement a deterministic agent runtime with safe tool orchestration, bounded autonomy, and clear user control.

## Hard Rules

- High-risk actions require manual approval.
- Runtime must support cancellation and timeout.
- Tool execution must be observable and auditable.

## Inputs

- Plan/plan.md
- Plan/amplifies/phase-03-amplify.md
- Plan/amplifies/phase-04-amplify.md

## Outputs Required

- Orchestration engine
- Tool execution framework
- Streaming integration with UI
- Runtime state model and error handling policies

## Execution Checklist

## Epic P6-E1: Orchestration Engine

- [x] P6-T1 Define runtime state machine
  - [x] P6-T1.1 Idle, planning, executing, waiting-approval, completed, failed states
  - [x] P6-T1.2 Valid transitions and guards
  - [x] P6-T1.3 Error and cancellation transitions

- [x] P6-T2 Build planner and router
  - [x] P6-T2.1 Task decomposition path
  - [x] P6-T2.2 Tool routing rules
  - [x] P6-T2.3 Retry and backoff policy

- [x] P6-T3 Build context assembly pipeline
  - [x] P6-T3.1 Document context extraction
  - [x] P6-T3.2 User instruction context extraction
  - [x] P6-T3.3 Tool memory and trace context extraction

## Epic P6-E2: Tool Execution Framework

- [x] P6-T4 Define tool contracts
  - [x] P6-T4.1 Input schema
  - [x] P6-T4.2 Output schema
  - [x] P6-T4.3 Error schema

- [x] P6-T5 Implement tool runtime controls
  - [x] P6-T5.1 Timeout controls
  - [x] P6-T5.2 Idempotency keys
  - [x] P6-T5.3 Concurrency limits

- [x] P6-T6 Implement approval workflow
  - [x] P6-T6.1 Risk scoring before execution
  - [x] P6-T6.2 Approval prompt UX hooks
  - [x] P6-T6.3 Rejection and fallback behavior

## Epic P6-E3: Streaming and UX Integration

- [x] P6-T7 Implement token streaming transport
  - [x] P6-T7.1 Main-to-renderer stream channel
  - [x] P6-T7.2 Partial output accumulation
  - [x] P6-T7.3 End-of-stream finalization

- [x] P6-T8 Implement user controls for active runs
  - [x] P6-T8.1 Cancel current run
  - [x] P6-T8.2 Retry failed step
  - [x] P6-T8.3 Restart from last stable checkpoint

## Validation

- [x] V6-1 Agent run can execute multi-step tool workflow
- [x] V6-2 High-risk operations always require approval
- [x] V6-3 Cancel and timeout behavior is deterministic
- [x] V6-4 Runtime events are logged for traceability

## Definition of Done

- [x] Phase 6 checklist complete
- [x] Runtime behavior is stable and auditable
- [x] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P6
- Task IDs completed:
- Runtime scenarios tested:
- Approval path evidence:
- Observed failure modes:
- Next recommended task:

# Phase 00 Amplify: Product Contract and Architecture Baseline

Phase ID: P0
Status: Not Started
Depends on: none
Blocks: all implementation phases

## Mission

Create an unambiguous product and architecture contract so execution agents do not invent scope.

## Hard Rules

- Do not start coding features in this phase.
- Do not add collaboration or cloud sync to v1 scope.
- Every decision must be recorded in writing.

## Inputs

- Plan/plan.md
- Existing monorepo scripts and package constraints
- Stakeholder decisions already captured in chat

## Outputs Required

- docs/lacon/product-scope.md
- docs/lacon/architecture-contract.md
- docs/lacon/security-boundaries.md
- docs/lacon/slo-and-quality-gates.md
- docs/lacon/risk-register.md

## Execution Checklist

## Epic P0-E1: Scope Lock

- [ ] P0-T1 Create product scope document
  - [ ] P0-T1.1 Write v1 in-scope list
  - [ ] P0-T1.2 Write v1 out-of-scope list
  - [ ] P0-T1.3 Add platform scope as Windows and macOS
  - [ ] P0-T1.4 Add stack scope as Electron plus React and TypeScript
  - [ ] P0-T1.5 Add local-first only statement for v1
  - [ ] P0-T1.6 Add provider scope list for v1
  - [ ] P0-T1.7 Add key policy as local encrypted BYOK only

- [ ] P0-T2 Record non-goals and anti-scope
  - [ ] P0-T2.1 Collaboration explicitly post-v1
  - [ ] P0-T2.2 Cloud sync explicitly post-v1
  - [ ] P0-T2.3 Store distribution explicitly post-v1

## Epic P0-E2: Architecture Contract

- [ ] P0-T3 Define renderer responsibilities
  - [ ] P0-T3.1 Editor runtime ownership
  - [ ] P0-T3.2 UI ownership
  - [ ] P0-T3.3 No provider keys in renderer rule

- [ ] P0-T4 Define main process responsibilities
  - [ ] P0-T4.1 Secrets storage ownership
  - [ ] P0-T4.2 Provider SDK call ownership
  - [ ] P0-T4.3 Filesystem ownership
  - [ ] P0-T4.4 High-risk tool execution ownership

- [ ] P0-T5 Define preload contract
  - [ ] P0-T5.1 Enumerate allowed IPC APIs
  - [ ] P0-T5.2 Define payload validation expectations
  - [ ] P0-T5.3 Define permission check flow

## Epic P0-E3: Quality and Security Gates

- [ ] P0-T6 Define quality gate thresholds
  - [ ] P0-T6.1 Startup time target
  - [ ] P0-T6.2 Typing latency target
  - [ ] P0-T6.3 Stream responsiveness target
  - [ ] P0-T6.4 Crash-free session target

- [ ] P0-T7 Define security gates
  - [ ] P0-T7.1 No key leak acceptance criteria
  - [ ] P0-T7.2 IPC abuse test requirement
  - [ ] P0-T7.3 Log redaction requirement
  - [ ] P0-T7.4 Manual approval rule for high-risk actions

- [ ] P0-T8 Create initial risk register
  - [ ] P0-T8.1 Technical risks
  - [ ] P0-T8.2 Delivery risks
  - [ ] P0-T8.3 Security risks
  - [ ] P0-T8.4 Mitigation owner per risk

## Validation

- [ ] V0-1 All required output documents exist
- [ ] V0-2 Product and engineering sign-off captured
- [ ] V0-3 No unresolved scope conflicts remain

## Definition of Done

- [ ] Phase 0 checklist complete
- [ ] Required output files committed
- [ ] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P0
- Task IDs completed:
- Files created or updated:
- Tests or validation performed:
- Known risks or blockers:
- Next recommended task:

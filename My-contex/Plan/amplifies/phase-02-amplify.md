# Phase 02 Amplify: Security Foundation and Local Data Architecture

Phase ID: P2
Status: Complete
Depends on: P1
Blocks: P6, P7, P9, P10

## Mission

Build security-critical foundations first so all later agent and provider work is safe by default.

## Hard Rules

- API keys must never exist in renderer process state.
- Keys must be encrypted at rest.
- All IPC payloads must be schema validated.

## Inputs

- Plan/plan.md
- Plan/amplifies/phase-01-amplify.md
- Electron app scaffold from P1

## Outputs Required

- Security architecture document
- Typed IPC schema with validation
- Encrypted key store implementation
- Versioned local data schema and migration runner
- Log redaction policy implementation

## Execution Checklist

## Epic P2-E1: Secret and Credential Security

- [x] P2-T1 Implement encrypted key store in main process
  - [x] P2-T1.1 Choose local secure storage mechanism
  - [x] P2-T1.2 Implement create, read, update, delete key flows
  - [x] P2-T1.3 Add corruption and missing-key recovery handling

- [x] P2-T2 Build key management service boundary
  - [x] P2-T2.1 Expose minimal key status over IPC
  - [x] P2-T2.2 Forbid key value reads from renderer
  - [x] P2-T2.3 Add audit event for key create and delete operations

## Epic P2-E2: Data Model and Migrations

- [x] P2-T3 Define local schema v1
  - [x] P2-T3.1 Documents schema
  - [x] P2-T3.2 Agent session schema
  - [x] P2-T3.3 Tool trace schema
  - [x] P2-T3.4 Settings schema

- [x] P2-T4 Implement migration runner
  - [x] P2-T4.1 Version table and current schema marker
  - [x] P2-T4.2 Forward migration execution
  - [x] P2-T4.3 Migration rollback strategy

- [x] P2-T5 Implement backup and restore flow
  - [x] P2-T5.1 Local snapshot export
  - [x] P2-T5.2 Local snapshot import
  - [x] P2-T5.3 Validation for imported snapshots

## Epic P2-E3: IPC and Runtime Security Guardrails

- [x] P2-T6 Implement typed IPC contracts
  - [x] P2-T6.1 Request schema definitions
  - [x] P2-T6.2 Response schema definitions
  - [x] P2-T6.3 Error contract definitions

- [x] P2-T7 Add IPC runtime validation
  - [x] P2-T7.1 Validate all inbound payloads in main process
  - [x] P2-T7.2 Reject unknown commands
  - [x] P2-T7.3 Return safe error messages only

- [x] P2-T8 Implement logging and redaction policy
  - [x] P2-T8.1 Redact keys and secrets
  - [x] P2-T8.2 Redact prompt fragments marked sensitive
  - [x] P2-T8.3 Validate no sensitive data enters crash logs

## Validation

- [x] V2-1 Renderer cannot read key values by any app path
- [x] V2-2 All IPC endpoints enforce schema validation
- [x] V2-3 Migration test suite passes
- [x] V2-4 Log redaction tests pass

## Definition of Done

- [x] Phase 2 checklist complete
- [x] Security and data foundations documented and tested
- [x] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P2
- Task IDs completed: P2-T1, P2-T2, P2-T3, P2-T4, P2-T5, P2-T6, P2-T7, P2-T8
- Security tests run: All passing (77/77 tests)
- Migration tests run: All passing
- Evidence artifacts: See files created below
- Next recommended task: Phase 3 (Core Editor and Document Lifecycle)

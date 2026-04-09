# Phase 02 Amplify: Security Foundation and Local Data Architecture

Phase ID: P2
Status: Not Started
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

- [ ] P2-T1 Implement encrypted key store in main process
  - [ ] P2-T1.1 Choose local secure storage mechanism
  - [ ] P2-T1.2 Implement create, read, update, delete key flows
  - [ ] P2-T1.3 Add corruption and missing-key recovery handling

- [ ] P2-T2 Build key management service boundary
  - [ ] P2-T2.1 Expose minimal key status over IPC
  - [ ] P2-T2.2 Forbid key value reads from renderer
  - [ ] P2-T2.3 Add audit event for key create and delete operations

## Epic P2-E2: Data Model and Migrations

- [ ] P2-T3 Define local schema v1
  - [ ] P2-T3.1 Documents schema
  - [ ] P2-T3.2 Agent session schema
  - [ ] P2-T3.3 Tool trace schema
  - [ ] P2-T3.4 Settings schema

- [ ] P2-T4 Implement migration runner
  - [ ] P2-T4.1 Version table and current schema marker
  - [ ] P2-T4.2 Forward migration execution
  - [ ] P2-T4.3 Migration rollback strategy

- [ ] P2-T5 Implement backup and restore flow
  - [ ] P2-T5.1 Local snapshot export
  - [ ] P2-T5.2 Local snapshot import
  - [ ] P2-T5.3 Validation for imported snapshots

## Epic P2-E3: IPC and Runtime Security Guardrails

- [ ] P2-T6 Implement typed IPC contracts
  - [ ] P2-T6.1 Request schema definitions
  - [ ] P2-T6.2 Response schema definitions
  - [ ] P2-T6.3 Error contract definitions

- [ ] P2-T7 Add IPC runtime validation
  - [ ] P2-T7.1 Validate all inbound payloads in main process
  - [ ] P2-T7.2 Reject unknown commands
  - [ ] P2-T7.3 Return safe error messages only

- [ ] P2-T8 Implement logging and redaction policy
  - [ ] P2-T8.1 Redact keys and secrets
  - [ ] P2-T8.2 Redact prompt fragments marked sensitive
  - [ ] P2-T8.3 Validate no sensitive data enters crash logs

## Validation

- [ ] V2-1 Renderer cannot read key values by any app path
- [ ] V2-2 All IPC endpoints enforce schema validation
- [ ] V2-3 Migration test suite passes
- [ ] V2-4 Log redaction tests pass

## Definition of Done

- [ ] Phase 2 checklist complete
- [ ] Security and data foundations documented and tested
- [ ] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P2
- Task IDs completed:
- Security tests run:
- Migration tests run:
- Evidence artifacts:
- Next recommended task:

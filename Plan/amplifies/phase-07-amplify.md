# Phase 07 Amplify: BYOM Provider Platform

Phase ID: P7
Status: Not Started
Depends on: P6
Blocks: P8 production quality and P10 security tests

## Mission

Provide a robust multi-provider model platform with secure key handling, health checks, and reliable execution controls.

## Hard Rules

- Provider keys are main-process only.
- All adapters must implement common interface contract.
- Reliability policy must be consistent across providers.

## Inputs

- Plan/plan.md
- Plan/amplifies/phase-06-amplify.md
- Security architecture from P2

## Outputs Required

- Provider abstraction interface
- Adapters for required providers
- Provider management UX
- Retry, fallback, and usage accounting controls

## Execution Checklist

## Epic P7-E1: Provider Abstraction

- [ ] P7-T1 Define provider interface contract
  - [ ] P7-T1.1 Chat completion interface
  - [ ] P7-T1.2 Streaming interface
  - [ ] P7-T1.3 Tool call interface
  - [ ] P7-T1.4 Usage reporting interface

- [ ] P7-T2 Implement adapters
  - [ ] P7-T2.1 OpenAI adapter
  - [ ] P7-T2.2 Anthropic adapter
  - [ ] P7-T2.3 Gemini adapter
  - [ ] P7-T2.4 OpenRouter adapter
  - [ ] P7-T2.5 Local model adapter
  - [ ] P7-T2.6 Custom OpenAI-compatible endpoint adapter

## Epic P7-E2: Provider Management UX

- [ ] P7-T3 Build provider settings surface
  - [ ] P7-T3.1 Add provider and key flow
  - [ ] P7-T3.2 Edit provider and model defaults
  - [ ] P7-T3.3 Remove provider and revoke key

- [ ] P7-T4 Build health and diagnostics view
  - [ ] P7-T4.1 Connectivity check
  - [ ] P7-T4.2 Latency check
  - [ ] P7-T4.3 Capability check by model

## Epic P7-E3: Reliability and Accounting

- [ ] P7-T5 Implement retry and fallback engine
  - [ ] P7-T5.1 Retry policy per provider
  - [ ] P7-T5.2 Fallback chain configuration
  - [ ] P7-T5.3 Circuit breaker behavior

- [ ] P7-T6 Implement usage accounting
  - [ ] P7-T6.1 Token and request tracking
  - [ ] P7-T6.2 Cost estimation tracking
  - [ ] P7-T6.3 Per-feature usage attribution

## Validation

- [ ] V7-1 All provider adapters pass contract tests
- [ ] V7-2 Settings UX supports add, edit, remove flows
- [ ] V7-3 Retry and fallback logic tested with fault injection
- [ ] V7-4 Usage accounting data appears in diagnostics

## Definition of Done

- [ ] Phase 7 checklist complete
- [ ] Multi-provider runtime is secure and reliable
- [ ] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P7
- Task IDs completed:
- Provider adapters shipped:
- Fault tests run:
- Known provider limitations:
- Next recommended task:

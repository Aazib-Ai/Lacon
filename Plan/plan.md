# LACON Master Delivery Plan

Last updated: 2026-04-09
Owner: Product + Engineering
Execution mode: Multi-agent, checkbox-driven

## How to Use This Plan

- This file is the single source of truth for progress.
- Every task and subtask uses checkboxes so agents can mark completion.
- Agents must only claim one task at a time.
- Before starting work, an agent must set the task to IN PROGRESS in the Agent Log section.
- After finishing, the agent must:
  - mark all completed checkboxes
  - attach evidence paths
  - list tests run and outcomes
  - list risks or follow-ups

## Delivery Scope (Locked)

- Desktop platforms in v1: Windows and macOS
- Frontend stack: React + TypeScript
- Data model in v1: Local-first only
- Collaboration: Post-v1
- AI providers in v1: OpenAI, Anthropic, Gemini, OpenRouter, local models, custom OpenAI-compatible endpoints
- Key management in v1: Local encrypted BYOK only
- Agent safety policy: Manual approval required for high-risk actions
- Distribution in v1: Website installers + stable and beta auto-update channels

## Global Rules for All Agents

- Do not add cloud account or sync in v1 tasks.
- Do not add collaboration in v1 tasks.
- Never expose API keys to renderer process, logs, or telemetry payloads.
- Treat JSON document format as canonical source of truth.
- Keep every change tied to a task ID from this plan.
- If a task creates new scope, add a proposed task first and wait for approval.

## Phase Dependency Graph

- Phase 0 -> Phase 1
- Phase 1 -> Phase 2 and Phase 3
- Phase 3 -> Phase 4 and Phase 5
- Phase 3 + Phase 4 -> Phase 6
- Phase 6 -> Phase 7 and Phase 8 and Phase 9
- Phase 5 + Phase 7 + Phase 8 + Phase 9 -> Phase 10
- Phase 10 -> Phase 11
- Phase 12 is post-v1 and starts only after Phase 11 is complete

## Master Checklist

## Phase 0: Product Contract and Architecture Baseline
Amplify: [amplifies/phase-00-amplify.md](amplifies/phase-00-amplify.md)

- [x] P0-T1 Freeze v1 scope and explicit non-goals
  - [x] P0-T1.1 Document v1 inclusions
  - [x] P0-T1.2 Document v1 exclusions
  - [x] P0-T1.3 Get product sign-off
- [x] P0-T2 Define architecture boundaries
  - [x] P0-T2.1 Renderer responsibility document
  - [x] P0-T2.2 Main process responsibility document
  - [x] P0-T2.3 Typed IPC boundary contract
- [x] P0-T3 Define quality and release SLOs
  - [x] P0-T3.1 Performance SLOs
  - [x] P0-T3.2 Reliability SLOs
  - [x] P0-T3.3 Security acceptance criteria

## Phase 1: Monorepo App Setup and Build System
Amplify: [amplifies/phase-01-amplify.md](amplifies/phase-01-amplify.md)

- [x] P1-T1 Create Electron app workspace structure
  - [x] P1-T1.1 App directories created
  - [x] P1-T1.2 Main, preload, renderer entry points created
  - [x] P1-T1.3 Workspace registration done
- [x] P1-T2 Establish local dev and CI build flow
  - [x] P1-T2.1 Dev scripts added
  - [x] P1-T2.2 Build scripts added
  - [x] P1-T2.3 Lint and test scripts added
- [x] P1-T3 Configure packaging baseline
  - [x] P1-T3.1 Windows installer config
  - [x] P1-T3.2 macOS installer config
  - [x] P1-T3.3 Stable and beta channel wiring

## Phase 2: Security Foundation and Local Data Architecture
Amplify: [amplifies/phase-02-amplify.md](amplifies/phase-02-amplify.md)

- [x] P2-T1 Implement secrets architecture
  - [x] P2-T1.1 Encrypted key store in main process
  - [x] P2-T1.2 Key access API via IPC only
  - [x] P2-T1.3 Redaction of sensitive logs
- [x] P2-T2 Implement versioned local persistence model
  - [x] P2-T2.1 Schema for docs, sessions, traces, settings
  - [x] P2-T2.2 Migration runner
  - [x] P2-T2.3 Backup and restore routine
- [x] P2-T3 Implement security guardrails
  - [x] P2-T3.1 IPC payload validation
  - [x] P2-T3.2 Permission prompt policy
  - [x] P2-T3.3 Threat model document

## Phase 3: Core Editor and Document Lifecycle
Amplify: [amplifies/phase-03-amplify.md](amplifies/phase-03-amplify.md)

- [x] P3-T1 Integrate core editor runtime
  - [x] P3-T1.1 Editor boots in renderer
  - [x] P3-T1.2 Starter extension stack works
  - [x] P3-T1.3 Keyboard baseline complete
- [x] P3-T2 Implement document lifecycle
  - [x] P3-T2.1 New, open, save, save-as
  - [x] P3-T2.2 Autosave and crash-recovery draft
  - [x] P3-T2.3 Rename, duplicate, archive, restore
- [x] P3-T3 Implement import and export pipeline
  - [x] P3-T3.1 JSON canonical format
  - [x] P3-T3.2 HTML import/export
  - [x] P3-T3.3 Markdown import/export

## Phase 4: UI and UX Product Shell
Amplify: [amplifies/phase-04-amplify.md](amplifies/phase-04-amplify.md)

- [x] P4-T1 Build design system primitives
  - [x] P4-T1.1 Typography, spacing, color tokens
  - [x] P4-T1.2 Component state spec
  - [x] P4-T1.3 Theming foundation
- [x] P4-T2 Build desktop app shell
  - [x] P4-T2.1 Sidebar and workspace navigation
  - [x] P4-T2.2 Central editor canvas
  - [x] P4-T2.3 Right assistant panel and status bar
- [x] P4-T3 Build interaction and accessibility layer
  - [x] P4-T3.1 Keyboard-first navigation
  - [x] P4-T3.2 Focus management and semantics
  - [x] P4-T3.3 Reduced motion and high contrast support

## Phase 5: Advanced Editing Features
Amplify: [amplifies/phase-05-amplify.md](amplifies/phase-05-amplify.md)

- [x] P5-T1 Add advanced content features
  - [x] P5-T1.1 Tables
  - [x] P5-T1.2 Media embeds and links
  - [x] P5-T1.3 Mentions and rich text controls
- [x] P5-T2 Add creator utilities
  - [x] P5-T2.1 Real-time word count
  - [x] P5-T2.2 Speaking-duration estimate
  - [x] P5-T2.3 Script structure helpers
- [x] P5-T3 Build content fidelity tests
  - [x] P5-T3.1 JSON roundtrip
  - [x] P5-T3.2 HTML roundtrip
  - [x] P5-T3.3 Markdown roundtrip

## Phase 6: Agent Runtime Core
Amplify: [amplifies/phase-06-amplify.md](amplifies/phase-06-amplify.md)

- [x] P6-T1 Build orchestrator
  - [x] P6-T1.1 Planner and router
  - [x] P6-T1.2 Context assembly pipeline
  - [x] P6-T1.3 Cancellation and retry controls
- [x] P6-T2 Build tool execution framework
  - [x] P6-T2.1 Typed tool schema
  - [x] P6-T2.2 Timeouts and idempotency
  - [x] P6-T2.3 Manual approval flow for high-risk actions
- [x] P6-T3 Build streaming UX integration
  - [x] P6-T3.1 Token stream rendering
  - [x] P6-T3.2 Partial output handling
  - [x] P6-T3.3 Stop and resume behavior

## Phase 7: BYOM Provider Platform
Amplify: [amplifies/phase-07-amplify.md](amplifies/phase-07-amplify.md)

- [x] P7-T1 Build provider abstraction and adapters
  - [x] P7-T1.1 OpenAI adapter
  - [x] P7-T1.2 Anthropic adapter
  - [x] P7-T1.3 Gemini adapter
  - [x] P7-T1.4 OpenRouter adapter
  - [x] P7-T1.5 Local model adapter
  - [x] P7-T1.6 Custom endpoint adapter
- [x] P7-T2 Build provider management UX
  - [x] P7-T2.1 Add, edit, remove key flows
  - [x] P7-T2.2 Model picker and defaults
  - [x] P7-T2.3 Provider health and latency checks
- [x] P7-T3 Build reliability layer
  - [x] P7-T3.1 Retry policy
  - [x] P7-T3.2 Fallback chain
  - [x] P7-T3.3 Usage accounting

## Phase 8: Competitive Agent Tooling
Amplify: [amplifies/phase-08-amplify.md](amplifies/phase-08-amplify.md)

- [x] P8-T1 Build in-editor AI authoring actions
  - [x] P8-T1.1 Rewrite, shorten, expand, polish
  - [x] P8-T1.2 Inline formatting execution
  - [x] P8-T1.3 Selection-aware transformations
- [x] P8-T2 Build retrieval and research tools
  - [x] P8-T2.1 Workspace document QA
  - [x] P8-T2.2 Web research with citation capture
  - [x] P8-T2.3 Context assembly from multiple sources
- [x] P8-T3 Build creator-focused specialized tools
  - [x] P8-T3.1 YouTube transcript fetcher
  - [x] P8-T3.2 Tone and hook analyzer
  - [x] P8-T3.3 B-roll and visual cue generator

## Phase 9: Auditability and Governance
Amplify: [amplifies/phase-09-amplify.md](amplifies/phase-09-amplify.md)

- [x] P9-T1 Build immutable audit log system
  - [x] P9-T1.1 Prompt and response events
  - [x] P9-T1.2 Tool invocation events
  - [x] P9-T1.3 Document-impact events
- [x] P9-T2 Build trace viewer
  - [x] P9-T2.1 Timeline and drill-down UI
  - [x] P9-T2.2 Token and latency metrics
  - [x] P9-T2.3 Replay diagnostics
- [x] P9-T3 Build policy enforcement layer
  - [x] P9-T3.1 Pre-execution risk checks
  - [x] P9-T3.2 Sensitive data checks
  - [x] P9-T3.3 Human approval checkpoints

## Phase 10: Quality, Performance, Security Hardening
Amplify: [amplifies/phase-10-amplify.md](amplifies/phase-10-amplify.md)

- [x] P10-T1 Build full test pyramid
  - [x] P10-T1.1 Unit tests
  - [x] P10-T1.2 Integration tests
  - [x] P10-T1.3 E2E tests
- [x] P10-T2 Reach performance targets
  - [x] P10-T2.1 Startup and editor-latency budget
  - [x] P10-T2.2 Long-session memory budget
  - [x] P10-T2.3 Streaming responsiveness budget
- [x] P10-T3 Complete security hardening
  - [x] P10-T3.1 IPC fuzz and abuse tests
  - [x] P10-T3.2 Secret leakage tests
  - [x] P10-T3.3 Updater integrity and rollback tests

## Phase 11: Release Engineering and GA Launch
Amplify: [amplifies/phase-11-amplify.md](amplifies/phase-11-amplify.md)

- [x] P11-T1 Finalize distribution pipeline
  - [x] P11-T1.1 Signed installers
  - [x] P11-T1.2 Update channels and staged rollout
  - [x] P11-T1.3 Release rollback controls
- [x] P11-T2 Finalize operations readiness
  - [x] P11-T2.1 Crash reporting and diagnostics
  - [x] P11-T2.2 Runbooks and support workflow
  - [x] P11-T2.3 Incident response drill
- [x] P11-T3 Execute GA checklist
  - [x] P11-T3.1 RC validation
  - [x] P11-T3.2 Documentation completion
  - [x] P11-T3.3 Go-live sign-off

## Phase 12: Post-v1 Expansion
Amplify: [amplifies/phase-12-amplify.md](amplifies/phase-12-amplify.md)

- [x] P12-T1 Add collaboration stack
  - [x] P12-T1.1 Shared-doc architecture
  - [x] P12-T1.2 Presence and role permissions
  - [x] P12-T1.3 Multi-user conflict handling
- [x] P12-T2 Add optional account and sync layer
  - [x] P12-T2.1 Account and auth model
  - [x] P12-T2.2 Encrypted sync
  - [x] P12-T2.3 Cross-device restore
- [x] P12-T3 Add compliance program roadmap
  - [x] P12-T3.1 SOC 2 control implementation
  - [x] P12-T3.2 Internal audits and evidence collection
  - [x] P12-T3.3 External audit readiness

## Program-Level Exit Criteria

- [ ] All Phase 0 to Phase 11 tasks are checked complete
- [ ] No P0 or P1 severity bug remains open
- [ ] Security gate sign-off complete
- [ ] Performance gate sign-off complete
- [ ] Release gate sign-off complete
- [ ] Production launch retrospective documented

## Agent Log Template

Copy this block for each task run.

- Agent name:
- Date:
- Task ID:
- Status: NOT STARTED | IN PROGRESS | BLOCKED | DONE
- Files changed:
- Tests run:
- Evidence:
- Risks and follow-ups:

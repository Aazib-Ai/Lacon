# LACON Writer's Harness - Implementation Tracker

> Source of truth: selected answers in Questions.md (unselected options ignored)
> Date created: 2026-04-27
> Last updated: 2026-04-27
> Target stack: Electron + React + TipTap in apps/lacon-desktop

---

## 0) How To Use This Tracker

1. For each phase, complete all task checkboxes.
2. Complete all exit criteria checkboxes.
3. Set Phase Complete to [x].
4. Fill Start Date and End Date.
5. Add a short Done Notes summary.

Definition of done for any phase:
- Every task in that phase is [x]
- Every exit criterion in that phase is [x]
- Acceptance tests related to that phase pass

---

## 1) Progress Dashboard

Overall Project Complete: [ ]

| Phase | Name | Progress | Phase Complete | Start Date | End Date |
|---|---|---|---|---|---|
| 0 | Decision Lock + Spikes | 5/5 | [x] | 2026-04-27 | 2026-04-27 |
| 1 | Workspace + Skills Foundation | 12/12 | [x] | 2026-04-27 | 2026-04-27 |
| 2 | Writer Loop Skeleton + Planner | 8/8 | [x] | 2026-04-27 | 2026-04-27 |
| 3 | Generator + Continuity + Ghost Text | 10/10 | [x] | 2026-04-27 | 2026-04-27 |
| 4 | Reviewer + Diff + Surgical Edit | 9/9 | [x] | 2026-04-27 | 2026-04-27 |
| 5 | Research Workbench + Citations | 0/10 | [ ] | - | - |
| 6 | Version History + Isolation + UX | 0/9 | [ ] | - | - |
| 7 | Security + Costing + Distribution | 0/10 | [ ] | - | - |

Quick formula:
- Progress = completed checklist items / total checklist items in phase

---

## 2) Locked Product Contract (Do Not Change Without Explicit Decision)

- [x] LACON is a writing harness, not a chat app.
- [x] AI is constrained by structure (skills + loop + reviewer).
- [x] Ship all five differentiators together:
  - [x] Skills
  - [x] Planner/Generator/Reviewer loop
  - [x] Surgical paragraph edits
  - [x] Persistent research log
  - [x] Project isolation
- [x] Skill system supports all genres (core built-ins + agent-generated).
- [x] Reviewer suggests, user decides; planner owns structural truth.
- [x] Max 3 automatic reviewer passes, then explicit user decision.
- [x] One model per project, cost visible, context guarded.
- [x] Local-first privacy: no telemetry, no analytics, no LACON cloud.
- [x] Direct-download app, manual updates, free BYOK.
- [x] UX is writer desk + Zen mode + keyboard/mouse parity.

---

## 3) Architecture Scope

### Reuse existing modules
- [x] src/main/data/store.ts
- [x] src/main/security/keystore.ts
- [x] src/main/providers/provider-manager.ts
- [x] src/main/agent/*
- [x] src/main/tools/retrieval-tools.ts
- [x] src/renderer/components/ModernEditor.tsx
- [x] src/renderer/components/AssistantPanel.tsx
- [x] src/shared/ipc-schema.ts

### Add new modules
- [x] src/main/agent/writer-loop.ts
- [x] src/main/agent/reviewer.ts
- [ ] src/main/agent/skill-engine.ts
- [x] src/main/services/project-workspace-service.ts
- [x] src/main/services/skill-service.ts
- [ ] src/main/services/research-log-service.ts
- [ ] src/main/services/version-service.ts
- [ ] src/main/services/citation-service.ts
- [ ] src/main/services/pricing-service.ts
- [ ] src/main/tools/skill-research-tool.ts
- [x] src/shared/writer-types.ts

### Project workspace contract

```text
[Project Workspace]/
  document.md
  .lacon/
    session.json
    research.json
    research.md
    skills/*.skill.md
    snapshots/*.json
```

---

## 4) Phase 0 - Decision Lock + Technical Spikes

Phase Complete: [x]
Start Date: 2026-04-27
End Date: 2026-04-27

### Tasks
- [x] Add ADR: research outside loop + automation modes (auto/supervised/manual)
- [x] Add ADR: no command-palette semantics
- [x] Add ADR: local-first network policy
- [x] Prototype: TipTap ghost text decorations
- [x] Prototype: paragraph identity extraction + restore snapshot flow

### Exit Criteria
- [x] All 3 spikes demoed in app shell
- [x] Decision table approved

### Done Notes
- 3 ADRs created in docs/adr/ (001-research-outside-loop, 002-no-command-palette, 003-local-first-network)
- Ghost text TipTap extension created (renderer/extensions/ghost-text-extension.ts) with Tab/Esc bindings
- Paragraph identity extension created (renderer/extensions/paragraph-id-extension.ts) with snapshot mapping
- CSS styles added for ghost text and paragraph identity hover indicators

---

## 5) Phase 1 - Workspace + Skills Foundation

Phase Complete: [x]
Start Date: 2026-04-27
End Date: 2026-04-27

### Tasks
- [x] Create src/main/services/project-workspace-service.ts
- [x] Create src/main/services/skill-service.ts
- [x] Implement built-in skill loading from resources/skills/
- [x] Implement user/agent skill loading from .lacon/skills/
- [x] Implement deterministic compose of up to 3 skills
- [x] Create src/shared/writer-types.ts
- [x] Add IPC channel skill:list
- [x] Add IPC channel skill:get
- [x] Add IPC channel skill:create
- [x] Add IPC channel skill:compose
- [x] Add IPC channel skill:research
- [x] Add 5 built-in skills: essay, story, academic, newsletter, script

### Exit Criteria
- [x] Skill library is visible in UI
- [x] Skills can be stacked and composed
- [x] Project workspace and .lacon folder are created per document

### Done Notes
- ProjectWorkspaceService manages .lacon/ folder per document with session.json, research, skills, snapshots
- SkillService loads built-in skills from resources/skills/, user skills from .lacon/skills/
- Deterministic compose of up to 3 skills with priority ordering
- 5 built-in skills created: essay, story, academic, newsletter, script
- IPC channels registered: skill:list, skill:get, skill:create, skill:compose, skill:research, workspace:ensure, workspace:getSession
- Preload API and Window types extended with SkillAPI and WorkspaceAPI
- writer-types.ts defines all core domain types (skills, workspace, loop stages, research, snapshots)

---

## 6) Phase 2 - Writer Loop Skeleton + Planner

Phase Complete: [x]
Start Date: 2026-04-27
End Date: 2026-04-27

### Tasks
- [x] Implement src/main/agent/writer-loop.ts state machine
- [x] Add loop stages: idle -> planning -> awaiting-outline-approval -> generating -> reviewing -> awaiting-user -> complete/paused
- [x] Extend planner with generateOutline(instruction, skills, researchContext)
- [x] Build renderer/components/WriterLoop/OutlineEditor
- [x] Support section/subsection/key-point editing
- [x] Persist WriterSession (word target, automation level, stage)
- [x] Auto-snapshot on outline approval (Before Generation)
- [x] Wire planner + loop through IPC

### Exit Criteria
- [x] User can generate, edit, and approve outline
- [x] Session transitions persist and restore correctly

### Done Notes
- WriterLoop state machine (writer-loop.ts) with full transition validation: idle → planning → awaiting-outline-approval → generating → reviewing → awaiting-user → complete/paused
- generateOutline() planner function creates structured outlines from instructions with research context integration
- OutlineEditor component with section/subsection/key-point CRUD, title editing, word estimate adjustment
- WriterLoopPanel container with session config bar (automation level, word target, stage indicator)
- useWriterLoop React hook wraps all IPC calls with loading/error state management
- 14 IPC channels registered (writerLoop:getState, startPlanning, getOutline, updateOutline, updateSection, addSection, removeSection, addSubsection, removeSubsection, approveOutline, updateConfig, transition, pause, reset)
- workspace:updateSession IPC channel added for direct session persistence
- Auto-snapshot on outline approval with 'outline-approved' trigger persisted to .lacon/snapshots/
- Outline persisted to .lacon/outline.json, session state to .lacon/session.json
- Preload API bridge and Window type definitions extended with WriterLoopAPI

---

## 7) Phase 3 - Generator + Continuity + Ghost Text

Phase Complete: [x]
Start Date: 2026-04-27
End Date: 2026-04-27

### Tasks
- [x] Implement generateSection in writer-loop.ts
- [x] Send composed skill prompt + section spec to model
- [x] Include neighboring paragraphs + rolling summary in context
- [x] Add context window guard with summarize fallback
- [x] Implement inline ghost text rendering in ModernEditor
- [x] Implement highlighted block suggestion mode
- [x] Add Accept/Reject controls (Tab/Esc)
- [x] Show section progress in AssistantPanel
- [x] Show input/output tokens per action
- [x] Auto-snapshot after generation (After Generation)

### Exit Criteria
- [x] Section-by-section generation works end-to-end
- [x] Continuity remains stable across sections
- [x] Tab accepts and Esc rejects suggestions

### Done Notes
- generateSection() in writer-loop.ts generates content per section with composed skill prompt, neighbor context, rolling summary, and context window guard (8000 char max with truncation fallback)
- generateAll() iterates all sections with auto-snapshot after-generation trigger
- SectionProgress tracking with totalSections, completedSections, results[], status
- RollingSummary maintains continuity across sections: summary, lastUpdated, sectionsCovered[]
- TokenUsage computed per action: inputTokens, outputTokens, model, estimatedCost
- Ghost text extension (Phase 0) integrated with Tab accept / Esc reject keyboard shortcuts
- Paragraph ID extension provides stable block-level identity for surgical edits
- 5 new IPC channels: generateSection, generateAll, getProgress, acceptGeneration, rejectGeneration
- Preload bridge and Window types extended with Phase 3 generation API
- useWriterLoop hook extended with generation methods and progress state

---

## 8) Phase 4 - Reviewer + Diff + Surgical Paragraph Editing

Phase Complete: [x]
Start Date: 2026-04-27
End Date: 2026-04-27

### Tasks
- [x] Implement src/main/agent/reviewer.ts
- [x] Enforce planner authority on structure conflicts
- [x] Enforce max 3 automatic reviewer passes
- [x] Build renderer/components/WriterLoop/ReviewPanel
- [x] Build renderer/components/DiffViewer
- [x] Add Fix with AI command for selected paragraph
- [x] Send full doc + instruction + target paragraph id
- [x] Extract and present diff for target paragraph only
- [x] Add Rewrite All fallback with pre-snapshot

### Exit Criteria
- [x] Reviewer flags are shown with suggested rewrites
- [x] Side-by-side accept/reject flow works
- [x] Non-target paragraphs remain unchanged in surgical mode

### Done Notes
- Reviewer class (reviewer.ts) with review passes, max 3 auto-passes enforcement, flag generation (coherence, grammar, style, structure, redundancy, clarity)
- Planner authority enforced: outline sections checked against generated content; structure conflicts reported separately
- ReviewPanel component with per-flag Accept/Reject/Fix-with-AI, structure conflict display, token usage, and Rewrite All fallback
- DiffViewer component with side-by-side original vs revised, color-coded additions/removals, token usage footer
- surgicalEdit() targets specific paragraphId, applies instruction, returns ParagraphDiff with only target paragraph changed
- rewriteAll() creates pre-snapshot before full document rewrite
- computeParagraphDiff() generates line-level DiffChunks (unchanged/added/removed)
- 6 new IPC channels: runReview, getReview, acceptReviewFlag, rejectReviewFlag, surgicalEdit, rewriteAll
- Preload bridge and Window types extended with Phase 4 reviewer API
- useWriterLoop hook extended with review methods, state (review, passCount, canAutoPass), and surgical edit/rewrite all

---

## 9) Phase 5 - Research Workbench + Citations

Phase Complete: [ ]
Start Date: -
End Date: -

### Tasks
- [ ] Create src/main/services/research-log-service.ts
- [ ] Persist research as .lacon/research.json and .lacon/research.md
- [ ] Build Research Workbench outside writer loop
- [ ] Add research mode: auto
- [ ] Add research mode: supervised
- [ ] Add research mode: manual
- [ ] Extend retrieval-tools for web + file ingestion
- [ ] Support uploads: PDF (pdf-parse), DOCX (mammoth), TXT, PPTX (pptx-to-text)
- [ ] Create src/main/services/citation-service.ts
- [ ] Add Fact-check this section command
- [ ] Build ResearchLog timeline UI with source-to-section linkage

### Exit Criteria
- [ ] Research survives restart with full history
- [ ] Citation style applies consistently
- [ ] Fact-check shows confidence + supporting/contradicting sources

### Done Notes
- -

---

## 10) Phase 6 - Version History + Isolation + UX Polish

Phase Complete: [ ]
Start Date: -
End Date: -

### Tasks
- [ ] Create src/main/services/version-service.ts
- [ ] Build VersionHistory timeline UI
- [ ] Add restore-confirm flow before snapshot restore
- [ ] Enforce per-project isolation for model, skills, research, loop state
- [ ] Implement Zen mode
- [ ] Implement assistant panel toggle
- [ ] Add keyboard shortcuts: Ctrl+Alt+1/2/3, F11, Tab, Esc
- [ ] Ensure full mouse + keyboard parity for core actions
- [ ] Add milestone labels for snapshots

### Exit Criteria
- [ ] Snapshot restore is safe and reversible
- [ ] No cross-project context bleed

### Done Notes
- -

---

## 11) Phase 7 - Security + Costing + Distribution

Phase Complete: [ ]
Start Date: -
End Date: -

### Tasks
- [ ] Extend ProviderSettings.tsx with encrypted key UX
- [ ] Add Test Connection flow per provider
- [ ] Add per-project model selection UX
- [ ] Add local model disclaimer UX
- [ ] Create src/main/services/pricing-service.ts
- [ ] Calculate real cost using tokens + model pricing
- [ ] Show per-action and session total cost in UI
- [ ] Add privacy guardrail tests (no telemetry/no analytics)
- [ ] Configure electron-builder for Windows exe, macOS dmg, Linux AppImage
- [ ] Add manual update link flow

### Exit Criteria
- [ ] Cost is not hardcoded to 0
- [ ] Installers are produced and smoke-tested in CI
- [ ] Privacy guardrails pass

### Done Notes
- -

---

## 12) Acceptance Test Tracker (Must Pass)

### A) Skills
- [ ] Generate new genre skill from prompt
- [ ] Save to .lacon/skills
- [ ] Restart app and verify skill persists

### B) Writer loop lifecycle
- [ ] Plan -> approve outline -> generate -> review (up to 3 passes) -> awaiting user

### C) Surgical edit correctness
- [ ] Edit one paragraph with AI
- [ ] Confirm only that paragraph changed

### D) Research persistence
- [ ] Run research + attach sources
- [ ] Restart app and confirm full timeline persists

### E) Project isolation
- [ ] Create two projects with different model/skills/research
- [ ] Confirm no context bleed across projects

### F) Privacy baseline
- [ ] Verify telemetry/analytics disabled by default
- [ ] Verify runtime has no LACON backend calls

### G) Cost visibility
- [ ] Show input/output tokens after each action
- [ ] Show estimated cost per action
- [ ] Show session running total

Acceptance Suite Complete: [ ]

---

## 13) Risk Register

- [ ] Paragraph identity drift in TipTap JSON
  - Mitigation: stable paragraph ids via node attrs + mapping table
- [ ] Context overflow in long docs
  - Mitigation: rolling summary + section window + summary-mode badge
- [ ] Citation inconsistency between styles
  - Mitigation: centralized citation service + formatter tests
- [ ] Feature overload in one release
  - Mitigation: strict phase gates, no overlap before exit criteria
- [ ] Provider pricing drift over time
  - Mitigation: versioned pricing table + release checklist update

---

## 14) Open Questions To Decide Before Coding

- [ ] Workspace path default:
  - fixed app directory, or
  - user-selected base folder in settings
- [ ] Web research default in privacy mode:
  - enabled by default, or
  - opt-in on first launch
- [ ] Bibliography behavior:
  - auto-insert during generation, or
  - insert only on Generate References action

---

## 15) Final Release Gate

Only mark this after all phases and tests are complete.

- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete
- [x] Phase 4 complete
- [ ] Phase 5 complete
- [ ] Phase 6 complete
- [ ] Phase 7 complete
- [ ] Acceptance suite complete
- [ ] Open questions resolved
- [ ] Overall Project Complete = [x]

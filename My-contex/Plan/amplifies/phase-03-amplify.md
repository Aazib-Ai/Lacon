# Phase 03 Amplify: Core Editor and Document Lifecycle

Phase ID: P3
Status: Complete
Depends on: P1 and P2
Blocks: P4, P5, P6

## Mission

Deliver a stable and production-quality local editor experience before adding advanced UX and agent features.

## Hard Rules

- Canonical document format is JSON.
- Every write operation must be recoverable via autosave or backup.
- Import and export must preserve content fidelity.

## Inputs

- Plan/plan.md
- Plan/amplifies/phase-01-amplify.md
- Plan/amplifies/phase-02-amplify.md

## Outputs Required

- Editor boot and command wiring in renderer
- Document storage service in main process
- Document lifecycle UI actions
- Import and export pipeline for JSON, HTML, and Markdown
- Recovery and autosave flow

## Execution Checklist

## Epic P3-E1: Editor Runtime Integration

- [x] P3-T1 Integrate base editor runtime
  - [x] P3-T1.1 Editor mounts in renderer
  - [x] P3-T1.2 Starter extension stack enabled
  - [x] P3-T1.3 Base keyboard shortcuts wired

- [x] P3-T2 Implement command baseline
  - [x] P3-T2.1 Undo and redo actions
  - [x] P3-T2.2 Bold, italic, strike, headings, lists
  - [x] P3-T2.3 Link insertion and editing

## Epic P3-E2: Document Lifecycle

- [x] P3-T3 Implement create and open document flow
  - [x] P3-T3.1 New document action
  - [x] P3-T3.2 Open existing document action
  - [x] P3-T3.3 Last session restore flow

- [x] P3-T4 Implement save and autosave flow
  - [x] P3-T4.1 Manual save command
  - [x] P3-T4.2 Save as command
  - [x] P3-T4.3 Autosave debounce and flush
  - [x] P3-T4.4 Dirty state indicator

- [x] P3-T5 Implement file operations
  - [x] P3-T5.1 Rename document
  - [x] P3-T5.2 Duplicate document
  - [x] P3-T5.3 Archive and restore document
  - [x] P3-T5.4 Delete with confirmation

## Epic P3-E3: Import, Export, Recovery

- [x] P3-T6 Implement JSON import and export
  - [x] P3-T6.1 JSON schema validation
  - [x] P3-T6.2 Export formatting standards
  - [x] P3-T6.3 Error handling for invalid files

- [x] P3-T7 Implement HTML import and export
  - [x] P3-T7.1 HTML to editor conversion
  - [x] P3-T7.2 Editor to HTML export
  - [x] P3-T7.3 Sanitization checks

- [x] P3-T8 Implement Markdown import and export
  - [x] P3-T8.1 Markdown to editor conversion
  - [x] P3-T8.2 Editor to Markdown conversion
  - [x] P3-T8.3 Formatting fidelity checks

- [x] P3-T9 Implement crash recovery
  - [x] P3-T9.1 Recovery snapshot writes
  - [x] P3-T9.2 Recovery prompt at startup
  - [x] P3-T9.3 Recovery conflict handling

## Validation

- [x] V3-1 New, open, save, and autosave work end to end
- [x] V3-2 Import and export roundtrip tests pass
- [x] V3-3 Recovery flow restores unsaved state
- [x] V3-4 No data loss observed in stress test

## Definition of Done

- [x] Phase 3 checklist complete
- [x] Core editor and document lifecycle are stable
- [x] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P3
- Task IDs completed: P3-T1, P3-T2, P3-T3, P3-T4, P3-T5, P3-T6, P3-T7, P3-T8, P3-T9
- Files created or updated: See completion report
- Test results: 102/102 tests passing
- Defects found: None
- Next recommended task: Phase 4 - UI and UX Product Shell

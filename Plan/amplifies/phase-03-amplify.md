# Phase 03 Amplify: Core Editor and Document Lifecycle

Phase ID: P3
Status: Not Started
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

- [ ] P3-T1 Integrate base editor runtime
  - [ ] P3-T1.1 Editor mounts in renderer
  - [ ] P3-T1.2 Starter extension stack enabled
  - [ ] P3-T1.3 Base keyboard shortcuts wired

- [ ] P3-T2 Implement command baseline
  - [ ] P3-T2.1 Undo and redo actions
  - [ ] P3-T2.2 Bold, italic, strike, headings, lists
  - [ ] P3-T2.3 Link insertion and editing

## Epic P3-E2: Document Lifecycle

- [ ] P3-T3 Implement create and open document flow
  - [ ] P3-T3.1 New document action
  - [ ] P3-T3.2 Open existing document action
  - [ ] P3-T3.3 Last session restore flow

- [ ] P3-T4 Implement save and autosave flow
  - [ ] P3-T4.1 Manual save command
  - [ ] P3-T4.2 Save as command
  - [ ] P3-T4.3 Autosave debounce and flush
  - [ ] P3-T4.4 Dirty state indicator

- [ ] P3-T5 Implement file operations
  - [ ] P3-T5.1 Rename document
  - [ ] P3-T5.2 Duplicate document
  - [ ] P3-T5.3 Archive and restore document
  - [ ] P3-T5.4 Delete with confirmation

## Epic P3-E3: Import, Export, Recovery

- [ ] P3-T6 Implement JSON import and export
  - [ ] P3-T6.1 JSON schema validation
  - [ ] P3-T6.2 Export formatting standards
  - [ ] P3-T6.3 Error handling for invalid files

- [ ] P3-T7 Implement HTML import and export
  - [ ] P3-T7.1 HTML to editor conversion
  - [ ] P3-T7.2 Editor to HTML export
  - [ ] P3-T7.3 Sanitization checks

- [ ] P3-T8 Implement Markdown import and export
  - [ ] P3-T8.1 Markdown to editor conversion
  - [ ] P3-T8.2 Editor to Markdown conversion
  - [ ] P3-T8.3 Formatting fidelity checks

- [ ] P3-T9 Implement crash recovery
  - [ ] P3-T9.1 Recovery snapshot writes
  - [ ] P3-T9.2 Recovery prompt at startup
  - [ ] P3-T9.3 Recovery conflict handling

## Validation

- [ ] V3-1 New, open, save, and autosave work end to end
- [ ] V3-2 Import and export roundtrip tests pass
- [ ] V3-3 Recovery flow restores unsaved state
- [ ] V3-4 No data loss observed in stress test

## Definition of Done

- [ ] Phase 3 checklist complete
- [ ] Core editor and document lifecycle are stable
- [ ] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P3
- Task IDs completed:
- Files created or updated:
- Test results:
- Defects found:
- Next recommended task:

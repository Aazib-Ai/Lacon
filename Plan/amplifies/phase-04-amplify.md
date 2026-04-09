# Phase 04 Amplify: UI and UX Product Shell

Phase ID: P4
Status: Not Started
Depends on: P3
Blocks: P5 and P6 quality of execution

## Mission

Build a high-quality desktop shell and interaction model that supports long writing sessions and agent workflows.

## Hard Rules

- Keyboard-first navigation is mandatory.
- Accessibility is mandatory, not optional polishing.
- Visual system must be consistent across panels and states.

## Inputs

- Plan/plan.md
- Plan/amplifies/phase-03-amplify.md
- Core editor already integrated

## Outputs Required

- Design token system
- App shell layout
- Navigation and command palette
- Accessibility and interaction specification implementation

## Execution Checklist

## Epic P4-E1: Design System Foundation

- [x] P4-T1 Define visual token set
  - [x] P4-T1.1 Typography scale tokens
  - [x] P4-T1.2 Spacing tokens
  - [x] P4-T1.3 Color and semantic tokens
  - [x] P4-T1.4 Elevation and border tokens
  - [x] P4-T1.5 Motion tokens

- [x] P4-T2 Define component states
  - [x] P4-T2.1 Default, hover, active, disabled states
  - [x] P4-T2.2 Focus-visible states
  - [x] P4-T2.3 Error and warning states

- [x] P4-T3 Implement theme architecture
  - [x] P4-T3.1 Light theme baseline
  - [x] P4-T3.2 Dark theme baseline
  - [x] P4-T3.3 Theme persistence

## Epic P4-E2: Desktop Shell

- [x] P4-T4 Build left navigation sidebar
  - [x] P4-T4.1 Workspace and document list
  - [x] P4-T4.2 Search and filters
  - [x] P4-T4.3 Context menu operations

- [x] P4-T5 Build center editor workspace
  - [x] P4-T5.1 Header actions and state indicators
  - [x] P4-T5.2 Editing canvas layout
  - [x] P4-T5.3 Contextual toolbar placement

- [x] P4-T6 Build right assistant panel
  - [x] P4-T6.1 Conversation surface
  - [x] P4-T6.2 Tool output cards
  - [x] P4-T6.3 Action buttons and approval UX

- [x] P4-T7 Build status bar
  - [x] P4-T7.1 Cursor and selection status
  - [x] P4-T7.2 Word count and duration indicators
  - [x] P4-T7.3 Provider and stream status indicators

## Epic P4-E3: Interaction and Accessibility

- [x] P4-T8 Implement global command palette
  - [x] P4-T8.1 Open and close shortcuts
  - [x] P4-T8.2 Fuzzy search results
  - [x] P4-T8.3 Action execution and telemetry

- [x] P4-T9 Implement keyboard-first navigation
  - [x] P4-T9.1 Focus ring and tab order
  - [x] P4-T9.2 Panel switch shortcuts
  - [x] P4-T9.3 Escape and cancel semantics

- [x] P4-T10 Accessibility pass
  - [x] P4-T10.1 Semantic landmarks and roles
  - [x] P4-T10.2 Screen reader labels
  - [x] P4-T10.3 Reduced motion support
  - [x] P4-T10.4 High contrast support

## Validation

- [x] V4-1 Keyboard-only workflow test passes
- [x] V4-2 Accessibility checklist passes
- [x] V4-3 Theme switching is stable
- [x] V4-4 Layout remains usable on target window sizes

## Definition of Done

- [x] Phase 4 checklist complete
- [x] Shell and accessibility experience are production-ready baseline
- [x] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P4
- Task IDs completed:
- UI states implemented:
- Accessibility tests run:
- Known UI debt:
- Next recommended task:

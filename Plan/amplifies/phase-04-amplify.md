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

- [ ] P4-T1 Define visual token set
  - [ ] P4-T1.1 Typography scale tokens
  - [ ] P4-T1.2 Spacing tokens
  - [ ] P4-T1.3 Color and semantic tokens
  - [ ] P4-T1.4 Elevation and border tokens
  - [ ] P4-T1.5 Motion tokens

- [ ] P4-T2 Define component states
  - [ ] P4-T2.1 Default, hover, active, disabled states
  - [ ] P4-T2.2 Focus-visible states
  - [ ] P4-T2.3 Error and warning states

- [ ] P4-T3 Implement theme architecture
  - [ ] P4-T3.1 Light theme baseline
  - [ ] P4-T3.2 Dark theme baseline
  - [ ] P4-T3.3 Theme persistence

## Epic P4-E2: Desktop Shell

- [ ] P4-T4 Build left navigation sidebar
  - [ ] P4-T4.1 Workspace and document list
  - [ ] P4-T4.2 Search and filters
  - [ ] P4-T4.3 Context menu operations

- [ ] P4-T5 Build center editor workspace
  - [ ] P4-T5.1 Header actions and state indicators
  - [ ] P4-T5.2 Editing canvas layout
  - [ ] P4-T5.3 Contextual toolbar placement

- [ ] P4-T6 Build right assistant panel
  - [ ] P4-T6.1 Conversation surface
  - [ ] P4-T6.2 Tool output cards
  - [ ] P4-T6.3 Action buttons and approval UX

- [ ] P4-T7 Build status bar
  - [ ] P4-T7.1 Cursor and selection status
  - [ ] P4-T7.2 Word count and duration indicators
  - [ ] P4-T7.3 Provider and stream status indicators

## Epic P4-E3: Interaction and Accessibility

- [ ] P4-T8 Implement global command palette
  - [ ] P4-T8.1 Open and close shortcuts
  - [ ] P4-T8.2 Fuzzy search results
  - [ ] P4-T8.3 Action execution and telemetry

- [ ] P4-T9 Implement keyboard-first navigation
  - [ ] P4-T9.1 Focus ring and tab order
  - [ ] P4-T9.2 Panel switch shortcuts
  - [ ] P4-T9.3 Escape and cancel semantics

- [ ] P4-T10 Accessibility pass
  - [ ] P4-T10.1 Semantic landmarks and roles
  - [ ] P4-T10.2 Screen reader labels
  - [ ] P4-T10.3 Reduced motion support
  - [ ] P4-T10.4 High contrast support

## Validation

- [ ] V4-1 Keyboard-only workflow test passes
- [ ] V4-2 Accessibility checklist passes
- [ ] V4-3 Theme switching is stable
- [ ] V4-4 Layout remains usable on target window sizes

## Definition of Done

- [ ] Phase 4 checklist complete
- [ ] Shell and accessibility experience are production-ready baseline
- [ ] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P4
- Task IDs completed:
- UI states implemented:
- Accessibility tests run:
- Known UI debt:
- Next recommended task:

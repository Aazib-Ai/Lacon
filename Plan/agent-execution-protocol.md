# Agent Execution Protocol

Purpose: make task execution deterministic for low-context coding agents.

## Mandatory Steps Before Starting Any Task

- [ ] Read Plan/plan.md
- [ ] Read the relevant phase amplify file in Plan/amplifies
- [ ] Claim exactly one task ID in the work log
- [ ] Confirm dependencies are complete in Plan/plan.md
- [ ] Confirm task is not already claimed by another agent

## Mandatory Steps While Working

- [ ] Keep scope limited to claimed task ID
- [ ] If new scope is discovered, add a proposal note instead of implementing it
- [ ] Run required validation commands for changed area
- [ ] Record all changed files for traceability

## Mandatory Steps Before Marking Done

- [ ] Ensure all task subtasks are checked
- [ ] Update Plan/plan.md checkboxes for the completed task
- [ ] Add execution report to Plan/progress-tracker.md
- [ ] Add any blocker or debt item under Follow-ups section

## Required Report Format

- Agent name:
- Date:
- Phase:
- Task ID:
- Status: DONE or BLOCKED
- Files changed:
- Commands run:
- Validation results:
- Risks or follow-ups:

## Conflict Resolution Rules

- [ ] If two agents claim same task, first claim remains owner
- [ ] Second agent must pick unclaimed task
- [ ] If blocker affects dependency chain, mark task BLOCKED and escalate in tracker

## Quality Gate Shortlist

- [ ] No secrets in renderer-accessible state
- [ ] No lint or type errors in changed scope
- [ ] Tests for changed behavior pass
- [ ] Checklists updated before merge

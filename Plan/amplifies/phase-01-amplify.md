# Phase 01 Amplify: Monorepo App Setup and Build System

Phase ID: P1
Status: Not Started
Depends on: P0
Blocks: P2, P3, and all implementation phases

## Mission

Create a production-grade Electron app workspace in this monorepo with repeatable dev, build, lint, and test flows.

## Hard Rules

- Keep existing package publish pipeline intact.
- Do not change existing package APIs unless required.
- App workspace must be isolated from publishable packages.

## Inputs

- Plan/plan.md
- Plan/amplifies/phase-00-amplify.md
- Root package scripts and pnpm workspace setup

## Outputs Required

- apps/lacon-desktop directory structure
- apps/lacon-desktop/package.json
- apps/lacon-desktop/tsconfig.json
- apps/lacon-desktop/vite.config.ts
- apps/lacon-desktop/electron-builder config
- Root workspace and turbo integration updates

## Target Folder Structure

- apps/lacon-desktop/src/main
- apps/lacon-desktop/src/preload
- apps/lacon-desktop/src/renderer
- apps/lacon-desktop/src/shared
- apps/lacon-desktop/tests

## Execution Checklist

## Epic P1-E1: Workspace Bootstrap

- [ ] P1-T1 Create app folder structure
  - [ ] P1-T1.1 Create main process entry
  - [ ] P1-T1.2 Create preload entry
  - [ ] P1-T1.3 Create renderer entry
  - [ ] P1-T1.4 Create shared contract folder
  - [ ] P1-T1.5 Create tests folder

- [ ] P1-T2 Create app package manifest
  - [ ] P1-T2.1 Add runtime dependencies
  - [ ] P1-T2.2 Add dev dependencies
  - [ ] P1-T2.3 Add scripts for dev, build, test, lint, package

- [ ] P1-T3 Register workspace package
  - [ ] P1-T3.1 Update pnpm workspace config
  - [ ] P1-T3.2 Verify filtered install works
  - [ ] P1-T3.3 Verify app can resolve local monorepo packages

## Epic P1-E2: Build and Run Pipeline

- [ ] P1-T4 Configure TypeScript for app
  - [ ] P1-T4.1 Main tsconfig
  - [ ] P1-T4.2 Renderer tsconfig
  - [ ] P1-T4.3 Shared types tsconfig

- [ ] P1-T5 Configure renderer bundling
  - [ ] P1-T5.1 Vite setup for renderer
  - [ ] P1-T5.2 Alias support for workspace packages
  - [ ] P1-T5.3 Production build output validation

- [ ] P1-T6 Configure Electron packaging
  - [ ] P1-T6.1 Windows installer target
  - [ ] P1-T6.2 macOS installer target
  - [ ] P1-T6.3 Stable and beta channel setup

## Epic P1-E3: Quality Baseline

- [ ] P1-T7 Lint and typecheck baseline
  - [ ] P1-T7.1 App lint command passes
  - [ ] P1-T7.2 App typecheck passes
  - [ ] P1-T7.3 Pre-commit quality hooks verified

- [ ] P1-T8 Test baseline
  - [ ] P1-T8.1 Unit test runner wired
  - [ ] P1-T8.2 Minimal smoke test for app startup
  - [ ] P1-T8.3 CI-ready command list documented

## Validation

- [ ] V1-1 App launches locally from one command
- [ ] V1-2 Production build artifacts generate successfully
- [ ] V1-3 Packaging command can produce installer artifacts
- [ ] V1-4 Lint, typecheck, and tests all pass

## Definition of Done

- [ ] Phase 1 checklist complete
- [ ] App workspace committed and runnable by new agents
- [ ] Master plan checkboxes updated in Plan/plan.md

## Agent Handoff Template

- Phase: P1
- Task IDs completed:
- Files created or updated:
- Commands run and results:
- Blockers found:
- Next recommended task:

# LACON Desktop

AI-powered content creation workspace built with Electron, React, and TypeScript.

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm --filter lacon-desktop dev

# Run tests
pnpm --filter lacon-desktop test

# Lint
pnpm --filter lacon-desktop lint

# Type check
pnpm --filter lacon-desktop typecheck
```

## Build

```bash
# Build all components
pnpm --filter lacon-desktop build

# Package for current platform
pnpm --filter lacon-desktop package

# Build installers for Windows
pnpm --filter lacon-desktop package:win

# Build installers for macOS
pnpm --filter lacon-desktop package:mac
```

## Project Structure

- `src/main/` - Electron main process
- `src/preload/` - Preload scripts (IPC bridge)
- `src/renderer/` - React frontend
- `src/shared/` - Shared types and contracts
- `tests/` - Test files

## Architecture

This app follows the security-first architecture defined in Phase 0:

- Main process handles secrets, file system, and provider API calls
- Preload provides validated IPC bridge
- Renderer contains UI and editor runtime only
- No API keys or secrets in renderer process

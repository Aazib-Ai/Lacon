<p align="center">
  <h1 align="center">LACON</h1>
  <p align="center">
    <strong>The AI-Powered Writing Studio for Desktop</strong>
  </p>
  <p align="center">
    Write smarter, faster, and better — with an AI co-writer that plans, generates, reviews, and refines your documents.
  </p>
</p>

---

## ✨ What is LACON?

LACON is a desktop writing application that pairs a professional-grade rich text editor with a full AI writing pipeline. Instead of generic AI chat, LACON gives you a structured workflow: **Plan → Generate → Review → Refine** — turning a single instruction into a polished, multi-section document.

Built for researchers, grant writers, content creators, and anyone who writes seriously.

---

## 🚀 Key Features

### 📝 Professional Editor
- Rich text editing with headings, lists, tables, highlights, and text alignment
- Zoom, font sizing, and distraction-free **Zen Mode**
- Smart list toggle — auto-splits paragraphs into individual list items
- Full keyboard shortcuts (Bold, Italic, Underline, Undo/Redo, and more)

### 🤖 AI Writer Loop
- **Plan** — Describe what you want to write, and LACON generates a structured outline
- **Outline Editor** — Add, remove, and reorder sections and subsections before generating
- **Generate** — Watch your document being written section-by-section with live progress
- **Review** — AI audits your document and flags issues with actionable suggestions
- **Surgical Edit** — Accept, reject, or custom-fix individual review flags

### ✏️ Inline Refine
- Select any paragraph and click **Refine** for instant AI improvements
- 8 built-in actions: Rephrase, Add Paragraph, Make Concise, Make Formal, Expand, Simplify, Fix Grammar, Match Style
- Custom refine instructions for anything else
- Accept/Reject diff overlay — see the change before committing

### 🎯 Context-Aware AI Bar
- Always-visible floating input bar at the bottom of the editor
- Auto-detects text selection — seamlessly switches between **Planning Mode** and **Refine Mode**
- Keyboard shortcut: `Ctrl+/` to focus, `Enter` to send, `Esc` to close

### 📊 Presentation Generator
- Turn any document into a slide deck with one click
- Choose theme (Dark, Light, Corporate), slide count, and speaker notes
- Visual slide editor with thumbnail strip, 16:9 preview, and property panel
- Export to **.pptx** (PowerPoint) directly from the app

### 📤 Multi-Format Export
- **PDF** — Print-quality via native dialog
- **DOCX** — Programmatic Word export preserving all formatting
- **HTML** — Standalone with embedded stylesheet
- **Markdown** — Clean conversion with fallback
- **Plain Text** — Simple content extraction

### 🔒 Security-First Architecture
- API keys and secrets **never** leave the main process
- All IPC communication goes through a validated preload bridge
- No remote code execution in the renderer

### 🔌 Flexible AI Providers
- **OpenRouter** integration (access 100+ models from one API key)
- Configurable in-app via Provider Settings
- Extensible provider system — add more backends as needed

### 📚 Skills System
- Built-in writing skill library (Grant Writer, Academic, Blog, etc.)
- Skills inject tailored system prompts into the AI pipeline
- Create custom skills for your specific use case

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron |
| Frontend | React 19, TypeScript, TailwindCSS |
| Editor | TipTap (ProseMirror-based) |
| UI Components | Radix UI, Lucide Icons |
| Export | docx, pptxgenjs |
| AI | OpenRouter API (LLM-agnostic) |
| Build | Vite, electron-builder |

---

## 🏗 Project Structure

```
apps/lacon-desktop/
├── src/
│   ├── main/           # Electron main process (IPC handlers, services, AI agents)
│   │   ├── agent/      # LLM agent implementations (planner, writer, reviewer)
│   │   ├── ipc/        # IPC handler registrations
│   │   ├── services/   # Business logic (slides, skills, research)
│   │   └── providers/  # AI provider management
│   ├── preload/        # Secure IPC bridge (contextBridge)
│   ├── renderer/       # React frontend
│   │   ├── components/ # UI components (editor, toolbar, AI bar, panels)
│   │   ├── hooks/      # Custom hooks (useWriterLoop, useProject)
│   │   ├── extensions/ # Editor extensions (SelectionPersist, etc.)
│   │   ├── styles/     # Modular CSS (base, editor, components, modes)
│   │   └── utils/      # Export engine, content analytics
│   └── shared/         # Shared types and IPC contracts
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+

### Install & Run

```bash
# Install dependencies
pnpm install

# Start development server
pnpm --filter lacon-desktop dev
```

### Build & Package

```bash
# Build for production
pnpm --filter lacon-desktop build

# Package for Windows
pnpm --filter lacon-desktop package:win

# Package for macOS
pnpm --filter lacon-desktop package:mac

# Package for Linux
pnpm --filter lacon-desktop package:linux
```

---

## ⚙️ Configuration

1. Launch the app
2. Open **Provider Settings** (gear icon in sidebar)
3. Add your **OpenRouter API key**
4. Select your preferred model
5. Start writing!

---

## 📄 License

MIT

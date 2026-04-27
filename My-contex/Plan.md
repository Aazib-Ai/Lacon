# LACON Writer's Harness — Implementation Plan

> **Derived from:** `Questions.md` answers + codebase audit  
> **Target platform:** Electron + React + TipTap (`apps/lacon-desktop`)  
> **North star:** *"The best tool for writing and researching — AI is constrained by structure, not the other way around."*

---

## 1. Product Vision (Synthesized from Q1–Q8)

LACON is a **structured, opinionated writing harness** — not a chat wrapper. The AI is *harnessed* (constrained by Skills and the cognitive loop) so writers get disciplined, researched, genre-aware output. It is strongly opinionated about what good writing looks like, proves it through UX (no competitor-bashing), and ships as a **free direct-download app** where users bring their own API keys.

**Unique value stack — all must ship together:**
1. **Skill file system** — auto-researched, genre-aware prompt packs
2. **Planner → Generator → Reviewer cognitive loop** — configurable automation depth
3. **Surgical paragraph-level editing** — diff-first, never regenerate blindly
4. **Persistent, auditable Research Log** — cross-session, with citations
5. **Zero-bias isolated project contexts** — no chat history bleed between projects

---

## 2. Architecture Overview

```
apps/lacon-desktop/
  src/
    main/                              ← Electron main process
      agent/
        orchestrator.ts               ← ✅ EXISTS
        planner.ts                    ← ✅ EXISTS — extend for Planner stage
        [NEW] writer-loop.ts          ← Planner→Generator→Reviewer state machine
        [NEW] reviewer.ts             ← Reviewer agent (flag + suggest rewrites)
        [NEW] skill-engine.ts         ← Skill file loader, composer, injector
      tools/
        retrieval-tools.ts            ← ✅ EXISTS — extend for research
        [NEW] skill-research-tool.ts  ← Agent-driven skill generation
      services/
        document-service.ts           ← ✅ EXISTS — add snapshot versioning
        [NEW] research-log-service.ts ← Persistent research log (JSON on disk)
        [NEW] skill-service.ts        ← Manage skill library on disk
        [NEW] version-service.ts      ← Milestone snapshot store
      providers/                      ← ✅ EXISTS — all major LLMs covered
    renderer/
      components/
        ModernEditor.tsx              ← ✅ EXISTS — extend with ghost text + diffs
        AssistantPanel.tsx            ← ✅ EXISTS — integrate loop controls
        [NEW] WriterLoop/             ← Loop control panel (progress, pass counter)
        [NEW] SkillPicker/            ← Select/stack up to 3 Skills
        [NEW] ResearchLog/            ← Sidebar panel: query→sources→usage
        [NEW] VersionHistory/         ← Creative snapshot timeline
        [NEW] DiffViewer/             ← Side-by-side old vs new paragraph
        [NEW] ZenMode/                ← Distraction-free overlay
        [NEW] UploadSource/           ← PDF/DOCX/TXT/slides upload
    shared/
      ipc-schema.ts                   ← ✅ EXISTS — add new channels
      [NEW] writer-types.ts           ← WriterSession, Skill, ResearchEntry, Snapshot types

  resources/
    [NEW] skills/                     ← 5 built-in .skill.md files bundled with app
```

### Agent Workspace Folder (hidden from writers)
```
[Project Folder]/
  .lacon/
    research.md          ← auto-written research log (human-readable)
    research.json        ← machine-readable research data
    skills/              ← agent-generated + user-created skills
    snapshots/           ← version snapshot JSON files
  my-document.md         ← the only file writers interact with directly
```

---

## 3. Core Data Types — `shared/writer-types.ts`

```typescript
interface Skill {
  id: string
  name: string
  genre: string
  structuralRules: string[]
  evaluationRubric?: string[]      // optional — Reviewer uses these
  examples: string[]
  generatedAt: number
  source: 'built-in' | 'user-created' | 'agent-researched'
}

interface WriterSession {
  id: string
  documentId: string
  activeSkills: Skill[]            // up to 3, priority-ordered
  wordCountTarget: number          // soft — flags if >20% off
  automationLevel: 'full-auto' | 'supervised' | 'manual'
  passCount: number                // current reviewer pass (max 3)
  stage: 'planning' | 'generating' | 'reviewing' | 'complete' | 'paused'
  outline?: Outline
  researchLogId: string
}

interface Outline {
  sections: {
    id: string
    title: string
    subsections: { id: string; title: string; keyPoints: string[] }[]
  }[]
  approvedByUser: boolean
}

interface ResearchEntry {
  id: string
  query: string
  sources: { url: string; title: string; excerpt: string }[]
  savedExcerpts: string[]
  usedInSections: string[]
  timestamp: number
}

interface DocumentSnapshot {
  id: string
  documentId: string
  label: string                    // "After Planner", "Draft 1 done", etc.
  content: unknown                 // TipTap JSON
  wordCount: number
  createdAt: number
}

interface ReviewerFlag {
  paragraphId: string
  type: 'word-count' | 'structure' | 'tone' | 'factual' | 'skill-rubric'
  severity: 'info' | 'warning' | 'error'
  message: string
  suggestedRewrite: string
  accepted: boolean | null         // null = pending
}
```

---

## 4. Phased Execution Plan

---

### Phase 1 — Foundation: Types, Services, Skill Files
**Goal:** Establish the data model and file-system contracts that every other phase depends on.

#### Tasks
- [ ] Create `shared/writer-types.ts` with all types from Section 3
- [ ] Create `main/services/skill-service.ts`
  - Load built-in skills from `resources/skills/`
  - Load user/agent skills from `[project]/.lacon/skills/`
  - `compositeSkillPrompt(skills: Skill[]): string` — priority-weighted merge of up to 3 skills
- [ ] Create `main/services/research-log-service.ts`
  - CRUD for `ResearchEntry` → persisted to `.lacon/research.json` + `.lacon/research.md`
  - Uses `fs` in Electron main process; cross-session persistent
- [ ] Create `main/services/version-service.ts`
  - `createSnapshot(label, content)` → `.lacon/snapshots/[timestamp].json`
  - `listSnapshots(documentId)` → sorted list
  - `restoreSnapshot(id)` → returns TipTap JSON
- [ ] Bundle 5 built-in Skill files in `resources/skills/`:
  - `essay.skill.md` — Argumentative essay: claim/evidence/warrant structure
  - `story.skill.md` — Narrative arc, tension curve, character rules
  - `academic.skill.md` — Thesis/evidence/citation, IMRaD awareness
  - `newsletter.skill.md` — Hook, value, CTA flow
  - `script.skill.md` — Scene/action/dialogue formatting
- [ ] Add IPC channels to `shared/ipc-schema.ts`:
  - `skill:list`, `skill:get`, `skill:create`, `skill:compose`
  - `research:addEntry`, `research:getLog`, `research:linkToSection`
  - `version:createSnapshot`, `version:listSnapshots`, `version:restore`
- [ ] Wire IPC handlers in `main/index.ts`

#### Acceptance Criteria
- Skills load from disk and compose into a coherent system prompt string
- Research log persists to disk and survives app restarts
- Snapshots can be created and restored to TipTap JSON

---

### Phase 2 — Skill Research Agent + SkillPicker UI
**Goal:** Agent auto-researches how to write any genre and generates a ready-to-use `.skill.md` file.

#### Tasks
- [ ] Create `main/tools/skill-research-tool.ts`
  - `researchGenre(genre: string): Promise<Skill>`
  - Calls web search → synthesizes best-practice rules → writes `.skill.md` to `.lacon/skills/`
  - Logs all intermediate research steps to `.lacon/research.md`
  - Uses existing `retrieval-tools.ts` + provider manager
- [ ] Create `main/agent/skill-engine.ts`
  - Orchestrates: detect genre intent → check if skill exists → if not, trigger research → save → return composite prompt
- [ ] Add IPC: `skill:research` (triggers agent, streams progress back to renderer)
- [ ] Build `renderer/components/SkillPicker/` component:
  - Grid view: built-in skills + user/agent-generated skills
  - "Generate Skill" button → progress stream → auto-adds to library on completion
  - Stack selector: pick up to 3 skills with priority order (1st beats 2nd beats 3rd)
  - Skill card: name, genre, rule count, source badge, last updated

#### Acceptance Criteria
- "I want to write a horror story" → agent searches → generates `horror.skill.md` → appears in library
- Stacking 3 skills produces a coherent merged system prompt
- Progress feedback visible during skill generation

---

### Phase 3 — Planner Stage: Outline Generation
**Goal:** Planner produces a hierarchical outline the user edits and approves before generation starts.

#### Tasks
- [ ] Create `main/agent/writer-loop.ts` — master state machine:
  ```
  idle → planning → awaiting-outline-approval → generating →
  reviewing (≤3 passes) → awaiting-user → complete
  ```
- [ ] Extend `main/agent/planner.ts` with `generateOutline(instruction, skills, researchNotes)`:
  - Input: user intent + active skills + any manually uploaded research notes
  - Output: `Outline` (sections → subsections → key points)
  - Note: research is a **manual pre-step** (Q14 — not automated in the Planner)
- [ ] Build `renderer/components/WriterLoop/OutlineEditor` component:
  - Interactive tree: add/remove/reorder sections and key points
  - "Approve Outline" button → triggers Generator
  - Word count target input (stored in session)
- [ ] Auto-snapshot on outline approval → label "Before Generation"

#### Acceptance Criteria
- Planner generates a structured outline from user prompt + selected skills
- User can modify every node of the outline
- Snapshot is auto-created when user approves

---

### Phase 4 — Generator Stage: Section-by-Section Writing
**Goal:** Generator writes each section in sequence with context awareness and ghost-text preview.

#### Tasks
- [ ] Implement `generateSection(sectionId, outline, skills, documentSummary)` in `writer-loop.ts`:
  - Context sent to LLM: skill composite prompt + section outline + neighboring paragraphs + rolling document summary
  - Receives Markdown → convert to TipTap JSON via `@tiptap/markdown`
  - Updates rolling document summary after each section (continuity strategy Q23)
  - Tracks running word count vs. soft target
- [ ] Context window management (Q35A — auto-truncate):
  - Monitor token count before each LLM call
  - If near limit: summarize completed sections, retain outline + current section + last 2 completed
  - Warn user when summary mode is active
- [ ] Ghost text in editor (Q41A):
  - Use TipTap `Decoration` API to show pending AI content in muted/italic style
  - Floating toolbar: "Accept All" / "Reject" buttons
  - `Tab` = accept, `Esc` = reject
- [ ] Progress UI in AssistantPanel:
  - Section progress: "Writing section 2/5..."
  - Token count + estimated cost badge (input tokens | output tokens | ~$0.00X)
  - Cancel button
- [ ] Auto-snapshot after full document generation → label "After Generation"

#### Acceptance Criteria
- Generator writes each section sequentially, maintaining narrative consistency
- Ghost text renders correctly; accept/reject works
- Token count and cost are visible per generation call

---

### Phase 5 — Reviewer Stage + Surgical Paragraph Editing
**Goal:** Reviewer flags issues with suggested rewrites; surgical edits isolate changes to a single paragraph.

#### Tasks
- [ ] Create `main/agent/reviewer.ts`:
  - `reviewDocument(content, session): Promise<ReviewerFlag[]>`
  - Checks: word count delta (>20% of target), structural compliance vs. skill rubric, tone consistency
  - Returns per-paragraph flags with `suggestedRewrite`
  - Maximum 3 automatic passes; at 4th, transitions to `awaiting-user` and stops (Q13B)
  - Planner's outline structure is authoritative in structural conflicts (Q12B)
- [ ] Build `renderer/components/WriterLoop/ReviewPanel` component:
  - Sorted flag list: errors → warnings → info
  - Each card: paragraph preview + issue description + suggested rewrite
  - Accept / Reject per flag → accepted rewrites queue for DiffViewer
- [ ] Build `renderer/components/DiffViewer/` component (Q25B):
  - Left pane: original (read-only)
  - Right pane: suggested rewrite (editable before accepting)
  - Actions: Accept | Edit & Accept | Reject
  - Accepted changes flash `<mark>` highlight in editor for 3 seconds
- [ ] Surgical paragraph editing (Q22B):
  - User selects paragraph → toolbar "Fix with AI" button (or right-click context menu)
  - Sends: full document + user instruction + target paragraph ID
  - Response: full doc → extract target paragraph diff → open in DiffViewer
  - All other paragraphs untouched
- [ ] Full document rewrite fallback (Q26A):
  - "Rewrite All" button → auto-snapshot → triggers full generation pipeline
- [ ] Auto-snapshot before each Reviewer pass

#### Acceptance Criteria
- Reviewer produces structured flags with suggested rewrites for each flagged paragraph
- DiffViewer shows old vs. new side by side; accept/reject works
- Surgical edit isolates exactly one paragraph
- Loop pauses after 3 passes and surfaces a user decision prompt

---

### Phase 6 — Research Log + File Upload + Citations
**Goal:** Full research workflow — web search, file upload, auditable cross-session log, citation style picker.

#### Tasks
- [ ] Extend `main/tools/retrieval-tools.ts` for writing research:
  - Auto mode (default): agent searches during generation → logs all queries + sources automatically
  - Supervised mode (high-importance): agent proposes queries → user approves → executes
  - Mode toggle in session settings
- [ ] File upload (Q30A) — PDF, DOCX, TXT, PPTX:
  - Electron `dialog.showOpenDialog` → read file → extract text:
    - PDF: `pdf-parse`
    - DOCX: `mammoth`
    - PPTX: `pptx-to-text`
  - Extracted text → `ResearchEntry` in research log
  - Shown in panel as "Uploaded: [filename]"
- [ ] Build `renderer/components/ResearchLog/` panel:
  - Timeline view: query → sources found → excerpts → sections used
  - Click source URL → `shell.openExternal` (open in default browser)
  - Knowledge graph mode: SVG visual connecting sources ↔ document sections
  - Persists via `research-log-service` across sessions
- [ ] Citations (Q31D — user picks style):
  - Citation style picker in document settings: APA | MLA | Chicago | IEEE | Footnotes | Inline links
  - When Generator uses a source → auto-inserts citation in chosen style
  - Citation manager: deduplicate references, generate bibliography section
- [ ] Fact-check on demand (Q33B):
  - "Fact-check this section" button in toolbar
  - Agent searches claims → returns confidence level + supporting/contradicting sources
  - Flags low-confidence claims in yellow highlight

#### Acceptance Criteria
- Research log persists across app restarts with full audit trail
- PDF/DOCX/PPTX upload extracts readable text into research context
- Citations auto-inserted in user-selected style; bibliography generated
- Fact-check surfaces sources for each claim in the selected section

---

### Phase 7 — Version History + Project Isolation + UX Polish
**Goal:** Creative version control, strict project isolation, Zen mode, and keyboard-first interactions.

#### Tasks
- [ ] Build `renderer/components/VersionHistory/` component (Q24B):
  - Visual timeline cards: label | date | word count delta
  - Auto-labels: "After Planner", "After Generation", "After Reviewer Pass N"
  - Manual milestone labeling: user can name any snapshot
  - Restore flow: opens DiffViewer (current vs. snapshot) → confirm to restore
- [ ] Project isolation (Q45A — zero bleed between projects):
  - Each project has its own `.lacon/` folder
  - Session state (active skills, research log, loop progress) is fully per-project
  - No shared global state between documents
- [ ] Zen mode (Q42A):
  - Hides: sidebar, assistant panel, status bar, toolbar
  - Shows: editor center + floating word count bottom-right
  - Toggle: `F11` key or toolbar button
  - Smooth CSS `transition: opacity 0.3s ease` on all hidden panels
- [ ] Inline ghost text + block highlights (Q41 A+C combined):
  - Short suggestions: pale ghost text inline → `Tab` accept, `Esc` reject
  - Long AI suggestions: highlighted block with inline Accept/Reject floating buttons
- [ ] Formatting preservation (Q27C):
  - All AI output in Markdown → `@tiptap/markdown` converts to ProseMirror JSON
  - Surrounding user formatting preserved; only target block replaced
- [ ] Automation level per project (Q9D):
  - Session setup toggle: Full Auto | Supervised | Manual
  - Full Auto: research + generation + review all automatic, up to 3 passes
  - Supervised: user approves research queries and each generation chunk
  - Manual: user triggers each stage manually
- [ ] Keyboard shortcuts for all loop actions (documented in tooltips):
  - `Ctrl+Shift+P` — run Planner
  - `Ctrl+Shift+G` — start Generation
  - `Ctrl+Shift+R` — run Reviewer
  - `Ctrl+Z/Y` — undo/redo (TipTap built-in)
  - `F11` — toggle Zen mode
  - `Tab` / `Esc` — accept/reject ghost text

#### Acceptance Criteria
- Version timeline shows all auto + manual snapshots; restore works
- Opening project A does not bleed any context from project B
- Zen mode transition is smooth; only editor + word count remain
- All loop stages are reachable via keyboard

---

### Phase 8 — Settings, Cost Tracking, Distribution
**Goal:** Encrypted API keys, cost visibility, local model support, and packaged builds.

#### Tasks
- [ ] Extend `renderer/components/ProviderSettings.tsx`:
  - API key field per provider → Electron `safeStorage` encryption
  - "Test Connection" button → validates key with a cheap ping request
  - Model selector dropdown per provider (user chooses freely, Q38B — no suggestions)
  - Local model: Ollama / LM Studio base URL field + disclaimer banner (Q37C)
  - One model active per project (Q34B — keep it simple)
- [ ] Cost tracking (Q36A):
  - Token counter: input tokens | output tokens displayed after every LLM call
  - Estimated USD cost from bundled pricing table (e.g., GPT-4o: $5/1M input)
  - Session running total in status bar
  - Pricing table updated manually each release via `resources/pricing.json`
- [ ] Context window guard (Q35A):
  - Pre-flight check before every LLM call
  - Auto-truncation strategy: outline + current section + last 2 sections + summary
  - Visual warning badge when summary mode is active
- [ ] Privacy enforcement (Q46A):
  - No telemetry, no analytics, no external calls except user-chosen LLM provider
  - API keys never logged, never transmitted except to provider's API
  - Audit in build CI: grep for analytics/telemetry packages
- [ ] App packaging (Q48A):
  - `electron-builder` targets: `.exe` (Windows NSIS), `.dmg` (macOS), `.AppImage` (Linux)
  - Code signing setup for Windows (SmartScreen) and macOS (notarization)
  - In-app "Check for Updates" → `shell.openExternal` to download page (no auto-update, Q49C)
- [ ] Onboarding flow (Q50E — free BYOK):
  - First-launch wizard: "Enter your API key from OpenAI / Anthropic / Gemini / OpenRouter"
  - Link to each provider's API key page
  - Skip option (can configure later in Settings)

#### Acceptance Criteria
- API keys stored encrypted; test-connection succeeds for OpenAI, Anthropic, Gemini
- Token count and cost visible per call and as session total
- App builds as `.exe` installer on Windows without errors
- No network calls made except to configured LLM provider

---

## 5. UX Layout Contract

```
┌──────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (220px)    │  EDITOR (flex)          │  AI PANEL (320px)    │
│                     │                          │                      │
│  • Document list    │  TipTap editor           │  Loop stage badge    │
│  • Skill Picker     │  Ghost text (pale)       │  Reviewer flags      │
│  • Research Log     │  Highlighted AI blocks   │  Token / cost badge  │
│  • Version History  │  Inline accept/reject    │  Research controls   │
│                     │  Floating word count     │  Send / Cancel       │
├──────────────────────────────────────────────────────────────────────┤
│  STATUS BAR:  words | tokens | ~cost | provider | loop stage | mode  │
└──────────────────────────────────────────────────────────────────────┘

ZEN MODE:  Editor only + floating word count.  All chrome hidden.
AI PANEL:  Toggleable. Default = visible. (Q40C)
```

---

## 6. Skill File Format

```markdown
---
name: Horror Story
genre: horror
version: 1.0
generated_by: agent
created_at: 2026-04-27
---

## Structural Rules
- Establish dread in Act 1 before the first incident
- Act 2: escalating tension curve with at least one false resolution
- Climax must answer the central fear introduced in Act 1
- Show don't tell: fear through sensory detail, not exposition

## Evaluation Rubric
- [ ] Tension curve present and escalating through Act 2
- [ ] Protagonist has a clear primal fear driving choices
- [ ] Setting actively contributes to atmosphere
- [ ] Ending delivers consequence, not clean escape

## Examples
> "The house had been empty for thirty years. Sarah's hand trembled as she turned the key..."

## Writing Instructions
Maintain a slow burn in Act 1. Accelerate pacing after the midpoint.
Ensure the final image echoes the opening. Avoid jump-scare resolution clichés.
```

---

## 7. Existing vs. Missing Systems

| System | Status | Phase |
|---|---|---|
| Electron shell | ✅ Exists | — |
| TipTap editor (ModernEditor) | ✅ Exists | Extend Ph4, Ph5 |
| LLM provider adapters (OpenAI, Anthropic, Gemini, OpenRouter, Local) | ✅ Exists | — |
| Agent orchestrator + state machine | ✅ Exists | Extend Ph3–5 |
| Tool registry | ✅ Exists | Extend Ph2, Ph6 |
| Document service | ✅ Exists | Extend Ph1 |
| IPC schema | ✅ Exists | Extend Ph1 |
| **Writer Loop (Planner→Generator→Reviewer)** | ❌ Missing | Ph3–5 |
| **Skill system (files, research, compose)** | ❌ Missing | Ph1–2 |
| **Research Log (persistent, cross-session)** | ❌ Missing | Ph1, Ph6 |
| **Surgical paragraph editing + DiffViewer** | ❌ Missing | Ph5 |
| **Version / snapshot history** | ❌ Missing | Ph7 |
| **Zen mode** | ❌ Missing | Ph7 |
| **Citation manager** | ❌ Missing | Ph6 |
| **File upload (PDF/DOCX/PPTX)** | ❌ Missing | Ph6 |
| **Cost / token tracking UI** | ❌ Missing | Ph8 |
| **SkillPicker UI** | ❌ Missing | Ph2 |
| **VersionHistory UI** | ❌ Missing | Ph7 |
| **Onboarding (BYOK wizard)** | ❌ Missing | Ph8 |

---

## 8. Build Order

| Phase | Name | Key Output |
|---|---|---|
| **1** | Foundation | Types, Skill/Research/Version services, IPC, 5 built-in skills |
| **2** | Skill Research Agent | Auto-generate skills from web, SkillPicker UI |
| **3** | Planner Stage | Outline generation, OutlineEditor UI, session setup |
| **4** | Generator Stage | Section-by-section writing, ghost text, cost badge |
| **5** | Reviewer + Surgical Edit | Reviewer flags, DiffViewer, paragraph fix, 3-pass limit |
| **6** | Research + Citations | Web research log, file upload, citation styles, fact-check |
| **7** | Version History + UX | Snapshot timeline, Zen mode, project isolation, keyboard-first |
| **8** | Settings + Distribution | Encrypted keys, cost tracking, packaged builds |

---

## 9. All Design Decisions (Locked)

| Q | Decision |
|---|---|
| Q1 | Well-thought tool for better writing — not a chat UI |
| Q2 | All writer types via Skill system — one app, many genres |
| Q3 | All 5 differentiators combined into one system |
| Q4 | AI is harnessed/constrained by structure |
| Q5 | Blog post / manifesto explaining the vision |
| Q6 | Strongly opinionated — enforce structure, flag bad patterns |
| Q7 | Subtle anti-chatbot — prove it through UX, not words |
| Q8 | Research artifact to validate the paper's thesis |
| Q9 | Configurable per project (Full Auto / Supervised / Manual) |
| Q10 | Hierarchical outline: sections → subsections → key points |
| Q11 | Reviewer flags + suggests rewrites; user decides |
| Q12 | Planner wins all structural conflicts |
| Q13 | Max 3 automatic passes, then pause and ask user |
| Q14 | Research is a manual pre-step (not inside the loop) |
| Q15 | Soft target — flag if >20% off |
| Q16 | Structural rules per genre |
| Q17 | Pick from library + create via form/wizard |
| Q18 | Stack up to 3 Skills with priority ordering |
| Q19 | 5 built-in; agent researches and generates rest |
| Q20 | Optional evaluation rubrics per skill |
| Q21 | User-accessible local directory + agent `.lacon/` folder |
| Q22 | Full doc + instruction → extract target paragraph only |
| Q23 | Rolling summary + neighboring paragraphs for continuity |
| Q24 | Snapshots at milestones with creative labels (not git-style) |
| Q25 | Side-by-side diff (old vs. new) |
| Q26 | Full rewrite allowed as fallback |
| Q27 | AI outputs Markdown → convert to TipTap JSON |
| Q28 | Structured entries + knowledge graph |
| Q29 | Auto by default; supervised for high-importance docs |
| Q30 | PDF, DOCX, TXT, PPTX upload supported |
| Q31 | User picks citation style (APA/MLA/Chicago/IEEE/Footnotes/Links) |
| Q32 | Research log persists cross-session |
| Q33 | Fact-check on user demand only |
| Q34 | One model per project |
| Q35 | Auto-truncate/summarize when near context limit |
| Q36 | Show token count and estimated cost per action |
| Q37 | Local models experimental (with disclaimer) |
| Q38 | User chooses model — no app suggestions |
| Q39 | Writer's desk: sidebar | editor | AI panel |
| Q40 | AI panel toggleable, default visible |
| Q41 | Ghost text (inline) + highlighted blocks (accept/reject) |
| Q42 | Zen mode: editor + word count only |
| Q43 | Equal keyboard + mouse support |
| Q44 | No command palette — toolbar and menus sufficient |
| Q45 | Each project fully isolated — zero context bleed |
| Q46 | 100% local — no telemetry, no analytics |
| Q47 | Encrypted API key storage + test-connection button |
| Q48 | Direct download only (no app store) |
| Q49 | Manual updates — "Check for update" opens download page |
| Q50 | Free app — users bring their own API keys |

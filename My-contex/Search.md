# Free Research Engine — Definitive Implementation Plan

---

## Part 1: Three New Backend Services

### 1A. WebSearchService
**File:** `src/main/services/web-search-service.ts` (new, singleton)

```typescript
class WebSearchService {
  private lastDDGRequest = 0         // rate limiter
  private ddgCooldownUntil = 0       // 429 cooldown

  async searchDuckDuckGo(query: string, max = 8): Promise<WebSearchResult[]>
  async searchWikipedia(query: string, max = 3): Promise<WebSearchResult[]>
  async searchAll(query: string, opts?: WebSearchOptions): Promise<WebSearchResult[]>
}
```

**DDG flow:** fetch `https://html.duckduckgo.com/html/?q=...` → parse with cheerio (`.result` → title/snippet/url) → enforce 2s gap → handle 429 with 30s cooldown → return `[]` on error, never throw.

**Wikipedia flow:** fetch `en.wikipedia.org/w/api.php?action=query&list=search&srsearch=...&format=json` → strip HTML from snippets → build `https://en.wikipedia.org/wiki/<title>` URLs.

**`searchAll`:** runs both via `Promise.allSettled` (if DDG fails, Wiki still returns). Deduplicates by URL. Assigns scores: DDG results 0.9→0.5 by position, Wikipedia 0.7 flat.

### 1B. ContentExtractorService
**File:** `src/main/services/content-extractor.ts` (new, singleton)

```typescript
class ContentExtractorService {
  async extractArticle(url: string): Promise<ExtractedArticle | null>
  async extractMultiple(urls: string[], maxConcurrent = 3): Promise<ExtractedArticle[]>
}
```

**`extractArticle`:** fetch with 10s `AbortController` timeout → check `Content-Type` includes `text/html` → `new JSDOM(html)` → `isProbablyReaderable(doc)` check → `new Readability(doc).parse()` → truncate `textContent` to 3000 chars → return `null` on any failure.

### 1C. ResearchSearchService — The Orchestrator
**File:** `src/main/services/research-search-service.ts` (new, singleton)

```typescript
class ResearchSearchService {
  async quickSearch(query: string): Promise<WebSearchResult[]>
  async deepResearch(query: string, documentId: string): Promise<ResearchLogEntry>
  evaluateResearchCoverage(documentId: string, topics: string[]): ResearchCoverage[]
  private isDuplicateQuery(documentId: string, query: string): boolean
}
```

---

## Part 2: How the Agent Uses Search — Step by Step

### Flow A: User clicks "Write about X" → Agent auto-researches

```
User types instruction → clicks Start
    │
    ▼
WriterLoopPanel calls writerLoop.startPlanning(instruction)
    │
    ▼
writer-loop.ts: startPlanning() {
    │
    ├── 1. Check session.automationLevel
    │     • 'auto' → always auto-research
    │     • 'supervised' → auto-research, show status in UI
    │     • 'manual' → skip, user does it themselves
    │
    ├── 2. Check existing research
    │     const log = getResearchLogService().getLog(documentId)
    │     if (log.entries.length > 0) {
    │       // Already has research — evaluate coverage
    │       const coverage = researchSearch.evaluateResearchCoverage(
    │         documentId, [instruction]
    │       )
    │       if (coverage[0].score > 0.3) → skip search (already covered)
    │       else → search for gaps only
    │     }
    │
    ├── 3. Run search (if needed)
    │     this.emit('research-started', { query: instruction })
    │     const entry = await researchSearch.deepResearch(instruction, documentId)
    │     this.emit('research-complete', { entryId: entry.id })
    │
    ├── 4. Build ResearchContext from updated log
    │     const updatedLog = getResearchLogService().getLog(documentId)
    │     researchContext = { entries: updatedLog.entries, summary: updatedLog.summary }
    │
    └── 5. Generate outline with research
          const outline = await generateOutline(instruction, skillPrompt, researchContext)
```

### Flow B: Section generation uses research

```
generateSection(sectionId) {
    │
    ├── 1. Build neighborContext (existing, unchanged)
    │
    ├── 2. NEW: Gather research for THIS section
    │     const log = getResearchLogService().getLog(this.documentId)
    │     
    │     // Priority 1: Entries explicitly linked to this section
    │     const linked = log.entries.filter(e => e.linkedSectionIds.includes(sectionId))
    │     
    │     // Priority 2: Entries matching section topic (fuzzy term match)
    │     const titleTerms = section.title.toLowerCase().split(/\s+/).filter(t => t.length > 3)
    │     const relevant = log.entries.filter(e => {
    │       if (linked.includes(e)) return false
    │       const text = (e.query + ' ' + e.excerpts.join(' ')).toLowerCase()
    │       const matchCount = titleTerms.filter(t => text.includes(t)).length
    │       return matchCount / titleTerms.length > 0.3
    │     })
    │     
    │     // Priority 3: General unlinked research (fallback)
    │     const general = log.entries.filter(e => 
    │       e.linkedSectionIds.length === 0 && !linked.includes(e) && !relevant.includes(e)
    │     )
    │     
    │     // Combine (cap at 5, max 2000 chars)
    │     const all = [...linked, ...relevant.slice(0,3), ...general.slice(0,2)].slice(0,5)
    │
    ├── 3. Format research for prompt
    │     researchText = all.map(e => `[${e.query}]: ${e.excerpts[0]?.slice(0,400)}`).join('\n')
    │
    └── 4. Pass to buildSectionSystemPrompt()
```

**The LLM prompt for section generation with research:**
```
You are an expert writer producing a section of a longer document.
Document title: "${outline.title}"
Current section: "${section.title}"

${researchText ? `
RESEARCH MATERIAL:
${researchText}

Use this research to ground your writing. Reference facts and data.
If the research doesn't cover something, use general knowledge.
Do NOT invent statistics or citations.` : ''}

Key points to cover:
1. ${section.keyPoints[0]}
...
```

---

## Part 3: Research Categorization & Tagging

Every research entry gets auto-tagged when created:

```typescript
function categorizeEntry(entry: ResearchLogEntry): string[] {
  const tags: string[] = []
  
  // Source-based tags
  const hasWeb = entry.sources.some(s => s.type === 'web')
  const hasFile = entry.sources.some(s => s.type === 'file')
  if (hasWeb) tags.push('web')
  if (hasFile) tags.push('import')
  if (!hasWeb && !hasFile) tags.push('manual')
  
  // Content-based tags (from Wikipedia source detection)
  if (entry.sources.some(s => s.url?.includes('wikipedia'))) tags.push('encyclopedia')
  
  // File type tags
  for (const src of entry.sources) {
    if (src.filePath?.endsWith('.pdf')) tags.push('pdf')
    if (src.filePath?.endsWith('.docx')) tags.push('docx')
  }
  
  // Processing tags
  if (entry.excerpts.some(e => e.length > 500)) tags.push('summarized')
  
  return tags
}
```

These tags display as colored badges in the UI (web=blue, import=green, pdf=red, etc).

---

## Part 4: Multi-File Relevance Scoring

### The Algorithm: `evaluateResearchCoverage()`

```typescript
evaluateResearchCoverage(documentId: string, sectionTopics: string[]): ResearchCoverage[] {
  // 1. Get research from current document
  const currentLog = getResearchLogService().getLog(documentId)
  
  // 2. Get research from ALL sibling documents in the project
  const projectPath = getActiveProjectPath()!
  const allProjectResearch = getResearchLogService().getProjectResearch(projectPath)
  
  // 3. For each section topic, score relevance
  return sectionTopics.map(topic => {
    const topicTerms = topic.toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 3 && !STOP_WORDS.has(t))
    
    let bestScore = 0
    let bestEntryId: string | null = null
    let bestSource: 'current' | 'sibling' = 'current'
    
    // Check current document's research
    for (const entry of currentLog.entries) {
      const entryText = (entry.query + ' ' + entry.excerpts.join(' ')).toLowerCase()
      const matchCount = topicTerms.filter(t => entryText.includes(t)).length
      const score = topicTerms.length > 0 ? matchCount / topicTerms.length : 0
      if (score > bestScore) {
        bestScore = score
        bestEntryId = entry.id
        bestSource = 'current'
      }
    }
    
    // Check sibling documents' research
    for (const doc of allProjectResearch) {
      if (doc.documentId === documentId) continue // skip self
      for (const entry of doc.entries) {
        const entryText = (entry.query + ' ' + entry.excerpts.join(' ')).toLowerCase()
        const matchCount = topicTerms.filter(t => entryText.includes(t)).length
        const score = topicTerms.length > 0 ? matchCount / topicTerms.length : 0
        if (score > bestScore) {
          bestScore = score
          bestEntryId = entry.id
          bestSource = 'sibling'
        }
      }
    }
    
    return {
      topic,
      score: bestScore,
      coverage: bestScore > 0.3 ? 'covered' : bestScore > 0.1 ? 'partial' : 'uncovered',
      bestEntryId,
      bestSource,
    }
  })
}
```

**`getProjectResearch()`** in research-log-service.ts:
```typescript
getProjectResearch(projectPath: string): { documentId: string; entries: ResearchLogEntry[] }[] {
  const docsDir = join(projectPath, '.lacon', 'documents')
  if (!existsSync(docsDir)) return []
  return readdirSync(docsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(folder => {
      const rPath = join(docsDir, folder.name, 'research.json')
      if (!existsSync(rPath)) return null
      try {
        const log = JSON.parse(readFileSync(rPath, 'utf-8'))
        return { documentId: folder.name, entries: log.entries || [] }
      } catch { return null }
    })
    .filter(Boolean) as any[]
}
```

---

## Part 5: PDF & File Import with LLM Summarization

### End-to-end flow when user imports a PDF

```
User clicks 📂 Import → file picker opens → selects paper.pdf
    │
    ▼
ResearchWorkbench.handleImport() → research.importFile(documentId, path, 'pdf')
    │
    ▼
research-handlers.ts → researchService.importFile(documentId, path, 'pdf')
    │
    ├── 1. Read file, try extractBasicText()
    │     PDF: regex-based extraction (limited)
    │     DOCX: <w:t> tag extraction
    │     TXT: direct readFileSync
    │
    ├── 2. Create entry with raw excerpts
    │
    ├── 3. NEW: LLM summarization pass (if excerpts have real content)
    │     const hasContent = excerpts.some(e => !e.startsWith('[Imported') && e.length > 50)
    │     if (hasContent && providerAvailable) {
    │       const fullText = excerpts.join('\n').slice(0, 4000)
    │       // Uses whatever LLM the user configured
    │       const summary = await pm.chatCompletion(provider.id, {
    │         model: provider.defaultModel,
    │         messages: [
    │           { role: 'system', content: IMPORT_SUMMARIZE_PROMPT },
    │           { role: 'user', content: fullText }
    │         ],
    │         temperature: 0.3,
    │         maxTokens: 500
    │       }, 'file-import-summary')
    │       // Prepend summary as first excerpt
    │       entry.excerpts = [summary, ...entry.excerpts.slice(0, 5)]
    │       entry.tags.push('summarized')
    │     }
    │
    └── 4. Entry is now searchable via the same term-matching 
          used in Part 2 and Part 4
```

**The summarization prompt (model-agnostic — no function calling, no JSON mode):**
```
IMPORT_SUMMARIZE_PROMPT = `Extract 3-5 key research findings from this document.
Be specific — include data, names, dates, and statistics.
Format as a bulleted list. Keep each point under 50 words.`
```

This prompt works on GPT-4o-mini, Claude Haiku, Gemini Flash, Llama, Mistral — no model-specific features used.

### User has existing URLs/links

If the user pastes a URL in the search box (detected by regex `^https?://`), we skip web search and go directly to extraction:

```typescript
if (/^https?:\/\//.test(query.trim())) {
  // Direct URL import — extract and summarize
  const article = await contentExtractor.extractArticle(query.trim())
  if (article) {
    return researchLogService.addEntry(documentId, article.title, 
      [{ url: query.trim(), title: article.title, type: 'web' }],
      [article.textContent.slice(0, 2000)], [], ['url-import']
    )
  }
}
```

---

## Part 6: LLM-Agnostic Design

All research LLM calls go through `getProviderManager().chatCompletion(providerId, request, feature)`. This is the same abstraction used by outline generation and section writing. It supports:

| Provider | Adapter | Verified |
|---|---|---|
| OpenAI | `openai-adapter.ts` | ✅ |
| Anthropic | `anthropic-adapter.ts` | ✅ |
| Google Gemini | `gemini-adapter.ts` | ✅ |
| OpenRouter (100+ models) | `openrouter-adapter.ts` | ✅ |
| Local (Ollama, LM Studio) | `local-adapter.ts` | ✅ |
| Custom OpenAI-compatible | `custom-adapter.ts` | ✅ |
| ZAI | `zai-adapter.ts` | ✅ |

**Prompt constraints for model compatibility:**
- No JSON mode (`response_format`) — some models don't support it
- No function calling — research prompts use plain text
- `temperature: 0.3`, `maxTokens: 500` for summaries (safe for all models)
- `temperature: 0.5`, `maxTokens: 1500` for research briefs
- System+user message only — no multi-turn, no assistant prefill
- Built-in retry (3 attempts) + circuit breaker (opens after 5 failures)
- Fallback: if LLM call fails, entry is still created with raw snippets only

---

## Part 7: IPC Wiring

### ipc-schema.ts — add after line 212:
```typescript
RESEARCH_WEB_SEARCH: 'research:webSearch',
```

### research-handlers.ts — add after line 145:
```typescript
ipcMain.handle(IPC_CHANNELS.RESEARCH_WEB_SEARCH,
  async (_event, payload: { documentId: string; query: string; mode: 'quick' | 'deep' }) => {
    return handleResearchIpc(IPC_CHANNELS.RESEARCH_WEB_SEARCH, payload, async () => {
      if (payload.mode === 'quick') {
        return { success: true, data: { results: await getResearchSearchService().quickSearch(payload.query) } }
      }
      const entry = await getResearchSearchService().deepResearch(payload.query, payload.documentId)
      return { success: true, data: entry }
    })
  })
```

### preload/index.ts — add to researchAPI (after line 292):
```typescript
webSearch: (documentId: string, query: string, mode: 'quick' | 'deep') =>
  ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_WEB_SEARCH, { documentId, query, mode }),
```

### shared/types.ts — add to ResearchAPI (after line 206):
```typescript
webSearch: (documentId: string, query: string, mode: 'quick' | 'deep') => Promise<any>
```

---

## Part 8: UI/UX Changes

### useResearch.ts — New State

```typescript
// New state fields:
searchResults: WebSearchResult[]
searching: boolean
deepResearching: boolean

// New actions:
| { type: 'START_SEARCHING' }
| { type: 'SET_SEARCH_RESULTS'; results: WebSearchResult[] }
| { type: 'CLEAR_SEARCH_RESULTS' }
| { type: 'START_DEEP_RESEARCH' }
| { type: 'STOP_DEEP_RESEARCH' }

// New methods:
webSearch(query: string)     // calls IPC 'quick', sets searchResults
deepResearch(query: string)  // calls IPC 'deep', creates entry, clears results
clearSearch()                // clears searchResults
```

### ResearchWorkbench.tsx — Component Hierarchy

```
ResearchWorkbench
├── Header (title + entry count + [+Add] + [📂Import])
├── ModeBar (Auto|Supervised|Manual + Citation style + Fact-check)
├── SearchPanel (NEW — conditionally shown when showAddForm=true)
│   ├── SearchInput (text input + [🔍 Search] + [✏️ Note])
│   ├── SearchResults (shown after quickSearch returns)
│   │   ├── SearchResultCard × N
│   │   │   └── icon + title + snippet + [+ Add to Research]
│   │   └── DeepResearchButton [🔬 Extract & Summarize All]
│   └── URLDetectNotice ("Paste a URL to import directly")
├── FactCheckPanel (existing, unchanged)
├── ResearchTimeline
│   └── EntryCard × N (ENHANCED)
│       ├── Header: icon + query + date + source count + tags + mode badge
│       ├── Expanded:
│       │   ├── SourcesList (clickable URLs with 🌐/📚/📄 icons)
│       │   ├── ExcerptsList (blockquotes, LLM summary first if tagged 'summarized')
│       │   ├── CrossFileBadge ("📎 Also in: chapter-1") — if from sibling doc
│       │   ├── SectionLinker — dropdown to link entry to outline sections
│       │   ├── CitationBlock (formatted citation)
│       │   └── Actions: [🗑 Delete] [🔗 Link to Section]
│       └── CoverageIndicator (green/yellow/red dot showing relevance to current section)
└── LoadingOverlay (spinner + message)
```

### SearchResultCard (new sub-component)

```tsx
const SearchResultCard: React.FC<{
  result: WebSearchResult
  onAdd: () => void
}> = ({ result, onAdd }) => (
  <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border bg-card 
       hover:border-primary/30 transition-colors">
    <span className="text-base mt-0.5">
      {result.source === 'wikipedia' ? '📚' : '🌐'}
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground truncate m-0">{result.title}</p>
      <p className="text-xs text-muted-foreground line-clamp-2 m-0 mt-0.5">{result.snippet}</p>
      <span className="text-[0.6rem] text-muted-foreground/60">{result.url}</span>
    </div>
    <button
      onClick={onAdd}
      className="px-2 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary 
                 hover:bg-primary/20 transition-colors flex-shrink-0"
    >
      + Add
    </button>
  </div>
)
```

### SearchInput behavior

```typescript
const handleSearchSubmit = async () => {
  const q = searchQuery.trim()
  if (!q) return
  
  // Detect URL paste → direct import
  if (/^https?:\/\//.test(q)) {
    await deepResearch(q)  // extracts article directly
    return
  }
  
  // Normal search
  await webSearch(q)
}
```

### Loading states

| State | Visual |
|---|---|
| `searching` | Small spinner icon replaces 🔍 in search button |
| `deepResearching` | Full overlay: "🔬 Researching... Searching web → Extracting articles → Summarizing with AI" with progress steps |
| `loading` (existing) | Semi-transparent overlay with spinner |

---

## Part 9: Edge Case Matrix

| # | Case | Detection | Handling |
|---|---|---|---|
| 1 | No internet | `fetch` throws `TypeError: fetch failed` | Return `[]` from DDG/Wiki. UI: "No results — check connection" |
| 2 | DDG rate limited | HTTP 429 or 403 | Set 30s cooldown. Fall back to Wikipedia-only |
| 3 | Non-readable page | `isProbablyReaderable()` returns false | Skip extraction, keep snippet. Tag: `'snippet-only'` |
| 4 | Very long article | `textContent` > 3000 chars | Truncate to 3000 in `extractArticle()` |
| 5 | No LLM configured | `providers.find(p => p.enabled)` returns undefined | Skip summarization. Store raw snippets. Entry still works |
| 6 | LLM call fails | `chatCompletion` throws | Catch, log warning, keep raw excerpts. Emit non-fatal error |
| 7 | Duplicate query | User searches same thing twice | `isDuplicateQuery()`: check 80% term overlap with existing entries. Return existing entry |
| 8 | Concurrent requests | Two `deepResearch` calls at once | Mutex lock — queue the second request |
| 9 | User switches file mid-research | `documentId` changes during async | Research is bound to `documentId` at call time. Safe — writes to correct file |
| 10 | Empty/whitespace query | User hits Enter on blank | Validate in `handleSearchSubmit`: `if (!q) return` |
| 11 | Research log > 50 entries | `getLog()` returns large array | Trim display to 50 in UI (newest first). Don't delete data |
| 12 | PDF with no text | `extractBasicText` returns null | Placeholder excerpt + file reference. Tags: `['pdf', 'unreadable']` |
| 13 | Pasted URL is not HTML | Content-Type is not text/html | `extractArticle` checks Content-Type, returns `null`. Entry created with URL as source, no excerpt |
| 14 | Stale research (>30 days old) | `Date.now() - Date.parse(entry.createdAt) > 30d` | Show ⚠️ badge in EntryCard. Don't auto-delete |
| 15 | Cross-file research conflict | Same topic researched differently in chapter-1 vs chapter-2 | Show both with source badges. User decides via section linking |

---

## Implementation Order

| # | Files | What |
|---|---|---|
| 1 | `package.json` | Add cheerio, @mozilla/readability, move jsdom to deps |
| 2 | `writer-types.ts` | Add `WebSearchResult`, `ExtractedArticle`, `WebSearchOptions`, `ResearchCoverage` types |
| 3 | `web-search-service.ts` | DDG + Wikipedia search |
| 4 | `content-extractor.ts` | URL → clean article text |
| 5 | `research-search-service.ts` | Orchestrator with `evaluateResearchCoverage` |
| 6 | `research-log-service.ts` | Add `getProjectResearch()`, upgrade `importFile()` with LLM summarization |
| 7 | `tool-registry.ts` | Replace mock `executeWebSearch()` + upgrade `executeSummary()` |
| 8 | `ipc-schema.ts` + `types.ts` + `research-handlers.ts` + `preload/index.ts` | New `research:webSearch` channel |
| 9 | `writer-loop.ts` | Auto-research in `startPlanning()` + inject research in `generateSection()` |
| 10 | `useResearch.ts` | New state + webSearch/deepResearch/clearSearch methods |
| 11 | `ResearchWorkbench.tsx` | SearchPanel + SearchResultCard + enhanced EntryCard + section linking |

## Verification

1. `pnpm --filter lacon-desktop build` — zero type errors
2. Search "TypeScript" → see real DDG + Wikipedia results in SearchPanel
3. Click "Deep Research" → full pipeline runs → entry with LLM summary appears
4. Import a .txt file → LLM summarizes → excerpts have summary as first item
5. Paste a URL → auto-detects → extracts article directly
6. Write with research → section prompt contains research excerpts
7. Open chapter-2 → see "📎 From: chapter-1" entries from cross-file scan
8. Kill internet → graceful "no results" instead of crash
9. Test with OpenRouter / local Ollama → same behavior, model-agnostic

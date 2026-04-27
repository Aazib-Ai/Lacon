# LACON — Writer's Harness: 50 Clarification Questions

> **Instructions:** Pick **one answer** per question (or write your own in "Other").
> Your answers will directly shape the next implementation plan.

---

## Section 1: Core Vision & Product Identity (Q1–Q8)

### Q1. What is LACON's primary identity?
- A) A desktop writing app that happens to use AI
- B) An AI agent system that happens to have an editor
- C) Equal parts editor and agent — neither is secondary
- D) A research tool for studying how humans write with AI
- E) Other:iTS a well tought tool that assest to write better. like i am a programer and i am uising Antigravity its best for write with auto complete agent that can do research write code edit code run code same i want it to be best for writing researching etc.

### Q2. Who is the primary target user for v1?
- A) Long-form content creators (bloggers, essayists, newsletter writers)
- B) Academic researchers and students writing papers/theses
- C) Professional screenwriters and scriptwriters
- D) Technical writers (documentation, reports)
- E) YouTube/video content creators writing scripts
- F) All of the above equally
- G) Other: I want to target all the best way to do this in my mind right now iS TO BUILD A skill system like antigravity have we build a prompt instruction So the LLm can write best skills afer resarching and send as contex when user try to genrate something. Lets say a user want to write a story first we send agent to search how the best story written and create a story skill in which expaln how to write a story and what are the rules of writing story and some best examples of story so that LLM can generate a story that is best. This is how we will make it best for writing researching etc.

### Q3. What is the single most important differentiator from ChatGPT / Google Docs AI?
- A) Zero chat-history bias — clean-room writing sessions every time
- B) The Skill file system (genre-aware procedural writing guides)
- C) Surgical paragraph-level editing without regenerating the whole doc
- D) Persistent research log with auditable citations
- E) The Planner → Generator → Reviewer cognitive loop
- F) i WANT All of the above as a combined system


### Q4. Does "Harness" in the title mean the user harnesses the AI, or the AI is harnessed (constrained)?

- B) The AI is harnessed/constrained with structure (safety framing)

### Q5. Is the paper / manifesto you shared intended to be:

- B) A blog post / landing page manifesto to explain the vision


### Q6. How opinionated should LACON be about "what good writing is"?
- A) Strongly opinionated — enforce structure, flag bad patterns, reject low-effort output

### Q7. Should LACON explicitly brand itself as anti-chatbot?
-
- B) Subtle — don't bash competitors but make the difference obvious through UX
 
### Q8. Is LACON also a research prototype (for the paper), or a real product you want users to ship writing with?
- A) Primarily a research artifact to validate the paper's thesis
-
---

## Section 2: The Cognitive Writing Loop (Q9–Q15)

### Q9. In the Planner → Generator → Reviewer loop, how much user involvement should there be?

- D) Configurable per project (full auto for quick tasks, full control for important work)


### Q10. What should the Planner output look like?

- B) A hierarchical outline (sections → subsections → key points)


### Q11. Should the Reviewer be able to rewrite sections it flags, or only flag them?

- B) Flag with suggested rewrites the user can accept/reject


### Q12. How should the cognitive loop handle disagreement between Planner and Reviewer?

- B) Planner wins — the structure was approved by the user
-

### Q13. Should the cognitive loop support iterative refinement (multiple passes)?

- B) Up to 3 automatic passes, then stop and ask the user
-
### Q14. Should the Planner have access to research tools, or only the Generator?

- D) Neither — research is a separate manual step before the loop


### Q15. How should the word-count targeting actually work?

- B) Soft target — Generator aims for it, Reviewer flags if off by >20%

---

## Section 3: Skill Files — Genre-Aware Writing (Q16–Q21)

### Q16. What should a Skill file contain?

- B) Structural rules (e.g., "a horror story needs a tension curve in act 2")
-
### Q17. How should users interact with Skill files?
-
- B) Select from a library + create custom skills via a form/wizard
-

### Q18. Should multiple Skills be composable (e.g., "Academic Paper" + "Persuasive Tone")?

- B) Yes — stack up to 3 Skills with priority ordering
-

### Q19. How many built-in Skills should ship with v1?
- A) 3–5 core ones (The most important how to write skills do the agent automatically reasearch and write the user wanted )And i want a system like most coding harness have a project file with mutiple file . the agent research create file in that folder let's say i am resarch.md file then eassy skill.md file and write only in main file. Writes are not much technical so we want confuse them just crerate a agent folder and write all the thing in that folder in the main folder only show the files where they working.


### Q20. Should Skills include evaluation criteria (how does the Reviewer know if the output matches the genre)?

- C) Optional — Skills can include rubrics, but don't have to
-
### Q21. Where should Skill files live?

- B) In a user-accessible local directory (editable) also explains in Q19 waht i have in mind
-

---

## Section 4: Editing Model — Surgical vs. Regenerative (Q22–Q27)

### Q22. When a user says "fix paragraph 3," what should happen under the hood?

- B) Send the full document + instruction, extract paragraph 3 from the response
-

### Q23. How should the system maintain continuity when editing a single section?
- A) Maintain a document-level summary that updates after each edit
     and
- C) Simply include the neighboring paragraphs as context


### Q24. Should edits be tracked as a version history?

- B) Yes — but simplified (snapshots at key milestones, not every keystroke) because writers are not technical we need to provide git style version control in a creative way
-
### Q25. When the AI edits a paragraph, should the user see:
- 
- B) A side-by-side diff (old vs. new) to approve

### Q26. Should LACON support "rewrite the whole document" as a fallback?
- A) Yes — sometimes a full rewrite is what's needed

### Q27. How should formatting / style be preserved during AI edits?

- C) AI receives markdown; system converts back to TipTap
- 

---

## Section 5: Research & Citations (Q28–Q33)

### Q28. What should the Research Log look like?

- B) Structured entries: query → sources found → excerpts saved → how each was used
       And
- C) A knowledge graph connecting sources to document sections


### Q29. How should web research work?

- B) Agent searches automatically during generation → logs everything
- C) Agent proposes searches → user approves → agent executes
- D) B by default, C for high-importance documents, D is best option


### Q30. Should LACON support uploading PDFs / files as research sources?
- A) Yes — upload PDFs, DOCX, TXT and most importantly slids as reference material
- 
### Q31. How should citations be inserted into the document?
- A) Footnotes (academic style)
- B) Inline hyperlinks (web style)
- C) Endnotes with a references section
- D) User picks the citation style from a template (APA, MLA, Chicago, etc.) D is best
-
### Q32. Should the Research Log persist across sessions?
- A) Yes — come back next week and all research is there
-
### Q33. Should LACON verify/fact-check claims in the generated text?
-
- B) Yes — but only when the user triggers "fact-check this section"

---

## Section 6: Provider & Model Strategy (Q34–Q38)

### Q34. Should LACON allow different models for different stages of the loop?

- B) No — one model per project, keep it simple
-
### Q35. How should LACON handle model context window limits?
- A) Automatically truncate/summarize when context exceeds the window

### Q36. Should LACON track and display cost per operation?
- A) Yes — show token count and estimated cost for every AI action


### Q37. Should local models (Ollama, LM Studio) be first-class citizens or a fallback?
s

- C) Experimental — supported but with disclaimers about output quality

### Q38. Should the app suggest which model to use for a given task?
-
- B) No — users know their models, let them choose

---

## Section 7: UX & Interface Philosophy (Q39–Q44)

### Q39. What's the right metaphor for the workspace?
- A) Writer's desk — sidebar for documents, center for writing, right panel for AI


### Q40. Should the AI assistant panel always be visible?
-
- C) Toggleable, but default to visible
-

### Q41. How should AI suggestions appear in the editor?
- A) Inline ghost text (like GitHub Copilot)
            and
- C) As highlighted blocks in the editor with accept/reject buttons


### Q42. Should LACON support a focus/zen mode for undistracted writing?
- A) Yes — hide everything except the editor and a word count
- 

### Q43. How important is keyboard-first interaction vs. mouse/GUI?

- C) Equal — keyboard for power users, mouse for everyone else

### Q44. Should LACON have a command palette (like VS Code's Ctrl+Shift+P)?

- C) No — a good toolbar and menus are enough
-

---

## Section 8: Data, Privacy & Distribution (Q45–Q50)

### Q45. How should LACON handle the "no chat history bias" principle in practice?
- A) Each project is a fully isolated context — zero bleed between projects


### Q46. Should LACON ever send data to our servers?
- A) Never — 100% local, no telemetry, no analytics
-
### Q47. How should LACON handle API key security UX?

- B) Settings page with encrypted storage, test-connection button
- 

### Q48. What's the v1 distribution strategy?
- A) Direct download from website only (no store)
-

### Q49. Should LACON have an auto-update mechanism?

- C) Manual updates only (download new version from website)
_

### Q50. What's the pricing model you're envisioning?
- 
- E) Free app — users bring their own API keys (we never charge)
- 

---

## 🎯 How to Respond

Just reply with the question number and your answer letter. For example:

```
Q1: C
Q2: E
Q3: F
Q4: C
...
```

Add any notes or "Other" explanations inline. Once I have your answers, I'll synthesize them into a razor-sharp implementation plan that matches your exact vision.

# Offboarding → Onboarding Agent (LangGraph) — General Plan (Updated)

## 0) Goal & framing (what we’re building)

**Goal:** prevent “at-risk knowledge” loss when an employee leaves, especially in finance/consulting workflows where critical knowledge lives in **Excel models, decks, notebooks, and tacit heuristics**, not in clean docs. 
**Key product promise:** turn messy project files + a short offboarding interview into a **durable knowledge bundle** that later powers (1) an onboarding narrative and (2) a Q&A agent.

**Important reality:** offboarding and onboarding are temporally decoupled (days/weeks apart), so we build **two separate graphs** with a shared persistent store.

---

## 1) System shape (two graphs + one shared knowledge store)

### A) Offboarding Graph (runs when someone leaves)

**Inputs**

* k raw files (given, no selection)
* minimal metadata (project name, role, timeline)

**Outputs (persisted)**

* structured representations of each file
* iterative deep dive reports
* a managed question backlog (unified, deduped, prioritized, status-tracked)
* interview transcript + extracted facts
* final onboarding package (LLM remix of deep dives + interview facts)
* QA agent system prompt (deep dives + interview summary as plain text)

### B) Onboarding Graph (runs later when new hire arrives)

**Inputs (from store)**

* onboarding package docs
* QA system prompt text (deep dives + interview summary)
* structured files JSON + interview summary (for on-demand knowledge graph generation)

**Outputs**

* onboarding narrative (abstract → intro → details)
* knowledge graph visualization (generated on-demand via tool call, not pre-built)
* Q&A agent powered by system-prompt context (no vector DB for MVP)

### Shared Knowledge Store (what both graphs read/write)

For MVP, use **local files only** (no database, no vector store):

* **JSON files**: parsed files, deep dive reports, question backlog
* **Text files**: deep dive corpus, interview summary, QA system prompt
* **Markdown files**: onboarding package document

Key ID scheme (MVP):

* `org_id / project_id / offboarding_session_id / artifact_version`

---

## 2) Updated pipeline logic (aligned with your mermaid + new updates)

### Step 1 — Parsing → “Structured JSON”

**Purpose:** normalize filetypes into a consistent internal format so downstream reasoning is stable.

**Filetype parsing plan (finance-first)**

* `.xlsx`: sheets, tables, named ranges, formulas (as text), dependency hints
* `.pptx`: slide titles, bullet text, speaker notes (if any)
* `.py` / `.ipynb`: module structure, functions, comments, key outputs
* `.md` / docs: sections + headings + links

**Persist**

* `structured_files[] = {file_id, file_type, parsed_content, metadata}`

---

### Step 2 — “Individual file LLM analysis” as *iterative deep dive* (n passes per file)

Your new requirement: **each file is read multiple times** to reduce miss rate and force “what did you miss?” reflection.

**Design choice:** implement a **per-file subgraph** with a bounded loop of `n` (e.g., 3).

* Pass 1: “Map & describe” (what this file is, structure, obvious intent)
* Pass 2: “Critique & gaps” (what’s unclear, what might be wrong/missing)
* Pass 3: “At-risk knowledge extraction” (decisions/overrides/heuristics → questions)

**Per-file deep dive output (final)**

* `file_purpose_summary`
* `key_mechanics`
* `fragile_points`
* `at_risk_knowledge_candidates`
* **questions_from_each_file** (with evidence pointers to parsed content)

**Persist**

* `deep_dive_reports[]`

---

### “Concatenate deep dive outputs” (reduce)

**Purpose:** build a unified corpus across k files and set up global reasoning.

Output:

* `deep_dive_corpus` (merged summaries + merged at-risk candidates)
* `question_proposals_from_files` (all per-file questions before reconciliation)

Persist:

* `deep_dive_corpus`

---

### Step 3 — “Global LLM summarization” → “Global summary” + “Questions from global view”

**Purpose:** find cross-file issues a per-file read won’t catch:

* assumption mismatches (deck says X, model uses Y)
* workflow dependencies (model output used by deck/other file)
* missing context (why a sensitivity range is chosen, where manual overrides happen)

Outputs:

* `global_summary`
* `questions_from_global_view`

Persist both.

---

## 3) Unified question set as a **backlog with state transitions** (your new nuance)

Your new nuance: questions can be:

* generated early from per-file dives,
* then **resolved** by later evidence during concatenation/global summary,
* and also **new questions can appear** during reduce/global.

So “Unified question set” is not a one-shot merge; it’s a **reconciliation/update step**.

### Question backlog object model (MVP)

Each question:

* `question_id`
* `question_text`
* `origin`: per_file / global
* `evidence[]`: pointers (file_id + location)
* `priority`: P0/P1/P2
* `status`: open / answered_by_files / answered_by_interview / merged / deprioritized
* `answer` (optional)
* `confidence` (optional)

### Reconciliation logic (Unified question set step)

Input:

* per-file question proposals
* global-view question proposals
* deep_dive_corpus + global_summary as potential evidence

Actions:

1. **Deduplicate / merge**
2. **Auto-resolve**: mark `answered_by_files` if corpus/global summary explicitly answers it
3. **Add new questions** from global view
4. **Reprioritize** by risk/impact/uncertainty

Output:

* `question_backlog` (the single source of truth)

Persist:

* `question_backlog`

---

## 4) “AI interview” as a bounded loop (infinite-loop risk acknowledged, not solved now)

You said: update question list during interview and avoid infinite-loop concerns for now, but leave “space.”

So implement a *simple bounded loop*:
Stop when:

* no **open P0/P1** questions remain, OR
* `rounds >= R` (e.g., 10), OR
* `time_budget` reached

### Interview loop behavior

For each chosen question:

1. Ask the question (short, specific)
2. Extract structured facts from the answer
3. Update backlog item:

   * status → `answered_by_interview`
   * attach extracted facts + confidence
4. Optionally generate follow-up questions (bounded):

   * only if answer is vague/contradictory
   * follow-up count cap (e.g., max 1 follow-up per question for MVP)

Persist continuously:

* `interview_transcript`
* `extracted_facts[]`
* updated `question_backlog`

---

## 5) Post-interview outputs (three parallel tracks)

After the interview completes, three outputs are generated:

### Track A: Onboarding package (LLM remix)

The onboarding package is an **LLM-processed remix** of `deep_dive_corpus` + `extracted_facts`. The LLM synthesizes file-level analysis with interview insights into a coherent document.

**Knowledge entries** — structured facts:

* decision rationales
* manual override rules
* workflow steps
* gotchas / failure modes
* stakeholder constraints

**Onboarding document** — human-readable, with sections:

* **Abstract** (what this project does)
* **Introduction** (why it exists, big picture)
* **Details** (how to run/update, file-by-file — enriched with interview insights)
* **FAQ** (top expected questions, mixing file-derived and interview-derived answers)
* **Risk / gotchas** (most error-prone items)

Persist: `onboarding_docs.md`, `knowledge_entries.json`

### Track B: QA agent context (system prompt)

Assemble the deep dive corpus + interview summary + extracted facts into a single `.txt` file used as the QA agent's system prompt. No vector DB for MVP — the entire knowledge base fits in the LLM context window.

Persist: `qa_system_prompt.txt`

---

## 6) Onboarding Graph plan (later stage, new hire arrives)

### Inputs

* onboarding package docs
* QA system prompt text (deep dives + interview summary)
* structured files JSON + interview summary (for on-demand knowledge graph)

### Outputs

1. **Overview narrative**

   * guided reading experience + suggested first-week checklist
2. **Knowledge graph visualization** (on-demand)

   * generated via tool call from parsed files + interview summary
   * interactive node/edge diagram showing files, concepts, people, processes
3. **QA agent for new employee**

   * uses deep dives + interview summary as system prompt (no vector DB)
   * user asks → LLM answers from system prompt context
   * if low confidence → generate gap ticket (what’s missing, where to look)

---

## 7) LangGraph structure (implementation-level planning, still high-level)

### Offboarding Graph

* Subgraph: `FileDeepDiveSubgraph(file_id)` with `n`-pass loop
* Main graph:

  1. Parse files
  2. Fan-out: run FileDeepDiveSubgraph on each file
  3. Concatenate deep dives
  4. Global summarization + global questions
  5. Reconcile backlog (unified question set)
  6. Interview loop (bounded)
  7. Generate onboarding package (LLM remix of deep dives + interview facts)
  8. Build QA agent context (assemble system prompt txt)

### Onboarding Graph

1. Generate overview narrative
2. Serve QA loop (system-prompt based, no vector DB)
3. Serve knowledge graph visualization (on-demand tool call, not pre-built)

---

## 8) MVP scope controls (to keep TreeHacks demo tight)

* k files: 3–6 representative files (1–2 xlsx, 1 pptx, 1 notebook, 1 md)
* Deep dive passes: `n=3` for xlsx, `n=2` for others
* Max questions:

  * per file: 3–5
  * unified backlog: cap at ~12–15
* Interview rounds: cap at 8–10
* Deliverables:

  * onboarding doc (1–2 pages)
  * QA demo with 3 questions (1 answered confidently, 1 answered with citation, 1 triggers a gap ticket)

---

## 9) Demo storyline (fits your doc’s judge-friendly framing)

* Show “bad/messy files” reality
* Agent produces:

  * clear summary
  * prioritized questions that surface tacit knowledge
* “Interview” quickly fills gaps
* One week later: new hire opens onboarding mode, gets:

  * overview
  * Q&A agent answers without the original employee present
    This demonstrates **knowledge continuity** and “knowledge loss prevention.” 

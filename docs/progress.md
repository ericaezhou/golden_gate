# Project Progress — What's Done & What's TODO

*Last updated: Feb 15, 2026*

---

## Status Overview

| Layer | Status | Notes |
|-------|--------|-------|
| Project setup | **Done** | `pyproject.toml`, `uv sync`, `.env.example` |
| Data models | **Done** | Pydantic models + LangGraph state types |
| File parsers | **Done** | 10 parsers (xlsx, pptx, py, ipynb, md, sql, pdf, docx, sqlite, txt) |
| Services (LLM, storage, embeddings) | **Done** | Fully implemented wrappers |
| Graph skeletons | **Done** | Offboarding + onboarding graphs wired with all edges |
| FastAPI app + routes | **Done** | All endpoints exist with stub responses |
| Pipeline nodes | **Partial** | 4 of 8 implemented (reconcile_questions done), 4 need LLM calls |
| Route wiring to graphs | **TODO** | Routes don't execute graphs yet |
| Frontend ↔ backend integration | **TODO** | Frontend still uses mock data |
| Tests | **Partial** | 6 framework smoke tests pass, need node-level tests |

---

## Fully Implemented (ready to use)

### Infrastructure

| File | What it does |
|------|-------------|
| `pyproject.toml` | All Python dependencies, pytest config, ruff config |
| `backend/config.py` | Centralized settings loaded from `.env` — API keys, model names, limits |
| `backend/main.py` | FastAPI app with CORS, all routers mounted, health endpoint |

### Data Models (`backend/models/`)

| File | What it defines |
|------|----------------|
| `artifacts.py` | `StructuredFile`, `DeepDiveReport`, `InterviewTurn`, `OnboardingPackage`, `Evidence` |
| `questions.py` | `Question` with enums: `QuestionOrigin`, `QuestionStatus`, `QuestionPriority` |
| `state.py` | `OffboardingState`, `OnboardingState`, `FileDeepDiveState` (LangGraph TypedDicts) |

### Services (`backend/services/`)

| File | What it does |
|------|-------------|
| `llm.py` | `call_llm(system, user)` and `call_llm_json(system, user)` — async OpenAI wrappers with retry-friendly JSON extraction |
| `storage.py` | `SessionStorage` class — JSON/text save/load, file uploads, session creation |
**Note:** `embeddings.py` (ChromaDB) exists but is **not used for MVP**. The QA agent uses deep dives + interview summary as a system prompt instead of vector retrieval.

### File Parsers (`backend/parsers/`)

All 10 parsers are fully implemented with a decorator-based auto-registration system:

| Parser | Extensions | Key extractions |
|--------|-----------|-----------------|
| `excel_parser.py` | `.xlsx`, `.xls` | Formulas, named ranges, hidden sheets, comments |
| `pptx_parser.py` | `.pptx` | Slide text, tables, speaker notes |
| `python_parser.py` | `.py` | AST: functions, classes, imports, TODOs |
| `notebook_parser.py` | `.ipynb` | Code/markdown cells, outputs |
| `text_parser.py` | `.txt` | Headers, file references |
| `sql_parser.py` | `.sql` | Tables, columns, joins (via sqlglot) |
| `pdf_parser.py` | `.pdf` | Text extraction (via pymupdf4llm) |
| `docx_parser.py` | `.docx` | Headings, tables, formatting |
| `sqlite_parser.py` | `.db` | Schemas, row counts, sample data |
| `cross_references.py` | — | Cross-file reference resolution |

### Graph Skeletons (`backend/graphs/`)

| File | What it does |
|------|-------------|
| `offboarding_graph.py` | Full pipeline: `START → parse → fan-out deep dives → collect → concat → global → reconcile → interview → [package + qa_context] → END` |
| `onboarding_graph.py` | `START → generate_narrative → qa_loop (system-prompt based, with interrupt)` |
| `subgraphs/file_deep_dive.py` | Per-file loop: `START → run_pass → continue/done → END` |

### Implemented Nodes

| File | Status | Notes |
|------|--------|-------|
| `nodes/parse_files.py` | **Done** | Uses existing parsers, handles errors gracefully, persists results |
| `nodes/concatenate.py` | **Done** | Merges reports, initializes question backlog, formats corpus text |
| `nodes/reconcile_questions.py` | **Done** | LLM-assisted dedup, auto-resolve, reprioritize, cap enforcement with fallback |

### Routes (all endpoints exist)

| File | Endpoints | Status |
|------|-----------|--------|
| `routes/offboarding.py` | `POST /start`, `GET /status`, `GET /stream` | **Stubs** — saves files + returns session ID, but doesn't execute graph |
| `routes/interview.py` | `POST /respond`, `POST /end` | **Stubs** — persists response, but doesn't resume graph |
| `routes/onboarding.py` | `GET /narrative`, `POST /ask` | **Stubs** — reads stored package, but no retrieval |
| `routes/session.py` | `GET /artifacts` | **Done** — fully implemented |

### Tests

| File | Tests | Status |
|------|-------|--------|
| `tests/test_framework.py` | 6 smoke tests | **All passing** |
| `tests/test_reconcile_questions.py` | 16 unit tests | **All passing** |
| `test_parsers.py` | Parser integration tests | **Existing** |

---

## TODO — What Needs to Be Built

### Priority 1: Core LLM Nodes (blocks everything else)

These nodes have the correct signatures, state I/O, and persistence — they just need the actual LLM prompt calls filled in.

#### `nodes/deep_dive.py` — Per-File LLM Analysis

- **What exists:** Subgraph loop structure, pass routing, `prepare_deep_dive_input()` helper. Returns placeholder `DeepDiveReport`.
- **What's needed:**
  - [ ] Pass 1 LLM call: "Map & Describe" — file purpose, key mechanics, fragile points, at-risk knowledge, questions
  - [ ] Pass 2 LLM call: "Critique & Gaps" — focus on assumptions, implicit dependencies, undocumented manual steps
  - [ ] Pass 3 LLM call: "At-Risk Knowledge Extraction" (xlsx only) — tacit knowledge, override rules, heuristics
  - [ ] Parse LLM JSON response into `DeepDiveReport` fields
- **Reference:** `docs/implementation_design.md` §4.2

#### `nodes/global_summarize.py` — Cross-File Reasoning

- **What exists:** Node signature, storage persistence. Returns placeholder string.
- **What's needed:**
  - [ ] LLM call: reason across files for mismatches, dependencies, missing context
  - [ ] Generate new cross-file questions with `origin = "global"`
  - [ ] Append new questions to `question_backlog`
- **Reference:** `docs/implementation_design.md` §4.4

#### ~~`nodes/reconcile_questions.py`~~ — DONE

Fully implemented with LLM-assisted dedup, auto-resolve, reprioritization, and cap enforcement. 16 unit tests passing.

#### `nodes/interview.py` — Interactive Interview Loop

- **What exists:** Loop structure with `interrupt()`, termination conditions, turn persistence. Uses raw question text.
- **What's needed:**
  - [ ] LLM call: rephrase question conversationally before asking
  - [ ] LLM call: extract structured facts from user's answer
  - [ ] LLM call: assess confidence (high/medium/low)
  - [ ] LLM call: generate follow-up if answer is vague (max 1 per question)
- **Reference:** `docs/implementation_design.md` §4.6

#### `nodes/generate_package.py` — Onboarding Package (LLM Remix)

- **What exists:** Node signature, markdown formatter, persistence. Returns placeholder package.
- **What's needed:**
  - [ ] LLM call: build structured knowledge entries from extracted facts
  - [ ] LLM call: generate onboarding doc as **remix** of deep_dive_corpus + extracted_facts (not just a summary — synthesize both sources with interview insights enriching the file analysis)
- **Reference:** `docs/implementation_design.md` §4.7


#### `nodes/build_qa_context.py` — QA Agent System Prompt (NEW)

- **What exists:** Not yet created.
- **What's needed:**
  - [ ] Create the node file
  - [ ] Pure code (no LLM): combine deep_dive_corpus + interview_summary + extracted_facts into a structured `.txt` file
  - [ ] Persist as `qa_system_prompt.txt`
- **Reference:** `docs/implementation_design.md` §4.9

---

### Priority 2: Route ↔ Graph Wiring

The routes currently save data and return stubs. They need to actually execute the LangGraph graphs.

#### `routes/offboarding.py`

- [ ] Run `build_offboarding_graph().ainvoke(initial_state)` in a background task
- [ ] Track running graph tasks per session
- [ ] Emit SSE events as each node completes (hook into graph execution callbacks)
- [ ] Update `graph_state.json` after each node

#### `routes/interview.py`

- [ ] Wire `POST /respond` to resume the LangGraph graph at the `interrupt()` point
- [ ] Wire `POST /end` to force-terminate the interview loop and skip to `generate_onboarding_package`
- [ ] Return the next question + extracted facts in the response

#### `routes/onboarding.py`

- [ ] Wire `POST /ask` to use `qa_system_prompt.txt` as LLM system prompt (no vector retrieval)
- [ ] Implement gap ticket generation when confidence is low
- [ ] Wire `GET /narrative` to read from the onboarding graph output or trigger generation
- [ ] Add `GET /knowledge-graph` endpoint — on-demand generation via tool call (not pre-built in offboarding)

---

### Priority 3: Onboarding Graph Nodes

#### `graphs/onboarding_graph.py` — `generate_narrative`

- [ ] LLM call: generate guided narrative from onboarding package
- [ ] Produce first-week checklist
- [ ] Flag top 3 risks/gotchas

#### `graphs/onboarding_graph.py` — `qa_loop`

- [ ] Load `qa_system_prompt.txt` as the LLM system prompt
- [ ] LLM call: answer user questions grounded in deep dives + interview knowledge
- [ ] Gap detection: generate gap tickets for low-confidence answers
- [ ] **No vector retrieval** — entire knowledge base is in the system prompt

---

### Priority 4: Frontend Integration

The frontend pages exist but use mock data. They need to be wired to the real backend.

- [ ] **Home page** (`src/app/page.tsx`): file upload form → `POST /api/offboarding/start`
- [ ] **Screening page** (`src/app/screening/page.tsx`): subscribe to `GET /api/offboarding/{id}/stream` via SSE
- [ ] **Interview page** (`src/app/manager-interview/page.tsx`): send answers via `POST /api/interview/{id}/respond`
- [ ] **Handoff page** (`src/app/handoff/page.tsx`): display package from `GET /api/session/{id}/artifacts`
- [ ] **Onboarding page** (new): QA chat hitting `POST /api/onboarding/{id}/ask`
- [ ] **Onboarding page**: knowledge graph visualization (on-demand via `GET /api/onboarding/{id}/knowledge-graph`)

---

### Priority 5: Polish & Testing

- [ ] Node-level unit tests for each implemented node
- [ ] Integration test: full offboarding pipeline end-to-end with mock LLM
- [ ] Knowledge graph visualization library selection (e.g., react-force-graph, d3)
- [ ] Error handling in routes (session not found, graph failures)
- [ ] Rate limiting / retry logic in `services/llm.py`
- [ ] Proper logging format and log levels across all modules

---

## Work Assignment Guide

Each priority can be worked on by different people in parallel since they're decoupled:

| Track | Person | Files | Depends on |
|-------|--------|-------|------------|
| **A: Deep Dive node** | — | `nodes/deep_dive.py` | Models, LLM service |
| **B: Global + Reconcile nodes** | — | `nodes/global_summarize.py` | Models, LLM service |
| ~~**B2: Reconcile**~~ | — | ~~`nodes/reconcile_questions.py`~~ | **DONE** |
| **C: Interview node** | — | `nodes/interview.py` | Models, LLM service |
| **D: Package generation node** | — | `nodes/generate_package.py` | Models, LLM service |
| **D2: QA context node** | — | `nodes/build_qa_context.py` (NEW) | Models, storage |
| **E: Route wiring** | — | `routes/offboarding.py`, `routes/interview.py`, `routes/onboarding.py` | Graph skeletons, nodes |
| **F: Frontend** | — | `src/app/` pages + knowledge graph visualization (on-demand) | Routes |

Tracks A–D3 are fully independent of each other. Track E depends on at least some nodes being implemented. Track F depends on routes working.

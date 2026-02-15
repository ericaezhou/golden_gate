# Project Progress — What's Done & What's TODO

*Last updated: Feb 14, 2026*

---

## Status Overview

| Layer | Status | Notes |
|-------|--------|-------|
| Project setup | **Done** | `pyproject.toml`, `uv sync`, `.env.example` |
| Data models | **Done** | Pydantic models + LangGraph state types |
| File parsers | **Done** | 10 parsers (xlsx, pptx, py, ipynb, md, sql, pdf, docx, sqlite, txt) |
| Services (LLM, storage) | **Done** | Fully implemented wrappers (embeddings.py removed — MVP uses system prompt) |
| Graph skeletons | **Done** | Offboarding + onboarding graphs wired with all edges |
| FastAPI app + routes | **Done** | All endpoints exist with stub responses |
| Pipeline nodes | **Partial** | 7 of 8 implemented; only `interview.py` LLM calls remain as TODOs |
| Route wiring to graphs | **Partial** | `routes/offboarding.py` fully wired (SSE streaming, background task); interview + onboarding routes still stubs |
| Frontend ↔ backend integration | **TODO** | Frontend still uses mock data |
| Tests | **Partial** | 92 tests passing (6 framework + 14 reconcile + 24 deep dive + 26 integration + 22 generate_package) |

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
| `state.py` | `OffboardingState`, `OnboardingState`, `FileDeepDiveState`, `FileDeepDiveOutput` (LangGraph TypedDicts) |

### Services (`backend/services/`)

| File | What it does |
|------|-------------|
| `llm.py` | `call_llm(system, user)` and `call_llm_json(system, user)` — async OpenAI wrappers with retry-friendly JSON extraction |
| `storage.py` | `SessionStorage` class — JSON/text save/load, file uploads, session creation |

**Note:** `embeddings.py` (ChromaDB) has been **removed**. The QA agent uses deep dives + interview summary as a system prompt instead of vector retrieval.

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
| `offboarding_graph.py` | Full pipeline: `START → parse → fan-out deep dives → collect → concat → global → reconcile → interview → [package + qa_context] → END`. Also exposes `build_deep_dive_only_graph()` (truncated: parse → deep dives → concat → END, no checkpointer needed). |
| `onboarding_graph.py` | `START → generate_narrative → qa_loop (system-prompt based, with interrupt)` |
| `subgraphs/file_deep_dive.py` | Per-file loop: `START → run_pass → continue/done → END`. Uses `FileDeepDiveOutput` to restrict fan-in keys. |

### Implemented Nodes

| File | Status | Notes |
|------|--------|-------|
| `nodes/parse_files.py` | **Done** | Uses existing parsers, handles errors gracefully, persists results |
| `nodes/deep_dive.py` | **Done** | Multi-pass LLM analysis (3 passes for xlsx, 2 for others). Pass-specific prompts, cumulative summaries. Persists each pass as JSON. |
| `nodes/concatenate.py` | **Done** | Merges reports (takes latest pass per file), initializes question backlog, formats corpus text. Persists corpus as JSON. |
| `nodes/global_summarize.py` | **Done** | Cross-file LLM reasoning. Generates global summary + cross-file questions (GLOBAL origin). Appends to backlog. |
| `nodes/reconcile_questions.py` | **Done** | LLM-assisted dedup, auto-resolve, reprioritize, cap enforcement with fallback |
| `nodes/build_qa_context.py` | **Done** | Pure code (no LLM). Combines deep_dive_corpus + interview_summary + extracted_facts into `qa_system_prompt.txt` |

### Routes (all endpoints exist)

| File | Endpoints | Status |
|------|-----------|--------|
| `routes/offboarding.py` | `POST /start`, `GET /status`, `GET /stream`, `GET /demo-files`, `GET /demo-files/{filename}` | **Done** — fully wired: runs `build_deep_dive_only_graph()` in background task, SSE streaming of pipeline events, demo file serving |
| `routes/interview.py` | `POST /respond`, `POST /end` | **Stubs** — persists response, but doesn't resume LangGraph interrupt |
| `routes/onboarding.py` | `GET /narrative`, `POST /ask`, `GET /knowledge-graph` | **Stubs** — reads stored package; QA and knowledge graph not yet implemented |
| `routes/session.py` | `GET /artifacts` | **Done** — fully implemented |

### Tests

| File | Tests | Status |
|------|-------|--------|
| `tests/test_framework.py` | 6 smoke tests | **All passing** |
| `tests/test_reconcile_questions.py` | 14 unit tests | **All passing** |
| `tests/test_deep_dive.py` | 24 unit tests (multi-pass, prompts, persistence, concatenation, subgraph) | **All passing** |
| `tests/test_generate_package.py` | 22 unit tests (LLM inputs, output, persistence, edge cases) | **All passing** |
| `tests/test_integration.py` | 26 integration tests (graph compilation, state flow, dead imports) | **All passing** |
| `test_parsers.py` | Parser integration tests | **Existing** |

---

## TODO — What Needs to Be Built

### Priority 1: Core LLM Nodes (blocks everything else)

These nodes have the correct signatures, state I/O, and persistence — they just need the actual LLM prompt calls filled in.

#### ~~`nodes/deep_dive.py`~~ — DONE

Fully implemented: 3 pass-specific prompts (map & describe, critique & gaps, tacit knowledge), cumulative summaries, JSON persistence per pass, `prepare_deep_dive_input()` with configurable pass count per file type. 24 unit tests passing.

#### ~~`nodes/global_summarize.py`~~ — DONE

Fully implemented: cross-file LLM reasoning, generates global summary + cross-file questions with GLOBAL origin and priority levels, appends to question backlog. Persists `global_summary.json`.

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

#### ~~`nodes/generate_package.py`~~ — DONE

Fully implemented: two LLM calls (5a: knowledge entries, 5b: onboarding doc remix). Reads deep_dive_corpus + interview_summary + extracted_facts + global_summary. Produces OnboardingPackage with abstract, intro, details, FAQ, risks, knowledge entries. Persists as JSON + Markdown. 22 unit tests passing.


#### ~~`nodes/build_qa_context.py`~~ — DONE

Fully implemented: pure code (no LLM). Combines deep_dive_corpus + interview_summary + extracted_facts + answered questions into `qa_system_prompt.txt`. Also persists `deep_dive_corpus.txt` and `interview/interview_summary.txt`.

---

### Priority 2: Route ↔ Graph Wiring

The routes currently save data and return stubs. They need to actually execute the LangGraph graphs.

#### ~~`routes/offboarding.py`~~ — DONE

Fully wired: runs `build_deep_dive_only_graph()` in a background task with `asyncio.create_task()`, tracks tasks per session, emits SSE events for parse/deep dive/concat steps, saves `graph_state.json`. Also serves demo files from `data/` directory.

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

| Track | Person | Files | Status |
|-------|--------|-------|--------|
| ~~**A: Deep Dive node**~~ | — | ~~`nodes/deep_dive.py`~~ | **DONE** |
| ~~**B: Global + Reconcile nodes**~~ | — | ~~`nodes/global_summarize.py`, `nodes/reconcile_questions.py`~~ | **DONE** |
| ~~**B3: QA context node**~~ | — | ~~`nodes/build_qa_context.py`~~ | **DONE** |
| **C: Interview node LLM calls** | — | `nodes/interview.py` | Loop structure done; needs LLM calls for question rephrasing, fact extraction, confidence |
| ~~**D: Package generation**~~ | — | ~~`nodes/generate_package.py`~~ | **DONE** |
| ~~**E1: Offboarding route**~~ | — | ~~`routes/offboarding.py`~~ | **DONE** (SSE streaming, background task) |
| **E2: Interview + Onboarding routes** | — | `routes/interview.py`, `routes/onboarding.py` | Stubs — need LangGraph interrupt wiring + system-prompt QA |
| **F: Frontend** | — | `src/app/` pages + knowledge graph visualization (on-demand) | Depends on routes |

Remaining work is concentrated in tracks C, D, E2, and F.

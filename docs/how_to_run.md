# How to Run — Golden Gate

## Quick Start (Demo Only — no backend needed)

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` → click **Start Screening** → watch the mock analysis run. No API key required.

## Quick Start (Full Stack)

```bash
# Terminal 1 — backend
cp .env.example .env          # then add your OPENAI_API_KEY
uv sync
uv run serve

# Terminal 2 — frontend
npm install
npm run dev
```

Open `http://localhost:3000`. To run against the real backend, upload files via the UI or hit `POST /api/offboarding/start`.

---

## Prerequisites

- **macOS** (developed on M4 chip)
- **Python 3.11+**
- **Node.js 18+**
- **uv** (Python package manager) — install with `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **npm** (comes with Node.js)
- **OpenAI API key** with access to `gpt-4o`

---

## 1) Clone & Enter the Repo

```bash
git clone <repo-url>
cd golden_gate
```

---

## 2) Environment Variables

Copy the example and fill in your API key:

```bash
cp .env.example .env
```

Edit `.env`:

```
OPENAI_API_KEY=sk-your-actual-key-here
```

That's the only required key. All other settings have sensible defaults (see `backend/config.py`).

---

## 3) Install Dependencies

### Python backend

```bash
uv sync
```

This reads `pyproject.toml`, creates a `.venv/`, and installs everything. No `pip install` needed.

### Node.js frontend

```bash
npm install
```

---

## 4) Run the Backend (FastAPI)

```bash
uv run uvicorn backend.main:app --reload --port 8000
```

Or use the project script shortcut:

```bash
uv run serve
```

Once running:
- API is at `http://localhost:8000`
- Interactive docs at `http://localhost:8000/docs`
- Health check: `curl http://localhost:8000/api/health`

---

## 5) Run the Frontend (Next.js)

In a **separate terminal**:

```bash
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## 6) Run Tests

```bash
# All backend tests (92 unit + integration)
uv run pytest -v

# Just the framework smoke tests
uv run pytest backend/tests/test_framework.py -v

# Existing parser tests
uv run python backend/test_parsers.py
```

---

## 7) End-to-End Testing (with real LLM)

### Option A: Automated test script

The test script uploads demo files, waits for analysis, runs the interview with sample answers, then tests the onboarding QA.

```bash
# Start the server in terminal 1
uv run serve

# Run the full E2E test in terminal 2
uv run python scripts/test_e2e.py
```

Options:
```bash
# Skip the interview (just run analysis + auto-generate package)
uv run python scripts/test_e2e.py --skip-interview

# Limit to N interview rounds
uv run python scripts/test_e2e.py --max-rounds 2

# Use specific files
uv run python scripts/test_e2e.py --files data/run_notes.txt data/risk_queries.sql

# Resume a previous session (skip upload + analysis)
uv run python scripts/test_e2e.py --session-id abc123def456
```

### Option B: Manual curl walkthrough

**Step 1 — Start the pipeline:**
```bash
curl -X POST http://localhost:8000/api/offboarding/start \
  -F "project_name=Risk Forecast Model" \
  -F "role=Risk Analyst" \
  -F "files=@data/run_notes.txt" \
  -F "files=@data/loss_forecast_model.py"
```

Response: `{"session_id": "abc123...", "status": "started"}`

**Step 2 — Watch progress (SSE):**
```bash
curl -N http://localhost:8000/api/offboarding/{SESSION_ID}/stream
```

Events flow: `file_parsed` → `deep_dive_pass` → `step_completed` → `question_discovered` → `interview_ready`

**Step 3 — Check interview status:**
```bash
curl http://localhost:8000/api/interview/{SESSION_ID}/status
```

**Step 4 — Answer interview questions:**
```bash
curl -X POST http://localhost:8000/api/interview/{SESSION_ID}/respond \
  -H "Content-Type: application/json" \
  -d '{"user_response": "The threshold is 0.3 from Q4 2019 calibration."}'
```

Repeat until `interview_active: false`.

**Step 5 — Or end the interview early:**
```bash
curl -X POST http://localhost:8000/api/interview/{SESSION_ID}/end
```

**Step 6 — Check generated artifacts:**
```bash
curl http://localhost:8000/api/session/{SESSION_ID}/artifacts
```

**Step 7 — Get the onboarding narrative:**
```bash
curl http://localhost:8000/api/onboarding/{SESSION_ID}/narrative
```

**Step 8 — Ask the QA agent:**
```bash
curl -X POST http://localhost:8000/api/onboarding/{SESSION_ID}/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the loss threshold and how was it determined?"}'
```

### Option C: Swagger UI

Open `http://localhost:8000/docs` in your browser to use the interactive API explorer.

---

## 8) Pipeline Architecture

```
Upload files ──► parse ──► deep dive (per file) ──► concatenate ──► global summary
                                                                          │
                                                           reconcile questions
                                                                          │
                                                           interview (pause)
                                                                          │
                                                    ┌─────────────────────┼───────────────┐
                                                    ▼                                     ▼
                                           onboarding package                    QA system prompt
                                                    │                                     │
                                              ┌─────┘                              ┌──────┘
                                              ▼                                    ▼
                                    GET /narrative                          POST /ask
```

The pipeline uses LangGraph with a `MemorySaver` checkpointer.  The interview
node calls `interrupt()` to pause the graph and wait for user input.  Each call
to `POST /interview/{id}/respond` resumes the graph for one Q&A round.

---

## 9) Project Structure (Quick Reference)

```
golden_gate/
├── backend/                  # Python backend
│   ├── main.py               # FastAPI entry point
│   ├── config.py             # Settings (env-driven)
│   ├── models/               # Pydantic data models
│   ├── services/             # LLM, storage
│   ├── nodes/                # Pipeline step implementations
│   ├── graphs/               # LangGraph definitions + registry
│   ├── routes/               # FastAPI endpoints
│   ├── parsers/              # File parsers (xlsx, pptx, py, etc.)
│   └── tests/                # pytest tests
├── scripts/                  # E2E test scripts
├── src/                      # Next.js frontend
├── data/                     # Demo data files for testing
├── data/sessions/            # Runtime session data (gitignored)
├── docs/                     # Design & implementation docs
├── pyproject.toml            # Python project config
└── package.json              # Node project config
```

---

## 10) Key Commands Cheat Sheet

| Task | Command |
|------|---------|
| Install Python deps | `uv sync` |
| Install Node deps | `npm install` |
| Start backend | `uv run serve` |
| Start frontend | `npm run dev` |
| Run unit tests | `uv run pytest -v` |
| Run E2E test | `uv run python scripts/test_e2e.py` |
| Check API health | `curl localhost:8000/api/health` |
| View API docs | Open `http://localhost:8000/docs` |
| Add a Python dep | `uv add <package>` |

---

## 11) API Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/offboarding/start` | Upload files & start pipeline |
| `GET` | `/api/offboarding/{id}/status` | Check pipeline progress |
| `GET` | `/api/offboarding/{id}/stream` | SSE stream of progress events |
| `GET` | `/api/offboarding/demo-files` | List available demo files |
| `GET` | `/api/interview/{id}/status` | Check interview state + current question |
| `POST` | `/api/interview/{id}/respond` | Submit interview answer, get next question |
| `POST` | `/api/interview/{id}/end` | End interview early |
| `GET` | `/api/onboarding/{id}/narrative` | Get/generate onboarding narrative |
| `POST` | `/api/onboarding/{id}/ask` | Ask the QA agent a question |
| `GET` | `/api/onboarding/{id}/knowledge-graph` | Get knowledge graph (placeholder) |
| `GET` | `/api/session/{id}/artifacts` | List all session artifacts |

---

## 12) Troubleshooting

**`uv: command not found`**
→ Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh` then restart your terminal.

**`ModuleNotFoundError: No module named 'backend'`**
→ Run commands from the project root (`golden_gate/`), not from inside `backend/`.

**Port 8000 already in use**
→ Kill the existing process: `lsof -ti:8000 | xargs kill` or use a different port: `--port 8001`.

**`OPENAI_API_KEY is not set` warning at startup**
→ Create a `.env` file with your key. See step 2 above.

**Pipeline takes too long**
→ The demo files make ~15-25 LLM calls during analysis. With `gpt-4o` this typically takes 2-5 minutes. Use `--files data/run_notes.txt` for a faster single-file test.

**ChromaDB issues on M4**
→ If you get build errors for `chroma-hnswlib`, make sure you have Xcode CLI tools: `xcode-select --install`.

**Frontend can't reach backend**
→ Ensure both are running. The frontend expects the backend at `localhost:8000`. Check CORS settings in `backend/config.py`.

**Interview never starts**
→ The pipeline generates questions from deep dives. If files are too simple or parsing fails, there may be no questions. Check logs and `GET /api/session/{id}/artifacts`.

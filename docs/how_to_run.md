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
uv run uvicorn backend.main:app --reload --port 8000

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
# All backend tests
uv run pytest -v

# Just the framework smoke tests
uv run pytest backend/tests/test_framework.py -v

# Existing parser tests
uv run python backend/test_parsers.py
```

---

## 7) Project Structure (Quick Reference)

```
golden_gate/
├── backend/                  # Python backend
│   ├── main.py               # FastAPI entry point
│   ├── config.py             # Settings (env-driven)
│   ├── models/               # Pydantic data models
│   ├── services/             # LLM, storage, embeddings
│   ├── nodes/                # Pipeline step implementations
│   ├── graphs/               # LangGraph definitions
│   ├── routes/               # FastAPI endpoints
│   ├── parsers/              # File parsers (xlsx, pptx, py, etc.)
│   └── tests/                # pytest tests
├── src/                      # Next.js frontend
│   ├── app/                  # Pages & API routes
│   ├── components/           # React components
│   ├── context/              # State management
│   ├── lib/                  # Utilities
│   └── types/                # TypeScript types
├── data/sessions/            # Runtime session data (gitignored)
├── public/artifacts/         # Sample demo files
├── docs/                     # Design & implementation docs
├── pyproject.toml            # Python project config
└── package.json              # Node project config
```

---

## 8) Key Commands Cheat Sheet

| Task | Command |
|------|---------|
| Install Python deps | `uv sync` |
| Install Node deps | `npm install` |
| Start backend | `uv run uvicorn backend.main:app --reload --port 8000` |
| Start frontend | `npm run dev` |
| Run all tests | `uv run pytest -v` |
| Check API health | `curl localhost:8000/api/health` |
| View API docs | Open `http://localhost:8000/docs` |
| Add a Python dep | `uv add <package>` |
| Add a Node dep | `npm install <package>` |

---

## 9) API Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/offboarding/start` | Upload files & start pipeline |
| `GET` | `/api/offboarding/{id}/status` | Check pipeline progress |
| `GET` | `/api/offboarding/{id}/stream` | SSE stream of progress events |
| `POST` | `/api/interview/{id}/respond` | Submit interview answer |
| `POST` | `/api/interview/{id}/end` | End interview early |
| `GET` | `/api/onboarding/{id}/narrative` | Get onboarding narrative |
| `POST` | `/api/onboarding/{id}/ask` | Ask the QA agent a question |
| `GET` | `/api/session/{id}/artifacts` | List all session artifacts |

---

## 10) Troubleshooting

**`uv: command not found`**
→ Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh` then restart your terminal.

**`ModuleNotFoundError: No module named 'backend'`**
→ Run commands from the project root (`golden_gate/`), not from inside `backend/`.

**Port 8000 already in use**
→ Kill the existing process: `lsof -ti:8000 | xargs kill` or use a different port: `--port 8001`.

**ChromaDB issues on M4**
→ If you get build errors for `chroma-hnswlib`, make sure you have Xcode CLI tools: `xcode-select --install`.

**Frontend can't reach backend**
→ Ensure both are running. The frontend expects the backend at `localhost:8000`. Check CORS settings in `backend/config.py`.

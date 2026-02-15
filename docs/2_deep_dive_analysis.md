# Deep Dive Analysis (Per-File LLM Analysis)

The deep dive is the core analytical step in the offboarding pipeline. Each uploaded file is independently analyzed by an LLM through multiple iterative passes, producing structured reports that capture purpose, mechanics, fragile points, and at-risk knowledge. These reports are then concatenated into a corpus that feeds gap finding (global cross-file analysis) and question generation.

## Pipeline Position

```
File Upload → Parsing → Deep Dives (this doc) → Gap Finding → Question Generation → Interview
```

The deep dive spans **Steps 2-4** of the offboarding graph:

| Step | Node | What it does |
|------|------|--------------|
| 2 | `file_deep_dive` (subgraph) | Iterative per-file LLM analysis |
| 3a | `concatenate_deep_dives` | Merges reports into a corpus + extracts per-file questions |
| 3b | `global_summarize` | Cross-file gap finding, generates global questions |
| 4 | `reconcile_questions` | Deduplicates and caps the question backlog |

## Architecture

Each file gets its own **subgraph instance** via LangGraph's fan-out pattern. Files are analyzed in parallel, with each subgraph running 2-3 iterative LLM passes depending on file type.

```
parse_files
    ↓
fan_out → file_deep_dive × N files (parallel)
    │         ↓
    │     Pass 1: Map & Describe
    │         ↓
    │     should_continue? ──→ Pass 2: Critique & Gap Detection
    │                              ↓
    │                          should_continue? ──→ Pass 3: Tacit Knowledge (xlsx only)
    │                                                   ↓
    └──────── collect_deep_dives ←──────────────────────┘
                  ↓
          concatenate_deep_dives (merge + extract questions)
                  ↓
          global_summarize (cross-file gap finding)
                  ↓
          reconcile_questions (dedup + cap)
```

**Source files:**
- Subgraph definition: `backend/graphs/subgraphs/file_deep_dive.py`
- Node logic: `backend/nodes/deep_dive.py`
- Fan-out wiring: `backend/graphs/offboarding_graph.py`

## Multi-Pass Analysis

Each file goes through multiple LLM passes, where each subsequent pass receives the reports from all prior passes. This iterative approach catches gaps that a single analysis would miss.

### Pass Configuration

| File Type | Passes | Config Key |
|-----------|--------|------------|
| `.xlsx`, `.xls` | 3 | `DEEP_DIVE_PASSES_XLSX` |
| All others | 2 | `DEEP_DIVE_PASSES_DEFAULT` |

### Pass 1: Map & Describe

Initial structural analysis of the file.

**Focus:** What does this file do? What are its core mechanics?

**Prompt extracts:**
- `file_purpose_summary` — What the file is and what it does
- `key_mechanics` — Core logic, formulas, workflows, key operations
- `fragile_points` — What looks brittle, manual, or error-prone
- `at_risk_knowledge` — Decisions or heuristics that would be lost if the author left
- `questions` — What would you ask the author? (with evidence from the file)
- `cumulative_summary` — Concise summary of findings

### Pass 2: Critique & Gap Detection

Re-analyzes the file with the Pass 1 report as context. The LLM is explicitly told to focus on what it **missed** the first time.

**Focus areas:**
- Assumptions embedded in formulas, constants, or magic numbers
- Implicit dependencies on external data, APIs, or other files
- Manual steps that aren't documented anywhere
- Edge cases or failure modes

**Key constraint:** The LLM must return only **new** findings — no repeats from Pass 1.

### Pass 3: Tacit Knowledge Extraction (xlsx/xls only)

A final pass specific to spreadsheets, which tend to contain the most embedded tribal knowledge.

**Focus areas:**
- Why specific numbers, thresholds, or constants were chosen
- Override rules or manual adjustments that happen periodically
- Political or stakeholder context affecting decisions in the file
- "If X happens, do Y" heuristics only the author knows

**Key constraint:** Questions are ranked by knowledge-loss risk, highest first.

## Data Models

### DeepDiveReport

Output of each pass. Defined in `backend/models/artifacts.py`.

```python
class DeepDiveReport(BaseModel):
    file_id: str                          # Slug derived from filename
    pass_number: int                      # 1, 2, or 3
    file_purpose_summary: str             # What the file does
    key_mechanics: list[str]              # Core logic and operations
    fragile_points: list[str]             # Brittle or error-prone areas
    at_risk_knowledge: list[str]          # Knowledge at risk of loss
    questions: list[dict]                 # [{"text": "...", "evidence": "..."}]
    cumulative_summary: str               # Running summary across passes
```

### StructuredFile (input)

The parsed file that enters the deep dive. Also defined in `backend/models/artifacts.py`.

```python
class StructuredFile(BaseModel):
    file_id: str                          # Slug derived from filename
    file_name: str                        # Original filename
    file_type: str                        # xlsx | pptx | py | ipynb | md | sql | pdf
    parsed_content: dict                  # Type-specific parsed output
    metadata: dict
    raw_path: str
```

### FileDeepDiveState

Internal state of the per-file subgraph. Defined in `backend/models/state.py`.

```python
class FileDeepDiveState(TypedDict):
    file: StructuredFile                  # The file being analyzed
    pass_number: int                      # Current pass (1, 2, or 3)
    max_passes: int                       # Total passes for this file type
    previous_passes: list[DeepDiveReport] # Reports from all prior passes
    current_report: DeepDiveReport | None # Report just completed
    session_id: str
    deep_dive_reports: list[DeepDiveReport]  # Accumulated (reducer: append)
```

## LLM Configuration

All calls use the same LLM service (`backend/services/llm.py`), configured in `backend/config.py`:

| Setting | Default | Purpose |
|---------|---------|---------|
| `LLM_MODEL` | `gpt-5.2` | Model for all analysis |
| `LLM_TEMPERATURE` | `0.2` | Low temperature for consistency |
| `LLM_MAX_TOKENS` | `4096` | Token budget per call |
| `MAX_QUESTIONS_PER_FILE` | `5` | Questions capped per pass |

**Content truncation:** File content is capped at 12,000 characters (`MAX_CONTENT_CHARS` in `deep_dive.py`) to stay within token limits.

**System prompt:** All passes share the same system prompt:
> "You are a senior knowledge analyst performing a structured review of project files before an employee departs. Your goal is to extract knowledge that would be lost if the author left. Be specific and evidence-based. Return valid JSON."

## From Deep Dives to Gap Finding

### Step 3a: Concatenation (`backend/nodes/concatenate.py`)

After all parallel deep dives complete, reports are merged:

1. **Group by file** — keeps only the latest (highest) pass number per file
2. **Format as text** — each report becomes a readable markdown section with purpose, mechanics, fragile points, and at-risk knowledge
3. **Concatenate** — all sections joined into `deep_dive_corpus`
4. **Extract questions** — each report's questions become `Question` objects with `origin=PER_FILE`

### Step 3b: Global Cross-File Analysis (`backend/nodes/global_summarize.py`)

The concatenated corpus is sent to the LLM for cross-file reasoning. This step catches gaps that per-file analysis cannot see.

**The LLM looks for:**
1. **Assumption mismatches** — one file says X, another uses Y
2. **Workflow dependencies** — which file's output feeds another
3. **Missing context** — why a value was chosen, where manual overrides happen
4. **Undocumented decision criteria** spanning multiple artifacts

**Output:**
- `global_summary` — project-wide narrative
- New questions with `origin=GLOBAL`, each tagged with `involved_files` and `priority` (P0/P1/P2)

### Step 4: Question Reconciliation (`backend/nodes/reconcile_questions.py`)

Merges per-file and global questions into a final backlog:
- Caps at `MAX_OPEN_QUESTIONS` (default: 15)
- Persists to `question_backlog.json`

## Question Priority Levels

| Priority | Meaning | Example |
|----------|---------|---------|
| P0 | Total knowledge-loss risk — undocumented, lives only in person's head | "Why is the discount rate set to 12.7%?" |
| P1 | Partial/ambiguous — some documentation but incomplete | "The model references 'adjusted_revenue' but it's calculated differently in two sheets" |
| P2 | Nice-to-have clarification | "Is this quarterly rollup still used?" |

## Storage

All artifacts are persisted to disk under `data/sessions/{session_id}/`:

```
data/sessions/{session_id}/
├── parsed/
│   └── {file_id}.json              # StructuredFile (input to deep dive)
├── deep_dives/
│   ├── {file_id}_pass1.json        # DeepDiveReport from pass 1
│   ├── {file_id}_pass2.json        # DeepDiveReport from pass 2
│   └── {file_id}_pass3.json        # DeepDiveReport from pass 3 (xlsx only)
├── deep_dive_corpus.json           # Concatenated corpus
├── global_summary.json             # Cross-file analysis + global questions
└── question_backlog.json           # Final reconciled question list
```

## Supported File Types

The deep dive accepts any file type that has a registered parser:

| Extension | Parser | Notable Content |
|-----------|--------|-----------------|
| `.xlsx`, `.xls` | `excel_parser.py` | Sheets, formulas, cell values |
| `.pptx` | `pptx_parser.py` | Slides, speaker notes |
| `.py` | `python_parser.py` | AST, functions, imports |
| `.ipynb` | `notebook_parser.py` | Cells, code, outputs |
| `.md`, `.txt` | `text_parser.py` | Raw text content |
| `.sql` | `sql_parser.py` | SQL queries |
| `.pdf` | `pdf_parser.py` | Extracted text |
| `.docx` | `docx_parser.py` | Document text |

Parser registry: `backend/parsers/__init__.py`

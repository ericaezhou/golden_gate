# Golden Gate: Agentic Knowledge Extraction Engine

## Context

TreeHacks 2026 hackathon, 24 hours, team of 4. Frontend demo exists (Next.js) but backend is mocked. We need the core engine: an agentic system that ingests real files, detects undocumented knowledge, builds a knowledge graph, and generates adaptive interview questions.

**Key feedback driving design:**
- Don't build "another RAG chatbot" — build an AI that **detects gaps and asks questions**, not one that answers them
- Show a **knowledge graph** (judges remember visual artifacts)
- Make the interview **adaptive** (branches on answers, not a script)
- Parse real Excel formulas, find **cross-file contradictions**, show **deep reasoning**

---

## Architecture: Python Backend (FastAPI) + Next.js Frontend

```
┌─────────────────────────────────────┐
│  Next.js Frontend (existing)        │
│  /screening, /conversation, etc.    │
│         │                           │
│  /api/* routes proxy to Python      │
└────────┬────────────────────────────┘
         │ HTTP (localhost:8000)
         v
┌─────────────────────────────────────┐
│  Python FastAPI Backend             │
│                                     │
│  Endpoints:                         │
│    POST /analyze        run agent   │
│    GET  /analyze/stream SSE status  │
│    GET  /graph          kg JSON     │
│    POST /interview/next adaptive Q  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  File Parsers               │    │
│  │  openpyxl → Excel formulas  │    │
│  │  python-docx → Word docs    │    │
│  │  ast module → Python code   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  LangGraph Analysis Agent   │    │
│  │  triage → deep_analyze →    │    │
│  │  cross_ref → synthesize →   │    │
│  │  build_graph → gen_gaps     │    │
│  └─────────────────────────────┘    │
│                                     │
│  LLM: OpenAI GPT-5.3 (primary)     │
│  Fallback: Claude Sonnet 4          │
└─────────────────────────────────────┘

Frontend Visualization:
  react-force-graph → interactive knowledge graph
```

**Why Python:** Real `.xlsx` files need `openpyxl` for formula DAG extraction. Real `.docx` files need `python-docx`. LangGraph Python is more mature. This signals technical depth to judges.

**Why react-force-graph:** Most common React graph viz library. Give it `{ nodes, links }` → instant interactive force-directed graph. Supports 2D/3D. Minimal config.

---

## Demo Scenario: XCorp M&A Deal

7 real files in `data/` representing an M&A due diligence package:

| File | Type | Key Gap Signals |
|------|------|----------------|
| `XCorp_Valuation_v2.xlsx` | Excel | 12% churn vs 5% target. 87% revenue accuracy. "Potential Hidden Risk" column with undocumented dependencies. Employee turnover 25% vs 10% target — "Process knowledge concentrated in remaining staff." |
| `Past_Deals_v2.xlsx` | Excel | 6 historical deals showing patterns: "Shadow reporting spreadsheets", "Manual reconciliations in billing", "Undocumented fraud review workflows". Lessons learned column reveals recurring failures. |
| `Integration_Risk_Log_v2.xlsx` | Excel | 6 risks with "Undocumented Knowledge Dependency" column: "Only known by customer success leads", "Finance senior analyst maintains manual process", "Ops team undocumented scripts". |
| `XCorp_DealMemo_v2.docx` | Word | "Sales forecasting uses hybrid CRM + spreadsheet model maintained by one senior analyst." Open questions: "True level of manual intervention in billing." |
| `XCorp_DealMemo.docx` | Word (v1) | Earlier version — diffing v1 vs v2 reveals what risks were ADDED in revision (shows escalating concern). |
| `Ops_Workflows_v2.docx` | Word | "QA validation includes manual data spot checks not documented in SOPs." "Exception clients require manual billing overrides." Dependencies: "Knowledge of legacy customer data schemas." |
| `IntegrationMeeting_Notes_v2.txt` | Text | "Ops team relies heavily on undocumented data correction workflows." Unresolved: "Which manual workflows are business critical vs convenience shortcuts?" |

**Cross-references the agent MUST find:**
1. **Churn crisis cluster**: Valuation shows 12% churn → Risk Log says "only known by CS leads" → Meeting Notes asks "which workflows are critical?" → Past Deals shows YCorp failed due to similar pattern
2. **Manual process cluster**: Valuation shows 87% revenue accuracy → Risk Log says "Finance analyst maintains manual process" → Ops Workflows details the manual reconciliation scripts → Meeting Notes confirms "monthly manual revenue reconciliation"
3. **Knowledge concentration**: Valuation shows 25% ops turnover → Risk Log says "undocumented scripts" → Ops Workflows says "loss of key ops personnel may delay by 2-3 weeks" → DealMemo v2 ADDED this as a new risk (wasn't in v1)
4. **ERP migration**: Valuation shows 6/10 integration readiness → Risk Log says "ERP migration logic known by small engineering group" → Meeting Notes says "35% still on legacy billing" → DealMemo recommends validating data mapping

---

## Component 1: File Parsers (`backend/parsers/`)

### Excel Parser (`excel_parser.py`)
Uses `openpyxl` to extract:
- **Cell values** with headers preserved
- **Formulas** (the formula DAG — which cells reference which)
- **Comments/notes** on cells
- **Conditional formatting** (highlights risk areas)
- **Named ranges** for semantic meaning
- Output: structured dict per sheet with formula dependency graph

### Word Parser (`doc_parser.py`)
Uses `python-docx` to extract:
- **Paragraphs** with heading hierarchy
- **Bold/italic** text (often marks emphasis on risks)
- **Tables** (common in deal memos)
- **Track changes / revisions** if present
- **v1 vs v2 diff**: Compare two versions of a document to see what was added/removed

### Text Parser (`text_parser.py`)
Simple but structured:
- Section headers (lines ending with `:`)
- Bullet points and numbered items
- Person/role references
- Unresolved question blocks

### Python Parser (`python_parser.py`)
Uses `ast` module to extract:
- Function signatures, docstrings, TODOs
- Bare constants and magic numbers
- Import chains, call graphs
- Comments referencing people

---

## Component 2: LangGraph Analysis Agent (`backend/agent/`)

### State Schema (`state.py`)

```python
from typing import TypedDict, Literal
from langgraph.graph import StateGraph

class Finding(TypedDict):
    id: str
    artifact_name: str
    location: str                    # "Sheet: Valuation, Row 6" or "Section: Key Risks, para 3"
    type: Literal[
        'undocumented_dependency',   # "only known by X"
        'manual_process',            # undocumented manual workflow
        'person_reference',          # single point of failure
        'data_discrepancy',          # target vs observed mismatch
        'missing_documentation',     # vague references, TODOs
        'governance_gap',            # process not followed
        'stale_or_placeholder',      # outdated data, None values
        'cross_file_contradiction',  # files disagree
        'historical_pattern',        # past deal shows same risk
    ]
    description: str
    severity: Literal['high', 'medium', 'low']
    evidence: str                    # actual text from file
    related_artifacts: list[str]

class CrossRef(TypedDict):
    from_ref: str                    # "XCorp_Valuation_v2.xlsx:Row6"
    to_ref: str                      # "Integration_Risk_Log_v2.xlsx:Risk1"
    relationship: str                # "Both document churn spike, but risk log reveals it's known only by CS leads"

class WorkingMemory(TypedDict):
    situation_understanding: str     # "This is an M&A due diligence for XCorp..."
    key_entities: list[str]          # people, systems, processes identified
    risk_clusters: list[dict]        # groups of related findings
    cross_references: list[CrossRef]
    open_questions: list[str]        # what the agent still doesn't understand
    assumptions: list[str]           # implicit assumptions found in files
    historical_parallels: list[str]  # matches from past deals

class KnowledgeGap(TypedDict):
    id: str
    title: str
    description: str
    severity: Literal['high', 'medium', 'low']
    category: Literal['process', 'people', 'systems', 'financial', 'governance']
    finding_ids: list[str]           # contributing findings
    question: str                    # primary interview question
    follow_up_probes: list[str]      # deeper questions if answer is vague
    evidence_summary: str            # what we found across files

class AnalysisState(TypedDict):
    # Input
    artifacts: list[dict]            # parsed file contents from parsers
    raw_files: list[str]             # file paths

    # Progression
    current_phase: str
    current_artifact_idx: int
    iteration_count: int

    # Accumulated
    findings: list[Finding]
    graph_data: dict                 # { nodes: [], edges: [] }
    working_memory: WorkingMemory

    # Output
    gaps: list[KnowledgeGap]
    interview_tree: dict
    analysis_log: list[str]          # real-time status for SSE streaming
```

### Graph Topology (`graph.py`)

```
START
  │
  v
PARSE_FILES ──→ Parse all files using type-specific parsers
  │               Output: structured representations in state.artifacts
  v
TRIAGE ──────→ Quick scan of all parsed content. Build inventory.
  │               Identify highest-risk files. Set analysis order.
  v
DEEP_ANALYZE ─→ Analyze one file in depth with LLM.
  │               Extract findings. Add to knowledge graph.
  │               Loop until all files done.
  ├── more files → DEEP_ANALYZE
  │
  v
CROSS_REFERENCE → Find patterns across ALL findings.
  │                 Cluster related findings. Find contradictions.
  │                 Compare with past deals. Update graph edges.
  v
SYNTHESIZE ────→ Build working memory. Assess coverage.
  │               Decide: enough understanding, or re-analyze?
  ├── need more (max 2x) → DEEP_ANALYZE with refined prompts
  │
  v
GENERATE_GAPS ─→ Convert finding clusters into KnowledgeGap objects.
  │                Build adaptive interview tree.
  │                Rank by severity. Produce summary.
  v
END
```

### Node Functions (`nodes.py`)

**`parse_files`**: No LLM needed. Runs the parsers on each file. For Excel: extracts all sheets, formulas, comments. For Word: extracts text with structure. For the v1/v2 deal memo: produces a diff. Stores structured content in `state.artifacts`.

**`triage`**: Single LLM call with summaries of all parsed files. Produces:
- File inventory with risk assessment per file
- Analysis priority order
- Initial `situation_understanding` (e.g., "M&A due diligence for XCorp, a SaaS company")
- Logs status for SSE.

**`deep_analyze`**: One file at a time. Sends full parsed content with type-specific prompt:
- **Excel**: "Look for discrepancies between target and observed values. Find columns that reference undocumented knowledge. Identify cells with manual overrides or missing data."
- **Word/Text**: "Find references to specific people as knowledge holders. Find vague references ('see X', 'undocumented'). Find open questions. Compare v1 vs v2 to see what risks escalated."
- Returns structured `Finding[]` via JSON structured output.
- Adds nodes/edges to knowledge graph per file.

**`cross_reference`**: The **most important node** — this creates the "how did it know?" moment. Receives all findings grouped by file. LLM prompt:
- "Which findings from different files describe the SAME underlying risk?"
- "Where does one file reference something documented (or undocumented) in another?"
- "Do any files contradict each other?"
- "Do any current risks match patterns from past deals?"
- Outputs `CrossRef[]` and adds cross-file edges to knowledge graph.

**`synthesize`**: Reviews everything. Builds risk clusters (groups of related findings). Updates `working_memory`. If `open_questions` > 3 and `iteration_count` < 2, loops back with targeted re-analysis prompts.

**`generate_gaps`**: Converts risk clusters into `KnowledgeGap` objects. Each gap gets:
- A primary question citing specific evidence across files
- Follow-up probes for vague answers
- A severity ranking
- A category (process/people/systems/financial/governance)

Builds the adaptive interview tree (see Component 4).

---


## Component 3: Adaptive Interview Engine (`backend/interview/interview_engine.py`)

NOT a static question list. A tree that branches based on answer quality.

```python
class InterviewNode:
    gap_id: str
    question: str
    evidence_ref: str              # "In the Valuation spreadsheet, churn is 12% vs 5% target..."
    probes: list[str]              # follow-ups if answer is vague
    coverage_target: str           # what knowledge this should capture

class InterviewTree:
    nodes: dict[str, InterviewNode]
    root_id: str
    current_id: str
```

**POST `/interview/next`** logic:
1. Receives: current node ID + employee's answer text
2. LLM evaluates answer quality:
   - **Vague** ("yeah we've been looking into that") → probe with specific evidence
   - **Specific** ("the churn is from our Q1 enterprise cohort losing 3 key accounts") → mark captured, move to related gap
   - **Contradicts files** ("our churn is actually fine") → cite the specific data showing otherwise
   - **Reveals new info** ("actually there's also a problem with...") → add new branch
3. Returns: next question + reasoning for why it chose that branch

---

## Files to Create

```
backend/
├── requirements.txt
├── main.py                          # FastAPI app
├── parsers/
│   ├── __init__.py
│   ├── excel_parser.py              # openpyxl formula + value extraction
│   ├── doc_parser.py                # python-docx structured extraction
│   ├── text_parser.py               # plain text parsing
│   └── python_parser.py             # AST-based code analysis
├── agent/
│   ├── __init__.py
│   ├── state.py                     # LangGraph state schema
│   ├── graph.py                     # StateGraph definition + edges
│   ├── nodes.py                     # All node functions
│   └── prompts.py                   # System prompts per phase
├── interview/
│   ├── __init__.py
│   └── interview_engine.py          # Adaptive interview tree
└── models.py                        # Pydantic shared models
```

```
# Existing files to modify
src/app/api/analyze/route.ts          # Proxy to Python backend
src/types/api.ts                      # Add new types
```

**Python dependencies (`requirements.txt`):**
```
fastapi
uvicorn
openpyxl
python-docx
langgraph
langchain-openai
langchain-anthropic
pydantic
```

**NPM dependency to add:**
```
react-force-graph
```

---

## Implementation Order

### Step 1: Python backend scaffold + parsers
- Create `backend/` directory structure
- Set up FastAPI with a health check endpoint
- Implement Excel parser (openpyxl — extract all sheets, values, formulas, comments)
- Implement Word parser (python-docx — paragraphs, headings, tables)
- Implement text parser
- **Test**: Parse all 7 XCorp files, print structured output

### Step 2: Agent state + triage + deep_analyze nodes
- Define LangGraph state schema
- Implement `parse_files` node (calls parsers)
- Implement `triage` node (single LLM call, structured output)
- Implement `deep_analyze` node with file-type-specific prompts
- **Test**: Run triage + deep_analyze on XCorp files, verify findings are meaningful

### Step 3: Cross-reference + synthesize nodes
- Implement `cross_reference` node (the critical one)
- Implement `synthesize` node with loop-back conditional
- Wire all nodes into LangGraph StateGraph with conditional edges
- **Test**: Full agent run against XCorp files. Verify it finds the 4 cross-reference clusters listed above.


### Step 4: Frontend integration
- Add react-force-graph component for knowledge graph visualization
- Wire `/api/analyze` to proxy to Python service
- Add SSE streaming for real-time analysis progress on screening page
- Wire conversation page to use adaptive interview engine

### Step 5: Polish + demo prep
- End-to-end test of full flow
- `DEMO_MODE` fallback to mock data if agent fails
- Performance tuning (target: <60s for full analysis)
- Demo rehearsal

---

## LLM Configuration

```python
# backend/agent/llm.py
import os
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

def get_llm():
    if os.getenv("OPENAI_API_KEY"):
        return ChatOpenAI(model="gpt-5.3", temperature=0)
    return ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0)
```

Primary: OpenAI GPT-5.3 ($2500 credit). Fallback: Claude Sonnet 4 (already integrated in frontend).

---

## Verification

1. **Parser test**: Each parser extracts meaningful structured data from its file type
2. **Agent test**: Full LangGraph run finds the 4 cross-reference clusters from the XCorp files
3. **Interview test**: Adaptive branching works — vague answer triggers probe, specific answer moves forward
4. **Performance**: Full analysis completes in <60 seconds
5. **Fallback**: `DEMO_MODE=mock` returns hardcoded data so demo always works
6. **Integration**: Frontend screening page shows real-time progress, conversation page uses real questions

---

## Key Demo Moments

1. **"How did it know to ask that?"** — Agent finds that churn spike (Valuation) + "only known by CS leads" (Risk Log) + unresolved question (Meeting Notes) + YCorp failure pattern (Past Deals) are all ONE cluster, and asks: "The 12% churn spike appears in your valuation, your risk log attributes root cause knowledge solely to CS leads, and a previous deal (YCorp) failed from similar undiagnosed churn. Can you walk us through what your CS team has identified as the actual driver?"

2. **Document version diff** — Agent notices DealMemo v2 ADDED "knowledge concentration risk" that wasn't in v1, and asks: "Between v1 and v2 of the deal memo, your team added operational fragility as a new concern. What specific events between those drafts triggered this escalation?"

3. **Contradiction detection** — Valuation says "Integration Readiness: 6/10" but Ops Workflows describes multiple undocumented exception paths. Agent asks: "Your readiness score assumes standardized onboarding, but your ops documentation reveals at least 3 manual exception workflows. Has the readiness score been adjusted for these?"

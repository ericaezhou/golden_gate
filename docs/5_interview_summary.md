# Interview Summary & Onboarding Package (Step 5)

After the interview completes, all accumulated knowledge — deep dive analysis, interview facts, and answered questions — is synthesized into the final deliverables. Two nodes run in parallel: one generates the onboarding package (the document a new hire reads), the other assembles the QA agent's knowledge base.

## Pipeline Position

```
File Upload → Parsing → Deep Dives → Question Generation → Interview → Summary (this doc)
```

| Node | What it does |
|------|--------------|
| `generate_onboarding_package` | LLM remix of deep dives + interview → structured onboarding document |
| `build_qa_context` | Pure code assembly of deep dives + interview → QA agent system prompt |

These two nodes run **in parallel** after the interview loop completes (both have an edge from `interview_loop` in the graph).

**Source files:**
- `backend/nodes/generate_package.py`
- `backend/nodes/build_qa_context.py`

## Architecture

```
interview_loop completes
    ├── extracted_facts (list of strings)
    ├── interview_summary (LLM-synthesized narrative)
    ├── question_backlog (with ANSWERED_BY_INTERVIEW statuses)
    ├── deep_dive_corpus (from earlier)
    └── global_summary (from earlier)
            ↓ (parallel fan-out)
    ┌───────────────────────┐   ┌───────────────────────┐
    │ generate_onboarding   │   │ build_qa_context      │
    │ _package              │   │                       │
    │                       │   │                       │
    │ LLM Call 1:           │   │ Pure code:            │
    │   extracted_facts     │   │   deep_dive_corpus    │
    │   + answered Qs       │   │   + interview_summary │
    │   → knowledge entries │   │   + extracted_facts   │
    │                       │   │   + answered Qs       │
    │ LLM Call 2:           │   │   → qa_system_prompt  │
    │   corpus + summary    │   │     (plain text file)  │
    │   + knowledge entries │   │                       │
    │   + FAQ from Qs       │   │                       │
    │   → onboarding doc    │   │                       │
    └───────────────────────┘   └───────────────────────┘
            ↓                           ↓
    onboarding_package          qa_system_prompt.txt
    (JSON + markdown)           (QA agent context)
            ↓                           ↓
          END                         END
```

## Generate Onboarding Package

**Source file:** `backend/nodes/generate_package.py`

Two LLM calls that transform raw materials into a polished onboarding document.

### LLM Call 1: Build Knowledge Entries (5a)

**Prompt:** `KNOWLEDGE_ENTRIES_SYSTEM`
**Service:** `call_llm_json()`

Takes the `extracted_facts` from the interview + answered questions from the backlog and categorizes each piece of knowledge.

**Input:**
- `extracted_facts` — flat list of strings from all interview rounds
- Answered questions — filtered from `question_backlog` where `status=ANSWERED_BY_INTERVIEW`

**Returns:**
```json
{
  "knowledge_entries": [
    {
      "category": "<one of 5 categories>",
      "title": "<short descriptive title>",
      "detail": "<full explanation>",
      "source_files": ["file_id_1", "file_id_2"]
    }
  ]
}
```

**Knowledge categories:**

| Category | What it captures |
|----------|-----------------|
| `decision_rationale` | Why a specific approach, threshold, or design was chosen |
| `manual_override_rule` | Steps that require human intervention or judgment |
| `workflow_step` | Processes, sequences, or recurring tasks |
| `gotcha_or_failure_mode` | Known issues, edge cases, things that break |
| `stakeholder_constraint` | People, teams, or organizational factors that affect the work |

### LLM Call 2: Generate Onboarding Document (5b)

**Prompt:** `ONBOARDING_DOC_SYSTEM`
**Service:** `call_llm_json()`

Synthesizes ALL materials into a coherent, actionable onboarding document. This is an **LLM-processed remix** — not a simple concatenation.

**Input:**
- `global_summary` — project-wide narrative
- `deep_dive_corpus` — per-file analysis text
- Knowledge entries from Call 1
- FAQ built from answered questions

**Returns:**
```json
{
  "abstract": "<2-3 sentences: what this project does>",
  "introduction": "<business context, stakeholders, why it exists>",
  "details": "<file-by-file guide, enriched with interview insights>",
  "faq": [{"q": "<question>", "a": "<answer>"}],
  "risks_and_gotchas": ["<risk or gotcha string>"]
}
```

**Sections:**

| Section | Content | Length |
|---------|---------|--------|
| Abstract | What this project does | 2-3 sentences |
| Introduction | Business context, stakeholders, why it exists | 1-2 paragraphs |
| Details | File-by-file guide: what each file does, how to use it, key dependencies | Multi-paragraph |
| FAQ | Top 5-8 questions a new person would ask, with answers | 5-8 Q&A pairs |
| Risks & Gotchas | Error-prone items, manual steps, known issues | Bullet list |

### Assembly & Persistence

The two LLM results are combined into an `OnboardingPackage` model:

```python
package = OnboardingPackage(
    abstract=doc_result["abstract"],
    introduction=doc_result["introduction"],
    details=doc_result["details"],
    faq=doc_result["faq"],
    risks_and_gotchas=doc_result["risks_and_gotchas"],
    knowledge_entries=knowledge_entries,  # from Call 1
)
```

Persisted in two formats:
- `onboarding_package/package.json` — structured JSON (machine-readable)
- `onboarding_package/onboarding_docs.md` — readable markdown (human-readable)

The markdown is generated by `_package_to_markdown()` in the same file.

### State Reads & Writes

**Reads:**
| Key | Type | Used for |
|-----|------|----------|
| `session_id` | `str` | Persistence |
| `deep_dive_corpus` | `str` | Onboarding doc generation (Call 2) |
| `global_summary` | `str` | Onboarding doc generation (Call 2) |
| `question_backlog` | `list[Question]` | Answered questions for FAQ + knowledge entries |
| `extracted_facts` | `list[str]` | Knowledge entry generation (Call 1) |

**Writes:**
| Key | Type | Description |
|-----|------|-------------|
| `onboarding_package` | `OnboardingPackage` | Full structured package |
| `status` | `str` | `"package_generated"` |
| `current_step` | `str` | `"generate_onboarding_package"` |

## Build QA Context

**Source file:** `backend/nodes/build_qa_context.py`

Pure code (no LLM calls). Assembles the plain-text knowledge base used as the QA agent's system prompt during onboarding.

**Logic:**
1. Combine `deep_dive_corpus` + `interview_summary` + `extracted_facts` + answered questions
2. Format as a single `.txt` file with clear section headers
3. Persist as `qa_system_prompt.txt`

**Output format:**
```
=== PROJECT KNOWLEDGE BASE ===

== FILE ANALYSIS (Deep Dives) ==
{deep_dive_corpus}

== INTERVIEW SUMMARY ==
{interview_summary}

== EXTRACTED FACTS ==
{extracted_facts, one per line}

== ANSWERED QUESTIONS ==
{questions with status answered_by_interview, with their answers}
```

### State Reads & Writes

**Reads:**
| Key | Type | Used for |
|-----|------|----------|
| `session_id` | `str` | Persistence |
| `deep_dive_corpus` | `str` | File analysis section |
| `interview_summary` | `str` | Interview narrative section |
| `extracted_facts` | `list[str]` | Structured facts section |
| `question_backlog` | `list[Question]` | Answered questions section |

**Writes:**
| Key | Type | Description |
|-----|------|-------------|
| `qa_system_prompt` | `str` | Combined knowledge base text |
| `status` | `str` | `"qa_context_built"` |
| `current_step` | `str` | `"build_qa_context"` |

## Data Models

### OnboardingPackage

The final deliverable. Defined in `backend/models/artifacts.py`.

```python
class OnboardingPackage(BaseModel):
    abstract: str
    introduction: str
    details: str                          # File-by-file guide
    faq: list[dict]                       # [{"q": "...", "a": "..."}]
    risks_and_gotchas: list[str]
    knowledge_entries: list[dict]         # Categorized knowledge from interview
```

### Key Input: interview_summary

The `interview_summary` is an **LLM-synthesized narrative** produced at the end of the interview loop — organized by topic, not chronologically. It covers:
1. Key decisions and their rationale
2. Undocumented rules, heuristics, and manual processes
3. Critical dependencies and stakeholder relationships
4. Risks, gotchas, and failure modes
5. Historical context

This is distinct from `extracted_facts` (a flat list of individual fact strings) and `interview_transcript` (the raw Q&A turns).

## Storage

```
data/sessions/{session_id}/
├── onboarding_package/
│   ├── package.json             # OnboardingPackage as JSON
│   └── onboarding_docs.md      # Human-readable markdown document
├── qa_system_prompt.txt         # Combined knowledge base for QA agent
├── deep_dive_corpus.txt         # Deep dives as plain text (also persisted by build_qa_context)
└── interview/
    └── interview_summary.txt    # Interview narrative (also persisted by build_qa_context)
```

## What Happens Next

After both nodes complete, the offboarding phase is done. The outputs feed the **onboarding phase**:

- `onboarding_package` → `generate_narrative` node (guided reading experience for new hire)
- `qa_system_prompt` → `qa_loop` node (QA agent uses this as its system prompt to answer new hire questions)
- Knowledge graph is generated **on-demand** during onboarding (not part of offboarding pipeline)

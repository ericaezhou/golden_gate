# Node Interface Documentation

Technical reference for teammate integration. Covers the nodes implemented so far and how they connect through `OffboardingState`.

---

## Pipeline Flow

```
parse_files → fan-out deep_dives → concatenate → global_summarize → reconcile_questions → interview_loop → [generate_onboarding_package + build_qa_context] → END
```

---

## `global_summarize` (backend/nodes/global_summarize.py)

**Purpose:** Cross-file reasoning — finds knowledge gaps that only emerge when looking across multiple files together (assumption mismatches, workflow dependencies, missing context).

### State reads
| Key | Type | Description |
|-----|------|-------------|
| `session_id` | `str` | Session identifier |
| `deep_dive_corpus` | `str` | Concatenated per-file deep-dive text (from `concatenate_deep_dives`) |
| `structured_files` | `list[StructuredFile]` | Parsed file metadata (used for file names/count) |
| `question_backlog` | `list[Question]` | Existing Q1 questions from deep dives |

### State writes
| Key | Type | Description |
|-----|------|-------------|
| `global_summary` | `str` | Project-wide narrative covering holistic state |
| `question_backlog` | `list[Question]` | **Replaces** with `existing_backlog + new_Q2_questions` |
| `status` | `str` | Set to `"summarized"` |
| `current_step` | `str` | Set to `"global_summarize"` |

### Key behavior
- Generates Q2 questions with `origin=QuestionOrigin.GLOBAL` (distinct from Q1's `QuestionOrigin.DEEP_DIVE`)
- Each Q2 question has: `question_id` (prefixed `"global-"`), `question_text`, `priority` (P0/P1/P2), `evidence` list, `status=OPEN`
- **Does NOT merge or deduplicate** — just appends Q2 to existing Q1 backlog. Deduplication is handled downstream by `reconcile_questions`.
- `question_backlog` has **no reducer** in state, so the returned list fully replaces the previous value.
- Persists `global_summary.json` via `SessionStorage`

### LLM call
- Single call to `call_llm_json()` returning `{"global_summary": str, "questions": [...]}`

---

## `reconcile_questions` (backend/nodes/reconcile_questions.py)

**Purpose:** Deduplicate, auto-resolve, and reprioritize the combined Q1+Q2 question backlog before interview.

### State reads
| Key | Type | Description |
|-----|------|-------------|
| `session_id` | `str` | Session identifier |
| `question_backlog` | `list[Question]` | Combined Q1+Q2 from `global_summarize` |
| `deep_dive_corpus` | `str` | Evidence for auto-answering |
| `global_summary` | `str` | Evidence for auto-answering |

### State writes
| Key | Type | Description |
|-----|------|-------------|
| `question_backlog` | `list[Question]` | Cleaned, reconciled list |
| `status` | `str` | Set to `"questions_ready"` |
| `current_step` | `str` | Set to `"reconcile_questions"` |

### Key behavior
- LLM decides for each question: **keep** (with priority), **merge** (mark as `MERGED`), or **answer** (mark as `ANSWERED_BY_FILES` with answer text)
- Caps open questions at `settings.MAX_OPEN_QUESTIONS`, deprioritized extras get `DEPRIORITIZED` status
- Persists `question_backlog.json`

---

## `generate_onboarding_package` (backend/nodes/generate_package.py)

**Purpose:** Turn all accumulated knowledge (deep dives + interview results) into the final onboarding deliverable.

### State reads
| Key | Type | Description |
|-----|------|-------------|
| `session_id` | `str` | Session identifier |
| `deep_dive_corpus` | `str` | Concatenated per-file analysis |
| `global_summary` | `str` | Cross-file narrative |
| `question_backlog` | `list[Question]` | Questions with answers (status `ANSWERED_BY_INTERVIEW`) |
| `extracted_facts` | `list[str]` | Flat list of facts from interview |

### State writes
| Key | Type | Description |
|-----|------|-------------|
| `onboarding_package` | `OnboardingPackage` | Full structured package |
| `status` | `str` | Set to `"package_generated"` |
| `current_step` | `str` | Set to `"generate_onboarding_package"` |

### Key behavior
- **LLM Call 1 (5a):** Builds knowledge entries from `extracted_facts` + answered questions. Each entry is categorized as one of: `decision_rationale`, `manual_override_rule`, `workflow_step`, `gotcha_or_failure_mode`, `stakeholder_constraint`.
- **LLM Call 2 (5b):** Generates the 5-section onboarding document using global summary + corpus + knowledge entries + FAQ from answered questions. Sections: Abstract, Introduction, Details, FAQ, Risks & Gotchas.
- Persists both `onboarding_package/package.json` (structured) and `onboarding_package/onboarding_docs.md` (readable markdown)

---

## Interface Contract: `global_summarize` → `reconcile_questions`

The handoff is clean:

1. **`question_backlog`**: `global_summarize` outputs a `list[Question]` containing both Q1 (existing, origin=`DEEP_DIVE`) and Q2 (new, origin=`GLOBAL`). `reconcile_questions` reads the same `list[Question]` — no transformation needed.

2. **Question object fields used by reconcile:**
   - `question_id` — used as lookup key for LLM decisions
   - `question_text` — displayed to LLM
   - `origin.value` — displayed to LLM (informational)
   - `priority.value` — displayed to LLM, may be updated
   - `status` — updated based on LLM action (MERGED, ANSWERED_BY_FILES, OPEN)
   - `answer` — populated if auto-answered

3. **`deep_dive_corpus`** and **`global_summary`**: Both passed through unchanged from prior nodes. `reconcile_questions` uses them as evidence context for the LLM.

4. **No reducer conflicts**: `question_backlog` has no reducer — both nodes return the full replacement list.

---

## `interview_loop` (backend/nodes/interview.py)

**Purpose:** Interactive, human-in-the-loop interview that maximizes knowledge extraction through warm, project-aware conversation. The interviewer references specific files/formulas/thresholds from deep dive analysis, remembers and builds on every previous answer, and discovers new knowledge gaps in real time.

### State reads
| Key | Type | Description |
|-----|------|-------------|
| `session_id` | `str` | Session identifier |
| `question_backlog` | `list[Question]` | Reconciled questions (status=OPEN, P0/P1) |
| `deep_dive_corpus` | `str` | Used as project context in question rephrasing |
| `global_summary` | `str` | Used as project context in question rephrasing |
| `interview_transcript` | `list[InterviewTurn]` | Existing transcript (for resume) |
| `extracted_facts` | `list[str]` | Existing facts (for resume) |

### State writes
| Key | Type | Description |
|-----|------|-------------|
| `interview_transcript` | `list[InterviewTurn]` | Full transcript of all turns |
| `extracted_facts` | `list[str]` | All extracted facts (has `_append_list` reducer) |
| `interview_summary` | `str` | LLM-synthesized narrative summary (by topic, not chronological) |
| `question_backlog` | `list[Question]` | Updated with `ANSWERED_BY_INTERVIEW` statuses + new follow-ups/discovered Qs |
| `status` | `str` | Set to `"interview_complete"` |
| `current_step` | `str` | Set to `"interview_loop"` |

### LLM calls per round (3 calls)
1. **Select question** (`call_llm_json`): Picks the best next question considering priority AND conversational flow (topical continuity with last answer). Returns `{"selected_question_id": "..."}`.
2. **Rephrase question** (`call_llm`): Rewrites the raw analytical question conversationally with project context (references specific files, thresholds) and conversation memory (acknowledges previous answer). Returns plain text.
3. **Extract facts** (`call_llm_json`): Extracts structured facts, assesses confidence (high/medium/low → 0.9/0.6/0.3), generates follow-up for low/medium confidence, and discovers NEW questions revealed by the answer. Returns `{"facts": [...], "confidence": "...", "follow_up": "...", "discovered_questions": [...]}`.

### End-of-interview LLM call
4. **Generate summary** (`call_llm`): Synthesizes the full transcript into a topical narrative summary (not a chronological Q&A dump). Organized by: decisions & rationale, undocumented rules, dependencies, risks, historical context.

### Dynamic question management
- **Follow-ups**: Added when confidence is "low" or "medium". Origin=`FOLLOW_UP`, priority=`P0`, inserted into backlog for immediate asking.
- **Discovered questions**: When an answer reveals NEW knowledge gaps (mentions unknown people, systems, processes), new questions are added to the backlog with origin=`FOLLOW_UP`.
- Question IDs: follow-ups prefixed `"followup-"`, discovered prefixed `"discovered-"`.

### Termination conditions
1. No open P0/P1 questions remain
2. `rounds >= settings.MAX_INTERVIEW_ROUNDS` (default 10)
3. User explicitly ends via `/api/interview/{session_id}/end`

### Interrupt payload (sent to frontend)
```json
{
  "question_id": "global-abc123",
  "question_text": "Thanks for explaining that — I noticed in your model that...",
  "round": 3,
  "remaining": 5
}
```

### Persistence (after every turn)
- `interview/transcript.json` — full transcript
- `interview/extracted_facts.json` — all facts
- `question_backlog.json` — updated backlog
- `interview/interview_summary.txt` — final summary (end of interview only)

---

## Interface Contract: `reconcile_questions` → `interview_loop`

- `reconcile_questions` outputs `question_backlog` with status `"questions_ready"`
- `interview_loop` reads `question_backlog` and filters for `status=OPEN` + priority `P0`/`P1`
- Also reads `deep_dive_corpus` and `global_summary` for project-aware question rephrasing
- After interview, questions are updated to `status=ANSWERED_BY_INTERVIEW` with `answer` and `confidence` populated
- New questions may be added to backlog (follow-ups + discovered) with `origin=FOLLOW_UP`

## Interface Contract: `interview_loop` → `generate_onboarding_package`

- `generate_onboarding_package` reads `extracted_facts` (list of strings, accumulated via `_append_list` reducer)
- It reads `question_backlog` and filters for `status=ANSWERED_BY_INTERVIEW` to build FAQ content
- It reads `interview_summary` (LLM-synthesized narrative) — available for richer onboarding doc generation
- It does NOT read `interview_transcript` directly

## Interface Contract: `interview_loop` → `build_qa_context`

- `build_qa_context` reads `interview_summary` (the LLM-synthesized narrative, not raw transcript)
- It reads `extracted_facts` for the structured facts section
- It reads `question_backlog` for answered questions with their answers

---

## State Reducer Notes

| Field | Reducer | Behavior |
|-------|---------|----------|
| `deep_dive_reports` | `_append_list` | Appends new items |
| `extracted_facts` | `_append_list` | Appends new items |
| `errors` | `_append_list` | Appends new items |
| `question_backlog` | **None** | Full replacement on write |
| `onboarding_package` | **None** | Full replacement on write |
| All other fields | **None** | Full replacement on write |

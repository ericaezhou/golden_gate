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

## Interface Contract: `reconcile_questions` → `interview_loop`

- `reconcile_questions` outputs `question_backlog` with status `"questions_ready"`
- `interview_loop` should read `question_backlog` and filter for `status=OPEN` questions to ask the departing employee
- After interview, questions should be updated to `status=ANSWERED_BY_INTERVIEW` with `answer` populated

## Interface Contract: `interview_loop` → `generate_onboarding_package`

- `generate_onboarding_package` reads `extracted_facts` (list of strings, accumulated via `_append_list` reducer)
- It reads `question_backlog` and filters for `status=ANSWERED_BY_INTERVIEW` to build FAQ content
- It does NOT read `interview_transcript` directly (only uses `extracted_facts` and answered questions)

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

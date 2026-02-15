# Interview Loop (Step 4)

The interview loop is a warm, context-aware conversational experience that maximizes knowledge extraction from the departing employee. The interviewer deeply understands the project (referencing specific files, formulas, thresholds from the deep dive analysis), remembers and builds on every previous answer, and discovers new knowledge gaps in real time.

## Pipeline Position

```
File Upload → Parsing → Deep Dives → Question Generation → Interview (this doc) → Summary
```

| Node | What it does |
|------|--------------|
| `interview_loop` | Human-in-the-loop bounded interview — LLM asks questions, user answers via chat UI |

**Source file:** `backend/nodes/interview.py`

## Architecture

```
question_backlog (reconciled, P0/P1 open)
    ↓
┌── interview_loop (bounded: max 10 rounds) ──────────────────────┐
│                                                                  │
│   ┌─ LLM Call 1: Select best next question for flow ──┐         │
│   │  Considers priority + topical continuity +         │         │
│   │  follow-up urgency from last answer                │         │
│   └────────────────────────────────────────────────────┘         │
│       ↓                                                          │
│   ┌─ LLM Call 2: Rephrase conversationally ───────────┐         │
│   │  Project context (files, formulas, thresholds)     │         │
│   │  + full conversation memory                        │         │
│   │  + warm acknowledgment of previous answer          │         │
│   └────────────────────────────────────────────────────┘         │
│       ↓                                                          │
│   interrupt() → wait for user response via frontend              │
│       ↓                                                          │
│   ┌─ LLM Call 3: Extract facts + assess + discover ───┐         │
│   │  Structured facts from the answer                  │         │
│   │  Confidence assessment (high/medium/low)           │         │
│   │  Follow-up question if incomplete                  │         │
│   │  Newly discovered questions from the answer        │         │
│   └────────────────────────────────────────────────────┘         │
│       ↓                                                          │
│   Update question status, persist, check termination             │
│       ↓                                                          │
│   (loop back or exit)                                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
    ↓
interview_transcript + extracted_facts + question_backlog → Summary
```

## Conversational Design

The interview is designed to feel like a conversation with a knowledgeable senior colleague, not a chatbot survey. Key design choices:

### Project-Aware Questions
The LLM receives `deep_dive_corpus` and `global_summary` as project context. This allows it to reference specific files, formulas, thresholds, and code it found during analysis. The employee feels like they're talking to someone who already understands their work.

### Conversation Memory
The full conversation transcript is passed to the LLM every round. This enables:
- Substantive acknowledgment of previous answers (not generic "Great answer!")
- Natural topic transitions ("Building on what you said about the threshold...")
- Avoiding redundant questions

### Smart Question Selection
Instead of mechanically asking P0 questions in order, the LLM picks the best next question considering:
1. Priority (P0 before P1)
2. Topical continuity with the last answer
3. Follow-up urgency (questions from vague answers are asked immediately)

### Adaptive Follow-ups
When an answer is vague or incomplete (confidence "low" or "medium"), the system generates a warm follow-up question and inserts it into the backlog for immediate asking. Follow-ups try a different angle rather than repeating the question.

### Real-Time Knowledge Discovery
When an answer reveals something unexpected — a person, system, process, or decision the analysis didn't know about — the system generates new questions on the fly and adds them to the backlog.

## LLM Calls Per Round

### Call 1: Select Question

**Prompt:** `SELECT_QUESTION_SYSTEM`
**Service:** `call_llm_json()`
**Returns:** `{"selected_question_id": "<id>"}`

Given the open question list and recent conversation context, picks the best next question. Falls back to the highest-priority question if the LLM call fails.

Skipped when only 1 open question remains (no selection needed).

### Call 2: Rephrase Question

**Prompt:** `REPHRASE_SYSTEM`
**Service:** `call_llm()`
**Returns:** Plain text message (2-4 sentences)

Receives:
- Project context (truncated `global_summary` + `deep_dive_corpus`)
- Full conversation history (all previous Q&A turns)
- The raw analytical question to rephrase
- How many questions remain

The rephrased question is what the user sees in the chat UI. It should:
- Acknowledge the previous answer with a specific reference
- Transition smoothly to the next topic
- Reference specific project artifacts (files, formulas, thresholds)
- Sound like a thoughtful senior colleague

First question opens with a warm greeting and mention that the interviewer has reviewed the files.

### Call 3: Extract Facts

**Prompt:** `EXTRACT_FACTS_SYSTEM`
**Service:** `call_llm_json()`
**Returns:**
```json
{
  "facts": ["<concrete fact 1>", "<concrete fact 2>"],
  "confidence": "high" | "medium" | "low",
  "follow_up": "<follow-up question or null>",
  "discovered_questions": [
    {"text": "<new question>", "priority": "P0" | "P1"}
  ]
}
```

**Fact extraction guidelines:**
- Each fact must stand alone — include enough context to be understood without the question
- Capture: decisions and WHY, specific numbers and their origin, rules/heuristics, workflow steps, key people, dependencies, manual overrides, gotchas, stakeholder constraints
- Extract the underlying rule from anecdotes, not just the story

**Confidence mapping:**
| LLM output | Numeric value | Follow-up? |
|-----------|---------------|------------|
| `"high"` | 0.9 | No |
| `"medium"` | 0.6 | Yes — gently probe the gap |
| `"low"` | 0.3 | Yes — try a different angle |

### End-of-Interview: Generate Summary

**Prompt:** `SUMMARY_SYSTEM`
**Service:** `call_llm()`
**Returns:** Plain text narrative summary

After all rounds complete, the full transcript is sent to the LLM to produce a synthesized summary organized by topic (not chronologically):
1. Key decisions and their rationale
2. Undocumented rules, heuristics, and manual processes
3. Critical dependencies and stakeholder relationships
4. Risks, gotchas, and failure modes
5. Historical context that explains current state

Falls back to a plain-text Q&A format if the LLM call fails.

## Termination Conditions

The interview loop exits when ANY of these is true:

1. **No open P0/P1 questions remain** — all critical questions have been answered (or followed up and answered)
2. **Round cap reached** — `settings.MAX_INTERVIEW_ROUNDS` (default: 10) rounds completed
3. **User explicitly ends** — via `POST /api/interview/{session_id}/end` from the frontend

## Dynamic Question Management

### Follow-Up Questions

When confidence is "low" or "medium", a follow-up question is added to the backlog:
- `origin=FOLLOW_UP`
- `priority=P0` (asked immediately — it continues the current topic)
- `question_id` prefixed with `"followup-"`
- The question selection LLM is instructed to prioritize follow-ups right after their parent

### Discovered Questions

When an answer mentions something unexpected (a person, system, decision not in the original analysis), new questions are generated:
- `origin=FOLLOW_UP`
- `priority` set by the extraction LLM (P0 or P1)
- `question_id` prefixed with `"discovered-"`

Both types are appended to the live backlog and become eligible for selection in subsequent rounds.

## Interrupt & Resume (Human-in-the-Loop)

The interview uses LangGraph's `interrupt()` to pause execution and wait for user input.

### Interrupt Payload (sent to frontend)

```json
{
  "question_id": "global-a1b2c3d4",
  "question_text": "Thanks for walking me through that — I noticed in your model that the loss threshold is hardcoded at 0.3. Can you tell me where that number came from?",
  "round": 3,
  "remaining": 5
}
```

### Resume Flow

1. Frontend displays `question_text` in the chat UI
2. User types their answer
3. Frontend sends `POST /api/interview/{session_id}/respond` with `{"user_response": "..."}`
4. The route resumes the LangGraph graph, passing `user_response` back to the `interrupt()` call
5. The interview loop continues from where it paused

**Route file:** `backend/routes/interview.py` (currently stub — needs LangGraph resume wiring)

## Data Models

### InterviewTurn

One round of the interview. Defined in `backend/models/artifacts.py`.

```python
class InterviewTurn(BaseModel):
    turn_id: int                  # 1-indexed round number
    question_id: str              # ID of the question asked
    question_text: str            # The rephrased, conversational question
    user_response: str            # What the employee answered
    extracted_facts: list[str]    # Structured facts from this answer
    follow_up: str | None         # Follow-up question if needed
```

### Question (updated during interview)

After each round, the asked question is updated:
- `status` → `ANSWERED_BY_INTERVIEW`
- `answer` ← user's response text
- `confidence` ← numeric value (0.3 / 0.6 / 0.9)

## State Reads & Writes

### Reads
| Key | Type | Used for |
|-----|------|----------|
| `session_id` | `str` | Persistence |
| `question_backlog` | `list[Question]` | Source of questions to ask |
| `deep_dive_corpus` | `str` | Project context in question rephrasing |
| `global_summary` | `str` | Project context in question rephrasing |
| `interview_transcript` | `list[InterviewTurn]` | Resume from previous rounds |
| `extracted_facts` | `list[str]` | Resume from previous rounds |

### Writes
| Key | Type | Description |
|-----|------|-------------|
| `interview_transcript` | `list[InterviewTurn]` | Full transcript of all turns |
| `extracted_facts` | `list[str]` | All extracted facts (has `_append_list` reducer) |
| `interview_summary` | `str` | LLM-synthesized narrative summary |
| `question_backlog` | `list[Question]` | Updated statuses + new follow-ups/discovered Qs |
| `status` | `str` | `"interview_complete"` |
| `current_step` | `str` | `"interview_loop"` |

## Storage

Persisted after EVERY turn (crash-safe):

```
data/sessions/{session_id}/
├── interview/
│   ├── transcript.json          # Full list of InterviewTurn objects
│   ├── extracted_facts.json     # Flat list of all extracted fact strings
│   └── interview_summary.txt   # LLM-synthesized narrative (end of interview only)
└── question_backlog.json        # Updated with answered statuses + new questions
```

## LLM Configuration

| Setting | Default | Purpose |
|---------|---------|---------|
| `LLM_MODEL` | `gpt-4o` | All interview LLM calls |
| `LLM_TEMPERATURE` | `0.2` | Low for consistent extraction |
| `MAX_INTERVIEW_ROUNDS` | `10` | Hard cap on interview length |
| `MAX_FOLLOWUPS_PER_QUESTION` | `1` | Follow-ups per vague answer |

**Token estimate per round:** ~2k input + 1k output (3 calls total)

## What Happens Next

After the interview completes, two nodes run in parallel:
- [Interview Summary](5_interview_summary.md) — the `interview_summary`, `extracted_facts`, and answered questions flow into `generate_onboarding_package` and `build_qa_context`

"""Node: reconcile_questions — unify and prioritize the question backlog.

LLM-assisted step that:
1. Deduplicates / merges semantically similar questions
2. Auto-resolves questions already answered by the corpus
3. Reprioritizes remaining open questions (P0/P1/P2)
4. Caps at MAX_OPEN_QUESTIONS
"""

from __future__ import annotations

import logging

from backend.config import settings
from backend.models.questions import (
    Question,
    QuestionPriority,
    QuestionStatus,
)
from backend.models.state import OffboardingState
from backend.services.llm import call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a question backlog manager for a knowledge-transfer project. \
Your job is to clean up a raw list of questions before they go to an \
interview with the departing employee.

You will receive:
- A list of questions (each with an id, text, origin, and current priority)
- An evidence corpus (summaries of all analyzed files)
- A global summary (cross-file analysis)

For each question, do ONE of the following:

1. **KEEP** — the question is unique and unanswered. Assign a priority:
   - P0: Knowledge that will be COMPLETELY LOST (no documentation exists)
   - P1: Knowledge that is PARTIALLY documented but ambiguous
   - P2: Nice-to-have clarification

2. **MERGE** — the question is semantically a duplicate of another. \
   Pick the better-phrased version to keep, mark the other as merged.

3. **ANSWER** — the evidence corpus or global summary already contains \
   a clear answer. Provide the answer text.

Return JSON with exactly one key:

{
  "reconciled": [
    {
      "question_id": "<original id>",
      "action": "keep" | "merge" | "answer",
      "priority": "P0" | "P1" | "P2",
      "merged_into": "<id of kept question, only if action=merge>",
      "answer": "<answer text, only if action=answer>"
    }
  ]
}

Keep at most {max_open} open questions. \
Prioritize questions about undocumented decisions, manual overrides, and \
knowledge that lives only in the departing employee's head."""


async def reconcile_questions(state: OffboardingState) -> dict:
    """Deduplicate, auto-resolve, and reprioritize the question backlog.

    Reads from: state["question_backlog"], state["deep_dive_corpus"],
                state["global_summary"]
    Writes to:  state["question_backlog"]
    Persists:   question_backlog.json
    """
    session_id = state["session_id"]
    backlog: list[Question] = state.get("question_backlog", [])
    corpus = state.get("deep_dive_corpus", "")
    global_summary = state.get("global_summary", "")
    store = SessionStorage(session_id)

    if not backlog:
        store.save_json("question_backlog.json", [])
        return {
            "question_backlog": [],
            "status": "questions_ready",
            "current_step": "reconcile_questions",
        }

    # Build the question list for the LLM
    questions_text = "\n".join(
        f"- [{q.question_id}] ({q.origin.value}, {q.priority.value}): {q.question_text}"
        for q in backlog
    )

    # Truncate corpus if too long to fit in prompt
    max_corpus = 6000
    corpus_for_prompt = (
        corpus[:max_corpus] + "\n... [truncated]"
        if len(corpus) > max_corpus
        else corpus
    )

    system = SYSTEM_PROMPT.replace("{max_open}", str(settings.MAX_OPEN_QUESTIONS))

    user_prompt = (
        f"Here is the current question backlog ({len(backlog)} questions):\n\n"
        f"{questions_text}\n\n"
        f"Here is the evidence corpus:\n\n{corpus_for_prompt}\n\n"
        f"Here is the global summary:\n\n{global_summary}\n\n"
        "For each question:\n"
        "- If two questions ask the same thing, merge them (keep the better one).\n"
        "- If the evidence clearly answers a question, mark it answered and provide the answer.\n"
        "- Assign priority: P0 (total knowledge loss risk), P1 (partial), P2 (nice-to-have).\n"
        f"- Keep at most {settings.MAX_OPEN_QUESTIONS} open questions."
    )

    result = await call_llm_json(system, user_prompt)
    reconciled = result.get("reconciled", [])

    # Build a lookup for the LLM decisions
    decisions = {r["question_id"]: r for r in reconciled}

    # Apply decisions to the backlog
    updated: list[Question] = []
    for q in backlog:
        decision = decisions.get(q.question_id)
        if not decision:
            # LLM didn't mention this question — keep as-is
            updated.append(q)
            continue

        action = decision.get("action", "keep")

        if action == "merge":
            q.status = QuestionStatus.MERGED
            updated.append(q)

        elif action == "answer":
            q.status = QuestionStatus.ANSWERED_BY_FILES
            q.answer = decision.get("answer", "")
            updated.append(q)

        else:  # keep
            priority_str = decision.get("priority", q.priority.value)
            try:
                q.priority = QuestionPriority(priority_str)
            except ValueError:
                pass
            updated.append(q)

    # Cap open questions at MAX_OPEN_QUESTIONS
    open_qs = [q for q in updated if q.status == QuestionStatus.OPEN]
    closed_qs = [q for q in updated if q.status != QuestionStatus.OPEN]

    if len(open_qs) > settings.MAX_OPEN_QUESTIONS:
        priority_order = {QuestionPriority.P0: 0, QuestionPriority.P1: 1, QuestionPriority.P2: 2}
        open_qs.sort(key=lambda q: priority_order.get(q.priority, 9))
        kept = open_qs[:settings.MAX_OPEN_QUESTIONS]
        for q in open_qs[settings.MAX_OPEN_QUESTIONS:]:
            q.status = QuestionStatus.DEPRIORITIZED
            closed_qs.append(q)
        open_qs = kept

    final_backlog = open_qs + closed_qs

    store.save_json(
        "question_backlog.json",
        [q.model_dump() for q in final_backlog],
    )

    open_count = len([q for q in final_backlog if q.status == QuestionStatus.OPEN])
    merged_count = len([q for q in final_backlog if q.status == QuestionStatus.MERGED])
    answered_count = len([q for q in final_backlog if q.status == QuestionStatus.ANSWERED_BY_FILES])

    logger.info(
        "Reconciled questions for session %s: %d total → %d open, %d merged, %d auto-answered",
        session_id, len(backlog), open_count, merged_count, answered_count,
    )

    return {
        "question_backlog": final_backlog,
        "status": "questions_ready",
        "current_step": "reconcile_questions",
    }

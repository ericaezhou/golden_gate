"""Node: reconcile_questions — unify and prioritize the question backlog.

Deduplicates, auto-resolves, reprioritizes, and caps questions.

This node sits between global_summarize and interview_loop.
It takes the raw question list (from per-file + global analysis),
cleans it up via an LLM call, and produces a focused backlog
that the interview loop consumes.
"""

from __future__ import annotations

import json
import logging

from backend.config import settings
from backend.models.questions import (
    Question,
    QuestionOrigin,
    QuestionPriority,
    QuestionStatus,
)
from backend.models.state import OffboardingState
from backend.services.llm import call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a knowledge-transfer specialist. Your job is to clean up a raw
question backlog so that only the most important, non-redundant questions
remain for a short interview with a departing employee.

You will receive:
1. A list of questions (JSON array) generated from file analysis.
2. An evidence corpus (text) summarizing what is already known.
3. A global summary (text) with cross-file findings.

For each question, decide ONE action:

- KEEP_OPEN: the question cannot be answered from existing evidence.
  Assign a priority:
    P0 = knowledge will be TOTALLY LOST if not asked (no docs exist)
    P1 = partially documented but ambiguous / incomplete
    P2 = nice-to-have clarification
- ANSWER: the evidence corpus or global summary already answers this
  question clearly. Provide the answer.
- MERGE: this question is a duplicate of another question in the list.
  Reference the question_id it merges into.

Return ONLY valid JSON with this exact schema:
{
  "questions": [
    {
      "question_id": "<original id>",
      "action": "keep_open" | "answer" | "merge",
      "priority": "P0" | "P1" | "P2",
      "answer": "<answer text, only if action=answer>",
      "merge_into": "<question_id, only if action=merge>",
      "reasoning": "<1 sentence explaining the decision>"
    }
  ]
}

Rules:
- Keep at most %d open questions (P0 first, then P1, then P2).
- If you must drop questions to stay under the cap, deprioritize P2s first.
- Be aggressive about merging duplicates — even if phrased differently,
  if two questions seek the same information, merge them.
- Be conservative about auto-answering — only mark "answer" if the
  evidence CLEARLY and COMPLETELY answers the question.
""" % settings.MAX_OPEN_QUESTIONS


def _build_user_prompt(
    questions: list[Question],
    deep_dive_corpus: str,
    global_summary: str,
) -> str:
    """Build the user prompt with the question list and evidence."""
    q_list = []
    for q in questions:
        q_list.append({
            "question_id": q.question_id,
            "question_text": q.question_text,
            "origin": q.origin.value,
            "source_file_id": q.source_file_id,
        })

    # Truncate corpus if too long to fit in context
    max_corpus_len = 6000
    corpus_text = deep_dive_corpus[:max_corpus_len]
    if len(deep_dive_corpus) > max_corpus_len:
        corpus_text += "\n... [truncated]"

    max_summary_len = 3000
    summary_text = global_summary[:max_summary_len]
    if len(global_summary) > max_summary_len:
        summary_text += "\n... [truncated]"

    return (
        "## Questions to reconcile\n\n"
        f"```json\n{json.dumps(q_list, indent=2)}\n```\n\n"
        "## Evidence corpus (from per-file deep dives)\n\n"
        f"{corpus_text}\n\n"
        "## Global summary (cross-file analysis)\n\n"
        f"{summary_text}"
    )


def _apply_decisions(
    original: list[Question],
    decisions: list[dict],
) -> list[Question]:
    """Apply the LLM's decisions back onto the Question objects.

    Returns the updated question list (all questions, not just open ones).
    """
    decision_map = {d["question_id"]: d for d in decisions}

    open_count = 0
    for q in original:
        dec = decision_map.get(q.question_id)
        if dec is None:
            # LLM didn't mention this question — keep it as-is
            logger.warning(
                "LLM skipped question %s, keeping as open P2",
                q.question_id,
            )
            q.priority = QuestionPriority.P2
            open_count += 1
            continue

        action = dec.get("action", "keep_open").lower()

        if action == "answer":
            q.status = QuestionStatus.ANSWERED_BY_FILES
            q.answer = dec.get("answer", "")
            q.confidence = 0.8
            q.priority = QuestionPriority(
                dec.get("priority", "P1")
            )

        elif action == "merge":
            q.status = QuestionStatus.MERGED

        elif action == "keep_open":
            q.status = QuestionStatus.OPEN
            q.priority = QuestionPriority(
                dec.get("priority", "P1")
            )
            open_count += 1

        else:
            logger.warning(
                "Unknown action '%s' for %s, treating as keep_open",
                action, q.question_id,
            )
            q.status = QuestionStatus.OPEN
            open_count += 1

    # Enforce cap: if too many open, deprioritize lowest
    if open_count > settings.MAX_OPEN_QUESTIONS:
        _enforce_cap(original)

    return original


def _enforce_cap(questions: list[Question]) -> None:
    """Deprioritize excess open questions beyond MAX_OPEN_QUESTIONS.

    Keeps P0 first, then P1, then P2. Excess P2s (then P1s) get
    marked as deprioritized.
    """
    priority_order = {
        QuestionPriority.P0: 0,
        QuestionPriority.P1: 1,
        QuestionPriority.P2: 2,
    }

    open_qs = [
        q for q in questions
        if q.status == QuestionStatus.OPEN
    ]
    open_qs.sort(key=lambda q: priority_order.get(q.priority, 9))

    for q in open_qs[settings.MAX_OPEN_QUESTIONS:]:
        q.status = QuestionStatus.DEPRIORITIZED


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
    summary = state.get("global_summary", "")
    store = SessionStorage(session_id)

    if not backlog:
        logger.info("No questions to reconcile for session %s", session_id)
        store.save_json("question_backlog.json", [])
        return {
            "question_backlog": [],
            "status": "questions_ready",
            "current_step": "reconcile_questions",
        }

    # Build prompt and call LLM
    user_prompt = _build_user_prompt(backlog, corpus, summary)

    try:
        llm_response = await call_llm_json(
            SYSTEM_PROMPT,
            user_prompt,
            temperature=0.1,
        )
        decisions = llm_response.get("questions", [])
    except (ValueError, KeyError) as e:
        logger.error(
            "LLM reconciliation failed for session %s: %s. "
            "Falling back to cap-only.",
            session_id, e,
        )
        decisions = []

    # Apply decisions (or fall back to simple cap if LLM failed)
    if decisions:
        reconciled = _apply_decisions(backlog, decisions)
    else:
        reconciled = backlog
        _enforce_cap(reconciled)

    # Persist
    store.save_json(
        "question_backlog.json",
        [q.model_dump() for q in reconciled],
    )

    # Log stats
    open_count = sum(
        1 for q in reconciled if q.status == QuestionStatus.OPEN
    )
    answered = sum(
        1 for q in reconciled
        if q.status == QuestionStatus.ANSWERED_BY_FILES
    )
    merged = sum(
        1 for q in reconciled if q.status == QuestionStatus.MERGED
    )
    logger.info(
        "Reconciled %d questions → %d open, %d auto-answered, "
        "%d merged for session %s",
        len(backlog), open_count, answered, merged, session_id,
    )

    return {
        "question_backlog": reconciled,
        "status": "questions_ready",
        "current_step": "reconcile_questions",
    }

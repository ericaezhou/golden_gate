"""Node: reconcile_questions — unify and prioritize the question backlog.

Deduplicates, auto-resolves, reprioritizes, and caps questions.

Owner: [assign team member]
"""

from __future__ import annotations

import logging

from backend.config import settings
from backend.models.questions import Question
from backend.models.state import OffboardingState
from backend.services.llm import call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


async def reconcile_questions(state: OffboardingState) -> dict:
    """Deduplicate, auto-resolve, and reprioritize the question backlog.

    Reads from: state["question_backlog"], state["deep_dive_corpus"],
                state["global_summary"]
    Writes to:  state["question_backlog"]
    Persists:   question_backlog.json

    TODO: Implement the LLM-assisted reconciliation.
          See docs/implementation_design.md §4.5 for the prompt template.
    """
    session_id = state["session_id"]
    backlog: list[Question] = state.get("question_backlog", [])
    store = SessionStorage(session_id)

    # --- Placeholder implementation ---
    # For now, just cap the list and persist.
    capped = backlog[: settings.MAX_OPEN_QUESTIONS]

    store.save_json(
        "question_backlog.json",
        [q.model_dump() for q in capped],
    )

    logger.info(
        "Reconciled questions: %d → %d for session %s",
        len(backlog),
        len(capped),
        session_id,
    )

    return {
        "question_backlog": capped,
        "status": "questions_ready",
        "current_step": "reconcile_questions",
    }

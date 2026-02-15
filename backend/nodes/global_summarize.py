"""Node: global_summarize — Step 3 of the offboarding pipeline.

Performs cross-file reasoning to find mismatches, dependencies,
and missing context that per-file analysis can't catch.

Owner: [assign team member]
"""

from __future__ import annotations

import logging

from backend.models.state import OffboardingState
from backend.services.llm import call_llm, call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


async def global_summarize(state: OffboardingState) -> dict:
    """Produce a global summary and cross-file questions.

    Reads from: state["deep_dive_corpus"], state["structured_files"]
    Writes to:  state["global_summary"], appends to state["question_backlog"]
    Persists:   global_summary.json

    TODO: Implement the actual LLM call.
          See docs/implementation_design.md §4.4 for the prompt template.
    """
    session_id = state["session_id"]
    corpus = state.get("deep_dive_corpus", "")
    store = SessionStorage(session_id)

    # --- Placeholder implementation ---
    # Replace with actual LLM call using the prompt from the design doc.
    global_summary = f"[TODO] Global summary across {len(state.get('structured_files', []))} files"
    new_questions: list[dict] = []

    # Persist
    store.save_json("global_summary.json", {
        "global_summary": global_summary,
        "new_questions": new_questions,
    })

    logger.info("Global summary generated for session %s", session_id)

    return {
        "global_summary": global_summary,
        "status": "summarized",
        "current_step": "global_summarize",
    }

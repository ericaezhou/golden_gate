"""Node: build_qa_context — assembles the QA agent's system prompt.

Pure code node (no LLM call). Combines deep dives + interview summary +
extracted facts into a single .txt file used as the QA agent's system
prompt.  No vector DB — the entire knowledge base fits in the LLM
context window.

Owner: [assign team member]
Reference: docs/implementation_design.md §4.8
"""

from __future__ import annotations

import logging

from backend.models.state import OffboardingState
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


async def build_qa_context(state: OffboardingState) -> dict:
    """Assemble the QA agent system prompt from deep dives + interview.

    Reads from: state["deep_dive_corpus"], state["interview_summary"],
                state["extracted_facts"], state["question_backlog"]
    Writes to:  state["qa_system_prompt"]

    TODO: Implement the assembly logic.
          See docs/implementation_design.md §4.8 for the output format.
    """
    session_id = state["session_id"]

    corpus = state.get("deep_dive_corpus", "")
    interview_summary = state.get("interview_summary", "")
    facts = state.get("extracted_facts", [])
    questions = state.get("question_backlog", [])

    # --- Placeholder: assemble sections ---
    sections = ["=== PROJECT KNOWLEDGE BASE ===", ""]

    sections.append("== FILE ANALYSIS (Deep Dives) ==")
    sections.append(corpus if corpus else "(not yet generated)")
    sections.append("")

    sections.append("== INTERVIEW SUMMARY ==")
    sections.append(interview_summary if interview_summary else "(not yet generated)")
    sections.append("")

    sections.append("== EXTRACTED FACTS ==")
    if facts:
        for fact in facts:
            sections.append(f"- {fact}")
    else:
        sections.append("(none)")
    sections.append("")

    sections.append("== ANSWERED QUESTIONS ==")
    answered = [
        q for q in questions
        if getattr(q, "status", None) == "answered_by_interview"
        or (isinstance(q, dict) and q.get("status") == "answered_by_interview")
    ]
    if answered:
        for q in answered:
            text = getattr(q, "text", None) or (q.get("text", "") if isinstance(q, dict) else str(q))
            answer = getattr(q, "answer", None) or (q.get("answer", "") if isinstance(q, dict) else "")
            sections.append(f"Q: {text}")
            sections.append(f"A: {answer}")
            sections.append("")
    else:
        sections.append("(none)")

    qa_system_prompt = "\n".join(sections)

    # Persist
    store = SessionStorage(session_id)
    store.save_text("qa_system_prompt.txt", qa_system_prompt)
    if corpus:
        store.save_text("deep_dive_corpus.txt", corpus)
    if interview_summary:
        store.save_text("interview/interview_summary.txt", interview_summary)

    logger.info(
        "Built QA context for session %s (%d chars)",
        session_id,
        len(qa_system_prompt),
    )

    return {
        "qa_system_prompt": qa_system_prompt,
        "status": "complete",
        "current_step": "build_qa_context",
    }

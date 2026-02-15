"""Node: global_summarize — Step 3 of the offboarding pipeline.

Performs cross-file reasoning to find mismatches, dependencies,
and missing context that per-file analysis can't catch.
"""

from __future__ import annotations

import logging
import uuid

from backend.models.artifacts import Evidence
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
You are an expert knowledge-risk analyst. Your job is to look ACROSS all \
files in a departing employee's project folder and identify knowledge gaps \
that only become visible when reasoning across multiple files together.

Return your analysis as JSON with exactly three keys:

{
  "global_summary": "<string — a project-wide narrative covering the holistic state of this body of work>",
  "questions": [
    {
      "text": "<the question to ask the departing employee>",
      "priority": "P0" | "P1" | "P2",
      "involved_files": ["file_id_1", "file_id_2"],
      "evidence": "<brief quote or reference that motivated this question>"
    }
  ],
  "deduplicated_gaps": [
    {
      "text": "<a concise description of the knowledge gap>",
      "severity": "high" | "medium" | "low",
      "source_files": ["filename_1", "filename_2"]
    }
  ]
}

Priority levels:
- P0: Total knowledge-loss risk — undocumented, lives only in this person's head
- P1: Partial / ambiguous — some documentation exists but is incomplete or contradictory
- P2: Nice-to-have clarification

Severity levels for gaps:
- high: at-risk knowledge — undocumented decisions, heuristics, or tribal knowledge
- medium: fragile points — brittle, manual, or error-prone processes
- low: minor clarifications

For deduplicated_gaps: merge any redundant or near-duplicate findings that appear \
across multiple files into a single entry. Include ALL originating filenames in \
source_files. Do NOT include key_mechanics (core logic descriptions) — only include \
actual knowledge risks and fragile points.

Focus on questions that ONLY emerge from cross-file analysis:
1. Assumption mismatches (e.g., one file says X, another uses Y)
2. Workflow dependencies (which file's output feeds another)
3. Missing context (why a value was chosen, where manual overrides happen)
4. Undocumented decision criteria that span multiple artifacts

IMPORTANT: All questions must be specific and closed-ended — they should ask about a concrete value, decision, threshold, process, or fact that has a definitive answer. Never ask open-ended questions like "Can you explain..." or "What is your approach to...". Instead ask things like "What is the threshold value for X?" or "Which team receives the output of Y?" or "How often is the Z override applied?".
"""


async def global_summarize(state: OffboardingState) -> dict:
    """Produce a global summary and cross-file questions.

    Reads from: state["deep_dive_corpus"], state["structured_files"]
    Writes to:  state["global_summary"], appends to state["question_backlog"]
    Persists:   global_summary.json

    This node only APPENDS new global questions (Q2) to the backlog.
    Deduplication and reconciliation happen downstream in reconcile_questions.
    """
    session_id = state["session_id"]
    corpus = state.get("deep_dive_corpus", "")
    structured_files = state.get("structured_files", [])
    existing_backlog = state.get("question_backlog", [])
    store = SessionStorage(session_id)

    file_count = len(structured_files)
    file_names = [f.file_name for f in structured_files] if structured_files else []

    user_prompt = (
        f"You have analyzed {file_count} project files individually. "
        f"Files: {', '.join(file_names)}\n\n"
        f"Here are the combined findings:\n\n{corpus}\n\n"
        "Now reason ACROSS files:\n"
        "1. Find assumption mismatches (e.g., deck says X, model uses Y).\n"
        "2. Map workflow dependencies (which file's output feeds another).\n"
        "3. Identify missing context (why a value was chosen, where manual "
        "overrides happen).\n"
        "4. Produce a global_summary covering the project holistically.\n"
        "5. Generate NEW specific, closed-ended questions that only emerge from "
        "cross-file analysis. Each question must target a concrete fact, value, "
        "or decision — not open-ended exploration. Note which files are involved."
    )

    result = await call_llm_json(SYSTEM_PROMPT, user_prompt)

    global_summary = result.get("global_summary", "")
    raw_questions = result.get("questions", [])
    deduplicated_gaps = result.get("deduplicated_gaps", [])

    # Build Question objects with GLOBAL origin
    new_questions: list[Question] = []
    for q in raw_questions:
        involved = q.get("involved_files", [])
        evidence_list = []
        if q.get("evidence"):
            for fid in involved:
                evidence_list.append(
                    Evidence(file_id=fid, snippet=q["evidence"])
                )

        priority_str = q.get("priority", "P1")
        try:
            priority = QuestionPriority(priority_str)
        except ValueError:
            priority = QuestionPriority.P1

        new_questions.append(
            Question(
                question_id=f"global-{uuid.uuid4().hex[:8]}",
                question_text=q.get("text", ""),
                origin=QuestionOrigin.GLOBAL,
                source_file_id=involved[0] if involved else None,
                evidence=evidence_list,
                priority=priority,
                status=QuestionStatus.OPEN,
            )
        )

    # Persist
    store.save_json("global_summary.json", {
        "global_summary": global_summary,
        "new_questions": [q.model_dump() for q in new_questions],
        "deduplicated_gaps": deduplicated_gaps,
    })

    logger.info(
        "Global summary generated for session %s: %d cross-file questions",
        session_id,
        len(new_questions),
    )

    # Append global questions (Q2) to existing backlog (Q1).
    # Reconcile step downstream handles dedup and prioritization.
    updated_backlog = list(existing_backlog) + new_questions

    return {
        "global_summary": global_summary,
        "question_backlog": updated_backlog,
        "deduplicated_gaps": deduplicated_gaps,
        "status": "summarized",
        "current_step": "global_summarize",
    }

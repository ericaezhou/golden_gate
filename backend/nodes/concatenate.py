"""Node: concatenate_deep_dives — merge per-file reports into a corpus.

Takes the list of DeepDiveReports (accumulated via fan-out) and
produces a single deep_dive_corpus string plus initial question backlog.

Owner: [assign team member]
"""

from __future__ import annotations

import logging
import uuid

from backend.models.artifacts import DeepDiveReport
from backend.models.questions import Question, QuestionOrigin, QuestionStatus
from backend.models.state import OffboardingState
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


async def concatenate_deep_dives(state: OffboardingState) -> dict:
    """Merge deep dive reports into a unified corpus and question list.

    Reads from: state["deep_dive_reports"], state["session_id"]
    Writes to:  state["deep_dive_corpus"], state["question_backlog"]
    Persists:   deep_dive_corpus.json
    """
    reports: list[DeepDiveReport] = state.get("deep_dive_reports", [])
    session_id = state["session_id"]
    store = SessionStorage(session_id)

    # Group reports by file, take the latest pass for each
    latest_by_file: dict[str, DeepDiveReport] = {}
    for r in reports:
        existing = latest_by_file.get(r.file_id)
        if existing is None or r.pass_number > existing.pass_number:
            latest_by_file[r.file_id] = r

    # Build corpus text
    corpus_sections: list[str] = []
    all_questions: list[Question] = []

    for file_id, report in latest_by_file.items():
        section = _format_report_section(report)
        corpus_sections.append(section)

        # Convert report questions to Question objects
        for q_data in report.questions:
            q = Question(
                question_id=uuid.uuid4().hex[:8],
                question_text=q_data.get("text", str(q_data)),
                origin=QuestionOrigin.PER_FILE,
                source_file_id=file_id,
                status=QuestionStatus.OPEN,
            )
            all_questions.append(q)

    corpus = "\n\n---\n\n".join(corpus_sections)

    # Persist
    store.save_json("deep_dive_corpus.json", {"corpus": corpus})
    logger.info(
        "Concatenated %d file reports, %d questions",
        len(latest_by_file),
        len(all_questions),
    )

    return {
        "deep_dive_corpus": corpus,
        "question_backlog": all_questions,
        "status": "concatenated",
        "current_step": "concatenate_deep_dives",
    }


def _format_report_section(report: DeepDiveReport) -> str:
    """Format a single DeepDiveReport as a readable text section."""
    lines = [
        f"## File: {report.file_id}",
        f"**Purpose:** {report.file_purpose_summary}",
        "",
        "**Key Mechanics:**",
        *[f"- {m}" for m in report.key_mechanics],
        "",
        "**Fragile Points:**",
        *[f"- {p}" for p in report.fragile_points],
        "",
        "**At-Risk Knowledge:**",
        *[f"- {k}" for k in report.at_risk_knowledge],
    ]
    return "\n".join(lines)

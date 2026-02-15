"""Node: deep_dive — Step 2 of the offboarding pipeline.

Runs iterative LLM analysis on a single file (multiple passes).
This is called once per file via LangGraph fan-out.

Owner: [assign team member]
"""

from __future__ import annotations

import logging

from backend.config import settings
from backend.models.artifacts import DeepDiveReport, StructuredFile
from backend.models.state import FileDeepDiveState
from backend.services.llm import call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Subgraph node: run a single deep dive pass
# ------------------------------------------------------------------
async def run_deep_dive_pass(state: FileDeepDiveState) -> dict:
    """Execute one pass of deep-dive analysis on a file.

    Reads from: state["file"], state["pass_number"], state["previous_passes"]
    Writes to:  state["current_report"], state["pass_number"], state["previous_passes"]
    """
    file: StructuredFile = state["file"]
    pass_number: int = state.get("pass_number", 1)
    previous: list[DeepDiveReport] = state.get("previous_passes", [])

    logger.info(
        "Deep dive pass %d for %s", pass_number, file.file_name
    )

    # TODO: Implement actual LLM calls for each pass.
    #       See docs/implementation_design.md §4.2 for prompt templates.
    #
    #   Pass 1 — "Map & Describe"
    #   Pass 2 — "Critique & Gaps"
    #   Pass 3 — "At-Risk Knowledge Extraction" (xlsx only)
    #
    # For now, return a placeholder report.

    report = DeepDiveReport(
        file_id=file.file_id,
        pass_number=pass_number,
        file_purpose_summary=f"[TODO] Analysis of {file.file_name} pass {pass_number}",
        key_mechanics=[],
        fragile_points=[],
        at_risk_knowledge=[],
        questions=[],
        cumulative_summary="",
    )

    updated_passes = previous + [report]

    return {
        "current_report": report,
        "previous_passes": updated_passes,
        "pass_number": pass_number + 1,
    }


# ------------------------------------------------------------------
# Routing: should we continue to the next pass?
# ------------------------------------------------------------------
def should_continue_passes(state: FileDeepDiveState) -> str:
    """Decide whether to do another pass or finish.

    Returns "continue" or "done".
    """
    file: StructuredFile = state["file"]
    pass_number: int = state.get("pass_number", 1)

    max_passes = state.get("max_passes", None)
    if max_passes is None:
        if file.file_type in ("xlsx", "xls"):
            max_passes = settings.DEEP_DIVE_PASSES_XLSX
        else:
            max_passes = settings.DEEP_DIVE_PASSES_DEFAULT

    if pass_number > max_passes:
        return "done"
    return "continue"


# ------------------------------------------------------------------
# Fan-out helper (called from offboarding graph)
# ------------------------------------------------------------------
def prepare_deep_dive_input(
    file: StructuredFile,
) -> FileDeepDiveState:
    """Build the initial subgraph state for one file."""
    max_passes = (
        settings.DEEP_DIVE_PASSES_XLSX
        if file.file_type in ("xlsx", "xls")
        else settings.DEEP_DIVE_PASSES_DEFAULT
    )
    return {
        "file": file,
        "pass_number": 1,
        "max_passes": max_passes,
        "previous_passes": [],
        "current_report": None,
    }

"""LangGraph state definitions.

These TypedDicts define the shape of the state that flows through
every node in the offboarding and onboarding graphs.  Add new fields
here when a node needs to communicate data to a downstream node.

IMPORTANT: Because LangGraph uses TypedDict (not Pydantic) for state,
the actual values stored at runtime are plain dicts / lists.  Use the
Pydantic models from artifacts.py / questions.py to *validate* data
before writing it into state.
"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langgraph.graph import add_messages

from backend.models.artifacts import (
    DeepDiveReport,
    InterviewTurn,
    OnboardingPackage,
    StructuredFile,
)
from backend.models.questions import Question


# ------------------------------------------------------------------
# Reducer helpers
# ------------------------------------------------------------------
def _append_list(existing: list, new: list) -> list:
    """LangGraph reducer — append new items to existing list."""
    return existing + new


# ------------------------------------------------------------------
# Offboarding Graph state
# ------------------------------------------------------------------
class OffboardingState(TypedDict, total=False):
    # identifiers
    session_id: str
    project_metadata: dict

    # Step 1 output
    structured_files: list[StructuredFile]

    # Step 2 output (accumulated via fan-out)
    deep_dive_reports: Annotated[list[DeepDiveReport], _append_list]

    # Concatenation output
    deep_dive_corpus: str

    # Step 3 output
    global_summary: str
    deduplicated_gaps: list[dict]

    # Question management
    question_backlog: list[Question]

    # Interview output
    interview_transcript: list[InterviewTurn]
    extracted_facts: Annotated[list[str], _append_list]
    interview_summary: str                               # plain text summary

    # Final deliverables
    onboarding_package: OnboardingPackage | None
    qa_system_prompt: str                                # deep dives + interview → QA agent context

    # Progress tracking
    status: str
    current_step: str
    errors: Annotated[list[str], _append_list]


# ------------------------------------------------------------------
# Per-file deep dive subgraph state
# ------------------------------------------------------------------
class FileDeepDiveState(TypedDict, total=False):
    file: StructuredFile
    pass_number: int
    max_passes: int
    previous_passes: list[DeepDiveReport]
    current_report: DeepDiveReport | None
    session_id: str
    deep_dive_reports: Annotated[list[DeepDiveReport], _append_list]


class FileDeepDiveOutput(TypedDict, total=False):
    """Output schema for the deep dive subgraph.

    Only includes keys safe to fan-in to the parent OffboardingState.
    session_id is excluded to avoid InvalidUpdateError on concurrent writes.
    """
    deep_dive_reports: Annotated[list[DeepDiveReport], _append_list]


# ------------------------------------------------------------------
# Onboarding Graph state
# ------------------------------------------------------------------
class OnboardingState(TypedDict, total=False):
    session_id: str
    onboarding_package: OnboardingPackage
    qa_system_prompt: str                   # deep dives + interview summary (txt)
    knowledge_graph: dict | None            # populated on-demand via tool call
    chat_history: Annotated[list[dict], add_messages]
    current_mode: str                       # "narrative" | "qa"
    narrative: str                          # generated narrative markdown

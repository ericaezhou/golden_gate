"""Onboarding Graph — new hire experience.

Provides:
  1. A generated narrative overview of the project.
  2. An interactive QA loop backed by hybrid retrieval.

This graph reads from the knowledge store produced by the
offboarding graph.
"""

from __future__ import annotations

import logging

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from backend.models.state import OnboardingState
from backend.services.embeddings import RetrievalService
from backend.services.llm import call_llm
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Node: generate the onboarding narrative
# ------------------------------------------------------------------
async def generate_narrative(state: OnboardingState) -> dict:
    """Generate a guided onboarding narrative from the package.

    Reads from: state["onboarding_package"], state["session_id"]
    Writes to:  state["narrative"], state["current_mode"]

    TODO: Implement the LLM call.
          See docs/implementation_design.md §5.2.
    """
    session_id = state["session_id"]
    package = state.get("onboarding_package")

    # --- Placeholder ---
    narrative = "[TODO] Generate narrative from onboarding package"

    return {
        "narrative": narrative,
        "current_mode": "narrative",
    }


# ------------------------------------------------------------------
# Node: QA loop (human-in-the-loop)
# ------------------------------------------------------------------
async def qa_loop(state: OnboardingState) -> dict:
    """Interactive QA: new hire asks questions, agent answers with citations.

    Uses interrupt() to wait for user questions from the frontend.
    Each turn: retrieve → answer → gap-detect.

    Reads from: state["session_id"], state["retrieval_index"]
    Writes to:  state["chat_history"]

    TODO: Implement retrieval + LLM answering + gap detection.
          See docs/implementation_design.md §5.3.
    """
    session_id = state["session_id"]

    # Wait for user question
    user_input = interrupt({
        "prompt": "Ask any question about the project.",
        "mode": "qa",
    })

    # --- Placeholder retrieval + answer ---
    answer = f"[TODO] Answer based on retrieval for: {user_input}"
    citations: list[str] = []
    confidence = "medium"
    gap_ticket = None

    new_message = {
        "role": "assistant",
        "content": answer,
        "citations": citations,
        "confidence": confidence,
        "gap_ticket": gap_ticket,
    }

    return {
        "chat_history": [
            {"role": "user", "content": user_input},
            new_message,
        ],
        "current_mode": "qa",
    }


# ------------------------------------------------------------------
# Build the graph
# ------------------------------------------------------------------
def build_onboarding_graph():
    """Build and compile the onboarding StateGraph."""
    builder = StateGraph(OnboardingState)

    builder.add_node("generate_narrative", generate_narrative)
    builder.add_node("qa_loop", qa_loop)

    builder.add_edge(START, "generate_narrative")
    builder.add_edge("generate_narrative", "qa_loop")
    # qa_loop uses interrupt() — graph pauses here until user sends input
    builder.add_edge("qa_loop", "qa_loop")  # loop back for next question

    return builder.compile()

"""Offboarding Graph — the main pipeline.

Orchestrates: parse → fan-out deep dives → concatenate → global
summarize → reconcile questions → interview → generate package
→ build index.

This is the "spine" of the system.  Individual node implementations
live in backend/nodes/ and can be developed independently.
"""

from __future__ import annotations

from langgraph.types import Send
from langgraph.graph import END, START, StateGraph

from backend.models.state import OffboardingState
from backend.nodes.build_index import build_retrieval_index
from backend.nodes.concatenate import concatenate_deep_dives
from backend.nodes.deep_dive import prepare_deep_dive_input
from backend.nodes.generate_package import generate_onboarding_package
from backend.nodes.global_summarize import global_summarize
from backend.nodes.interview import interview_loop
from backend.nodes.parse_files import parse_files
from backend.nodes.reconcile_questions import reconcile_questions
from backend.graphs.subgraphs.file_deep_dive import file_deep_dive_subgraph


# ------------------------------------------------------------------
# Fan-out: send each parsed file to its own deep-dive subgraph
# ------------------------------------------------------------------
def _fan_out_deep_dives(state: OffboardingState) -> list[Send]:
    """Create one Send() per file for parallel deep-dive analysis."""
    files = state.get("structured_files", [])
    return [
        Send("file_deep_dive", prepare_deep_dive_input(f))
        for f in files
    ]


# ------------------------------------------------------------------
# Collector: extract reports from subgraph results
# ------------------------------------------------------------------
async def _collect_deep_dives(state: OffboardingState) -> dict:
    """Transition node after fan-out completes.

    The deep_dive_reports are already accumulated in state via the
    Annotated[list, _append_list] reducer.  This node just updates
    the status.
    """
    return {
        "status": "deep_dives_complete",
        "current_step": "collect_deep_dives",
    }


# ------------------------------------------------------------------
# Build the graph
# ------------------------------------------------------------------
def build_offboarding_graph():
    """Build and compile the offboarding StateGraph.

    Returns a compiled graph ready to invoke/stream.
    """
    builder = StateGraph(OffboardingState)

    # --- Add nodes ---
    builder.add_node("parse_files", parse_files)
    builder.add_node("file_deep_dive", file_deep_dive_subgraph)
    builder.add_node("collect_deep_dives", _collect_deep_dives)
    builder.add_node("concatenate_deep_dives", concatenate_deep_dives)
    builder.add_node("global_summarize", global_summarize)
    builder.add_node("reconcile_questions", reconcile_questions)
    builder.add_node("interview_loop", interview_loop)
    builder.add_node("generate_onboarding_package", generate_onboarding_package)
    builder.add_node("build_retrieval_index", build_retrieval_index)

    # --- Add edges ---
    builder.add_edge(START, "parse_files")

    # Fan-out: parse_files → N × file_deep_dive
    builder.add_conditional_edges(
        "parse_files",
        _fan_out_deep_dives,
        ["file_deep_dive"],
    )

    # Fan-in: all deep dives → collect
    builder.add_edge("file_deep_dive", "collect_deep_dives")

    # Linear pipeline after fan-in
    builder.add_edge("collect_deep_dives", "concatenate_deep_dives")
    builder.add_edge("concatenate_deep_dives", "global_summarize")
    builder.add_edge("global_summarize", "reconcile_questions")
    builder.add_edge("reconcile_questions", "interview_loop")
    builder.add_edge("interview_loop", "generate_onboarding_package")
    builder.add_edge("generate_onboarding_package", "build_retrieval_index")
    builder.add_edge("build_retrieval_index", END)

    return builder.compile()

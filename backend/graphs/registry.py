"""Graph registry — compiled graphs with checkpointers.

Provides singleton access to the compiled offboarding and onboarding
graphs backed by in-memory checkpointers so that interrupt()/Command(resume=...)
works across HTTP calls.

Usage:
    from backend.graphs.registry import get_offboarding_graph, get_onboarding_graph
    graph = get_offboarding_graph()
    config = {"configurable": {"thread_id": session_id}}
    async for chunk in graph.astream(initial_state, config): ...
"""

from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from backend.models.state import OffboardingState
from backend.nodes.build_qa_context import build_qa_context
from backend.nodes.concatenate import concatenate_deep_dives
from backend.nodes.deep_dive import prepare_deep_dive_input
from backend.nodes.generate_package import generate_onboarding_package
from backend.nodes.global_summarize import global_summarize
from backend.nodes.interview import interview_loop
from backend.nodes.parse_files import parse_files
from backend.nodes.reconcile_questions import reconcile_questions
from backend.graphs.onboarding_graph import build_onboarding_graph as _build_onboarding_graph
from backend.graphs.subgraphs.file_deep_dive import file_deep_dive_subgraph

# Singleton instances
_checkpointer: MemorySaver | None = None
_full_graph = None
_onboarding_checkpointer: MemorySaver | None = None
_onboarding_graph = None


def _fan_out_deep_dives(state: OffboardingState) -> list[Send]:
    files = state.get("structured_files", [])
    session_id = state.get("session_id", "")
    return [
        Send("file_deep_dive", prepare_deep_dive_input(f, session_id))
        for f in files
    ]


async def _collect_deep_dives(state: OffboardingState) -> dict:
    return {
        "status": "deep_dives_complete",
        "current_step": "collect_deep_dives",
    }


def get_checkpointer() -> MemorySaver:
    """Return the shared in-memory checkpointer (singleton)."""
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = MemorySaver()
    return _checkpointer


def get_offboarding_graph():
    """Return the compiled full offboarding graph (singleton).

    The graph is compiled with a MemorySaver checkpointer so that
    interrupt()/Command(resume=...) works for the interview loop.
    """
    global _full_graph
    if _full_graph is not None:
        return _full_graph

    builder = StateGraph(OffboardingState)

    builder.add_node("parse_files", parse_files)
    builder.add_node("file_deep_dive", file_deep_dive_subgraph)
    builder.add_node("collect_deep_dives", _collect_deep_dives)
    builder.add_node("concatenate_deep_dives", concatenate_deep_dives)
    builder.add_node("global_summarize", global_summarize)
    builder.add_node("reconcile_questions", reconcile_questions)
    builder.add_node("interview_loop", interview_loop)
    builder.add_node("generate_onboarding_package", generate_onboarding_package)
    builder.add_node("build_qa_context", build_qa_context)

    builder.add_edge(START, "parse_files")
    builder.add_conditional_edges(
        "parse_files", _fan_out_deep_dives, ["file_deep_dive"],
    )
    builder.add_edge("file_deep_dive", "collect_deep_dives")
    builder.add_edge("collect_deep_dives", "concatenate_deep_dives")
    builder.add_edge("concatenate_deep_dives", "global_summarize")
    builder.add_edge("global_summarize", "reconcile_questions")
    builder.add_edge("reconcile_questions", "interview_loop")

    builder.add_edge("interview_loop", "generate_onboarding_package")
    builder.add_edge("interview_loop", "build_qa_context")
    builder.add_edge("generate_onboarding_package", END)
    builder.add_edge("build_qa_context", END)

    _full_graph = builder.compile(checkpointer=get_checkpointer())
    return _full_graph


def get_onboarding_checkpointer() -> MemorySaver:
    """Return the in-memory checkpointer for the onboarding graph (singleton)."""
    global _onboarding_checkpointer
    if _onboarding_checkpointer is None:
        _onboarding_checkpointer = MemorySaver()
    return _onboarding_checkpointer


def get_onboarding_graph():
    """Return the compiled onboarding graph with checkpointer (singleton).

    Used by POST /api/onboarding/{session_id}/ask so qa_loop interrupt/resume
    works and chat_history is persisted per session.
    """
    global _onboarding_graph
    if _onboarding_graph is not None:
        return _onboarding_graph
    _onboarding_graph = _build_onboarding_graph(checkpointer=get_onboarding_checkpointer())
    return _onboarding_graph

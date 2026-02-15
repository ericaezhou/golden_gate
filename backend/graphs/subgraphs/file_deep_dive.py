"""Subgraph: per-file iterative deep dive.

Runs n passes of LLM analysis on a single file, with each pass
building on the previous one.  The loop is controlled by
should_continue_passes() in nodes/deep_dive.py.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from backend.models.state import FileDeepDiveState, FileDeepDiveOutput
from backend.nodes.deep_dive import run_deep_dive_pass, should_continue_passes


def build_file_deep_dive_subgraph() -> StateGraph:
    """Build and return the compiled per-file deep dive subgraph.

    Graph shape:
        START → run_pass → should_continue?
                  ↑               │
                  └── continue ───┘
                              done → END

    Uses FileDeepDiveOutput to restrict what gets written back to the
    parent graph, avoiding InvalidUpdateError on concurrent fan-in of
    non-reducer keys like session_id.
    """
    builder = StateGraph(FileDeepDiveState, output=FileDeepDiveOutput)

    builder.add_node("run_pass", run_deep_dive_pass)

    builder.add_edge(START, "run_pass")
    builder.add_conditional_edges(
        "run_pass",
        should_continue_passes,
        {
            "continue": "run_pass",
            "done": END,
        },
    )

    return builder.compile()


# Pre-built instance for import
file_deep_dive_subgraph = build_file_deep_dive_subgraph()

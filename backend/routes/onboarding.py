"""Routes: onboarding — narrative, QA, knowledge graph.

Endpoints:
    GET  /api/onboarding/{session_id}/narrative
    POST /api/onboarding/{session_id}/ask
    GET  /api/onboarding/{session_id}/knowledge-graph
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


class QARequest(BaseModel):
    question: str


@router.get("/{session_id}/narrative")
async def get_narrative(session_id: str) -> dict[str, Any]:
    """Return the pre-generated onboarding narrative.

    TODO: Read from the onboarding graph output or stored package.
    """
    store = SessionStorage(session_id)
    try:
        package = store.load_json("onboarding_package/package.json")
        return {
            "session_id": session_id,
            "narrative_md": package.get("abstract", "")
            + "\n\n"
            + package.get("introduction", "")
            + "\n\n"
            + package.get("details", ""),
            "checklist": [],       # TODO: derive from details
            "top_risks": package.get("risks_and_gotchas", []),
        }
    except FileNotFoundError:
        return {
            "session_id": session_id,
            "error": "Onboarding package not yet generated",
        }


@router.post("/{session_id}/ask")
async def ask_question(
    session_id: str,
    body: QARequest,
) -> dict[str, Any]:
    """Answer a new hire's question using system-prompt context.

    The QA agent uses the deep dives + interview summary as its
    system prompt — no vector DB retrieval.

    TODO: Wire into the onboarding graph's qa_loop or call LLM
          with qa_system_prompt.txt as system prompt.
          See docs/implementation_design.md §5.3.
    """
    logger.info(
        "QA question for %s: %s", session_id, body.question[:100]
    )

    # Placeholder response
    return {
        "session_id": session_id,
        "answer": f"[TODO] Answer for: {body.question}",
        "citations": [],
        "confidence": "low",
        "gap_ticket": None,
    }


@router.get("/{session_id}/knowledge-graph")
async def get_knowledge_graph(session_id: str) -> dict[str, Any]:
    """Generate or return cached knowledge graph for visualization.

    On first call: reads structured_files + interview_summary from the
    session store, calls LLM to generate the graph JSON, and caches it.
    On subsequent calls: returns the cached graph.

    TODO: Implement LLM call for graph generation.
          See docs/implementation_design.md §5.4.
    """
    store = SessionStorage(session_id)

    # Try to return cached graph
    try:
        graph = store.load_json("knowledge_graph/graph.json")
        return {"session_id": session_id, "graph": graph, "cached": True}
    except FileNotFoundError:
        pass

    # --- Placeholder: generate on-demand ---
    # TODO: Load structured_files + interview_summary, call LLM
    return {
        "session_id": session_id,
        "graph": {"nodes": [], "edges": []},
        "cached": False,
        "note": "[TODO] Knowledge graph generation not yet implemented",
    }

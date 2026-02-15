"""Routes: onboarding — narrative, QA, knowledge graph.

These endpoints serve the new-hire experience.  Narrative and knowledge-graph
read from artifacts; QA uses the onboarding graph's qa_loop (interrupt/resume)
so chat_history is persisted per session.

Endpoints:
    GET  /api/onboarding/{session_id}/narrative
    POST /api/onboarding/{session_id}/ask   (uses qa_loop in onboarding graph)
    GET  /api/onboarding/{session_id}/knowledge-graph
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from langgraph.types import Command
from pydantic import BaseModel

from backend.graphs.registry import get_onboarding_graph
from backend.services.llm import call_llm
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


# ------------------------------------------------------------------
# Prompt templates
# ------------------------------------------------------------------
QA_SYSTEM_PROMPT_TEMPLATE = """\
You are a knowledgeable assistant helping a new team member \
understand a project they are taking over. You have access \
to the following knowledge base from the previous owner's \
files and exit interview.

{knowledge_base}

Rules:
- Answer questions based ONLY on the knowledge base above.
- Cite which file or interview answer your information comes from \
  using [Deep Dive: file], [Interview Summary], or [Global Summary].
- If you are not confident, say so and suggest what to investigate.
- Be concise and practical — 2-6 sentences for most answers."""

NARRATIVE_SYSTEM = """\
You are writing a guided onboarding narrative for a new team member \
who will take over this project. Your audience has ZERO context — \
this is the first thing they read.

Given the onboarding package below, produce a clear, engaging \
narrative that:

1. Opens with a 1-paragraph "What is this project?" summary.
2. Explains the business context — why it exists, who cares about it.
3. Provides a **first-week checklist** (5-8 concrete items).
4. Flags the **top 3 risks/gotchas** to be aware of immediately.
5. Ends with a brief "You're ready" encouragement.

Write in clear prose with markdown formatting. Be practical and \
specific — reference actual file names, processes, and people \
from the materials provided."""


# ------------------------------------------------------------------
# Request models
# ------------------------------------------------------------------
class QARequest(BaseModel):
    question: str


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _load_knowledge_base(store: SessionStorage) -> str:
    """Load the QA knowledge base from session storage.

    Priority order:
    1. qa_system_prompt.txt  (pre-built by build_qa_context node)
    2. Assemble from individual files as fallback
    """
    if store.exists("qa_system_prompt.txt"):
        return store.load_text("qa_system_prompt.txt")

    sections = []
    if store.exists("deep_dive_corpus.txt"):
        sections.append("== FILE ANALYSIS ==\n" + store.load_text("deep_dive_corpus.txt"))
    elif store.exists("deep_dive_corpus.json"):
        data = store.load_json("deep_dive_corpus.json")
        corpus = data.get("corpus", "") if isinstance(data, dict) else ""
        if corpus:
            sections.append("== FILE ANALYSIS ==\n" + corpus)
    if store.exists("interview/interview_summary.txt"):
        sections.append("== INTERVIEW SUMMARY ==\n" + store.load_text("interview/interview_summary.txt"))
    if store.exists("global_summary.json"):
        data = store.load_json("global_summary.json")
        gs = data.get("global_summary", "") if isinstance(data, dict) else ""
        if gs:
            sections.append("== GLOBAL SUMMARY ==\n" + gs)

    return "\n\n".join(sections) if sections else ""


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------
@router.get("/{session_id}/narrative")
async def get_narrative(session_id: str) -> dict[str, Any]:
    """Return or generate the onboarding narrative (same logic as onboarding graph generate_narrative).

    Response: { session_id, project_name?, narrative_md, cached }.
    - If onboarding_narrative.md exists: return it (cached=True).
    - Else if onboarding_package/package.json exists: generate via LLM, save to onboarding_narrative.md, return (cached=False).
    - Else: 404.
    """
    store = SessionStorage(session_id)

    project_name = ""
    try:
        meta = store.load_json("metadata.json")
        project_name = meta.get("project_name", "") if isinstance(meta, dict) else ""
    except FileNotFoundError:
        pass

    # Return cached narrative if available
    if store.exists("onboarding_narrative.md"):
        narrative = store.load_text("onboarding_narrative.md")
        return {
            "session_id": session_id,
            "project_name": project_name,
            "narrative_md": narrative,
            "cached": True,
        }

    # Try generating from onboarding package
    if not store.exists("onboarding_package/package.json"):
        raise HTTPException(
            status_code=404,
            detail="Onboarding package not yet generated. Run the offboarding pipeline first.",
        )

    package = store.load_json("onboarding_package/package.json")

    # Build user prompt from package (aligned with onboarding_graph.generate_narrative)
    user_prompt = (
        f"## Abstract\n{package.get('abstract', '')}\n\n"
        f"## Introduction\n{package.get('introduction', '')}\n\n"
        f"## Details\n{package.get('details', '')}\n\n"
        f"## FAQ\n"
    )
    for item in package.get("faq", []):
        user_prompt += f"Q: {item.get('q', '')}\nA: {item.get('a', '')}\n\n"
    user_prompt += "## Risks & Gotchas\n"
    for risk in package.get("risks_and_gotchas", []):
        user_prompt += f"- {risk}\n"

    narrative = await call_llm(NARRATIVE_SYSTEM, user_prompt)
    store.save_text("onboarding_narrative.md", narrative)

    return {
        "session_id": session_id,
        "project_name": project_name,
        "narrative_md": narrative,
        "cached": False,
    }


def _is_at_qa_interrupt(graph_state) -> bool:
    """True if the onboarding graph is paused at qa_loop's interrupt()."""
    if not graph_state:
        return False
    if hasattr(graph_state, "tasks"):
        for task in graph_state.tasks:
            if hasattr(task, "interrupts") and task.interrupts:
                return True
    return False


def _build_onboarding_initial_state(session_id: str, store: SessionStorage) -> dict[str, Any]:
    """Build initial state for the onboarding graph (narrative + qa_loop)."""
    knowledge_base = _load_knowledge_base(store)
    package = {}
    if store.exists("onboarding_package/package.json"):
        package = store.load_json("onboarding_package/package.json")
    return {
        "session_id": session_id,
        "onboarding_package": package,
        "qa_system_prompt": knowledge_base or "",
        "chat_history": [],
        "narrative": "",
        "current_mode": "narrative",
    }


@router.post("/{session_id}/ask")
async def ask_question(
    session_id: str,
    body: QARequest,
) -> dict[str, Any]:
    """Answer a new hire's question via the onboarding graph's qa_loop.

    Uses the onboarding LangGraph: runs until qa_loop interrupt, resumes with
    the question, then returns the last assistant message. Chat history
    is persisted in graph state (checkpointer) so multi-turn context is kept.
    """
    store = SessionStorage(session_id)
    knowledge_base = _load_knowledge_base(store)
    if not knowledge_base:
        raise HTTPException(
            status_code=404,
            detail="No knowledge base found. Run the offboarding pipeline first.",
        )

    graph = get_onboarding_graph()
    config = {"configurable": {"thread_id": session_id}}
    graph_state = graph.get_state(config)

    # If graph never started or not at qa_loop interrupt, run from START until interrupt
    if not graph_state.values or not _is_at_qa_interrupt(graph_state):
        initial_state = _build_onboarding_initial_state(session_id, store)
        async for _ in graph.astream(initial_state, config):
            pass
        graph_state = graph.get_state(config)
        if not _is_at_qa_interrupt(graph_state):
            raise HTTPException(
                status_code=500,
                detail="Onboarding graph did not reach QA interrupt.",
            )

    # Resume with the user's question
    logger.info("QA question for %s (via qa_loop): %s", session_id, body.question[:100])
    async for _ in graph.astream(
        Command(resume=body.question),
        config,
        stream_mode="updates",
    ):
        pass

    # Get the new state and extract the last assistant reply
    graph_state = graph.get_state(config)
    chat_history = (graph_state.values or {}).get("chat_history", [])
    answer = ""
    for msg in reversed(chat_history):
        role = getattr(msg, "type", None) or (msg.get("role") if isinstance(msg, dict) else None)
        if role in ("assistant", "ai"):
            answer = getattr(msg, "content", None) if not isinstance(msg, dict) else msg.get("content", "")
            if answer is None:
                answer = ""
            break

    return {
        "session_id": session_id,
        "question": body.question,
        "answer": answer,
    }


@router.get("/{session_id}/knowledge-graph")
async def get_knowledge_graph(session_id: str) -> dict[str, Any]:
    """Generate or return cached knowledge graph for visualization.

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

    return {
        "session_id": session_id,
        "graph": {"nodes": [], "edges": []},
        "cached": False,
        "note": "Knowledge graph generation not yet implemented",
    }

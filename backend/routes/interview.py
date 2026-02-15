"""Routes: interview — respond to questions, end interview.

Endpoints:
    POST /api/interview/{session_id}/respond
    POST /api/interview/{session_id}/end
    GET  /api/interview/{session_id}/status
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from langgraph.types import Command
from pydantic import BaseModel

from backend.graphs.registry import get_offboarding_graph
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/interview", tags=["interview"])


class InterviewResponse(BaseModel):
    user_response: str


@router.get("/{session_id}/status")
async def interview_status(session_id: str) -> dict[str, Any]:
    """Check if the interview is active and return the current question."""
    graph = get_offboarding_graph()
    config = {"configurable": {"thread_id": session_id}}

    try:
        graph_state = graph.get_state(config)
    except Exception as e:
        logger.debug("get_state failed for %s: %s", session_id, e)
        return {
            "session_id": session_id,
            "interview_active": False,
            "message": "Graph not started yet or session not found. Pipeline may still be running.",
        }

    # Check for interrupt (more reliable than .next alone)
    has_interrupt = False
    if hasattr(graph_state, "tasks"):
        for task in graph_state.tasks:
            if hasattr(task, "interrupts") and task.interrupts:
                has_interrupt = True
                break

    logger.debug(
        "Interview status for %s: next=%s, has_interrupt=%s",
        session_id, graph_state.next if graph_state else None, has_interrupt,
    )

    if not has_interrupt and (not graph_state or not graph_state.next):
        return {
            "session_id": session_id,
            "interview_active": False,
            "message": "No pending interview (graph may have completed or not started)",
        }

    # Check if the graph is actually paused at interview_loop
    next_nodes = list(graph_state.next) if graph_state and graph_state.next else []
    if not has_interrupt and "interview_loop" not in next_nodes:
        return {
            "session_id": session_id,
            "interview_active": False,
            "message": f"Pipeline is at node(s) {next_nodes}, not at interview yet.",
        }

    # Extract interrupt payload
    question_data = _extract_interrupt(graph_state)

    return {
        "session_id": session_id,
        "interview_active": True,
        "question": question_data,
    }


@router.post("/{session_id}/respond")
async def respond_to_question(
    session_id: str,
    body: InterviewResponse,
) -> dict[str, Any]:
    """Submit the user's answer to the current interview question.

    Resumes the LangGraph at the interrupt() point.  The graph will:
    1. Extract facts from the answer (LLM call)
    2. Update question status
    3. Select and rephrase the next question (2 LLM calls)
    4. Hit the next interrupt() — returning the new question here

    If the interview is complete (no more open questions or max rounds),
    the graph continues to generate_onboarding_package + build_qa_context
    and this endpoint returns {"interview_active": false}.
    """
    graph = get_offboarding_graph()
    config = {"configurable": {"thread_id": session_id}}

    # Verify graph is waiting at an interrupt
    graph_state = graph.get_state(config)
    has_pending = False
    if graph_state:
        if graph_state.next:
            has_pending = True
        elif hasattr(graph_state, "tasks"):
            for task in graph_state.tasks:
                if hasattr(task, "interrupts") and task.interrupts:
                    has_pending = True
                    break

    if not has_pending:
        raise HTTPException(
            status_code=400,
            detail="No pending interrupt. The interview may have ended or not started.",
        )

    logger.info(
        "Interview response for %s: %s",
        session_id,
        body.user_response[:100],
    )

    # Snapshot current facts count so we can return only NEW facts
    store = SessionStorage(session_id)
    prev_facts: list[str] = []
    if store.exists("interview/extracted_facts.json"):
        try:
            prev_facts = store.load_json("interview/extracted_facts.json")
        except Exception:
            pass
    prev_count = len(prev_facts)

    # Resume the graph with the user's response
    async for chunk in graph.astream(
        Command(resume=body.user_response),
        config,
        stream_mode="updates",
    ):
        for node_name, state_update in chunk.items():
            logger.info("Interview: node %s completed", node_name)

    # Check if graph is paused again (next question) or finished
    graph_state = graph.get_state(config)

    # Detect pending interrupt (more reliable than checking .next alone)
    has_interrupt = False
    if graph_state and hasattr(graph_state, "tasks"):
        for task in graph_state.tasks:
            if hasattr(task, "interrupts") and task.interrupts:
                has_interrupt = True
                break

    logger.info(
        "Post-respond state for %s: next=%s, has_interrupt=%s",
        session_id,
        graph_state.next if graph_state else None,
        has_interrupt,
    )

    if has_interrupt or (graph_state and graph_state.next):
        # Still in interview — extract the next question
        question_data = _extract_interrupt(graph_state)

        store.save_json("graph_state.json", {
            "status": "interview_active",
            "current_step": "interview_loop",
            "session_id": session_id,
        })

        # Read newly-extracted facts from persisted file
        all_facts: list[str] = []
        if store.exists("interview/extracted_facts.json"):
            try:
                all_facts = store.load_json("interview/extracted_facts.json")
            except Exception:
                pass
        new_facts = all_facts[prev_count:]  # only facts added this round

        return {
            "session_id": session_id,
            "interview_active": True,
            "question": question_data,
            "facts_extracted": new_facts,
            "all_facts": all_facts,
        }
    else:
        # Interview ended — graph continued to package + qa_context
        store.save_json("graph_state.json", {
            "status": "complete",
            "current_step": "done",
            "session_id": session_id,
        })

        return {
            "session_id": session_id,
            "interview_active": False,
            "message": "Interview complete. Onboarding deliverables generated.",
        }


@router.post("/{session_id}/end")
async def end_interview(session_id: str) -> dict[str, Any]:
    """Force-end the interview and proceed to package generation.

    Sends a special __END__ token as the resume value. The interview_loop
    node doesn't check for this directly — it processes it as a regular
    answer, but the answer will be meaningless. To truly skip, we resume
    with a signal and then the next loop iteration will find no open
    questions (since we mark them all as skipped here).
    """
    graph = get_offboarding_graph()
    config = {"configurable": {"thread_id": session_id}}
    store = SessionStorage(session_id)

    graph_state = graph.get_state(config)

    # Check for pending interrupt (more reliable than .next)
    has_pending = False
    if graph_state:
        if graph_state.next:
            has_pending = True
        elif hasattr(graph_state, "tasks"):
            for task in graph_state.tasks:
                if hasattr(task, "interrupts") and task.interrupts:
                    has_pending = True
                    break

    if not has_pending:
        return {
            "session_id": session_id,
            "status": "already_complete",
        }

    # Mark all open questions as skipped in the persisted backlog
    if store.exists("question_backlog.json"):
        backlog = store.load_json("question_backlog.json")
        for q in backlog:
            if q.get("status") == "open":
                q["status"] = "deferred"
        store.save_json("question_backlog.json", backlog)

    # Resume with end signal — the interview loop will process this answer
    # and then find no more open questions on the next iteration
    async for chunk in graph.astream(
        Command(resume="[USER_ENDED_INTERVIEW]"),
        config,
        stream_mode="updates",
    ):
        for node_name, _update in chunk.items():
            logger.info("End interview: node %s completed", node_name)

    # Verify graph completed (post-interview nodes should have run)
    final_state = graph.get_state(config)
    has_interrupt = False
    if final_state and hasattr(final_state, "tasks"):
        for task in final_state.tasks:
            if hasattr(task, "interrupts") and task.interrupts:
                has_interrupt = True
                break

    if has_interrupt:
        logger.warning(
            "Graph still has interrupt after end signal for %s — "
            "interview_loop may need another resume cycle",
            session_id,
        )

    store.save_json("graph_state.json", {
        "status": "complete",
        "current_step": "done",
        "session_id": session_id,
    })

    return {
        "session_id": session_id,
        "status": "interview_ended",
        "message": "Interview ended. Generating onboarding deliverables...",
    }


def _extract_interrupt(graph_state) -> dict:
    """Extract the interrupt payload (question info) from graph state."""
    if hasattr(graph_state, "tasks"):
        for task in graph_state.tasks:
            if hasattr(task, "interrupts"):
                for intr in task.interrupts:
                    return intr.value
    return {"question_text": "(Ready for your response)"}

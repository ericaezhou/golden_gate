"""Routes: offboarding — start pipeline, check status, stream progress.

Endpoints:
    POST /api/offboarding/start
    GET  /api/offboarding/{session_id}/status
    GET  /api/offboarding/{session_id}/stream
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from sse_starlette.sse import EventSourceResponse

from backend.graphs.offboarding_graph import build_offboarding_graph
from backend.services.storage import SessionStorage, create_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/offboarding", tags=["offboarding"])

# In-memory registry of running graph tasks per session
_running_tasks: dict[str, asyncio.Task] = {}


@router.post("/start")
async def start_offboarding(
    project_name: str = Form(...),
    role: str = Form(""),
    timeline: str = Form(""),
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    """Upload files and kick off the offboarding pipeline.

    Returns the session_id which is used for all subsequent calls.
    """
    store = create_session(project_name, role, timeline)
    session_id = store.session_id

    # Save uploaded files
    for f in files:
        content = await f.read()
        store.save_uploaded_file(f.filename or "unknown", content)
        logger.info("Saved file: %s (%d bytes)", f.filename, len(content))

    # Build and start the graph in background
    graph = build_offboarding_graph()
    initial_state = {
        "session_id": session_id,
        "project_metadata": {
            "project_name": project_name,
            "role": role,
            "timeline": timeline,
        },
        "structured_files": [],
        "deep_dive_reports": [],
        "question_backlog": [],
        "interview_transcript": [],
        "extracted_facts": [],
        "errors": [],
        "status": "started",
        "current_step": "parse_files",
    }

    # TODO: Run graph asynchronously and track state.
    #       For now, we just store the initial state.
    store.save_json("graph_state.json", initial_state)

    return {"session_id": session_id, "status": "started"}


@router.get("/{session_id}/status")
async def get_status(session_id: str) -> dict[str, Any]:
    """Return the current pipeline status."""
    store = SessionStorage(session_id)
    try:
        state = store.load_json("graph_state.json")
        return {
            "session_id": session_id,
            "current_step": state.get("current_step", "unknown"),
            "status": state.get("status", "unknown"),
            "errors": state.get("errors", []),
        }
    except FileNotFoundError:
        return {"session_id": session_id, "status": "not_found"}


@router.get("/{session_id}/stream")
async def stream_progress(session_id: str):
    """SSE stream of pipeline progress events.

    The frontend subscribes to this for real-time updates.

    TODO: Hook into the actual graph execution to emit events
          as each node starts/completes.
    """
    async def event_generator():
        # Placeholder: emit a single status event
        store = SessionStorage(session_id)
        try:
            state = store.load_json("graph_state.json")
            yield {
                "event": "status",
                "data": {
                    "step": state.get("current_step"),
                    "status": state.get("status"),
                },
            }
        except FileNotFoundError:
            yield {
                "event": "error",
                "data": {"message": f"Session {session_id} not found"},
            }

    return EventSourceResponse(event_generator())

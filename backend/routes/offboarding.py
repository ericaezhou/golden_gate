"""Routes: offboarding — start pipeline, check status, stream progress.

Endpoints:
    POST /api/offboarding/start
    GET  /api/offboarding/{session_id}/status
    GET  /api/offboarding/{session_id}/stream
    GET  /api/offboarding/demo-files
    GET  /api/offboarding/demo-files/{filename}
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from backend.config import settings
from backend.graphs.registry import get_offboarding_graph
from backend.services.storage import SessionStorage, create_session

DEMO_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/offboarding", tags=["offboarding"])

# In-memory registry of running graph tasks and event queues per session
_running_tasks: dict[str, asyncio.Task] = {}
_session_queues: dict[str, asyncio.Queue] = {}


def _get_queue(session_id: str) -> asyncio.Queue:
    """Get or create the SSE event queue for a session."""
    if session_id not in _session_queues:
        _session_queues[session_id] = asyncio.Queue()
    return _session_queues[session_id]


async def _run_pipeline(
    session_id: str,
    initial_state: dict,
) -> None:
    """Run the full LangGraph pipeline and push SSE events to the session queue.

    The pipeline runs until it hits the interview_loop's interrupt(),
    at which point an `interview_ready` event is emitted with the first
    question.  The interview route handles resuming from there.
    """
    queue = _get_queue(session_id)
    store = SessionStorage(session_id)
    graph = get_offboarding_graph()
    config = {"configurable": {"thread_id": session_id}}

    seen_files_parsed: set[str] = set()
    seen_deep_dives: set[str] = set()
    accumulated_reports: list[dict] = []
    file_id_to_name: dict[str, str] = {}

    try:
        logger.info("=== Pipeline START for session %s ===", session_id)
        await queue.put({
            "event": "step_started",
            "data": json.dumps({
                "step": "parse_files",
                "message": "Parsing uploaded files...",
            }),
        })

        async for chunk in graph.astream(initial_state, config, stream_mode="updates"):
            for node_name, state_update in chunk.items():
                logger.info(
                    "=== Node completed: %s | keys=%s ===",
                    node_name, list(state_update.keys()) if isinstance(state_update, dict) else type(state_update).__name__,
                )

                # Update graph_state.json with progress
                store.save_json("graph_state.json", {
                    "session_id": session_id,
                    "status": "running",
                    "current_step": node_name,
                })

                if node_name == "parse_files":
                    files = state_update.get("structured_files", [])
                    logger.info("parse_files produced %d structured files", len(files))
                    for f in files:
                        file_name = f.get("file_name", "") if isinstance(f, dict) else getattr(f, "file_name", "")
                        file_type = f.get("file_type", "") if isinstance(f, dict) else getattr(f, "file_type", "")
                        fid = f.get("file_id", "") if isinstance(f, dict) else getattr(f, "file_id", "")
                        if fid and file_name:
                            file_id_to_name[fid] = file_name
                        if file_name and file_name not in seen_files_parsed:
                            seen_files_parsed.add(file_name)
                            await queue.put({
                                "event": "file_parsed",
                                "data": json.dumps({
                                    "file_name": file_name,
                                    "file_type": file_type,
                                }),
                            })
                    await queue.put({
                        "event": "step_completed",
                        "data": json.dumps({
                            "step": "parse_files",
                            "message": f"Parsed {len(files)} files",
                        }),
                    })
                    # Update status so polling clients see the transition to deep_dive
                    store.save_json("graph_state.json", {
                        "session_id": session_id,
                        "status": "running",
                        "current_step": "deep_dive",
                    })
                    await queue.put({
                        "event": "step_started",
                        "data": json.dumps({
                            "step": "deep_dive",
                            "message": "Running deep-dive analysis...",
                        }),
                    })

                elif node_name == "file_deep_dive":
                    reports = state_update.get("deep_dive_reports", [])
                    for report in reports:
                        r = report if isinstance(report, dict) else report.model_dump()
                        accumulated_reports.append(r)
                        file_id = r.get("file_id", "")
                        pass_number = r.get("pass_number", 0)
                        key = f"{file_id}_pass{pass_number}"
                        if key not in seen_deep_dives:
                            seen_deep_dives.add(key)
                            original_name = file_id_to_name.get(file_id, file_id)
                            await queue.put({
                                "event": "deep_dive_pass",
                                "data": json.dumps({
                                    "file_name": original_name,
                                    "file_id": file_id,
                                    "pass_number": pass_number,
                                }),
                            })

                elif node_name == "collect_deep_dives":
                    await queue.put({
                        "event": "step_completed",
                        "data": json.dumps({
                            "step": "deep_dive",
                            "message": "Deep dives complete",
                        }),
                    })
                    await queue.put({
                        "event": "step_started",
                        "data": json.dumps({
                            "step": "identify_gaps",
                            "message": "Identifying knowledge gaps...",
                        }),
                    })

                elif node_name == "concatenate_deep_dives":
                    pass  # Intermediate step

                elif node_name == "global_summarize":
                    await queue.put({
                        "event": "step_completed",
                        "data": json.dumps({
                            "step": "identify_gaps",
                            "message": "Knowledge gaps identified",
                        }),
                    })
                    await queue.put({
                        "event": "step_started",
                        "data": json.dumps({
                            "step": "generate_questions",
                            "message": "Generating interview questions...",
                        }),
                    })

                elif node_name == "reconcile_questions":
                    questions = state_update.get("question_backlog", [])
                    open_qs = [
                        q for q in questions
                        if (q if isinstance(q, dict) else q.model_dump()).get("status", "") == "open"
                    ]
                    for q in open_qs[:settings.MAX_OPEN_QUESTIONS]:
                        qd = q if isinstance(q, dict) else q.model_dump()
                        q_fid = qd.get("source_file_id", "")
                        await queue.put({
                            "event": "question_discovered",
                            "data": json.dumps({
                                "question_text": qd.get("question_text", ""),
                                "source_file": file_id_to_name.get(q_fid, q_fid),
                                "priority": qd.get("priority", "P1"),
                            }),
                        })
                    await queue.put({
                        "event": "step_completed",
                        "data": json.dumps({
                            "step": "generate_questions",
                            "message": f"Generated {min(len(open_qs), settings.MAX_OPEN_QUESTIONS)} interview questions",
                        }),
                    })

                elif node_name == "interview_loop":
                    # interview_loop completed — post-interview nodes will follow
                    await queue.put({
                        "event": "step_completed",
                        "data": json.dumps({
                            "step": "interview",
                            "message": "Interview complete, generating deliverables...",
                        }),
                    })

                elif node_name in ("generate_onboarding_package", "build_qa_context"):
                    await queue.put({
                        "event": "deliverable_ready",
                        "data": json.dumps({
                            "deliverable": node_name,
                        }),
                    })

        # --- Check if the graph is paused at an interrupt (interview) ---
        graph_state = graph.get_state(config)
        if graph_state and graph_state.next:
            # Graph is paused — likely at interview_loop interrupt
            # Extract the interrupt payload (question info)
            interrupt_values = []
            if hasattr(graph_state, "tasks"):
                for task in graph_state.tasks:
                    if hasattr(task, "interrupts"):
                        for intr in task.interrupts:
                            interrupt_values.append(intr.value)

            question_data = interrupt_values[0] if interrupt_values else {
                "question_text": "(Interview ready — send your first response)",
            }

            store.save_json("graph_state.json", {
                "status": "interview_ready",
                "current_step": "interview_loop",
                "session_id": session_id,
            })

            await queue.put({
                "event": "interview_ready",
                "data": json.dumps({
                    "message": "Analysis complete. Interview ready.",
                    "question": question_data,
                }),
            })
            return  # Don't emit 'complete' — interview will resume later

        # If we get here, the graph ran to END (e.g. no questions to ask)
        store.save_json("graph_state.json", {
            "status": "complete",
            "current_step": "done",
            "session_id": session_id,
        })

        await queue.put({
            "event": "complete",
            "data": json.dumps({"message": "Pipeline complete (no interview needed)"}),
        })

    except Exception as e:
        logger.exception("Pipeline failed for session %s", session_id)
        store.save_json("graph_state.json", {
            "status": "error",
            "current_step": "error",
            "session_id": session_id,
            "error": str(e),
        })
        await queue.put({
            "event": "pipeline_error",
            "data": json.dumps({"message": str(e)}),
        })


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------
@router.get("/demo-files")
async def list_demo_files() -> list[str]:
    """Return filenames available in the demo data directory."""
    if not DEMO_DATA_DIR.is_dir():
        return []
    return sorted(
        f.name
        for f in DEMO_DATA_DIR.iterdir()
        if f.is_file() and not f.name.startswith(".")
    )


@router.get("/demo-files/{filename}")
async def get_demo_file(filename: str):
    """Serve a single demo file by name."""
    path = DEMO_DATA_DIR / filename
    if not path.is_file() or not path.resolve().is_relative_to(DEMO_DATA_DIR.resolve()):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=filename)


@router.post("/start")
async def start_offboarding(
    project_name: str = Form(...),
    role: str = Form(""),
    timeline: str = Form(""),
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    """Upload files and kick off the full offboarding pipeline.

    The pipeline runs parse → deep_dive → concat → global → reconcile →
    interview (pauses at interrupt) → package + qa_context.

    Returns the session_id used for all subsequent calls.
    """
    store = create_session(project_name, role, timeline)
    session_id = store.session_id

    # Save uploaded files
    for f in files:
        content = await f.read()
        store.save_uploaded_file(f.filename or "unknown", content)
        logger.info("Saved file: %s (%d bytes)", f.filename, len(content))

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

    store.save_json("graph_state.json", initial_state)

    # Run pipeline in background
    task = asyncio.create_task(_run_pipeline(session_id, initial_state))
    _running_tasks[session_id] = task

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
        }
    except FileNotFoundError:
        return {"session_id": session_id, "status": "not_found"}


@router.get("/{session_id}/stream")
async def stream_progress(session_id: str):
    """SSE stream of pipeline progress events.

    The frontend subscribes to this for real-time updates as
    graph nodes complete.
    """
    async def event_generator():
        queue = _get_queue(session_id)

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=600)
            except asyncio.TimeoutError:
                yield {
                    "event": "pipeline_error",
                    "data": json.dumps({"message": "Stream timeout (10min)"}),
                }
                _session_queues.pop(session_id, None)
                break

            yield event

            # Stop streaming on terminal events
            event_type = event.get("event", "")
            if event_type in ("complete", "pipeline_error", "interview_ready"):
                _session_queues.pop(session_id, None)
                break

    return EventSourceResponse(event_generator())

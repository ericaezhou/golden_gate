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

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from backend.config import settings
from backend.graphs.offboarding_graph import build_deep_dive_only_graph
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
    graph: Any,
    initial_state: dict,
) -> None:
    """Run the LangGraph pipeline and push SSE events to the session queue."""
    queue = _get_queue(session_id)
    store = SessionStorage(session_id)
    seen_files_parsed: set[str] = set()
    seen_deep_dives: set[str] = set()
    accumulated_reports: list[dict] = []
    file_id_to_name: dict[str, str] = {}  # hashed file_id → original filename

    try:
        await queue.put({
            "event": "step_started",
            "data": json.dumps({
                "step": "parse_files",
                "message": "Parsing uploaded files...",
            }),
        })

        async for chunk in graph.astream(initial_state, stream_mode="updates"):
            # chunk is {node_name: state_update}
            for node_name, state_update in chunk.items():
                logger.info("Graph node completed: %s", node_name)

                if node_name == "parse_files":
                    files = state_update.get("structured_files", [])
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
                    # Emit consolidated gaps from latest-pass-per-file
                    latest_by_file: dict[str, dict] = {}
                    for rpt in accumulated_reports:
                        fid = rpt.get("file_id", "")
                        pn = rpt.get("pass_number", 0)
                        existing = latest_by_file.get(fid)
                        if existing is None or pn > existing.get("pass_number", 0):
                            latest_by_file[fid] = rpt

                    for rd in latest_by_file.values():
                        fid = rd.get("file_id", "")
                        source_file = file_id_to_name.get(fid, fid)
                        for item in rd.get("at_risk_knowledge", []):
                            await queue.put({
                                "event": "gap_discovered",
                                "data": json.dumps({
                                    "text": item,
                                    "severity": "high",
                                    "source_file": source_file,
                                }),
                            })
                        for item in rd.get("fragile_points", []):
                            await queue.put({
                                "event": "gap_discovered",
                                "data": json.dumps({
                                    "text": item,
                                    "severity": "medium",
                                    "source_file": source_file,
                                }),
                            })
                        for item in rd.get("key_mechanics", []):
                            await queue.put({
                                "event": "gap_discovered",
                                "data": json.dumps({
                                    "text": item,
                                    "severity": "low",
                                    "source_file": source_file,
                                }),
                            })

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

                    # Emit questions from question_backlog (capped)
                    questions = state_update.get("question_backlog", [])
                    for q in questions[:settings.MAX_OPEN_QUESTIONS]:
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
                            "message": f"Generated {min(len(questions), settings.MAX_OPEN_QUESTIONS)} interview questions",
                        }),
                    })

        # Save final state
        store.save_json("graph_state.json", {
            **initial_state,
            "status": "complete",
            "current_step": "done",
        })

        await queue.put({
            "event": "complete",
            "data": json.dumps({"message": "Analysis complete"}),
        })

    except Exception as e:
        logger.exception("Pipeline failed for session %s", session_id)
        await queue.put({
            "event": "pipeline_error",
            "data": json.dumps({"message": str(e)}),
        })


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
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=filename)


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

    # Build truncated graph (parse → deep dives → concatenate only).
    # The full graph requires a checkpointer for interview_loop's interrupt().
    graph = build_deep_dive_only_graph()
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

    # Run graph asynchronously in background
    task = asyncio.create_task(_run_pipeline(session_id, graph, initial_state))
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
            "errors": state.get("errors", []),
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
                event = await asyncio.wait_for(queue.get(), timeout=300)
            except asyncio.TimeoutError:
                yield {
                    "event": "pipeline_error",
                    "data": json.dumps({"message": "Stream timeout"}),
                }
                _session_queues.pop(session_id, None)
                break

            yield event

            # Stop streaming on terminal events
            event_type = event.get("event", "")
            if event_type in ("complete", "pipeline_error"):
                _session_queues.pop(session_id, None)
                break

    return EventSourceResponse(event_generator())

"""Routes: session — inspect artifacts for any session.

Endpoints:
    GET /api/session/{session_id}/artifacts
    GET /api/session/{session_id}/file/{file_name}
"""

from __future__ import annotations

import logging
from typing import Any
import os
import json
from data_delivery.run import build_kg

from fastapi import APIRouter, HTTPException

from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/session", tags=["session"])


@router.get("/{session_id}/artifacts")
async def get_artifacts(session_id: str) -> dict[str, Any]:
    """Return all generated artifacts for a session.

    Useful for debugging and for the frontend to display results.
    """
    store = SessionStorage(session_id)

    artifacts: dict[str, Any] = {"session_id": session_id}

    # Metadata
    try:
        artifacts["metadata"] = store.load_json("metadata.json")
    except FileNotFoundError:
        return {"session_id": session_id, "error": "Session not found"}

    # Parsed files
    if store.exists("parsed"):
        parsed_dir = store.get_session_path() / "parsed"
        artifacts["parsed_files"] = [
            f.name for f in parsed_dir.iterdir() if f.suffix == ".json"
        ]

    # Deep dive corpus
    if store.exists("deep_dive_corpus.json"):
        artifacts["has_deep_dive_corpus"] = True

    # Global summary
    if store.exists("global_summary.json"):
        artifacts["has_global_summary"] = True

    # Question backlog
    if store.exists("question_backlog.json"):
        backlog = store.load_json("question_backlog.json")
        artifacts["question_count"] = len(backlog)

    # Interview
    if store.exists("interview/transcript.json"):
        transcript = store.load_json("interview/transcript.json")
        artifacts["interview_turns"] = len(transcript)

    # Onboarding package
    if store.exists("onboarding_package/package.json"):
        artifacts["has_onboarding_package"] = True

    return artifacts


@router.get("/{session_id}/file/{file_name}")
async def get_file_content(session_id: str, file_name: str) -> dict[str, Any]:
    """Return the parsed content and deep-dive analysis for a file.

    Looks up the file by original filename (e.g. 'loss_model.py') by
    scanning the parsed/ directory for a matching file_name field.
    """
    store = SessionStorage(session_id)

    if not store.exists("parsed"):
        raise HTTPException(status_code=404, detail="No parsed files found")

    parsed_dir = store.get_session_path() / "parsed"

    # Find the parsed JSON that matches the requested filename
    parsed_data: dict | None = None
    file_id: str = ""
    for p in parsed_dir.iterdir():
        if p.suffix != ".json":
            continue
        try:
            data = store.load_json(f"parsed/{p.name}")
            if isinstance(data, dict) and data.get("file_name") == file_name:
                parsed_data = data
                file_id = data.get("file_id", p.stem)
                break
        except Exception:
            continue

    if not parsed_data:
        raise HTTPException(status_code=404, detail=f"File '{file_name}' not found")

    # Extract the content for preview
    content = ""
    parsed_content = parsed_data.get("parsed_content", {})
    if isinstance(parsed_content, dict):
        content = parsed_content.get("content", "")

    # Load deep-dive analysis if available
    deep_dives: list[dict] = []
    if store.exists("deep_dives"):
        dd_dir = store.get_session_path() / "deep_dives"
        for dd_file in sorted(dd_dir.iterdir()):
            if dd_file.name.startswith(file_id) and dd_file.suffix == ".json":
                try:
                    dd_data = store.load_json(f"deep_dives/{dd_file.name}")
                    if isinstance(dd_data, dict):
                        deep_dives.append({
                            "pass_number": dd_data.get("pass_number"),
                            "purpose": dd_data.get("file_purpose_summary", ""),
                            "key_mechanics": dd_data.get("key_mechanics", []),
                            "fragile_points": dd_data.get("fragile_points", []),
                            "at_risk_knowledge": dd_data.get("at_risk_knowledge", []),
                        })
                except Exception:
                    continue

    return {
        "session_id": session_id,
        "file_name": file_name,
        "file_id": file_id,
        "file_type": parsed_data.get("file_type", ""),
        "content": content,
        "metadata": parsed_data.get("metadata", {}),
        "deep_dives": deep_dives,
    }


@router.get("/{session_id}/interview-summary")
async def get_interview_summary(session_id: str) -> dict[str, Any]:
    """Return the interview summary and extracted facts for a session.

    Used by the frontend Interview Summary page after the interview ends.
    """
    store = SessionStorage(session_id)

    interview_summary = ""
    if store.exists("interview/interview_summary.txt"):
        interview_summary = store.load_text("interview/interview_summary.txt")

    extracted_facts: list[str] = []
    if store.exists("interview/extracted_facts.json"):
        try:
            extracted_facts = store.load_json("interview/extracted_facts.json")
        except Exception:
            pass

    return {
        "session_id": session_id,
        "interview_summary": interview_summary,
        "extracted_facts": extracted_facts,
    }

@router.get("/{session_id}/kg")
async def get_kg(session_id: str) -> dict[str, Any]:
    """Return the knowledge graph for a session (cached only, no LLM).

    Returns { "session_id": str, "kg": { "nodes": [...], "edges": [...] } }.
    Tries: 1) session kg.json  2) knowledge_graph/graph.json  3) data/kg.json.
    To generate a graph, call GET /api/onboarding/{session_id}/knowledge-graph first.
    """
    store = SessionStorage(session_id)
    kg: dict[str, Any] = {"nodes": [], "edges": []}

    if store.exists("kg.json"):
        raw = store.load_json("kg.json")
        print(f"raw: {raw}")
        if isinstance(raw, dict) and ("nodes" in raw or "edges" in raw):
            kg = raw
            return {
                "session_id": session_id,
                "kg": kg,
            }
    if not kg.get("nodes") and store.exists("knowledge_graph/graph.json"):
        kg = store.load_json("knowledge_graph/graph.json")
    if not kg.get("nodes") and os.path.exists("data/kg.json"):
        with open("data/kg.json", "r") as f:
            data = json.load(f)
            raw = data.get("kg", data) if isinstance(data, dict) else {}
            if isinstance(raw, dict) and ("nodes" in raw or "edges" in raw):
                kg = raw
    interview_summary = store.load_text("interview/interview_summary.txt")
    kg = build_kg(interview_summary, os.path.join(str(store.root), "parsed"))
    if isinstance(kg, dict) and ("nodes" in kg or "edges" in kg):
        kg = kg
    else:
        kg = {
            "nodes": [],
            "edges": [],
        }
    store.save_json("kg.json", kg)
    return {
        "session_id": session_id,
        "kg": kg,
    }
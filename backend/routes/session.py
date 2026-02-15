"""Routes: session — inspect artifacts for any session.

Endpoints:
    GET /api/session/{session_id}/artifacts
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter

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

"""Routes: project ↔ session mapping for entry (off-boarding / on-boarding).

Endpoints:
    GET  /api/projects              — list all project names
    GET  /api/projects/session      — get session_id by project_name (for on-boarding)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.services.project_sessions import get_session_id_by_project, list_projects

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects_endpoint() -> dict:
    """List all registered project names (primary keys)."""
    return {"projects": list_projects()}


@router.get("/session")
def get_session_by_project(
    project_name: str = Query(..., description="Project name to look up"),
) -> dict:
    """Get session_id for an existing project (for on-boarding). 404 if not found."""
    session_id = get_session_id_by_project(project_name)
    if session_id is None:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_name}' not found. Run off-boarding first with this project name.",
        )
    return {"project_name": project_name.strip(), "session_id": session_id}

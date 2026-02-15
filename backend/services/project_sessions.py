"""Project name → session_id mapping (primary key: project_name).

Stored in data/project_info/project_sessions.json so off-boarding and on-boarding
can use the same session by project name when they are not in one flow.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_MAP_PATH = _PROJECT_ROOT / "data" / "project_info" / "project_sessions.json"


def _normalize_key(project_name: str) -> str:
    """Primary key: trimmed, no empty."""
    return project_name.strip() if project_name else ""


def _load_map() -> dict[str, str]:
    """Load project_name -> session_id from JSON. Returns {} if missing."""
    if not _MAP_PATH.exists():
        return {}
    try:
        data = json.loads(_MAP_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception as e:
        logger.warning("Failed to load project_info/project_sessions.json: %s", e)
        return {}


def _save_map(mapping: dict[str, str]) -> None:
    """Write mapping to JSON."""
    _MAP_PATH.parent.mkdir(parents=True, exist_ok=True)
    _MAP_PATH.write_text(
        json.dumps(mapping, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def get_session_id_by_project(project_name: str) -> str | None:
    """Return session_id for the given project name, or None if not found."""
    key = _normalize_key(project_name)
    if not key:
        return None
    mapping = _load_map()
    return mapping.get(key)


def register_project(project_name: str, session_id: str) -> bool:
    """Register project_name -> session_id. Returns False if project_name already exists."""
    key = _normalize_key(project_name)
    if not key:
        return False
    mapping = _load_map()
    if key in mapping:
        return False
    mapping[key] = session_id
    _save_map(mapping)
    return True


def list_projects() -> list[str]:
    """Return all registered project names (keys), sorted."""
    mapping = _load_map()
    return sorted(mapping.keys())

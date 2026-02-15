"""Node: parse_files — Step 1 of the offboarding pipeline.

Reads raw uploaded files, dispatches to the appropriate parser,
and produces a list of StructuredFile objects.

Owner: [assign team member]
"""

from __future__ import annotations

import hashlib
import logging

from backend.models.artifacts import StructuredFile
from backend.models.state import OffboardingState
from backend.parsers import parse_file
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


async def parse_files(state: OffboardingState) -> dict:
    """Parse all raw files in the session and return StructuredFile list.

    Reads from: state["session_id"], state["project_metadata"]
    Writes to:  state["structured_files"], state["status"], state["current_step"]
    Persists:   parsed/{file_id}.json for each file
    """
    session_id = state["session_id"]
    store = SessionStorage(session_id)
    raw_files = store.list_raw_files()
    logger.info("parse_files: found %d raw files for session %s", len(raw_files), session_id)

    structured_files: list[StructuredFile] = []
    errors: list[str] = []

    for raw_path in raw_files:
        file_id = _make_file_id(raw_path.name)
        try:
            result = parse_file(str(raw_path))
            sf = StructuredFile(
                file_id=file_id,
                file_name=raw_path.name,
                file_type=result.file_type,
                parsed_content={
                    "content": result.content,
                    "references": result.references,
                },
                metadata=result.metadata,
                raw_path=str(raw_path),
            )
            # Persist individual parsed file
            store.save_json(
                f"parsed/{file_id}.json",
                sf.model_dump(),
            )
            structured_files.append(sf)
            logger.info("Parsed: %s → %s", raw_path.name, file_id)

        except Exception as e:
            logger.error("Failed to parse %s: %s", raw_path.name, e)
            errors.append(f"Parse error for {raw_path.name}: {e}")
            # Create a partial StructuredFile so pipeline continues
            sf = StructuredFile(
                file_id=file_id,
                file_name=raw_path.name,
                file_type=raw_path.suffix.lstrip("."),
                parsed_content={"error": str(e)},
                raw_path=str(raw_path),
            )
            structured_files.append(sf)

    return {
        "structured_files": structured_files,
        "status": "parsed",
        "current_step": "parse_files",
        "errors": errors,
    }


def _make_file_id(filename: str) -> str:
    """Deterministic short ID from filename."""
    slug = filename.lower().replace(" ", "_")
    short_hash = hashlib.md5(slug.encode()).hexdigest()[:6]
    name_part = slug.rsplit(".", 1)[0][:30]
    return f"{name_part}_{short_hash}"

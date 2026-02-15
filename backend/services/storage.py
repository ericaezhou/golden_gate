"""Session storage service — read/write artifacts to the local filesystem.

Every node should use these helpers instead of raw open() / json.dump().
This keeps path logic centralized and makes it easy to swap to S3/GCS later.

Usage:
    from backend.services.storage import SessionStorage
    store = SessionStorage(session_id="abc123")
    store.save_json("parsed/file1.json", structured_file.model_dump())
    data = store.load_json("parsed/file1.json")
"""

from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path

from backend.config import settings


class SessionStorage:
    """File-based storage scoped to a single session."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.root = Path(settings.SESSIONS_DIR) / session_id
        self.root.mkdir(parents=True, exist_ok=True)

    # ---------- JSON helpers ----------

    def save_json(self, relative_path: str, data: dict | list) -> Path:
        """Write a dict/list as pretty-printed JSON."""
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(data, indent=2, default=str, ensure_ascii=False),
            encoding="utf-8",
        )
        return path

    def load_json(self, relative_path: str) -> dict | list:
        """Read a JSON file. Raises FileNotFoundError if missing."""
        path = self.root / relative_path
        return json.loads(path.read_text(encoding="utf-8"))

    def exists(self, relative_path: str) -> bool:
        return (self.root / relative_path).exists()

    # ---------- Text helpers ----------

    def save_text(self, relative_path: str, text: str) -> Path:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def load_text(self, relative_path: str) -> str:
        path = self.root / relative_path
        return path.read_text(encoding="utf-8")

    # ---------- File management ----------

    def save_uploaded_file(
        self, filename: str, content: bytes,
    ) -> Path:
        """Save an uploaded file to raw_files/.

        Sanitises the filename to prevent directory traversal attacks.
        """
        # Strip directory components and null bytes
        safe_name = Path(filename).name.replace("\x00", "")
        if not safe_name:
            safe_name = "unnamed_file"
        dest = self.root / "raw_files" / safe_name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        return dest

    def list_raw_files(self) -> list[Path]:
        """Return sorted list of files in raw_files/ (directories excluded)."""
        raw_dir = self.root / "raw_files"
        if not raw_dir.exists():
            return []
        return sorted(p for p in raw_dir.iterdir() if p.is_file())

    def get_session_path(self) -> Path:
        return self.root

    # ---------- Metadata ----------

    def save_metadata(self, metadata: dict) -> None:
        self.save_json("metadata.json", metadata)

    def load_metadata(self) -> dict:
        return self.load_json("metadata.json")


def create_session(
    project_name: str,
    role: str = "",
    timeline: str = "",
) -> SessionStorage:
    """Create a new session with a unique ID and initial metadata."""
    session_id = uuid.uuid4().hex[:12]
    store = SessionStorage(session_id)
    store.save_metadata({
        "session_id": session_id,
        "project_name": project_name,
        "role": role,
        "timeline": timeline,
        "status": "created",
    })
    return store


def get_session(session_id: str) -> SessionStorage:
    """Get an existing session. Raises if directory doesn't exist."""
    store = SessionStorage(session_id)
    if not store.root.exists():
        raise FileNotFoundError(f"Session {session_id} not found")
    return store

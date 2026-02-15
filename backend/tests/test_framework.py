"""Smoke tests — verify the framework imports and wires up correctly.

Run with:  uv run pytest backend/tests/test_framework.py -v
"""

from __future__ import annotations


# ------------------------------------------------------------------
# 1. Models import cleanly
# ------------------------------------------------------------------
def test_models_import():
    from backend.models import (
        DeepDiveReport,
        Evidence,
        InterviewTurn,
        OnboardingPackage,
        StructuredFile,
        Question,
        OffboardingState,
        OnboardingState,
        FileDeepDiveState,
    )
    # Sanity: create instances
    sf = StructuredFile(
        file_id="test",
        file_name="test.py",
        file_type="py",
    )
    assert sf.file_id == "test"

    q = Question(
        question_id="q1",
        question_text="Why?",
    )
    assert q.status.value == "open"
    assert q.priority.value == "P1"


# ------------------------------------------------------------------
# 2. Config loads defaults
# ------------------------------------------------------------------
def test_config_defaults():
    from backend.config import settings

    assert settings.LLM_MODEL == "gpt-4o"
    assert settings.MAX_INTERVIEW_ROUNDS == 10
    assert settings.MAX_OPEN_QUESTIONS == 8
    assert settings.DEEP_DIVE_PASSES_XLSX == 3
    assert settings.DEEP_DIVE_PASSES_DEFAULT == 2


# ------------------------------------------------------------------
# 3. Storage creates and reads sessions
# ------------------------------------------------------------------
def test_storage_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.config.settings.SESSIONS_DIR", str(tmp_path)
    )
    from backend.services.storage import create_session, get_session

    store = create_session("Test Project", role="analyst")
    sid = store.session_id
    assert (tmp_path / sid / "metadata.json").exists()

    # Roundtrip JSON
    store.save_json("test/data.json", {"key": "value"})
    loaded = store.load_json("test/data.json")
    assert loaded["key"] == "value"

    # Retrieve existing session
    store2 = get_session(sid)
    meta = store2.load_metadata()
    assert meta["project_name"] == "Test Project"


# ------------------------------------------------------------------
# 4. FastAPI app creates without errors
# ------------------------------------------------------------------
def test_fastapi_app_creates():
    from backend.main import app

    assert app.title == "Golden Gate — Knowledge Transfer Agent"
    # Verify routes are registered
    route_paths = [r.path for r in app.routes]
    assert "/api/health" in route_paths
    assert "/api/offboarding/start" in route_paths
    assert "/api/onboarding/{session_id}/ask" in route_paths


# ------------------------------------------------------------------
# 5. Parse node produces StructuredFiles
# ------------------------------------------------------------------
async def test_parse_files_node(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.config.settings.SESSIONS_DIR", str(tmp_path)
    )
    from backend.services.storage import create_session

    store = create_session("Parse Test")
    sid = store.session_id

    # Create a fake raw file
    store.save_uploaded_file("notes.md", b"# Hello\nSome notes here.")

    from backend.nodes.parse_files import parse_files

    state = {
        "session_id": sid,
        "project_metadata": {},
    }
    result = await parse_files(state)

    assert len(result["structured_files"]) == 1
    assert result["structured_files"][0].file_name == "notes.md"
    assert result["status"] == "parsed"


# ------------------------------------------------------------------
# 6. Deep dive routing logic
# ------------------------------------------------------------------
def test_deep_dive_should_continue():
    from backend.nodes.deep_dive import should_continue_passes
    from backend.models.artifacts import StructuredFile

    xlsx_file = StructuredFile(
        file_id="test", file_name="model.xlsx", file_type="xlsx"
    )
    py_file = StructuredFile(
        file_id="test", file_name="script.py", file_type="py"
    )

    # xlsx: 3 passes, so pass 3 should continue, pass 4 should stop
    assert should_continue_passes(
        {"file": xlsx_file, "pass_number": 3, "max_passes": 3}
    ) == "continue"
    assert should_continue_passes(
        {"file": xlsx_file, "pass_number": 4, "max_passes": 3}
    ) == "done"

    # py: 2 passes
    assert should_continue_passes(
        {"file": py_file, "pass_number": 2, "max_passes": 2}
    ) == "continue"
    assert should_continue_passes(
        {"file": py_file, "pass_number": 3, "max_passes": 2}
    ) == "done"

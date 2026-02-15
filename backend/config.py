"""Centralized configuration — loaded once, imported everywhere.

Usage:
    from backend.config import settings
    settings.OPENAI_API_KEY  # str

Loads .env from project root and from ../.env (parent dir) so OPENAI_API_KEY
is set before any module (e.g. data_delivery) creates an OpenAI client.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings

# Project root = directory containing backend/ (e.g. golden_gate)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Load .env from project root and from parent (../.env); later files override
_ENV_FILES = [
    _PROJECT_ROOT / ".env",
    _PROJECT_ROOT.parent / ".env",
]


class Settings(BaseSettings):
    """All tunables live here.  Override via .env or env vars."""

    # --- API keys ---
    OPENAI_API_KEY: str = ""

    # --- LLM settings ---
    LLM_MODEL: str = "gpt-5-mini"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 4096

    # --- Deep dive settings ---
    DEEP_DIVE_PASSES_XLSX: int = 3
    DEEP_DIVE_PASSES_DEFAULT: int = 2
    MAX_QUESTIONS_PER_FILE: int = 5

    # --- Question backlog ---
    MAX_OPEN_QUESTIONS: int = 8

    # --- Interview ---
    MAX_INTERVIEW_ROUNDS: int = 10
    # --- Storage ---
    SESSIONS_DIR: str = "data/sessions"

    # --- Server ---
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {
        "env_file": [str(p) for p in _ENV_FILES if p.exists()] or [".env"],
        "env_file_encoding": "utf-8",
    }


settings = Settings()

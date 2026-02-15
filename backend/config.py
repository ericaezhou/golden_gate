"""Centralized configuration — loaded once, imported everywhere.

Usage:
    from backend.config import settings
    settings.OPENAI_API_KEY  # str
"""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All tunables live here.  Override via .env or env vars."""

    # --- API keys ---
    OPENAI_API_KEY: str = ""

    # --- LLM settings ---
    LLM_MODEL: str = "gpt-4o"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 4096

    # --- Embedding settings ---
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # --- Deep dive settings ---
    DEEP_DIVE_PASSES_XLSX: int = 3
    DEEP_DIVE_PASSES_DEFAULT: int = 2
    MAX_QUESTIONS_PER_FILE: int = 5

    # --- Question backlog ---
    MAX_OPEN_QUESTIONS: int = 15

    # --- Interview ---
    MAX_INTERVIEW_ROUNDS: int = 10
    MAX_FOLLOWUPS_PER_QUESTION: int = 1

    # --- Storage ---
    SESSIONS_DIR: str = "data/sessions"

    # --- Server ---
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

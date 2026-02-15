"""FastAPI application entry point.

Run with:
    uv run uvicorn backend.main:app --reload --reload-dir backend --port 8000

Or via the project script:
    uv run serve
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# Load .env into os.environ before any module (e.g. data_delivery.kg) creates OpenAI()
from dotenv import load_dotenv

_root = Path(__file__).resolve().parent.parent
load_dotenv(_root / ".env")
load_dotenv(_root.parent / ".env")

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.routes import interview, offboarding, onboarding, session

# ------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# API key validation
# ------------------------------------------------------------------
if not settings.OPENAI_API_KEY:
    logger.warning(
        "OPENAI_API_KEY is not set. LLM calls will fail. "
        "Set it in .env or as an environment variable."
    )
else:
    logger.info(
        "OPENAI_API_KEY loaded (%d chars, starts with %s...)",
        len(settings.OPENAI_API_KEY), settings.OPENAI_API_KEY[:8],
    )

# ------------------------------------------------------------------
# App
# ------------------------------------------------------------------
app = FastAPI(
    title="Golden Gate — Knowledge Transfer Agent",
    version="0.1.0",
    description="Offboarding → Onboarding knowledge capture pipeline",
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Routers
# ------------------------------------------------------------------
app.include_router(offboarding.router)
app.include_router(interview.router)
app.include_router(onboarding.router)
app.include_router(session.router)


# ------------------------------------------------------------------
# Health check
# ------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ------------------------------------------------------------------
# CLI entry point
# ------------------------------------------------------------------
def start():
    """Entry point for `uv run serve`.

    reload_dirs restricts the file watcher to ONLY the backend/ source
    directory.  This prevents uploaded data files (e.g. .py files saved
    to data/sessions/) from triggering a reload that kills the pipeline.
    """
    import pathlib

    backend_dir = str(pathlib.Path(__file__).resolve().parent)
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        reload_dirs=[backend_dir],
    )


if __name__ == "__main__":
    start()

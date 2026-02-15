"""FastAPI application entry point.

Run with:
    uv run uvicorn backend.main:app --reload --reload-dir backend --port 8000

Or via the project script:
    uv run serve
"""

from __future__ import annotations

import logging

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
    """Entry point for `uv run serve`."""
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        reload_dirs=["backend"],
    )


if __name__ == "__main__":
    start()

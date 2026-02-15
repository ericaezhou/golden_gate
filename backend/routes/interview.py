"""Routes: interview — respond to questions, end interview.

Endpoints:
    POST /api/interview/{session_id}/respond
    POST /api/interview/{session_id}/end
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/interview", tags=["interview"])


class InterviewResponse(BaseModel):
    user_response: str


@router.post("/{session_id}/respond")
async def respond_to_question(
    session_id: str,
    body: InterviewResponse,
) -> dict[str, Any]:
    """Submit the user's answer to the current interview question.

    This resumes the LangGraph interview_loop node via interrupt().

    TODO: Wire into the actual LangGraph graph.invoke() resume.
          For now, just persists the response.
    """
    store = SessionStorage(session_id)

    # TODO: Resume graph with user_response
    logger.info(
        "Interview response for %s: %s",
        session_id,
        body.user_response[:100],
    )

    return {
        "session_id": session_id,
        "status": "response_received",
        "message": "TODO: resume graph and return next question",
    }


@router.post("/{session_id}/end")
async def end_interview(session_id: str) -> dict[str, Any]:
    """Force-end the interview and proceed to package generation.

    TODO: Signal the interview_loop node to break out of its loop
          and transition to generate_onboarding_package.
    """
    logger.info("Interview ended for session %s", session_id)

    return {
        "session_id": session_id,
        "status": "generating_package",
    }

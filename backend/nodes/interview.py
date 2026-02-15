"""Node: interview_loop — Step 4 of the offboarding pipeline.

Interactive, human-in-the-loop interview where the LLM asks questions
and the departing employee answers via the frontend chat UI.

Owner: [assign team member]
"""

from __future__ import annotations

import logging

from langgraph.types import interrupt

from backend.config import settings
from backend.models.artifacts import InterviewTurn
from backend.models.questions import Question, QuestionStatus
from backend.models.state import OffboardingState
from backend.services.llm import call_llm, call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


async def interview_loop(state: OffboardingState) -> dict:
    """Run the bounded interview loop.

    This node uses LangGraph's interrupt() to pause and wait for
    user input from the frontend.  The frontend POSTs to
    /api/interview/{session_id}/respond to resume.

    Termination conditions:
      1. No open P0/P1 questions remain
      2. rounds >= MAX_INTERVIEW_ROUNDS
      3. User explicitly ends (handled by the /end endpoint)

    Reads from: state["question_backlog"], state["session_id"]
    Writes to:  state["interview_transcript"], state["extracted_facts"],
                state["question_backlog"]

    TODO: Implement the actual LLM calls for question selection
          and fact extraction.
          See docs/implementation_design.md §4.6 for prompt templates.
    """
    session_id = state["session_id"]
    backlog: list[Question] = state.get("question_backlog", [])
    transcript: list[InterviewTurn] = state.get("interview_transcript", [])
    facts: list[str] = state.get("extracted_facts", [])
    store = SessionStorage(session_id)

    round_num = len(transcript)

    while round_num < settings.MAX_INTERVIEW_ROUNDS:
        # Find next open P0/P1 question
        open_qs = [
            q for q in backlog
            if q.status == QuestionStatus.OPEN
            and q.priority.value in ("P0", "P1")
        ]
        if not open_qs:
            logger.info("No more open P0/P1 questions. Ending interview.")
            break

        next_q = open_qs[0]

        # TODO: Use LLM to rephrase the question conversationally
        question_text = next_q.question_text

        # Pause and wait for user response
        user_response = interrupt({
            "question_id": next_q.question_id,
            "question_text": question_text,
            "round": round_num + 1,
            "remaining": len(open_qs) - 1,
        })

        # TODO: Use LLM to extract structured facts from the response
        extracted = [f"[TODO] Extract facts from: {user_response[:100]}"]

        # Build interview turn
        turn = InterviewTurn(
            turn_id=round_num + 1,
            question_id=next_q.question_id,
            question_text=question_text,
            user_response=user_response,
            extracted_facts=extracted,
        )
        transcript.append(turn)
        facts.extend(extracted)

        # Update question status
        next_q.status = QuestionStatus.ANSWERED_BY_INTERVIEW
        next_q.answer = user_response
        next_q.confidence = 0.5  # TODO: LLM-assessed confidence

        round_num += 1

        # Persist after each turn
        store.save_json(
            "interview/transcript.json",
            [t.model_dump() for t in transcript],
        )
        store.save_json("interview/extracted_facts.json", facts)
        store.save_json(
            "question_backlog.json",
            [q.model_dump() for q in backlog],
        )

    return {
        "interview_transcript": transcript,
        "extracted_facts": facts,
        "question_backlog": backlog,
        "status": "interview_complete",
        "current_step": "interview_loop",
    }

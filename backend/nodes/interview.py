"""Node: interview_loop — Step 4 of the offboarding pipeline.

Interactive, human-in-the-loop interview designed as a warm, context-aware
conversational experience that maximizes knowledge extraction.

The interviewer:
  - Knows the project deeply (references specific files, formulas, thresholds)
  - Remembers and builds on every previous answer
  - Picks the best next question for natural conversational flow (LLM-driven)
  - Discovers new knowledge gaps from answers in real time
  - Follows up naturally when answers are incomplete

Three LLM calls per round:
  1. Select the best next question for conversational flow
  2. Rephrase it conversationally with project context + conversation memory
  3. Extract facts, assess confidence, discover new questions, generate follow-up

Reference: docs/implementation_design.md §4.6
"""

from __future__ import annotations

import logging
import uuid

from langgraph.types import interrupt

from backend.config import settings
from backend.models.artifacts import InterviewTurn
from backend.models.questions import (
    Question,
    QuestionOrigin,
    QuestionPriority,
    QuestionStatus,
)
from backend.models.state import OffboardingState
from backend.services.llm import call_llm, call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# DEMO MODE: Hardcoded questions for hackathon demo
# ------------------------------------------------------------------
DEMO_MODE = True  # Set to False to use real LLM question generation

DEMO_QUESTIONS = [
    {
        "round": 1,
        "question_text": "Thank you so much for taking the time to share your insights today. I've had a chance to look through your project files, and I really appreciate the complexity and thoughtfulness of your work. I'd love to dive into the specifics of the workflow document. Could you explain the exact criteria you use for switching supplier timing from normal to volatile conditions? This seems like a critical decision point, and your expertise would be invaluable in understanding it fully.",
        "source_file": "workflow.txt"
    },
    {
        "round": 2,
        "question_text": "That's really insightful how you use the 4-quarter shortcut under stable conditions, especially with the specific criteria you mentioned for GDP growth and unemployment. Building on that, I'd like to understand more about the overlay decision process. Could you explain the buffer percentage you apply for new products? It seems like this is an important factor in ensuring the model's accuracy for emerging segments.",
        "source_file": "loss_model.py"
    }
]

# ------------------------------------------------------------------
# Prompt 1: Select the best next question for conversational flow
# ------------------------------------------------------------------
SELECT_QUESTION_SYSTEM = """\
You are managing the flow of a knowledge-transfer interview. Given the \
open questions and the conversation so far, pick the BEST question to \
ask next.

Prioritize:
1. P0 questions over P1 (knowledge at highest risk of being lost)
2. Topical continuity — if the last answer touched on a related topic, \
   pick a question that naturally follows from it
3. Follow-up questions from previous vague answers (origin=follow_up) \
   should be asked immediately after their parent question

Return JSON with exactly one key:
{
  "selected_question_id": "<question_id of the best next question>"
}"""

# ------------------------------------------------------------------
# Prompt 2: Rephrase question with project context + conversation memory
# ------------------------------------------------------------------
REPHRASE_SYSTEM = """\
You are conducting a warm, professional knowledge-transfer interview \
with a departing employee. You have deeply analyzed their project files \
and understand the work. Your goal is to capture institutional knowledge \
that would otherwise be lost — and to make the employee feel genuinely \
appreciated for sharing it.

You will receive:
- The conversation so far (previous questions and answers)
- Project context from your analysis of their files
- The raw analytical question to ask
- How many questions remain

Generate a natural, conversational message that:

1. If this is NOT the first question, briefly ACKNOWLEDGE the previous \
   answer — reference something SPECIFIC they said to show you were \
   truly listening. Not generic ("Great answer!") but substantive \
   ("That's really interesting that the 0.3 threshold came from the \
   2019 calibration — ").

2. TRANSITION smoothly to the next topic. If related to what they just \
   said, connect them naturally ("Building on that..."). If switching \
   topics, use a gentle bridge ("I'd love to shift to something I \
   noticed in [specific file]...").

3. ASK the question in a way that shows you understand the project. \
   Reference specific files, formulas, thresholds, or code you noticed \
   in your analysis. This makes the employee feel like they're talking \
   to a knowledgeable colleague, not filling out a survey.

4. If questions are running low (1-2 remaining), subtly let them know \
   you're almost done — "Just a couple more things I'd love your \
   insight on..."

If this IS the first question, open warmly: thank them for their time, \
briefly mention you've reviewed their files, and ask the first question \
with a specific reference to something you found.

Rules:
- Keep it concise — 2-4 sentences max
- Ask ONE clear question — never bundle multiple
- Sound like a thoughtful senior colleague, not a chatbot
- Show genuine intellectual curiosity about their work
- Never say "Based on my analysis" or reveal you are an AI
- Use "you" and "your" — make it personal and warm

Return ONLY the message text, no JSON or formatting."""

# ------------------------------------------------------------------
# Prompt 3: Extract facts, assess confidence, discover new Qs, follow-up
# ------------------------------------------------------------------
EXTRACT_FACTS_SYSTEM = """\
You are a knowledge extraction specialist analyzing an interview \
response from a departing employee. Your job is to capture EVERY \
piece of institutional knowledge from their answer.

Return JSON with exactly these keys:

{
  "facts": ["<fact 1>", "<fact 2>", ...],
  "confidence": "high" | "medium" | "low",
  "follow_up": "<follow-up question or null>",
  "discovered_questions": [
    {
      "text": "<new question discovered from this answer>",
      "priority": "P0" | "P1"
    }
  ]
}

Guidelines:

facts:
- Extract EVERY concrete, actionable piece of knowledge.
- Each fact must stand alone — include enough context that someone \
  reading just this fact would understand it fully.
- Capture: decisions and WHY they were made, specific numbers/ \
  thresholds and their origin, rules/heuristics ("if X then do Y"), \
  workflow steps and their order, key people and their roles, \
  external dependencies, manual overrides, gotchas/failure modes, \
  stakeholder constraints, historical context.
- Prefer specifics over generalities. "The loss threshold is 0.3 \
  because it was calibrated against 2019 Q4 actuals" is far better \
  than "There is a loss threshold."
- If the employee tells a story or gives an example, extract the \
  underlying rule or principle, not just the anecdote.

confidence:
- "high": clear, specific, and complete answer
- "medium": useful information but some gaps or ambiguity remain
- "low": vague, deflected, or "I don't remember"

follow_up:
- Generate a warm, specific follow-up question if confidence is \
  "low" OR "medium" — there may be more to extract.
- For "medium": gently probe the gap ("You mentioned X depends on \
  a manual check — could you walk me through what that looks like?")
- For "low": try a different angle ("No worries if it's fuzzy — \
  do you remember roughly when that decision was made, or who else \
  might know?")
- For "high": set to null
- Never sound interrogative — frame as genuine curiosity

discovered_questions:
- If the answer reveals NEW knowledge gaps not covered by the \
  original questions, add them here. Examples:
  - They mention a person/system/process you didn't know about
  - They reference a decision or rule that raises new questions
  - They hint at something complex ("it's a whole thing with Finance")
- Only add genuinely new, non-obvious questions
- Set to empty array [] if nothing new was revealed"""

CONFIDENCE_MAP = {"high": 0.9, "medium": 0.6, "low": 0.3}

# ------------------------------------------------------------------
# Prompt: Generate a synthesized interview summary
# ------------------------------------------------------------------
SUMMARY_SYSTEM = """\
You are writing a concise summary of a knowledge-transfer interview \
for a project handoff document. The audience is a new team member \
who will take over this work.

Given the full interview transcript, produce a clear, well-organized \
summary that captures:

1. Key decisions and their rationale
2. Undocumented rules, heuristics, and manual processes
3. Critical dependencies and stakeholder relationships
4. Risks, gotchas, and failure modes
5. Historical context that explains current state

Write in clear prose, organized by topic (not chronologically). \
Use bullet points for lists of facts. Attribute knowledge where \
relevant ("The previous owner noted that...").

Return ONLY the summary text, no JSON."""


# ------------------------------------------------------------------
# Core interview loop
# ------------------------------------------------------------------
async def interview_loop(state: OffboardingState) -> dict:
    """Run the bounded, conversational interview loop.

    This node uses LangGraph's interrupt() to pause and wait for
    user input from the frontend.  The frontend POSTs to
    /api/interview/{session_id}/respond to resume.

    Termination conditions:
      1. No open P0/P1 questions remain
      2. rounds >= MAX_INTERVIEW_ROUNDS
      3. User explicitly ends (handled by the /end endpoint)

    Reads from: state["question_backlog"], state["session_id"],
                state["deep_dive_corpus"], state["global_summary"]
    Writes to:  state["interview_transcript"], state["extracted_facts"],
                state["question_backlog"], state["interview_summary"]
    Persists:   interview/transcript.json, interview/extracted_facts.json,
                question_backlog.json, interview/interview_summary.txt
    """
    session_id = state["session_id"]
    backlog: list[Question] = state.get("question_backlog", [])
    transcript: list[InterviewTurn] = state.get("interview_transcript", [])
    facts: list[str] = state.get("extracted_facts", [])
    corpus = state.get("deep_dive_corpus", "")
    global_summary = state.get("global_summary", "")
    store = SessionStorage(session_id)

    # Load file_id → original filename mapping for citations
    file_id_map: dict[str, str] = {}
    if store.exists("file_id_map.json"):
        try:
            file_id_map = store.load_json("file_id_map.json")
        except Exception:
            pass
    # Fallback: build from structured_files in state
    if not file_id_map:
        for sf in state.get("structured_files", []):
            fid = sf.get("file_id", "") if isinstance(sf, dict) else getattr(sf, "file_id", "")
            fname = sf.get("file_name", "") if isinstance(sf, dict) else getattr(sf, "file_name", "")
            if fid and fname:
                file_id_map[fid] = fname

    # Truncate corpus for prompt context (keep it focused)
    project_context = _build_project_context(corpus, global_summary)

    round_num = len(transcript)
    open_qs: list = []

    while round_num < settings.MAX_INTERVIEW_ROUNDS:
        # --- DEMO MODE: Use hardcoded questions for first 2 rounds only ---
        if DEMO_MODE and round_num < len(DEMO_QUESTIONS):
            demo_q = DEMO_QUESTIONS[round_num]
            question_text = demo_q["question_text"]
            source_display = demo_q["source_file"]

            # Create a dummy Question object for the transcript
            next_q = Question(
                question_id=f"demo_q{round_num + 1}",
                question_text=question_text,
                source_file_id=demo_q["source_file"],
                origin=QuestionOrigin.PER_FILE,
                priority=QuestionPriority.P0,
                status=QuestionStatus.OPEN,
            )
        else:
            # Normal mode OR after first 2 hardcoded questions: use LLM generation
            # Find open P0/P1 questions
            open_qs = _get_open_questions(backlog)
            if not open_qs:
                logger.info("No more open P0/P1 questions. Ending interview.")
                break

            # --- LLM Call 1: Select best next question for flow ---
            next_q = await _select_next_question(open_qs, transcript)

            # --- LLM Call 2: Rephrase with project context + conversation ---
            conversation_context = _build_conversation_context(transcript)
            question_text = await _rephrase_question(
                raw_question=next_q.question_text,
                conversation_context=conversation_context,
                project_context=project_context,
                remaining=len(open_qs) - 1,
            )

            # Resolve file_id to human-readable filename for the frontend
            raw_file_id = next_q.source_file_id or ""
            source_display = file_id_map.get(raw_file_id, raw_file_id)

        # For discovered/follow-up questions that lost their source_file_id,
        # try to infer from the most recent conversation context
        if not source_display and transcript:
            last_turn = transcript[-1]
            # Use the previous question's source as context
            for q in backlog:
                if q.question_id == last_turn.question_id and q.source_file_id:
                    source_display = file_id_map.get(q.source_file_id, q.source_file_id)
                    break

        # Pause and wait for user response via frontend
        remaining = (len(open_qs) - 1) if open_qs else 0
        user_response = interrupt({
            "question_id": next_q.question_id,
            "question_text": question_text,
            "source_file": source_display,
            "raw_question": next_q.question_text,
            "round": round_num + 1,
            "remaining": remaining,
        })

        # Check for end signal from /end endpoint
        if isinstance(user_response, str) and user_response == "[USER_ENDED_INTERVIEW]":
            logger.info("User ended interview early for session %s", session_id)
            # Mark remaining open questions as deprioritized
            for q in backlog:
                if q.status == QuestionStatus.OPEN:
                    q.status = QuestionStatus.DEPRIORITIZED
            break

        # --- LLM Call 3: Extract facts + confidence + follow-up + new Qs ---
        extraction = await _extract_facts(
            question_text=next_q.question_text,
            user_response=user_response,
        )

        extracted = extraction.get("facts", [])
        confidence_str = extraction.get("confidence", "medium")
        confidence = CONFIDENCE_MAP.get(confidence_str, 0.6)
        follow_up_text = extraction.get("follow_up")
        discovered = extraction.get("discovered_questions", [])

        # Build interview turn
        turn = InterviewTurn(
            turn_id=round_num + 1,
            question_id=next_q.question_id,
            question_text=question_text,
            user_response=user_response,
            extracted_facts=extracted,
            follow_up=follow_up_text,
        )
        transcript.append(turn)
        facts.extend(extracted)

        # Update question status
        next_q.status = QuestionStatus.ANSWERED_BY_INTERVIEW
        next_q.answer = user_response
        next_q.confidence = confidence

        # Add follow-up if answer was vague or incomplete
        if follow_up_text and confidence_str in ("low", "medium"):
            _add_follow_up(backlog, next_q, follow_up_text)

        # Add newly discovered questions from this answer
        for dq in discovered:
            _add_discovered_question(backlog, dq, parent_file_id=next_q.source_file_id)

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

        logger.info(
            "Interview round %d complete for session %s: "
            "confidence=%s, %d facts, %d discovered Qs, follow_up=%s",
            round_num, session_id, confidence_str,
            len(extracted), len(discovered), bool(follow_up_text),
        )

    # --- LLM Call: Generate synthesized interview summary ---
    interview_summary = await _generate_summary(transcript)
    store.save_text("interview/interview_summary.txt", interview_summary)

    logger.info(
        "Interview complete for session %s: %d rounds, %d total facts",
        session_id, round_num, len(facts),
    )

    return {
        "interview_transcript": transcript,
        "extracted_facts": facts,
        "interview_summary": interview_summary,
        "question_backlog": backlog,
        "status": "interview_complete",
        "current_step": "interview_loop",
    }


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _get_open_questions(backlog: list[Question]) -> list[Question]:
    """Get open P0/P1 questions, sorted P0 first then P1."""
    priority_order = {QuestionPriority.P0: 0, QuestionPriority.P1: 1}
    open_qs = [
        q for q in backlog
        if q.status == QuestionStatus.OPEN
        and q.priority in (QuestionPriority.P0, QuestionPriority.P1)
    ]
    open_qs.sort(key=lambda q: priority_order.get(q.priority, 9))
    return open_qs


def _build_project_context(corpus: str, global_summary: str) -> str:
    """Build a truncated project context for the rephrase prompt."""
    max_corpus = 3000
    max_summary = 1500
    parts = []
    if global_summary:
        summary_text = global_summary[:max_summary]
        if len(global_summary) > max_summary:
            summary_text += "\n... [truncated]"
        parts.append(f"Project overview:\n{summary_text}")
    if corpus:
        corpus_text = corpus[:max_corpus]
        if len(corpus) > max_corpus:
            corpus_text += "\n... [truncated]"
        parts.append(f"File analysis highlights:\n{corpus_text}")
    return "\n\n".join(parts) if parts else "(No project context available)"


def _build_conversation_context(transcript: list[InterviewTurn]) -> str:
    """Build a readable conversation history for the LLM."""
    if not transcript:
        return "(This is the start of the interview — no prior conversation.)"

    lines = []
    for t in transcript:
        lines.append(f"Interviewer: {t.question_text}")
        lines.append(f"Employee: {t.user_response}")
        lines.append("")
    return "\n".join(lines).strip()


async def _select_next_question(
    open_qs: list[Question],
    transcript: list[InterviewTurn],
) -> Question:
    """LLM call 1: Pick the best next question for conversational flow."""
    if len(open_qs) == 1:
        return open_qs[0]

    # Build question list for LLM
    q_list = "\n".join(
        f"- [{q.question_id}] (priority={q.priority.value}, "
        f"origin={q.origin.value}): {q.question_text}"
        for q in open_qs
    )

    # Recent conversation context (last 2 turns for relevance)
    recent = ""
    if transcript:
        last = transcript[-1]
        recent = (
            f"Last question asked: {last.question_text}\n"
            f"Employee's answer: {last.user_response}"
        )

    user_prompt = (
        f"Open questions:\n{q_list}\n\n"
        f"Recent conversation:\n{recent if recent else '(first question)'}"
    )

    try:
        result = await call_llm_json(SELECT_QUESTION_SYSTEM, user_prompt)
        selected_id = result.get("selected_question_id", "")
        for q in open_qs:
            if q.question_id == selected_id:
                return q
    except (ValueError, KeyError):
        logger.warning("Question selection LLM failed, falling back to P0 first")

    return open_qs[0]


async def _rephrase_question(
    raw_question: str,
    conversation_context: str,
    project_context: str,
    remaining: int,
) -> str:
    """LLM call 2: Rephrase a raw question conversationally with project awareness."""
    user_prompt = (
        f"## Project context (from your analysis of their files)\n"
        f"{project_context}\n\n"
        f"## Conversation so far\n{conversation_context}\n\n"
        f"## Raw question to ask next\n{raw_question}\n\n"
        f"## Questions remaining after this one: {remaining}"
    )
    rephrased = await call_llm(REPHRASE_SYSTEM, user_prompt)
    return rephrased.strip()


async def _extract_facts(
    question_text: str,
    user_response: str,
) -> dict:
    """LLM call 3: Extract facts, confidence, follow-up, and new questions."""
    user_prompt = (
        f"Interview question:\n\"{question_text}\"\n\n"
        f"Employee's response:\n\"{user_response}\""
    )
    return await call_llm_json(EXTRACT_FACTS_SYSTEM, user_prompt)


def _add_follow_up(
    backlog: list[Question],
    parent_q: Question,
    follow_up_text: str,
) -> None:
    """Add a follow-up question to the backlog."""
    follow_up_q = Question(
        question_id=f"followup-{uuid.uuid4().hex[:8]}",
        question_text=follow_up_text,
        origin=QuestionOrigin.FOLLOW_UP,
        source_file_id=parent_q.source_file_id,
        priority=QuestionPriority.P0,
        status=QuestionStatus.OPEN,
    )
    backlog.append(follow_up_q)
    logger.info(
        "Added follow-up %s for question %s",
        follow_up_q.question_id, parent_q.question_id,
    )


def _add_discovered_question(
    backlog: list[Question],
    dq: dict,
    parent_file_id: str | None = None,
) -> None:
    """Add a newly discovered question to the backlog."""
    priority_str = dq.get("priority", "P1")
    try:
        priority = QuestionPriority(priority_str)
    except ValueError:
        priority = QuestionPriority.P1

    new_q = Question(
        question_id=f"discovered-{uuid.uuid4().hex[:8]}",
        question_text=dq.get("text", ""),
        origin=QuestionOrigin.FOLLOW_UP,
        source_file_id=parent_file_id,
        priority=priority,
        status=QuestionStatus.OPEN,
    )
    backlog.append(new_q)
    logger.info("Discovered new question %s from interview answer", new_q.question_id)


async def _generate_summary(transcript: list[InterviewTurn]) -> str:
    """Generate an LLM-synthesized interview summary (not just Q&A dump)."""
    if not transcript:
        return "(No interview conducted)"

    # Build transcript text for the LLM
    transcript_text = []
    for t in transcript:
        transcript_text.append(f"Q: {t.question_text}")
        transcript_text.append(f"A: {t.user_response}")
        if t.extracted_facts:
            transcript_text.append("Extracted facts:")
            for fact in t.extracted_facts:
                transcript_text.append(f"  - {fact}")
        transcript_text.append("")

    user_prompt = (
        f"Interview transcript ({len(transcript)} rounds):\n\n"
        + "\n".join(transcript_text)
    )

    try:
        return await call_llm(SUMMARY_SYSTEM, user_prompt)
    except (ValueError, Exception) as e:
        logger.warning("Summary generation failed (%s), using fallback", e)
        return _fallback_summary(transcript)


def _fallback_summary(transcript: list[InterviewTurn]) -> str:
    """Plain-text fallback if LLM summary generation fails."""
    lines = []
    for t in transcript:
        lines.append(f"Q: {t.question_text}")
        lines.append(f"A: {t.user_response}")
        if t.extracted_facts:
            lines.append("Key facts:")
            for fact in t.extracted_facts:
                lines.append(f"  - {fact}")
        lines.append("")
    return "\n".join(lines).strip()

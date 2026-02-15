"""Node: deep_dive — Step 2 of the offboarding pipeline.

Runs iterative LLM analysis on a single file (multiple passes).
This is called once per file via LangGraph fan-out.

Owner: [assign team member]
"""

from __future__ import annotations

import json
import logging

from backend.config import settings
from backend.models.artifacts import DeepDiveReport, StructuredFile
from backend.models.state import FileDeepDiveState
from backend.services.llm import call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Prompt templates
# ------------------------------------------------------------------
SYSTEM_PROMPT = """You are a senior knowledge analyst performing a structured review of project files before an employee departs. Your goal is to extract knowledge that would be lost if the author left. Be specific and evidence-based. Return valid JSON.

IMPORTANT: All questions you generate must be specific and closed-ended — they should ask about a concrete value, decision, threshold, process, or fact that has a definitive answer. Never ask open-ended questions like "Can you explain..." or "What is your approach to...". Instead ask things like "What is the threshold value for X?" or "Which team receives the output of Y?" or "How often is the Z override applied?"."""

PASS_1_USER_TEMPLATE = """You are analyzing a {file_type} file named "{file_name}".
Here is its structured content:

{parsed_content}

Analyze this file and return a JSON object with EXACTLY these fields:

{{
  "file_purpose_summary": "string — What is this file? What does it do?",
  "key_mechanics": ["string — Core logic, formulas, workflows, key operations"],
  "fragile_points": ["string — What looks brittle, manual, or error-prone?"],
  "at_risk_knowledge": ["string — Decisions or heuristics that would be lost if the author left"],
  "questions": [{{"text": "A specific, closed-ended question targeting a concrete fact, value, or decision", "evidence": "Quote or reference from the file"}}],
  "cumulative_summary": "string — A concise summary of your findings"
}}

Return at most {max_questions} questions. Return ONLY the JSON object, no other text."""

PASS_2_USER_TEMPLATE = """You previously analyzed a {file_type} file named "{file_name}" and produced this report:

{previous_report}

Now re-read the file with fresh eyes:

{parsed_content}

Focus on what you MISSED the first time:
- Assumptions embedded in formulas, constants, or magic numbers
- Implicit dependencies on external data, APIs, or other files
- Manual steps that aren't documented anywhere
- Edge cases or failure modes

Return a JSON object with EXACTLY these fields (ADD only NEW findings — do not repeat items from your first pass):

{{
  "file_purpose_summary": "string",
  "key_mechanics": ["string"],
  "fragile_points": ["string"],
  "at_risk_knowledge": ["string"],
  "questions": [{{"text": "string", "evidence": "string"}}],
  "cumulative_summary": "string"
}}

Return at most {max_questions} NEW questions. Return ONLY the JSON object, no other text."""

PASS_3_USER_TEMPLATE = """Final analysis pass for {file_type} file "{file_name}".

Your previous analyses:
Pass 1: {pass_1_report}
Pass 2: {pass_2_report}

Original file content:
{parsed_content}

Focus exclusively on tacit knowledge extraction:
- Why specific numbers, thresholds, or constants were chosen
- Override rules or manual adjustments that happen periodically
- Political or stakeholder context affecting decisions in this file
- "If X happens, do Y" heuristics that only the author knows

Return a JSON object with EXACTLY these fields (questions ranked by risk of knowledge loss, highest first):

{{
  "file_purpose_summary": "string",
  "key_mechanics": ["string"],
  "fragile_points": ["string"],
  "at_risk_knowledge": ["string"],
  "questions": [{{"text": "string", "evidence": "string"}}],
  "cumulative_summary": "string"
}}

Return at most {max_questions} NEW questions. Return ONLY the JSON object, no other text."""

MAX_CONTENT_CHARS = 12_000


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _serialize_content(file: StructuredFile) -> str:
    """Convert parsed_content dict to a readable string for prompts.

    Truncates if the content exceeds MAX_CONTENT_CHARS to stay within
    token limits while leaving room for the response.
    """
    raw = json.dumps(file.parsed_content, indent=2, default=str, ensure_ascii=False)
    if len(raw) > MAX_CONTENT_CHARS:
        raw = raw[:MAX_CONTENT_CHARS] + "\n... [truncated]"
    return raw


def _serialize_report(report: DeepDiveReport) -> str:
    """Format a previous pass report as readable text for inclusion in prompts."""
    lines = [
        f"File Purpose: {report.file_purpose_summary}",
        "",
        "Key Mechanics:",
        *[f"  - {m}" for m in report.key_mechanics],
        "",
        "Fragile Points:",
        *[f"  - {p}" for p in report.fragile_points],
        "",
        "At-Risk Knowledge:",
        *[f"  - {k}" for k in report.at_risk_knowledge],
        "",
        "Questions:",
        *[f"  - {q.get('text', str(q))}" for q in report.questions],
        "",
        f"Cumulative Summary: {report.cumulative_summary}",
    ]
    return "\n".join(lines)


def _build_prompt(
    file: StructuredFile,
    pass_number: int,
    previous: list[DeepDiveReport],
) -> str:
    """Build the user prompt for the given pass number."""
    parsed_content = _serialize_content(file)
    max_questions = settings.MAX_QUESTIONS_PER_FILE

    if pass_number == 1:
        return PASS_1_USER_TEMPLATE.format(
            file_type=file.file_type,
            file_name=file.file_name,
            parsed_content=parsed_content,
            max_questions=max_questions,
        )
    elif pass_number == 2:
        return PASS_2_USER_TEMPLATE.format(
            file_type=file.file_type,
            file_name=file.file_name,
            previous_report=_serialize_report(previous[0]),
            parsed_content=parsed_content,
            max_questions=max_questions,
        )
    else:  # pass 3
        return PASS_3_USER_TEMPLATE.format(
            file_type=file.file_type,
            file_name=file.file_name,
            pass_1_report=_serialize_report(previous[0]),
            pass_2_report=_serialize_report(previous[1]),
            parsed_content=parsed_content,
            max_questions=max_questions,
        )


def _parse_llm_response(
    data: dict,
    file: StructuredFile,
    pass_number: int,
    previous: list[DeepDiveReport],
) -> DeepDiveReport:
    """Parse LLM JSON response into a DeepDiveReport.

    Caps questions at MAX_QUESTIONS_PER_FILE and builds cumulative_summary.
    """
    raw_questions = data.get("questions", [])[:settings.MAX_QUESTIONS_PER_FILE]
    # Normalize: LLM sometimes returns plain strings instead of {"text", "evidence"} dicts
    questions = []
    for q in raw_questions:
        if isinstance(q, dict):
            questions.append(q)
        elif isinstance(q, str):
            questions.append({"text": q, "evidence": ""})
        else:
            questions.append({"text": str(q), "evidence": ""})

    # Build cumulative summary
    cumulative = data.get("cumulative_summary", data.get("file_purpose_summary", ""))
    if pass_number > 1 and previous:
        prev_summary = previous[-1].cumulative_summary
        if prev_summary:
            cumulative = f"{prev_summary}\n\n[Pass {pass_number}] {cumulative}"

    return DeepDiveReport(
        file_id=file.file_id,
        pass_number=pass_number,
        file_purpose_summary=data.get("file_purpose_summary", ""),
        key_mechanics=data.get("key_mechanics", []),
        fragile_points=data.get("fragile_points", []),
        at_risk_knowledge=data.get("at_risk_knowledge", []),
        questions=questions,
        cumulative_summary=cumulative,
    )


# ------------------------------------------------------------------
# Subgraph node: run a single deep dive pass
# ------------------------------------------------------------------
async def run_deep_dive_pass(state: FileDeepDiveState) -> dict:
    """Execute one pass of deep-dive analysis on a file.

    Reads from: state["file"], state["pass_number"], state["previous_passes"],
                state["session_id"]
    Writes to:  state["current_report"], state["pass_number"],
                state["previous_passes"], state["deep_dive_reports"]
    """
    file: StructuredFile = state["file"]
    pass_number: int = state.get("pass_number", 1)
    previous: list[DeepDiveReport] = state.get("previous_passes", [])
    session_id: str = state.get("session_id", "")

    logger.info(
        "Deep dive pass %d for %s", pass_number, file.file_name
    )

    # Build prompt and call LLM
    user_prompt = _build_prompt(file, pass_number, previous)
    data = await call_llm_json(SYSTEM_PROMPT, user_prompt)

    # Parse into DeepDiveReport
    report = _parse_llm_response(data, file, pass_number, previous)

    # Persist pass report to disk
    if session_id:
        try:
            store = SessionStorage(session_id)
            store.save_json(
                f"deep_dives/{file.file_id}_pass{pass_number}.json",
                report.model_dump(),
            )
        except Exception:
            logger.exception("Failed to persist deep dive pass %d for %s", pass_number, file.file_id)

    updated_passes = previous + [report]

    return {
        "current_report": report,
        "previous_passes": updated_passes,
        "pass_number": pass_number + 1,
        "deep_dive_reports": [report],
    }


# ------------------------------------------------------------------
# Routing: should we continue to the next pass?
# ------------------------------------------------------------------
def should_continue_passes(state: FileDeepDiveState) -> str:
    """Decide whether to do another pass or finish.

    Returns "continue" or "done".
    """
    file: StructuredFile = state["file"]
    pass_number: int = state.get("pass_number", 1)

    max_passes = state.get("max_passes", None)
    if max_passes is None:
        if file.file_type in ("xlsx", "xls"):
            max_passes = settings.DEEP_DIVE_PASSES_XLSX
        else:
            max_passes = settings.DEEP_DIVE_PASSES_DEFAULT

    if pass_number > max_passes:
        return "done"
    return "continue"


# ------------------------------------------------------------------
# Fan-out helper (called from offboarding graph)
# ------------------------------------------------------------------
def prepare_deep_dive_input(
    file: StructuredFile,
    session_id: str,
) -> FileDeepDiveState:
    """Build the initial subgraph state for one file."""
    max_passes = (
        settings.DEEP_DIVE_PASSES_XLSX
        if file.file_type in ("xlsx", "xls")
        else settings.DEEP_DIVE_PASSES_DEFAULT
    )
    return {
        "file": file,
        "pass_number": 1,
        "max_passes": max_passes,
        "previous_passes": [],
        "current_report": None,
        "session_id": session_id,
        "deep_dive_reports": [],
    }

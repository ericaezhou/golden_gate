"""Node: generate_onboarding_package — Step 5 of the offboarding pipeline.

Turns all accumulated knowledge into the final onboarding deliverable.
Two LLM calls: (5a) build structured knowledge entries from interview
facts, then (5b) generate the full onboarding document.
"""

from __future__ import annotations

import json
import logging

from backend.models.artifacts import OnboardingPackage
from backend.models.questions import Question, QuestionStatus
from backend.models.state import OffboardingState
from backend.services.llm import call_llm_json
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Prompt: 5a — Build knowledge entries from extracted facts
# ------------------------------------------------------------------
KNOWLEDGE_ENTRIES_SYSTEM = """\
You are a knowledge engineer. Given extracted facts from an offboarding \
interview and the answered questions, create structured knowledge entries.

Each entry must be categorized as exactly one of:
- decision_rationale
- manual_override_rule
- workflow_step
- gotcha_or_failure_mode
- stakeholder_constraint

Return JSON with exactly one key:

{
  "knowledge_entries": [
    {
      "category": "<one of the 5 categories above>",
      "title": "<short descriptive title>",
      "detail": "<full explanation of the knowledge>",
      "source_files": ["file_id_1", "file_id_2"]
    }
  ]
}

Be thorough — every fact from the interview should map to at least one entry. \
Combine related facts into a single entry when they describe the same piece \
of knowledge."""

# ------------------------------------------------------------------
# Prompt: 5b — Generate onboarding document
# ------------------------------------------------------------------
ONBOARDING_DOC_SYSTEM = """\
You are writing an onboarding document for a new team member who will \
take over this project. Write clearly and practically — a new hire \
should be able to read this and start working within a day.

Return JSON with exactly these keys:

{
  "abstract": "<2-3 sentences: what this project does>",
  "introduction": "<why it exists, business context, key stakeholders>",
  "details": "<file-by-file guide: what each file does, how to use it, key dependencies>",
  "faq": [{"q": "<question>", "a": "<answer>"}],
  "risks_and_gotchas": ["<risk or gotcha string>"]
}

The FAQ should contain 5-8 of the most important questions a new person \
would ask, with clear answers drawn from the materials provided. \
Risks & Gotchas should highlight error-prone items, manual steps, \
and known issues."""


async def generate_onboarding_package(state: OffboardingState) -> dict:
    """Generate the onboarding package from all prior artifacts.

    Reads from: state["deep_dive_corpus"], state["global_summary"],
                state["question_backlog"], state["extracted_facts"],
                state["interview_transcript"]
    Writes to:  state["onboarding_package"]
    Persists:   onboarding_package/package.json, onboarding_package/onboarding_docs.md
    """
    session_id = state["session_id"]
    store = SessionStorage(session_id)

    corpus = state.get("deep_dive_corpus", "")
    global_summary = state.get("global_summary", "")
    backlog: list[Question] = state.get("question_backlog", [])
    facts: list[str] = state.get("extracted_facts", [])

    # Build answered questions text for the prompts
    answered_qs = _format_answered_questions(backlog)

    # ---- LLM Call 1: Build knowledge entries (§4.7 sub-step 5a) ----
    knowledge_prompt = (
        "Here are the extracted facts from the offboarding interview:\n\n"
        f"{chr(10).join(f'- {f}' for f in facts) if facts else '(no facts extracted)'}\n\n"
        "Here are the answered questions with context:\n\n"
        f"{answered_qs}\n\n"
        "Create structured knowledge entries from these materials."
    )

    ke_result = await call_llm_json(KNOWLEDGE_ENTRIES_SYSTEM, knowledge_prompt)
    knowledge_entries = ke_result.get("knowledge_entries", [])

    logger.info(
        "Built %d knowledge entries for session %s",
        len(knowledge_entries), session_id,
    )

    # ---- LLM Call 2: Generate onboarding document (§4.7 sub-step 5b) ----
    ke_text = json.dumps(knowledge_entries, indent=2)
    faq_from_qs = _build_faq_from_questions(backlog)

    doc_prompt = (
        "Use the following materials to write the onboarding document:\n\n"
        f"## Global Summary\n{global_summary}\n\n"
        f"## Per-File Summaries\n{corpus}\n\n"
        f"## Knowledge Entries\n{ke_text}\n\n"
        f"## FAQ from Interview\n{faq_from_qs}\n\n"
        "Write the 5 sections: Abstract, Introduction, Details, FAQ, "
        "Risks & Gotchas."
    )

    doc_result = await call_llm_json(ONBOARDING_DOC_SYSTEM, doc_prompt)

    # ---- Assemble the OnboardingPackage ----
    package = OnboardingPackage(
        abstract=doc_result.get("abstract", ""),
        introduction=doc_result.get("introduction", ""),
        details=doc_result.get("details", ""),
        faq=doc_result.get("faq", []),
        risks_and_gotchas=doc_result.get("risks_and_gotchas", []),
        knowledge_entries=knowledge_entries,
    )

    # Persist as JSON
    store.save_json(
        "onboarding_package/package.json",
        package.model_dump(),
    )

    # Persist as readable markdown
    md = _package_to_markdown(package)
    store.save_text("onboarding_package/onboarding_docs.md", md)

    logger.info("Onboarding package generated for session %s", session_id)

    return {
        "onboarding_package": package,
        "status": "package_generated",
        "current_step": "generate_onboarding_package",
    }


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _format_answered_questions(backlog: list[Question]) -> str:
    """Format answered questions as readable text for LLM prompts."""
    lines = []
    for q in backlog:
        if q.status == QuestionStatus.ANSWERED_BY_INTERVIEW and q.answer:
            lines.append(
                f"Q ({q.priority.value}, {q.origin.value}): {q.question_text}\n"
                f"A: {q.answer}"
            )
    return "\n\n".join(lines) if lines else "(no answered questions)"


def _build_faq_from_questions(backlog: list[Question]) -> str:
    """Build a FAQ-style text from answered questions."""
    lines = []
    for q in backlog:
        if q.answer:
            lines.append(f"Q: {q.question_text}\nA: {q.answer}")
    return "\n\n".join(lines) if lines else "(no Q&A pairs available)"


def _package_to_markdown(pkg: OnboardingPackage) -> str:
    """Convert an OnboardingPackage to a readable markdown document."""
    sections = [
        "# Onboarding Document\n",
        "## Abstract\n",
        pkg.abstract + "\n",
        "## Introduction\n",
        pkg.introduction + "\n",
        "## Details\n",
        pkg.details + "\n",
        "## FAQ\n",
    ]
    for item in pkg.faq:
        sections.append(f"**Q:** {item.get('q', '')}\n")
        sections.append(f"**A:** {item.get('a', '')}\n\n")

    sections.append("## Risks & Gotchas\n")
    for risk in pkg.risks_and_gotchas:
        sections.append(f"- {risk}\n")

    return "\n".join(sections)

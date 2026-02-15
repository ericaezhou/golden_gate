"""Node: generate_onboarding_package — Step 5 of the offboarding pipeline.

Turns all accumulated knowledge into the final onboarding deliverable.

Owner: [assign team member]
"""

from __future__ import annotations

import logging

from backend.models.artifacts import OnboardingPackage
from backend.models.state import OffboardingState
from backend.services.llm import call_llm
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)


async def generate_onboarding_package(state: OffboardingState) -> dict:
    """Generate the onboarding package from all prior artifacts.

    Reads from: state["deep_dive_corpus"], state["global_summary"],
                state["question_backlog"], state["extracted_facts"]
    Writes to:  state["onboarding_package"]
    Persists:   onboarding_package/package.json, onboarding_package/onboarding_docs.md

    TODO: Implement the two LLM calls:
          1. Build knowledge entries (§4.7 sub-step 5a)
          2. Generate onboarding document (§4.7 sub-step 5b)
    """
    session_id = state["session_id"]
    store = SessionStorage(session_id)

    # --- Placeholder implementation ---
    package = OnboardingPackage(
        abstract="[TODO] Project abstract",
        introduction="[TODO] Project introduction",
        details="[TODO] File-by-file guide",
        faq=[],
        risks_and_gotchas=[],
        knowledge_entries=[],
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

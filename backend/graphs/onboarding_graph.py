"""Onboarding Graph — new hire experience.

Provides:
  1. A generated narrative overview of the project.
  2. An interactive QA loop backed by system-prompt context (no vector DB).

Knowledge graph visualization is generated on-demand via a separate
tool call / API endpoint — it is NOT a node in this graph.

This graph reads from the knowledge store produced by the
offboarding graph.
"""

from __future__ import annotations

import json
import logging

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from backend.models.state import OnboardingState
from backend.services.llm import call_llm
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# System prompts
# ------------------------------------------------------------------
NARRATIVE_SYSTEM = """\
You are writing a guided onboarding narrative for a new team member \
who will take over this project. Your audience has ZERO context — \
this is the first thing they read.

Given the onboarding package (abstract, introduction, details, FAQ, \
risks), produce a clear, engaging narrative that:

1. Opens with a 1-paragraph "What is this project?" summary.
2. Explains the business context — why it exists, who cares about it.
3. Provides a **first-week checklist** (5-8 concrete items):
   - Which files to open first and why
   - Key things to verify still work
   - People or teams to connect with
4. Flags the **top 3 risks/gotchas** to be aware of immediately.
5. Ends with a brief "You're ready" encouragement.

Write in clear prose with markdown formatting. Be practical and \
specific — reference actual file names, processes, and people \
from the materials provided."""

QA_SYSTEM_PROMPT_TEMPLATE = """\
You are a knowledgeable assistant helping a new team member \
understand a project they are taking over. You have access \
to the following knowledge base from the previous owner's \
files and exit interview.

{knowledge_base}

Rules:
- Answer questions based ONLY on the knowledge base above.
- Cite which file or interview answer your information comes from \
  using [Deep Dive: file], [Interview Summary], or [Global Summary].
- If you are not confident, say so and suggest what to investigate.
- Be concise and practical — 2-6 sentences for most answers."""


# ------------------------------------------------------------------
# Node: generate the onboarding narrative
# ------------------------------------------------------------------
async def generate_narrative(state: OnboardingState) -> dict:
    """Generate a guided onboarding narrative from the package.

    Reads from: state["onboarding_package"], state["session_id"]
    Writes to:  state["narrative"], state["current_mode"]
    """
    session_id = state["session_id"]
    package = state.get("onboarding_package")
    store = SessionStorage(session_id)

    # Build the user prompt from the onboarding package
    if package:
        # Package can be a dict (from state) or OnboardingPackage object
        if hasattr(package, "model_dump"):
            pkg = package.model_dump()
        elif isinstance(package, dict):
            pkg = package
        else:
            pkg = {}

        user_prompt = (
            f"## Abstract\n{pkg.get('abstract', '')}\n\n"
            f"## Introduction\n{pkg.get('introduction', '')}\n\n"
            f"## Details\n{pkg.get('details', '')}\n\n"
            f"## FAQ\n"
        )
        for item in pkg.get("faq", []):
            user_prompt += f"Q: {item.get('q', '')}\nA: {item.get('a', '')}\n\n"
        user_prompt += "## Risks & Gotchas\n"
        for risk in pkg.get("risks_and_gotchas", []):
            user_prompt += f"- {risk}\n"
    else:
        # Fallback: try loading from disk
        try:
            pkg = store.load_json("onboarding_package/package.json")
            user_prompt = json.dumps(pkg, indent=2)
        except FileNotFoundError:
            logger.warning("No onboarding package found for session %s", session_id)
            return {
                "narrative": "(Onboarding package not yet generated. Run the offboarding pipeline first.)",
                "current_mode": "narrative",
            }

    narrative = await call_llm(NARRATIVE_SYSTEM, user_prompt)

    # Persist the generated narrative
    store.save_text("onboarding_narrative.md", narrative)

    return {
        "narrative": narrative,
        "current_mode": "narrative",
    }


# ------------------------------------------------------------------
# Node: QA loop (human-in-the-loop)
# ------------------------------------------------------------------
async def qa_loop(state: OnboardingState) -> dict:
    """Interactive QA: new hire asks questions, agent answers from system prompt.

    Uses interrupt() to wait for user questions from the frontend.
    Each turn: LLM answers grounded in the deep dives + interview knowledge.
    No vector retrieval — the full knowledge base is the system prompt.

    Reads from: state["session_id"], state["qa_system_prompt"]
    Writes to:  state["chat_history"]
    """
    session_id = state["session_id"]
    store = SessionStorage(session_id)

    # Wait for user question (resume payload may be str or dict e.g. {"question": "..."})
    raw_input = interrupt({
        "prompt": "Ask any question about the project.",
        "mode": "qa",
    })
    # Normalise: the frontend may send a plain string or a dict
    if isinstance(raw_input, dict):
        user_input = raw_input.get("question", raw_input.get("content", str(raw_input)))
    else:
        user_input = str(raw_input)

    # --- Load the knowledge base for the system prompt ---
    # Priority: use qa_system_prompt from state, fall back to file
    knowledge_base = state.get("qa_system_prompt", "")
    if not knowledge_base:
        # Try loading the pre-built QA system prompt
        if store.exists("qa_system_prompt.txt"):
            knowledge_base = store.load_text("qa_system_prompt.txt")
        else:
            # Fallback: assemble from individual files
            sections = []
            if store.exists("deep_dive_corpus.txt"):
                sections.append("== FILE ANALYSIS ==\n" + store.load_text("deep_dive_corpus.txt"))
            elif store.exists("deep_dive_corpus.json"):
                data = store.load_json("deep_dive_corpus.json")
                sections.append("== FILE ANALYSIS ==\n" + data.get("corpus", ""))
            if store.exists("interview/interview_summary.txt"):
                sections.append("== INTERVIEW SUMMARY ==\n" + store.load_text("interview/interview_summary.txt"))
            if store.exists("global_summary.json"):
                data = store.load_json("global_summary.json")
                sections.append("== GLOBAL SUMMARY ==\n" + data.get("global_summary", ""))
            knowledge_base = "\n\n".join(sections) if sections else "(No knowledge base available)"

    # Build the system prompt
    system_prompt = QA_SYSTEM_PROMPT_TEMPLATE.format(knowledge_base=knowledge_base)

    # Build user message with conversation context
    chat_history = state.get("chat_history", [])
    if chat_history:
        # Include recent conversation for continuity (last 6 messages)
        recent = chat_history[-6:] if len(chat_history) > 6 else chat_history
        context_lines = []
        for msg in recent:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            context_lines.append(f"{role}: {content}")
        user_prompt = (
            "Previous conversation:\n"
            + "\n".join(context_lines)
            + f"\n\nNew question: {user_input}"
        )
    else:
        user_prompt = user_input

    # Call LLM — call_llm returns a string
    answer = await call_llm(system_prompt, user_prompt)

    # Return new messages — OnboardingState uses add_messages reducer,
    # so returning a list appends to existing chat_history
    return {
        "chat_history": [
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": answer},
        ],
        "current_mode": "qa",
    }


# ------------------------------------------------------------------
# Build the graph
# ------------------------------------------------------------------
def build_onboarding_graph():
    """Build and compile the onboarding StateGraph."""
    builder = StateGraph(OnboardingState)

    builder.add_node("generate_narrative", generate_narrative)
    builder.add_node("qa_loop", qa_loop)

    builder.add_edge(START, "generate_narrative")
    builder.add_edge("generate_narrative", "qa_loop")
    # qa_loop uses interrupt() — graph pauses here until user sends input
    builder.add_edge("qa_loop", "qa_loop")  # loop back for next question
    # Knowledge graph is NOT a graph node — generated on-demand via API

    return builder.compile()

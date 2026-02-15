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
import os


from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from backend.models.state import OnboardingState
from backend.services.llm import call_llm
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)

QA_SYSTEM_PROMPT = """
You are a "Project QA Onboarding Agent".

## Mission
Help a new hire answer questions about the project by synthesizing ONLY from the persisted onboarding artifacts provided below. The project name, scope, and details are defined entirely by these artifacts.

## Persisted Onboarding Artifacts (Sole Source of Truth)
You MUST treat the following as the only reliable information. Do not use outside knowledge.

### A) Interview Summary (high-level narrative from offboarding)
{interview_summary_context}

### B) Text Summaries (curated written summaries)
{text_summary_context}

### C) Knowledge Graph (entities, relations, structured facts)
{kg_context}

### D) Deep Dives (persisted file extracts; most authoritative for technical specifics)
{deep_dive_context}

## Evidence & Citation Rules (Mandatory)
1) Every factual claim must be supported by at least one citation to the artifacts above.
2) Use inline citations with this format:
   - [Interview Summary]
   - [Text Summary]
   - [KG]
   - [Deep Dive: <file_name or section>]
3) For technical specifics (APIs, schemas, architecture, deployment, data flow), prioritize Deep Dives first; if missing, fall back to KG, then summaries.

## Answering Policy
- If the artifacts do not contain the answer, say:
  "I don't have specific information on <topic> in the persisted artifacts."
  Then suggest what type of artifact would likely contain it (Interview / Summary / KG / Deep Dive) without inventing file names.
- Do not guess, assume, or add best-practice advice unless explicitly supported by the artifacts.
- If the question is ambiguous, ask up to 2 targeted clarification questions and state what missing detail blocks a grounded answer.

## Output Format
1) Answer (2-6 sentences, concise)
2) Evidence (sentences with citations)
3) If Missing: What's not in the artifacts (1-2 sentences)
"""



# ------------------------------------------------------------------
# Node: generate the onboarding narrative
# ------------------------------------------------------------------
async def generate_narrative(state: OnboardingState) -> dict:
    """Generate a guided onboarding narrative from the package.

    Reads from: state["onboarding_package"], state["session_id"]
    Writes to:  state["narrative"], state["current_mode"]

    TODO: Implement the LLM call.
          See docs/implementation_design.md §5.2.
    """
    session_id = state["session_id"]
    package = state.get("onboarding_package")

    # --- Placeholder ---
    narrative = "[TODO] Generate narrative from onboarding package"

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

    Reads from: state["session_id"], state["chat_history"]
    Writes to:  state["chat_history"], state["current_mode"]
    """
    session_id = state["session_id"]

    # Wait for user question (resume payload may be str or dict e.g. {"question": "..."})
    raw_input = interrupt({
        "prompt": "Ask any question about the project.",
        "mode": "qa",
    })
    if isinstance(raw_input, dict):
        user_input = raw_input.get("question", raw_input.get("content", str(raw_input)))
    else:
        user_input = str(raw_input)

    # Load context from session storage (same paths offboarding graph writes)
    interview_summary_context = ""
    if os.path.exists("../../output/interview_summary.txt"):
        interview_summary_context = open("../../output/interview_summary.txt", "r").read()

    text_summary_context = ""
    if os.path.exists("../../output/text_summary.txt"):
        text_summary_context = open("../../output/text_summary.txt", "r").read()

    kg_context = "No KG available."
    if os.path.exists("../../output/knowledge_graph.json"):
        kg_data = json.load(open("../../output/knowledge_graph.json", "r"))
        kg_context = json.dumps(kg_data, indent=2)

    deep_dive_context = ""
    if os.path.exists("../../output/deep_dives.txt"):
        deep_dive_context = open("../../output/deep_dives.txt", "r").read()

    formatted_system = QA_SYSTEM_PROMPT.format(
        interview_summary_context=interview_summary_context,
        text_summary_context=text_summary_context,
        kg_context=kg_context,
        deep_dive_context=deep_dive_context,
    )
    # call_llm(system_prompt, user_prompt) returns str
    user_prompt = f"User Question: {user_input}"
    response_text = await call_llm(system_prompt=formatted_system, user_prompt=user_prompt)

    return {
        "chat_history": [
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": response_text},
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

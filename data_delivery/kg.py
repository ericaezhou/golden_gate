import json
from openai import OpenAI
import os
import networkx as nx
import matplotlib.pyplot as plt
from time import time

client = OpenAI()

KG_WITH_EVIDENCE_SCHEMA = {
    "name": "onboarding_kg_with_evidence",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "nodes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "id": {"type": "string"},
                        "type": {"type": "string"},
                        "name": {"type": "string"},
                        "evidence": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "source_type": {
                                        "type": "string",
                                        "enum": ["file", "interview", "ticket", "email", "other"]
                                    },
                                    "source_id": {"type": "string"},   # e.g. "repo:path/to/file.py" or "interview:2026-02-14"
                                    "path": {"type": "string"},        # optional-like but keep required; allow "" if unknown
                                    # "span": {                          # where in the source (line range / paragraph range / timestamp)
                                    #     "type": "object",
                                    #     "additionalProperties": False,
                                    #     "properties": {
                                    #         "start": {"type": "integer"},
                                    #         "end": {"type": "integer"}
                                    #     },
                                    #     "required": ["start", "end"]
                                    # },
                                    # "snippet_hash": {"type": "string"},  # sha256 of the snippet text (your backend computes)
                                    "quote": {"type": "string"},         # short excerpt; keep short in prod UI
                                },
                                # "required": ["source_type", "source_id", "path", "snippet_hash", "quote"]
                                "required": ["source_type", "source_id", "path", "quote"]
                            }
                        },
                        
                    },
                    "required": ["id", "type", "name", "evidence"]
                }
            },
            "edges": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "source": {"type": "string"},
                        "type": {"type": "string"},
                        "target": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "evidence": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "source_type": {"type": "string", "enum": ["file", "interview", "ticket", "email", "other"]},
                                    "source_id": {"type": "string"},
                                    "path": {"type": "string"},
                                    # "span": {
                                    #     "type": "object",
                                    #     "additionalProperties": False,
                                    #     "properties": {
                                    #         "start": {"type": "integer"},
                                    #         "end": {"type": "integer"}
                                    #     },
                                    #     "required": ["start", "end"]
                                    # },
                                    # "snippet_hash": {"type": "string"},
                                    "quote": {"type": "string"},
                                },
                                # "required": ["source_type", "source_id", "path", "snippet_hash", "quote"]
                                "required": ["source_type", "source_id", "path", "quote"]
                            }
                        },
                    },
                    "required": ["source", "type", "target", "confidence", "evidence"]
                    # "required": ["source", "type", "target", "confidence"]
                }
            }
        },
        "required": ["nodes", "edges"]
    },
    "strict": True
}

SYSTEM = """
You are an expert knowledge retention engineer. Convert project knowledge into an onboarding knowledge graph.

Primary objective:
- Help a new engineer take over the project fast with minimal reading.

Output constraints (CRITICAL):
- Keep the graph SMALL and high-signal.
- Target size: <= 18 nodes and <= 28 edges. Hard cap: 22 nodes, 35 edges.
- Include ONLY the most important entities and relationships.
- Prefer clarity over completeness. If unsure, omit.

Subgraph themes (must be represented in the graph):
A) MODEL (how the model/system works)
B) EVALUATION (how it is measured, metrics, datasets, evaluation pipeline)
C) OPERATIONS (runbooks, approvals, oncall/monitoring, recurring processes)

How to encode themes:
- Add a tag in node type or name so it can be grouped in UI, e.g.
  name: "[MODEL] ...", "[EVAL] ...", "[OPS] ..."
  (Do NOT create separate graphs; still output one nodes/edges list.)

Selection rules:
- Always include: 1 Project node, top 3 Modules/Components, top 3 Decisions/Rules, top 3 Risks+Mitigations, 1 Owner/Role if available.
- Only include Documents if they are critical (e.g., runbook, spec, evaluation sheet).
- Merge near-duplicates into one node.
- Use simple edge types: OWNS, DEPENDS_ON, USES, DECIDED, EVALUATED_BY, MITIGATED_BY, DOCUMENTED_IN, RUNBOOK_FOR.

Evidence rules (CRITICAL):
- Every node and edge must include:
  - confidence in [0,1]
  - evidence: citations from inputs only
- If evidence is weak, lower confidence and keep quote short (<= 140 chars).
- snippet_hash must be "sha256:<to_fill>" (backend will replace).
- path is file path when source_type=file, else "".

Evidence prioritization rule (CRITICAL):

When generating evidence for a concept:

1) If the concept appears explicitly in the Project Context (existing files),
   then the primary evidence must come from Project Context.
   - source_type must be "file"
   - path must point to the corresponding project file
   - interview evidence may be added as secondary evidence if helpful.

2) Only use interview evidence as primary evidence if:
   - The concept does NOT appear in Project Context, OR
   - The interview provides unique rationale that is not documented in files.

3) Never ignore an available file-based source in favor of interview evidence.
   File-based evidence has higher priority.

4) If both exist:
   - Use file evidence for factual definitions.
   - Use interview evidence for rationale or intent.
"""


def extract_kg_with_evidence(client: OpenAI, project_context: str, interview_transcript: str) -> str:
    user = f"""
Inputs:
(1) Project Context (from existing files):
{project_context}

(2) Interview Transcript:
{interview_transcript}

Task:
Build ONE compact onboarding knowledge graph for takeover.

Required content:
1) [MODEL] Subgraph: main architecture/modules, data flow, key assumptions
2) [EVAL] Subgraph: metrics, datasets, eval pipeline, what "good" means
3) [OPS] Subgraph: runbooks, approvals, monitoring, recurring processes

Hard constraints:
- <= 22 nodes, <= 35 edges (prefer smaller).
- Use short node names (<= 8 words).
- Use short evidence quotes (<= 140 chars).
- Do NOT include low-value nodes (minor helpers, generic docs, trivial details).

Return strictly valid JSON following the provided schema.
"""

    start_time = time()
    resp = client.responses.create(
        model="gpt-5-mini",
        instructions=SYSTEM,
        reasoning={"effort": "low"},
        input=user,
        # Structured Outputs (JSON Schema + strict) :contentReference[oaicite:2]{index=2}
        text={
        "format": {
            "type": "json_schema",
            "name": KG_WITH_EVIDENCE_SCHEMA["name"],      
            "strict": True,
            "schema": KG_WITH_EVIDENCE_SCHEMA["schema"],
        }
    },
    max_output_tokens=7000,
    )
    end_time = time()
    print(f"time taken: {end_time - start_time} seconds")
    print("finish generating kg with evidence")
    print(resp.output_text)
    with open("kg.txt", "w") as f:
        f.write(resp.output_text)
    return json.loads(resp.output_text)  # JSON string


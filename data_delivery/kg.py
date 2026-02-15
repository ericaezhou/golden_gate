import json
from openai import OpenAI
import os
from time import time


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
                        "center": {"type": "boolean"},
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
                    "required": ["id", "type", "name", "center", "evidence"]
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
You are an expert knowledge retention engineer. Convert project knowledge into a compact onboarding knowledge graph optimized for quick takeover.

Primary objective:
- Help a new engineer take over fast with minimal reading.

Output constraints (CRITICAL):
- Keep the graph SMALL and high-signal.
- Target <= 18 nodes and <= 28 edges. Hard cap: 22 nodes, 35 edges.
- Include ONLY the most important entities and relationships.
- Prefer clarity over completeness. If unsure, omit.

Required themes (must be represented among CENTER nodes):
A) MODEL
B) EVALUATION
C) OPERATIONS

Theme encoding for CENTER node names:
- Prefix center node names with: "[PROJECT] ...", "[MODEL] ...", "[EVAL] ...", "[OPS] ..."

========================
CENTER / CHILD MODEL (CRITICAL)
========================

Each node has a boolean field: center
- center=true  => "center node" (main entity)
- center=false => "child node" (attribute/field/detail node)

IMPORTANT:
- Do NOT encode center/child in node.type.
- node.type MUST remain semantic and readable, e.g.:
  "owner: ...", "metric: ...", "dataset: ...", "runbook: ...",
  "SLO: ...", "alert: ...", "cadence: ...", "module: ...", etc.

Cluster ownership rule:
- Every child node (center=false) must belong to exactly ONE center node (center=true).

How to express belonging:
- Use an explicit edge type "BELONGS_TO" from child -> center
  OR "HAS_FIELD" from center -> child.
- Choose ONE direction consistently in the whole graph. Prefer: center -> child with "HAS_FIELD".
- This edge defines the cluster membership.

Child node connectivity constraints (must satisfy):
- A child node must connect to exactly ONE center node via the membership edge (HAS_FIELD or BELONGS_TO).
- Child nodes MUST NOT connect to any other center node.
- Child nodes MAY connect to other child nodes ONLY if they share the same parent center node.
- No cross-cluster child-child edges.

Center node relationships:
- Center nodes may connect to other center nodes freely (cycles allowed).
- Keep these center-center edges minimal and high-signal (prefer <= 8).

========================
EDGE TYPES (FREEFORM BUT SIMPLE)
========================

Since edge.type is not enumerated, use a SMALL set of simple edge types:
- For center-center: OWNS, DEPENDS_ON, USES, DECIDED, EVALUATED_BY, MITIGATED_BY, DOCUMENTED_IN, RUNBOOK_FOR
- For membership: HAS_FIELD (preferred) OR BELONGS_TO (pick one)
- Optional within-cluster child-child edges: USES / DOCUMENTED_IN / EVALUATED_BY (only if it clarifies)

If unsure about an edge, omit it.

========================
SELECTION RULES
========================
Always include:
- 1 [PROJECT] center node
- top 1 [MODEL] module/component center node
- top 1 decision/rule (center node OR child under the relevant center)
- top 1 risk + mitigation (center nodes OR risk center with mitigation child)
- 1 owner/role center node if available

Only include Documents if critical (runbook/spec/eval sheet).
Merge near-duplicates.

========================
EVIDENCE RULES (CRITICAL)
========================
- Every node and edge must include:
  - confidence in [0,1]
  - evidence: citations from inputs only (quote <= 140 chars)
- If evidence is weak, lower confidence and keep quote short.
- snippet_hash must be "sha256:<to_fill>"
- path is file path when source_type=file, else ""

Evidence prioritization:
1) If concept appears in Project Context files, primary evidence must be file-based.
2) Use interview as primary only if not documented in files or adds unique rationale.
3) If both exist: file for facts, interview for rationale/intent.
"""


def extract_kg_with_evidence(client: OpenAI, project_context: str, interview_transcript: str) -> str:
    user = f"""
Inputs:
(1) Project Context (from existing files):
{project_context}

(2) Interview Transcript:
{interview_transcript}

Task:
Build ONE compact onboarding knowledge graph for takeover, visually similar to a schema diagram:

- Center nodes (center=true) are the main entities.
- Each center node has a small cluster of child nodes (center=false) underneath it.
- Child nodes use semantic node.type like:
  "owner: ...", "metric: ...", "dataset: ...", "runbook: ...",
  "SLO: ...", "alert: ...", "cadence: ..."

Membership encoding (pick ONE and use consistently):
Option A (preferred): center -> child edge type "HAS_FIELD"
Option B: child -> center edge type "BELONGS_TO"

Cluster constraints (must satisfy):
- Every child node must connect to exactly ONE center node via the membership edge.
- Child nodes must not connect to any other center node.
- Child-child edges are allowed ONLY within the same cluster (same parent center), and should be very few.

Center-center edges:
- Center nodes may connect to other center nodes using simple edge types:
  OWNS, DEPENDS_ON, USES, DECIDED, EVALUATED_BY, MITIGATED_BY, DOCUMENTED_IN, RUNBOOK_FOR
- Cycles are allowed, but keep center-center edges minimal.

Required themes (must exist among center nodes):
1) [MODEL] main architecture/modules, data flow, key assumptions
2) [EVAL] metrics, datasets, eval pipeline, definition of "good"
3) [OPS] runbooks, approvals, monitoring, recurring processes

Hard constraints:
- <= 22 nodes, <= 35 edges (prefer smaller).
- Center node names <= 8 words; child node names <= 8 words.
- Prefer 2-5 child nodes per important center node.
- Evidence quote <= 140 chars.

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
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
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
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
                                    # "quote": {"type": "string"},         # short excerpt; keep short in prod UI
                                },
                                # "required": ["source_type", "source_id", "path", "snippet_hash", "quote"]
                                "required": ["source_type", "source_id", "path"]
                            }
                        },
                        
                    },
                    "required": ["id", "type", "name", "confidence", "evidence"]
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
                                    # "quote": {"type": "string"},
                                },
                                # "required": ["source_type", "source_id", "path", "snippet_hash", "quote"]
                                "required": ["source_type", "source_id", "path"]
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
You convert project knowledge into a single coherent onboarding knowledge graph (not subgraphs).
The graph should reflect how the previous employee ran the project and how a new engineer can take over fast.

Evidence rules (CRITICAL):
- Every node and edge must include:
  - confidence in [0,1]
  - evidence: a list of citations.
- Evidence must come from the provided inputs only (files/notes/interview transcript).
- If evidence is weak, still include it but lower confidence, and make quote short.
- For each evidence item:
  - source_id should be stable (e.g. "repo:src/service.py" or "interview:transcript#12")
  - path should be a file path when source_type=file, else "".
  - span is line range (file) or paragraph range (interview). Use best effort.
  - snippet_hash: provide a placeholder like "sha256:<to_fill>" (backend will replace).
"""

def extract_kg_with_evidence(client: OpenAI, project_context: str, interview_transcript: str) -> str:
    user = f"""
Inputs:
(1) Project Context (from existing files):
{project_context}

(2) Interview Transcript (Q&A with employee):
{interview_transcript}

Task:
Build ONE knowledge graph that helps takeover:
- project overview
- modules/components and responsibilities
- key decisions and rationale (Decision nodes)
- risks and mitigations (Risk nodes)
- operational playbooks / runbooks
- owners (people/roles)
- important docs/repos

Try to build the graph as simple and clear as possible. Output must follow the JSON schema strictly.
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
    max_output_tokens=5000,
        
    )
    end_time = time()
    print(f"time taken: {end_time - start_time} seconds")
    print("finish generating kg with evidence")
    print(resp)
    return resp.output_text  # JSON string


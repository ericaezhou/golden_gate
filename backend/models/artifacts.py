"""Core data structures for pipeline artifacts.

These Pydantic models are the single source of truth for every artifact
that flows through the offboarding/onboarding pipeline.  They are used
for validation, serialization (to JSON on disk), and as LangGraph state
fields.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ------------------------------------------------------------------
# Evidence — pointer to a specific location inside a parsed file
# ------------------------------------------------------------------
class Evidence(BaseModel):
    file_id: str
    location: str = ""          # e.g. "Sheet: Revenue", "Slide 3", "line 42"
    snippet: str = ""           # relevant text excerpt


# ------------------------------------------------------------------
# StructuredFile — output of Step 1 (parsing)
# ------------------------------------------------------------------
class StructuredFile(BaseModel):
    file_id: str                # slug derived from filename
    file_name: str              # original filename
    file_type: str              # xlsx | pptx | py | ipynb | md | sql | pdf
    parsed_content: dict = Field(default_factory=dict)
    metadata: dict = Field(default_factory=dict)
    raw_path: str = ""


# ------------------------------------------------------------------
# DeepDiveReport — output of Step 2 (per-file iterative analysis)
# ------------------------------------------------------------------
class DeepDiveReport(BaseModel):
    file_id: str
    pass_number: int                         # 1, 2, or 3
    file_purpose_summary: str = ""
    key_mechanics: list[str] = Field(default_factory=list)
    fragile_points: list[str] = Field(default_factory=list)
    at_risk_knowledge: list[str] = Field(default_factory=list)
    questions: list[dict] = Field(default_factory=list)
    cumulative_summary: str = ""


# ------------------------------------------------------------------
# InterviewTurn — one round of the AI interview
# ------------------------------------------------------------------
class InterviewTurn(BaseModel):
    turn_id: int
    question_id: str
    question_text: str
    user_response: str = ""
    extracted_facts: list[str] = Field(default_factory=list)
    follow_up: str | None = None


# ------------------------------------------------------------------
# OnboardingPackage — final deliverable
# ------------------------------------------------------------------
class OnboardingPackage(BaseModel):
    abstract: str = ""
    introduction: str = ""
    details: str = ""                         # file-by-file guide
    faq: list[dict] = Field(default_factory=list)   # [{"q": ..., "a": ...}]
    risks_and_gotchas: list[str] = Field(default_factory=list)
    knowledge_entries: list[dict] = Field(default_factory=list)

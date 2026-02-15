"""Question backlog model.

The question backlog is the central data structure that accumulates
questions from per-file deep dives and global summarization, gets
reconciled/deduped, and is consumed by the interview loop.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from backend.models.artifacts import Evidence


class QuestionOrigin(str, Enum):
    PER_FILE = "per_file"
    GLOBAL = "global"
    FOLLOW_UP = "follow_up"


class QuestionStatus(str, Enum):
    OPEN = "open"
    ANSWERED_BY_FILES = "answered_by_files"
    ANSWERED_BY_INTERVIEW = "answered_by_interview"
    MERGED = "merged"
    DEPRIORITIZED = "deprioritized"


class QuestionPriority(str, Enum):
    P0 = "P0"   # total knowledge-loss risk
    P1 = "P1"   # partial / ambiguous
    P2 = "P2"   # nice-to-have


class Question(BaseModel):
    question_id: str
    question_text: str
    origin: QuestionOrigin = QuestionOrigin.PER_FILE
    source_file_id: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    priority: QuestionPriority = QuestionPriority.P1
    status: QuestionStatus = QuestionStatus.OPEN
    answer: str | None = None
    confidence: float | None = None          # 0.0 – 1.0

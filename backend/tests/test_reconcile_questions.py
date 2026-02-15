"""Unit tests for nodes/reconcile_questions.py

All tests mock the LLM service so they run fast, offline, and free.

Run with:  uv run pytest backend/tests/test_reconcile_questions.py -v
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest

from backend.models.questions import (
    Question,
    QuestionOrigin,
    QuestionPriority,
    QuestionStatus,
)
from backend.nodes.reconcile_questions import (
    _apply_decisions,
    _build_user_prompt,
    _enforce_cap,
    reconcile_questions,
)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _make_question(
    qid: str,
    text: str,
    origin: str = "per_file",
    source_file: str | None = None,
    priority: str = "P1",
    status: str = "open",
) -> Question:
    return Question(
        question_id=qid,
        question_text=text,
        origin=QuestionOrigin(origin),
        source_file_id=source_file,
        priority=QuestionPriority(priority),
        status=QuestionStatus(status),
    )


SAMPLE_QUESTIONS = [
    _make_question("q1", "Why is the loss threshold set to 0.85?", source_file="model"),
    _make_question("q2", "What threshold is used for flagging losses?", source_file="config"),
    _make_question("q3", "Who runs the monthly reconciliation?", source_file="notes"),
    _make_question("q4", "Where does the raw data come from?", source_file="model"),
    _make_question(
        "q5", "Why was segment B excluded from the forecast?",
        origin="global",
    ),
]

SAMPLE_CORPUS = (
    "## File: model\n"
    "**Purpose:** Forecasts quarterly losses by segment.\n"
    "**Key Mechanics:** Uses a threshold of 0.85 to flag high-risk items.\n\n"
    "## File: config\n"
    "**Purpose:** Stores threshold and model parameters.\n"
)

SAMPLE_SUMMARY = (
    "The model uses threshold 0.85 defined in config. "
    "Segment B was excluded per management decision. "
    "Monthly reconciliation schedule is undocumented."
)


# ------------------------------------------------------------------
# Test: _build_user_prompt
# ------------------------------------------------------------------
class TestBuildUserPrompt:
    def test_contains_question_ids(self):
        prompt = _build_user_prompt(
            SAMPLE_QUESTIONS, SAMPLE_CORPUS, SAMPLE_SUMMARY
        )
        for q in SAMPLE_QUESTIONS:
            assert q.question_id in prompt

    def test_contains_corpus_and_summary(self):
        prompt = _build_user_prompt(
            SAMPLE_QUESTIONS, SAMPLE_CORPUS, SAMPLE_SUMMARY
        )
        assert "threshold of 0.85" in prompt
        assert "Segment B was excluded" in prompt

    def test_truncates_long_corpus(self):
        long_corpus = "x" * 10000
        prompt = _build_user_prompt(
            SAMPLE_QUESTIONS, long_corpus, SAMPLE_SUMMARY
        )
        assert "[truncated]" in prompt
        # Should not exceed reasonable size
        assert len(prompt) < 15000


# ------------------------------------------------------------------
# Test: _apply_decisions
# ------------------------------------------------------------------
class TestApplyDecisions:
    def test_answer_marks_status_and_fills_answer(self):
        questions = [
            _make_question("q1", "Why threshold 0.85?"),
        ]
        decisions = [{
            "question_id": "q1",
            "action": "answer",
            "priority": "P1",
            "answer": "Based on historical loss data.",
            "reasoning": "Corpus states the threshold explicitly.",
        }]
        result = _apply_decisions(questions, decisions)
        assert result[0].status == QuestionStatus.ANSWERED_BY_FILES
        assert result[0].answer == "Based on historical loss data."
        assert result[0].confidence == 0.8

    def test_merge_marks_status(self):
        questions = [
            _make_question("q1", "Why threshold 0.85?"),
            _make_question("q2", "What threshold is used?"),
        ]
        decisions = [
            {
                "question_id": "q1",
                "action": "keep_open",
                "priority": "P0",
                "reasoning": "Important.",
            },
            {
                "question_id": "q2",
                "action": "merge",
                "merge_into": "q1",
                "reasoning": "Duplicate of q1.",
            },
        ]
        result = _apply_decisions(questions, decisions)
        assert result[0].status == QuestionStatus.OPEN
        assert result[0].priority == QuestionPriority.P0
        assert result[1].status == QuestionStatus.MERGED

    def test_keep_open_sets_priority(self):
        questions = [_make_question("q1", "Who runs it?")]
        decisions = [{
            "question_id": "q1",
            "action": "keep_open",
            "priority": "P0",
            "reasoning": "Totally undocumented.",
        }]
        result = _apply_decisions(questions, decisions)
        assert result[0].status == QuestionStatus.OPEN
        assert result[0].priority == QuestionPriority.P0

    def test_missing_decision_defaults_to_p2_open(self):
        questions = [
            _make_question("q1", "Question A"),
            _make_question("q2", "Question B"),
        ]
        # LLM only returned a decision for q1
        decisions = [{
            "question_id": "q1",
            "action": "keep_open",
            "priority": "P1",
            "reasoning": "Keep.",
        }]
        result = _apply_decisions(questions, decisions)
        assert result[1].status == QuestionStatus.OPEN
        assert result[1].priority == QuestionPriority.P2

    def test_unknown_action_treated_as_open(self):
        questions = [_make_question("q1", "Test?")]
        decisions = [{
            "question_id": "q1",
            "action": "something_weird",
            "priority": "P1",
            "reasoning": "??",
        }]
        result = _apply_decisions(questions, decisions)
        assert result[0].status == QuestionStatus.OPEN


# ------------------------------------------------------------------
# Test: _enforce_cap
# ------------------------------------------------------------------
class TestEnforceCap:
    def test_deprioritizes_excess_p2_first(self, monkeypatch):
        monkeypatch.setattr(
            "backend.nodes.reconcile_questions.settings.MAX_OPEN_QUESTIONS", 2
        )
        questions = [
            _make_question("q1", "A", priority="P0"),
            _make_question("q2", "B", priority="P1"),
            _make_question("q3", "C", priority="P2"),
            _make_question("q4", "D", priority="P2"),
        ]
        _enforce_cap(questions)
        open_qs = [q for q in questions if q.status == QuestionStatus.OPEN]
        depri = [q for q in questions if q.status == QuestionStatus.DEPRIORITIZED]
        assert len(open_qs) == 2
        assert len(depri) == 2
        # P0 and P1 should survive
        assert open_qs[0].priority == QuestionPriority.P0
        assert open_qs[1].priority == QuestionPriority.P1

    def test_no_change_when_under_cap(self, monkeypatch):
        monkeypatch.setattr(
            "backend.nodes.reconcile_questions.settings.MAX_OPEN_QUESTIONS", 10
        )
        questions = [
            _make_question("q1", "A", priority="P0"),
            _make_question("q2", "B", priority="P1"),
        ]
        _enforce_cap(questions)
        open_qs = [q for q in questions if q.status == QuestionStatus.OPEN]
        assert len(open_qs) == 2

    def test_cap_at_exact_limit(self, monkeypatch):
        monkeypatch.setattr(
            "backend.nodes.reconcile_questions.settings.MAX_OPEN_QUESTIONS", 3
        )
        questions = [
            _make_question("q1", "A", priority="P0"),
            _make_question("q2", "B", priority="P1"),
            _make_question("q3", "C", priority="P2"),
        ]
        _enforce_cap(questions)
        open_qs = [q for q in questions if q.status == QuestionStatus.OPEN]
        assert len(open_qs) == 3  # exactly at limit, no change


# ------------------------------------------------------------------
# Test: reconcile_questions (full node, LLM mocked)
# ------------------------------------------------------------------
class TestReconcileQuestionsNode:
    @pytest.fixture
    def mock_storage(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            "backend.config.settings.SESSIONS_DIR", str(tmp_path)
        )
        from backend.services.storage import create_session
        store = create_session("Test")
        return store

    @pytest.mark.asyncio
    async def test_happy_path_with_mocked_llm(self, mock_storage):
        """LLM returns proper decisions — verify full flow."""
        llm_response = {
            "questions": [
                {
                    "question_id": "q1",
                    "action": "keep_open",
                    "priority": "P0",
                    "reasoning": "Totally undocumented.",
                },
                {
                    "question_id": "q2",
                    "action": "merge",
                    "merge_into": "q1",
                    "reasoning": "Same as q1.",
                },
                {
                    "question_id": "q3",
                    "action": "keep_open",
                    "priority": "P1",
                    "reasoning": "Undocumented process.",
                },
                {
                    "question_id": "q4",
                    "action": "answer",
                    "priority": "P2",
                    "answer": "Raw data comes from the data warehouse.",
                    "reasoning": "Corpus mentions data warehouse.",
                },
                {
                    "question_id": "q5",
                    "action": "keep_open",
                    "priority": "P0",
                    "reasoning": "Management decision, no docs.",
                },
            ],
        }

        state = {
            "session_id": mock_storage.session_id,
            "question_backlog": list(SAMPLE_QUESTIONS),  # copy
            "deep_dive_corpus": SAMPLE_CORPUS,
            "global_summary": SAMPLE_SUMMARY,
        }

        with patch(
            "backend.nodes.reconcile_questions.call_llm_json",
            new_callable=AsyncMock,
            return_value=llm_response,
        ):
            result = await reconcile_questions(state)

        backlog = result["question_backlog"]
        assert result["status"] == "questions_ready"

        # Check counts
        open_qs = [q for q in backlog if q.status == QuestionStatus.OPEN]
        answered = [q for q in backlog if q.status == QuestionStatus.ANSWERED_BY_FILES]
        merged = [q for q in backlog if q.status == QuestionStatus.MERGED]

        assert len(open_qs) == 3    # q1, q3, q5
        assert len(answered) == 1   # q4
        assert len(merged) == 1     # q2

        # Check q4 has an answer
        q4 = next(q for q in backlog if q.question_id == "q4")
        assert q4.answer == "Raw data comes from the data warehouse."

        # Check persistence
        saved = mock_storage.load_json("question_backlog.json")
        assert len(saved) == 5

    @pytest.mark.asyncio
    async def test_empty_backlog(self, mock_storage):
        """Empty input should return empty output without calling LLM."""
        state = {
            "session_id": mock_storage.session_id,
            "question_backlog": [],
            "deep_dive_corpus": "",
            "global_summary": "",
        }

        # Should NOT call LLM at all
        with patch(
            "backend.nodes.reconcile_questions.call_llm_json",
            new_callable=AsyncMock,
        ) as mock_llm:
            result = await reconcile_questions(state)
            mock_llm.assert_not_called()

        assert result["question_backlog"] == []
        assert result["status"] == "questions_ready"

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_cap(self, mock_storage):
        """If LLM fails, fall back to simple cap-and-persist."""
        state = {
            "session_id": mock_storage.session_id,
            "question_backlog": list(SAMPLE_QUESTIONS),
            "deep_dive_corpus": SAMPLE_CORPUS,
            "global_summary": SAMPLE_SUMMARY,
        }

        with patch(
            "backend.nodes.reconcile_questions.call_llm_json",
            new_callable=AsyncMock,
            side_effect=ValueError("LLM returned garbage"),
        ):
            result = await reconcile_questions(state)

        # Should still succeed (fallback)
        assert result["status"] == "questions_ready"
        assert len(result["question_backlog"]) == 5  # all kept

    @pytest.mark.asyncio
    async def test_cap_enforced_when_llm_keeps_too_many(
        self, mock_storage, monkeypatch
    ):
        """If LLM keeps more than MAX_OPEN_QUESTIONS, enforce the cap."""
        monkeypatch.setattr(
            "backend.nodes.reconcile_questions.settings.MAX_OPEN_QUESTIONS", 2
        )

        # LLM keeps all 5 as open
        llm_response = {
            "questions": [
                {
                    "question_id": q.question_id,
                    "action": "keep_open",
                    "priority": "P2",
                    "reasoning": "Keep.",
                }
                for q in SAMPLE_QUESTIONS
            ],
        }

        state = {
            "session_id": mock_storage.session_id,
            "question_backlog": list(SAMPLE_QUESTIONS),
            "deep_dive_corpus": SAMPLE_CORPUS,
            "global_summary": SAMPLE_SUMMARY,
        }

        with patch(
            "backend.nodes.reconcile_questions.call_llm_json",
            new_callable=AsyncMock,
            return_value=llm_response,
        ):
            result = await reconcile_questions(state)

        open_qs = [
            q for q in result["question_backlog"]
            if q.status == QuestionStatus.OPEN
        ]
        assert len(open_qs) == 2  # cap enforced

    @pytest.mark.asyncio
    async def test_persisted_file_matches_return_value(self, mock_storage):
        """The saved JSON should match the returned backlog."""
        llm_response = {
            "questions": [
                {
                    "question_id": "q1",
                    "action": "keep_open",
                    "priority": "P0",
                    "reasoning": "Important.",
                },
            ],
        }
        questions = [_make_question("q1", "Why threshold?")]

        state = {
            "session_id": mock_storage.session_id,
            "question_backlog": questions,
            "deep_dive_corpus": "some corpus",
            "global_summary": "some summary",
        }

        with patch(
            "backend.nodes.reconcile_questions.call_llm_json",
            new_callable=AsyncMock,
            return_value=llm_response,
        ):
            result = await reconcile_questions(state)

        saved = mock_storage.load_json("question_backlog.json")
        returned = [q.model_dump() for q in result["question_backlog"]]

        assert len(saved) == len(returned)
        assert saved[0]["question_id"] == returned[0]["question_id"]
        assert saved[0]["status"] == returned[0]["status"]

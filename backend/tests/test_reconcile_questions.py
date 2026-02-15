"""Tests for nodes/reconcile_questions.py — question dedup and prioritization.

The teammate rewrote this node to inline the helpers. These tests exercise
the node as a whole through mocked LLM calls, covering:
1. Deduplication (merge action)
2. Auto-resolution (answer action)
3. Priority reassignment (keep action with new priority)
4. Cap enforcement (deprioritize excess)
5. Empty backlog handling
6. LLM response edge cases (missing questions, unknown actions)

All LLM calls are mocked — no API key needed.
"""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from backend.config import settings
from backend.models.questions import (
    Question,
    QuestionOrigin,
    QuestionPriority,
    QuestionStatus,
)
from backend.nodes.reconcile_questions import reconcile_questions


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------
def _make_q(
    qid="q1",
    text="Why was this value chosen?",
    origin=QuestionOrigin.PER_FILE,
    priority=QuestionPriority.P1,
    status=QuestionStatus.OPEN,
) -> Question:
    return Question(
        question_id=qid,
        question_text=text,
        origin=origin,
        source_file_id="test_file",
        priority=priority,
        status=status,
    )


def _make_state(questions: list[Question]) -> dict:
    return {
        "session_id": "test-reconcile",
        "question_backlog": questions,
        "deep_dive_corpus": "Revenue model analysis: uses 5-year average.",
        "global_summary": "Cross-file analysis found rate mismatches.",
    }


# ==================================================================
# 1. EMPTY BACKLOG
# ==================================================================
class TestEmptyBacklog(unittest.IsolatedAsyncioTestCase):

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    async def test_empty_backlog_returns_empty(self, mock_storage_cls):
        state = _make_state([])
        result = await reconcile_questions(state)

        self.assertEqual(result["question_backlog"], [])
        self.assertEqual(result["status"], "questions_ready")
        # Should persist empty backlog
        mock_storage_cls.return_value.save_json.assert_called_once()


# ==================================================================
# 2. KEEP (PRIORITY REASSIGNMENT)
# ==================================================================
class TestKeepAction(unittest.IsolatedAsyncioTestCase):

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_keep_updates_priority(self, mock_llm, mock_storage_cls):
        q = _make_q("q1", priority=QuestionPriority.P2)
        mock_llm.return_value = {
            "reconciled": [
                {"question_id": "q1", "action": "keep", "priority": "P0"},
            ]
        }

        result = await reconcile_questions(_make_state([q]))

        backlog = result["question_backlog"]
        self.assertEqual(len(backlog), 1)
        self.assertEqual(backlog[0].priority, QuestionPriority.P0)
        self.assertEqual(backlog[0].status, QuestionStatus.OPEN)

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_keep_with_invalid_priority_keeps_original(self, mock_llm, mock_storage_cls):
        q = _make_q("q1", priority=QuestionPriority.P1)
        mock_llm.return_value = {
            "reconciled": [
                {"question_id": "q1", "action": "keep", "priority": "INVALID"},
            ]
        }

        result = await reconcile_questions(_make_state([q]))
        self.assertEqual(result["question_backlog"][0].priority, QuestionPriority.P1)


# ==================================================================
# 3. MERGE (DEDUP)
# ==================================================================
class TestMergeAction(unittest.IsolatedAsyncioTestCase):

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_merge_marks_status(self, mock_llm, mock_storage_cls):
        q1 = _make_q("q1", text="What is the rate?")
        q2 = _make_q("q2", text="How was the rate chosen?")
        mock_llm.return_value = {
            "reconciled": [
                {"question_id": "q1", "action": "keep", "priority": "P1"},
                {"question_id": "q2", "action": "merge", "merged_into": "q1"},
            ]
        }

        result = await reconcile_questions(_make_state([q1, q2]))

        backlog = result["question_backlog"]
        self.assertEqual(len(backlog), 2)

        merged = [q for q in backlog if q.question_id == "q2"][0]
        self.assertEqual(merged.status, QuestionStatus.MERGED)

        kept = [q for q in backlog if q.question_id == "q1"][0]
        self.assertEqual(kept.status, QuestionStatus.OPEN)


# ==================================================================
# 4. ANSWER (AUTO-RESOLVE)
# ==================================================================
class TestAnswerAction(unittest.IsolatedAsyncioTestCase):

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_answer_sets_status_and_answer_text(self, mock_llm, mock_storage_cls):
        q = _make_q("q1", text="What rate is used?")
        mock_llm.return_value = {
            "reconciled": [
                {
                    "question_id": "q1",
                    "action": "answer",
                    "answer": "The 5-year historical average of 3.5%.",
                },
            ]
        }

        result = await reconcile_questions(_make_state([q]))

        backlog = result["question_backlog"]
        answered = backlog[0]
        self.assertEqual(answered.status, QuestionStatus.ANSWERED_BY_FILES)
        self.assertIn("3.5%", answered.answer)


# ==================================================================
# 5. CAP ENFORCEMENT
# ==================================================================
class TestCapEnforcement(unittest.IsolatedAsyncioTestCase):

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_excess_questions_deprioritized(self, mock_llm, mock_storage_cls):
        """When LLM keeps too many, cap should deprioritize excess P2 first."""
        max_q = settings.MAX_OPEN_QUESTIONS
        # Create more questions than the cap
        questions = [_make_q(f"q{i}", priority=QuestionPriority.P2) for i in range(max_q + 5)]

        mock_llm.return_value = {
            "reconciled": [
                {"question_id": f"q{i}", "action": "keep", "priority": "P2"}
                for i in range(max_q + 5)
            ]
        }

        result = await reconcile_questions(_make_state(questions))

        backlog = result["question_backlog"]
        open_qs = [q for q in backlog if q.status == QuestionStatus.OPEN]
        depri_qs = [q for q in backlog if q.status == QuestionStatus.DEPRIORITIZED]

        self.assertLessEqual(len(open_qs), max_q)
        self.assertEqual(len(depri_qs), 5)

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_cap_preserves_higher_priority(self, mock_llm, mock_storage_cls):
        """P0 questions should be kept over P2 when capping."""
        max_q = settings.MAX_OPEN_QUESTIONS
        # Create P0 questions + P2 questions totaling more than cap
        p0_qs = [_make_q(f"p0-{i}", priority=QuestionPriority.P0) for i in range(3)]
        p2_qs = [_make_q(f"p2-{i}", priority=QuestionPriority.P2) for i in range(max_q + 3)]
        all_qs = p0_qs + p2_qs

        mock_llm.return_value = {
            "reconciled": [
                {"question_id": q.question_id, "action": "keep", "priority": q.priority.value}
                for q in all_qs
            ]
        }

        result = await reconcile_questions(_make_state(all_qs))

        open_qs = [q for q in result["question_backlog"] if q.status == QuestionStatus.OPEN]
        # All P0 should survive
        p0_open = [q for q in open_qs if q.priority == QuestionPriority.P0]
        self.assertEqual(len(p0_open), 3)

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_no_cap_when_under_limit(self, mock_llm, mock_storage_cls):
        q1 = _make_q("q1")
        q2 = _make_q("q2")
        mock_llm.return_value = {
            "reconciled": [
                {"question_id": "q1", "action": "keep", "priority": "P1"},
                {"question_id": "q2", "action": "keep", "priority": "P1"},
            ]
        }

        result = await reconcile_questions(_make_state([q1, q2]))

        open_qs = [q for q in result["question_backlog"] if q.status == QuestionStatus.OPEN]
        self.assertEqual(len(open_qs), 2)


# ==================================================================
# 6. EDGE CASES
# ==================================================================
class TestEdgeCases(unittest.IsolatedAsyncioTestCase):

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_missing_question_in_llm_response(self, mock_llm, mock_storage_cls):
        """If LLM omits a question, it should stay as-is."""
        q1 = _make_q("q1", priority=QuestionPriority.P1)
        q2 = _make_q("q2", priority=QuestionPriority.P2)
        mock_llm.return_value = {
            "reconciled": [
                {"question_id": "q1", "action": "keep", "priority": "P0"},
                # q2 not mentioned
            ]
        }

        result = await reconcile_questions(_make_state([q1, q2]))

        backlog = result["question_backlog"]
        q2_result = [q for q in backlog if q.question_id == "q2"][0]
        # Should keep original priority since LLM didn't touch it
        self.assertEqual(q2_result.priority, QuestionPriority.P2)
        self.assertEqual(q2_result.status, QuestionStatus.OPEN)

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_unknown_action_treated_as_keep(self, mock_llm, mock_storage_cls):
        q = _make_q("q1")
        mock_llm.return_value = {
            "reconciled": [
                {"question_id": "q1", "action": "unknown_action", "priority": "P1"},
            ]
        }

        result = await reconcile_questions(_make_state([q]))
        self.assertEqual(result["question_backlog"][0].status, QuestionStatus.OPEN)

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_mixed_actions(self, mock_llm, mock_storage_cls):
        """Mix of keep, merge, and answer in one batch."""
        q1 = _make_q("q1", text="What rate?")
        q2 = _make_q("q2", text="How was rate chosen?")
        q3 = _make_q("q3", text="Who is the CFO?")

        mock_llm.return_value = {
            "reconciled": [
                {"question_id": "q1", "action": "keep", "priority": "P0"},
                {"question_id": "q2", "action": "merge", "merged_into": "q1"},
                {"question_id": "q3", "action": "answer", "answer": "Jane Smith"},
            ]
        }

        result = await reconcile_questions(_make_state([q1, q2, q3]))

        backlog = result["question_backlog"]
        statuses = {q.question_id: q.status for q in backlog}
        self.assertEqual(statuses["q1"], QuestionStatus.OPEN)
        self.assertEqual(statuses["q2"], QuestionStatus.MERGED)
        self.assertEqual(statuses["q3"], QuestionStatus.ANSWERED_BY_FILES)

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_persists_backlog_json(self, mock_llm, mock_storage_cls):
        mock_store = mock_storage_cls.return_value
        q = _make_q("q1")
        mock_llm.return_value = {
            "reconciled": [
                {"question_id": "q1", "action": "keep", "priority": "P1"},
            ]
        }

        await reconcile_questions(_make_state([q]))

        mock_store.save_json.assert_called_once()
        path = mock_store.save_json.call_args[0][0]
        self.assertEqual(path, "question_backlog.json")

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_prompt_includes_corpus_and_summary(self, mock_llm, mock_storage_cls):
        """Verify the LLM prompt contains the evidence corpus and global summary."""
        q = _make_q("q1")
        mock_llm.return_value = {"reconciled": [{"question_id": "q1", "action": "keep", "priority": "P1"}]}

        state = _make_state([q])
        state["deep_dive_corpus"] = "Special corpus content"
        state["global_summary"] = "Special global summary"

        await reconcile_questions(state)

        user_prompt = mock_llm.call_args[0][1]
        self.assertIn("Special corpus content", user_prompt)
        self.assertIn("Special global summary", user_prompt)

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_prompt_truncates_long_corpus(self, mock_llm, mock_storage_cls):
        q = _make_q("q1")
        mock_llm.return_value = {"reconciled": [{"question_id": "q1", "action": "keep", "priority": "P1"}]}

        state = _make_state([q])
        state["deep_dive_corpus"] = "x" * 20_000

        await reconcile_questions(state)

        user_prompt = mock_llm.call_args[0][1]
        self.assertIn("[truncated]", user_prompt)
        # Should not exceed ~6000 chars for corpus portion
        self.assertLess(len(user_prompt), 25_000)


if __name__ == "__main__":
    unittest.main()

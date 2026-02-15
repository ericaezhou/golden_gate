"""Tests for nodes/generate_package.py — onboarding package generation.

Validates:
1. Both LLM calls receive the correct inputs (corpus, interview_summary, facts)
2. The OnboardingPackage is assembled correctly from LLM responses
3. Persistence: package.json + onboarding_docs.md are saved
4. The interview_summary is included in both prompts (the key "remix" ingredient)
5. Helpers format questions and FAQ correctly
6. Edge cases: empty inputs, missing fields

All LLM calls are mocked — no API key needed.
"""

from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, call, patch

from backend.models.artifacts import OnboardingPackage
from backend.models.questions import (
    Question,
    QuestionOrigin,
    QuestionPriority,
    QuestionStatus,
)
from backend.nodes.generate_package import (
    _build_faq_from_questions,
    _format_answered_questions,
    _package_to_markdown,
    generate_onboarding_package,
)


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------
def _make_question(
    qid="q1",
    status=QuestionStatus.ANSWERED_BY_INTERVIEW,
    priority=QuestionPriority.P1,
    answer="The rate is based on 5-year average.",
) -> Question:
    return Question(
        question_id=qid,
        question_text=f"Why was this value chosen? ({qid})",
        origin=QuestionOrigin.PER_FILE,
        source_file_id="revenue_model",
        status=status,
        priority=priority,
        answer=answer,
    )


def _mock_knowledge_entries_response() -> dict:
    return {
        "knowledge_entries": [
            {
                "category": "decision_rationale",
                "title": "Rate selection method",
                "detail": "Rate is based on 5-year historical average.",
                "source_files": ["revenue_model"],
            },
            {
                "category": "gotcha_or_failure_mode",
                "title": "Q4 manual override",
                "detail": "Every Q4, the rate must be manually adjusted for tax changes.",
                "source_files": ["revenue_model"],
            },
        ]
    }


def _mock_onboarding_doc_response() -> dict:
    return {
        "abstract": "This project manages quarterly revenue forecasting for the finance team.",
        "introduction": "The revenue model was built in 2021 to replace manual spreadsheet tracking. Key stakeholders are the CFO and FP&A team.",
        "details": "revenue_model.xlsx: Main forecasting model. Contains formulas for projecting revenue by product line.\nq3_deck.pptx: Quarterly presentation for leadership.",
        "faq": [
            {"q": "How often should I update the model?", "a": "Monthly, after close."},
            {"q": "Where does the input data come from?", "a": "Finance data warehouse, exported as CSV."},
        ],
        "risks_and_gotchas": [
            "Q4 tax adjustment must be done manually — no formula handles it.",
            "Hidden sheet 'Overrides' contains hardcoded values that break if renamed.",
        ],
    }


def _make_state(
    corpus="## File: revenue_model\nRevenue forecasting model...",
    global_summary="This is a revenue forecasting system with manual overrides.",
    interview_summary="Employee explained that the rate was chosen based on historical data. Q4 requires manual tax override.",
    facts=None,
    backlog=None,
) -> dict:
    if facts is None:
        facts = ["Rate based on 5-year avg", "Q4 needs manual override"]
    if backlog is None:
        backlog = [_make_question()]
    return {
        "session_id": "test-pkg",
        "deep_dive_corpus": corpus,
        "global_summary": global_summary,
        "interview_summary": interview_summary,
        "extracted_facts": facts,
        "question_backlog": backlog,
    }


# ==================================================================
# 1. HELPER FUNCTIONS
# ==================================================================
class TestFormatAnsweredQuestions(unittest.TestCase):

    def test_formats_answered_questions(self):
        q = _make_question(status=QuestionStatus.ANSWERED_BY_INTERVIEW)
        result = _format_answered_questions([q])
        self.assertIn("Why was this value chosen?", result)
        self.assertIn("5-year average", result)
        self.assertIn("P1", result)
        self.assertIn("per_file", result)

    def test_skips_unanswered(self):
        q = _make_question(status=QuestionStatus.OPEN, answer=None)
        result = _format_answered_questions([q])
        self.assertEqual(result, "(no answered questions)")

    def test_skips_answered_with_no_answer_text(self):
        q = _make_question(status=QuestionStatus.ANSWERED_BY_INTERVIEW, answer=None)
        result = _format_answered_questions([q])
        self.assertEqual(result, "(no answered questions)")

    def test_multiple_questions(self):
        q1 = _make_question("q1")
        q2 = _make_question("q2", answer="Different answer")
        result = _format_answered_questions([q1, q2])
        self.assertIn("q1", result)
        self.assertIn("q2", result)


class TestBuildFAQ(unittest.TestCase):

    def test_builds_faq_from_answered(self):
        q = _make_question()
        result = _build_faq_from_questions([q])
        self.assertIn("Q:", result)
        self.assertIn("A:", result)

    def test_empty_when_no_answers(self):
        q = _make_question(answer=None)
        result = _build_faq_from_questions([q])
        self.assertEqual(result, "(no Q&A pairs available)")


class TestPackageToMarkdown(unittest.TestCase):

    def test_contains_all_sections(self):
        pkg = OnboardingPackage(
            abstract="Test abstract",
            introduction="Test intro",
            details="Test details",
            faq=[{"q": "How?", "a": "Like this."}],
            risks_and_gotchas=["Watch out for X"],
            knowledge_entries=[{
                "category": "gotcha_or_failure_mode",
                "title": "X is fragile",
                "detail": "Be careful with X.",
            }],
        )
        md = _package_to_markdown(pkg)
        self.assertIn("# Onboarding Document", md)
        self.assertIn("## Abstract", md)
        self.assertIn("Test abstract", md)
        self.assertIn("## Introduction", md)
        self.assertIn("## Details", md)
        self.assertIn("## FAQ", md)
        self.assertIn("**Q:** How?", md)
        self.assertIn("**A:** Like this.", md)
        self.assertIn("## Risks & Gotchas", md)
        self.assertIn("Watch out for X", md)
        self.assertIn("## Knowledge Entries", md)
        self.assertIn("[gotcha_or_failure_mode]", md)

    def test_no_knowledge_entries_section_when_empty(self):
        pkg = OnboardingPackage(abstract="A", introduction="B", details="C")
        md = _package_to_markdown(pkg)
        self.assertNotIn("Knowledge Entries", md)


# ==================================================================
# 2. MAIN NODE — LLM CALL INPUTS
# ==================================================================
class TestGeneratePackageLLMInputs(unittest.IsolatedAsyncioTestCase):
    """Verify that the LLM calls receive correct prompt content."""

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_knowledge_entries_prompt_includes_interview_summary(
        self, mock_llm, mock_storage_cls
    ):
        """LLM call 1 should include interview_summary in the prompt."""
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]

        state = _make_state()
        await generate_onboarding_package(state)

        # First call is knowledge entries
        ke_call = mock_llm.call_args_list[0]
        ke_user_prompt = ke_call[0][1]  # second positional arg

        self.assertIn("interview summary", ke_user_prompt.lower())
        self.assertIn("rate was chosen based on historical data", ke_user_prompt)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_knowledge_entries_prompt_includes_facts(
        self, mock_llm, mock_storage_cls
    ):
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]

        state = _make_state()
        await generate_onboarding_package(state)

        ke_user_prompt = mock_llm.call_args_list[0][0][1]
        self.assertIn("Rate based on 5-year avg", ke_user_prompt)
        self.assertIn("Q4 needs manual override", ke_user_prompt)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_doc_prompt_includes_interview_summary(
        self, mock_llm, mock_storage_cls
    ):
        """LLM call 2 should include interview_summary in the prompt."""
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]

        state = _make_state()
        await generate_onboarding_package(state)

        # Second call is onboarding doc
        doc_call = mock_llm.call_args_list[1]
        doc_user_prompt = doc_call[0][1]

        self.assertIn("Interview Summary", doc_user_prompt)
        self.assertIn("rate was chosen based on historical data", doc_user_prompt)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_doc_prompt_includes_corpus_and_global_summary(
        self, mock_llm, mock_storage_cls
    ):
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]

        state = _make_state()
        await generate_onboarding_package(state)

        doc_user_prompt = mock_llm.call_args_list[1][0][1]
        self.assertIn("revenue forecasting model", doc_user_prompt.lower())
        self.assertIn("Global Summary", doc_user_prompt)
        self.assertIn("manual overrides", doc_user_prompt)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_doc_prompt_mentions_remix(
        self, mock_llm, mock_storage_cls
    ):
        """The prompt should ask the LLM to synthesize, not just copy."""
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]

        state = _make_state()
        await generate_onboarding_package(state)

        doc_user_prompt = mock_llm.call_args_list[1][0][1]
        self.assertIn("remix", doc_user_prompt.lower())


# ==================================================================
# 3. MAIN NODE — OUTPUT & PERSISTENCE
# ==================================================================
class TestGeneratePackageOutput(unittest.IsolatedAsyncioTestCase):
    """Verify the node produces correct output and persists correctly."""

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_returns_onboarding_package(self, mock_llm, mock_storage_cls):
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]

        state = _make_state()
        result = await generate_onboarding_package(state)

        self.assertIn("onboarding_package", result)
        pkg = result["onboarding_package"]
        self.assertIsInstance(pkg, OnboardingPackage)
        self.assertIn("revenue forecasting", pkg.abstract.lower())
        self.assertEqual(len(pkg.faq), 2)
        self.assertEqual(len(pkg.risks_and_gotchas), 2)
        self.assertEqual(len(pkg.knowledge_entries), 2)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_persists_json_and_markdown(self, mock_llm, mock_storage_cls):
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]
        mock_store = mock_storage_cls.return_value

        state = _make_state()
        await generate_onboarding_package(state)

        # Should save JSON
        json_calls = [
            c for c in mock_store.save_json.call_args_list
            if "package.json" in c[0][0]
        ]
        self.assertEqual(len(json_calls), 1)
        self.assertEqual(json_calls[0][0][0], "onboarding_package/package.json")

        # Should save markdown
        md_calls = [
            c for c in mock_store.save_text.call_args_list
            if "onboarding_docs.md" in c[0][0]
        ]
        self.assertEqual(len(md_calls), 1)
        self.assertEqual(md_calls[0][0][0], "onboarding_package/onboarding_docs.md")

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_markdown_contains_all_sections(self, mock_llm, mock_storage_cls):
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]
        mock_store = mock_storage_cls.return_value

        state = _make_state()
        await generate_onboarding_package(state)

        md_text = mock_store.save_text.call_args[0][1]
        self.assertIn("# Onboarding Document", md_text)
        self.assertIn("## Abstract", md_text)
        self.assertIn("## FAQ", md_text)
        self.assertIn("## Risks & Gotchas", md_text)
        self.assertIn("## Knowledge Entries", md_text)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_makes_exactly_two_llm_calls(self, mock_llm, mock_storage_cls):
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]

        state = _make_state()
        await generate_onboarding_package(state)

        self.assertEqual(mock_llm.await_count, 2)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_status_fields_in_result(self, mock_llm, mock_storage_cls):
        mock_llm.side_effect = [
            _mock_knowledge_entries_response(),
            _mock_onboarding_doc_response(),
        ]

        state = _make_state()
        result = await generate_onboarding_package(state)

        self.assertEqual(result["status"], "package_generated")
        self.assertEqual(result["current_step"], "generate_onboarding_package")


# ==================================================================
# 4. EDGE CASES
# ==================================================================
class TestGeneratePackageEdgeCases(unittest.IsolatedAsyncioTestCase):

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_empty_interview_summary(self, mock_llm, mock_storage_cls):
        """Node should work even if interview_summary is empty."""
        mock_llm.side_effect = [
            {"knowledge_entries": []},
            _mock_onboarding_doc_response(),
        ]

        state = _make_state(interview_summary="", facts=[], backlog=[])
        result = await generate_onboarding_package(state)

        pkg = result["onboarding_package"]
        self.assertIsInstance(pkg, OnboardingPackage)
        # The doc prompt should still be sent (with fallback text)
        doc_prompt = mock_llm.call_args_list[1][0][1]
        self.assertIn("no interview conducted", doc_prompt)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_missing_interview_summary_key(self, mock_llm, mock_storage_cls):
        """Node should handle state where interview_summary is not set at all."""
        mock_llm.side_effect = [
            {"knowledge_entries": []},
            _mock_onboarding_doc_response(),
        ]

        state = {
            "session_id": "test-pkg",
            "deep_dive_corpus": "some corpus",
            "global_summary": "some summary",
            # interview_summary deliberately omitted
            "extracted_facts": [],
            "question_backlog": [],
        }
        result = await generate_onboarding_package(state)

        self.assertIsInstance(result["onboarding_package"], OnboardingPackage)

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_empty_corpus(self, mock_llm, mock_storage_cls):
        """Node should work with empty corpus (e.g., no files parsed)."""
        mock_llm.side_effect = [
            {"knowledge_entries": []},
            {
                "abstract": "Empty project",
                "introduction": "",
                "details": "",
                "faq": [],
                "risks_and_gotchas": [],
            },
        ]

        state = _make_state(corpus="", global_summary="", interview_summary="")
        result = await generate_onboarding_package(state)

        self.assertEqual(result["onboarding_package"].abstract, "Empty project")

    @patch("backend.nodes.generate_package.SessionStorage")
    @patch("backend.nodes.generate_package.call_llm_json", new_callable=AsyncMock)
    async def test_knowledge_entries_passed_to_doc_call(
        self, mock_llm, mock_storage_cls
    ):
        """Knowledge entries from call 1 should be included in call 2's prompt."""
        ke_response = _mock_knowledge_entries_response()
        mock_llm.side_effect = [ke_response, _mock_onboarding_doc_response()]

        state = _make_state()
        await generate_onboarding_package(state)

        doc_prompt = mock_llm.call_args_list[1][0][1]
        # The knowledge entries should be serialized in the prompt
        self.assertIn("Rate selection method", doc_prompt)
        self.assertIn("Q4 manual override", doc_prompt)


if __name__ == "__main__":
    unittest.main()

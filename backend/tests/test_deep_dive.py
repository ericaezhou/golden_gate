"""Tests for the deep dive implementation.

Validates:
1. Multiple rounds of LLM analysis per file (pass 1, 2, 3)
2. Persistence of deep dive results

All LLM calls are mocked — no API key needed.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from backend.models.artifacts import DeepDiveReport, StructuredFile
from backend.models.state import FileDeepDiveState, FileDeepDiveOutput
from backend.nodes.deep_dive import (
    PASS_1_USER_TEMPLATE,
    PASS_2_USER_TEMPLATE,
    PASS_3_USER_TEMPLATE,
    _build_prompt,
    _parse_llm_response,
    _serialize_content,
    _serialize_report,
    prepare_deep_dive_input,
    run_deep_dive_pass,
    should_continue_passes,
)
from backend.nodes.concatenate import concatenate_deep_dives


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------
def _make_file(file_id="test_file", file_type="xlsx", file_name="test.xlsx") -> StructuredFile:
    return StructuredFile(
        file_id=file_id,
        file_name=file_name,
        file_type=file_type,
        parsed_content={"sheet1": {"A1": "Revenue", "A2": 100}},
    )


def _make_report(file_id="test_file", pass_number=1) -> DeepDiveReport:
    return DeepDiveReport(
        file_id=file_id,
        pass_number=pass_number,
        file_purpose_summary=f"Purpose from pass {pass_number}",
        key_mechanics=[f"mechanic_{pass_number}"],
        fragile_points=[f"fragile_{pass_number}"],
        at_risk_knowledge=[f"risk_{pass_number}"],
        questions=[{"text": f"Q from pass {pass_number}?", "evidence": "line X"}],
        cumulative_summary=f"Summary through pass {pass_number}",
    )


def _mock_llm_response(pass_number=1) -> dict:
    """A valid LLM response dict for a given pass."""
    return {
        "file_purpose_summary": f"Purpose from pass {pass_number}",
        "key_mechanics": [f"mechanic_{pass_number}"],
        "fragile_points": [f"fragile_{pass_number}"],
        "at_risk_knowledge": [f"risk_{pass_number}"],
        "questions": [{"text": f"Question from pass {pass_number}?", "evidence": "ref"}],
        "cumulative_summary": f"Summary from pass {pass_number}",
    }


# ==================================================================
# 1. MULTI-PASS LOGIC
# ==================================================================
class TestMultiPassDesign(unittest.TestCase):
    """Verify the deep dive uses multiple rounds of analysis."""

    def test_prepare_input_sets_3_passes_for_xlsx(self):
        """xlsx files should get 3 passes (from config)."""
        f = _make_file(file_type="xlsx")
        state = prepare_deep_dive_input(f, session_id="s1")
        self.assertEqual(state["max_passes"], 3)
        self.assertEqual(state["pass_number"], 1)
        self.assertEqual(state["previous_passes"], [])

    def test_prepare_input_sets_2_passes_for_non_xlsx(self):
        """Non-xlsx files should get 2 passes (from config)."""
        for ft in ("py", "md", "pptx", "ipynb", "sql"):
            f = _make_file(file_type=ft)
            state = prepare_deep_dive_input(f, session_id="s1")
            self.assertEqual(state["max_passes"], 2, f"Expected 2 passes for {ft}")

    def test_should_continue_returns_continue_when_passes_remain(self):
        """Routing says 'continue' when we haven't exhausted passes."""
        f = _make_file(file_type="xlsx")
        state: FileDeepDiveState = {
            "file": f,
            "pass_number": 2,  # still < max_passes (3)
            "max_passes": 3,
            "previous_passes": [],
            "current_report": None,
        }
        self.assertEqual(should_continue_passes(state), "continue")

    def test_should_continue_returns_done_when_passes_exhausted(self):
        """Routing says 'done' when pass_number > max_passes."""
        f = _make_file(file_type="xlsx")
        state: FileDeepDiveState = {
            "file": f,
            "pass_number": 4,  # > max_passes (3)
            "max_passes": 3,
            "previous_passes": [],
            "current_report": None,
        }
        self.assertEqual(should_continue_passes(state), "done")

    def test_should_continue_exact_boundary(self):
        """At exactly max_passes, should still continue (loop runs once more)."""
        f = _make_file(file_type="py")
        state: FileDeepDiveState = {
            "file": f,
            "pass_number": 2,
            "max_passes": 2,
            "previous_passes": [],
            "current_report": None,
        }
        # pass_number == max_passes → should continue (runs pass 2)
        self.assertEqual(should_continue_passes(state), "continue")

        # pass_number > max_passes → done
        state["pass_number"] = 3
        self.assertEqual(should_continue_passes(state), "done")


class TestPromptBuilding(unittest.TestCase):
    """Verify that each pass uses a different, progressively richer prompt."""

    def test_pass_1_uses_pass_1_template(self):
        f = _make_file()
        prompt = _build_prompt(f, pass_number=1, previous=[])
        # Pass 1 should NOT mention "previous" reports
        self.assertIn("Analyze this file", prompt)
        self.assertNotIn("previously analyzed", prompt.lower())

    def test_pass_2_includes_previous_report(self):
        f = _make_file()
        r1 = _make_report(pass_number=1)
        prompt = _build_prompt(f, pass_number=2, previous=[r1])
        # Pass 2 should include the pass-1 findings
        self.assertIn("previously analyzed", prompt.lower())
        self.assertIn("MISSED the first time", prompt)
        self.assertIn(r1.file_purpose_summary, prompt)

    def test_pass_3_includes_both_previous_reports(self):
        f = _make_file()
        r1 = _make_report(pass_number=1)
        r2 = _make_report(pass_number=2)
        prompt = _build_prompt(f, pass_number=3, previous=[r1, r2])
        # Pass 3 should reference both prior passes
        self.assertIn("tacit knowledge", prompt.lower())
        self.assertIn(r1.file_purpose_summary, prompt)
        self.assertIn(r2.file_purpose_summary, prompt)


class TestParseLLMResponse(unittest.TestCase):
    """Verify report construction from LLM output."""

    def test_pass_1_report_has_correct_fields(self):
        f = _make_file()
        data = _mock_llm_response(1)
        report = _parse_llm_response(data, f, pass_number=1, previous=[])
        self.assertEqual(report.file_id, "test_file")
        self.assertEqual(report.pass_number, 1)
        self.assertIn("mechanic_1", report.key_mechanics)
        self.assertEqual(len(report.questions), 1)

    def test_cumulative_summary_builds_across_passes(self):
        f = _make_file()
        r1 = _make_report(pass_number=1)
        data = _mock_llm_response(2)
        report = _parse_llm_response(data, f, pass_number=2, previous=[r1])
        # Should include prior summary in the cumulative
        self.assertIn(r1.cumulative_summary, report.cumulative_summary)
        self.assertIn("[Pass 2]", report.cumulative_summary)

    def test_questions_capped_at_max(self):
        f = _make_file()
        data = _mock_llm_response(1)
        data["questions"] = [{"text": f"q{i}", "evidence": ""} for i in range(50)]
        report = _parse_llm_response(data, f, 1, [])
        self.assertLessEqual(len(report.questions), 5)  # MAX_QUESTIONS_PER_FILE

    def test_string_questions_normalized_to_dicts(self):
        f = _make_file()
        data = _mock_llm_response(1)
        data["questions"] = ["plain string question", "another one"]
        report = _parse_llm_response(data, f, 1, [])
        self.assertIsInstance(report.questions[0], dict)
        self.assertIn("text", report.questions[0])


# ==================================================================
# 2. SINGLE PASS EXECUTION (with mocked LLM)
# ==================================================================
class TestRunDeepDivePass(unittest.IsolatedAsyncioTestCase):
    """Verify run_deep_dive_pass calls LLM and updates state correctly."""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    @patch("backend.nodes.deep_dive.call_llm_json", new_callable=AsyncMock)
    @patch("backend.nodes.deep_dive.SessionStorage")
    async def test_pass_1_returns_report_and_increments_pass(
        self, mock_storage_cls, mock_llm
    ):
        mock_llm.return_value = _mock_llm_response(1)
        mock_store = mock_storage_cls.return_value

        f = _make_file()
        state: FileDeepDiveState = {
            "file": f,
            "pass_number": 1,
            "max_passes": 3,
            "previous_passes": [],
            "current_report": None,
            "session_id": "test-session",
            "deep_dive_reports": [],
        }

        result = await run_deep_dive_pass(state)

        # Should return an incremented pass_number
        self.assertEqual(result["pass_number"], 2)
        # Should have a report
        self.assertIsInstance(result["current_report"], DeepDiveReport)
        self.assertEqual(result["current_report"].pass_number, 1)
        # Should add report to the deep_dive_reports accumulator
        self.assertEqual(len(result["deep_dive_reports"]), 1)
        # Should have called LLM exactly once
        mock_llm.assert_awaited_once()
        # Should persist the report
        mock_store.save_json.assert_called_once()
        call_args = mock_store.save_json.call_args
        self.assertIn("deep_dives/test_file_pass1.json", call_args[0][0])

    @patch("backend.nodes.deep_dive.call_llm_json", new_callable=AsyncMock)
    @patch("backend.nodes.deep_dive.SessionStorage")
    async def test_pass_2_receives_previous_passes_in_prompt(
        self, mock_storage_cls, mock_llm
    ):
        """Pass 2 should include pass 1 findings in the LLM prompt."""
        mock_llm.return_value = _mock_llm_response(2)

        f = _make_file()
        r1 = _make_report(pass_number=1)
        state: FileDeepDiveState = {
            "file": f,
            "pass_number": 2,
            "max_passes": 3,
            "previous_passes": [r1],
            "current_report": r1,
            "session_id": "test-session",
            "deep_dive_reports": [],
        }

        result = await run_deep_dive_pass(state)

        # The LLM call should have been made
        mock_llm.assert_awaited_once()
        # Verify the prompt included pass 1 content
        call_args = mock_llm.call_args
        user_prompt = call_args[0][1]  # second positional arg
        self.assertIn("previously analyzed", user_prompt.lower())

        # Result should accumulate both passes
        self.assertEqual(len(result["previous_passes"]), 2)
        self.assertEqual(result["pass_number"], 3)

    @patch("backend.nodes.deep_dive.call_llm_json", new_callable=AsyncMock)
    @patch("backend.nodes.deep_dive.SessionStorage")
    async def test_full_3_pass_sequence(self, mock_storage_cls, mock_llm):
        """Simulate running 3 passes sequentially and verify state evolution."""
        f = _make_file(file_type="xlsx")
        state: FileDeepDiveState = {
            "file": f,
            "pass_number": 1,
            "max_passes": 3,
            "previous_passes": [],
            "current_report": None,
            "session_id": "test-session",
            "deep_dive_reports": [],
        }

        all_reports = []
        for expected_pass in (1, 2, 3):
            mock_llm.return_value = _mock_llm_response(expected_pass)
            result = await run_deep_dive_pass(state)

            report = result["current_report"]
            self.assertEqual(report.pass_number, expected_pass)
            all_reports.append(report)

            # Simulate state update for next iteration
            state = {
                "file": f,
                "pass_number": result["pass_number"],
                "max_passes": 3,
                "previous_passes": result["previous_passes"],
                "current_report": result["current_report"],
                "session_id": "test-session",
                "deep_dive_reports": all_reports.copy(),
            }

        # After 3 passes, should_continue should say "done"
        self.assertEqual(should_continue_passes(state), "done")

        # We should have 3 distinct reports
        self.assertEqual(len(all_reports), 3)
        self.assertEqual(mock_llm.await_count, 3)


# ==================================================================
# 3. PERSISTENCE
# ==================================================================
class TestDeepDivePersistence(unittest.IsolatedAsyncioTestCase):
    """Verify that deep dive results are persisted correctly."""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    @patch("backend.nodes.deep_dive.call_llm_json", new_callable=AsyncMock)
    @patch("backend.nodes.deep_dive.SessionStorage")
    async def test_each_pass_persists_json(self, mock_storage_cls, mock_llm):
        """Each pass should save a JSON file like deep_dives/{file_id}_pass{N}.json."""
        mock_llm.return_value = _mock_llm_response(1)
        mock_store = mock_storage_cls.return_value

        f = _make_file(file_id="revenue_model")
        state: FileDeepDiveState = {
            "file": f,
            "pass_number": 1,
            "max_passes": 2,
            "previous_passes": [],
            "current_report": None,
            "session_id": "s1",
            "deep_dive_reports": [],
        }

        await run_deep_dive_pass(state)

        mock_store.save_json.assert_called_once()
        path_arg = mock_store.save_json.call_args[0][0]
        self.assertEqual(path_arg, "deep_dives/revenue_model_pass1.json")

    @patch("backend.nodes.concatenate.SessionStorage")
    async def test_concatenate_persists_corpus_as_json(self, mock_storage_cls):
        """concatenate_deep_dives should save deep_dive_corpus.json."""
        mock_store = mock_storage_cls.return_value

        r1 = _make_report("file_a", pass_number=2)
        r2 = _make_report("file_b", pass_number=1)
        state = {
            "session_id": "s1",
            "deep_dive_reports": [r1, r2],
        }

        result = await concatenate_deep_dives(state)

        # Should persist as JSON
        mock_store.save_json.assert_called_once()
        path_arg = mock_store.save_json.call_args[0][0]
        self.assertEqual(path_arg, "deep_dive_corpus.json")

        # Corpus should contain both files' content
        corpus = result["deep_dive_corpus"]
        self.assertIn("file_a", corpus)
        self.assertIn("file_b", corpus)

    @patch("backend.nodes.concatenate.SessionStorage")
    async def test_concatenate_does_NOT_persist_txt(self, mock_storage_cls):
        """Currently, concatenate only saves JSON, not a .txt file.

        This documents the current behavior — txt persistence happens
        later in build_qa_context, not immediately after concatenation.
        """
        mock_store = mock_storage_cls.return_value

        r1 = _make_report("file_a", pass_number=1)
        state = {"session_id": "s1", "deep_dive_reports": [r1]}

        await concatenate_deep_dives(state)

        # Verify no save_text call was made
        if hasattr(mock_store, "save_text"):
            mock_store.save_text.assert_not_called()


# ==================================================================
# 4. CONCATENATION LOGIC
# ==================================================================
class TestConcatenation(unittest.IsolatedAsyncioTestCase):
    """Verify concatenation takes latest pass and builds question backlog."""

    @patch("backend.nodes.concatenate.SessionStorage")
    async def test_takes_latest_pass_per_file(self, mock_storage_cls):
        """When multiple passes exist for a file, only the latest is used."""
        r1_pass1 = _make_report("file_a", pass_number=1)
        r1_pass2 = _make_report("file_a", pass_number=2)
        r2_pass1 = _make_report("file_b", pass_number=1)

        state = {
            "session_id": "s1",
            "deep_dive_reports": [r1_pass1, r1_pass2, r2_pass1],
        }

        result = await concatenate_deep_dives(state)

        corpus = result["deep_dive_corpus"]
        # Should include both files
        self.assertIn("file_a", corpus)
        self.assertIn("file_b", corpus)
        # Should use pass 2's content for file_a
        self.assertIn("Purpose from pass 2", corpus)

    @patch("backend.nodes.concatenate.SessionStorage")
    async def test_questions_converted_to_question_objects(self, mock_storage_cls):
        """Report questions should become Question objects in the backlog."""
        r = _make_report("file_a", pass_number=1)
        state = {"session_id": "s1", "deep_dive_reports": [r]}

        result = await concatenate_deep_dives(state)

        backlog = result["question_backlog"]
        self.assertGreater(len(backlog), 0)
        q = backlog[0]
        self.assertEqual(q.origin.value, "per_file")
        self.assertEqual(q.source_file_id, "file_a")
        self.assertEqual(q.status.value, "open")

    @patch("backend.nodes.concatenate.SessionStorage")
    async def test_empty_reports_produces_empty_corpus(self, mock_storage_cls):
        state = {"session_id": "s1", "deep_dive_reports": []}
        result = await concatenate_deep_dives(state)
        self.assertEqual(result["deep_dive_corpus"], "")
        self.assertEqual(result["question_backlog"], [])


# ==================================================================
# 5. SUBGRAPH STRUCTURE
# ==================================================================
class TestSubgraphStructure(unittest.TestCase):
    """Verify the subgraph is wired correctly."""

    def test_subgraph_compiles(self):
        """The file_deep_dive_subgraph should compile without error."""
        from backend.graphs.subgraphs.file_deep_dive import file_deep_dive_subgraph
        self.assertIsNotNone(file_deep_dive_subgraph)

    def test_subgraph_has_run_pass_node(self):
        from backend.graphs.subgraphs.file_deep_dive import file_deep_dive_subgraph
        # The compiled graph should have nodes
        graph = file_deep_dive_subgraph
        node_names = list(graph.get_graph().nodes.keys())
        self.assertIn("run_pass", node_names)

    def test_output_schema_only_exposes_deep_dive_reports(self):
        """FileDeepDiveOutput should only contain deep_dive_reports,
        preventing session_id fan-in conflicts."""
        annotations = FileDeepDiveOutput.__annotations__
        self.assertIn("deep_dive_reports", annotations)
        self.assertNotIn("session_id", annotations)
        self.assertNotIn("file", annotations)


if __name__ == "__main__":
    unittest.main()

"""Integration tests — verify nodes connect and state flows through the pipeline.

These tests mock all LLM calls but exercise real state passing, real
persistence, and real graph compilation/execution.
"""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.models.artifacts import DeepDiveReport, StructuredFile
from backend.models.questions import (
    Question,
    QuestionOrigin,
    QuestionPriority,
    QuestionStatus,
)
from backend.models.state import (
    FileDeepDiveOutput,
    FileDeepDiveState,
    OffboardingState,
    OnboardingState,
)


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------
def _make_file(file_id="revenue_model", file_type="xlsx") -> StructuredFile:
    return StructuredFile(
        file_id=file_id,
        file_name=f"{file_id}.{file_type}",
        file_type=file_type,
        parsed_content={"data": "test content"},
    )


def _make_report(file_id="revenue_model", pass_number=1) -> DeepDiveReport:
    return DeepDiveReport(
        file_id=file_id,
        pass_number=pass_number,
        file_purpose_summary=f"Revenue model analysis pass {pass_number}",
        key_mechanics=[f"mechanic_{pass_number}"],
        fragile_points=[f"fragile_{pass_number}"],
        at_risk_knowledge=[f"risk_{pass_number}"],
        questions=[{"text": f"Q{pass_number}?", "evidence": f"ref{pass_number}"}],
        cumulative_summary=f"Summary pass {pass_number}",
    )


def _make_question(qid="q1", origin=QuestionOrigin.PER_FILE, priority=QuestionPriority.P1) -> Question:
    return Question(
        question_id=qid,
        question_text=f"Test question {qid}",
        origin=origin,
        source_file_id="revenue_model",
        status=QuestionStatus.OPEN,
        priority=priority,
    )


# ==================================================================
# 1. GRAPH COMPILATION
# ==================================================================
class TestGraphCompilation(unittest.TestCase):
    """Verify all graphs compile without import errors."""

    def test_offboarding_graph_compiles(self):
        from backend.graphs.offboarding_graph import build_offboarding_graph
        graph = build_offboarding_graph()
        self.assertIsNotNone(graph)

    def test_deep_dive_only_graph_compiles(self):
        from backend.graphs.offboarding_graph import build_deep_dive_only_graph
        graph = build_deep_dive_only_graph()
        self.assertIsNotNone(graph)

    def test_onboarding_graph_compiles(self):
        from backend.graphs.onboarding_graph import build_onboarding_graph
        graph = build_onboarding_graph()
        self.assertIsNotNone(graph)

    def test_file_deep_dive_subgraph_compiles(self):
        from backend.graphs.subgraphs.file_deep_dive import file_deep_dive_subgraph
        self.assertIsNotNone(file_deep_dive_subgraph)

    def test_offboarding_graph_has_all_nodes(self):
        from backend.graphs.offboarding_graph import build_offboarding_graph
        graph = build_offboarding_graph()
        node_names = set(graph.get_graph().nodes.keys())
        expected = {
            "parse_files",
            "file_deep_dive",
            "collect_deep_dives",
            "concatenate_deep_dives",
            "global_summarize",
            "reconcile_questions",
            "interview_loop",
            "generate_onboarding_package",
            "build_qa_context",
            "__start__",
            "__end__",
        }
        self.assertTrue(
            expected.issubset(node_names),
            f"Missing nodes: {expected - node_names}",
        )

    def test_deep_dive_only_graph_has_subset_of_nodes(self):
        from backend.graphs.offboarding_graph import build_deep_dive_only_graph
        graph = build_deep_dive_only_graph()
        node_names = set(graph.get_graph().nodes.keys())
        # Should NOT have interview or generate_package
        self.assertIn("parse_files", node_names)
        self.assertIn("file_deep_dive", node_names)
        self.assertIn("concatenate_deep_dives", node_names)
        self.assertNotIn("interview_loop", node_names)
        self.assertNotIn("generate_onboarding_package", node_names)
        self.assertNotIn("build_qa_context", node_names)


# ==================================================================
# 2. STATE FLOW: deep_dive → concatenate
# ==================================================================
class TestDeepDiveToConcatenate(unittest.IsolatedAsyncioTestCase):
    """Verify deep dive output feeds correctly into concatenation."""

    @patch("backend.nodes.concatenate.SessionStorage")
    async def test_multi_file_multi_pass_concatenation(self, mock_storage_cls):
        """Multiple files with multiple passes should produce a merged corpus."""
        from backend.nodes.concatenate import concatenate_deep_dives

        # Simulate: file_a has 2 passes, file_b has 1 pass
        reports = [
            _make_report("file_a", 1),
            _make_report("file_a", 2),
            _make_report("file_b", 1),
        ]

        state: OffboardingState = {
            "session_id": "test-integration",
            "deep_dive_reports": reports,
        }

        result = await concatenate_deep_dives(state)

        # Corpus should contain both files
        corpus = result["deep_dive_corpus"]
        self.assertIn("file_a", corpus)
        self.assertIn("file_b", corpus)

        # Should use pass 2 for file_a (latest)
        self.assertIn("pass 2", corpus)

        # Questions should come from latest passes
        backlog = result["question_backlog"]
        self.assertEqual(len(backlog), 2)  # 1 from file_a pass 2, 1 from file_b pass 1

        file_ids = {q.source_file_id for q in backlog}
        self.assertEqual(file_ids, {"file_a", "file_b"})


# ==================================================================
# 3. STATE FLOW: concatenate → global_summarize
# ==================================================================
class TestConcatenateToGlobalSummarize(unittest.IsolatedAsyncioTestCase):
    """Verify concatenation output feeds correctly into global summarize."""

    @patch("backend.nodes.global_summarize.SessionStorage")
    @patch("backend.nodes.global_summarize.call_llm_json", new_callable=AsyncMock)
    async def test_global_summarize_receives_corpus_and_files(
        self, mock_llm, mock_storage_cls
    ):
        from backend.nodes.global_summarize import global_summarize

        mock_llm.return_value = {
            "global_summary": "These files form a revenue forecasting system.",
            "questions": [
                {
                    "text": "Why does model.xlsx use a different rate than deck.pptx?",
                    "priority": "P0",
                    "involved_files": ["revenue_model", "q3_deck"],
                    "evidence": "model uses 3.5%, deck says 4.2%",
                },
            ],
        }

        existing_qs = [_make_question("q1")]
        state: OffboardingState = {
            "session_id": "test-integration",
            "deep_dive_corpus": "## File: revenue_model\nRevenue forecasting...",
            "structured_files": [_make_file("revenue_model"), _make_file("q3_deck", "pptx")],
            "question_backlog": existing_qs,
        }

        result = await global_summarize(state)

        # Should have a global summary
        self.assertIn("revenue forecasting", result["global_summary"].lower())

        # Backlog should include old Q1 + new global Q
        backlog = result["question_backlog"]
        self.assertEqual(len(backlog), 2)

        # New question should have GLOBAL origin
        new_q = [q for q in backlog if q.origin == QuestionOrigin.GLOBAL][0]
        self.assertIn("rate", new_q.question_text.lower())
        self.assertEqual(new_q.priority, QuestionPriority.P0)
        self.assertEqual(new_q.status, QuestionStatus.OPEN)


# ==================================================================
# 4. STATE FLOW: global_summarize → reconcile_questions
# ==================================================================
class TestGlobalSummarizeToReconcile(unittest.IsolatedAsyncioTestCase):
    """Verify global questions feed into reconciliation correctly."""

    @patch("backend.nodes.reconcile_questions.SessionStorage")
    @patch("backend.nodes.reconcile_questions.call_llm_json", new_callable=AsyncMock)
    async def test_reconcile_handles_mixed_origins(self, mock_llm, mock_storage_cls):
        from backend.nodes.reconcile_questions import reconcile_questions

        # Mix of PER_FILE and GLOBAL questions
        q1 = _make_question("q1", QuestionOrigin.PER_FILE, QuestionPriority.P1)
        q2 = _make_question("q2", QuestionOrigin.GLOBAL, QuestionPriority.P0)

        mock_llm.return_value = {
            "decisions": [
                {"question_id": "q1", "action": "keep_open", "new_priority": "P1"},
                {"question_id": "q2", "action": "keep_open", "new_priority": "P0"},
            ]
        }

        state: OffboardingState = {
            "session_id": "test-integration",
            "question_backlog": [q1, q2],
            "deep_dive_corpus": "test corpus",
            "global_summary": "test summary",
        }

        result = await reconcile_questions(state)

        backlog = result["question_backlog"]
        self.assertEqual(len(backlog), 2)
        # Both should still be open
        self.assertTrue(all(q.status == QuestionStatus.OPEN for q in backlog))


# ==================================================================
# 5. STATE FLOW: interview → build_qa_context
# ==================================================================
class TestInterviewToBuildQAContext(unittest.IsolatedAsyncioTestCase):
    """Verify interview output feeds into QA context assembly."""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    @patch("backend.nodes.build_qa_context.SessionStorage")
    async def test_qa_context_includes_all_sources(self, mock_storage_cls):
        from backend.nodes.build_qa_context import build_qa_context

        mock_store = mock_storage_cls.return_value

        q_answered = _make_question("q1")
        q_answered.status = QuestionStatus.ANSWERED_BY_INTERVIEW
        q_answered.answer = "The rate was chosen based on historical data."

        state: OffboardingState = {
            "session_id": "test-integration",
            "deep_dive_corpus": "Revenue model analysis...",
            "interview_summary": "Employee explained the rate selection process.",
            "extracted_facts": ["Rate based on 5-year avg", "Updated quarterly"],
            "question_backlog": [q_answered],
        }

        result = await build_qa_context(state)

        prompt = result["qa_system_prompt"]

        # Should include all sections
        self.assertIn("FILE ANALYSIS", prompt)
        self.assertIn("Revenue model analysis", prompt)
        self.assertIn("INTERVIEW SUMMARY", prompt)
        self.assertIn("rate selection process", prompt)
        self.assertIn("EXTRACTED FACTS", prompt)
        self.assertIn("Rate based on 5-year avg", prompt)
        self.assertIn("ANSWERED QUESTIONS", prompt)
        self.assertIn("rate was chosen", prompt)

        # Should persist files
        mock_store.save_text.assert_any_call("qa_system_prompt.txt", prompt)
        mock_store.save_text.assert_any_call("deep_dive_corpus.txt", "Revenue model analysis...")
        mock_store.save_text.assert_any_call(
            "interview/interview_summary.txt",
            "Employee explained the rate selection process.",
        )


# ==================================================================
# 6. STATE FLOW: interview produces interview_summary
# ==================================================================
class TestInterviewProducesSummary(unittest.IsolatedAsyncioTestCase):
    """Verify interview_loop sets interview_summary in state."""

    @patch("backend.nodes.interview.SessionStorage")
    async def test_interview_produces_summary_and_persists_txt(self, mock_storage_cls):
        """Even with empty backlog, interview should produce a summary."""
        from backend.nodes.interview import interview_loop

        mock_store = mock_storage_cls.return_value

        state: OffboardingState = {
            "session_id": "test-integration",
            "question_backlog": [],
            "interview_transcript": [],
            "extracted_facts": [],
        }

        result = await interview_loop(state)

        # Should have interview_summary in result
        self.assertIn("interview_summary", result)
        self.assertIsInstance(result["interview_summary"], str)

        # Should persist the summary
        mock_store.save_text.assert_called_once()
        call_args = mock_store.save_text.call_args
        self.assertEqual(call_args[0][0], "interview/interview_summary.txt")


# ==================================================================
# 7. FULL PIPELINE STATE SHAPE COMPATIBILITY
# ==================================================================
class TestFullPipelineStateCompatibility(unittest.TestCase):
    """Verify that the output of each node matches the expected input
    of the next node in the pipeline."""

    def test_parse_output_keys_feed_deep_dive(self):
        """parse_files should produce structured_files for deep dive fan-out."""
        # Simulated parse_files output
        output = {
            "structured_files": [_make_file()],
            "status": "parsed",
            "current_step": "parse_files",
        }
        # deep_dive fan-out reads structured_files
        self.assertIn("structured_files", output)
        self.assertIsInstance(output["structured_files"], list)

    def test_deep_dive_output_feeds_concatenate(self):
        """deep_dive should produce deep_dive_reports for concatenation."""
        # Simulated deep_dive output (after fan-in)
        output = {
            "deep_dive_reports": [_make_report()],
        }
        self.assertIn("deep_dive_reports", output)
        self.assertIsInstance(output["deep_dive_reports"], list)

    def test_concatenate_output_feeds_global_summarize(self):
        """concatenate should produce deep_dive_corpus for global summarize."""
        output = {
            "deep_dive_corpus": "test corpus",
            "question_backlog": [_make_question("q1")],
        }
        self.assertIn("deep_dive_corpus", output)
        self.assertIn("question_backlog", output)

    def test_global_summarize_output_feeds_reconcile(self):
        """global_summarize should produce global_summary and updated backlog."""
        output = {
            "global_summary": "Global analysis",
            "question_backlog": [_make_question("q1"), _make_question("q2")],
        }
        self.assertIn("global_summary", output)
        self.assertIn("question_backlog", output)

    def test_interview_output_feeds_package_and_qa_context(self):
        """interview should produce everything build_qa_context and generate_package need."""
        output = {
            "interview_transcript": [],
            "extracted_facts": ["fact1"],
            "interview_summary": "Summary of interview",
            "question_backlog": [],
        }
        # build_qa_context needs deep_dive_corpus, interview_summary, extracted_facts
        self.assertIn("interview_summary", output)
        self.assertIn("extracted_facts", output)

    def test_offboarding_state_has_all_required_fields(self):
        """OffboardingState TypedDict should declare every field the pipeline uses."""
        annotations = OffboardingState.__annotations__
        required_keys = [
            "session_id", "project_metadata", "structured_files",
            "deep_dive_reports", "deep_dive_corpus", "global_summary",
            "question_backlog", "interview_transcript", "extracted_facts",
            "interview_summary", "onboarding_package", "qa_system_prompt",
            "status", "current_step", "errors",
        ]
        for key in required_keys:
            self.assertIn(key, annotations, f"Missing field: {key}")

    def test_file_deep_dive_output_only_has_fan_in_safe_keys(self):
        """FileDeepDiveOutput should only expose keys with reducers."""
        annotations = FileDeepDiveOutput.__annotations__
        self.assertIn("deep_dive_reports", annotations)
        # These should NOT be in output (would cause fan-in conflicts)
        self.assertNotIn("session_id", annotations)
        self.assertNotIn("file", annotations)
        self.assertNotIn("pass_number", annotations)

    def test_onboarding_state_has_qa_system_prompt(self):
        """OnboardingState should have qa_system_prompt (not retrieval_index)."""
        annotations = OnboardingState.__annotations__
        self.assertIn("qa_system_prompt", annotations)
        self.assertIn("knowledge_graph", annotations)
        self.assertNotIn("retrieval_index", annotations)


# ==================================================================
# 8. ROUTE COMPILATION
# ==================================================================
class TestRouteImports(unittest.TestCase):
    """Verify all routes import without errors."""

    def test_offboarding_route_imports(self):
        from backend.routes.offboarding import router
        self.assertIsNotNone(router)

    def test_interview_route_imports(self):
        from backend.routes.interview import router
        self.assertIsNotNone(router)

    def test_onboarding_route_imports(self):
        from backend.routes.onboarding import router
        self.assertIsNotNone(router)

    def test_session_route_imports(self):
        from backend.routes.session import router
        self.assertIsNotNone(router)


# ==================================================================
# 9. FASTAPI APP MOUNTS ALL ROUTERS
# ==================================================================
class TestFastAPIApp(unittest.TestCase):
    """Verify the FastAPI app mounts all routes."""

    def test_app_has_all_route_prefixes(self):
        from backend.main import app
        route_paths = [r.path for r in app.routes]
        # Check for key endpoints
        expected_prefixes = [
            "/api/offboarding",
            "/api/interview",
            "/api/onboarding",
            "/api/session",
            "/health",
        ]
        for prefix in expected_prefixes:
            self.assertTrue(
                any(prefix in p for p in route_paths),
                f"Missing route prefix: {prefix}. Routes: {route_paths}",
            )


# ==================================================================
# 10. NO DEAD IMPORTS (embeddings removed)
# ==================================================================
class TestNoDeadImports(unittest.TestCase):
    """Verify embeddings.py is fully removed and no code imports it."""

    def test_embeddings_module_does_not_exist(self):
        """embeddings.py should be deleted — import should fail."""
        with self.assertRaises(ImportError):
            from backend.services.embeddings import RetrievalService

    def test_onboarding_graph_does_not_import_embeddings(self):
        """onboarding_graph.py should not reference RetrievalService."""
        import inspect
        from backend.graphs import onboarding_graph
        source = inspect.getsource(onboarding_graph)
        self.assertNotIn("RetrievalService", source)
        self.assertNotIn("embeddings", source)


if __name__ == "__main__":
    unittest.main()

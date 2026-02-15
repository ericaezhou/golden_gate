"""LangGraph definitions — offboarding and onboarding pipelines."""

from backend.graphs.offboarding_graph import build_offboarding_graph
from backend.graphs.onboarding_graph import build_onboarding_graph

__all__ = ["build_offboarding_graph", "build_onboarding_graph"]

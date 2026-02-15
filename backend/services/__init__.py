"""Shared services — LLM, storage.

Each service is a thin wrapper that hides provider details so node
implementations stay clean and testable.

For MVP, no vector DB / embeddings service — the QA agent uses
a plain-text system prompt instead.
"""

"""Embedding + retrieval service backed by ChromaDB.

Handles chunking, embedding, indexing, and hybrid search.

Usage:
    from backend.services.embeddings import RetrievalService
    svc = RetrievalService(session_id="abc123")
    svc.index_documents(chunks)
    results = svc.search("How does the model handle sensitivity?", top_k=5)
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Any

import chromadb
from openai import OpenAI

from backend.config import settings

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A single indexable unit of text."""
    text: str
    metadata: dict[str, Any]     # source_type, file_id, section, etc.
    chunk_id: str | None = None  # auto-generated if None


@dataclass
class SearchResult:
    """One search hit."""
    text: str
    metadata: dict[str, Any]
    score: float


class RetrievalService:
    """ChromaDB-backed retrieval for a single session."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.collection_name = f"session_{session_id}"

        self._chroma = chromadb.Client()
        self._collection = self._chroma.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self._openai = OpenAI(api_key=settings.OPENAI_API_KEY)

    # ---------- Indexing ----------

    def index_documents(self, chunks: list[Chunk]) -> int:
        """Embed and store a batch of chunks. Returns count indexed."""
        if not chunks:
            return 0

        texts = [c.text for c in chunks]
        ids = [
            c.chunk_id or hashlib.md5(c.text.encode()).hexdigest()
            for c in chunks
        ]
        metadatas = [c.metadata for c in chunks]

        embeddings = self._embed_batch(texts)

        self._collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )
        logger.info("Indexed %d chunks for session %s", len(chunks), self.session_id)
        return len(chunks)

    # ---------- Search ----------

    def search(
        self,
        query: str,
        top_k: int = 5,
        where: dict | None = None,
        where_document: dict | None = None,
    ) -> list[SearchResult]:
        """Hybrid search: vector similarity + optional keyword / metadata filter.

        Args:
            query:          Natural language query.
            top_k:          Number of results to return.
            where:          ChromaDB metadata filter, e.g. {"source_type": "interview"}.
            where_document: ChromaDB document filter for keyword matching.

        Returns:
            List of SearchResult sorted by relevance (best first).
        """
        query_embedding = self._embed_batch([query])[0]

        kwargs: dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": top_k,
        }
        if where:
            kwargs["where"] = where
        if where_document:
            kwargs["where_document"] = where_document

        results = self._collection.query(**kwargs)

        hits: list[SearchResult] = []
        if results["documents"] and results["documents"][0]:
            for text, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                hits.append(SearchResult(
                    text=text,
                    metadata=meta,
                    score=1.0 - dist,   # cosine distance → similarity
                ))
        return hits

    # ---------- Internals ----------

    def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts using OpenAI."""
        response = self._openai.embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=texts,
        )
        return [item.embedding for item in response.data]

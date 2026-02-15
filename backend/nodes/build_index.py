"""Node: build_retrieval_index — Step 6 of the offboarding pipeline.

Chunks all generated artifacts and indexes them into ChromaDB
for the onboarding QA agent.

Owner: [assign team member]
"""

from __future__ import annotations

import logging

from backend.models.artifacts import OnboardingPackage
from backend.models.state import OffboardingState
from backend.services.embeddings import Chunk, RetrievalService
from backend.services.storage import SessionStorage

logger = logging.getLogger(__name__)

# Target chunk size in characters (~500 tokens ≈ 2000 chars)
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200


async def build_retrieval_index(state: OffboardingState) -> dict:
    """Chunk and index all artifacts into ChromaDB.

    Reads from: state["onboarding_package"], state["deep_dive_corpus"],
                state["interview_transcript"], state["extracted_facts"]
    Writes to:  (no state changes — side-effect only: vector index)

    TODO: Implement proper chunking strategy.
          See docs/implementation_design.md §4.8 for details.
    """
    session_id = state["session_id"]
    package: OnboardingPackage | None = state.get("onboarding_package")

    chunks: list[Chunk] = []

    # Chunk onboarding package sections
    if package:
        for section_name in (
            "abstract", "introduction", "details",
        ):
            text = getattr(package, section_name, "")
            if text:
                chunks.extend(
                    _chunk_text(text, {
                        "source_type": "onboarding_doc",
                        "section": section_name,
                    })
                )

        # Chunk FAQ entries
        for i, faq_item in enumerate(package.faq):
            faq_text = f"Q: {faq_item.get('q', '')}\nA: {faq_item.get('a', '')}"
            chunks.append(Chunk(
                text=faq_text,
                metadata={
                    "source_type": "faq",
                    "index": str(i),
                },
            ))

        # Chunk knowledge entries
        for i, entry in enumerate(package.knowledge_entries):
            chunks.append(Chunk(
                text=str(entry),
                metadata={
                    "source_type": "knowledge_entry",
                    "index": str(i),
                },
            ))

    # Chunk extracted facts
    facts = state.get("extracted_facts", [])
    for i, fact in enumerate(facts):
        chunks.append(Chunk(
            text=fact,
            metadata={"source_type": "extracted_fact", "index": str(i)},
        ))

    # Chunk deep dive corpus
    corpus = state.get("deep_dive_corpus", "")
    if corpus:
        chunks.extend(
            _chunk_text(corpus, {"source_type": "deep_dive_corpus"})
        )

    # Index into ChromaDB
    if chunks:
        svc = RetrievalService(session_id)
        count = svc.index_documents(chunks)
        logger.info("Indexed %d chunks for session %s", count, session_id)
    else:
        logger.warning("No chunks to index for session %s", session_id)

    return {
        "status": "complete",
        "current_step": "build_retrieval_index",
    }


def _chunk_text(
    text: str,
    base_metadata: dict,
) -> list[Chunk]:
    """Split text into overlapping chunks."""
    chunks: list[Chunk] = []
    start = 0
    idx = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk_text = text[start:end]
        meta = {**base_metadata, "chunk_index": str(idx)}
        chunks.append(Chunk(text=chunk_text, metadata=meta))
        start += CHUNK_SIZE - CHUNK_OVERLAP
        idx += 1
    return chunks

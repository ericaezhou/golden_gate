"""PDF parser using pymupdf4llm for LLM-optimized content extraction."""

import os
import re
from typing import Optional

import fitz  # pymupdf
import pymupdf4llm

from backend.parsers import register_parser, ParseResult


@register_parser("pdf")
def parse_pdf(path: str) -> ParseResult:
    """
    Parse a PDF file and extract content optimized for LLM consumption.

    Args:
        path: Path to the PDF file

    Returns:
        ParseResult with extracted content, metadata, and references
    """
    # Extract content using pymupdf4llm
    try:
        content = pymupdf4llm.to_markdown(path)
    except Exception as e:
        raise ValueError(f"Failed to extract content from PDF: {e}")

    # Extract metadata and properties using pymupdf (fitz)
    try:
        doc = fitz.open(path)

        # Page count
        page_count = len(doc)

        # PDF metadata
        pdf_metadata = doc.metadata or {}
        title = pdf_metadata.get("title") or None
        author = pdf_metadata.get("author") or None

        # Check for images
        has_images = any(page.get_images() for page in doc)

        doc.close()
    except Exception as e:
        raise ValueError(f"Failed to extract PDF metadata: {e}")

    # Check for tables by looking for pipe characters suggesting markdown tables
    has_tables = "|" in content and any(
        line.count("|") >= 2 for line in content.split("\n")
    )

    # Extract file references using regex
    reference_pattern = re.compile(
        r'\b[\w.-]+\.(xlsx|xls|csv|py|sql|ipynb|pdf|pptx|docx|txt|db)\b',
        re.IGNORECASE,
    )
    seen = set()
    references = []
    for m in reference_pattern.finditer(content):
        ref = m.group(0)
        if ref.lower() not in seen:
            seen.add(ref.lower())
            references.append(ref)

    # Build metadata dict
    metadata = {
        "page_count": page_count,
        "title": title,
        "author": author,
        "has_images": has_images,
        "has_tables": has_tables,
    }

    # Return ParseResult
    return ParseResult(
        file_id=os.path.basename(path),
        file_path=os.path.abspath(path),
        file_type="pdf",
        content=content,
        metadata=metadata,
        references=references,
    )

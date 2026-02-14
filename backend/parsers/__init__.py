"""File parsing system for knowledge extraction.

ParseResult dataclass, parser registry, and dispatch function.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field


@dataclass
class ParseResult:
    file_id: str              # "risk_model.xlsx"
    file_path: str            # absolute path
    file_type: str            # "xlsx"
    metadata: dict = field(default_factory=dict)
    content: str = ""         # markdown-formatted string
    references: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "file_id": self.file_id,
            "file_path": self.file_path,
            "file_type": self.file_type,
            "metadata": self.metadata,
            "content": self.content,
            "references": self.references,
            "warnings": self.warnings,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)


# Registry: extension -> parse function
_PARSER_REGISTRY: dict[str, callable] = {}


def register_parser(*extensions: str):
    """Decorator to register a parser function for file extensions.

    Usage:
        @register_parser("xlsx", "xls")
        def parse_excel(path: str) -> ParseResult:
            ...
    """
    def decorator(func):
        for ext in extensions:
            _PARSER_REGISTRY[ext.lower().lstrip(".")] = func
        return func
    return decorator


def parse_file(path: str) -> ParseResult:
    """Dispatch to the appropriate parser based on file extension."""
    path = os.path.abspath(path)
    filename = os.path.basename(path)
    ext = os.path.splitext(filename)[1].lower().lstrip(".")

    if ext not in _PARSER_REGISTRY:
        return ParseResult(
            file_id=filename,
            file_path=path,
            file_type=ext,
            warnings=[f"No parser registered for .{ext} files"],
        )

    try:
        return _PARSER_REGISTRY[ext](path)
    except Exception as e:
        return ParseResult(
            file_id=filename,
            file_path=path,
            file_type=ext,
            warnings=[f"Parse error: {type(e).__name__}: {e}"],
        )


def get_registered_extensions() -> list[str]:
    """Return list of extensions that have registered parsers."""
    return sorted(_PARSER_REGISTRY.keys())


# Import all parsers to trigger registration.
# Each parser module uses @register_parser at import time.
from backend.parsers import (  # noqa: E402, F401
    text_parser,
    excel_parser,
    docx_parser,
    python_parser,
    sql_parser,
    pdf_parser,
    notebook_parser,
    pptx_parser,
    sqlite_parser,
)

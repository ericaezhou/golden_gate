"""Text file parser for knowledge extraction system."""

import os
import re

from backend.parsers import register_parser, ParseResult

# Regex for detecting file references in text
_FILE_REF_PATTERN = re.compile(
    r'\b[\w.-]+\.(xlsx|xls|csv|py|sql|ipynb|pdf|pptx|docx|txt|db)\b',
    re.IGNORECASE,
)


def _extract_file_references(text: str) -> list[str]:
    """Extract unique filename references from text."""
    seen = set()
    refs = []
    for match in _FILE_REF_PATTERN.finditer(text):
        ref = match.group(0)
        if ref.lower() not in seen:
            seen.add(ref.lower())
            refs.append(ref)
    return refs


@register_parser("txt")
def parse_text(path: str) -> ParseResult:
    """Parse plain text files."""
    path = os.path.abspath(path)
    filename = os.path.basename(path)
    warnings = []

    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
    except UnicodeDecodeError:
        with open(path, "r", encoding="latin-1") as f:
            raw = f.read()
        warnings.append("File read with latin-1 fallback encoding")

    lines = raw.splitlines(keepends=True)
    processed = []
    sections = []
    bullet_count = 0

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.rstrip()

        # Count bullets
        if re.match(r"^\s*[-*•]\s+", line):
            bullet_count += 1

        # Underlined header: next line is all = or all -
        if i + 1 < len(lines):
            next_stripped = lines[i + 1].rstrip()
            if (
                stripped
                and len(stripped) < 80
                and next_stripped
                and len(next_stripped) >= 3
                and (
                    all(c == "=" for c in next_stripped)
                    or all(c == "-" for c in next_stripped)
                )
            ):
                sections.append(stripped)
                processed.append(f"## {stripped}\n")
                i += 2  # skip the underline
                continue

        # ALL CAPS header
        if stripped and len(stripped) < 80:
            alpha = re.sub(r"[^A-Za-z]", "", stripped)
            if len(alpha) >= 3 and alpha.isupper():
                sections.append(stripped)
                processed.append(f"## {stripped}\n")
                i += 1
                continue

        # Colon-ending header (short lines, not URLs)
        if (
            stripped
            and len(stripped) < 80
            and stripped.endswith(":")
            and not re.search(r"https?:", stripped)
        ):
            sections.append(stripped)
            processed.append(f"## {stripped}\n")
            i += 1
            continue

        processed.append(line)
        i += 1

    content = "".join(processed)
    references = _extract_file_references(content)

    return ParseResult(
        file_id=filename,
        file_path=path,
        file_type="txt",
        metadata={
            "line_count": len(lines),
            "detected_sections": sections,
            "bullet_count": bullet_count,
        },
        content=content,
        references=references,
        warnings=warnings,
    )

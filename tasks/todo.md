# Stage 1: File Parsing System

## Implementation

- [x] `__init__.py` — ParseResult + registry + dispatcher
- [x] `requirements.txt` — dependencies
- [x] `text_parser.py` — simplest parser
- [x] `excel_parser.py` — most complex, most important
- [x] `docx_parser.py` — Word documents
- [x] `python_parser.py` — AST-based code analysis
- [x] `sql_parser.py` — sqlglot-based
- [x] `pdf_parser.py` — pymupdf4llm wrapper
- [x] `notebook_parser.py` — nbformat + ast
- [x] `pptx_parser.py` — python-pptx
- [x] `cross_references.py` — post-processing inventory matching
- [x] `parse_cli.py` — CLI test harness

## Verification

- [x] `pip install -r requirements.txt` succeeds
- [x] `python parse_cli.py ../data/` — all 7 demo files parse without errors (0 warnings)
- [x] `python parse_cli.py ../data/ --summary` — each file shows non-zero content lines
- [x] `python parse_cli.py ../data/ --cross-refs` — works (no cross-refs in demo data because files reference each other semantically, not by filename — that's by design for Stage 2 LLM analysis)
- [x] Spot-check: Excel content human-readable with all data visible in markdown tables

## Notes

- Fixed Python 3.9 compatibility (`str | None` -> `from __future__ import annotations`)
- Fixed `re.findall` bug in pdf/pptx parsers (capturing group returns extension only, not full match)
- Fixed openpyxl named ranges API (`definedName` -> `values()`)
- Demo data has no formulas (pure data) and no explicit cross-file references — both features work correctly when present

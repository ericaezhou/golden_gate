# Parsing Stage (Step 1)

The parsing stage is the entry point of the offboarding pipeline. It takes raw uploaded files, dispatches each to a type-specific parser, and produces normalized `StructuredFile` objects that feed into the [deep dive analysis](2_deep_dive_analysis.md).

## Pipeline Position

```
File Upload → Parsing (this doc) → Deep Dives → Gap Finding → Question Generation → Interview
```

## How It Works

1. User uploads files via the `/api/offboarding/start` endpoint
2. Files are saved to `data/sessions/{session_id}/raw_files/`
3. The `parse_files` node iterates over each raw file
4. File extension is matched against the parser registry
5. The matched parser extracts content, metadata, and cross-references
6. Output is saved as `parsed/{file_id}.json` and passed to the next pipeline step

**Source file:** `backend/nodes/parse_files.py`

## Architecture

```
raw_files/
  ├── model.xlsx
  ├── deck.pptx
  └── etl.py
       ↓
parse_files node
       ↓ (dispatches by extension)
  ┌────────────────────────┐
  │    Parser Registry     │
  │  .xlsx → excel_parser  │
  │  .pptx → pptx_parser   │
  │  .py   → python_parser │
  │  ...                   │
  └────────────────────────┘
       ↓
parsed/
  ├── model_xlsx_a1b2c3.json   (StructuredFile)
  ├── deck_pptx_d4e5f6.json    (StructuredFile)
  └── etl_py_g7h8i9.json       (StructuredFile)
```

## Parser Registry

Parsers self-register at import time using the `@register_parser` decorator. The dispatch function `parse_file()` looks up the file extension and calls the matching parser.

**Source file:** `backend/parsers/__init__.py`

```python
@register_parser("xlsx", "xls")
def parse_excel(path: str) -> ParseResult:
    ...
```

If no parser is registered for an extension, a `ParseResult` with a warning is returned. The pipeline continues — the file just won't have useful parsed content.

## Supported Parsers

### Excel (`.xlsx`, `.xls`)

**Source:** `backend/parsers/excel_parser.py`

Extracts:
- **Named ranges** — workbook-level named ranges with their cell references
- **Per-sheet data** — cell values rendered as markdown tables (capped at 100 rows per sheet)
- **Formulas** — preserved as-is (e.g. `=SUM(B2:B10)`) rather than computed values
- **Comments** — cell comments with their coordinates (e.g. `C5: "Adjusted quarterly"`)
- **Hidden sheets** — parsed and explicitly marked as `(hidden)`
- **External references** — filenames extracted from formula references like `[other_model.xlsx]Sheet1!A1`

**Metadata:** sheet names, dimensions, row counts, formula cell count, comments per sheet, hidden sheet list

**Library:** `openpyxl` (loaded with `data_only=False` to capture formulas)

### PowerPoint (`.pptx`)

**Source:** `backend/parsers/pptx_parser.py`

Extracts:
- **Slide text** — all text frames, grouped by slide with title detection
- **Speaker notes** — rendered as blockquotes below each slide
- **Tables** — converted to markdown table format
- **Group shapes** — recursively processed for nested text
- **File references** — filenames mentioned in slide text or notes (regex scan)

**Metadata:** slide count, per-slide title, whether notes exist, shape count

**Library:** `python-pptx`

### Python (`.py`)

**Source:** `backend/parsers/python_parser.py`

Extracts:
- **Imports** — all `import` and `from ... import` statements
- **Functions** — name, arguments, line number, docstring presence
- **Classes** — name and line number
- **Constants** — top-level `UPPER_CASE` assignments
- **TODOs** — `TODO`, `FIXME`, `HACK`, `XXX` comments
- **File references** — paths from `open()`, `Path()`, and `pd.read_*()` calls
- **Full source code** — included in a fenced code block

**Fallback:** If AST parsing fails (syntax errors), falls back to regex-based extraction with a warning.

**Metadata:** imports, functions list, classes list, constants, TODOs

**Library:** Python `ast` (standard library)

### Jupyter Notebook (`.ipynb`)

**Source:** `backend/parsers/notebook_parser.py`

Extracts:
- **Code cells** — rendered in fenced Python code blocks
- **Markdown cells** — rendered as-is
- **Cell outputs** — stream output and `text/plain` results as blockquotes; images and HTML noted as `[omitted]`
- **Error tracebacks** — included as blockquoted output
- **Imports and functions** — AST-extracted from code cells (same logic as Python parser)
- **File references** — from both code cells (AST) and markdown cells (regex)

**Metadata:** kernel name, total/code/markdown cell counts, imports, functions, file references

**Library:** `nbformat`

### SQL (`.sql`)

**Source:** `backend/parsers/sql_parser.py`

Extracts:
- **Statement types** — SELECT, INSERT, UPDATE, CREATE, DELETE, DROP
- **Tables read** — from FROM and JOIN clauses
- **Tables written** — from INSERT, UPDATE, CREATE, DROP targets
- **Joins** — type, target table, and ON condition
- **Columns** — all column references
- **Full SQL content** — in a fenced code block

**Fallback:** If `sqlglot` parsing fails, falls back to regex-based table/operation extraction with a warning.

**Metadata:** per-statement breakdown (type, tables read/written, joins, columns), aggregated table and column lists

**Library:** `sqlglot` (Postgres dialect default)

### PDF (`.pdf`)

**Source:** `backend/parsers/pdf_parser.py`

Extracts:
- **Full text content** — converted to markdown optimized for LLM consumption
- **Tables** — detected by pipe-character patterns in the markdown output
- **File references** — filenames found in the text (regex scan)

**Metadata:** page count, title, author, has images, has tables

**Library:** `pymupdf4llm` (built on `pymupdf`/`fitz`)

### Word Document (`.docx`)

**Source:** `backend/parsers/docx_parser.py`

Extracts:
- **Paragraphs** — with heading styles mapped to markdown (`Heading 1` → `#`, etc.)
- **Bold text** — preserved as `**bold**`
- **Tables** — converted to markdown table format
- **Document structure** — elements processed in body order (paragraphs and tables interleaved correctly)
- **File references** — filenames found in the text (regex scan)

**Metadata:** paragraph count, table count, heading list

**Library:** `python-docx`

### SQLite Database (`.db`)

**Source:** `backend/parsers/sqlite_parser.py`

Extracts:
- **Table inventory** — all table names
- **Schema per table** — column name, type, not-null constraint, primary key flag
- **Row counts** — per table
- **Sample data** — first 5 rows per table, rendered as markdown tables

**Metadata:** per-table column definitions, row counts, table count

**Library:** `sqlite3` (standard library, opened read-only)

### Plain Text (`.txt`)

**Source:** `backend/parsers/text_parser.py`

Extracts:
- **Full text** — with light structure detection
- **Section headers** — detected via underlined text (`===`/`---`), ALL CAPS lines, and colon-ending lines
- **Bullet counts** — lines starting with `-`, `*`, or `•`
- **File references** — filenames found in the text (regex scan)

**Fallback encoding:** If UTF-8 fails, retries with `latin-1`.

**Metadata:** line count, detected sections, bullet count

### Unsupported Extensions

Files with unregistered extensions (e.g. `.md`, `.csv`, `.json`) are not parsed. A `ParseResult` with a warning `"No parser registered for .{ext} files"` is returned. The file still enters the pipeline as a `StructuredFile` with empty content, so it doesn't block downstream processing.

## Data Models

### ParseResult (internal)

Returned by each parser. Defined in `backend/parsers/__init__.py`.

```python
@dataclass
class ParseResult:
    file_id: str              # Original filename
    file_path: str            # Absolute path
    file_type: str            # Extension (xlsx, py, sql, etc.)
    metadata: dict            # Type-specific metadata
    content: str              # Markdown-formatted content string
    references: list[str]     # Cross-references to other files, modules, or tables
    warnings: list[str]       # Non-fatal issues during parsing
```

### StructuredFile (pipeline output)

What gets passed to the deep dive stage. Defined in `backend/models/artifacts.py`.

```python
class StructuredFile(BaseModel):
    file_id: str              # Deterministic slug (e.g. "model_xlsx_a1b2c3")
    file_name: str            # Original filename
    file_type: str            # Extension
    parsed_content: dict      # {"content": "...", "references": [...]}
    metadata: dict            # Type-specific metadata from parser
    raw_path: str             # Path to the original uploaded file
```

The `file_id` is generated deterministically from the filename: lowercased, spaces replaced with underscores, truncated to 30 chars, and suffixed with a 6-char MD5 hash. This ensures uniqueness while staying readable.

**Source:** `_make_file_id()` in `backend/nodes/parse_files.py:80-85`

## Error Handling

Parsing errors are **non-fatal**. If a parser throws an exception:

1. The error is logged
2. A partial `StructuredFile` is created with `parsed_content={"error": "..."}`
3. The file is still included in the pipeline
4. The error message is appended to `state["errors"]`

This ensures one bad file doesn't block the entire session.

## Cross-Reference Extraction

Every parser attempts to extract references to other files. This is used downstream for cross-file gap analysis. The approach varies by parser:

| Parser | Reference Extraction Method |
|--------|----------------------------|
| Excel | Regex on formulas for `[filename.xlsx]` patterns |
| PowerPoint | Regex scan of all slide text and notes |
| Python | AST: `open()`, `Path()`, `pd.read_*()` call arguments; import module names |
| Notebook | Same as Python (AST) + regex on markdown cells |
| SQL | All table names from parsed statements |
| PDF, DOCX, Text | Regex scan for common file extensions |
| SQLite | None (self-contained) |

The common regex pattern used across most parsers:
```
\b[\w.-]+\.(xlsx|xls|csv|py|sql|ipynb|pdf|pptx|docx|txt|db)\b
```

## Storage

```
data/sessions/{session_id}/
├── raw_files/
│   ├── model.xlsx              # Original uploaded file
│   └── etl.py
└── parsed/
    ├── model_xlsx_a1b2c3.json  # StructuredFile JSON
    └── etl_py_d4e5f6.json
```

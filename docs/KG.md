# Knowledge Graph

Builds an **onboarding knowledge graph (KG)** from parsed project files and an interview summary, then optionally stores it as JSON or in Neo4j.

## Main entry point: `build_kg`

```python
from data_delivery.run import build_kg

# interview_summary: text from an onboarding interview
# parsed_directory: directory of JSON files (see format below)
kg_json = build_kg(interview_summary, parsed_directory="output/parsed")
# Writes result to public/kg.json and returns the KG dict
```

**Parameters**

| Parameter | Description |
|-----------|-------------|
| `interview_summary` | String: transcript or summary of the onboarding interview. |
| `parsed_directory` | Path to a directory of parsed files (default `"output/parsed"`). Each file must be a JSON with `file_path` and `content`. |

**Returns**  
The KG as a Python dict (nodes + edges with evidence). The same structure is also written to `public/kg.json`.

### Parsed file format

Each `.json` in `parsed_directory` should look like:

```json
{
  "file_path": "path/to/source/file.md",
  "content": "string content of the file",
  ...
}
```

The pipeline concatenates these into a single project context string with `<<<FILE path='...'>>>` … `<<</FILE>>>` blocks before sending to the KG extractor.

---

## Pipeline overview

1. **`run.build_kg`** — Reads all `.json` in `parsed_directory`, builds project context, then calls `build_and_store_kg`.
2. **`run.build_and_store_kg`** — Calls the LLM via `kg.extract_kg_with_evidence(project_context, interview_summary)` and writes the result to `public/kg.json`.
3. **`kg.extract_kg_with_evidence`** — Uses the OpenAI client and a structured schema to produce a KG (nodes and edges with evidence) for MODEL / EVAL / OPS subgraphs.s

---

## Module summary

| Module | Role |
|--------|------|
| `run.py` | Entry points: `build_kg`, `build_and_store_kg`, `show_kg`; helpers to build project context and interview transcript. |
| `kg.py` | KG schema and `extract_kg_with_evidence()` (LLM call to build nodes/edges with evidence). |


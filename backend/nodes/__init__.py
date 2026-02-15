"""Pipeline node implementations.

Each node is a standalone async function that takes the graph state
and returns a partial state update.  Nodes communicate ONLY through
the state dict — never through side channels.

Ownership guide (assign one person per node):
  - parse_files.py          → file parsing
  - deep_dive.py            → per-file LLM analysis
  - concatenate.py          → merge deep dives
  - global_summarize.py     → cross-file reasoning
  - reconcile_questions.py  → question dedup & prioritization
  - interview.py            → interactive interview loop
  - generate_package.py     → onboarding doc generation
  - build_index.py          → ChromaDB indexing
"""

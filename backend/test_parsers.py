#!/usr/bin/env python3
"""Test all parsers against the actual data files in data/.

Usage:
    python backend/test_parsers.py              # Full output
    python backend/test_parsers.py --brief      # Summary table only
"""

import json
import os
import sys
import argparse
import sqlite3
import traceback

# Project root
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from backend.parsers import parse_file, get_registered_extensions, ParseResult
from backend.parsers.cross_references import build_cross_reference_map

DATA_DIR = os.path.join(ROOT, "data")

# ANSI colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def separator(title: str = "", char: str = "=", width: int = 80) -> str:
    if title:
        pad = (width - len(title) - 2) // 2
        return f"\n{char * pad} {BOLD}{title}{RESET} {char * pad}"
    return char * width


def print_parse_result(result: ParseResult, brief: bool = False) -> None:
    """Print a single parse result with formatting."""
    content_lines = result.content.count("\n") + 1 if result.content else 0
    content_len = len(result.content) if result.content else 0
    has_warnings = bool(result.warnings)

    status = f"{GREEN}OK{RESET}" if not has_warnings else f"{YELLOW}WARN{RESET}"

    print(f"\n  {BOLD}{result.file_id}{RESET}")
    print(f"  Type: {result.file_type}  |  Content: {content_lines} lines ({content_len} chars)  |  "
          f"Refs: {len(result.references)}  |  Status: {status}")

    if brief:
        if has_warnings:
            for w in result.warnings:
                print(f"    {YELLOW}! {w}{RESET}")
        return

    # Metadata
    if result.metadata:
        print(f"\n  {CYAN}Metadata:{RESET}")
        for key, value in result.metadata.items():
            if isinstance(value, list) and len(value) > 5:
                print(f"    {key}: [{len(value)} items] {value[:3]}...")
            elif isinstance(value, list) and len(value) > 0:
                print(f"    {key}: {value}")
            elif isinstance(value, dict):
                print(f"    {key}: {value}")
            elif value is not None and value != [] and value != {}:
                print(f"    {key}: {value}")

    # References
    if result.references:
        print(f"\n  {CYAN}References ({len(result.references)}):{RESET}")
        for ref in result.references:
            print(f"    -> {ref}")

    # Warnings
    if result.warnings:
        print(f"\n  {YELLOW}Warnings ({len(result.warnings)}):{RESET}")
        for w in result.warnings:
            print(f"    ! {w}")

    # Content preview (first 30 lines)
    if result.content:
        preview_lines = result.content.split("\n")[:30]
        print(f"\n  {CYAN}Content preview (first 30 lines):{RESET}")
        print(f"  {DIM}{'~' * 70}{RESET}")
        for line in preview_lines:
            truncated = line[:100] + "..." if len(line) > 100 else line
            print(f"  {DIM}|{RESET} {truncated}")
        if content_lines > 30:
            print(f"  {DIM}| ... ({content_lines - 30} more lines){RESET}")
        print(f"  {DIM}{'~' * 70}{RESET}")


def check_sqlite_db(db_path: str) -> None:
    """Inspect the SQLite database since there's no .db parser."""
    print(f"\n  {BOLD}{os.path.basename(db_path)}{RESET}")
    print(f"  Type: db (SQLite)  |  {YELLOW}No parser registered — inspecting directly{RESET}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Get tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\n  {CYAN}Tables ({len(tables)}):{RESET}")

        for table in tables:
            # Get row count
            cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
            row_count = cursor.fetchone()[0]

            # Get columns
            cursor.execute(f'PRAGMA table_info("{table}")')
            columns = cursor.fetchall()
            col_names = [col[1] for col in columns]
            col_types = [col[2] for col in columns]

            print(f"\n    {BOLD}{table}{RESET} ({row_count} rows)")
            print(f"    Columns: {', '.join(f'{n} ({t})' for n, t in zip(col_names, col_types))}")

            # Show sample data (first 3 rows)
            cursor.execute(f'SELECT * FROM "{table}" LIMIT 3')
            sample = cursor.fetchall()
            if sample:
                print(f"    Sample rows:")
                for row in sample:
                    print(f"      {row}")

        conn.close()
    except Exception as e:
        print(f"  {RED}Error inspecting database: {e}{RESET}")


def write_output(results: list, xref_map, output_dir: str) -> None:
    """Write each ParseResult as JSON + markdown content to output_dir."""
    os.makedirs(output_dir, exist_ok=True)

    # Per-file outputs
    for r in results:
        stem = os.path.splitext(r.file_id)[0]

        json_path = os.path.join(output_dir, f"{stem}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(r.to_json(indent=2))

    # Cross-reference summary
    if xref_map:
        xref_path = os.path.join(output_dir, "_cross_references.json")
        xref_data = {
            "resolved": [
                {"source": x.source_file, "target": x.target, "target_file": x.target_file, "type": x.ref_type}
                for x in xref_map.resolved
            ],
            "unresolved": [
                {"source": x.source_file, "target": x.target, "type": x.ref_type}
                for x in xref_map.unresolved
            ],
        }
        with open(xref_path, "w", encoding="utf-8") as f:
            json.dump(xref_data, f, indent=2, default=str)

    print(f"\n  {GREEN}Wrote {len(results)} results to {output_dir}/{RESET}")


def main():
    parser = argparse.ArgumentParser(description="Test parsers against data/ files")
    parser.add_argument("--brief", action="store_true", help="Summary table only, no content preview")
    parser.add_argument("-o", "--output-dir", default=os.path.join(ROOT, "output", "parsed"),
                        help="Directory to write parse results (default: output/parsed/)")
    args = parser.parse_args()

    print(separator("Golden Gate Parser Test", "="))
    print(f"\nData directory: {DATA_DIR}")
    print(f"Registered extensions: {', '.join(get_registered_extensions())}")

    # Collect all files
    all_files = sorted(os.listdir(DATA_DIR))
    print(f"Files in data/: {len(all_files)}")
    for f in all_files:
        size = os.path.getsize(os.path.join(DATA_DIR, f))
        print(f"  {f} ({size:,} bytes)")

    # Parse each file
    results: list[ParseResult] = []
    errors = 0
    db_files = []

    print(separator("Individual Parse Results", "-"))

    for filename in all_files:
        filepath = os.path.join(DATA_DIR, filename)
        ext = os.path.splitext(filename)[1].lower().lstrip(".")

        try:
            result = parse_file(filepath)
            results.append(result)
            if result.warnings:
                errors += 1
            print_parse_result(result, brief=args.brief)
        except Exception as e:
            errors += 1
            print(f"\n  {RED}{BOLD}CRASH: {filename}{RESET}")
            print(f"  {RED}{traceback.format_exc()}{RESET}")

    # Handle SQLite databases
    if db_files:
        print(separator("SQLite Databases", "-"))
        for db_path in db_files:
            check_sqlite_db(db_path)

    # Cross-reference resolution
    print(separator("Cross-Reference Resolution", "-"))
    if results:
        xref_map = build_cross_reference_map(results)
        print(f"\n{xref_map.summary()}")
    else:
        print("\n  No results to cross-reference.")

    # Write results to output directory
    write_output(results, xref_map if results else None, args.output_dir)

    # Summary table
    print(separator("Summary", "="))
    print(f"\n  {'File':<45} {'Type':<6} {'Lines':>7} {'Chars':>8} {'Refs':>5} {'Status'}")
    print(f"  {'-'*45} {'-'*6} {'-'*7} {'-'*8} {'-'*5} {'-'*10}")

    for r in results:
        content_lines = r.content.count("\n") + 1 if r.content else 0
        content_len = len(r.content) if r.content else 0
        status = f"{GREEN}OK{RESET}" if not r.warnings else f"{YELLOW}WARN({len(r.warnings)}){RESET}"
        print(f"  {r.file_id:<45} {r.file_type:<6} {content_lines:>7} {content_len:>8} "
              f"{len(r.references):>5} {status}")

    for db_path in db_files:
        print(f"  {os.path.basename(db_path):<45} {'db':<6} {'—':>7} {'—':>8} {'—':>5} {YELLOW}NO PARSER{RESET}")

    total = len(results) + len(db_files)
    parsed = len(results)
    ok = parsed - errors
    print(f"\n  {BOLD}Total: {total} files | Parsed: {parsed} | OK: {ok} | Warnings: {errors} | "
          f"No parser: {len(db_files)}{RESET}\n")


if __name__ == "__main__":
    main()

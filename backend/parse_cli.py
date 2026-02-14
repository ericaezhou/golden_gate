#!/usr/bin/env python3
"""CLI test harness for the file parsing system.

Usage:
    python parse_cli.py <path_or_dir>               # Parse file(s), print JSON
    python parse_cli.py <path_or_dir> --summary      # One-line summary per file
    python parse_cli.py <path_or_dir> --cross-refs   # Show cross-reference map
"""

import argparse
import json
import os
import sys

# Add project root to path so `backend.parsers` is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.parsers import parse_file, get_registered_extensions, ParseResult
from backend.parsers.cross_references import build_cross_reference_map


def collect_files(path: str) -> list[str]:
    """Collect parseable files from a path (file or directory)."""
    extensions = set(get_registered_extensions())
    files = []

    if os.path.isfile(path):
        files.append(os.path.abspath(path))
    elif os.path.isdir(path):
        for entry in sorted(os.listdir(path)):
            full = os.path.join(path, entry)
            if os.path.isfile(full):
                ext = os.path.splitext(entry)[1].lower().lstrip(".")
                if ext in extensions:
                    files.append(os.path.abspath(full))
    else:
        print(f"Error: {path} is not a file or directory", file=sys.stderr)
        sys.exit(1)

    return files


def print_summary(result: ParseResult) -> None:
    """Print a one-line summary of a parse result."""
    content_lines = result.content.count("\n") + 1 if result.content else 0
    ref_count = len(result.references)
    warn_count = len(result.warnings)
    status = "OK" if not result.warnings else f"WARN({warn_count})"

    print(f"  {result.file_id:<40} {result.file_type:<6} "
          f"{content_lines:>5} lines  {ref_count:>3} refs  [{status}]")


def main():
    parser = argparse.ArgumentParser(description="Parse files for knowledge extraction")
    parser.add_argument("path", help="File or directory to parse")
    parser.add_argument("--summary", action="store_true", help="Print one-line summary per file")
    parser.add_argument("--cross-refs", action="store_true", help="Show cross-reference map")
    parser.add_argument("--json", action="store_true", help="Output full JSON (default for single files)")
    args = parser.parse_args()

    files = collect_files(args.path)
    if not files:
        print(f"No parseable files found in {args.path}")
        print(f"Registered extensions: {', '.join(get_registered_extensions())}")
        sys.exit(1)

    print(f"Parsing {len(files)} file(s)...\n")

    results: list[ParseResult] = []
    errors = 0

    for filepath in files:
        result = parse_file(filepath)
        results.append(result)

        if result.warnings:
            errors += 1
            for w in result.warnings:
                print(f"  WARNING [{result.file_id}]: {w}", file=sys.stderr)

    # Output mode
    if args.summary or (len(files) > 1 and not args.json):
        print("File Summary:")
        print(f"  {'File':<40} {'Type':<6} {'Content':>12} {'Refs':>7}  Status")
        print(f"  {'-'*40} {'-'*6} {'-'*12} {'-'*7}  {'-'*10}")
        for r in results:
            print_summary(r)
        print(f"\n  Total: {len(results)} files, {errors} with warnings")
    elif args.json or len(files) == 1:
        if len(results) == 1:
            print(results[0].to_json())
        else:
            output = [r.to_dict() for r in results]
            print(json.dumps(output, indent=2, default=str))

    # Cross-references
    if args.cross_refs:
        print("\n" + "=" * 60)
        print("Cross-Reference Map")
        print("=" * 60)
        xref_map = build_cross_reference_map(results)
        print(xref_map.summary())


if __name__ == "__main__":
    main()

"""Python source code parser using AST.

Extracts imports, functions, classes, constants, TODOs, and file references.
"""

from __future__ import annotations

import ast
import os
import re
from typing import Any, Optional

from backend.parsers import ParseResult, register_parser


@register_parser("py")
def parse_python(path: str) -> ParseResult:
    """Parse a Python file and extract metadata, content, and references.

    Args:
        path: Absolute path to the Python file

    Returns:
        ParseResult with metadata, markdown content, and references
    """
    file_path = os.path.abspath(path)
    file_id = os.path.basename(file_path)

    # Read source code
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
    except Exception as e:
        return ParseResult(
            file_id=file_id,
            file_path=file_path,
            file_type="py",
            metadata={
                "error": f"Failed to read file: {str(e)}",
                "imports": [],
                "functions": [],
                "classes": [],
                "constants": [],
                "todos": []
            },
            content=f"# Error Reading File\n\n{str(e)}",
            references=[]
        )

    # Try AST parsing
    try:
        tree = ast.parse(source, filename=file_id)
        metadata = _extract_metadata_ast(source, tree)
        references = _extract_references_ast(tree)
        content = _generate_content(metadata, source)

        return ParseResult(
            file_id=file_id,
            file_path=file_path,
            file_type="py",
            metadata=metadata,
            content=content,
            references=references
        )
    except SyntaxError as e:
        # Fallback to regex-based extraction
        metadata = _extract_metadata_regex(source)
        metadata["warning"] = f"Syntax error at line {e.lineno}: {e.msg}"
        references = _extract_references_regex(source)
        content = _generate_content(metadata, source)

        return ParseResult(
            file_id=file_id,
            file_path=file_path,
            file_type="py",
            metadata=metadata,
            content=content,
            references=references
        )


def _extract_metadata_ast(source: str, tree: ast.AST) -> dict[str, Any]:
    """Extract metadata using AST parsing."""
    metadata = {
        "imports": [],
        "functions": [],
        "classes": [],
        "constants": [],
        "todos": []
    }

    # Extract TODOs from comments
    metadata["todos"] = _extract_todos(source)

    # Walk the AST
    for node in ast.walk(tree):
        # Imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                metadata["imports"].append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                if module:
                    metadata["imports"].append(f"from {module} import {alias.name}")
                else:
                    metadata["imports"].append(f"from . import {alias.name}")

        # Functions (only top-level and class methods)
        elif isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            args = [arg.arg for arg in node.args.args]
            has_docstring = (
                len(node.body) > 0 and
                isinstance(node.body[0], ast.Expr) and
                isinstance(node.body[0].value, ast.Constant) and
                isinstance(node.body[0].value.value, str)
            )
            metadata["functions"].append({
                "name": node.name,
                "args": args,
                "has_docstring": has_docstring,
                "lineno": node.lineno
            })

        # Classes
        elif isinstance(node, ast.ClassDef):
            metadata["classes"].append({
                "name": node.name,
                "lineno": node.lineno
            })

    # Constants (top-level UPPER_CASE assignments)
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    name = target.id
                    if name.isupper() and not name.startswith('_'):
                        metadata["constants"].append(name)
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                name = node.target.id
                if name.isupper() and not name.startswith('_'):
                    metadata["constants"].append(name)

    return metadata


def _extract_metadata_regex(source: str) -> dict[str, Any]:
    """Fallback regex-based metadata extraction for files with syntax errors."""
    metadata = {
        "imports": [],
        "functions": [],
        "classes": [],
        "constants": [],
        "todos": []
    }

    # Extract TODOs
    metadata["todos"] = _extract_todos(source)

    # Extract imports
    import_pattern = re.compile(r'^(?:from\s+[\w.]+\s+)?import\s+[\w\s,.*]+', re.MULTILINE)
    for match in import_pattern.finditer(source):
        metadata["imports"].append(match.group(0).strip())

    # Extract function definitions
    func_pattern = re.compile(r'^(?:async\s+)?def\s+(\w+)\s*\((.*?)\):', re.MULTILINE)
    for match in func_pattern.finditer(source):
        name = match.group(1)
        args_str = match.group(2)
        args = [arg.split(':')[0].strip() for arg in args_str.split(',') if arg.strip()]
        lineno = source[:match.start()].count('\n') + 1
        metadata["functions"].append({
            "name": name,
            "args": args,
            "has_docstring": False,  # Can't reliably detect with regex
            "lineno": lineno
        })

    # Extract class definitions
    class_pattern = re.compile(r'^class\s+(\w+)', re.MULTILINE)
    for match in class_pattern.finditer(source):
        name = match.group(1)
        lineno = source[:match.start()].count('\n') + 1
        metadata["classes"].append({
            "name": name,
            "lineno": lineno
        })

    # Extract constants (UPPER_CASE = value)
    const_pattern = re.compile(r'^([A-Z][A-Z0-9_]*)\s*[=:]', re.MULTILINE)
    for match in const_pattern.finditer(source):
        metadata["constants"].append(match.group(1))

    return metadata


def _extract_todos(source: str) -> list[str]:
    """Extract TODO/FIXME/HACK/XXX comments from source."""
    todos = []
    todo_pattern = re.compile(r'#\s*(TODO|FIXME|HACK|XXX)[:\s]*(.*)', re.IGNORECASE)
    for match in todo_pattern.finditer(source):
        todos.append(match.group(0).strip())
    return todos


def _extract_references_ast(tree: ast.AST) -> list[str]:
    """Extract module and file path references from AST."""
    references = []

    # Module names from imports
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                # Get top-level module (e.g., "pandas" from "pandas.core")
                top_module = alias.name.split('.')[0]
                if top_module not in references:
                    references.append(top_module)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                # Get top-level module
                top_module = node.module.split('.')[0]
                if top_module not in references:
                    references.append(top_module)

    # File paths from function calls
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            file_path = _extract_file_path_from_call(node)
            if file_path and file_path not in references:
                references.append(file_path)

    return references


def _extract_file_path_from_call(node: ast.Call) -> str | None:
    """Extract file path from function calls like open(), Path(), pd.read_*()."""
    # Check for open() or Path()
    if isinstance(node.func, ast.Name):
        if node.func.id in ('open', 'Path') and len(node.args) > 0:
            if isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                return node.args[0].value

    # Check for pd.read_csv(), pd.read_excel(), etc.
    elif isinstance(node.func, ast.Attribute):
        if node.func.attr in ('read_csv', 'read_excel', 'read_json', 'read_parquet',
                               'read_feather', 'read_hdf', 'read_pickle', 'read_table',
                               'read_fwf'):
            if len(node.args) > 0:
                if isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                    return node.args[0].value

    return None


def _extract_references_regex(source: str) -> list[str]:
    """Fallback regex-based reference extraction."""
    references = []

    # Extract imports
    import_pattern = re.compile(r'^(?:from\s+([\w.]+)\s+)?import\s+([\w\s,.*]+)', re.MULTILINE)
    for match in import_pattern.finditer(source):
        if match.group(1):  # from X import Y
            module = match.group(1).split('.')[0]
            if module and module not in references:
                references.append(module)
        else:  # import X
            imports = match.group(2).split(',')
            for imp in imports:
                module = imp.strip().split('.')[0].split(' as ')[0].strip()
                if module and module not in references:
                    references.append(module)

    # Extract file paths from open(), Path(), pd.read_*()
    file_pattern = re.compile(r'(?:open|Path|\.read_[a-z]+)\s*\(\s*["\']([^"\']+)["\']')
    for match in file_pattern.finditer(source):
        path = match.group(1)
        if path and path not in references:
            references.append(path)

    return references


def _generate_content(metadata: dict[str, Any], source: str) -> str:
    """Generate markdown content with summary and source code."""
    lines = ["# Python Source Analysis\n"]

    # Warning if syntax error
    if "warning" in metadata:
        lines.append(f"**Warning:** {metadata['warning']}\n")

    # Summary section
    lines.append("## Summary\n")

    # Imports
    if metadata["imports"]:
        lines.append("### Imports")
        for imp in metadata["imports"]:
            lines.append(f"- `{imp}`")
        lines.append("")

    # Functions
    if metadata["functions"]:
        lines.append("### Functions")
        for func in metadata["functions"]:
            args_str = ", ".join(func["args"])
            docstring_marker = " \u2713" if func["has_docstring"] else ""
            lines.append(f"- `{func['name']}({args_str})` (line {func['lineno']}){docstring_marker}")
        lines.append("")

    # Classes
    if metadata["classes"]:
        lines.append("### Classes")
        for cls in metadata["classes"]:
            lines.append(f"- `{cls['name']}` (line {cls['lineno']})")
        lines.append("")

    # Constants
    if metadata["constants"]:
        lines.append("### Constants")
        for const in metadata["constants"]:
            lines.append(f"- `{const}`")
        lines.append("")

    # TODOs
    if metadata["todos"]:
        lines.append("### TODOs")
        for todo in metadata["todos"]:
            lines.append(f"- {todo}")
        lines.append("")

    # Full source code
    lines.append("## Source Code\n")
    lines.append("```python")
    lines.append(source)
    lines.append("```")

    return "\n".join(lines)

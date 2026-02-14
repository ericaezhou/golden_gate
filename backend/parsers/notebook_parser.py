"""Jupyter Notebook parser using nbformat + ast.

Extracts imports, functions, and file references from code cells.
Renders cells in markdown format with outputs.
"""

from __future__ import annotations

import ast
import os
import re
from typing import Any, Optional

try:
    import nbformat
except ImportError:
    nbformat = None

from backend.parsers import ParseResult, register_parser


@register_parser("ipynb")
def parse_notebook(path: str) -> ParseResult:
    """Parse a Jupyter notebook and extract metadata, content, and references.

    Args:
        path: Absolute path to the notebook file

    Returns:
        ParseResult with metadata, markdown content, and references
    """
    file_path = os.path.abspath(path)
    file_id = os.path.basename(file_path)

    # Check if nbformat is available
    if nbformat is None:
        return ParseResult(
            file_id=file_id,
            file_path=file_path,
            file_type="ipynb",
            metadata={
                "error": "nbformat library not installed",
                "kernel": None,
                "cell_count": 0,
                "code_cells": 0,
                "markdown_cells": 0,
                "imports": [],
                "functions": [],
                "file_references": []
            },
            content="# Error\n\nnbformat library is required to parse Jupyter notebooks.",
            references=[],
            warnings=["nbformat library not installed"]
        )

    # Read and parse notebook
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            nb = nbformat.read(f, as_version=4)
    except Exception as e:
        return ParseResult(
            file_id=file_id,
            file_path=file_path,
            file_type="ipynb",
            metadata={
                "error": f"Failed to read notebook: {str(e)}",
                "kernel": None,
                "cell_count": 0,
                "code_cells": 0,
                "markdown_cells": 0,
                "imports": [],
                "functions": [],
                "file_references": []
            },
            content=f"# Error Reading Notebook\n\n{str(e)}",
            references=[],
            warnings=[f"Failed to read notebook: {str(e)}"]
        )

    # Extract metadata
    metadata = _extract_notebook_metadata(nb)

    # Generate markdown content
    content = _generate_notebook_content(nb)

    # Extract references
    references = _extract_notebook_references(nb, metadata)

    return ParseResult(
        file_id=file_id,
        file_path=file_path,
        file_type="ipynb",
        metadata=metadata,
        content=content,
        references=references
    )


def _extract_notebook_metadata(nb) -> dict[str, Any]:
    """Extract metadata from notebook."""
    metadata = {
        "kernel": None,
        "cell_count": 0,
        "code_cells": 0,
        "markdown_cells": 0,
        "imports": [],
        "functions": [],
        "file_references": []
    }

    # Get kernel name
    if hasattr(nb, 'metadata') and 'kernelspec' in nb.metadata:
        metadata["kernel"] = nb.metadata['kernelspec'].get('name', None)

    # Count cells
    cells = nb.get('cells', [])
    metadata["cell_count"] = len(cells)

    code_cells = [cell for cell in cells if cell.cell_type == 'code']
    markdown_cells = [cell for cell in cells if cell.cell_type == 'markdown']

    metadata["code_cells"] = len(code_cells)
    metadata["markdown_cells"] = len(markdown_cells)

    # Extract imports and functions from code cells (Python only)
    kernel_name = metadata["kernel"] or ""
    is_python = "python" in kernel_name.lower() if kernel_name else True  # Assume Python if unknown

    if is_python:
        for cell in code_cells:
            source = cell.get('source', '')
            if isinstance(source, list):
                source = ''.join(source)

            if not source.strip():
                continue

            # Try to parse with AST
            try:
                tree = ast.parse(source)
                cell_imports = _extract_imports_ast(tree)
                cell_functions = _extract_functions_ast(tree)
                cell_file_refs = _extract_file_references_ast(tree)

                # Add to metadata lists (avoiding duplicates)
                for imp in cell_imports:
                    if imp not in metadata["imports"]:
                        metadata["imports"].append(imp)

                for func in cell_functions:
                    if func not in metadata["functions"]:
                        metadata["functions"].append(func)

                for ref in cell_file_refs:
                    if ref not in metadata["file_references"]:
                        metadata["file_references"].append(ref)

            except SyntaxError:
                # Skip cells with syntax errors
                continue

    # Scan markdown cells for file references
    _FILE_REF_PATTERN = re.compile(
        r'\b[\w.-]+\.(xlsx|xls|csv|py|sql|ipynb|pdf|pptx|docx|txt|db)\b',
        re.IGNORECASE,
    )
    for cell in markdown_cells:
        source = cell.get('source', '')
        if isinstance(source, list):
            source = ''.join(source)
        for m in _FILE_REF_PATTERN.finditer(source):
            ref = m.group(0)
            if ref not in metadata["file_references"]:
                metadata["file_references"].append(ref)

    return metadata


def _extract_imports_ast(tree: ast.AST) -> list[str]:
    """Extract import statements from AST."""
    imports = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                if module:
                    imports.append(f"from {module} import {alias.name}")
                else:
                    imports.append(f"from . import {alias.name}")

    return imports


def _extract_functions_ast(tree: ast.AST) -> list[str]:
    """Extract function names from AST."""
    functions = []

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            functions.append(node.name)

    return functions


def _extract_file_references_ast(tree: ast.AST) -> list[str]:
    """Extract file path references from AST."""
    file_refs = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            file_path = _extract_file_path_from_call(node)
            if file_path:
                file_refs.append(file_path)

    return file_refs


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


def _generate_notebook_content(nb) -> str:
    """Generate markdown content from notebook cells."""
    lines = ["# Jupyter Notebook\n"]

    cells = nb.get('cells', [])

    if not cells:
        lines.append("(Empty notebook)")
        return "\n".join(lines)

    for idx, cell in enumerate(cells, start=1):
        cell_type = cell.cell_type
        source = cell.get('source', '')

        # Convert source to string if it's a list
        if isinstance(source, list):
            source = ''.join(source)

        # Cell header
        lines.append(f"### Cell {idx} ({cell_type})\n")

        # Render cell based on type
        if cell_type == 'code':
            # Render code in fenced block
            lines.append("```python")
            lines.append(source.rstrip())
            lines.append("```\n")

            # Render outputs
            outputs = cell.get('outputs', [])
            if outputs:
                for output in outputs:
                    output_content = _render_output(output)
                    if output_content:
                        lines.append(output_content)
                        lines.append("")

        elif cell_type == 'markdown':
            # Render markdown directly
            lines.append(source.rstrip())
            lines.append("")

        else:
            # Other cell types (raw, etc.)
            lines.append(f"```{cell_type}")
            lines.append(source.rstrip())
            lines.append("```\n")

    return "\n".join(lines)


def _render_output(output) -> str:
    """Render a cell output as markdown."""
    output_type = output.get('output_type', '')

    if output_type == 'stream':
        # stdout/stderr text
        text = output.get('text', '')
        if isinstance(text, list):
            text = ''.join(text)
        if text.strip():
            # Render as blockquote
            lines = text.rstrip().split('\n')
            return '\n'.join(f"> {line}" for line in lines)

    elif output_type == 'execute_result' or output_type == 'display_data':
        # Check for text/plain first
        data = output.get('data', {})

        if 'text/plain' in data:
            text = data['text/plain']
            if isinstance(text, list):
                text = ''.join(text)
            if text.strip():
                lines = text.rstrip().split('\n')
                return '\n'.join(f"> {line}" for line in lines)

        # Check for image data
        if any(k.startswith('image/') for k in data.keys()):
            return "> [Image output omitted]"

        # Check for HTML
        if 'text/html' in data:
            return "> [HTML output omitted]"

    elif output_type == 'error':
        # Render error traceback
        traceback = output.get('traceback', [])
        if traceback:
            if isinstance(traceback, list):
                traceback_text = '\n'.join(traceback)
            else:
                traceback_text = str(traceback)
            lines = traceback_text.rstrip().split('\n')
            return '\n'.join(f"> {line}" for line in lines)

    return ""


def _extract_notebook_references(nb, metadata: dict) -> list[str]:
    """Extract references from notebook (imports and file paths)."""
    references = []

    # Add top-level module names from imports
    for imp in metadata["imports"]:
        # Extract module name from import statement
        if imp.startswith("from "):
            # "from module import x" -> "module"
            parts = imp.split()
            if len(parts) >= 2:
                module = parts[1].split('.')[0]
                if module not in references:
                    references.append(module)
        else:
            # "module.submodule" -> "module"
            module = imp.split('.')[0]
            if module not in references:
                references.append(module)

    # Add file references
    for file_ref in metadata["file_references"]:
        if file_ref not in references:
            references.append(file_ref)

    return references

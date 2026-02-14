"""SQL parser using sqlglot library.

Extracts tables, columns, joins, and SQL operations from SQL files.
Falls back to regex-based extraction if sqlglot parsing fails.
"""

import os
import re
from typing import List, Dict, Set, Any
import sqlglot
from sqlglot import exp

from backend.parsers import register_parser, ParseResult


@register_parser("sql")
def parse_sql(path: str) -> ParseResult:
    """Parse SQL file and extract metadata, content, and references.

    Args:
        path: Absolute path to the SQL file

    Returns:
        ParseResult with metadata, content markdown, and table references
    """
    # Read the SQL file
    with open(path, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    file_id = os.path.basename(path)
    file_path = os.path.abspath(path)

    # Try to parse with sqlglot
    try:
        statements_metadata, all_tables, all_columns = _parse_with_sqlglot(sql_content)
        content = _generate_content(sql_content, statements_metadata, all_tables, all_columns, parse_failed=False)
    except Exception as e:
        # Fall back to regex-based extraction
        print(f"Warning: sqlglot parsing failed for {path}: {e}. Falling back to regex extraction.")
        statements_metadata, all_tables, all_columns = _parse_with_regex(sql_content)
        content = _generate_content(sql_content, statements_metadata, all_tables, all_columns, parse_failed=True)

    # Build metadata
    metadata = {
        "statements": statements_metadata,
        "all_tables": sorted(list(all_tables)),
        "all_columns": sorted(list(all_columns))
    }

    # References are all table names (primary cross-ref targets for SQL)
    references = sorted(list(all_tables))

    return ParseResult(
        file_id=file_id,
        file_path=file_path,
        file_type="sql",
        metadata=metadata,
        content=content,
        references=references
    )


def _parse_with_sqlglot(sql_content: str) -> tuple[List[Dict[str, Any]], Set[str], Set[str]]:
    """Parse SQL using sqlglot library.

    Returns:
        Tuple of (statements_metadata, all_tables, all_columns)
    """
    statements_metadata = []
    all_tables = set()
    all_columns = set()

    # Split by semicolons to handle multi-statement files
    # Use sqlglot's parse which handles multiple statements
    statements = sqlglot.parse(sql_content, read='postgres')  # Use postgres as default dialect

    for statement in statements:
        if statement is None:
            continue

        stmt_metadata = _analyze_statement(statement)
        statements_metadata.append(stmt_metadata)

        # Collect all tables and columns
        all_tables.update(stmt_metadata.get("tables_read", []))
        all_tables.update(stmt_metadata.get("tables_written", []))
        all_columns.update(stmt_metadata.get("columns", []))

    return statements_metadata, all_tables, all_columns


def _analyze_statement(statement: exp.Expression) -> Dict[str, Any]:
    """Analyze a single SQL statement and extract metadata.

    Args:
        statement: Parsed sqlglot expression

    Returns:
        Dictionary with statement metadata
    """
    stmt_type = statement.__class__.__name__.replace("Expression", "").upper()

    tables_read = []
    tables_written = []
    joins = []
    columns = []

    # Collect CTE aliases so we can exclude them from real tables
    cte_aliases = set()
    for cte in statement.find_all(exp.CTE):
        if cte.alias:
            cte_aliases.add(cte.alias)

    # Extract tables being read (FROM, JOIN clauses)
    for table in statement.find_all(exp.Table):
        table_name = table.name
        if table_name and table_name not in cte_aliases:
            # Check if this table is in a FROM or JOIN context
            parent = table.parent
            if isinstance(parent, (exp.From, exp.Join)):
                tables_read.append(table_name)

    # Extract tables being written (INSERT, UPDATE, CREATE, etc.)
    if isinstance(statement, exp.Insert):
        if statement.this:
            table_name = statement.this.name if hasattr(statement.this, 'name') else str(statement.this)
            tables_written.append(table_name)
    elif isinstance(statement, exp.Update):
        if statement.this:
            table_name = statement.this.name if hasattr(statement.this, 'name') else str(statement.this)
            tables_written.append(table_name)
    elif isinstance(statement, exp.Create):
        if statement.this:
            table_name = statement.this.name if hasattr(statement.this, 'name') else str(statement.this)
            tables_written.append(table_name)
    elif isinstance(statement, exp.Drop):
        if statement.this:
            table_name = statement.this.name if hasattr(statement.this, 'name') else str(statement.this)
            tables_written.append(table_name)

    # Extract JOIN information
    for join in statement.find_all(exp.Join):
        join_type = join.side if join.side else "INNER"
        join_table = None
        join_condition = None

        if join.this and isinstance(join.this, exp.Table):
            join_table = join.this.name

        if join.args.get("on"):
            join_condition = str(join.args["on"])

        if join_table:
            join_desc = f"{join_type} JOIN {join_table}"
            if join_condition:
                join_desc += f" ON {join_condition}"
            joins.append(join_desc)

    # Extract column names
    for column in statement.find_all(exp.Column):
        col_name = column.name
        if col_name and col_name != "*":
            columns.append(col_name)

    # Remove duplicates while preserving order
    tables_read = list(dict.fromkeys(tables_read))
    tables_written = list(dict.fromkeys(tables_written))
    joins = list(dict.fromkeys(joins))
    columns = list(dict.fromkeys(columns))

    return {
        "type": stmt_type,
        "tables_read": tables_read,
        "tables_written": tables_written,
        "joins": joins,
        "columns": columns
    }


def _parse_with_regex(sql_content: str) -> tuple[List[Dict[str, Any]], Set[str], Set[str]]:
    """Fallback: Parse SQL using regex patterns.

    Returns:
        Tuple of (statements_metadata, all_tables, all_columns)
    """
    all_tables = set()

    # Extract table names using regex patterns
    patterns = [
        r'\bFROM\s+`?(\w+)`?',
        r'\bJOIN\s+`?(\w+)`?',
        r'\bINTO\s+`?(\w+)`?',
        r'\bUPDATE\s+`?(\w+)`?',
        r'\bTABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?`?(\w+)`?',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, sql_content, re.IGNORECASE)
        all_tables.update(matches)

    # Basic statement detection
    statements_metadata = []

    # Try to identify statement types
    sql_upper = sql_content.upper()
    if 'SELECT' in sql_upper:
        statements_metadata.append({
            "type": "SELECT",
            "tables_read": list(all_tables),
            "tables_written": [],
            "joins": []
        })
    elif 'INSERT' in sql_upper:
        statements_metadata.append({
            "type": "INSERT",
            "tables_read": [],
            "tables_written": list(all_tables),
            "joins": []
        })
    elif 'UPDATE' in sql_upper:
        statements_metadata.append({
            "type": "UPDATE",
            "tables_read": list(all_tables),
            "tables_written": list(all_tables),
            "joins": []
        })
    elif 'CREATE' in sql_upper:
        statements_metadata.append({
            "type": "CREATE",
            "tables_read": [],
            "tables_written": list(all_tables),
            "joins": []
        })
    elif 'DELETE' in sql_upper:
        statements_metadata.append({
            "type": "DELETE",
            "tables_read": list(all_tables),
            "tables_written": list(all_tables),
            "joins": []
        })
    else:
        statements_metadata.append({
            "type": "UNKNOWN",
            "tables_read": list(all_tables),
            "tables_written": [],
            "joins": []
        })

    # No column extraction in regex fallback
    all_columns = set()

    return statements_metadata, all_tables, all_columns


def _generate_content(
    sql_content: str,
    statements_metadata: List[Dict[str, Any]],
    all_tables: Set[str],
    all_columns: Set[str],
    parse_failed: bool
) -> str:
    """Generate markdown content for the SQL file.

    Args:
        sql_content: Raw SQL content
        statements_metadata: List of statement metadata dicts
        all_tables: Set of all table names
        all_columns: Set of all column names
        parse_failed: Whether sqlglot parsing failed

    Returns:
        Markdown formatted content string
    """
    content_parts = []

    # Add warning if parsing failed
    if parse_failed:
        content_parts.append("**Warning:** SQL parsing failed. Using regex-based extraction.\n")

    # Summary section
    content_parts.append("## SQL Summary\n")

    # Tables
    if all_tables:
        content_parts.append(f"**Tables ({len(all_tables)}):** {', '.join(sorted(all_tables))}\n")
    else:
        content_parts.append("**Tables:** None found\n")

    # Columns (only if we have them)
    if all_columns:
        content_parts.append(f"**Columns ({len(all_columns)}):** {', '.join(sorted(all_columns))}\n")

    # Operations/Statements
    if statements_metadata:
        operations = [stmt.get("type", "UNKNOWN") for stmt in statements_metadata]
        operation_counts = {}
        for op in operations:
            operation_counts[op] = operation_counts.get(op, 0) + 1

        op_summary = ", ".join(f"{count} {op}" for op, count in sorted(operation_counts.items()))
        content_parts.append(f"**Operations ({len(statements_metadata)}):** {op_summary}\n")

    # Joins (if any)
    all_joins = []
    for stmt in statements_metadata:
        all_joins.extend(stmt.get("joins", []))

    if all_joins:
        content_parts.append(f"\n**Joins ({len(all_joins)}):**\n")
        for join in all_joins:
            content_parts.append(f"- {join}\n")

    # Full SQL content
    content_parts.append("\n## SQL Content\n")
    content_parts.append("```sql\n")
    content_parts.append(sql_content)
    if not sql_content.endswith('\n'):
        content_parts.append('\n')
    content_parts.append("```\n")

    return "".join(content_parts)

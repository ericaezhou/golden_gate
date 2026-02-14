"""SQLite database parser.

Extracts table names, schemas, row counts, and sample data from .db files.
"""

import os
import sqlite3

from backend.parsers import ParseResult, register_parser


@register_parser("db")
def parse_sqlite(path: str) -> ParseResult:
    """Parse a SQLite database and extract table metadata.

    Args:
        path: Path to the .db file

    Returns:
        ParseResult with table inventory, schemas, and sample data
    """
    file_path = os.path.abspath(path)
    file_id = os.path.basename(file_path)

    # Open in read-only mode
    uri = f"file:{file_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    cursor = conn.cursor()

    try:
        # Get all table names
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        table_names = [row[0] for row in cursor.fetchall()]

        tables_metadata = []
        content_parts = [f"# SQLite Database: {file_id}\n"]
        content_parts.append(f"**Tables:** {len(table_names)}\n")

        for table in table_names:
            # Row count
            cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
            row_count = cursor.fetchone()[0]

            # Schema via PRAGMA
            cursor.execute(f'PRAGMA table_info("{table}")')
            columns_info = cursor.fetchall()
            columns = [
                {"name": col[1], "type": col[2], "notnull": bool(col[3]), "pk": bool(col[5])}
                for col in columns_info
            ]
            col_names = [col[1] for col in columns_info]

            # Sample data (first 5 rows)
            cursor.execute(f'SELECT * FROM "{table}" LIMIT 5')
            sample_rows = cursor.fetchall()

            tables_metadata.append({
                "name": table,
                "row_count": row_count,
                "columns": columns,
            })

            # Build content section for this table
            content_parts.append(f"## {table} ({row_count} rows)\n")

            # Schema as markdown table
            content_parts.append("| Column | Type | PK |")
            content_parts.append("| --- | --- | --- |")
            for col in columns:
                pk_mark = "Y" if col["pk"] else ""
                content_parts.append(f"| {col['name']} | {col['type']} | {pk_mark} |")
            content_parts.append("")

            # Sample data as markdown table
            if sample_rows:
                content_parts.append(f"**Sample ({len(sample_rows)} rows):**\n")
                content_parts.append("| " + " | ".join(col_names) + " |")
                content_parts.append("| " + " | ".join(["---"] * len(col_names)) + " |")
                for row in sample_rows:
                    cells = [str(v) if v is not None else "NULL" for v in row]
                    content_parts.append("| " + " | ".join(cells) + " |")
                content_parts.append("")

        content = "\n".join(content_parts)

        metadata = {
            "tables": tables_metadata,
            "all_tables": table_names,
            "table_count": len(table_names),
        }

        return ParseResult(
            file_id=file_id,
            file_path=file_path,
            file_type="db",
            metadata=metadata,
            content=content,
            references=[],
        )

    finally:
        conn.close()

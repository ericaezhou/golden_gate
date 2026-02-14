"""Post-processing cross-reference resolution.

Builds an inventory from all ParseResults and matches each file's
references against it. Returns resolved + unresolved references.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from backend.parsers import ParseResult


@dataclass
class CrossReference:
    source_file: str    # file_id of the file containing the reference
    target: str         # the raw reference string
    target_file: str    # file_id it resolved to (or "" if unresolved)
    ref_type: str       # "filename" | "sheet" | "table" | "module"


@dataclass
class CrossReferenceMap:
    resolved: list[CrossReference] = field(default_factory=list)
    unresolved: list[CrossReference] = field(default_factory=list)

    def summary(self) -> str:
        lines = []
        if self.resolved:
            lines.append(f"Resolved ({len(self.resolved)}):")
            for ref in self.resolved:
                lines.append(f"  {ref.source_file} -> {ref.target_file}  ({ref.ref_type}: {ref.target})")
        if self.unresolved:
            lines.append(f"Unresolved ({len(self.unresolved)}):")
            for ref in self.unresolved:
                lines.append(f"  {ref.source_file} -> ???  ({ref.ref_type}: {ref.target})")
        if not lines:
            lines.append("No cross-references found.")
        return "\n".join(lines)


def build_cross_reference_map(results: list[ParseResult]) -> CrossReferenceMap:
    """Match all detected references against an inventory built from parse results.

    Inventory sources:
    - All filenames (with and without extension)
    - Excel sheet names
    - SQL table names
    - Python module names (from imports)
    """
    # Build inventory: lookup_key -> (file_id, ref_type)
    inventory: dict[str, tuple[str, str]] = {}

    for r in results:
        # Filename with extension
        fid = r.file_id
        inventory[fid.lower()] = (fid, "filename")

        # Filename without extension
        stem = os.path.splitext(fid)[0]
        if stem.lower() not in inventory:
            inventory[stem.lower()] = (fid, "filename")

        # Excel sheet names
        if r.file_type in ("xlsx", "xls"):
            for sheet in r.metadata.get("sheets", []):
                name = sheet.get("name", "")
                if name:
                    inventory[name.lower()] = (fid, "sheet")

        # SQL table names
        if r.file_type in ("sql", "db"):
            for table in r.metadata.get("all_tables", []):
                if table:
                    inventory[table.lower()] = (fid, "table")

        # Python module names
        if r.file_type == "py":
            module_name = os.path.splitext(fid)[0]
            if module_name.lower() not in inventory:
                inventory[module_name.lower()] = (fid, "module")

    # Resolve references
    xref_map = CrossReferenceMap()

    for r in results:
        for ref in r.references:
            resolved = _resolve_reference(ref, r.file_id, inventory)
            if resolved:
                xref_map.resolved.append(resolved)
            else:
                xref_map.unresolved.append(
                    CrossReference(
                        source_file=r.file_id,
                        target=ref,
                        target_file="",
                        ref_type="unknown",
                    )
                )

    return xref_map


def _resolve_reference(
    ref: str, source_file: str, inventory: dict[str, tuple[str, str]]
) -> CrossReference | None:
    """Try to resolve a reference against the inventory.

    Exact match first, then substring match.
    Skip self-references.
    """
    ref_lower = ref.lower()

    # Exact match
    if ref_lower in inventory:
        target_file, ref_type = inventory[ref_lower]
        if target_file != source_file:
            return CrossReference(
                source_file=source_file,
                target=ref,
                target_file=target_file,
                ref_type=ref_type,
            )
        return None  # self-reference, skip

    # Substring match: check if ref is contained in any inventory key or vice versa
    for key, (target_file, ref_type) in inventory.items():
        if target_file == source_file:
            continue
        if ref_lower in key or key in ref_lower:
            return CrossReference(
                source_file=source_file,
                target=ref,
                target_file=target_file,
                ref_type=ref_type,
            )

    return None

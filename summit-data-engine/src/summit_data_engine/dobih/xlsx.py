"""Small dependency-free XLSX writer for immutable review exports."""

# OOXML relationship and content-type identifiers are intentionally not wrapped.
# ruff: noqa: E501

from __future__ import annotations

import math
import zipfile
from collections.abc import Iterable, Mapping, Sequence
from contextlib import suppress
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.sax.saxutils import escape

_CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""

_ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""

_WORKBOOK = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Wales summits" sheetId="1" r:id="rId1"/>
<sheet name="Summary" sheetId="2" r:id="rId2"/>
</sheets>
</workbook>
"""

_WORKBOOK_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""

_STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Aptos"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F6B52"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>
"""


def _column_letter(index: int) -> str:
    value = index
    letters = ""
    while value:
        value, remainder = divmod(value - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


def _inline_cell(reference: str, value: object, style: int = 0) -> str:
    if value is None or value == "":
        return f'<c r="{reference}" s="{style}"/>'
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if isinstance(value, float) and not math.isfinite(value):
            return f'<c r="{reference}" s="{style}"/>'
        return f'<c r="{reference}" s="{style}"><v>{value}</v></c>'
    text = str(value)
    escaped = escape(text)
    preserve = ' xml:space="preserve"' if text != text.strip() else ""
    return (
        f'<c r="{reference}" s="{style}" t="inlineStr">'
        f"<is><t{preserve}>{escaped}</t></is></c>"
    )


def _write_data_sheet(
    path: Path,
    headers: Sequence[str],
    rows: Sequence[Mapping[str, object]],
    numeric_columns: set[str],
) -> None:
    widths = [min(60.0, max(10.0, float(len(header) + 2))) for header in headers]
    for row in rows:
        for index, header in enumerate(headers):
            widths[index] = min(60.0, max(widths[index], float(len(str(row.get(header, ""))) + 2)))

    last_column = _column_letter(len(headers))
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
        handle.write(
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        )
        handle.write(f'<dimension ref="A1:{last_column}{len(rows) + 1}"/>')
        handle.write(
            '<sheetViews><sheetView workbookViewId="0">'
            '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
            "</sheetView></sheetViews>"
        )
        handle.write("<cols>")
        for index, width in enumerate(widths, start=1):
            handle.write(
                f'<col min="{index}" max="{index}" width="{width:.1f}" customWidth="1"/>'
            )
        handle.write("</cols><sheetData>")
        handle.write('<row r="1" ht="32" customHeight="1">')
        for index, header in enumerate(headers, start=1):
            handle.write(_inline_cell(f"{_column_letter(index)}1", header, 1))
        handle.write("</row>")
        for row_number, row in enumerate(rows, start=2):
            handle.write(f'<row r="{row_number}">')
            is_warning = row.get("qa_status") == "warning"
            for index, header in enumerate(headers, start=1):
                value = row.get(header, "")
                if header in numeric_columns and value not in {"", None}:
                    with suppress(ValueError):
                        value = float(str(value))
                style = 2 if is_warning and header in {"qa_status", "qa_flags"} else 3
                handle.write(
                    _inline_cell(f"{_column_letter(index)}{row_number}", value, style)
                )
            handle.write("</row>")
        handle.write("</sheetData>")
        handle.write(f'<autoFilter ref="A1:{last_column}{len(rows) + 1}"/>')
        handle.write("</worksheet>")


def _summary_items(summary: Mapping[str, object]) -> Iterable[tuple[str, object]]:
    for key, value in summary.items():
        if isinstance(value, Mapping):
            for nested_key, nested_value in value.items():
                yield f"{key}.{nested_key}", nested_value
        else:
            yield key, value


def _write_summary_sheet(path: Path, summary: Mapping[str, object]) -> None:
    items = list(_summary_items(summary))
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
        handle.write(
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetViews><sheetView workbookViewId="0">'
            '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
            '</sheetView></sheetViews>'
            '<cols><col min="1" max="1" width="42" customWidth="1"/>'
            '<col min="2" max="2" width="80" customWidth="1"/></cols><sheetData>'
            '<row r="1">'
        )
        handle.write(_inline_cell("A1", "Metric", 1))
        handle.write(_inline_cell("B1", "Value", 1))
        handle.write("</row>")
        for row_number, (key, value) in enumerate(items, start=2):
            handle.write(f'<row r="{row_number}">')
            handle.write(_inline_cell(f"A{row_number}", key, 3))
            rendered = value if not isinstance(value, (list, dict)) else str(value)
            handle.write(_inline_cell(f"B{row_number}", rendered, 3))
            handle.write("</row>")
        handle.write("</sheetData><autoFilter ref=\"A1:B")
        handle.write(str(len(items) + 1))
        handle.write('"/></worksheet>')


def write_review_workbook(
    destination: Path,
    headers: Sequence[str],
    rows: Sequence[Mapping[str, object]],
    summary: Mapping[str, object],
    numeric_columns: set[str],
    created_at_utc: str,
) -> None:
    """Write a two-sheet XLSX workbook without changing source values."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as temporary_directory:
        temporary = Path(temporary_directory)
        data_sheet = temporary / "sheet1.xml"
        summary_sheet = temporary / "sheet2.xml"
        _write_data_sheet(data_sheet, headers, rows, numeric_columns)
        _write_summary_sheet(summary_sheet, summary)
        core = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Wales DoBIH review dataset</dc:title>
<dc:creator>Summit Data Engine</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">{escape(created_at_utc)}</dcterms:created>
</cp:coreProperties>
"""
        app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Summit Data Engine</Application>
</Properties>
"""
        temporary_zip = destination.with_suffix(destination.suffix + ".part")
        with zipfile.ZipFile(
            temporary_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6
        ) as archive:
            archive.writestr("[Content_Types].xml", _CONTENT_TYPES)
            archive.writestr("_rels/.rels", _ROOT_RELS)
            archive.writestr("xl/workbook.xml", _WORKBOOK)
            archive.writestr("xl/_rels/workbook.xml.rels", _WORKBOOK_RELS)
            archive.writestr("xl/styles.xml", _STYLES)
            archive.write(data_sheet, "xl/worksheets/sheet1.xml")
            archive.write(summary_sheet, "xl/worksheets/sheet2.xml")
            archive.writestr("docProps/core.xml", core)
            archive.writestr("docProps/app.xml", app)
        temporary_zip.replace(destination)
"""Data exporters using pandas for various file formats."""

from __future__ import annotations

import asyncio
import bz2
import gzip
import importlib
import json
import xml.etree.ElementTree as StdET
import zipfile
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol, cast

import pandas as pd
from defusedxml import minidom as defused_minidom

from .core import (
    BaseExporter,
    CompressionType,
    DataBatch,
    DataFormat,
    ExportError,
    ExportOptions,
    FormatError,
    ProgressCallback,
    ProgressInfo,
    TransferConfig,
    TransferStatus,
)


class _YamlProtocol(Protocol):
    """Minimal subset of yaml API used in this module."""

    def safe_dump(
        self, data: object, stream: object | None = None, **kwargs: object
    ) -> str:  # pragma: no cover
        ...


if TYPE_CHECKING:
    yaml: _YamlProtocol | None
else:
    try:
        yaml = cast(_YamlProtocol, importlib.import_module("yaml"))
    except ImportError:  # pragma: no cover - optional dependency
        yaml = None


class CSVExporter(BaseExporter):
    """CSV file exporter using pandas."""

    async def export_to_file(
        self,
        data: AsyncGenerator[DataBatch],
        file_path: Path,
    ) -> ProgressInfo:
        """Export data to CSV file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            # Collect data
            all_records = []
            async for batch in data:
                for record in batch.records:
                    all_records.append(record.data)
                self.update_progress(processed=len(batch.records))
                await asyncio.sleep(0)

            # Convert to DataFrame and export
            if all_records:
                df = pd.DataFrame(all_records)
                # Map quoting integer to valid pandas CSV quoting values
                # Pandas expects literal values 0, 1, 2, or 3
                if self.options.quoting == 0:
                    quoting_value = 0  # QUOTE_MINIMAL
                elif self.options.quoting == 1:
                    quoting_value = 1  # QUOTE_ALL
                elif self.options.quoting == 2:
                    quoting_value = 2  # QUOTE_NONNUMERIC
                elif self.options.quoting == 3:
                    quoting_value = 3  # QUOTE_NONE
                else:
                    quoting_value = 0  # Default to QUOTE_MINIMAL

                df.to_csv(
                    file_path,
                    sep=self.options.delimiter,
                    index=False,
                    header=self.options.include_headers,
                    encoding=self.options.encoding,
                    quoting=quoting_value,
                )

            self._progress.status = TransferStatus.COMPLETED
            return self._progress
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ExportError(f"Failed to export CSV: {e}") from e


class JSONExporter(BaseExporter):
    """JSON file exporter using pandas."""

    async def export_to_file(
        self,
        data: AsyncGenerator[DataBatch],
        file_path: Path,
    ) -> ProgressInfo:
        """Export data to JSON file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            if self.options.json_lines:
                # Export as JSON Lines
                with open(file_path, "w", encoding=self.options.encoding) as f:
                    async for batch in data:
                        for record in batch.records:
                            json_line = json.dumps(
                                record.data,
                                ensure_ascii=self.options.json_ensure_ascii,
                                sort_keys=self.options.json_sort_keys,
                            )
                            f.write(json_line + "\n")
                        self.update_progress(processed=len(batch.records))
                        await asyncio.sleep(0)
            else:
                # Export as regular JSON
                all_records = []
                async for batch in data:
                    for record in batch.records:
                        all_records.append(record.data)
                    self.update_progress(processed=len(batch.records))
                    await asyncio.sleep(0)

                if all_records:
                    df = pd.DataFrame(all_records)
                    df.to_json(
                        file_path,
                        orient="records",
                        indent=self.options.json_indent,
                        force_ascii=self.options.json_ensure_ascii,
                    )

            self._progress.status = TransferStatus.COMPLETED
            return self._progress
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ExportError(f"Failed to export JSON: {e}") from e


class ExcelExporter(BaseExporter):
    """Excel file exporter using pandas."""

    async def export_to_file(
        self,
        data: AsyncGenerator[DataBatch],
        file_path: Path,
    ) -> ProgressInfo:
        """Export data to Excel file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            # Collect all data
            all_records = []
            async for batch in data:
                for record in batch.records:
                    all_records.append(record.data)
                self.update_progress(processed=len(batch.records))
                await asyncio.sleep(0)

            # Convert to DataFrame and export
            if all_records:
                df = pd.DataFrame(all_records)

                with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
                    df.to_excel(
                        writer,
                        sheet_name=self.options.sheet_name,
                        index=False,
                        freeze_panes=(1, 0) if self.options.freeze_panes else None,
                    )

                    # Add auto-filter if requested
                    if self.options.auto_filter and all_records:
                        worksheet = writer.sheets[self.options.sheet_name]
                        worksheet.auto_filter.ref = worksheet.dimensions

            self._progress.status = TransferStatus.COMPLETED
            return self._progress
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ExportError(f"Failed to export Excel: {e}") from e


class XMLExporter(BaseExporter):
    """XML file exporter."""

    async def export_to_file(
        self,
        data: AsyncGenerator[DataBatch],
        file_path: Path,
    ) -> ProgressInfo:
        """Export data to XML file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            # Create root element
            root = StdET.Element(self.options.xml_root_element)

            # Add records
            async for batch in data:
                for record in batch.records:
                    record_elem = StdET.SubElement(root, self.options.xml_record_element)
                    self._dict_to_xml(record.data, record_elem)
                self.update_progress(processed=len(batch.records))
                await asyncio.sleep(0)

            # Write to file
            if self.options.xml_pretty_print:
                xml_str = defused_minidom.parseString(StdET.tostring(root)).toprettyxml(indent="  ")
                with open(file_path, "w", encoding=self.options.encoding) as f:
                    f.write(xml_str)
            else:
                tree = StdET.ElementTree(root)
                tree.write(file_path, encoding=self.options.encoding, xml_declaration=True)

            self._progress.status = TransferStatus.COMPLETED
            return self._progress
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ExportError(f"Failed to export XML: {e}") from e

    def _dict_to_xml(self, data: dict[str, Any], parent: StdET.Element) -> None:
        """Convert dictionary to XML elements."""
        for key, value in data.items():
            if isinstance(value, dict):
                child = StdET.SubElement(parent, str(key))
                self._dict_to_xml(value, child)
            elif isinstance(value, list):
                for item in value:
                    child = StdET.SubElement(parent, str(key))
                    if isinstance(item, dict):
                        self._dict_to_xml(item, child)
                    else:
                        child.text = str(item)
            else:
                child = StdET.SubElement(parent, str(key))
                child.text = str(value) if value is not None else ""


class YAMLExporter(BaseExporter):
    """YAML file exporter."""

    async def export_to_file(
        self,
        data: AsyncGenerator[DataBatch],
        file_path: Path,
    ) -> ProgressInfo:
        """Export data to YAML file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            # Collect all data
            all_records = []
            async for batch in data:
                for record in batch.records:
                    all_records.append(record.data)
                self.update_progress(processed=len(batch.records))
                await asyncio.sleep(0)

            # Export to YAML
            if yaml is None:
                raise ExportError("PyYAML is required for YAML exports")

            with open(file_path, "w", encoding=self.options.encoding) as f:
                yaml.safe_dump(
                    all_records,
                    f,
                    default_flow_style=False,
                    sort_keys=self.options.json_sort_keys,
                    allow_unicode=True,
                )

            self._progress.status = TransferStatus.COMPLETED
            return self._progress
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ExportError(f"Failed to export YAML: {e}") from e


def create_exporter(
    format: DataFormat,
    config: TransferConfig,
    options: ExportOptions | None = None,
    progress_callback: ProgressCallback | None = None,
) -> BaseExporter:
    """Create an exporter for the specified format."""
    resolved_options = options or ExportOptions()

    exporters: dict[DataFormat, type[BaseExporter]] = {
        DataFormat.CSV: CSVExporter,
        DataFormat.JSON: JSONExporter,
        DataFormat.JSONL: JSONExporter,
        DataFormat.EXCEL: ExcelExporter,
        DataFormat.XML: XMLExporter,
        DataFormat.YAML: YAMLExporter,
    }

    if format == DataFormat.JSONL:
        resolved_options.json_lines = True

    exporter_class = exporters.get(format)
    if exporter_class is None:
        raise FormatError(f"No exporter available for format: {format}")

    return exporter_class(config, resolved_options, progress_callback)


async def export_data(
    data: AsyncGenerator[DataBatch],
    file_path: str,
    format: DataFormat | None = None,
    config: TransferConfig | None = None,
    options: ExportOptions | None = None,
    progress_callback: ProgressCallback | None = None,
) -> ProgressInfo:
    """Export data to a file."""
    path = Path(file_path)

    if format is None:
        format = detect_format(path)

    # Provide default config if None
    if config is None:
        from .core import TransferConfig

        config = TransferConfig()
    exporter = create_exporter(format, config, options, progress_callback)

    return await exporter.export_to_file(data, path)


def detect_format(file_path: Path) -> DataFormat:
    """Detect file format from extension."""
    extension_map = {
        ".csv": DataFormat.CSV,
        ".json": DataFormat.JSON,
        ".jsonl": DataFormat.JSONL,
        ".xlsx": DataFormat.EXCEL,
        ".xls": DataFormat.EXCEL,
        ".xml": DataFormat.XML,
        ".yaml": DataFormat.YAML,
        ".yml": DataFormat.YAML,
    }

    ext = file_path.suffix.lower()
    if ext in extension_map:
        return extension_map[ext]

    raise FormatError(f"Unsupported file format: {ext}")


def compress_file(
    file_path: Path,
    compression: CompressionType,
    delete_original: bool = False,
) -> Path:
    """Compress a file using the specified compression type."""
    if compression == CompressionType.NONE:
        return file_path

    compressed_path = None

    try:
        if compression == CompressionType.GZIP:
            compressed_path = file_path.with_suffix(file_path.suffix + ".gz")
            with open(file_path, "rb") as f_in:
                with gzip.open(compressed_path, "wb") as f_out:
                    f_out.writelines(f_in)

        elif compression == CompressionType.ZIP:
            compressed_path = file_path.with_suffix(".zip")
            with zipfile.ZipFile(compressed_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(file_path, file_path.name)

        elif compression == CompressionType.BZIP2:
            compressed_path = file_path.with_suffix(file_path.suffix + ".bz2")
            with open(file_path, "rb") as f_in:
                with bz2.open(compressed_path, "wb") as f_out:
                    f_out.writelines(f_in)

        else:
            raise ExportError(f"Unsupported compression type: {compression}")

        if delete_original and compressed_path:
            file_path.unlink()

        return compressed_path

    except Exception as e:
        if compressed_path and compressed_path.exists():
            compressed_path.unlink()
        raise ExportError(f"Failed to compress file: {e}") from e

"""Data importers using pandas for various file formats."""

from __future__ import annotations

import asyncio
import importlib
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol, cast

import pandas as pd
from defusedxml import ElementTree as ET

from .core import (
    BaseImporter,
    DataBatch,
    DataFormat,
    DataRecord,
    FormatError,
    ImportError,
    ImportOptions,
    ProgressCallback,
    TransferConfig,
    TransferStatus,
)


class _YamlProtocol(Protocol):
    """Minimal subset of yaml API used in this module."""

    def safe_load(self, stream: Any) -> Any:  # pragma: no cover - protocol definition
        ...


if TYPE_CHECKING:
    yaml: _YamlProtocol | None
else:
    try:
        yaml = cast(_YamlProtocol, importlib.import_module("yaml"))
    except ImportError:  # pragma: no cover - optional dependency
        yaml = None


class CSVImporter(BaseImporter):
    """CSV file importer using pandas."""

    async def import_from_file(self, file_path: Path) -> AsyncGenerator[DataBatch]:
        """Import CSV file in chunks."""
        try:
            self._progress.status = TransferStatus.RUNNING

            # Get total rows for progress tracking
            try:
                total_rows = sum(1 for _ in open(file_path)) - (
                    1 if self.options.header_row is not None else 0
                )
                self._progress.total_records = total_rows
                self._progress.total_batches = (total_rows // self.config.batch_size) + 1
            except Exception:
                pass

            # Read CSV in chunks using pandas
            chunks = pd.read_csv(
                file_path,
                chunksize=self.config.batch_size,
                delimiter=self.options.delimiter,
                header=self.options.header_row,
                skiprows=self.options.skip_rows,
                encoding=self.options.encoding,
                na_values=self.options.na_values,
                parse_dates=self.options.parse_dates,
            )

            batch_number = 0
            for chunk in chunks:
                records = []
                for _, row in chunk.iterrows():
                    record = DataRecord(data=row.to_dict())
                    records.append(record)

                batch = DataBatch(
                    records=records,
                    batch_number=batch_number,
                )

                self.update_progress(processed=len(records), batch=batch_number)
                yield batch
                batch_number += 1

                # Allow async operations
                await asyncio.sleep(0)

            self._progress.status = TransferStatus.COMPLETED
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ImportError(f"Failed to import CSV: {e}") from e


class JSONImporter(BaseImporter):
    """JSON file importer using pandas."""

    async def import_from_file(self, file_path: Path) -> AsyncGenerator[DataBatch]:
        """Import JSON file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            if self.options.json_lines:
                # Read JSON Lines format
                chunks = pd.read_json(
                    file_path,
                    lines=True,
                    chunksize=self.config.batch_size,
                    encoding=self.options.encoding,
                )
            else:
                # Read regular JSON
                df = pd.read_json(
                    file_path,
                    encoding=self.options.encoding,
                )
                # Create chunks manually
                chunks = [
                    df[i : i + self.config.batch_size]
                    for i in range(0, len(df), self.config.batch_size)
                ]

            batch_number = 0
            for chunk in chunks:
                if isinstance(chunk, pd.DataFrame):
                    records = []
                    for _, row in chunk.iterrows():
                        record = DataRecord(data=row.to_dict())
                        records.append(record)

                    batch = DataBatch(
                        records=records,
                        batch_number=batch_number,
                    )

                    self.update_progress(processed=len(records), batch=batch_number)
                    yield batch
                    batch_number += 1

                    await asyncio.sleep(0)

            self._progress.status = TransferStatus.COMPLETED
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ImportError(f"Failed to import JSON: {e}") from e


class ExcelImporter(BaseImporter):
    """Excel file importer using pandas."""

    async def import_from_file(self, file_path: Path) -> AsyncGenerator[DataBatch]:
        """Import Excel file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            # Read Excel file
            df_result = pd.read_excel(
                file_path,
                sheet_name=self.options.sheet_name,
                header=self.options.header_row,
                skiprows=self.options.skip_rows,
                na_values=self.options.na_values,
                parse_dates=self.options.parse_dates,
            )

            # Handle multiple sheets case (when sheet_name=None returns dict)
            if isinstance(df_result, dict):
                # Use the first sheet if multiple sheets are returned
                df = list(df_result.values())[0]
            else:
                df = df_result

            # Process in batches
            batch_number = 0
            for i in range(0, len(df), self.config.batch_size):
                chunk = df.iloc[i : i + self.config.batch_size]
                records = []
                for _, row in chunk.iterrows():
                    record = DataRecord(data=row.to_dict())
                    records.append(record)

                batch = DataBatch(
                    records=records,
                    batch_number=batch_number,
                )

                self.update_progress(processed=len(records), batch=batch_number)
                yield batch
                batch_number += 1

                await asyncio.sleep(0)

            self._progress.status = TransferStatus.COMPLETED
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ImportError(f"Failed to import Excel: {e}") from e


class XMLImporter(BaseImporter):
    """XML file importer."""

    async def import_from_file(self, file_path: Path) -> AsyncGenerator[DataBatch]:
        """Import XML file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            tree = ET.parse(file_path)  # nosec B314 - Uploaded files validated before parsing
            root = tree.getroot()

            # Find record elements
            if self.options.xml_record_element:
                records_elements = root.findall(f".//{self.options.xml_record_element}")
            else:
                # Try to auto-detect record elements (first level children)
                records_elements = list(root)

            batch_records = []
            batch_number = 0

            for elem in records_elements:
                # Convert XML element to dict
                data = self._xml_to_dict(elem)
                record_data = data if isinstance(data, dict) else {"value": data}
                record = DataRecord(data=record_data)
                batch_records.append(record)

                if len(batch_records) >= self.config.batch_size:
                    batch = DataBatch(
                        records=batch_records,
                        batch_number=batch_number,
                    )

                    self.update_progress(processed=len(batch_records), batch=batch_number)
                    yield batch
                    batch_records = []
                    batch_number += 1

                    await asyncio.sleep(0)

            # Yield remaining records
            if batch_records:
                batch = DataBatch(
                    records=batch_records,
                    batch_number=batch_number,
                )
                self.update_progress(processed=len(batch_records), batch=batch_number)
                yield batch

            self._progress.status = TransferStatus.COMPLETED
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ImportError(f"Failed to import XML: {e}") from e

    def _xml_to_dict(self, element: ET.Element) -> dict[str, Any] | str | None:
        """Convert XML element to dictionary."""
        result: dict[str, Any] = {}

        # Add attributes
        for key, value in element.attrib.items():
            result[f"@{key}"] = value

        # Add text content
        if element.text and element.text.strip():
            result["#text"] = element.text.strip()

        # Add child elements
        for child in element:
            child_data = self._xml_to_dict(child)
            if child.tag in result:
                # Convert to list if multiple elements with same tag
                if not isinstance(result[child.tag], list):
                    result[child.tag] = [result[child.tag]]
                result[child.tag].append(child_data)
            else:
                result[child.tag] = child_data

        if result:
            return result
        if element.text and element.text.strip():
            return element.text.strip()
        return None


class YAMLImporter(BaseImporter):
    """YAML file importer."""

    async def import_from_file(self, file_path: Path) -> AsyncGenerator[DataBatch]:
        """Import YAML file."""
        try:
            self._progress.status = TransferStatus.RUNNING

            if yaml is None:
                raise ImportError("PyYAML is required for YAML imports")

            with open(file_path, encoding=self.options.encoding) as f:
                data = yaml.safe_load(f)

            # Convert to list of records if not already
            if isinstance(data, dict):
                records_data = [data]
            elif isinstance(data, list):
                records_data = data
            else:
                raise ImportError(f"Unsupported YAML structure: {type(data)}")

            # Process in batches
            batch_number = 0
            for i in range(0, len(records_data), self.config.batch_size):
                batch_data = records_data[i : i + self.config.batch_size]
                records = [
                    DataRecord(data=item if isinstance(item, dict) else {"value": item})
                    for item in batch_data
                ]

                batch = DataBatch(
                    records=records,
                    batch_number=batch_number,
                )

                self.update_progress(processed=len(records), batch=batch_number)
                yield batch
                batch_number += 1

                await asyncio.sleep(0)

            self._progress.status = TransferStatus.COMPLETED
        except Exception as e:
            self._progress.status = TransferStatus.FAILED
            self._progress.error_message = str(e)
            raise ImportError(f"Failed to import YAML: {e}") from e


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
        ".parquet": DataFormat.PARQUET,
    }

    ext = file_path.suffix.lower()
    if ext in extension_map:
        return extension_map[ext]

    raise FormatError(f"Unsupported file format: {ext}")


def create_importer(
    format: DataFormat,
    config: TransferConfig,
    options: ImportOptions | None = None,
    progress_callback: ProgressCallback | None = None,
) -> BaseImporter:
    """Create an importer for the specified format."""
    resolved_options = options or ImportOptions()

    importers: dict[DataFormat, type[BaseImporter]] = {
        DataFormat.CSV: CSVImporter,
        DataFormat.JSON: JSONImporter,
        DataFormat.JSONL: JSONImporter,
        DataFormat.EXCEL: ExcelImporter,
        DataFormat.XML: XMLImporter,
        DataFormat.YAML: YAMLImporter,
    }

    if format == DataFormat.JSONL:
        resolved_options.json_lines = True

    importer_class = importers.get(format)
    if importer_class is None:
        raise FormatError(f"No importer available for format: {format}")

    return importer_class(config, resolved_options, progress_callback)


async def import_file(
    file_path: str,
    format: DataFormat | None = None,
    config: TransferConfig | None = None,
    options: ImportOptions | None = None,
    progress_callback: ProgressCallback | None = None,
) -> AsyncGenerator[DataBatch]:
    """Import data from a file."""
    path = Path(file_path)

    if not path.exists():
        raise ImportError(f"File not found: {file_path}")

    if format is None:
        format = detect_format(path)

    # Provide default config if None
    if config is None:
        from .core import TransferConfig

        config = TransferConfig()
    importer = create_importer(format, config, options, progress_callback)

    async for batch in importer.import_from_file(path):
        yield batch

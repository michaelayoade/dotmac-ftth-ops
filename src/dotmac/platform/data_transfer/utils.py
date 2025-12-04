"""
Utility functions for data transfer operations.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from .core import (
    DataBatch,
    DataFormat,
    DataRecord,
    DataTransformer,
    DataValidator,
    ExportOptions,
    ImportOptions,
    ProgressCallback,
    ProgressInfo,
    TransferConfig,
)
from .exporters import create_exporter
from .importers import create_importer, detect_format
from .progress import (
    create_progress_tracker,
)


def create_operation_id() -> str:
    """Create a unique operation ID."""
    return str(uuid4())


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable form."""
    size = float(size_bytes)
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} PB"


def calculate_throughput(
    bytes_processed: int,
    elapsed_seconds: float,
) -> float:
    """Calculate throughput in bytes per second."""
    if elapsed_seconds <= 0:
        return 0.0
    return bytes_processed / elapsed_seconds


def estimate_completion_time(
    processed: int,
    total: int,
    elapsed_seconds: float,
) -> datetime | None:
    """Estimate completion time based on current progress."""
    if processed <= 0 or total <= 0 or elapsed_seconds <= 0:
        return None

    rate = processed / elapsed_seconds
    remaining = total - processed
    eta_seconds = remaining / rate

    return datetime.now() + timedelta(seconds=eta_seconds)


async def create_batches(
    data: list[dict[str, Any]],
    batch_size: int = 1000,
) -> AsyncGenerator[DataBatch]:
    """Create batches from a list of data."""
    batch_number = 0
    for i in range(0, len(data), batch_size):
        batch_data = data[i : i + batch_size]
        records = [DataRecord(data=item) for item in batch_data]
        yield DataBatch(
            records=records,
            batch_number=batch_number,
        )
        batch_number += 1
        await asyncio.sleep(0)  # Allow other tasks to run


def create_transfer_config(
    batch_size: int = 1000,
    max_workers: int = 4,
    chunk_size: int = 8192,
    encoding: str = "utf-8",
    validate_data: bool = True,
    skip_invalid: bool = False,
    resume_on_failure: bool = True,
    **kwargs: Any,
) -> TransferConfig:
    """Create a transfer configuration with sensible defaults."""
    return TransferConfig(
        batch_size=batch_size,
        max_workers=max_workers,
        chunk_size=chunk_size,
        encoding=encoding,
        validate_data=validate_data,
        skip_invalid=skip_invalid,
        resume_on_failure=resume_on_failure,
        **kwargs,
    )


def create_import_options(
    data_format: DataFormat,
    **kwargs: Any,
) -> ImportOptions:
    """Create import options optimized for specific format."""
    format_defaults: dict[DataFormat, dict[str, Any]] = {
        DataFormat.CSV: {
            "delimiter": ",",
            "header_row": 0,
            "type_inference": True,
        },
        DataFormat.JSON: {
            "type_inference": True,
        },
        DataFormat.JSONL: {
            "json_lines": True,
            "type_inference": True,
        },
        DataFormat.EXCEL: {
            "sheet_name": None,
            "skip_rows": 0,
            "type_inference": True,
        },
        DataFormat.XML: {
            "xml_record_element": None,
        },
    }

    options: dict[str, Any] = dict(format_defaults.get(data_format, {}))
    options.update(kwargs)

    return ImportOptions(**options)


def create_export_options(
    data_format: DataFormat,
    **kwargs: Any,
) -> ExportOptions:
    """Create export options optimized for specific format."""
    format_defaults: dict[DataFormat, dict[str, Any]] = {
        DataFormat.CSV: {
            "delimiter": ",",
            "include_headers": True,
            "quoting": 1,
        },
        DataFormat.JSON: {
            "json_indent": 2,
            "json_ensure_ascii": False,
            "json_sort_keys": False,
        },
        DataFormat.JSONL: {
            "json_lines": True,
            "json_ensure_ascii": False,
        },
        DataFormat.EXCEL: {
            "sheet_name": "Data",
            "auto_filter": True,
            "freeze_panes": "A2",
        },
        DataFormat.XML: {
            "xml_root_element": "root",
            "xml_record_element": "record",
            "xml_pretty_print": True,
        },
        DataFormat.YAML: {
            "json_sort_keys": False,
        },
    }

    options: dict[str, Any] = dict(format_defaults.get(data_format, {}))
    options.update(kwargs)

    return ExportOptions(**options)


class DataPipeline:
    """Simplified data processing pipeline."""

    def __init__(
        self,
        source_path: Path,
        target_path: Path,
        source_format: DataFormat,
        target_format: DataFormat,
        config: TransferConfig,
        import_options: ImportOptions,
        export_options: ExportOptions,
        progress_callback: ProgressCallback | None = None,
        validator: DataValidator | None = None,
        transformer: DataTransformer | None = None,
    ):
        self.source_path = source_path
        self.target_path = target_path
        self.source_format = source_format
        self.target_format = target_format
        self.config = config
        self.import_options = import_options
        self.export_options = export_options
        self.progress_callback = progress_callback
        self.validator = validator
        self.transformer = transformer

        self.operation_id = create_operation_id()
        self.progress_tracker = create_progress_tracker(self.operation_id, progress_callback)

    async def execute(self) -> ProgressInfo:
        """Execute the data pipeline."""
        try:
            await self.progress_tracker.initialize()

            # Create importer and exporter
            importer = create_importer(
                self.source_format,
                self.config,
                self.import_options,
                self._on_import_progress,
            )

            exporter = create_exporter(
                self.target_format,
                self.config,
                self.export_options,
                self._on_export_progress,
            )

            # Process data
            async def process_data() -> AsyncGenerator[DataBatch]:
                async for batch in importer.import_from_file(self.source_path):
                    # Apply validation and transformation
                    if self.validator or self.transformer:
                        processed_records: list[DataRecord] = []
                        for record in batch.records:
                            if self.validator and not self.validator(record):
                                if not self.config.skip_invalid:
                                    processed_records.append(record)
                                continue

                            if self.transformer:
                                record = self.transformer(record)

                            processed_records.append(record)

                        batch.records = processed_records

                    yield batch

            # Export processed data
            result = await exporter.export_to_file(process_data(), self.target_path)

            await self.progress_tracker.complete()
            return result

        except Exception as e:
            await self.progress_tracker.fail(str(e))
            raise

    def _on_import_progress(self, progress: ProgressInfo) -> None:
        """Handle import progress updates."""
        self.progress_tracker._progress.processed_records = progress.processed_records
        self.progress_tracker._progress.current_batch = progress.current_batch

    def _on_export_progress(self, progress: ProgressInfo) -> None:
        """Handle export progress updates."""
        self.progress_tracker._progress = progress


def create_data_pipeline(
    source_path: str,
    target_path: str,
    source_format: DataFormat | None = None,
    target_format: DataFormat | None = None,
    config: TransferConfig | None = None,
    import_options: ImportOptions | None = None,
    export_options: ExportOptions | None = None,
    progress_callback: ProgressCallback | None = None,
    validator: DataValidator | None = None,
    transformer: DataTransformer | None = None,
) -> DataPipeline:
    """Create a data processing pipeline."""
    source = Path(source_path)
    target = Path(target_path)

    # Auto-detect source format
    if source_format is None:
        source_format = detect_format(source)

    # Infer target format from extension
    if target_format is None:
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
        target_format = extension_map.get(target.suffix.lower(), DataFormat.JSON)

    return DataPipeline(
        source_path=source,
        target_path=target,
        source_format=source_format,
        target_format=target_format,
        config=config or create_transfer_config(),
        import_options=import_options or create_import_options(source_format),
        export_options=export_options or create_export_options(target_format),
        progress_callback=progress_callback,
        validator=validator,
        transformer=transformer,
    )


async def convert_file(
    source_path: str,
    target_path: str,
    source_format: DataFormat | None = None,
    target_format: DataFormat | None = None,
    batch_size: int = 1000,
    progress_callback: ProgressCallback | None = None,
) -> ProgressInfo:
    """Convert a file from one format to another."""
    config = create_transfer_config(batch_size=batch_size)
    pipeline = create_data_pipeline(
        source_path=source_path,
        target_path=target_path,
        source_format=source_format,
        target_format=target_format,
        config=config,
        progress_callback=progress_callback,
    )

    return await pipeline.execute()


async def validate_and_clean_file(
    source_path: str,
    target_path: str,
    validator: DataValidator,
    transformer: DataTransformer | None = None,
    skip_invalid: bool = True,
    progress_callback: ProgressCallback | None = None,
) -> ProgressInfo:
    """Validate and clean a data file."""
    config = create_transfer_config(
        validate_data=True,
        skip_invalid=skip_invalid,
    )

    pipeline = create_data_pipeline(
        source_path=source_path,
        target_path=target_path,
        config=config,
        progress_callback=progress_callback,
        validator=validator,
        transformer=transformer,
    )

    return await pipeline.execute()

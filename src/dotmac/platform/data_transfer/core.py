"""
Core classes and types for simplified data transfer using pandas.
"""

from abc import abstractmethod
from collections.abc import AsyncGenerator, AsyncIterator
from datetime import UTC, datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Protocol
from uuid import uuid4

from pydantic import ConfigDict, Field

from ..core.exceptions import DotMacError
from ..core.models import BaseModel


class DataTransferError(DotMacError):
    """Base exception for data transfer operations."""


class ImportError(DataTransferError):
    """Exception raised during import operations."""


class ExportError(DataTransferError):
    """Exception raised during export operations."""


class DataValidationError(DataTransferError):
    """Exception raised when data validation fails."""


class FormatError(DataTransferError):
    """Exception raised for unsupported formats."""


class StreamingError(DataTransferError):
    """Exception raised during streaming operations."""


class ProgressError(DataTransferError):
    """Exception raised during progress tracking."""


class DataFormat(str, Enum):
    """Supported data formats."""

    CSV = "csv"
    JSON = "json"
    JSONL = "jsonl"
    EXCEL = "excel"
    XML = "xml"
    PARQUET = "parquet"
    YAML = "yaml"


class TransferStatus(str, Enum):
    """Transfer operation status."""

    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CompressionType(str, Enum):
    """Supported compression types."""

    NONE = "none"
    GZIP = "gzip"
    ZIP = "zip"
    BZIP2 = "bzip2"


class ProgressInfo(BaseModel):  # BaseModel resolves to Any in isolation
    """Progress tracking information."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")

    operation_id: str = Field(default_factory=lambda: str(uuid4()))
    total_records: int | None = None
    processed_records: int = 0
    failed_records: int = 0
    current_batch: int = 0
    total_batches: int | None = None
    bytes_processed: int = 0
    bytes_total: int | None = None
    start_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_update: datetime = Field(default_factory=lambda: datetime.now(UTC))
    estimated_completion: datetime | None = None
    status: TransferStatus = TransferStatus.PENDING
    error_message: str | None = None

    @property
    def progress_percentage(self) -> float:
        """Calculate progress percentage."""
        if self.total_records and self.total_records > 0:
            return (self.processed_records / self.total_records) * 100
        elif self.bytes_total and self.bytes_total > 0:
            return (self.bytes_processed / self.bytes_total) * 100
        return 0.0

    @property
    def elapsed_time(self) -> timedelta:
        """Calculate elapsed time."""
        return self.last_update - self.start_time

    @property
    def is_complete(self) -> bool:
        """Check if operation is complete."""
        return self.status == TransferStatus.COMPLETED

    @property
    def is_failed(self) -> bool:
        """Check if operation failed."""
        return self.status == TransferStatus.FAILED

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        total_processed = self.processed_records + self.failed_records
        if total_processed > 0:
            return (self.processed_records / total_processed) * 100
        return 100.0  # Default to 100% if no records processed yet


class DataRecord(BaseModel):  # BaseModel resolves to Any in isolation
    """Single data record."""

    model_config = ConfigDict()

    data: dict[str, Any]
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class DataBatch(BaseModel):  # BaseModel resolves to Any in isolation
    """Batch of data records."""

    model_config = ConfigDict()

    records: list[DataRecord]
    batch_number: int
    metadata: dict[str, Any] = Field(default_factory=lambda: {})

    @property
    def size(self) -> int:
        """Get batch size."""
        return len(self.records)


class TransferConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """Configuration for transfer operations."""

    model_config = ConfigDict()

    batch_size: int = 1000
    max_workers: int = 4
    chunk_size: int = 8192
    compression: CompressionType = CompressionType.NONE
    encoding: str = "utf-8"
    validate_data: bool = True
    skip_invalid: bool = False
    resume_on_failure: bool = True
    timeout: int | None = None
    retry_attempts: int = 3
    retry_delay: float = 1.0


class ImportOptions(BaseModel):  # BaseModel resolves to Any in isolation
    """Import-specific options."""

    model_config = ConfigDict()

    delimiter: str = ","
    header_row: int | None = 0
    skip_rows: int = 0
    type_inference: bool = True
    sheet_name: str | int | None = None
    json_lines: bool = False
    xml_record_element: str | None = None
    encoding: str = "utf-8"
    na_values: list[str] = Field(default_factory=lambda: [])
    parse_dates: bool = False


class ExportOptions(BaseModel):  # BaseModel resolves to Any in isolation
    """Export-specific options."""

    model_config = ConfigDict()

    delimiter: str = ","
    include_headers: bool = True
    json_indent: int | None = 2
    json_ensure_ascii: bool = False
    json_sort_keys: bool = False
    json_lines: bool = False
    sheet_name: str = "Data"
    xml_root_element: str = "root"
    xml_record_element: str = "record"
    xml_pretty_print: bool = True
    auto_filter: bool = True
    freeze_panes: str | None = "A2"
    encoding: str = "utf-8"
    quoting: int = 1  # csv.QUOTE_MINIMAL


# Protocols for customization
class DataTransformer(Protocol):
    """Protocol for data transformation functions."""

    def __call__(self, record: DataRecord) -> DataRecord:
        """Transform a data record."""
        ...


class DataValidator(Protocol):
    """Protocol for data validation functions."""

    def __call__(self, record: DataRecord) -> bool:
        """Validate a data record."""
        ...


class ProgressCallback(Protocol):
    """Protocol for progress callbacks."""

    def __call__(self, progress: ProgressInfo) -> None:
        """Handle progress update."""
        ...


class BaseDataProcessor:
    """Base class for data processors."""

    def __init__(
        self,
        config: TransferConfig,
        progress_callback: ProgressCallback | None = None,
    ):
        self.config = config
        self.progress_callback = progress_callback
        self._progress = ProgressInfo()

    def update_progress(
        self,
        processed: int = 0,
        failed: int = 0,
        batch: int | None = None,
    ) -> None:
        """Update progress information."""
        self._progress.processed_records += processed
        self._progress.failed_records += failed
        if batch is not None:
            self._progress.current_batch = batch
        self._progress.last_update = datetime.now(UTC)

        if self.progress_callback:
            self.progress_callback(self._progress)


class BaseImporter(BaseDataProcessor):
    """Base class for data importers."""

    def __init__(
        self,
        config: TransferConfig,
        options: ImportOptions,
        progress_callback: ProgressCallback | None = None,
    ):
        super().__init__(config, progress_callback)
        self.options = options

    @abstractmethod
    def import_from_file(self, file_path: Path) -> AsyncIterator[DataBatch]:
        """Import data from file."""
        raise NotImplementedError("Subclasses must implement import_from_file")

    async def process(self, file_path: Path) -> AsyncIterator[DataBatch]:
        """Process import operation."""
        async for batch in self.import_from_file(file_path):
            yield batch


class BaseExporter(BaseDataProcessor):
    """Base class for data exporters."""

    def __init__(
        self,
        config: TransferConfig,
        options: ExportOptions,
        progress_callback: ProgressCallback | None = None,
    ):
        super().__init__(config, progress_callback)
        self.options = options

    @abstractmethod
    async def export_to_file(
        self,
        data: AsyncGenerator[DataBatch],
        file_path: Path,
    ) -> ProgressInfo:
        """Export data to file."""
        pass

    async def process(
        self,
        data: AsyncGenerator[DataBatch],
        file_path: Path,
    ) -> ProgressInfo:
        """Process export operation."""
        return await self.export_to_file(data, file_path)

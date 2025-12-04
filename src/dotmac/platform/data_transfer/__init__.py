"""
Simplified Data Transfer Module using pandas and standard libraries.

This module replaces the custom data transfer implementation with
pandas-based functionality and Python standard libraries.
"""

# Version info
from ..version import get_version
from .core import (  # Core classes and enums; Exceptions; Base classes; Protocols
    BaseDataProcessor,
    BaseExporter,
    BaseImporter,
    CompressionType,
    DataBatch,
    DataFormat,
    DataRecord,
    DataTransferError,
    DataTransformer,
    DataValidationError,
    DataValidator,
    ExportError,
    ExportOptions,
    FormatError,
    ImportError,
    ImportOptions,
    ProgressCallback,
    ProgressError,
    ProgressInfo,
    StreamingError,
    TransferConfig,
    TransferStatus,
)
from .exporters import (
    CSVExporter,
    ExcelExporter,
    JSONExporter,
    XMLExporter,
    YAMLExporter,
    compress_file,
    export_data,
)
from .factory import (
    DataTransferFactory,
    DataTransferRegistry,
    create_csv_exporter,
    create_csv_importer,
    create_excel_exporter,
    create_excel_importer,
    create_exporter,
    create_importer,
    detect_format,
)
from .importers import (
    CSVImporter,
    ExcelImporter,
    JSONImporter,
    XMLImporter,
    YAMLImporter,
    import_file,
)
from .progress import (
    CheckpointData,
    CheckpointStore,
    FileProgressStore,
    ProgressStore,
    ProgressTracker,
    ResumableOperation,
    cleanup_old_operations,
    create_progress_tracker,
)
from .utils import (
    DataPipeline,
    calculate_throughput,
    convert_file,
    create_batches,
    create_data_pipeline,
    create_export_options,
    create_import_options,
    create_operation_id,
    create_transfer_config,
    estimate_completion_time,
    format_file_size,
    validate_and_clean_file,
)

__version__ = get_version()
__author__ = "DotMac Team"

__all__ = [
    # Core classes and enums
    "DataFormat",
    "TransferStatus",
    "CompressionType",
    "ProgressInfo",
    "DataRecord",
    "DataBatch",
    "TransferConfig",
    # Exceptions
    "DataTransferError",
    "ImportError",
    "ExportError",
    "DataValidationError",
    "FormatError",
    "StreamingError",
    "ProgressError",
    # Base classes
    "BaseDataProcessor",
    "BaseImporter",
    "BaseExporter",
    # Protocols
    "DataTransformer",
    "DataValidator",
    "ProgressCallback",
    # Importers
    "CSVImporter",
    "JSONImporter",
    "ExcelImporter",
    "XMLImporter",
    "YAMLImporter",
    "ImportOptions",
    "import_file",
    "detect_format",
    "create_importer",
    # Exporters
    "CSVExporter",
    "JSONExporter",
    "ExcelExporter",
    "XMLExporter",
    "YAMLExporter",
    "ExportOptions",
    "export_data",
    "create_exporter",
    "compress_file",
    # Progress tracking
    "ProgressTracker",
    "CheckpointData",
    "CheckpointStore",
    "FileProgressStore",
    "ProgressStore",
    "ResumableOperation",
    "create_progress_tracker",
    "cleanup_old_operations",
    # Utilities
    "calculate_throughput",
    "create_batches",
    "create_operation_id",
    "estimate_completion_time",
    "format_file_size",
    "convert_file",
    "validate_and_clean_file",
    "create_transfer_config",
    "create_import_options",
    "create_export_options",
    "create_data_pipeline",
    "DataPipeline",
    # Factory classes and functions
    "DataTransferFactory",
    "DataTransferRegistry",
    "create_importer",
    "create_exporter",
    "detect_format",
    "create_csv_importer",
    "create_csv_exporter",
    "create_excel_importer",
    "create_excel_exporter",
]

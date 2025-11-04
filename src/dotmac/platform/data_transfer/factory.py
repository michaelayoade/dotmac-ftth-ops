"""
Data transfer factory with feature flag integration.

This module provides factories for creating data importers and exporters
based on feature flags and file formats.
"""

from pathlib import Path
from typing import Any

from ..dependencies import DependencyChecker, require_dependency
from ..settings import settings
from .core import (
    BaseExporter,
    BaseImporter,
    DataFormat,
    ExportOptions,
    FormatError,
    ImportOptions,
    TransferConfig,
)


class DataTransferRegistry:
    """Registry for data transfer implementations."""

    def __init__(self) -> None:
        self._importers: dict[DataFormat, type[BaseImporter]] = {}
        self._exporters: dict[DataFormat, type[BaseExporter]] = {}
        self._register_core_formats()

    def _register_core_formats(self) -> None:
        """Register core data formats that are always available."""
        # Core formats using standard library and pandas
        from .exporters import CSVExporter, JSONExporter, XMLExporter, YAMLExporter
        from .importers import CSVImporter, JSONImporter, XMLImporter, YAMLImporter

        # Always available formats
        self._importers.update(
            {
                DataFormat.CSV: CSVImporter,
                DataFormat.JSON: JSONImporter,
                DataFormat.JSONL: JSONImporter,  # Same as JSON with options
                DataFormat.XML: XMLImporter,
                DataFormat.YAML: YAMLImporter,
            }
        )

        self._exporters.update(
            {
                DataFormat.CSV: CSVExporter,
                DataFormat.JSON: JSONExporter,
                DataFormat.JSONL: JSONExporter,  # Same as JSON with options
                DataFormat.XML: XMLExporter,
                DataFormat.YAML: YAMLExporter,
            }
        )

    def register_importer(self, format: DataFormat, importer_class: type[BaseImporter]) -> None:
        """Register an importer for a format."""
        self._importers[format] = importer_class

    def register_exporter(self, format: DataFormat, exporter_class: type[BaseExporter]) -> None:
        """Register an exporter for a format."""
        self._exporters[format] = exporter_class

    def get_importer_class(self, format: DataFormat) -> type[BaseImporter]:
        """Get importer class for a format."""
        if format not in self._importers:
            available = list(self._importers.keys())
            raise FormatError(
                f"No importer available for format '{format}'. Available: {available}"
            )
        return self._importers[format]

    def get_exporter_class(self, format: DataFormat) -> type[BaseExporter]:
        """Get exporter class for a format."""
        if format not in self._exporters:
            available = list(self._exporters.keys())
            raise FormatError(
                f"No exporter available for format '{format}'. Available: {available}"
            )
        return self._exporters[format]

    def list_available_formats(self) -> dict[str, list[DataFormat]]:
        """List all available formats."""
        return {
            "importers": list(self._importers.keys()),
            "exporters": list(self._exporters.keys()),
        }

    def list_enabled_formats(self) -> dict[str, list[DataFormat]]:
        """List formats that are enabled via feature flags."""
        enabled_importers = []
        enabled_exporters = []

        # Check core formats (always enabled if data_transfer_enabled)
        if settings.features.data_transfer_enabled:
            core_formats = [
                DataFormat.CSV,
                DataFormat.JSON,
                DataFormat.JSONL,
                DataFormat.XML,
                DataFormat.YAML,
            ]
            enabled_importers.extend(core_formats)
            enabled_exporters.extend(core_formats)

            # Check Excel support
            if (
                settings.features.data_transfer_excel
                and DependencyChecker.check_feature_dependency("data_transfer_excel")
            ):
                enabled_importers.append(DataFormat.EXCEL)
                enabled_exporters.append(DataFormat.EXCEL)

        return {"importers": enabled_importers, "exporters": enabled_exporters}


# Global registry instance
_registry = DataTransferRegistry()


# Conditional format registration based on feature flags
def _register_optional_formats() -> None:
    """Register optional data formats if they're enabled and dependencies are available."""

    # Excel Support
    if settings.features.data_transfer_excel:
        if DependencyChecker.check_feature_dependency("data_transfer_excel"):
            from .exporters import ExcelExporter
            from .importers import ExcelImporter

            _registry.register_importer(DataFormat.EXCEL, ExcelImporter)
            _registry.register_exporter(DataFormat.EXCEL, ExcelExporter)


# Register optional formats on module import
_register_optional_formats()


class DataTransferFactory:
    """Factory for creating data transfer instances."""

    @staticmethod
    def create_importer(
        format: DataFormat | str,
        config: TransferConfig | None = None,
        options: ImportOptions | None = None,
        **kwargs: Any,
    ) -> BaseImporter:
        """
        Create a data importer instance.

        Args:
            format: Data format or string
            config: Transfer configuration
            options: Import options
            **kwargs: Additional arguments

        Returns:
            BaseImporter instance

        Raises:
            FormatError: If format is not supported
            ValueError: If format is not enabled
            DependencyError: If format dependencies are missing
        """
        if isinstance(format, str):
            try:
                format = DataFormat(format.lower())
            except ValueError:
                available = [f.value for f in DataFormat]
                raise FormatError(f"Unknown format '{format}'. Available: {available}")

        # Check if data transfer is enabled
        if not settings.features.data_transfer_enabled:
            raise ValueError("Data transfer is disabled. Set FEATURES__DATA_TRANSFER_ENABLED=true")

        # Check format-specific features
        if format == DataFormat.EXCEL and not settings.features.data_transfer_excel:
            raise ValueError("Excel support is disabled. Set FEATURES__DATA_TRANSFER_EXCEL=true")

        # Check dependencies
        if format == DataFormat.EXCEL:
            DependencyChecker.require_feature_dependency("data_transfer_excel")

        # Get importer class and create instance
        resolved_config = config or TransferConfig()
        resolved_options = options or ImportOptions()

        importer_class = _registry.get_importer_class(format)
        return importer_class(resolved_config, resolved_options, **kwargs)

    @staticmethod
    def create_exporter(
        format: DataFormat | str,
        config: TransferConfig | None = None,
        options: ExportOptions | None = None,
        **kwargs: Any,
    ) -> BaseExporter:
        """
        Create a data exporter instance.

        Args:
            format: Data format or string
            config: Transfer configuration
            options: Export options
            **kwargs: Additional arguments

        Returns:
            BaseExporter instance

        Raises:
            FormatError: If format is not supported
            ValueError: If format is not enabled
            DependencyError: If format dependencies are missing
        """
        if isinstance(format, str):
            try:
                format = DataFormat(format.lower())
            except ValueError:
                available = [f.value for f in DataFormat]
                raise FormatError(f"Unknown format '{format}'. Available: {available}")

        # Check if data transfer is enabled
        if not settings.features.data_transfer_enabled:
            raise ValueError("Data transfer is disabled. Set FEATURES__DATA_TRANSFER_ENABLED=true")

        # Check format-specific features
        if format == DataFormat.EXCEL and not settings.features.data_transfer_excel:
            raise ValueError("Excel support is disabled. Set FEATURES__DATA_TRANSFER_EXCEL=true")

        # Check dependencies
        if format == DataFormat.EXCEL:
            DependencyChecker.require_feature_dependency("data_transfer_excel")

        # Get exporter class and create instance
        resolved_config = config or TransferConfig()
        resolved_options = options or ExportOptions()

        exporter_class = _registry.get_exporter_class(format)
        return exporter_class(resolved_config, resolved_options, **kwargs)

    @staticmethod
    def detect_format(file_path: str | Path) -> DataFormat:
        """
        Auto-detect file format from extension.

        Args:
            file_path: Path to the file

        Returns:
            Detected data format

        Raises:
            FormatError: If format cannot be detected
        """
        path = Path(file_path)
        extension = path.suffix.lower()

        format_map = {
            ".csv": DataFormat.CSV,
            ".json": DataFormat.JSON,
            ".jsonl": DataFormat.JSONL,
            ".xlsx": DataFormat.EXCEL,
            ".xls": DataFormat.EXCEL,
            ".xml": DataFormat.XML,
            ".yaml": DataFormat.YAML,
            ".yml": DataFormat.YAML,
        }

        if extension not in format_map:
            available = list(format_map.keys())
            raise FormatError(
                f"Cannot detect format for extension '{extension}'. Supported: {available}"
            )

        return format_map[extension]

    @staticmethod
    def list_available_formats() -> dict[str, list[str]]:
        """List all available formats."""
        formats = _registry.list_available_formats()
        return {
            "importers": [f.value for f in formats["importers"]],
            "exporters": [f.value for f in formats["exporters"]],
        }

    @staticmethod
    def list_enabled_formats() -> dict[str, list[str]]:
        """List formats that are enabled and have dependencies available."""
        formats = _registry.list_enabled_formats()
        return {
            "importers": [f.value for f in formats["importers"]],
            "exporters": [f.value for f in formats["exporters"]],
        }

    @staticmethod
    def validate_format(format: DataFormat | str) -> bool:
        """
        Check if a format is valid and its dependencies are available.

        Args:
            format: Format to validate

        Returns:
            True if format is valid and dependencies are available
        """
        try:
            DataTransferFactory.create_importer(format)
            return True
        except (FormatError, ValueError, ImportError):
            return False


# Convenience functions
def create_importer(format: DataFormat | str, **kwargs: Any) -> BaseImporter:
    """Create a data importer. Convenience function."""
    return DataTransferFactory.create_importer(format, **kwargs)


def create_exporter(format: DataFormat | str, **kwargs: Any) -> BaseExporter:
    """Create a data exporter. Convenience function."""
    return DataTransferFactory.create_exporter(format, **kwargs)


def detect_format(file_path: str | Path) -> DataFormat:
    """Auto-detect file format. Convenience function."""
    return DataTransferFactory.detect_format(file_path)


@require_dependency("data_transfer_excel")
def create_excel_importer(**kwargs: Any) -> BaseImporter:
    """Create an Excel importer (requires Excel support to be enabled)."""
    return DataTransferFactory.create_importer(DataFormat.EXCEL, **kwargs)


@require_dependency("data_transfer_excel")
def create_excel_exporter(**kwargs: Any) -> BaseExporter:
    """Create an Excel exporter (requires Excel support to be enabled)."""
    return DataTransferFactory.create_exporter(DataFormat.EXCEL, **kwargs)


def create_csv_importer(**kwargs: Any) -> BaseImporter:
    """Create a CSV importer (always available)."""
    return DataTransferFactory.create_importer(DataFormat.CSV, **kwargs)


def create_csv_exporter(**kwargs: Any) -> BaseExporter:
    """Create a CSV exporter (always available)."""
    return DataTransferFactory.create_exporter(DataFormat.CSV, **kwargs)

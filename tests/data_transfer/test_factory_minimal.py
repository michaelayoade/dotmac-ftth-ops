"""
Minimal integration tests for data_transfer factory module to achieve coverage.

This file focuses on real factory usage with minimal mocking.
"""

from unittest.mock import patch

import pytest

from dotmac.platform.data_transfer.core import (
    BaseExporter,
    BaseImporter,
    DataFormat,
    FormatError,
)
from dotmac.platform.data_transfer.factory import (
    DataTransferFactory,
    DataTransferRegistry,
    detect_format,
)


@pytest.mark.unit
class TestFactoryMinimal:
    """Minimal tests for real factory usage."""

    def test_registry_initialization(self):
        """Test registry initializes with core formats."""
        registry = DataTransferRegistry()
        formats = registry.list_available_formats()

        # Core formats should be available
        assert DataFormat.CSV in formats["importers"]
        assert DataFormat.JSON in formats["importers"]
        assert len(formats["importers"]) >= 4
        assert len(formats["exporters"]) >= 4

    def test_format_detection_real(self):
        """Test format detection with real implementation."""
        # Test various extensions
        assert DataTransferFactory.detect_format("file.csv") == DataFormat.CSV
        assert DataTransferFactory.detect_format("data.json") == DataFormat.JSON
        assert DataTransferFactory.detect_format("config.yaml") == DataFormat.YAML
        assert DataTransferFactory.detect_format("report.xml") == DataFormat.XML

        # Test with path objects
        from pathlib import Path

        assert DataTransferFactory.detect_format(Path("data.jsonl")) == DataFormat.JSONL

        # Test case insensitive
        assert DataTransferFactory.detect_format("FILE.CSV") == DataFormat.CSV

        # Test unknown format
        with pytest.raises(FormatError):
            DataTransferFactory.detect_format("file.unknown")

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_create_importer_real(self, mock_settings):
        """Test creating real importers with minimal mocking."""
        mock_settings.features.data_transfer_enabled = True

        # Create CSV importer
        importer = DataTransferFactory.create_importer("csv")
        assert isinstance(importer, BaseImporter)
        assert hasattr(importer, "import_from_file")

        # Create JSON importer
        importer = DataTransferFactory.create_importer(DataFormat.JSON)
        assert isinstance(importer, BaseImporter)

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_create_exporter_real(self, mock_settings):
        """Test creating real exporters with minimal mocking."""
        mock_settings.features.data_transfer_enabled = True

        # Create CSV exporter
        exporter = DataTransferFactory.create_exporter("csv")
        assert isinstance(exporter, BaseExporter)
        assert hasattr(exporter, "export_to_file")

        # Create JSON exporter
        exporter = DataTransferFactory.create_exporter(DataFormat.JSON)
        assert isinstance(exporter, BaseExporter)

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_format_validation_real(self, mock_settings):
        """Test format validation."""
        mock_settings.features.data_transfer_enabled = True

        # Valid formats
        assert DataTransferFactory.validate_format("csv") is True
        assert DataTransferFactory.validate_format(DataFormat.JSON) is True

        # Invalid format
        assert DataTransferFactory.validate_format("invalid") is False

    def test_registry_enabled_formats_real(self):
        """Test enabled formats with real settings."""
        registry = DataTransferRegistry()

        # Test with data transfer enabled
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True
            mock_settings.features.data_transfer_excel = False

            enabled = registry.list_enabled_formats()
            assert len(enabled["importers"]) > 0
            assert DataFormat.CSV in enabled["importers"]
            assert DataFormat.JSON in enabled["importers"]

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_feature_disabled_error(self, mock_settings):
        """Test error when data transfer is disabled."""
        mock_settings.features.data_transfer_enabled = False

        with pytest.raises(ValueError, match="Data transfer is disabled"):
            DataTransferFactory.create_importer("csv")

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_unknown_format_error(self, mock_settings):
        """Test error for unknown format."""
        mock_settings.features.data_transfer_enabled = True

        with pytest.raises(FormatError, match="Unknown format"):
            DataTransferFactory.create_importer("unknown_format")

    def test_convenience_function_detect_format(self):
        """Test detect_format convenience function."""
        # This should call the factory method
        result = detect_format("test.csv")
        assert result == DataFormat.CSV

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_excel_feature_disabled(self, mock_settings):
        """Test Excel format when disabled."""
        mock_settings.features.data_transfer_enabled = True
        mock_settings.features.data_transfer_excel = False

        with pytest.raises(ValueError, match="Excel support is disabled"):
            DataTransferFactory.create_importer("excel")

        with pytest.raises(ValueError, match="Excel support is disabled"):
            DataTransferFactory.create_exporter("excel")

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_excel_dependency_missing(self, mock_dep, mock_settings):
        """Test Excel format when dependencies are missing."""
        mock_settings.features.data_transfer_enabled = True
        mock_settings.features.data_transfer_excel = True
        mock_dep.require_feature_dependency.side_effect = ImportError("Missing openpyxl")

        with pytest.raises(ImportError):
            DataTransferFactory.create_importer("excel")

    def test_registry_error_handling(self):
        """Test registry error conditions."""
        registry = DataTransferRegistry()

        # Save original state
        original_importers = registry._importers.copy()

        try:
            # Clear registry and test error
            registry._importers.clear()
            with pytest.raises(FormatError, match="No importer available"):
                registry.get_importer_class(DataFormat.CSV)

            # Test with empty available formats
            with pytest.raises(FormatError, match="Available: \\[\\]"):
                registry.get_importer_class(DataFormat.JSON)
        finally:
            # Restore state
            registry._importers = original_importers

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_format_enum_vs_string(self, mock_settings):
        """Test format detection with enum vs string."""
        mock_settings.features.data_transfer_enabled = True

        # Test with enum
        importer1 = DataTransferFactory.create_importer(DataFormat.CSV)
        # Test with string
        importer2 = DataTransferFactory.create_importer("csv")

        # Should be same type
        assert type(importer1) is type(importer2)

    def test_registry_custom_format(self):
        """Test registering custom formats in registry."""
        registry = DataTransferRegistry()

        # Create mock importer class
        class MockImporter(BaseImporter):
            async def import_from_file(self, file_path):
                if False:  # Make it a generator
                    yield
                return

        # Register custom format
        registry.register_importer(DataFormat.PARQUET, MockImporter)

        # Verify it was registered
        importer_class = registry.get_importer_class(DataFormat.PARQUET)
        assert importer_class == MockImporter

        # Verify it appears in available formats
        formats = registry.list_available_formats()
        assert DataFormat.PARQUET in formats["importers"]

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_create_with_custom_config(self, mock_settings):
        """Test creating with custom configuration."""
        from dotmac.platform.data_transfer.core import ImportOptions, TransferConfig

        mock_settings.features.data_transfer_enabled = True

        config = TransferConfig(batch_size=5000)
        options = ImportOptions()

        importer = DataTransferFactory.create_importer("csv", config=config, options=options)

        assert importer.config.batch_size == 5000

    def test_format_extension_mapping(self):
        """Test all format extension mappings."""
        test_cases = [
            ("file.csv", DataFormat.CSV),
            ("file.json", DataFormat.JSON),
            ("file.jsonl", DataFormat.JSONL),
            ("file.xlsx", DataFormat.EXCEL),
            ("file.xls", DataFormat.EXCEL),
            ("file.xml", DataFormat.XML),
            ("file.yaml", DataFormat.YAML),
            ("file.yml", DataFormat.YAML),
        ]

        for filename, expected_format in test_cases:
            result = DataTransferFactory.detect_format(filename)
            assert result == expected_format

    def test_format_case_sensitivity(self):
        """Test case insensitive format detection."""
        assert DataTransferFactory.detect_format("FILE.CSV") == DataFormat.CSV
        assert DataTransferFactory.detect_format("Data.JSON") == DataFormat.JSON
        assert DataTransferFactory.detect_format("Config.YAML") == DataFormat.YAML

    def test_format_with_complex_paths(self):
        """Test format detection with complex paths."""
        assert DataTransferFactory.detect_format("/path/to/data.csv") == DataFormat.CSV
        assert DataTransferFactory.detect_format("../relative/path.json") == DataFormat.JSON
        assert DataTransferFactory.detect_format("C:\\windows\\path.xlsx") == DataFormat.EXCEL

    def test_registry_exporter_error_handling(self):
        """Test registry exporter error conditions."""
        registry = DataTransferRegistry()

        # Save original state
        original_exporters = registry._exporters.copy()

        try:
            # Clear registry and test error
            registry._exporters.clear()
            with pytest.raises(FormatError, match="No exporter available"):
                registry.get_exporter_class(DataFormat.CSV)

            # Test with empty available formats
            with pytest.raises(FormatError, match="Available: \\[\\]"):
                registry.get_exporter_class(DataFormat.JSON)
        finally:
            # Restore state
            registry._exporters = original_exporters

    def test_registry_enabled_formats_disabled(self):
        """Test enabled formats when data transfer is disabled."""
        registry = DataTransferRegistry()

        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = False

            enabled = registry.list_enabled_formats()
            assert enabled["importers"] == []
            assert enabled["exporters"] == []

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_excel_enabled_with_dependencies(self, mock_dep, mock_settings):
        """Test Excel when enabled with dependencies available."""
        mock_settings.features.data_transfer_enabled = True
        mock_settings.features.data_transfer_excel = True
        mock_dep.check_feature_dependency.return_value = True

        registry = DataTransferRegistry()
        enabled = registry.list_enabled_formats()

        # Excel should be in enabled formats
        assert DataFormat.EXCEL in enabled["importers"]
        assert DataFormat.EXCEL in enabled["exporters"]

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_excel_enabled_no_dependencies(self, mock_dep, mock_settings):
        """Test Excel when enabled but dependencies not available."""
        mock_settings.features.data_transfer_enabled = True
        mock_settings.features.data_transfer_excel = True
        mock_dep.check_feature_dependency.return_value = False

        registry = DataTransferRegistry()
        enabled = registry.list_enabled_formats()

        # Excel should NOT be in enabled formats
        assert DataFormat.EXCEL not in enabled["importers"]
        assert DataFormat.EXCEL not in enabled["exporters"]

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_create_exporter_with_custom_config(self, mock_settings):
        """Test creating exporter with custom configuration."""
        from dotmac.platform.data_transfer.core import ExportOptions, TransferConfig

        mock_settings.features.data_transfer_enabled = True

        config = TransferConfig(batch_size=2000)
        options = ExportOptions()

        exporter = DataTransferFactory.create_exporter("json", config=config, options=options)

        assert exporter.config.batch_size == 2000

    def test_all_convenience_functions(self):
        """Test all convenience functions."""
        from dotmac.platform.data_transfer.factory import (
            create_csv_exporter,
            create_csv_importer,
            create_exporter,
            create_importer,
        )

        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Test convenience functions
            importer = create_importer("csv")
            assert isinstance(importer, BaseImporter)

            exporter = create_exporter("csv")
            assert isinstance(exporter, BaseExporter)

            csv_importer = create_csv_importer()
            assert isinstance(csv_importer, BaseImporter)

            csv_exporter = create_csv_exporter()
            assert isinstance(csv_exporter, BaseExporter)

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_excel_convenience_functions(self, mock_dep, mock_settings):
        """Test Excel convenience functions."""
        from dotmac.platform.data_transfer.factory import (
            create_excel_exporter,
            create_excel_importer,
        )

        mock_settings.features.data_transfer_enabled = True
        mock_settings.features.data_transfer_excel = True
        mock_dep.require_feature_dependency.return_value = None

        # These should work when dependencies are satisfied
        excel_importer = create_excel_importer()
        assert isinstance(excel_importer, BaseImporter)

        excel_exporter = create_excel_exporter()
        assert isinstance(excel_exporter, BaseExporter)

    def test_factory_list_available_formats_string_values(self):
        """Test factory list_available_formats returns string values."""
        formats = DataTransferFactory.list_available_formats()

        # Should return string values, not enum values
        assert isinstance(formats["importers"], list)
        assert isinstance(formats["exporters"], list)
        assert "csv" in formats["importers"]
        assert "json" in formats["importers"]
        assert "csv" in formats["exporters"]
        assert "json" in formats["exporters"]

    def test_factory_list_enabled_formats_string_values(self):
        """Test factory list_enabled_formats returns string values."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            formats = DataTransferFactory.list_enabled_formats()

            # Should return string values, not enum values
            assert isinstance(formats["importers"], list)
            assert isinstance(formats["exporters"], list)
            assert "csv" in formats["importers"]
            assert "json" in formats["importers"]

    def test_optional_format_registration_coverage(self):
        """Test the _register_optional_formats function coverage."""
        # The function is called on module import, but we can test it manually
        from dotmac.platform.data_transfer.factory import _register_optional_formats

        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            with patch("dotmac.platform.data_transfer.factory.DependencyChecker") as mock_dep:
                mock_settings.features.data_transfer_excel = True
                mock_dep.check_feature_dependency.return_value = True

                # This function should execute the Excel registration path
                _register_optional_formats()

        # Test disabled path
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_excel = False
            _register_optional_formats()

    def test_invalid_string_format_handling(self):
        """Test invalid string format handling in create methods."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Test invalid format string
            with pytest.raises(FormatError) as exc_info:
                DataTransferFactory.create_importer("invalid_format_name")

            # Should mention available formats
            assert "Available:" in str(exc_info.value)
            assert "csv" in str(exc_info.value)  # Should list available formats

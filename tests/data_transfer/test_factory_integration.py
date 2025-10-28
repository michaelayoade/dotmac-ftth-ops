"""
Integration tests for data_transfer factory module.

These tests actually exercise the factory code without heavy mocking
to improve coverage and test real functionality.
"""

from pathlib import Path
from unittest.mock import patch

import pytest

from dotmac.platform.data_transfer.core import (
    BaseExporter,
    BaseImporter,
    DataFormat,
    ExportOptions,
    FormatError,
    ImportOptions,
    TransferConfig,
)
from dotmac.platform.data_transfer.factory import (
    DataTransferFactory,
    DataTransferRegistry,
    _register_optional_formats,
    _registry,
    create_csv_exporter,
    create_csv_importer,
    create_exporter,
    create_importer,
    detect_format,
)


@pytest.mark.integration
class TestFactoryIntegration:
    """Integration tests that actually exercise factory code."""

    def test_real_csv_importer_creation(self):
        """Test creating a real CSV importer."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            importer = DataTransferFactory.create_importer("csv")

            assert isinstance(importer, BaseImporter)
            assert hasattr(importer, "import_from_file")
            assert hasattr(importer, "process")

    def test_real_csv_exporter_creation(self):
        """Test creating a real CSV exporter."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            exporter = DataTransferFactory.create_exporter("csv")

            assert isinstance(exporter, BaseExporter)
            assert hasattr(exporter, "export_to_file")

    def test_real_json_importer_creation(self):
        """Test creating a real JSON importer."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            importer = DataTransferFactory.create_importer(DataFormat.JSON)

            assert isinstance(importer, BaseImporter)
            assert hasattr(importer, "import_from_file")

    def test_real_json_exporter_creation(self):
        """Test creating a real JSON exporter."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            exporter = DataTransferFactory.create_exporter(DataFormat.JSON)

            assert isinstance(exporter, BaseExporter)
            assert hasattr(exporter, "export_to_file")

    def test_importer_with_custom_config(self):
        """Test creating importer with custom configuration."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            config = TransferConfig(chunk_size=5000, batch_size=500, max_workers=2)
            options = ImportOptions(delimiter=";", header_row=1, type_inference=False)

            importer = DataTransferFactory.create_importer("csv", config=config, options=options)

            assert importer.config.chunk_size == 5000
            assert importer.options.delimiter == ";"

    def test_exporter_with_custom_config(self):
        """Test creating exporter with custom configuration."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            config = TransferConfig(chunk_size=10000)
            options = ExportOptions(include_headers=False)

            exporter = DataTransferFactory.create_exporter("csv", config=config, options=options)

            assert exporter.config.chunk_size == 10000
            assert exporter.options.include_headers is False

    def test_all_core_formats_available(self):
        """Test that all core formats can be created."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            core_formats = ["csv", "json", "jsonl", "xml", "yaml"]

            for format_name in core_formats:
                # Test importer
                importer = DataTransferFactory.create_importer(format_name)
                assert isinstance(importer, BaseImporter)

                # Test exporter
                exporter = DataTransferFactory.create_exporter(format_name)
                assert isinstance(exporter, BaseExporter)

    def test_registry_format_listing(self):
        """Test registry format listing functionality."""
        registry = DataTransferRegistry()

        available = registry.list_available_formats()
        assert "importers" in available
        assert "exporters" in available
        assert len(available["importers"]) > 0
        assert len(available["exporters"]) > 0

        # Core formats should be present
        assert DataFormat.CSV in available["importers"]
        assert DataFormat.JSON in available["importers"]
        assert DataFormat.CSV in available["exporters"]
        assert DataFormat.JSON in available["exporters"]

    def test_registry_enabled_formats_with_settings(self):
        """Test registry enabled formats with different settings."""
        registry = DataTransferRegistry()

        # Test with data transfer disabled
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = False

            enabled = registry.list_enabled_formats()
            assert enabled["importers"] == []
            assert enabled["exporters"] == []

        # Test with data transfer enabled
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True
            mock_settings.features.data_transfer_excel = False

            enabled = registry.list_enabled_formats()
            assert len(enabled["importers"]) > 0
            assert len(enabled["exporters"]) > 0
            assert DataFormat.EXCEL not in enabled["importers"]

    def test_factory_format_validation(self):
        """Test factory format validation."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Valid format
            assert DataTransferFactory.validate_format("csv") is True
            assert DataTransferFactory.validate_format(DataFormat.JSON) is True

            # Test with disabled features
            mock_settings.features.data_transfer_enabled = False
            assert DataTransferFactory.validate_format("csv") is False

    def test_factory_list_methods(self):
        """Test factory listing methods."""
        formats = DataTransferFactory.list_available_formats()
        assert "importers" in formats
        assert "exporters" in formats
        assert isinstance(formats["importers"], list)
        assert isinstance(formats["exporters"], list)

        enabled = DataTransferFactory.list_enabled_formats()
        assert "importers" in enabled
        assert "exporters" in enabled
        assert isinstance(enabled["importers"], list)
        assert isinstance(enabled["exporters"], list)

    def test_convenience_functions(self):
        """Test convenience functions."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Test convenience functions
            importer = create_importer("csv")
            assert isinstance(importer, BaseImporter)

            exporter = create_exporter("json")
            assert isinstance(exporter, BaseExporter)

            csv_importer = create_csv_importer()
            assert isinstance(csv_importer, BaseImporter)

            csv_exporter = create_csv_exporter()
            assert isinstance(csv_exporter, BaseExporter)

    def test_detect_format_with_real_files(self):
        """Test format detection with actual file paths."""
        # Test various extensions
        test_cases = [
            ("data.csv", DataFormat.CSV),
            ("/path/to/file.json", DataFormat.JSON),
            ("export.jsonl", DataFormat.JSONL),
            ("report.xlsx", DataFormat.EXCEL),
            ("old_file.xls", DataFormat.EXCEL),
            ("config.xml", DataFormat.XML),
            ("settings.yaml", DataFormat.YAML),
            ("config.yml", DataFormat.YAML),
        ]

        for file_path, expected_format in test_cases:
            detected = DataTransferFactory.detect_format(file_path)
            assert detected == expected_format

            # Also test with Path objects
            detected_path = DataTransferFactory.detect_format(Path(file_path))
            assert detected_path == expected_format

            # Test convenience function
            detected_conv = detect_format(file_path)
            assert detected_conv == expected_format

    def test_registry_custom_registration(self):
        """Test custom format registration in registry."""
        registry = DataTransferRegistry()

        # Create mock importer/exporter classes
        class MockImporter(BaseImporter):
            def __init__(self, config=None, options=None, **kwargs):
                super().__init__(config or TransferConfig(), options or ImportOptions())

            async def import_data(self, source, **kwargs):
                return []

        class MockExporter(BaseExporter):
            def __init__(self, config=None, options=None, **kwargs):
                super().__init__(config or TransferConfig(), options or ExportOptions())

            async def export_data(self, data, destination, **kwargs):
                pass

        # Register custom format
        custom_format = DataFormat.PARQUET
        registry.register_importer(custom_format, MockImporter)
        registry.register_exporter(custom_format, MockExporter)

        # Verify registration
        importer_class = registry.get_importer_class(custom_format)
        assert importer_class == MockImporter

        exporter_class = registry.get_exporter_class(custom_format)
        assert exporter_class == MockExporter

        # Verify it appears in available formats
        formats = registry.list_available_formats()
        assert custom_format in formats["importers"]
        assert custom_format in formats["exporters"]

    def test_error_handling_without_mocks(self):
        """Test error handling with minimal mocking."""
        # Test format detection with unknown extension
        with pytest.raises(FormatError) as exc_info:
            DataTransferFactory.detect_format("file.unknown_ext")
        assert "Cannot detect format" in str(exc_info.value)

        # Test invalid format string
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            with pytest.raises(FormatError) as exc_info:
                DataTransferFactory.create_importer("invalid_format")
            assert "Unknown format" in str(exc_info.value)

        # Test registry errors
        registry = DataTransferRegistry()
        registry._importers.clear()  # Clear for testing

        with pytest.raises(FormatError) as exc_info:
            registry.get_importer_class(DataFormat.CSV)
        assert "No importer available" in str(exc_info.value)

    def test_excel_format_handling(self):
        """Test Excel format handling with feature flags."""
        # Test with Excel disabled
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True
            mock_settings.features.data_transfer_excel = False

            with pytest.raises(ValueError) as exc_info:
                DataTransferFactory.create_importer("excel")
            assert "Excel support is disabled" in str(exc_info.value)

        # Test with Excel enabled but dependencies missing
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            with patch("dotmac.platform.data_transfer.factory.DependencyChecker") as mock_dep:
                mock_settings.features.data_transfer_enabled = True
                mock_settings.features.data_transfer_excel = True
                mock_dep.require_feature_dependency.side_effect = ImportError("Missing openpyxl")

                with pytest.raises(ImportError):
                    DataTransferFactory.create_importer("excel")

    def test_optional_format_registration(self):
        """Test optional format registration function."""
        # Create a fresh registry for testing
        original_registry = _registry._importers.copy()
        original_exporters = _registry._exporters.copy()

        try:
            # Clear Excel if present
            if DataFormat.EXCEL in _registry._importers:
                del _registry._importers[DataFormat.EXCEL]
            if DataFormat.EXCEL in _registry._exporters:
                del _registry._exporters[DataFormat.EXCEL]

            # Test registration with Excel enabled and dependencies available
            with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
                with patch("dotmac.platform.data_transfer.factory.DependencyChecker") as mock_dep:
                    mock_settings.features.data_transfer_excel = True
                    mock_dep.check_feature_dependency.return_value = True

                    # Call the registration function
                    _register_optional_formats()

                    # Excel should now be registered
                    assert DataFormat.EXCEL in _registry._importers
                    assert DataFormat.EXCEL in _registry._exporters

        finally:
            # Restore original state
            _registry._importers = original_registry
            _registry._exporters = original_exporters

    def test_real_format_support_matrix(self):
        """Test the complete format support matrix."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True
            mock_settings.features.data_transfer_excel = False

            expected_core_formats = [
                DataFormat.CSV,
                DataFormat.JSON,
                DataFormat.JSONL,
                DataFormat.XML,
                DataFormat.YAML,
            ]

            for format_enum in expected_core_formats:
                # Test with enum
                importer = DataTransferFactory.create_importer(format_enum)
                exporter = DataTransferFactory.create_exporter(format_enum)

                assert isinstance(importer, BaseImporter)
                assert isinstance(exporter, BaseExporter)

                # Test with string
                importer_str = DataTransferFactory.create_importer(format_enum.value)
                exporter_str = DataTransferFactory.create_exporter(format_enum.value)

                assert isinstance(importer_str, BaseImporter)
                assert isinstance(exporter_str, BaseExporter)

                # Both should be the same class
                assert type(importer) is type(importer_str)
                assert type(exporter) is type(exporter_str)

    def test_importer_exporter_configuration_inheritance(self):
        """Test that custom configurations are properly passed to importers/exporters."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Test with various configuration combinations
            configs = [
                (TransferConfig(chunk_size=1000), ImportOptions(delimiter=",")),
                (TransferConfig(batch_size=1024), ImportOptions(type_inference=False)),
                (None, ImportOptions(header_row=0)),
                (TransferConfig(chunk_size=5000), None),
            ]

            for config, options in configs:
                importer = DataTransferFactory.create_importer(
                    "csv", config=config, options=options
                )

                # Verify configuration was applied
                if config:
                    assert importer.config.chunk_size == config.chunk_size
                else:
                    # Should use default config
                    assert isinstance(importer.config, TransferConfig)

                if options:
                    assert importer.options.delimiter == options.delimiter
                else:
                    # Should use default options
                    assert isinstance(importer.options, ImportOptions)

    def test_global_registry_state(self):
        """Test the global registry state and consistency."""
        # The global registry should be consistent
        formats1 = _registry.list_available_formats()
        formats2 = _registry.list_available_formats()

        assert formats1 == formats2

        # Should have core formats
        assert DataFormat.CSV in formats1["importers"]
        assert DataFormat.JSON in formats1["importers"]
        assert DataFormat.XML in formats1["importers"]
        assert DataFormat.YAML in formats1["importers"]

        # Factory should use the same registry
        factory_formats = DataTransferFactory.list_available_formats()
        assert len(factory_formats["importers"]) == len(formats1["importers"])
        assert len(factory_formats["exporters"]) == len(formats1["exporters"])

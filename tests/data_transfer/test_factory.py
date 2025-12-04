"""
Comprehensive tests for data_transfer factory module.
"""

from pathlib import Path
from unittest.mock import Mock, patch

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
    create_csv_exporter,
    create_csv_importer,
    create_excel_exporter,
    create_excel_importer,
    create_exporter,
    create_importer,
    detect_format,
)


@pytest.mark.unit
class TestDataTransferRegistry:
    """Test DataTransferRegistry class."""

    def test_initialization(self):
        """Test registry initialization with core formats."""
        registry = DataTransferRegistry()

        # Check that core formats are registered
        formats = registry.list_available_formats()
        assert DataFormat.CSV in formats["importers"]
        assert DataFormat.JSON in formats["importers"]
        assert DataFormat.XML in formats["importers"]
        assert DataFormat.YAML in formats["importers"]
        assert DataFormat.CSV in formats["exporters"]
        assert DataFormat.JSON in formats["exporters"]
        assert DataFormat.XML in formats["exporters"]
        assert DataFormat.YAML in formats["exporters"]

    def test_register_importer(self):
        """Test registering a custom importer."""
        registry = DataTransferRegistry()

        class CustomImporter(BaseImporter):
            pass

        # Create a custom format (just for testing)
        custom_format = DataFormat.PARQUET
        registry.register_importer(custom_format, CustomImporter)

        # Verify it was registered
        importer_class = registry.get_importer_class(custom_format)
        assert importer_class == CustomImporter

    def test_register_exporter(self):
        """Test registering a custom exporter."""
        registry = DataTransferRegistry()

        class CustomExporter(BaseExporter):
            pass

        custom_format = DataFormat.PARQUET
        registry.register_exporter(custom_format, CustomExporter)

        # Verify it was registered
        exporter_class = registry.get_exporter_class(custom_format)
        assert exporter_class == CustomExporter

    def test_get_importer_class_not_found(self):
        """Test getting importer for unregistered format."""
        registry = DataTransferRegistry()

        # Clear all importers for testing
        registry._importers.clear()

        with pytest.raises(FormatError) as exc_info:
            registry.get_importer_class(DataFormat.CSV)
        assert "No importer available" in str(exc_info.value)

    def test_get_exporter_class_not_found(self):
        """Test getting exporter for unregistered format."""
        registry = DataTransferRegistry()

        # Clear all exporters for testing
        registry._exporters.clear()

        with pytest.raises(FormatError) as exc_info:
            registry.get_exporter_class(DataFormat.CSV)
        assert "No exporter available" in str(exc_info.value)

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_list_enabled_formats_disabled(self, mock_settings):
        """Test listing enabled formats when data transfer is disabled."""
        mock_settings.features.data_transfer_enabled = False

        registry = DataTransferRegistry()
        enabled = registry.list_enabled_formats()

        assert enabled["importers"] == []
        assert enabled["exporters"] == []

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_list_enabled_formats_with_excel(self, mock_dep_checker, mock_settings):
        """Test listing enabled formats with Excel support."""
        mock_settings.features.data_transfer_enabled = True
        mock_settings.features.data_transfer_excel = True
        mock_dep_checker.check_feature_dependency.return_value = True

        registry = DataTransferRegistry()
        enabled = registry.list_enabled_formats()

        assert DataFormat.EXCEL in enabled["importers"]
        assert DataFormat.EXCEL in enabled["exporters"]

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_list_enabled_formats_excel_no_deps(self, mock_dep_checker, mock_settings):
        """Test listing enabled formats with Excel enabled but no dependencies."""
        mock_settings.features.data_transfer_enabled = True
        mock_settings.features.data_transfer_excel = True
        mock_dep_checker.check_feature_dependency.return_value = False

        registry = DataTransferRegistry()
        enabled = registry.list_enabled_formats()

        assert DataFormat.EXCEL not in enabled["importers"]
        assert DataFormat.EXCEL not in enabled["exporters"]


@pytest.mark.unit
class TestDataTransferFactory:
    """Test DataTransferFactory class."""

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_create_importer_data_transfer_disabled(self, mock_settings):
        """Test creating importer when data transfer is disabled."""
        mock_settings.features.data_transfer_enabled = False

        with pytest.raises(ValueError) as exc_info:
            DataTransferFactory.create_importer("csv")
        assert "Data transfer is disabled" in str(exc_info.value)

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_create_importer_excel_disabled(self, mock_settings):
        """Test creating Excel importer when Excel is disabled."""
        mock_settings.features.data_transfer_enabled = True
        mock_settings.features.data_transfer_excel = False

        with pytest.raises(ValueError) as exc_info:
            DataTransferFactory.create_importer("excel")
        assert "Excel support is disabled" in str(exc_info.value)

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    @patch("dotmac.platform.data_transfer.factory._registry")
    def test_create_importer_success(self, mock_registry, mock_dep_checker, mock_settings):
        """Test successfully creating an importer."""
        mock_settings.features.data_transfer_enabled = True

        mock_importer_class = Mock()
        mock_importer_instance = Mock()
        mock_importer_class.return_value = mock_importer_instance
        mock_registry.get_importer_class.return_value = mock_importer_class

        result = DataTransferFactory.create_importer("csv")

        assert result == mock_importer_instance
        mock_registry.get_importer_class.assert_called_once_with(DataFormat.CSV)

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_create_importer_invalid_format(self, mock_settings):
        """Test creating importer with invalid format string."""
        mock_settings.features.data_transfer_enabled = True

        with pytest.raises(FormatError) as exc_info:
            DataTransferFactory.create_importer("invalid_format")
        assert "Unknown format" in str(exc_info.value)

    @patch("dotmac.platform.data_transfer.factory.settings")
    def test_create_exporter_data_transfer_disabled(self, mock_settings):
        """Test creating exporter when data transfer is disabled."""
        mock_settings.features.data_transfer_enabled = False

        with pytest.raises(ValueError) as exc_info:
            DataTransferFactory.create_exporter("csv")
        assert "Data transfer is disabled" in str(exc_info.value)

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    @patch("dotmac.platform.data_transfer.factory._registry")
    def test_create_exporter_success(self, mock_registry, mock_dep_checker, mock_settings):
        """Test successfully creating an exporter."""
        mock_settings.features.data_transfer_enabled = True

        mock_exporter_class = Mock()
        mock_exporter_instance = Mock()
        mock_exporter_class.return_value = mock_exporter_instance
        mock_registry.get_exporter_class.return_value = mock_exporter_class

        result = DataTransferFactory.create_exporter("json")

        assert result == mock_exporter_instance
        mock_registry.get_exporter_class.assert_called_once_with(DataFormat.JSON)

    def test_detect_format_csv(self):
        """Test detecting CSV format."""
        result = DataTransferFactory.detect_format("data.csv")
        assert result == DataFormat.CSV

    def test_detect_format_json(self):
        """Test detecting JSON format."""
        result = DataTransferFactory.detect_format("/path/to/file.json")
        assert result == DataFormat.JSON

    def test_detect_format_jsonl(self):
        """Test detecting JSONL format."""
        result = DataTransferFactory.detect_format("data.jsonl")
        assert result == DataFormat.JSONL

    def test_detect_format_excel_xlsx(self):
        """Test detecting Excel XLSX format."""
        result = DataTransferFactory.detect_format("spreadsheet.xlsx")
        assert result == DataFormat.EXCEL

    def test_detect_format_excel_xls(self):
        """Test detecting Excel XLS format."""
        result = DataTransferFactory.detect_format("old_spreadsheet.xls")
        assert result == DataFormat.EXCEL

    def test_detect_format_xml(self):
        """Test detecting XML format."""
        result = DataTransferFactory.detect_format("document.xml")
        assert result == DataFormat.XML

    def test_detect_format_yaml(self):
        """Test detecting YAML format."""
        result = DataTransferFactory.detect_format("config.yaml")
        assert result == DataFormat.YAML

    def test_detect_format_yml(self):
        """Test detecting YML format."""
        result = DataTransferFactory.detect_format("config.yml")
        assert result == DataFormat.YAML

    def test_detect_format_pathlib(self):
        """Test detecting format with Path object."""
        result = DataTransferFactory.detect_format(Path("data.csv"))
        assert result == DataFormat.CSV

    def test_detect_format_unknown(self):
        """Test detecting unknown format."""
        with pytest.raises(FormatError) as exc_info:
            DataTransferFactory.detect_format("file.unknown")
        assert "Cannot detect format" in str(exc_info.value)

    @patch("dotmac.platform.data_transfer.factory._registry")
    def test_list_available_formats(self, mock_registry):
        """Test listing available formats."""
        mock_registry.list_available_formats.return_value = {
            "importers": [DataFormat.CSV, DataFormat.JSON],
            "exporters": [DataFormat.CSV, DataFormat.JSON],
        }

        result = DataTransferFactory.list_available_formats()

        assert result["importers"] == ["csv", "json"]
        assert result["exporters"] == ["csv", "json"]

    @patch("dotmac.platform.data_transfer.factory._registry")
    def test_list_enabled_formats(self, mock_registry):
        """Test listing enabled formats."""
        mock_registry.list_enabled_formats.return_value = {
            "importers": [DataFormat.CSV],
            "exporters": [DataFormat.CSV],
        }

        result = DataTransferFactory.list_enabled_formats()

        assert result["importers"] == ["csv"]
        assert result["exporters"] == ["csv"]

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_importer")
    def test_validate_format_valid(self, mock_create_importer):
        """Test validating a valid format."""
        mock_create_importer.return_value = Mock()

        result = DataTransferFactory.validate_format("csv")

        assert result is True
        mock_create_importer.assert_called_once_with("csv")

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_importer")
    def test_validate_format_invalid(self, mock_create_importer):
        """Test validating an invalid format."""
        mock_create_importer.side_effect = FormatError("Invalid")

        result = DataTransferFactory.validate_format("invalid")

        assert result is False

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_importer")
    def test_validate_format_disabled(self, mock_create_importer):
        """Test validating a format when feature is disabled."""
        mock_create_importer.side_effect = ValueError("Disabled")

        result = DataTransferFactory.validate_format("csv")

        assert result is False


@pytest.mark.unit
class TestConvenienceFunctions:
    """Test convenience functions."""

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_importer")
    def test_create_importer(self, mock_factory_method):
        """Test create_importer convenience function."""
        mock_factory_method.return_value = Mock()

        result = create_importer("csv", batch_size=500)

        mock_factory_method.assert_called_once_with("csv", batch_size=500)
        assert result == mock_factory_method.return_value

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_exporter")
    def test_create_exporter(self, mock_factory_method):
        """Test create_exporter convenience function."""
        mock_factory_method.return_value = Mock()

        result = create_exporter("json", indent=4)

        mock_factory_method.assert_called_once_with("json", indent=4)
        assert result == mock_factory_method.return_value

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.detect_format")
    def test_detect_format_function(self, mock_factory_method):
        """Test detect_format convenience function."""
        mock_factory_method.return_value = DataFormat.CSV

        result = detect_format("file.csv")

        mock_factory_method.assert_called_once_with("file.csv")
        assert result == DataFormat.CSV

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_importer")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_create_excel_importer(self, mock_dep_checker, mock_factory_method):
        """Test create_excel_importer with decorator."""
        # The decorator should check dependencies first
        mock_factory_method.return_value = Mock()

        result = create_excel_importer(sheet_name="Data")

        mock_factory_method.assert_called_once_with(DataFormat.EXCEL, sheet_name="Data")
        assert result == mock_factory_method.return_value

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_exporter")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_create_excel_exporter(self, mock_dep_checker, mock_factory_method):
        """Test create_excel_exporter with decorator."""
        mock_factory_method.return_value = Mock()

        result = create_excel_exporter(freeze_panes="A2")

        mock_factory_method.assert_called_once_with(DataFormat.EXCEL, freeze_panes="A2")
        assert result == mock_factory_method.return_value

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_importer")
    def test_create_csv_importer(self, mock_factory_method):
        """Test create_csv_importer."""
        mock_factory_method.return_value = Mock()

        result = create_csv_importer(delimiter=";")

        mock_factory_method.assert_called_once_with(DataFormat.CSV, delimiter=";")
        assert result == mock_factory_method.return_value

    @patch("dotmac.platform.data_transfer.factory.DataTransferFactory.create_exporter")
    def test_create_csv_exporter(self, mock_factory_method):
        """Test create_csv_exporter."""
        mock_factory_method.return_value = Mock()

        result = create_csv_exporter(include_headers=False)

        mock_factory_method.assert_called_once_with(DataFormat.CSV, include_headers=False)
        assert result == mock_factory_method.return_value


@pytest.mark.unit
class TestOptionalFormatRegistration:
    """Test optional format registration."""

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_register_optional_formats_excel_enabled(self, mock_dep_checker, mock_settings):
        """Test registering Excel formats when enabled and dependencies available."""
        mock_settings.features.data_transfer_excel = True
        mock_dep_checker.check_feature_dependency.return_value = True

        # Import the module to trigger registration
        from dotmac.platform.data_transfer import factory

        # Excel format should be available in the registry
        formats = factory._registry.list_available_formats()
        assert DataFormat.EXCEL in formats["importers"]
        assert DataFormat.EXCEL in formats["exporters"]

    @patch("dotmac.platform.data_transfer.factory.settings")
    @patch("dotmac.platform.data_transfer.factory.DependencyChecker")
    def test_register_optional_formats_excel_disabled(self, mock_dep_checker, mock_settings):
        """Test not registering Excel when disabled."""
        mock_settings.features.data_transfer_excel = False

        # Create a new registry to test
        registry = DataTransferRegistry()

        # Excel should not be in core formats
        registry.list_available_formats()
        # Note: Excel might be registered from module-level code, but won't be enabled
        enabled = registry.list_enabled_formats()
        assert DataFormat.EXCEL not in enabled["importers"]
        assert DataFormat.EXCEL not in enabled["exporters"]

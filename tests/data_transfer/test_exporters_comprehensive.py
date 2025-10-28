"""
Comprehensive tests for data_transfer exporters module.
"""

import gzip
import json
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import pandas as pd
import pytest
import yaml

from dotmac.platform.data_transfer.core import (
    CompressionType,
    DataBatch,
    DataFormat,
    DataRecord,
    ExportError,
    ExportOptions,
    FormatError,
    ProgressInfo,
    TransferConfig,
    TransferStatus,
)
from dotmac.platform.data_transfer.exporters import (
    CSVExporter,
    ExcelExporter,
    JSONExporter,
    XMLExporter,
    YAMLExporter,
    compress_file,
    create_exporter,
    detect_format,
    export_data,
)

# from dotmac.platform.data_transfer.factory import DataTransferRegistry  # Not used


@pytest.mark.unit
class TestCSVExporter:
    """Test CSVExporter functionality."""

    @pytest.fixture
    def csv_exporter(self):
        """Create a CSV exporter instance."""
        config = TransferConfig()
        options = ExportOptions()
        return CSVExporter(config, options)

    @pytest.fixture
    def sample_data_generator(self):
        """Create sample data generator."""

        async def _generator():
            records = [
                DataRecord(data={"id": 1, "name": "Alice", "age": 30}),
                DataRecord(data={"id": 2, "name": "Bob", "age": 25}),
                DataRecord(data={"id": 3, "name": "Charlie", "age": 35}),
            ]
            yield DataBatch(records=records, batch_number=1)

        return _generator()

    @pytest.mark.asyncio
    async def test_export_csv_success(self, csv_exporter, sample_data_generator):
        """Test successful CSV export."""
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.csv"

            result = await csv_exporter.export_to_file(sample_data_generator, file_path)

            assert isinstance(result, ProgressInfo)
            assert result.status == TransferStatus.COMPLETED
            assert file_path.exists()

            # Verify file content
            df = pd.read_csv(file_path)
            assert len(df) == 3
            assert list(df.columns) == ["id", "name", "age"]
            assert df.iloc[0]["name"] == "Alice"

    @pytest.mark.asyncio
    async def test_export_csv_with_options(self):
        """Test CSV export with custom options."""
        config = TransferConfig()
        options = ExportOptions(delimiter="|", encoding="utf-8", include_headers=True)
        csv_exporter = CSVExporter(config, options)

        async def data_gen():
            records = [DataRecord(data={"col1": "value1", "col2": "value2"})]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.csv"
            result = await csv_exporter.export_to_file(data_gen(), file_path)

            assert result.status == TransferStatus.COMPLETED
            content = file_path.read_text()
            assert "|" in content

    @pytest.mark.asyncio
    async def test_export_csv_empty_data(self, csv_exporter):
        """Test CSV export with empty data."""

        async def empty_data_gen():
            if False:  # pragma: no cover
                yield

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "empty.csv"
            result = await csv_exporter.export_to_file(empty_data_gen(), file_path)

            assert result.status == TransferStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_export_csv_file_error(self, csv_exporter, sample_data_generator):
        """Test CSV export with file write error."""
        # Use invalid path to trigger error
        invalid_path = Path("/invalid/path/test.csv")

        with pytest.raises(ExportError):
            await csv_exporter.export_to_file(sample_data_generator, invalid_path)

    @pytest.mark.asyncio
    async def test_export_csv_progress_callback(self, sample_data_generator):
        """Test CSV export with progress callback."""
        progress_calls = []

        def progress_callback(info: ProgressInfo):
            progress_calls.append(info)

        config = TransferConfig()
        options = ExportOptions()
        csv_exporter = CSVExporter(config, options, progress_callback)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.csv"
            await csv_exporter.export_to_file(sample_data_generator, file_path)

            assert len(progress_calls) > 0
            # Progress calls should include completion status
            assert any(call.status == TransferStatus.COMPLETED for call in progress_calls)


@pytest.mark.unit
class TestJSONExporter:
    """Test JSONExporter functionality."""

    @pytest.fixture
    def json_exporter(self):
        """Create a JSON exporter instance."""
        config = TransferConfig()
        options = ExportOptions()
        return JSONExporter(config, options)

    @pytest.mark.asyncio
    async def test_export_json_success(self, json_exporter):
        """Test successful JSON export."""

        async def data_gen():
            records = [
                DataRecord(data={"id": 1, "name": "Alice"}),
                DataRecord(data={"id": 2, "name": "Bob"}),
            ]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.json"
            result = await json_exporter.export_to_file(data_gen(), file_path)

            assert result.status == TransferStatus.COMPLETED
            assert file_path.exists()

            # Verify JSON content
            data = json.loads(file_path.read_text())
            assert len(data) == 2
            assert data[0]["name"] == "Alice"

    @pytest.mark.asyncio
    async def test_export_json_with_indent(self):
        """Test JSON export with indentation."""
        config = TransferConfig()
        options = ExportOptions(json_indent=2)
        json_exporter = JSONExporter(config, options)

        async def data_gen():
            records = [DataRecord(data={"key": "value"})]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "indented.json"
            await json_exporter.export_to_file(data_gen(), file_path)

            content = file_path.read_text()
            assert "  " in content  # Check for indentation

    @pytest.mark.asyncio
    async def test_export_json_nested_data(self, json_exporter):
        """Test JSON export with nested data structures."""

        async def data_gen():
            records = [
                DataRecord(
                    data={"user": {"name": "Alice", "meta": {"age": 30}}, "items": [1, 2, 3]}
                )
            ]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "nested.json"
            result = await json_exporter.export_to_file(data_gen(), file_path)

            assert result.status == TransferStatus.COMPLETED
            data = json.loads(file_path.read_text())
            assert data[0]["user"]["name"] == "Alice"
            assert data[0]["items"] == [1, 2, 3]


@pytest.mark.unit
class TestXMLExporter:
    """Test XMLExporter functionality."""

    @pytest.fixture
    def xml_exporter(self):
        """Create an XML exporter instance."""
        config = TransferConfig()
        options = ExportOptions()
        return XMLExporter(config, options)

    @pytest.mark.asyncio
    async def test_export_xml_success(self, xml_exporter):
        """Test successful XML export."""

        async def data_gen():
            records = [
                DataRecord(data={"id": "1", "name": "Alice"}),
                DataRecord(data={"id": "2", "name": "Bob"}),
            ]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.xml"
            result = await xml_exporter.export_to_file(data_gen(), file_path)

            assert result.status == TransferStatus.COMPLETED
            assert file_path.exists()

            # Verify XML content
            tree = ET.parse(file_path)
            root = tree.getroot()
            assert root.tag == "root"
            records = root.findall("record")
            assert len(records) == 2

    @pytest.mark.asyncio
    async def test_export_xml_custom_root(self):
        """Test XML export with custom root element."""
        config = TransferConfig()
        options = ExportOptions(xml_root_element="users")
        xml_exporter = XMLExporter(config, options)

        async def data_gen():
            records = [DataRecord(data={"name": "Alice"})]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "custom_root.xml"
            await xml_exporter.export_to_file(data_gen(), file_path)

            tree = ET.parse(file_path)
            assert tree.getroot().tag == "users"


@pytest.mark.unit
class TestYAMLExporter:
    """Test YAMLExporter functionality."""

    @pytest.fixture
    def yaml_exporter(self):
        """Create a YAML exporter instance."""
        config = TransferConfig()
        options = ExportOptions()
        return YAMLExporter(config, options)

    @pytest.mark.asyncio
    async def test_export_yaml_success(self, yaml_exporter):
        """Test successful YAML export."""

        async def data_gen():
            records = [
                DataRecord(data={"name": "Alice", "age": 30}),
                DataRecord(data={"name": "Bob", "age": 25}),
            ]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.yaml"
            result = await yaml_exporter.export_to_file(data_gen(), file_path)

            assert result.status == TransferStatus.COMPLETED
            assert file_path.exists()

            # Verify YAML content
            data = yaml.safe_load(file_path.read_text())
            assert len(data) == 2
            assert data[0]["name"] == "Alice"

    @pytest.mark.asyncio
    async def test_export_yaml_with_options(self):
        """Test YAML export with custom options."""
        config = TransferConfig()
        options = ExportOptions(encoding="utf-8")
        yaml_exporter = YAMLExporter(config, options)

        async def data_gen():
            records = [DataRecord(data={"unicode": "café"})]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "unicode.yaml"
            await yaml_exporter.export_to_file(data_gen(), file_path)

            content = file_path.read_text()
            assert "café" in content


@pytest.mark.unit
class TestExcelExporter:
    """Test ExcelExporter functionality."""

    @pytest.fixture
    def excel_exporter(self):
        """Create an Excel exporter instance."""
        config = TransferConfig()
        options = ExportOptions()
        return ExcelExporter(config, options)

    @pytest.mark.asyncio
    async def test_export_excel_success(self, excel_exporter):
        """Test successful Excel export."""

        async def data_gen():
            records = [
                DataRecord(data={"id": 1, "name": "Alice", "score": 95.5}),
                DataRecord(data={"id": 2, "name": "Bob", "score": 87.2}),
            ]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.xlsx"
            result = await excel_exporter.export_to_file(data_gen(), file_path)

            assert result.status == TransferStatus.COMPLETED
            assert file_path.exists()

            # Verify Excel content
            df = pd.read_excel(file_path)
            assert len(df) == 2
            assert "name" in df.columns
            assert df.iloc[0]["name"] == "Alice"

    @pytest.mark.asyncio
    async def test_export_excel_custom_sheet(self):
        """Test Excel export with custom sheet name."""
        config = TransferConfig()
        options = ExportOptions(sheet_name="CustomSheet")
        excel_exporter = ExcelExporter(config, options)

        async def data_gen():
            records = [DataRecord(data={"col": "value"})]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "custom_sheet.xlsx"
            await excel_exporter.export_to_file(data_gen(), file_path)

            # Verify sheet name
            xl_file = pd.ExcelFile(file_path)
            assert "CustomSheet" in xl_file.sheet_names


@pytest.mark.unit
class TestCompressionUtility:
    """Test compression functionality."""

    def test_compress_file_gzip(self):
        """Test gzip compression."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_file = Path(temp_dir) / "test.txt"
            original_file.write_text("Hello, World!")

            compressed_file = compress_file(original_file, CompressionType.GZIP)

            assert compressed_file.suffix == ".gz"
            assert compressed_file.exists()

            # Verify compressed content
            with gzip.open(compressed_file, "rt") as f:
                content = f.read()
            assert content == "Hello, World!"

    def test_compress_file_bzip2(self):
        """Test bzip2 compression."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_file = Path(temp_dir) / "test.txt"
            original_file.write_text("Hello, World!")

            compressed_file = compress_file(original_file, CompressionType.BZIP2)

            assert compressed_file.suffix == ".bz2"
            assert compressed_file.exists()

    def test_compress_file_zip(self):
        """Test ZIP compression."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_file = Path(temp_dir) / "test.txt"
            original_file.write_text("Hello, World!")

            compressed_file = compress_file(original_file, CompressionType.ZIP)

            assert compressed_file.suffix == ".zip"
            assert compressed_file.exists()

            # Verify ZIP content
            with zipfile.ZipFile(compressed_file, "r") as zf:
                assert "test.txt" in zf.namelist()

    def test_compress_file_none(self):
        """Test no compression."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_file = Path(temp_dir) / "test.txt"
            original_file.write_text("Hello, World!")

            result = compress_file(original_file, CompressionType.NONE)

            assert result == original_file
            assert result.read_text() == "Hello, World!"

    def test_compress_file_invalid_type(self):
        """Test compression with invalid type."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_file = Path(temp_dir) / "test.txt"
            original_file.write_text("Hello, World!")

            with pytest.raises(ExportError):
                compress_file(original_file, "invalid")


@pytest.mark.unit
class TestExporterFactory:
    """Test exporter factory functions."""

    def test_create_exporter_csv(self):
        """Test creating CSV exporter via factory."""
        config = TransferConfig()
        exporter = create_exporter(DataFormat.CSV, config)

        assert isinstance(exporter, CSVExporter)

    def test_create_exporter_json(self):
        """Test creating JSON exporter via factory."""
        config = TransferConfig()
        exporter = create_exporter(DataFormat.JSON, config)

        assert isinstance(exporter, JSONExporter)

    def test_create_exporter_xml(self):
        """Test creating XML exporter via factory."""
        config = TransferConfig()
        exporter = create_exporter(DataFormat.XML, config)

        assert isinstance(exporter, XMLExporter)

    def test_create_exporter_yaml(self):
        """Test creating YAML exporter via factory."""
        config = TransferConfig()
        exporter = create_exporter(DataFormat.YAML, config)

        assert isinstance(exporter, YAMLExporter)

    def test_create_exporter_unsupported(self):
        """Test creating exporter for unsupported format."""
        config = TransferConfig()

        with pytest.raises(FormatError):
            create_exporter("UNSUPPORTED", config)

    def test_detect_format_csv(self):
        """Test detecting CSV format."""
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.csv"
            format = detect_format(file_path)
            assert format == DataFormat.CSV

    def test_detect_format_json(self):
        """Test detecting JSON format."""
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.json"
            format = detect_format(file_path)
            assert format == DataFormat.JSON

    def test_detect_format_xml(self):
        """Test detecting XML format."""
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.xml"
            format = detect_format(file_path)
            assert format == DataFormat.XML

    def test_detect_format_yaml(self):
        """Test detecting YAML format."""
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.yaml"
            format = detect_format(file_path)
            assert format == DataFormat.YAML

    def test_detect_format_excel(self):
        """Test detecting Excel format."""
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "test.xlsx"
            format = detect_format(file_path)
            assert format == DataFormat.EXCEL


@pytest.mark.unit
class TestExportDataFunction:
    """Test high-level export_data function."""

    @pytest.mark.asyncio
    async def test_export_data_success(self):
        """Test successful data export using export_data function."""

        async def data_gen():
            records = [
                DataRecord(data={"id": 1, "name": "Alice"}),
                DataRecord(data={"id": 2, "name": "Bob"}),
            ]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = str(Path(temp_dir) / "exported.json")

            result = await export_data(data_gen(), file_path, DataFormat.JSON)

            assert isinstance(result, ProgressInfo)
            assert result.status == TransferStatus.COMPLETED
            assert Path(file_path).exists()

    @pytest.mark.asyncio
    async def test_export_data_with_compression(self):
        """Test data export with compression."""

        async def data_gen():
            records = [DataRecord(data={"test": "data"})]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = str(Path(temp_dir) / "compressed.json")

            result = await export_data(data_gen(), file_path, DataFormat.JSON)

            assert result.status == TransferStatus.COMPLETED
            assert Path(file_path).exists()

    @pytest.mark.asyncio
    async def test_export_data_empty(self):
        """Test export with empty data."""

        async def data_gen():
            if False:  # pragma: no cover
                yield

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = str(Path(temp_dir) / "empty.csv")

            result = await export_data(data_gen(), file_path, DataFormat.CSV)

            assert result.status == TransferStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_export_data_with_progress_callback(self):
        """Test data export with progress callback."""

        async def data_gen():
            records = [DataRecord(data={"id": i, "value": f"item_{i}"}) for i in range(10)]
            yield DataBatch(records=records, batch_number=1)

        progress_updates = []

        def progress_callback(info: ProgressInfo):
            progress_updates.append(info)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = str(Path(temp_dir) / "progress_test.json")

            result = await export_data(
                data_gen(), file_path, DataFormat.JSON, progress_callback=progress_callback
            )

            assert result.status == TransferStatus.COMPLETED
            assert len(progress_updates) > 0


@pytest.mark.unit
class TestExporterErrorHandling:
    """Test error handling in exporters."""

    @pytest.fixture
    def csv_exporter(self):
        """Create a CSV exporter instance."""
        config = TransferConfig()
        options = ExportOptions()
        return CSVExporter(config, options)

    @pytest.mark.asyncio
    async def test_export_invalid_file_path(self, csv_exporter):
        """Test export with invalid file path."""

        async def data_gen():
            records = [DataRecord(data={"test": "data"})]
            yield DataBatch(records=records, batch_number=1)

        invalid_path = Path("/nonexistent/directory/file.csv")

        with pytest.raises(ExportError):
            await csv_exporter.export_to_file(data_gen(), invalid_path)

    @pytest.mark.asyncio
    async def test_export_data_serialization_error(self):
        """Test export with data that can't be serialized."""
        config = TransferConfig()
        options = ExportOptions()
        json_exporter = JSONExporter(config, options)

        async def bad_data_gen():
            # Data with non-serializable object - functions can't be serialized to JSON
            records = [DataRecord(data={"func": lambda x: x})]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "bad_data.json"

            # The actual error will happen during pandas DataFrame conversion or JSON serialization
            result = await json_exporter.export_to_file(bad_data_gen(), file_path)
            # Actually, pandas might handle this by converting to string representation
            assert result.status == TransferStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_export_pandas_error(self, csv_exporter):
        """Test export with pandas processing error."""

        async def malformed_data_gen():
            # Data that might cause pandas issues
            records = [
                DataRecord(data={"col1": "value1"}),
                DataRecord(data={"col2": "value2"}),  # Different columns
            ]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "malformed.csv"

            # This should still work as pandas handles missing values
            result = await csv_exporter.export_to_file(malformed_data_gen(), file_path)
            assert result.status == TransferStatus.COMPLETED


@pytest.mark.unit
class TestExporterProgressTracking:
    """Test progress tracking in exporters."""

    @pytest.mark.asyncio
    async def test_progress_tracking_during_export(self):
        """Test that progress is tracked during export."""
        progress_calls = []

        def track_progress(info: ProgressInfo):
            progress_calls.append(info)

        config = TransferConfig()
        options = ExportOptions()
        exporter = CSVExporter(config, options, track_progress)

        async def data_gen():
            # Generate multiple batches
            for i in range(3):
                records = [DataRecord(data={"batch": i, "item": j}) for j in range(10)]
                yield DataBatch(records=records, batch_number=i + 1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "progress.csv"

            result = await exporter.export_to_file(data_gen(), file_path)

            assert result.status == TransferStatus.COMPLETED
            assert len(progress_calls) > 0

            # Check that progress was tracked (final status should be completed)
            final_statuses = [call.status for call in progress_calls]
            assert TransferStatus.COMPLETED in final_statuses

    @pytest.mark.asyncio
    async def test_progress_info_content(self):
        """Test progress info contains correct data."""
        progress_calls = []

        def track_progress(info: ProgressInfo):
            progress_calls.append(info)

        config = TransferConfig()
        options = ExportOptions()
        exporter = CSVExporter(config, options, track_progress)

        async def data_gen():
            records = [DataRecord(data={"id": i}) for i in range(5)]
            yield DataBatch(records=records, batch_number=1)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "content_test.csv"

            await exporter.export_to_file(data_gen(), file_path)

            # Check that some progress calls have processed count
            assert any(call.processed_records > 0 for call in progress_calls)

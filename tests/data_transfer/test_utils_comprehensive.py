"""
Comprehensive tests for data transfer utility functions.

Tests all utility functions including:
- Operation ID generation
- File size formatting
- Throughput calculation
- Completion time estimation
- Batch creation
- Configuration creation
- Options creation
- Data pipeline functionality
- File conversion utilities
- Validation and cleaning utilities
"""

from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from dotmac.platform.data_transfer.core import (
    DataFormat,
    DataRecord,
    ProgressInfo,
    TransferConfig,
    TransferStatus,
)
from dotmac.platform.data_transfer.exporters import ExportOptions
from dotmac.platform.data_transfer.importers import ImportOptions
from dotmac.platform.data_transfer.utils import (
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


@pytest.mark.unit
class TestOperationIDGeneration:
    """Test operation ID generation utility."""

    def test_create_operation_id_generates_uuid(self):
        """Test that create_operation_id generates a valid UUID."""
        operation_id = create_operation_id()

        # Should be a valid UUID string
        uuid_obj = UUID(operation_id)
        assert str(uuid_obj) == operation_id
        assert len(operation_id) == 36  # Standard UUID length

    def test_create_operation_id_unique(self):
        """Test that create_operation_id generates unique IDs."""
        id1 = create_operation_id()
        id2 = create_operation_id()

        assert id1 != id2


@pytest.mark.unit
class TestFileSizeFormatting:
    """Test file size formatting utility."""

    def test_format_file_size_bytes(self):
        """Test formatting bytes."""
        assert format_file_size(512) == "512.00 B"
        assert format_file_size(0) == "0.00 B"

    def test_format_file_size_kilobytes(self):
        """Test formatting kilobytes."""
        assert format_file_size(1024) == "1.00 KB"
        assert format_file_size(1536) == "1.50 KB"

    def test_format_file_size_megabytes(self):
        """Test formatting megabytes."""
        assert format_file_size(1024 * 1024) == "1.00 MB"
        assert format_file_size(1024 * 1024 * 2.5) == "2.50 MB"

    def test_format_file_size_gigabytes(self):
        """Test formatting gigabytes."""
        assert format_file_size(1024 * 1024 * 1024) == "1.00 GB"

    def test_format_file_size_terabytes(self):
        """Test formatting terabytes."""
        assert format_file_size(1024 * 1024 * 1024 * 1024) == "1.00 TB"

    def test_format_file_size_petabytes(self):
        """Test formatting petabytes."""
        size = 1024 * 1024 * 1024 * 1024 * 1024
        assert format_file_size(size) == "1.00 PB"


@pytest.mark.unit
class TestThroughputCalculation:
    """Test throughput calculation utility."""

    def test_calculate_throughput_normal(self):
        """Test normal throughput calculation."""
        throughput = calculate_throughput(1000, 10.0)
        assert throughput == 100.0

    def test_calculate_throughput_zero_time(self):
        """Test throughput calculation with zero elapsed time."""
        throughput = calculate_throughput(1000, 0.0)
        assert throughput == 0.0

    def test_calculate_throughput_negative_time(self):
        """Test throughput calculation with negative elapsed time."""
        throughput = calculate_throughput(1000, -5.0)
        assert throughput == 0.0

    def test_calculate_throughput_zero_bytes(self):
        """Test throughput calculation with zero bytes processed."""
        throughput = calculate_throughput(0, 10.0)
        assert throughput == 0.0


@pytest.mark.unit
class TestCompletionTimeEstimation:
    """Test completion time estimation utility."""

    @patch("dotmac.platform.data_transfer.utils.datetime")
    def test_estimate_completion_time_normal(self, mock_datetime):
        """Test normal completion time estimation."""
        mock_now = datetime(2023, 1, 1, 12, 0, 0)
        mock_datetime.now.return_value = mock_now

        # 50% complete, 100 seconds elapsed -> 100 more seconds needed
        result = estimate_completion_time(50, 100, 100.0)

        expected = mock_now + timedelta(seconds=100.0)
        assert result == expected

    def test_estimate_completion_time_zero_processed(self):
        """Test estimation with zero processed items."""
        result = estimate_completion_time(0, 100, 100.0)
        assert result is None

    def test_estimate_completion_time_zero_total(self):
        """Test estimation with zero total items."""
        result = estimate_completion_time(50, 0, 100.0)
        assert result is None

    def test_estimate_completion_time_zero_elapsed(self):
        """Test estimation with zero elapsed time."""
        result = estimate_completion_time(50, 100, 0.0)
        assert result is None

    def test_estimate_completion_time_negative_values(self):
        """Test estimation with negative values."""
        result = estimate_completion_time(-10, 100, 100.0)
        assert result is None


@pytest.mark.unit
class TestBatchCreation:
    """Test batch creation utility."""

    @pytest.mark.asyncio
    async def test_create_batches_normal(self):
        """Test normal batch creation."""
        data = [{"id": i, "value": f"item_{i}"} for i in range(5)]
        batches = []

        async for batch in create_batches(data, batch_size=2):
            batches.append(batch)

        assert len(batches) == 3  # 2, 2, 1
        assert batches[0].batch_number == 0
        assert len(batches[0].records) == 2
        assert batches[0].records[0].data == {"id": 0, "value": "item_0"}

        assert batches[1].batch_number == 1
        assert len(batches[1].records) == 2

        assert batches[2].batch_number == 2
        assert len(batches[2].records) == 1

    @pytest.mark.asyncio
    async def test_create_batches_empty_data(self):
        """Test batch creation with empty data."""
        data = []
        batches = []

        async for batch in create_batches(data, batch_size=10):
            batches.append(batch)

        assert len(batches) == 0

    @pytest.mark.asyncio
    async def test_create_batches_single_batch(self):
        """Test batch creation when all data fits in one batch."""
        data = [{"id": i} for i in range(3)]
        batches = []

        async for batch in create_batches(data, batch_size=10):
            batches.append(batch)

        assert len(batches) == 1
        assert batches[0].batch_number == 0
        assert len(batches[0].records) == 3


@pytest.mark.unit
class TestTransferConfigCreation:
    """Test transfer configuration creation utility."""

    def test_create_transfer_config_defaults(self):
        """Test creating transfer config with defaults."""
        config = create_transfer_config()

        assert config.batch_size == 1000
        assert config.max_workers == 4
        assert config.chunk_size == 8192
        assert config.encoding == "utf-8"
        assert config.validate_data is True
        assert config.skip_invalid is False
        assert config.resume_on_failure is True

    def test_create_transfer_config_custom(self):
        """Test creating transfer config with custom values."""
        config = create_transfer_config(
            batch_size=500,
            max_workers=8,
            chunk_size=4096,
            encoding="utf-16",
            validate_data=False,
            skip_invalid=True,
            resume_on_failure=False,
        )

        assert config.batch_size == 500
        assert config.max_workers == 8
        assert config.chunk_size == 4096
        assert config.encoding == "utf-16"
        assert config.validate_data is False
        assert config.skip_invalid is True
        assert config.resume_on_failure is False

    def test_create_transfer_config_kwargs(self):
        """Test creating transfer config with additional kwargs."""
        config = create_transfer_config(
            batch_size=200,
            retry_attempts=5,
            timeout=30,
        )

        assert config.batch_size == 200
        assert config.retry_attempts == 5
        assert config.timeout == 30


@pytest.mark.unit
class TestImportOptionsCreation:
    """Test import options creation utility."""

    def test_create_import_options_csv(self):
        """Test creating import options for CSV format."""
        options = create_import_options(DataFormat.CSV)

        assert options.delimiter == ","
        assert options.header_row == 0
        assert options.type_inference is True

    def test_create_import_options_json(self):
        """Test creating import options for JSON format."""
        options = create_import_options(DataFormat.JSON)

        assert options.type_inference is True

    def test_create_import_options_jsonl(self):
        """Test creating import options for JSONL format."""
        options = create_import_options(DataFormat.JSONL)

        assert options.json_lines is True
        assert options.type_inference is True

    def test_create_import_options_excel(self):
        """Test creating import options for Excel format."""
        options = create_import_options(DataFormat.EXCEL)

        assert options.sheet_name is None
        assert options.skip_rows == 0
        assert options.type_inference is True

    def test_create_import_options_xml(self):
        """Test creating import options for XML format."""
        options = create_import_options(DataFormat.XML)

        assert options.xml_record_element is None

    def test_create_import_options_custom(self):
        """Test creating import options with custom values."""
        options = create_import_options(
            DataFormat.CSV,
            delimiter=";",
            header_row=1,
            encoding="utf-16",
        )

        assert options.delimiter == ";"
        assert options.header_row == 1
        assert options.encoding == "utf-16"

    def test_create_import_options_unknown_format(self):
        """Test creating import options for unknown format."""
        options = create_import_options(DataFormat.PARQUET)

        # Should have default values
        assert hasattr(options, "encoding")


@pytest.mark.unit
class TestExportOptionsCreation:
    """Test export options creation utility."""

    def test_create_export_options_csv(self):
        """Test creating export options for CSV format."""
        options = create_export_options(DataFormat.CSV)

        assert options.delimiter == ","
        assert options.include_headers is True
        assert options.quoting == 1

    def test_create_export_options_json(self):
        """Test creating export options for JSON format."""
        options = create_export_options(DataFormat.JSON)

        assert options.json_indent == 2
        assert options.json_ensure_ascii is False
        assert options.json_sort_keys is False

    def test_create_export_options_jsonl(self):
        """Test creating export options for JSONL format."""
        options = create_export_options(DataFormat.JSONL)

        assert options.json_lines is True
        assert options.json_ensure_ascii is False

    def test_create_export_options_excel(self):
        """Test creating export options for Excel format."""
        options = create_export_options(DataFormat.EXCEL)

        assert options.sheet_name == "Data"
        assert options.auto_filter is True
        assert options.freeze_panes == "A2"

    def test_create_export_options_xml(self):
        """Test creating export options for XML format."""
        options = create_export_options(DataFormat.XML)

        assert options.xml_root_element == "root"
        assert options.xml_record_element == "record"
        assert options.xml_pretty_print is True

    def test_create_export_options_yaml(self):
        """Test creating export options for YAML format."""
        options = create_export_options(DataFormat.YAML)

        assert options.json_sort_keys is False

    def test_create_export_options_custom(self):
        """Test creating export options with custom values."""
        options = create_export_options(
            DataFormat.CSV,
            delimiter=";",
            include_headers=False,
            encoding="utf-16",
        )

        assert options.delimiter == ";"
        assert options.include_headers is False
        assert options.encoding == "utf-16"


@pytest.mark.unit
class TestDataPipeline:
    """Test DataPipeline class."""

    @pytest.fixture
    def sample_config(self):
        """Sample transfer config."""
        return create_transfer_config(batch_size=100)

    @pytest.fixture
    def sample_import_options(self):
        """Sample import options."""
        return create_import_options(DataFormat.CSV)

    @pytest.fixture
    def sample_export_options(self):
        """Sample export options."""
        return create_export_options(DataFormat.JSON)

    def test_data_pipeline_initialization(
        self, sample_config, sample_import_options, sample_export_options
    ):
        """Test DataPipeline initialization."""
        source_path = Path("/source/file.csv")
        target_path = Path("/target/file.json")

        pipeline = DataPipeline(
            source_path=source_path,
            target_path=target_path,
            source_format=DataFormat.CSV,
            target_format=DataFormat.JSON,
            config=sample_config,
            import_options=sample_import_options,
            export_options=sample_export_options,
        )

        assert pipeline.source_path == source_path
        assert pipeline.target_path == target_path
        assert pipeline.source_format == DataFormat.CSV
        assert pipeline.target_format == DataFormat.JSON
        assert pipeline.config == sample_config
        assert pipeline.import_options == sample_import_options
        assert pipeline.export_options == sample_export_options
        assert pipeline.validator is None
        assert pipeline.transformer is None

        # Should have generated an operation ID
        UUID(pipeline.operation_id)  # Should not raise

    def test_data_pipeline_progress_callbacks(
        self, sample_config, sample_import_options, sample_export_options
    ):
        """Test DataPipeline progress callback methods."""
        pipeline = DataPipeline(
            source_path=Path("/source/file.csv"),
            target_path=Path("/target/file.json"),
            source_format=DataFormat.CSV,
            target_format=DataFormat.JSON,
            config=sample_config,
            import_options=sample_import_options,
            export_options=sample_export_options,
        )

        # Test import progress callback
        import_progress = ProgressInfo(processed_records=100, current_batch=5)
        pipeline._on_import_progress(import_progress)

        assert pipeline.progress_tracker._progress.processed_records == 100
        assert pipeline.progress_tracker._progress.current_batch == 5

        # Test export progress callback
        export_progress = ProgressInfo(processed_records=200, current_batch=10)
        pipeline._on_export_progress(export_progress)

        assert pipeline.progress_tracker._progress.processed_records == 200
        assert pipeline.progress_tracker._progress.current_batch == 10


@pytest.mark.unit
class TestDataPipelineCreation:
    """Test data pipeline creation utility."""

    @patch("dotmac.platform.data_transfer.utils.detect_format")
    def test_create_data_pipeline_auto_detect_source(self, mock_detect_format):
        """Test creating pipeline with auto-detected source format."""
        mock_detect_format.return_value = DataFormat.CSV

        pipeline = create_data_pipeline(
            source_path="/source/file.csv",
            target_path="/target/file.json",
        )

        assert pipeline.source_format == DataFormat.CSV
        assert pipeline.target_format == DataFormat.JSON  # Detected from extension
        mock_detect_format.assert_called_once()

    def test_create_data_pipeline_infer_target_format(self):
        """Test creating pipeline with inferred target format."""
        pipeline = create_data_pipeline(
            source_path="/source/file.csv",
            target_path="/target/file.xlsx",
            source_format=DataFormat.CSV,
        )

        assert pipeline.source_format == DataFormat.CSV
        assert pipeline.target_format == DataFormat.EXCEL

    def test_create_data_pipeline_unknown_extension(self):
        """Test creating pipeline with unknown target extension."""
        pipeline = create_data_pipeline(
            source_path="/source/file.csv",
            target_path="/target/file.unknown",
            source_format=DataFormat.CSV,
        )

        assert pipeline.source_format == DataFormat.CSV
        assert pipeline.target_format == DataFormat.JSON  # Default

    def test_create_data_pipeline_explicit_formats(self):
        """Test creating pipeline with explicit formats."""
        pipeline = create_data_pipeline(
            source_path="/source/file.txt",
            target_path="/target/file.out",
            source_format=DataFormat.CSV,
            target_format=DataFormat.XML,
        )

        assert pipeline.source_format == DataFormat.CSV
        assert pipeline.target_format == DataFormat.XML

    def test_create_data_pipeline_with_options(self):
        """Test creating pipeline with custom options."""
        config = create_transfer_config(batch_size=500)
        import_options = create_import_options(DataFormat.CSV, delimiter=";")
        export_options = create_export_options(DataFormat.JSON, json_indent=4)

        pipeline = create_data_pipeline(
            source_path="/source/file.csv",
            target_path="/target/file.json",
            source_format=DataFormat.CSV,
            target_format=DataFormat.JSON,
            config=config,
            import_options=import_options,
            export_options=export_options,
        )

        assert pipeline.config == config
        assert pipeline.import_options == import_options
        assert pipeline.export_options == export_options


@pytest.mark.unit
class TestFileConversion:
    """Test file conversion utility."""

    @pytest.mark.asyncio
    @patch("dotmac.platform.data_transfer.utils.create_data_pipeline")
    async def test_convert_file(self, mock_create_pipeline):
        """Test file conversion utility."""
        mock_pipeline = AsyncMock()
        mock_create_pipeline.return_value = mock_pipeline

        expected_result = ProgressInfo(status=TransferStatus.COMPLETED)
        mock_pipeline.execute.return_value = expected_result

        result = await convert_file(
            source_path="/source/file.csv",
            target_path="/target/file.json",
            source_format=DataFormat.CSV,
            target_format=DataFormat.JSON,
            batch_size=500,
        )

        assert result == expected_result
        mock_create_pipeline.assert_called_once()
        mock_pipeline.execute.assert_called_once()

    @pytest.mark.asyncio
    @patch("dotmac.platform.data_transfer.utils.create_data_pipeline")
    async def test_convert_file_with_callback(self, mock_create_pipeline):
        """Test file conversion with progress callback."""
        mock_pipeline = AsyncMock()
        mock_create_pipeline.return_value = mock_pipeline

        progress_callback = MagicMock()

        await convert_file(
            source_path="/source/file.csv",
            target_path="/target/file.json",
            progress_callback=progress_callback,
        )

        # Verify pipeline was created with callback
        mock_create_pipeline.assert_called_once()
        call_args = mock_create_pipeline.call_args
        assert call_args.kwargs["progress_callback"] == progress_callback


@pytest.mark.unit
class TestFileValidationAndCleaning:
    """Test file validation and cleaning utility."""

    @pytest.mark.asyncio
    @patch("dotmac.platform.data_transfer.utils.create_data_pipeline")
    async def test_validate_and_clean_file(self, mock_create_pipeline):
        """Test file validation and cleaning utility."""
        mock_pipeline = AsyncMock()
        mock_create_pipeline.return_value = mock_pipeline

        validator = MagicMock()
        transformer = MagicMock()

        expected_result = ProgressInfo(status=TransferStatus.COMPLETED)
        mock_pipeline.execute.return_value = expected_result

        result = await validate_and_clean_file(
            source_path="/source/file.csv",
            target_path="/target/file_clean.csv",
            validator=validator,
            transformer=transformer,
            skip_invalid=True,
        )

        assert result == expected_result
        mock_create_pipeline.assert_called_once()

        # Verify pipeline was created with validation settings
        call_args = mock_create_pipeline.call_args
        assert call_args.kwargs["validator"] == validator
        assert call_args.kwargs["transformer"] == transformer
        assert call_args.kwargs["config"].validate_data is True
        assert call_args.kwargs["config"].skip_invalid is True

    @pytest.mark.asyncio
    @patch("dotmac.platform.data_transfer.utils.create_data_pipeline")
    async def test_validate_and_clean_file_no_skip(self, mock_create_pipeline):
        """Test file validation without skipping invalid records."""
        mock_pipeline = AsyncMock()
        mock_create_pipeline.return_value = mock_pipeline

        validator = MagicMock()

        await validate_and_clean_file(
            source_path="/source/file.csv",
            target_path="/target/file_clean.csv",
            validator=validator,
            skip_invalid=False,
        )

        # Verify config has correct skip_invalid setting
        call_args = mock_create_pipeline.call_args
        assert call_args.kwargs["config"].skip_invalid is False


@pytest.mark.unit
class TestDataPipelineExecute:
    """Test DataPipeline.execute() method for coverage."""

    @pytest.mark.asyncio
    async def test_pipeline_execute_with_validator_transformer(self, tmp_path):
        """Test pipeline execute with validator and transformer."""
        import csv

        # Create source CSV file
        source_file = tmp_path / "source.csv"
        with open(source_file, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["id", "value"])
            writer.writeheader()
            writer.writerow({"id": "1", "value": "10"})
            writer.writerow({"id": "2", "value": "invalid"})
            writer.writerow({"id": "3", "value": "30"})

        target_file = tmp_path / "target.csv"

        # Validator: only accept numeric values
        def validator(record: DataRecord) -> bool:
            try:
                int(record.data.get("value", ""))
                return True
            except ValueError:
                return False

        # Transformer: double the value
        def transformer(record: DataRecord) -> DataRecord:
            record.data["value"] = str(int(record.data["value"]) * 2)
            return record

        config = TransferConfig(skip_invalid=True, validate_data=True)
        import_opts = ImportOptions()
        export_opts = ExportOptions()

        pipeline = DataPipeline(
            source_path=source_file,
            target_path=target_file,
            source_format=DataFormat.CSV,
            target_format=DataFormat.CSV,
            config=config,
            import_options=import_opts,
            export_options=export_opts,
            validator=validator,
            transformer=transformer,
        )

        result = await pipeline.execute()

        assert result.status == TransferStatus.COMPLETED
        assert target_file.exists()

        # Verify transformed data
        with open(target_file) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            # Should have 2 rows (invalid row skipped)
            assert len(rows) == 2
            assert rows[0]["value"] == "20"  # 10 * 2
            assert rows[1]["value"] == "60"  # 30 * 2

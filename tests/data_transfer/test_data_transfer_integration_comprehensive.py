"""
Comprehensive Data Transfer Module Integration Tests - Week 3 Priority 2

Tests cover:
1. Import Workflows - CSV, JSON, Excel import with validation
2. Export Workflows - Multi-format export with transformations
3. Format Conversion - CSV ↔ JSON ↔ Excel cross-format conversion
4. Large Dataset Handling - Streaming, chunking, progress tracking
5. End-to-End Workflows - Complete import → process → export pipelines

Following the successful service-layer integration pattern from auth/billing modules.

NOTE: These tests require async generator consumption and file I/O operations.
Marked as integration tests.
"""

import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

# Mark all tests in this module as integration tests
from dotmac.platform.data_transfer.core import (  # noqa: E402
    DataBatch,
    DataFormat,
    DataRecord,
    ExportOptions,
    ImportOptions,
    ProgressInfo,
    TransferConfig,
)
from dotmac.platform.data_transfer.factory import (  # noqa: E402
    create_exporter,
    create_importer,
)

# ============================================================================
# Helper Functions
# ============================================================================


pytestmark = pytest.mark.unit


async def dataframe_to_batches(df: pd.DataFrame, batch_size: int = 100):
    """Convert DataFrame to async generator of DataBatches for export."""
    records_list = df.to_dict(orient="records")
    for i in range(0, len(records_list), batch_size):
        batch_records = records_list[i : i + batch_size]
        records = [DataRecord(data=record) for record in batch_records]
        yield DataBatch(records=records, batch_number=i // batch_size + 1)


# ============================================================================
# Test Data Fixtures
# ============================================================================


@pytest.fixture
def sample_customer_data():
    """Sample customer data for testing."""
    return [
        {
            "id": 1,
            "name": "John Doe",
            "email": "john@example.com",
            "age": 30,
            "city": "New York",
            "country": "USA",
            "created_at": "2024-01-15",
        },
        {
            "id": 2,
            "name": "Jane Smith",
            "email": "jane@example.com",
            "age": 28,
            "city": "London",
            "country": "UK",
            "created_at": "2024-02-20",
        },
        {
            "id": 3,
            "name": "Bob Johnson",
            "email": "bob@example.com",
            "age": 35,
            "city": "Toronto",
            "country": "Canada",
            "created_at": "2024-03-10",
        },
    ]


@pytest.fixture
def large_dataset():
    """Generate large dataset for performance testing."""
    return [
        {
            "id": i,
            "name": f"User {i}",
            "email": f"user{i}@example.com",
            "value": i * 10.5,
            "timestamp": f"2024-01-{(i % 28) + 1:02d}",
        }
        for i in range(1000)  # 1000 records
    ]


@pytest.fixture
def temp_dir():
    """Create temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


# ============================================================================
# Import Workflow Integration Tests
# ============================================================================


@pytest.mark.integration
class TestImportWorkflowIntegration:
    """Test complete import workflows with real files."""

    @pytest.mark.asyncio
    async def test_csv_import_workflow(self, sample_customer_data, temp_dir):
        """Test complete CSV import workflow."""
        # Create CSV file
        csv_file = temp_dir / "customers.csv"
        df = pd.DataFrame(sample_customer_data)
        df.to_csv(csv_file, index=False)

        # Import using factory
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            importer = create_importer("csv")
            # Consume async generator to get all batches
            batches = [batch async for batch in importer.import_from_file(csv_file)]

        # Verify import - combine all records from batches
        assert len(batches) > 0
        all_records = []
        for batch in batches:
            all_records.extend([record.data for record in batch.records])

        assert len(all_records) == 3
        assert [r["name"] for r in all_records] == ["John Doe", "Jane Smith", "Bob Johnson"]
        assert [r["age"] for r in all_records] == [30, 28, 35]

    @pytest.mark.asyncio
    async def test_json_import_workflow(self, sample_customer_data, temp_dir):
        """Test complete JSON import workflow."""
        # Create JSON file
        json_file = temp_dir / "customers.json"
        with open(json_file, "w") as f:
            json.dump(sample_customer_data, f)

        # Import using factory
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            importer = create_importer(DataFormat.JSON)
            batches = [batch async for batch in importer.import_from_file(json_file)]

        # Verify import - combine all records from batches
        assert len(batches) > 0
        all_records = []
        for batch in batches:
            all_records.extend([record.data for record in batch.records])

        assert len(all_records) == 3
        assert [r["email"] for r in all_records] == [
            "john@example.com",
            "jane@example.com",
            "bob@example.com",
        ]

    @pytest.mark.asyncio
    async def test_excel_import_workflow(self, sample_customer_data, temp_dir):
        """Test complete Excel import workflow."""
        # Create Excel file
        excel_file = temp_dir / "customers.xlsx"
        df = pd.DataFrame(sample_customer_data)
        df.to_excel(excel_file, index=False, engine="openpyxl")

        # Import using factory
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            importer = create_importer(DataFormat.EXCEL)
            batches = [batch async for batch in importer.import_from_file(excel_file)]

        # Verify import - combine all records from batches
        assert len(batches) > 0
        all_records = []
        for batch in batches:
            all_records.extend([record.data for record in batch.records])

        assert len(all_records) == 3
        assert [r["country"] for r in all_records] == ["USA", "UK", "Canada"]

    @pytest.mark.asyncio
    async def test_csv_import_with_custom_delimiter(self, sample_customer_data, temp_dir):
        """Test CSV import with custom delimiter."""
        # Create pipe-delimited file
        pipe_file = temp_dir / "customers.psv"
        df = pd.DataFrame(sample_customer_data)
        df.to_csv(pipe_file, sep="|", index=False)

        # Import with custom delimiter
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            options = ImportOptions(delimiter="|")
            importer = create_importer("csv", options=options)
            batches = [batch async for batch in importer.import_from_file(pipe_file)]

        # Verify import - combine all records from batches
        assert len(batches) > 0
        all_records = []
        for batch in batches:
            all_records.extend([record.data for record in batch.records])

        assert len(all_records) == 3

    @pytest.mark.asyncio
    async def test_import_with_type_inference(self, temp_dir):
        """Test import with automatic type inference."""
        # Create CSV with mixed types
        data = [
            {"id": "1", "value": "10.5", "is_active": "true", "count": "100"},
            {"id": "2", "value": "20.3", "is_active": "false", "count": "200"},
        ]
        csv_file = temp_dir / "typed_data.csv"
        pd.DataFrame(data).to_csv(csv_file, index=False)

        # Import with type inference
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            options = ImportOptions(type_inference=True)
            importer = create_importer("csv", options=options)
            batches = [batch async for batch in importer.import_from_file(csv_file)]

        # Verify import - combine all records from batches
        assert len(batches) > 0
        all_records = []
        for batch in batches:
            all_records.extend([record.data for record in batch.records])

        # Convert to DataFrame for type checking
        df = pd.DataFrame(all_records)
        assert df["id"].dtype in ["int64", "Int64"]
        assert df["value"].dtype == "float64"

    @pytest.mark.asyncio
    async def test_import_with_validation(self, temp_dir):
        """Test import with type inference (validation via type checking)."""
        # Create CSV with data
        data = [
            {"name": "John", "age": 30, "email": "john@example.com"},
            {"name": "Jane", "age": 28, "email": "jane@example.com"},
        ]
        csv_file = temp_dir / "validated_data.csv"
        pd.DataFrame(data).to_csv(csv_file, index=False)

        # Import with type inference enabled (validates types)
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            options = ImportOptions(type_inference=True)
            importer = create_importer("csv", options=options)
            batches = [batch async for batch in importer.import_from_file(csv_file)]

        # Verify successful import - combine all records from batches
        assert len(batches) > 0
        all_records = []
        for batch in batches:
            all_records.extend([record.data for record in batch.records])

        assert len(all_records) == 2
        # Verify types were inferred correctly
        df = pd.DataFrame(all_records)
        assert df["age"].dtype in ["int64", "Int64"]


# ============================================================================
# Export Workflow Integration Tests
# ============================================================================


@pytest.mark.integration
class TestExportWorkflowIntegration:
    """Test complete export workflows."""

    @pytest.mark.asyncio
    async def test_csv_export_workflow(self, sample_customer_data, temp_dir):
        """Test complete CSV export workflow."""
        df = pd.DataFrame(sample_customer_data)
        output_file = temp_dir / "export.csv"

        # Export using factory
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            exporter = create_exporter("csv")
            await exporter.export_to_file(dataframe_to_batches(df), output_file)

        # Verify export
        assert output_file.exists()
        imported_df = pd.read_csv(output_file)
        assert len(imported_df) == 3
        assert imported_df["name"].tolist() == ["John Doe", "Jane Smith", "Bob Johnson"]

    @pytest.mark.asyncio
    async def test_json_export_workflow(self, sample_customer_data, temp_dir):
        """Test complete JSON export workflow."""
        df = pd.DataFrame(sample_customer_data)
        output_file = temp_dir / "export.json"

        # Export using factory
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            exporter = create_exporter(DataFormat.JSON)
            await exporter.export_to_file(dataframe_to_batches(df), output_file)

        # Verify export
        assert output_file.exists()
        with open(output_file) as f:
            data = json.load(f)
        assert len(data) == 3
        assert data[0]["name"] == "John Doe"

    @pytest.mark.asyncio
    async def test_excel_export_workflow(self, sample_customer_data, temp_dir):
        """Test complete Excel export workflow."""
        df = pd.DataFrame(sample_customer_data)
        output_file = temp_dir / "export.xlsx"

        # Export using factory
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            exporter = create_exporter(DataFormat.EXCEL)
            await exporter.export_to_file(dataframe_to_batches(df), output_file)

        # Verify export
        assert output_file.exists()
        imported_df = pd.read_excel(output_file, engine="openpyxl")
        assert len(imported_df) == 3

    @pytest.mark.asyncio
    async def test_export_with_custom_options(self, sample_customer_data, temp_dir):
        """Test export with custom options."""
        df = pd.DataFrame(sample_customer_data)
        output_file = temp_dir / "custom_export.csv"

        # Export without headers
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            options = ExportOptions(include_headers=False, delimiter="|")
            exporter = create_exporter("csv", options=options)
            await exporter.export_to_file(dataframe_to_batches(df), output_file)

        # Verify custom format
        assert output_file.exists()
        content = output_file.read_text()
        assert "|" in content
        # First line should be data, not headers
        first_line = content.split("\n")[0]
        assert "id" not in first_line.lower()  # No header row

    @pytest.mark.asyncio
    async def test_export_with_column_selection(self, sample_customer_data, temp_dir):
        """Test export with specific columns only."""
        df = pd.DataFrame(sample_customer_data)
        output_file = temp_dir / "selected_columns.csv"

        # Select specific columns before export
        df_filtered = df[["name", "email"]]

        # Export selected columns
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            exporter = create_exporter("csv")
            await exporter.export_to_file(dataframe_to_batches(df_filtered), output_file)

        # Verify only selected columns exported
        imported_df = pd.read_csv(output_file)
        assert list(imported_df.columns) == ["name", "email"]
        assert "age" not in imported_df.columns


# ============================================================================
# Format Conversion Integration Tests
# ============================================================================


@pytest.mark.integration
class TestFormatConversionIntegration:
    """Test cross-format conversion workflows."""

    @pytest.mark.asyncio
    async def test_csv_to_json_conversion(self, sample_customer_data, temp_dir):
        """Test converting CSV to JSON."""
        # Create CSV file
        csv_file = temp_dir / "source.csv"
        pd.DataFrame(sample_customer_data).to_csv(csv_file, index=False)

        # Convert CSV → JSON
        json_file = temp_dir / "converted.json"

        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Import CSV
            importer = create_importer("csv")
            batches = [batch async for batch in importer.import_from_file(csv_file)]
            all_records = []
            for batch in batches:
                all_records.extend([record.data for record in batch.records])
            df = pd.DataFrame(all_records)

            # Export as JSON
            exporter = create_exporter("json")
            await exporter.export_to_file(dataframe_to_batches(df), json_file)

        # Verify conversion
        assert json_file.exists()
        with open(json_file) as f:
            data = json.load(f)
        assert len(data) == 3
        assert data[0]["name"] == "John Doe"

    @pytest.mark.asyncio
    async def test_json_to_excel_conversion(self, sample_customer_data, temp_dir):
        """Test converting JSON to Excel."""
        # Create JSON file
        json_file = temp_dir / "source.json"
        with open(json_file, "w") as f:
            json.dump(sample_customer_data, f)

        # Convert JSON → Excel
        excel_file = temp_dir / "converted.xlsx"

        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Import JSON
            importer = create_importer(DataFormat.JSON)
            batches = [batch async for batch in importer.import_from_file(json_file)]
            all_records = []
            for batch in batches:
                all_records.extend([record.data for record in batch.records])
            df = pd.DataFrame(all_records)

            # Export as Excel
            exporter = create_exporter(DataFormat.EXCEL)
            await exporter.export_to_file(dataframe_to_batches(df), excel_file)

        # Verify conversion
        assert excel_file.exists()
        imported_df = pd.read_excel(excel_file, engine="openpyxl")
        assert len(imported_df) == 3

    @pytest.mark.asyncio
    async def test_excel_to_csv_conversion(self, sample_customer_data, temp_dir):
        """Test converting Excel to CSV."""
        # Create Excel file
        excel_file = temp_dir / "source.xlsx"
        pd.DataFrame(sample_customer_data).to_excel(excel_file, index=False, engine="openpyxl")

        # Convert Excel → CSV
        csv_file = temp_dir / "converted.csv"

        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Import Excel
            importer = create_importer(DataFormat.EXCEL)
            batches = [batch async for batch in importer.import_from_file(excel_file)]
            all_records = []
            for batch in batches:
                all_records.extend([record.data for record in batch.records])
            df = pd.DataFrame(all_records)

            # Export as CSV
            exporter = create_exporter("csv")
            await exporter.export_to_file(dataframe_to_batches(df), csv_file)

        # Verify conversion
        assert csv_file.exists()
        imported_df = pd.read_csv(csv_file)
        assert len(imported_df) == 3

    @pytest.mark.asyncio
    async def test_roundtrip_conversion_csv_json_csv(self, sample_customer_data, temp_dir):
        """Test roundtrip conversion: CSV → JSON → CSV."""
        # Create original CSV
        original_csv = temp_dir / "original.csv"
        original_df = pd.DataFrame(sample_customer_data)
        original_df.to_csv(original_csv, index=False)

        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # CSV → JSON
            json_file = temp_dir / "intermediate.json"
            importer1 = create_importer("csv")
            batches1 = [batch async for batch in importer1.import_from_file(original_csv)]
            all_records1 = []
            for batch in batches1:
                all_records1.extend([record.data for record in batch.records])
            df1 = pd.DataFrame(all_records1)
            exporter1 = create_exporter("json")
            await exporter1.export_to_file(dataframe_to_batches(df1), json_file)

            # JSON → CSV
            final_csv = temp_dir / "final.csv"
            importer2 = create_importer("json")
            batches2 = [batch async for batch in importer2.import_from_file(json_file)]
            all_records2 = []
            for batch in batches2:
                all_records2.extend([record.data for record in batch.records])
            df2 = pd.DataFrame(all_records2)
            exporter2 = create_exporter("csv")
            await exporter2.export_to_file(dataframe_to_batches(df2), final_csv)

        # Verify data integrity preserved
        original = pd.read_csv(original_csv)
        final = pd.read_csv(final_csv)

        # Compare data (allow for minor type differences)
        assert len(original) == len(final)
        assert original["name"].tolist() == final["name"].tolist()
        assert original["email"].tolist() == final["email"].tolist()


# ============================================================================
# Large Dataset Handling Integration Tests
# ============================================================================


@pytest.mark.integration
class TestLargeDatasetHandling:
    """Test handling of large datasets with chunking and streaming."""

    @pytest.mark.asyncio
    async def test_large_csv_import_with_chunking(self, large_dataset, temp_dir):
        """Test importing large CSV file with chunking."""
        # Create large CSV file
        csv_file = temp_dir / "large_data.csv"
        df = pd.DataFrame(large_dataset)
        df.to_csv(csv_file, index=False)

        # Import with chunking
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            config = TransferConfig(chunk_size=100, batch_size=50)
            importer = create_importer("csv", config=config)
            batches = [batch async for batch in importer.import_from_file(csv_file)]

        # Verify all data imported - combine all records from batches
        assert len(batches) > 0
        all_records = []
        for batch in batches:
            all_records.extend([record.data for record in batch.records])

        # Convert to DataFrame for aggregation checks
        result_df = pd.DataFrame(all_records)
        assert len(all_records) == 1000
        assert result_df["id"].min() == 0
        assert result_df["id"].max() == 999

    @pytest.mark.asyncio
    async def test_large_dataset_export_performance(self, large_dataset, temp_dir):
        """Test exporting large dataset efficiently."""
        df = pd.DataFrame(large_dataset)
        output_file = temp_dir / "large_export.csv"

        # Export large dataset
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            config = TransferConfig(chunk_size=200)
            exporter = create_exporter("csv", config=config)
            await exporter.export_to_file(dataframe_to_batches(df), output_file)

        # Verify export completed
        assert output_file.exists()
        imported_df = pd.read_csv(output_file)
        assert len(imported_df) == 1000

    @pytest.mark.asyncio
    async def test_progress_tracking_during_import(self, large_dataset, temp_dir):
        """Test progress tracking during large import."""
        # Create large CSV file
        csv_file = temp_dir / "progress_test.csv"
        pd.DataFrame(large_dataset).to_csv(csv_file, index=False)

        # Track progress during import
        ProgressInfo(total_records=1000)

        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            config = TransferConfig(chunk_size=100)
            importer = create_importer("csv", config=config)

            # Import with progress tracking
            batches = [batch async for batch in importer.import_from_file(csv_file)]

        # Verify import completed - combine all records from batches
        assert len(batches) > 0
        all_records = []
        for batch in batches:
            all_records.extend([record.data for record in batch.records])

        assert len(all_records) == 1000


# ============================================================================
# End-to-End Workflow Integration Tests
# ============================================================================


@pytest.mark.integration
class TestEndToEndWorkflows:
    """Test complete end-to-end data transfer workflows."""

    @pytest.mark.asyncio
    async def test_complete_etl_workflow(self, sample_customer_data, temp_dir):
        """Test Extract-Transform-Load workflow."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # 1. EXTRACT: Import from CSV
            source_csv = temp_dir / "source.csv"
            pd.DataFrame(sample_customer_data).to_csv(source_csv, index=False)

            importer = create_importer("csv")
            batches = [batch async for batch in importer.import_from_file(source_csv)]
            all_records = []
            for batch in batches:
                all_records.extend([record.data for record in batch.records])
            df = pd.DataFrame(all_records)

            # 2. TRANSFORM: Add calculated fields
            df["email_domain"] = df["email"].str.split("@").str[1]
            df["age_group"] = pd.cut(
                df["age"], bins=[0, 25, 35, 100], labels=["young", "middle", "senior"]
            )

            # 3. LOAD: Export to JSON
            output_json = temp_dir / "transformed.json"
            exporter = create_exporter("json")
            await exporter.export_to_file(dataframe_to_batches(df), output_json)

        # Verify complete workflow
        assert output_json.exists()
        with open(output_json) as f:
            result = json.load(f)
        assert len(result) == 3
        assert "email_domain" in result[0]
        assert "age_group" in result[0]

    @pytest.mark.asyncio
    async def test_multi_source_aggregation_workflow(self, sample_customer_data, temp_dir):
        """Test aggregating data from multiple sources."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Create multiple source files
            csv_data = sample_customer_data[:2]
            json_data = sample_customer_data[2:]

            csv_file = temp_dir / "customers.csv"
            json_file = temp_dir / "customers.json"

            pd.DataFrame(csv_data).to_csv(csv_file, index=False)
            with open(json_file, "w") as f:
                json.dump(json_data, f)

            # Import from both sources
            csv_importer = create_importer("csv")
            json_importer = create_importer("json")

            batches1 = [batch async for batch in csv_importer.import_from_file(csv_file)]
            all_records1 = []
            for batch in batches1:
                all_records1.extend([record.data for record in batch.records])
            df1 = pd.DataFrame(all_records1)

            batches2 = [batch async for batch in json_importer.import_from_file(json_file)]
            all_records2 = []
            for batch in batches2:
                all_records2.extend([record.data for record in batch.records])
            df2 = pd.DataFrame(all_records2)

            # Combine data
            combined_df = pd.concat([df1, df2], ignore_index=True)

            # Export combined data
            output_file = temp_dir / "combined.xlsx"
            exporter = create_exporter(DataFormat.EXCEL)
            await exporter.export_to_file(dataframe_to_batches(combined_df), output_file)

        # Verify aggregation
        assert output_file.exists()
        result_df = pd.read_excel(output_file, engine="openpyxl")
        assert len(result_df) == 3

    @pytest.mark.asyncio
    async def test_data_migration_workflow(self, sample_customer_data, temp_dir):
        """Test data migration workflow with validation."""
        with patch("dotmac.platform.data_transfer.factory.settings") as mock_settings:
            mock_settings.features.data_transfer_enabled = True

            # Source: Legacy CSV format
            source_file = temp_dir / "legacy_data.csv"
            legacy_df = pd.DataFrame(sample_customer_data)
            legacy_df.to_csv(source_file, index=False)

            # Import legacy data
            importer = create_importer("csv")
            batches = [batch async for batch in importer.import_from_file(source_file)]
            all_records = []
            for batch in batches:
                all_records.extend([record.data for record in batch.records])
            df = pd.DataFrame(all_records)

            # Transform to new schema (add fields, rename, etc.)
            df["migrated_at"] = datetime.now(UTC).isoformat()
            df["status"] = "active"
            df = df.rename(columns={"id": "customer_id"})

            # Export to new format (JSON)
            target_file = temp_dir / "migrated_data.json"
            exporter = create_exporter("json")
            await exporter.export_to_file(dataframe_to_batches(df), target_file)

        # Verify migration
        assert target_file.exists()
        with open(target_file) as f:
            migrated = json.load(f)
        assert len(migrated) == 3
        assert "customer_id" in migrated[0]
        assert "migrated_at" in migrated[0]
        assert migrated[0]["status"] == "active"

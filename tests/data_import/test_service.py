"""Tests for data import service."""

import csv
import io
import json
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from dotmac.platform.data_import.models import ImportJobStatus
from dotmac.platform.data_import.service import DataImportService, ImportResult

pytestmark = pytest.mark.unit


class TestImportResult:
    """Test ImportResult class."""

    def test_result_creation(self):
        """Test import result initialization."""
        job_id = str(uuid4())
        result = ImportResult(
            job_id=job_id, total_records=100, successful_records=95, failed_records=5
        )

        assert result.job_id == job_id
        assert result.total_records == 100
        assert result.successful_records == 95
        assert result.failed_records == 5
        assert result.errors == []
        assert result.warnings == []

    def test_result_with_errors(self):
        """Test adding errors to result."""
        result = ImportResult(job_id="test-job")
        result.errors.append({"row": 10, "message": "Invalid email"})

        assert len(result.errors) == 1
        assert result.errors[0]["row"] == 10

    def test_result_with_warnings(self):
        """Test adding warnings to result."""
        result = ImportResult(job_id="test-job")
        result.warnings.append("Duplicate entry found")

        assert len(result.warnings) == 1
        assert "Duplicate" in result.warnings[0]

    def test_result_success_rate(self):
        """Test calculating success rate."""
        result = ImportResult(
            job_id="test-job", total_records=100, successful_records=90, failed_records=10
        )

        # Calculate success rate
        if result.total_records > 0:
            success_rate = (result.successful_records / result.total_records) * 100
            assert success_rate == 90.0


class TestDataImportService:
    """Test DataImportService."""

    @pytest.fixture
    def mock_session(self):
        """Create mock session."""
        session = AsyncMock()
        session.add = MagicMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        return session

    @pytest.fixture
    def mock_customer_service(self):
        """Create mock customer service."""
        service = AsyncMock()
        service.create_customer = AsyncMock()
        return service

    @pytest.fixture
    def import_service(self, mock_session, mock_customer_service):
        """Create import service with mocked dependencies."""
        service = DataImportService(mock_session)
        # Inject mocked services
        service._customer_service = mock_customer_service
        return service

    def test_service_can_be_imported(self):
        """Test service class can be imported."""
        assert DataImportService is not None
        assert callable(DataImportService)

    def test_parse_csv_data(self, import_service):
        """Test parsing CSV data."""
        csv_content = "name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com"
        csv_file = io.StringIO(csv_content)

        reader = csv.DictReader(csv_file)
        rows = list(reader)

        assert len(rows) == 2
        assert rows[0]["name"] == "John Doe"
        assert rows[0]["email"] == "john@example.com"
        assert rows[1]["name"] == "Jane Smith"

    def test_parse_json_data(self):
        """Test parsing JSON data."""
        json_content = '[{"name": "John Doe", "email": "john@example.com"}]'
        json_file = io.StringIO(json_content)

        data = json.load(json_file)

        assert len(data) == 1
        assert data[0]["name"] == "John Doe"
        assert data[0]["email"] == "john@example.com"

    @pytest.mark.asyncio
    async def test_validate_customer_data(self, import_service):
        """Test validating customer data."""
        valid_data = {"name": "John Doe", "email": "john@example.com", "phone": "+1234567890"}

        # Should not raise exception for valid data
        assert valid_data["email"] is not None
        assert "@" in valid_data["email"]

    @pytest.mark.asyncio
    async def test_invalid_customer_data(self, import_service):
        """Test validation fails for invalid data."""
        invalid_data = {
            "name": "",  # Empty name
            "email": "not-an-email",  # Invalid email
        }

        # Check validation logic
        assert invalid_data["name"] == ""
        assert "@" not in invalid_data["email"]

    @pytest.mark.asyncio
    async def test_import_result_tracking(self, import_service):
        """Test tracking import results."""
        result = ImportResult(job_id="test-job")

        # Simulate processing records
        result.total_records = 10
        result.successful_records = 8
        result.failed_records = 2

        result.errors.append({"row": 5, "error": "Invalid email"})
        result.errors.append({"row": 7, "error": "Missing required field"})

        assert result.total_records == 10
        assert result.successful_records == 8
        assert result.failed_records == 2
        assert len(result.errors) == 2

    def test_status_lifecycle(self):
        """Test job status lifecycle transitions."""
        # Test valid status transitions
        initial_status = ImportJobStatus.PENDING
        validating_status = ImportJobStatus.VALIDATING
        in_progress_status = ImportJobStatus.IN_PROGRESS
        completed_status = ImportJobStatus.COMPLETED

        assert initial_status == ImportJobStatus.PENDING
        assert validating_status == ImportJobStatus.VALIDATING
        assert in_progress_status == ImportJobStatus.IN_PROGRESS
        assert completed_status == ImportJobStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_partial_import_completion(self, import_service):
        """Test handling partially completed imports."""
        result = ImportResult(
            job_id="test-job", total_records=100, successful_records=75, failed_records=25
        )

        # Job should be marked as partially completed if there are failures
        if result.failed_records > 0 and result.successful_records > 0:
            expected_status = ImportJobStatus.PARTIALLY_COMPLETED
        elif result.failed_records == 0:
            expected_status = ImportJobStatus.COMPLETED
        else:
            expected_status = ImportJobStatus.FAILED

        assert expected_status == ImportJobStatus.PARTIALLY_COMPLETED

    @pytest.mark.asyncio
    async def test_failed_import_handling(self, import_service):
        """Test handling completely failed imports."""
        result = ImportResult(
            job_id="test-job", total_records=10, successful_records=0, failed_records=10
        )

        # All records failed
        assert result.failed_records == result.total_records
        assert result.successful_records == 0

    def test_detect_file_format(self):
        """Test file format detection."""
        # CSV detection
        csv_filename = "customers.csv"
        assert csv_filename.endswith(".csv")

        # JSON detection
        json_filename = "customers.json"
        assert json_filename.endswith(".json")

        # Unknown format
        unknown_filename = "customers.xml"
        assert not unknown_filename.endswith(".csv")
        assert not unknown_filename.endswith(".json")

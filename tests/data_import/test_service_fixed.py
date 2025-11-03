"""Fixed comprehensive tests for DataImportService."""

import io
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.data_import.models import ImportJob, ImportJobStatus, ImportJobType
from dotmac.platform.data_import.service import DataImportService, ImportResult

pytestmark = pytest.mark.unit


@pytest.fixture
def mock_session():
    """Mock database session."""

    session = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def mock_customer_service():
    """Mock CustomerService."""
    service = AsyncMock()
    service.create_customer = AsyncMock()
    return service


@pytest.fixture
def import_service(mock_session, mock_customer_service):
    """Create DataImportService instance with mocked dependencies."""
    return DataImportService(session=mock_session, customer_service=mock_customer_service)


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

    def test_result_success_rate(self):
        """Test success rate calculation."""
        result = ImportResult(
            job_id="test-job", total_records=100, successful_records=90, failed_records=10
        )

        assert result.success_rate == 90.0

    def test_result_success_rate_zero_records(self):
        """Test success rate with zero records."""
        result = ImportResult(job_id="test-job")

        assert result.success_rate == 0.0

    def test_result_to_dict(self):
        """Test converting result to dictionary."""
        result = ImportResult(
            job_id="test-job", total_records=10, successful_records=8, failed_records=2
        )
        result.errors.append({"row": 5, "message": "Error"})
        result.warnings.append("Warning message")

        data = result.to_dict()

        assert data["job_id"] == "test-job"
        assert data["total_records"] == 10
        assert data["success_rate"] == 80.0
        assert len(data["errors"]) == 1
        assert len(data["warnings"]) == 1


class TestImportCustomersCSV:
    """Test CSV customer import with proper mocking."""

    @pytest.mark.asyncio
    async def test_import_customers_csv_success(self, import_service, mock_session):
        """Test successful customer CSV import."""
        csv_content = "name,email,phone\nJohn Doe,john@example.com,+1234567890\n"
        csv_file = io.BytesIO(csv_content.encode())

        # Mock the internal methods
        mock_job = MagicMock()
        mock_job.id = uuid4()
        mock_job.status = ImportJobStatus.PENDING

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch.object(import_service, "_update_job_status", new_callable=AsyncMock):
                with patch("dotmac.platform.data_import.service.CustomerMapper") as mock_mapper:
                    # Mock validation to return valid data
                    valid_customer = MagicMock()
                    valid_customer.dict.return_value = {
                        "name": "John Doe",
                        "email": "john@example.com",
                    }
                    mock_mapper.batch_validate.return_value = ([valid_customer], [])
                    mock_mapper.from_import_to_model.return_value = {
                        "name": "John Doe",
                        "email": "john@example.com",
                    }

                    result = await import_service.import_customers_csv(
                        file_content=csv_file,
                        tenant_id="test-tenant",
                        user_id=str(uuid4()),
                        dry_run=False,
                    )

                    assert isinstance(result, ImportResult)
                    assert result.total_records == 1
                    assert result.successful_records == 1
                    assert result.failed_records == 0

    @pytest.mark.asyncio
    async def test_import_customers_csv_dry_run(
        self, import_service, mock_session, mock_customer_service
    ):
        """Test CSV import with dry run mode."""
        csv_content = "name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com\n"
        csv_file = io.BytesIO(csv_content.encode())

        mock_job = MagicMock()
        mock_job.id = uuid4()

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch.object(import_service, "_update_job_status", new_callable=AsyncMock):
                with patch("dotmac.platform.data_import.service.CustomerMapper") as mock_mapper:
                    valid_customers = [MagicMock(), MagicMock()]
                    mock_mapper.batch_validate.return_value = (valid_customers, [])

                    result = await import_service.import_customers_csv(
                        file_content=csv_file, tenant_id="test-tenant", dry_run=True
                    )

                    assert result.total_records == 2
                    assert result.successful_records == 2
                    # Should not create customers in dry run
                    mock_customer_service.create_customer.assert_not_called()
                    assert any("Dry run" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_import_customers_csv_with_validation_errors(self, import_service, mock_session):
        """Test CSV import with validation errors."""
        csv_content = "name,email\nJohn Doe,invalid-email\n"
        csv_file = io.BytesIO(csv_content.encode())

        mock_job = MagicMock()
        mock_job.id = uuid4()

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch.object(import_service, "_update_job_status", new_callable=AsyncMock):
                with patch.object(import_service, "_record_import_failure", new_callable=AsyncMock):
                    with patch("dotmac.platform.data_import.service.CustomerMapper") as mock_mapper:
                        # Mock validation to return errors
                        error = {
                            "row_number": 1,
                            "error": "Invalid email format",
                            "data": {"name": "John Doe", "email": "invalid-email"},
                        }
                        mock_mapper.batch_validate.return_value = ([], [error])

                        result = await import_service.import_customers_csv(
                            file_content=csv_file, tenant_id="test-tenant", dry_run=False
                        )

                        assert result.total_records == 1
                        assert result.failed_records == 1
                        assert len(result.errors) == 1

    @pytest.mark.asyncio
    async def test_import_customers_csv_batch_processing(self, import_service, mock_session):
        """Test batch processing of large CSV files."""
        # Create CSV with 5 records
        csv_lines = ["name,email\n"]
        for i in range(5):
            csv_lines.append(f"Customer {i},customer{i}@example.com\n")
        csv_content = "".join(csv_lines)
        csv_file = io.BytesIO(csv_content.encode())

        mock_job = MagicMock()
        mock_job.id = uuid4()
        mock_job.successful_records = 0
        mock_job.failed_records = 0

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch.object(import_service, "_update_job_status", new_callable=AsyncMock):
                with patch("dotmac.platform.data_import.service.CustomerMapper") as mock_mapper:
                    # Create 5 valid customers
                    valid_customers = []
                    for i in range(5):
                        customer = MagicMock()
                        customer.dict.return_value = {"name": f"Customer {i}"}
                        valid_customers.append(customer)

                    mock_mapper.batch_validate.return_value = (valid_customers, [])
                    mock_mapper.from_import_to_model.return_value = {"name": "Test"}

                    result = await import_service.import_customers_csv(
                        file_content=csv_file,
                        tenant_id="test-tenant",
                        batch_size=2,  # Process in batches of 2
                        dry_run=False,
                    )

                    assert result.total_records == 5
                    # Should have called commit multiple times (for batches)
                    assert mock_session.commit.call_count >= 2


class TestImportCustomersJSON:
    """Test JSON customer import."""

    @pytest.mark.asyncio
    async def test_import_customers_json_success(self, import_service, mock_session):
        """Test successful customer JSON import."""
        json_data = [
            {"name": "John Doe", "email": "john@example.com"},
            {"name": "Jane Smith", "email": "jane@example.com"},
        ]

        mock_job = MagicMock()
        mock_job.id = uuid4()
        mock_job.successful_records = 0

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch.object(import_service, "_update_job_status", new_callable=AsyncMock):
                with patch("dotmac.platform.data_import.service.CustomerMapper") as mock_mapper:
                    valid_customers = [MagicMock(), MagicMock()]
                    for customer in valid_customers:
                        customer.dict.return_value = {"name": "Test"}
                    mock_mapper.batch_validate.return_value = (valid_customers, [])
                    mock_mapper.from_import_to_model.return_value = {"name": "Test"}

                    result = await import_service.import_customers_json(
                        json_data=json_data, tenant_id="test-tenant", dry_run=False
                    )

                    assert result.total_records == 2
                    assert result.successful_records == 2

    @pytest.mark.asyncio
    async def test_import_customers_json_partial_failure(
        self, import_service, mock_session, mock_customer_service
    ):
        """Test JSON import with partial failures."""
        json_data = [
            {"name": "John Doe", "email": "john@example.com"},
            {"name": "Invalid", "email": "bad-email"},
            {"name": "Jane Smith", "email": "jane@example.com"},
        ]

        mock_job = MagicMock()
        mock_job.id = uuid4()
        mock_job.successful_records = 0
        mock_job.failed_records = 0

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch.object(import_service, "_update_job_status", new_callable=AsyncMock):
                with patch.object(import_service, "_record_import_failure", new_callable=AsyncMock):
                    with patch("dotmac.platform.data_import.service.CustomerMapper") as mock_mapper:
                        # Return 2 valid, 1 error
                        valid_customer1 = MagicMock()
                        valid_customer1.dict.return_value = {"name": "John"}
                        valid_customer2 = MagicMock()
                        valid_customer2.dict.return_value = {"name": "Jane"}

                        error = {
                            "row_number": 2,
                            "error": "Invalid email",
                            "data": {"name": "Invalid"},
                        }

                        mock_mapper.batch_validate.return_value = (
                            [valid_customer1, valid_customer2],
                            [error],
                        )
                        mock_mapper.from_import_to_model.return_value = {"name": "Test"}

                        result = await import_service.import_customers_json(
                            json_data=json_data, tenant_id="test-tenant", dry_run=False
                        )

                        assert result.total_records == 3
                        assert result.successful_records == 2
                        assert result.failed_records == 1


class TestImportJobStatusHandling:
    """Test import job status transitions."""

    @pytest.mark.asyncio
    async def test_create_import_job(self, import_service, mock_session):
        """Test creating import job."""
        job = await import_service._create_import_job(
            job_type=ImportJobType.CUSTOMERS,
            file_name="customers.csv",
            file_size=1024,
            file_format="csv",
            tenant_id="test-tenant",
            user_id=str(uuid4()),
        )

        assert isinstance(job, ImportJob)
        assert job.job_type == ImportJobType.CUSTOMERS
        assert job.status == ImportJobStatus.PENDING
        assert job.file_name == "customers.csv"
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_job_status_to_in_progress(self, import_service, mock_session):
        """Test updating job status to in progress."""
        job = ImportJob(
            id=uuid4(),
            tenant_id="test-tenant",
            job_type=ImportJobType.CUSTOMERS,
            status=ImportJobStatus.PENDING,
            file_name="test.csv",
            file_size=1024,
            file_format="csv",
        )

        await import_service._update_job_status(job, ImportJobStatus.IN_PROGRESS)

        assert job.status == ImportJobStatus.IN_PROGRESS
        assert job.started_at is not None
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_job_status_to_completed(self, import_service, mock_session):
        """Test updating job status to completed."""
        job = ImportJob(
            id=uuid4(),
            tenant_id="test-tenant",
            job_type=ImportJobType.CUSTOMERS,
            status=ImportJobStatus.IN_PROGRESS,
            file_name="test.csv",
            file_size=1024,
            file_format="csv",
            started_at=datetime.now(UTC),
        )

        await import_service._update_job_status(job, ImportJobStatus.COMPLETED)

        assert job.status == ImportJobStatus.COMPLETED
        assert job.completed_at is not None
        assert job.duration_seconds is not None
        mock_session.commit.assert_called_once()


class TestImportErrorHandling:
    """Test error handling in import operations."""

    @pytest.mark.asyncio
    async def test_import_handles_mapper_exception(self, import_service, mock_session):
        """Test import handles CustomerMapper exceptions."""
        csv_content = "name,email\nTest,test@example.com\n"
        csv_file = io.BytesIO(csv_content.encode())

        mock_job = MagicMock()
        mock_job.id = uuid4()

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch.object(import_service, "_update_job_status", new_callable=AsyncMock):
                with patch("dotmac.platform.data_import.service.CustomerMapper") as mock_mapper:
                    # Make mapper raise exception
                    mock_mapper.batch_validate.side_effect = Exception("Validation error")

                    with pytest.raises(Exception):  # noqa: B017
                        await import_service.import_customers_csv(
                            file_content=csv_file, tenant_id="test-tenant", dry_run=False
                        )

                    # Should have marked job as failed
                    assert mock_job.error_message is not None

    @pytest.mark.asyncio
    async def test_record_import_failure(self, import_service, mock_session):
        """Test recording import failures."""
        job = ImportJob(
            id=uuid4(),
            tenant_id="test-tenant",
            job_type=ImportJobType.CUSTOMERS,
            status=ImportJobStatus.IN_PROGRESS,
            file_name="test.csv",
            file_size=1024,
            file_format="csv",
        )

        await import_service._record_import_failure(
            job=job,
            row_number=5,
            error_type="ValidationError",
            error_message="Invalid email format",
            row_data={"email": "invalid"},
            tenant_id="test-tenant",
        )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()


class TestCeleryBackgroundProcessing:
    """Test Celery background processing path."""

    @pytest.mark.asyncio
    async def test_import_customers_csv_with_celery(self, import_service, mock_session):
        """Test CSV import with Celery background processing."""
        csv_content = "name,email\nTest,test@example.com\n"
        csv_file = io.BytesIO(csv_content.encode())

        mock_job = MagicMock()
        mock_job.id = uuid4()

        # Mock the Celery task before it's imported
        mock_task = MagicMock()
        mock_task.delay.return_value = MagicMock(id="task-abc-123")

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch("tempfile.NamedTemporaryFile") as mock_temp:
                with patch.dict(
                    "sys.modules",
                    {"dotmac.platform.data_import.tasks": MagicMock(process_import_job=mock_task)},
                ):
                    # Mock temporary file
                    mock_file = MagicMock()
                    mock_file.name = "/tmp/test_import_123.csv"
                    mock_temp.return_value.__enter__.return_value = mock_file

                    result = await import_service.import_customers_csv(
                        file_content=csv_file,
                        tenant_id="test-tenant",
                        user_id=str(uuid4()),
                        use_celery=True,
                    )

                    # Verify Celery task was queued
                    mock_task.delay.assert_called_once()
                    assert mock_job.celery_task_id == "task-abc-123"
                    assert "queued for background processing" in result.warnings[0]
                    assert result.job_id == str(mock_job.id)
                    mock_session.commit.assert_called()


class TestInvoiceImport:
    """Test invoice import functionality."""

    @pytest.mark.asyncio
    async def test_import_invoices_csv(self, mock_session):
        """Test CSV invoice import."""
        # Create service with invoice service
        mock_invoice_service = AsyncMock()
        service = DataImportService(session=mock_session, invoice_service=mock_invoice_service)

        csv_content = "invoice_number,amount\nINV-001,100.00\n"
        csv_file = io.BytesIO(csv_content.encode())

        mock_job = MagicMock()
        mock_job.id = uuid4()

        with patch.object(service, "_create_import_job", return_value=mock_job):
            result = await service.import_invoices_csv(
                file_content=csv_file, tenant_id="test-tenant", dry_run=False
            )

            assert isinstance(result, ImportResult)
            assert result.job_id == str(mock_job.id)

    @pytest.mark.asyncio
    async def test_import_invoices_without_service(self, import_service):
        """Test invoice import without invoice service configured."""
        csv_content = "invoice_number,amount\nINV-001,100.00\n"
        csv_file = io.BytesIO(csv_content.encode())

        with pytest.raises(ValueError, match="Invoice service not configured"):
            await import_service.import_invoices_csv(file_content=csv_file, tenant_id="test-tenant")


class TestHelperMethods:
    """Test helper methods."""

    @pytest.mark.asyncio
    async def test_get_import_job(self, import_service, mock_session):
        """Test getting import job by ID."""
        from uuid import UUID

        job_id = str(uuid4())
        mock_job = ImportJob(
            id=job_id,
            tenant_id="test-tenant",
            job_type=ImportJobType.CUSTOMERS,
            status=ImportJobStatus.COMPLETED,
            file_name="test.csv",
            file_size=1024,
            file_format="csv",
        )

        mock_session.get.return_value = mock_job

        result = await import_service.get_import_job(job_id, "test-tenant")

        assert result == mock_job
        # get_import_job now converts string to UUID before calling session.get()
        mock_session.get.assert_called_once_with(ImportJob, UUID(job_id))

    @pytest.mark.asyncio
    async def test_list_import_jobs(self, import_service, mock_session):
        """Test listing import jobs with filters."""
        mock_jobs = [
            ImportJob(
                id=uuid4(),
                tenant_id="test-tenant",
                job_type=ImportJobType.CUSTOMERS,
                status=ImportJobStatus.COMPLETED,
                file_name="test1.csv",
                file_size=1024,
                file_format="csv",
            ),
            ImportJob(
                id=uuid4(),
                tenant_id="test-tenant",
                job_type=ImportJobType.CUSTOMERS,
                status=ImportJobStatus.COMPLETED,
                file_name="test2.csv",
                file_size=2048,
                file_format="csv",
            ),
        ]

        # Create proper mock chain for SQLAlchemy result
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_jobs

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await import_service.list_import_jobs(
            tenant_id="test-tenant",
            status=ImportJobStatus.COMPLETED,
            job_type=ImportJobType.CUSTOMERS,
            limit=20,
            offset=0,
        )

        assert result == mock_jobs
        mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_import_failures(self, import_service, mock_session):
        """Test getting import failures for a job."""
        from dotmac.platform.data_import.models import ImportFailure

        job_id = str(uuid4())
        mock_failures = [
            ImportFailure(
                id=uuid4(),
                job_id=job_id,
                tenant_id="test-tenant",
                row_number=1,
                error_type="ValidationError",
                error_message="Invalid email",
            )
        ]

        # Create proper mock chain for SQLAlchemy result
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_failures

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await import_service.get_import_failures(
            job_id=job_id, tenant_id="test-tenant", limit=100
        )

        assert result == mock_failures
        mock_session.execute.assert_called_once()


class TestCustomerCreationErrors:
    """Test individual customer creation error handling."""

    @pytest.mark.asyncio
    async def test_customer_creation_failure_in_batch(
        self, import_service, mock_session, mock_customer_service
    ):
        """Test handling customer creation failure in batch processing."""
        csv_content = "name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com\n"
        csv_file = io.BytesIO(csv_content.encode())

        mock_job = MagicMock()
        mock_job.id = uuid4()
        mock_job.successful_records = 0
        mock_job.failed_records = 0

        # Make second customer creation fail
        mock_customer_service.create_customer.side_effect = [
            MagicMock(),  # First succeeds
            Exception("Database error"),  # Second fails
        ]

        with patch.object(import_service, "_create_import_job", return_value=mock_job):
            with patch.object(import_service, "_update_job_status", new_callable=AsyncMock):
                with patch("dotmac.platform.data_import.service.CustomerMapper") as mock_mapper:
                    valid_customer1 = MagicMock()
                    valid_customer1.dict.return_value = {"name": "John"}
                    valid_customer2 = MagicMock()
                    valid_customer2.dict.return_value = {"name": "Jane"}

                    mock_mapper.batch_validate.return_value = (
                        [valid_customer1, valid_customer2],
                        [],
                    )
                    mock_mapper.from_import_to_model.return_value = {"name": "Test"}

                    result = await import_service.import_customers_csv(
                        file_content=csv_file, tenant_id="test-tenant", dry_run=False
                    )

                    assert result.successful_records == 1
                    assert result.failed_records == 1
                    assert len(result.errors) == 1
                    assert "Database error" in str(result.errors[0])

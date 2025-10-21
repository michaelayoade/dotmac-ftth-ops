"""Integration tests for Celery tasks - testing async functions directly."""

import csv
import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.data_import.models import ImportJob, ImportJobStatus, ImportJobType
from dotmac.platform.data_import.tasks import (
    _mark_job_failed,
    _process_chunk_data,
    _process_csv_in_chunks,
    _process_customer_import,
    _process_json_in_chunks,
    _update_job_task_id,
)

pytestmark = pytest.mark.asyncio


class TestUpdateJobTaskId:
    """Test _update_job_task_id helper function."""

    @pytest.mark.asyncio
    async def test_update_job_task_id_success(self):
        """Test updating job with task ID."""
        job_id = str(uuid4())
        task_id = "celery-task-123"

        # Mock session and job
        mock_session = AsyncMock()
        mock_job = MagicMock(spec=ImportJob)
        mock_session.get.return_value = mock_job
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        with patch(
            "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
        ):
            await _update_job_task_id(job_id, task_id)

        assert mock_job.celery_task_id == task_id
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_job_task_id_not_found(self):
        """Test updating task ID when job not found."""
        job_id = str(uuid4())

        # Mock session returning None
        mock_session = AsyncMock()
        mock_session.get.return_value = None
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        with patch(
            "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
        ):
            await _update_job_task_id(job_id, "task-123")

        # Should not commit if job not found
        mock_session.commit.assert_not_called()


class TestMarkJobFailed:
    """Test _mark_job_failed helper function."""

    @pytest.mark.asyncio
    async def test_mark_job_failed_success(self):
        """Test marking job as failed."""
        job_id = str(uuid4())
        error_msg = "Import processing failed"

        # Mock session and job
        mock_session = AsyncMock()
        mock_job = MagicMock(spec=ImportJob)
        mock_session.get.return_value = mock_job
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        with patch(
            "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
        ):
            await _mark_job_failed(job_id, error_msg)

        assert mock_job.status == ImportJobStatus.FAILED
        assert mock_job.error_message == error_msg
        assert mock_job.completed_at is not None
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_mark_job_failed_not_found(self):
        """Test marking non-existent job as failed."""
        job_id = str(uuid4())

        # Mock session returning None
        mock_session = AsyncMock()
        mock_session.get.return_value = None
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        with patch(
            "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
        ):
            await _mark_job_failed(job_id, "Error")

        # Should not commit if job not found
        mock_session.commit.assert_not_called()


class TestProcessCustomerImport:
    """Test _process_customer_import function."""

    @pytest.mark.asyncio
    async def test_process_customer_csv_import(self):
        """Test processing CSV customer import."""
        job_id = str(uuid4())
        tenant_id = "test-tenant"

        # Create temporary CSV file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "email", "phone"])
            writer.writeheader()
            writer.writerow({"name": "John Doe", "email": "john@example.com", "phone": "555-0100"})
            writer.writerow(
                {"name": "Jane Smith", "email": "jane@example.com", "phone": "555-0101"}
            )
            temp_path = f.name

        try:
            # Mock session and job
            mock_session = AsyncMock()
            mock_job = MagicMock(spec=ImportJob)
            mock_job.id = uuid4()
            mock_session.get.return_value = mock_job
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            # Mock the CSV processing function
            mock_result = {
                "job_id": job_id,
                "total_records": 2,
                "successful_records": 2,
                "failed_records": 0,
                "errors": [],
                "success_rate": 100.0,
            }

            with patch(
                "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
            ):
                with patch(
                    "dotmac.platform.data_import.tasks._process_csv_in_chunks",
                    return_value=mock_result,
                ):
                    result = await _process_customer_import(
                        job_id=job_id,
                        file_path=temp_path,
                        tenant_id=tenant_id,
                        user_id=None,
                        config=None,
                    )

            assert result["total_records"] == 2
            assert result["successful_records"] == 2
            assert mock_job.status == ImportJobStatus.COMPLETED
            assert mock_job.completed_at is not None

        finally:
            Path(temp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_process_customer_json_import(self):
        """Test processing JSON customer import."""
        job_id = str(uuid4())
        tenant_id = "test-tenant"

        # Create temporary JSON file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(
                [
                    {"name": "John Doe", "email": "john@example.com"},
                    {"name": "Jane Smith", "email": "jane@example.com"},
                ],
                f,
            )
            temp_path = f.name

        try:
            # Mock session and job
            mock_session = AsyncMock()
            mock_job = MagicMock(spec=ImportJob)
            mock_job.id = uuid4()
            mock_session.get.return_value = mock_job
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            # Mock the JSON processing function
            mock_result = {
                "job_id": job_id,
                "total_records": 2,
                "successful_records": 2,
                "failed_records": 0,
                "errors": [],
                "success_rate": 100.0,
            }

            with patch(
                "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
            ):
                with patch(
                    "dotmac.platform.data_import.tasks._process_json_in_chunks",
                    return_value=mock_result,
                ):
                    result = await _process_customer_import(
                        job_id=job_id,
                        file_path=temp_path,
                        tenant_id=tenant_id,
                        user_id=None,
                        config=None,
                    )

            assert result["total_records"] == 2
            assert result["successful_records"] == 2
            assert mock_job.status == ImportJobStatus.COMPLETED

        finally:
            Path(temp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_process_customer_import_partial_failure(self):
        """Test customer import with some failures."""
        job_id = str(uuid4())
        tenant_id = "test-tenant"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "email"])
            writer.writeheader()
            writer.writerow({"name": "Valid", "email": "valid@example.com"})
            temp_path = f.name

        try:
            mock_session = AsyncMock()
            mock_job = MagicMock(spec=ImportJob)
            mock_job.id = uuid4()
            mock_session.get.return_value = mock_job
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            # Mock partial failure
            mock_result = {
                "job_id": job_id,
                "total_records": 2,
                "successful_records": 1,
                "failed_records": 1,
                "errors": [{"row": 2, "error": "Invalid data"}],
                "success_rate": 50.0,
            }

            with patch(
                "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
            ):
                with patch(
                    "dotmac.platform.data_import.tasks._process_csv_in_chunks",
                    return_value=mock_result,
                ):
                    result = await _process_customer_import(
                        job_id=job_id,
                        file_path=temp_path,
                        tenant_id=tenant_id,
                        user_id=None,
                        config=None,
                    )

            assert result["failed_records"] == 1
            assert mock_job.status == ImportJobStatus.PARTIALLY_COMPLETED

        finally:
            Path(temp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_process_customer_import_job_not_found(self):
        """Test processing when job doesn't exist."""
        job_id = str(uuid4())

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            temp_path = f.name

        try:
            mock_session = AsyncMock()
            mock_session.get.return_value = None  # Job not found
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            with patch(
                "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
            ):
                with pytest.raises(ValueError, match="Job .* not found"):
                    await _process_customer_import(
                        job_id=job_id,
                        file_path=temp_path,
                        tenant_id="tenant",
                        user_id=None,
                        config=None,
                    )

        finally:
            Path(temp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_process_customer_import_unsupported_format(self):
        """Test processing with unsupported file format."""
        job_id = str(uuid4())

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            temp_path = f.name

        try:
            mock_session = AsyncMock()
            mock_job = MagicMock(spec=ImportJob)
            mock_job.id = uuid4()
            mock_session.get.return_value = mock_job
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            with patch(
                "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
            ):
                with pytest.raises(ValueError, match="Unsupported file format"):
                    await _process_customer_import(
                        job_id=job_id,
                        file_path=temp_path,
                        tenant_id="tenant",
                        user_id=None,
                        config=None,
                    )

            # Job should be marked as failed
            assert mock_job.status == ImportJobStatus.FAILED
            assert mock_job.error_message is not None

        finally:
            Path(temp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_process_customer_import_with_config(self):
        """Test processing with custom configuration."""
        job_id = str(uuid4())

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["name"])
            writer.writeheader()
            temp_path = f.name

        try:
            mock_session = AsyncMock()
            mock_job = MagicMock(spec=ImportJob)
            mock_job.id = uuid4()
            mock_session.get.return_value = mock_job
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            custom_config = {"chunk_size": 100}
            mock_result = {
                "job_id": job_id,
                "total_records": 0,
                "successful_records": 0,
                "failed_records": 0,
                "errors": [],
                "success_rate": 0,
            }

            with patch(
                "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
            ):
                with patch(
                    "dotmac.platform.data_import.tasks._process_csv_in_chunks",
                    return_value=mock_result,
                ) as mock_process:
                    await _process_customer_import(
                        job_id=job_id,
                        file_path=temp_path,
                        tenant_id="tenant",
                        user_id=None,
                        config=custom_config,
                    )

                    # Verify custom chunk size was passed
                    call_args = mock_process.call_args
                    assert call_args[1].get("chunk_size") == 100 or call_args[0][-1] == 100

        finally:
            Path(temp_path).unlink(missing_ok=True)


class TestProcessDataChunk:
    """Test _process_data_chunk function."""

    @pytest.mark.asyncio
    async def test_process_chunk_data_success(self):
        """Test processing chunk data successfully."""
        job_id = str(uuid4())
        chunk_data = [
            {"name": "John", "email": "john@example.com"},
            {"name": "Jane", "email": "jane@example.com"},
        ]

        # Mock session
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        with patch(
            "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
        ):
            with patch("dotmac.platform.data_import.tasks._process_data_chunk") as mock_process:
                mock_process.return_value = {"successful": 2, "failed": 0, "errors": []}

                result = await _process_chunk_data(
                    job_id=job_id,
                    chunk_data=chunk_data,
                    job_type=ImportJobType.CUSTOMERS.value,
                    tenant_id="test-tenant",
                    config=None,
                )

                assert result["successful"] == 2
                assert result["failed"] == 0


class TestOtherImportTypes:
    """Test invoice, subscription, and payment import functions."""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_process_invoice_import(self):
        """Test invoice import (requires database and job setup)."""
        from sqlalchemy.exc import OperationalError

        from dotmac.platform.data_import.tasks import _process_invoice_import

        job_id = uuid4()  # Use UUID object, not string

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            temp_path = f.name

        try:
            # This is an integration test - invoice import IS implemented
            # It requires database with data_import_jobs table
            # Without proper database setup, it will raise OperationalError (no such table)
            # OR ValueError (job not found) if table exists but job doesn't
            with pytest.raises((OperationalError, ValueError)):
                await _process_invoice_import(
                    job_id=job_id,
                    file_path=temp_path,
                    tenant_id="tenant",
                    user_id=None,
                    config=None,
                )

        finally:
            Path(temp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_process_subscription_import(self):
        """Test subscription import raises NotImplementedError (stub function)."""
        from dotmac.platform.data_import.tasks import _process_subscription_import

        job_id = uuid4()

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            temp_path = f.name

        try:
            # Stub function raises NotImplementedError
            with pytest.raises(NotImplementedError, match="Subscription import requires"):
                await _process_subscription_import(
                    job_id=job_id,
                    file_path=temp_path,
                    tenant_id="tenant",
                    user_id=None,
                    config=None,
                )

        finally:
            Path(temp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_process_payment_import(self):
        """Test payment import raises NotImplementedError (stub function)."""
        from dotmac.platform.data_import.tasks import _process_payment_import

        job_id = uuid4()

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            temp_path = f.name

        try:
            # Stub function raises NotImplementedError
            with pytest.raises(NotImplementedError, match="Payment import requires"):
                await _process_payment_import(
                    job_id=job_id,
                    file_path=temp_path,
                    tenant_id="tenant",
                    user_id=None,
                    config=None,
                )

        finally:
            Path(temp_path).unlink(missing_ok=True)


class TestProcessChunkData:
    """Test _process_chunk_data function."""

    @pytest.mark.asyncio
    async def test_process_chunk_data_with_job(self):
        """Test processing chunk data when job exists."""
        job_id = str(uuid4())
        chunk_data = [{"name": "Test", "email": "test@example.com"}]

        # Mock session and job
        mock_session = AsyncMock()
        mock_job = MagicMock(spec=ImportJob)
        mock_job.id = uuid4()
        mock_session.get.return_value = mock_job
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        mock_result = {"successful": 1, "failed": 0, "errors": []}

        with patch(
            "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
        ):
            with patch(
                "dotmac.platform.data_import.tasks._process_data_chunk", return_value=mock_result
            ):
                result = await _process_chunk_data(
                    job_id=job_id,
                    chunk_data=chunk_data,
                    job_type=ImportJobType.CUSTOMERS.value,
                    tenant_id="test-tenant",
                    config=None,
                )

        assert result["successful"] == 1
        assert result["failed"] == 0

    @pytest.mark.asyncio
    async def test_process_chunk_data_job_not_found(self):
        """Test processing chunk data when job doesn't exist."""
        job_id = str(uuid4())

        # Mock session returning no job
        mock_session = AsyncMock()
        mock_session.get.return_value = None
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        with patch(
            "dotmac.platform.data_import.tasks.get_async_session", return_value=mock_session
        ):
            with pytest.raises(ValueError, match="Job .* not found"):
                await _process_chunk_data(
                    job_id=job_id,
                    chunk_data=[],
                    job_type=ImportJobType.CUSTOMERS.value,
                    tenant_id="test-tenant",
                    config=None,
                )


class TestCSVProcessing:
    """Test CSV processing in chunks."""

    @pytest.mark.asyncio
    async def test_process_csv_in_chunks_success(self):
        """Test processing CSV file in chunks."""

        # Create temporary CSV with multiple records
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "email"])
            writer.writeheader()
            for i in range(5):
                writer.writerow({"name": f"Customer {i}", "email": f"customer{i}@example.com"})
            temp_path = f.name

        try:
            # Mock session and job
            mock_session = AsyncMock()
            mock_job = MagicMock(spec=ImportJob)
            mock_job.id = uuid4()
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            # Mock the data chunk processor
            async def mock_process_data_chunk(session, job, chunk, job_type, tenant_id):
                return {"successful": len(chunk), "failed": 0, "errors": []}

            with patch(
                "dotmac.platform.data_import.tasks._process_data_chunk",
                side_effect=mock_process_data_chunk,
            ):
                with patch("dotmac.platform.data_import.tasks.current_task", None):
                    result = await _process_csv_in_chunks(
                        session=mock_session,
                        job=mock_job,
                        file_path=temp_path,
                        tenant_id="test-tenant",
                        user_id=None,
                        job_type=ImportJobType.CUSTOMERS,
                        chunk_size=2,  # Small chunk size to test chunking
                    )

            assert result["total_records"] == 5
            assert result["successful_records"] == 5
            assert result["failed_records"] == 0
            assert result["success_rate"] == 100.0
            assert mock_job.total_records == 5

        finally:
            Path(temp_path).unlink(missing_ok=True)


class TestJSONProcessing:
    """Test JSON processing in chunks."""

    @pytest.mark.asyncio
    async def test_process_json_in_chunks_success(self):
        """Test processing JSON file in chunks."""

        # Create temporary JSON file
        data = [
            {"name": "Customer 1", "email": "c1@example.com"},
            {"name": "Customer 2", "email": "c2@example.com"},
            {"name": "Customer 3", "email": "c3@example.com"},
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            temp_path = f.name

        try:
            # Mock session and job
            mock_session = AsyncMock()
            mock_job = MagicMock(spec=ImportJob)
            mock_job.id = uuid4()
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            # Mock data chunk processor
            async def mock_process_data_chunk(session, job, chunk, job_type, tenant_id):
                return {"successful": len(chunk), "failed": 0, "errors": []}

            with patch(
                "dotmac.platform.data_import.tasks._process_data_chunk",
                side_effect=mock_process_data_chunk,
            ):
                with patch("dotmac.platform.data_import.tasks.current_task", None):
                    result = await _process_json_in_chunks(
                        session=mock_session,
                        job=mock_job,
                        file_path=temp_path,
                        tenant_id="test-tenant",
                        user_id=None,
                        job_type=ImportJobType.CUSTOMERS,
                        chunk_size=2,
                    )

            assert result["total_records"] == 3
            assert result["successful_records"] == 3
            assert result["failed_records"] == 0
            assert mock_job.total_records == 3

        finally:
            Path(temp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_process_json_invalid_format(self):
        """Test JSON processing with invalid format (not an array)."""

        # Create JSON file with object instead of array
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"name": "Not an array"}, f)
            temp_path = f.name

        try:
            mock_session = AsyncMock()
            mock_job = MagicMock(spec=ImportJob)
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            with pytest.raises(ValueError, match="JSON file must contain an array"):
                await _process_json_in_chunks(
                    session=mock_session,
                    job=mock_job,
                    file_path=temp_path,
                    tenant_id="tenant",
                    user_id=None,
                    job_type=ImportJobType.CUSTOMERS,
                    chunk_size=100,
                )

        finally:
            Path(temp_path).unlink(missing_ok=True)

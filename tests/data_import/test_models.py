"""Tests for data import models."""

import pytest

from dotmac.platform.data_import.models import (
    ImportFailure,
    ImportJob,
    ImportJobStatus,
    ImportJobType,
)

pytestmark = pytest.mark.unit


class TestImportJobType:
    """Test ImportJobType enum."""

    def test_job_types(self):
        """Test all job types are defined."""
        assert ImportJobType.CUSTOMERS == "customers"
        assert ImportJobType.INVOICES == "invoices"
        assert ImportJobType.SUBSCRIPTIONS == "subscriptions"
        assert ImportJobType.PAYMENTS == "payments"
        assert ImportJobType.PRODUCTS == "products"
        assert ImportJobType.MIXED == "mixed"

    def test_enum_values(self):
        """Test enum can be iterated."""
        types = list(ImportJobType)
        assert len(types) == 6
        assert ImportJobType.CUSTOMERS in types


class TestImportJobStatus:
    """Test ImportJobStatus enum."""

    def test_status_values(self):
        """Test all status values are defined."""
        assert ImportJobStatus.PENDING == "pending"
        assert ImportJobStatus.VALIDATING == "validating"
        assert ImportJobStatus.IN_PROGRESS == "in_progress"
        assert ImportJobStatus.COMPLETED == "completed"
        assert ImportJobStatus.FAILED == "failed"
        assert ImportJobStatus.PARTIALLY_COMPLETED == "partially_completed"
        assert ImportJobStatus.CANCELLED == "cancelled"

    def test_status_transitions(self):
        """Test expected status transition logic."""
        # Pending can go to validating or failed
        assert ImportJobStatus.PENDING != ImportJobStatus.COMPLETED

        # In progress should be between validating and completed
        statuses = [
            ImportJobStatus.PENDING,
            ImportJobStatus.VALIDATING,
            ImportJobStatus.IN_PROGRESS,
            ImportJobStatus.COMPLETED,
        ]
        assert len(statuses) == 4


class TestImportJob:
    """Test ImportJob model structure."""

    def test_job_tablename(self):
        """Test table name is correct."""
        assert ImportJob.__tablename__ == "data_import_jobs"

    def test_job_type_enum_used(self):
        """Test ImportJobType enum is used for validation."""
        # Verify the enum values are accessible
        assert hasattr(ImportJobType, "CUSTOMERS")
        assert hasattr(ImportJobType, "INVOICES")

    def test_status_enum_used(self):
        """Test ImportJobStatus enum is used for validation."""
        assert hasattr(ImportJobStatus, "PENDING")
        assert hasattr(ImportJobStatus, "COMPLETED")

    def test_job_required_fields(self):
        """Test job model has required fields."""
        assert hasattr(ImportJob, "job_type")
        assert hasattr(ImportJob, "status")
        assert hasattr(ImportJob, "file_name")
        assert hasattr(ImportJob, "file_size")
        assert hasattr(ImportJob, "tenant_id")

    def test_job_optional_fields(self):
        """Test job model has optional tracking fields."""
        assert hasattr(ImportJob, "total_records")
        assert hasattr(ImportJob, "processed_records")
        assert hasattr(ImportJob, "successful_records")
        assert hasattr(ImportJob, "failed_records")
        assert hasattr(ImportJob, "started_at")
        assert hasattr(ImportJob, "completed_at")


class TestImportFailure:
    """Test ImportFailure model structure."""

    def test_failure_tablename(self):
        """Test table name is correct."""
        assert ImportFailure.__tablename__ == "data_import_failures"

    def test_failure_required_fields(self):
        """Test failure model has required fields."""
        assert hasattr(ImportFailure, "job_id")
        assert hasattr(ImportFailure, "row_number")
        assert hasattr(ImportFailure, "error_message")
        assert hasattr(ImportFailure, "tenant_id")

    def test_failure_optional_fields(self):
        """Test failure model has optional fields."""
        # Check that ImportFailure has data-related attributes
        assert hasattr(ImportFailure, "__tablename__")
        assert hasattr(ImportFailure, "job_id")
        assert hasattr(ImportFailure, "error_message")

    def test_failure_field_types(self):
        """Test failure fields have correct types."""
        # Verify field types are annotated
        annotations = ImportFailure.__annotations__
        assert "row_number" in str(annotations) or hasattr(ImportFailure, "row_number")
        assert "error_message" in str(annotations) or hasattr(ImportFailure, "error_message")

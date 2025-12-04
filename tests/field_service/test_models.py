"""Tests for field service models."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from dotmac.platform.field_service.models import (
    Technician,
    TechnicianLocationHistory,
    TechnicianStatus,
)

pytestmark = pytest.mark.unit


def test_technician_model_creation():
    """Test basic Technician model instantiation."""
    technician = Technician(
        id=uuid4(),
        tenant_id="test-tenant",
        employee_id="EMP001",
        first_name="John",
        last_name="Doe",
        email="john.doe@example.com",
        phone="+1234567890",
        status=TechnicianStatus.AVAILABLE,
    )

    assert technician.full_name == "John Doe"
    assert technician.email == "john.doe@example.com"
    assert technician.status == TechnicianStatus.AVAILABLE


def test_technician_model_full_name_property():
    """Test Technician full_name property."""
    technician = Technician(
        id=uuid4(),
        tenant_id="test-tenant",
        employee_id="EMP002",
        first_name="Jane",
        last_name="Smith",
        email="jane.smith@example.com",
    )

    assert technician.full_name == "Jane Smith"


def test_technician_location_history_model():
    """Test TechnicianLocationHistory model instantiation."""
    location = TechnicianLocationHistory(
        id=uuid4(),
        tenant_id="test-tenant",
        technician_id=uuid4(),
        latitude=40.7128,
        longitude=-74.0060,
        recorded_at=datetime.now(UTC),
    )

    assert location.latitude == 40.7128
    assert location.longitude == -74.0060
    assert isinstance(location.recorded_at, datetime)

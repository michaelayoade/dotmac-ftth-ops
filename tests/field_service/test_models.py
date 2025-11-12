"""Tests for field service models."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

pytestmark = pytest.mark.unit


def test_technician_model_creation():
    """Test basic Technician model instantiation."""
    from dotmac.platform.field_service.models import Technician

    technician = Technician(
        id=uuid4(),
        tenant_id=uuid4(),
        name="John Doe",
        email="john.doe@example.com",
        phone="+1234567890",
        status="available",
    )

    assert technician.name == "John Doe"
    assert technician.email == "john.doe@example.com"
    assert technician.status == "available"


def test_job_model_creation():
    """Test basic Job model instantiation."""
    from dotmac.platform.field_service.models import Job

    job = Job(
        id=uuid4(),
        tenant_id=uuid4(),
        title="Fiber Installation",
        description="Install fiber for customer",
        priority="high",
        status="pending",
    )

    assert job.title == "Fiber Installation"
    assert job.priority == "high"
    assert job.status == "pending"


def test_location_tracking_model():
    """Test LocationTracking model instantiation."""
    from dotmac.platform.field_service.models import LocationTracking

    location = LocationTracking(
        id=uuid4(),
        technician_id=uuid4(),
        latitude=40.7128,
        longitude=-74.0060,
        timestamp=datetime.now(UTC),
    )

    assert location.latitude == 40.7128
    assert location.longitude == -74.0060
    assert isinstance(location.timestamp, datetime)

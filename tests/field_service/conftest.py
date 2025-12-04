"""Field service test fixtures."""

import pytest


@pytest.fixture
def sample_technician_data():
    """Sample technician data for testing."""
    return {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "status": "available",
        "skills": ["fiber_splicing", "otdr", "installation"],
    }


@pytest.fixture
def sample_job_data():
    """Sample job data for testing."""
    return {
        "title": "Fiber Installation",
        "description": "Install fiber connection for customer",
        "priority": "high",
        "scheduled_start": "2025-11-10T09:00:00Z",
        "scheduled_end": "2025-11-10T11:00:00Z",
        "location_lat": 40.7128,
        "location_lng": -74.0060,
    }

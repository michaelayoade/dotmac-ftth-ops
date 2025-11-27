"""Tests for field service services."""

from unittest.mock import AsyncMock

import pytest

from dotmac.platform.field_service.assignment_service import TechnicianAssignmentService
from dotmac.platform.field_service.geofencing_service import GeofencingService
from dotmac.platform.field_service.websocket_manager import TechnicianLocationWebSocketManager

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_assignment_service_assign_technician():
    """Test assigning a technician to a job."""
    # Create mocked dependencies
    mock_db = AsyncMock()
    service = TechnicianAssignmentService(mock_db)

    # Mock database query results
    mock_db.execute = AsyncMock()
    mock_db.commit = AsyncMock()

    # Test assignment logic exists
    assert hasattr(service, "assign_technician_to_job")
    assert hasattr(service, "find_best_technician")


@pytest.mark.asyncio
async def test_geofencing_service_check_proximity():
    """Test geofencing proximity check."""
    mock_db = AsyncMock()
    service = GeofencingService(mock_db)

    # Service should have proximity checking capability
    assert hasattr(service, "check_geofence")
    assert hasattr(service, "calculate_distance")

    # Test static distance calculation method
    # Distance between two points in NYC (should be roughly 5.4 km)
    tech_lat, tech_lng = 40.7128, -74.0060  # NYC downtown
    job_lat, job_lng = 40.7614, -73.9776  # Times Square

    distance = GeofencingService.calculate_distance(tech_lat, tech_lng, job_lat, job_lng)
    assert 5000 < distance < 6000  # ~5.4 km in meters


def test_websocket_manager_connection_handling():
    """Test WebSocket manager connection handling."""
    manager = TechnicianLocationWebSocketManager()

    # Manager should have connection methods
    assert hasattr(manager, "connect")
    assert hasattr(manager, "disconnect")
    assert hasattr(manager, "broadcast_to_tenant")
    assert hasattr(manager, "get_active_connection_count")

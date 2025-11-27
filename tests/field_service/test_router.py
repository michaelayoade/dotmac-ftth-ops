"""Tests for field service router endpoints."""

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.unit


def test_router_health_check(test_app):
    """Test field service router can be included."""
    from dotmac.platform.field_service.router import router

    test_app.include_router(router, prefix="/api/v1")
    # Create test client to verify app can be instantiated
    _ = TestClient(test_app)

    # Router has /field-service prefix
    assert router.prefix == "/field-service"


def test_technician_list_endpoint_structure(test_app):
    """Test that technician list endpoint exists."""
    from dotmac.platform.field_service.router import router

    # Verify router has expected routes
    route_paths = [route.path for route in router.routes]

    # Check for expected endpoints (adjust based on actual implementation)
    assert any("technician" in path.lower() for path in route_paths)

"""Tests for geo router endpoints."""

import pytest

pytestmark = pytest.mark.unit


def test_geo_router_import():
    """Test that geo router can be imported."""
    from dotmac.platform.geo import router

    assert router is not None
    # The module exports an APIRouter instance named 'router'
    assert hasattr(router, "router")
    # The router instance has routes
    assert hasattr(router.router, "routes")


def test_geocoding_service_available():
    """Test that geocoding services are available."""
    try:
        from dotmac.platform.geo import service

        assert service is not None
    except ImportError:
        # Service might not be implemented yet
        pytest.skip("Geo service not yet implemented")

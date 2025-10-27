"""
Integration tests for Fiber Infrastructure REST API.

Tests all fiber REST API endpoints with real database operations.
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fiber.models import (
    CableInstallationType,
    FiberCable,
    FiberCableStatus,
    FiberType,
    ServiceArea,
    ServiceAreaType,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def fiber_cable(db_session: AsyncSession, test_tenant_id: str) -> FiberCable:
    """Create a test fiber cable."""
    cable = FiberCable(
        cable_id="FC-TEST-001",
        name="Test Fiber Cable",
        fiber_type=FiberType.SINGLE_MODE,
        fiber_count=24,
        status=FiberCableStatus.ACTIVE,
        installation_type=CableInstallationType.UNDERGROUND,
        length_km=5.5,
        manufacturer="Corning",
        model="SMF-28",
        attenuation_db_per_km=0.35,
        max_capacity=100,
        tenant_id=test_tenant_id,
        created_by="test@example.com",
    )
    db_session.add(cable)
    await db_session.commit()
    await db_session.refresh(cable)
    return cable


@pytest_asyncio.fixture
async def service_area(db_session: AsyncSession, test_tenant_id: str) -> ServiceArea:
    """Create a test service area."""
    area = ServiceArea(
        area_id="SA-TEST-001",
        name="Test Service Area",
        area_type=ServiceAreaType.RESIDENTIAL,
        is_serviceable=True,
        homes_passed=500,
        homes_connected=250,
        tenant_id=test_tenant_id,
        created_by="test@example.com",
    )
    db_session.add(area)
    await db_session.commit()
    await db_session.refresh(area)
    return area


# ============================================================================
# Fiber Cable API Tests
# ============================================================================


class TestFiberCableAPI:
    """Test fiber cable REST API endpoints."""

    async def test_create_fiber_cable(
        self,
        client: AsyncClient,
        test_tenant_id: str,
        auth_headers: dict,
    ):
        """Test creating a new fiber cable."""
        cable_data = {
            "cable_id": "FC-CREATE-001",
            "name": "New Test Cable",
            "fiber_type": "SINGLE_MODE",
            "fiber_count": 48,
            "installation_type": "AERIAL",
            "length_km": 3.2,
            "manufacturer": "Corning",
            "model": "SMF-28e",
            "attenuation_db_per_km": 0.30,
        }

        response = await client.post(
            "/api/v1/fiber/cables",
            json=cable_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["cable_id"] == "FC-CREATE-001"
        assert data["name"] == "New Test Cable"
        assert data["fiber_type"] == "SINGLE_MODE"
        assert data["fiber_count"] == 48
        assert data["status"] == "ACTIVE"
        assert "id" in data

    async def test_list_fiber_cables(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test listing fiber cables."""
        response = await client.get(
            "/api/v1/fiber/cables",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(c["cable_id"] == "FC-TEST-001" for c in data)

    async def test_list_fiber_cables_with_filters(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test listing fiber cables with status filter."""
        response = await client.get(
            "/api/v1/fiber/cables",
            params={"status": "ACTIVE", "limit": 10},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for cable in data:
            assert cable["status"] == "ACTIVE"

    async def test_get_fiber_cable(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test getting a single fiber cable."""
        response = await client.get(
            f"/api/v1/fiber/cables/{fiber_cable.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cable_id"] == "FC-TEST-001"
        assert data["name"] == "Test Fiber Cable"
        assert data["fiber_count"] == 24

    async def test_get_nonexistent_cable(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test getting a non-existent cable returns 404."""
        fake_id = str(uuid4())
        response = await client.get(
            f"/api/v1/fiber/cables/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_update_fiber_cable(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test updating a fiber cable."""
        update_data = {
            "name": "Updated Cable Name",
            "status": "MAINTENANCE",
            "length_km": 6.0,
        }

        response = await client.patch(
            f"/api/v1/fiber/cables/{fiber_cable.id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Cable Name"
        assert data["status"] == "MAINTENANCE"
        assert data["length_km"] == 6.0

    async def test_activate_fiber_cable(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test activating a fiber cable."""
        response = await client.post(
            f"/api/v1/fiber/cables/{fiber_cable.id}/activate",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ACTIVE"

    async def test_delete_fiber_cable(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test deleting a fiber cable."""
        response = await client.delete(
            f"/api/v1/fiber/cables/{fiber_cable.id}",
            headers=auth_headers,
        )

        assert response.status_code == 204

        # Verify cable is deleted
        get_response = await client.get(
            f"/api/v1/fiber/cables/{fiber_cable.id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 404


# ============================================================================
# Distribution Point API Tests
# ============================================================================


class TestDistributionPointAPI:
    """Test distribution point REST API endpoints."""

    async def test_create_distribution_point(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test creating a new distribution point."""
        dp_data = {
            "point_id": "DP-CREATE-001",
            "point_type": "FDH",
            "name": "Test Distribution Hub",
            "total_ports": 96,
            "used_ports": 48,
            "manufacturer": "CommScope",
            "model": "FDH-96",
        }

        response = await client.post(
            "/api/v1/fiber/distribution-points",
            json=dp_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["point_id"] == "DP-CREATE-001"
        assert data["point_type"] == "FDH"
        assert data["total_ports"] == 96
        assert data["used_ports"] == 48

    async def test_list_distribution_points(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test listing distribution points."""
        # Create a test point first
        dp_data = {
            "point_id": "DP-LIST-001",
            "point_type": "FDT",
            "total_ports": 48,
        }
        await client.post(
            "/api/v1/fiber/distribution-points",
            json=dp_data,
            headers=auth_headers,
        )

        response = await client.get(
            "/api/v1/fiber/distribution-points",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_get_port_utilization(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test getting port utilization for a distribution point."""
        # Create a test point
        dp_data = {
            "point_id": "DP-UTIL-001",
            "point_type": "SPLITTER",
            "total_ports": 100,
            "used_ports": 85,
        }
        create_response = await client.post(
            "/api/v1/fiber/distribution-points",
            json=dp_data,
            headers=auth_headers,
        )
        dp_id = create_response.json()["id"]

        # Get utilization
        response = await client.get(
            f"/api/v1/fiber/distribution-points/{dp_id}/utilization",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_ports"] == 100
        assert data["used_ports"] == 85
        assert data["available_ports"] == 15
        assert data["utilization_percentage"] == 85.0
        assert data["is_near_capacity"] is True


# ============================================================================
# Service Area API Tests
# ============================================================================


class TestServiceAreaAPI:
    """Test service area REST API endpoints."""

    async def test_create_service_area(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test creating a new service area."""
        area_data = {
            "area_id": "SA-CREATE-001",
            "name": "New Residential Area",
            "area_type": "RESIDENTIAL",
            "is_serviceable": True,
            "homes_passed": 1000,
            "homes_connected": 350,
        }

        response = await client.post(
            "/api/v1/fiber/service-areas",
            json=area_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["area_id"] == "SA-CREATE-001"
        assert data["name"] == "New Residential Area"
        assert data["area_type"] == "RESIDENTIAL"
        assert data["homes_passed"] == 1000
        assert data["homes_connected"] == 350

    async def test_list_service_areas(
        self,
        client: AsyncClient,
        service_area: ServiceArea,
        auth_headers: dict,
    ):
        """Test listing service areas."""
        response = await client.get(
            "/api/v1/fiber/service-areas",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(a["area_id"] == "SA-TEST-001" for a in data)

    async def test_get_coverage_statistics(
        self,
        client: AsyncClient,
        service_area: ServiceArea,
        auth_headers: dict,
    ):
        """Test getting coverage statistics for a service area."""
        response = await client.get(
            f"/api/v1/fiber/service-areas/{service_area.id}/coverage",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["area_id"] == "SA-TEST-001"
        assert "residential" in data
        assert "commercial" in data
        assert "total" in data
        assert data["residential"]["passed"] == 500
        assert data["residential"]["connected"] == 250


# ============================================================================
# Health Metrics & OTDR API Tests
# ============================================================================


class TestHealthMetricsAPI:
    """Test health metrics and OTDR REST API endpoints."""

    async def test_record_health_metric(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test recording a health metric."""
        metric_data = {
            "cable_id": str(fiber_cable.id),
            "health_status": "GOOD",
            "health_score": 85.5,
            "total_loss_db": 2.5,
            "splice_loss_db": 0.8,
            "connector_loss_db": 0.5,
        }

        response = await client.post(
            "/api/v1/fiber/health-metrics",
            json=metric_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["cable_id"] == str(fiber_cable.id)
        assert data["health_status"] == "GOOD"
        assert data["health_score"] == 85.5

    async def test_list_health_metrics(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test listing health metrics."""
        # Create a metric first
        metric_data = {
            "cable_id": str(fiber_cable.id),
            "health_status": "EXCELLENT",
            "health_score": 95.0,
        }
        await client.post(
            "/api/v1/fiber/health-metrics",
            json=metric_data,
            headers=auth_headers,
        )

        response = await client.get(
            "/api/v1/fiber/health-metrics",
            params={"cable_id": str(fiber_cable.id)},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_record_otdr_test(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test recording an OTDR test result."""
        otdr_data = {
            "cable_id": str(fiber_cable.id),
            "strand_id": 1,
            "wavelength_nm": 1550,
            "pulse_width_ns": 100,
            "total_loss_db": 3.2,
            "length_km": 5.4,
            "events_detected": 2,
            "pass_fail": True,
            "tester_id": "TECH-001",
        }

        response = await client.post(
            "/api/v1/fiber/otdr-tests",
            json=otdr_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["cable_id"] == str(fiber_cable.id)
        assert data["strand_id"] == 1
        assert data["wavelength_nm"] == 1550
        assert data["pass_fail"] is True

    async def test_list_otdr_tests(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test listing OTDR test results."""
        # Create a test first
        otdr_data = {
            "cable_id": str(fiber_cable.id),
            "strand_id": 2,
            "total_loss_db": 2.8,
            "pass_fail": True,
        }
        await client.post(
            "/api/v1/fiber/otdr-tests",
            json=otdr_data,
            headers=auth_headers,
        )

        response = await client.get(
            "/api/v1/fiber/otdr-tests",
            params={"cable_id": str(fiber_cable.id)},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


# ============================================================================
# Analytics API Tests
# ============================================================================


class TestAnalyticsAPI:
    """Test fiber analytics REST API endpoints."""

    async def test_network_health_summary(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test getting network health summary."""
        response = await client.get(
            "/api/v1/fiber/analytics/network-health",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_cables" in data
        assert "cables_by_status" in data
        assert "health_by_status" in data
        assert isinstance(data["cables_by_status"], dict)

    async def test_capacity_planning(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test getting capacity planning data."""
        # Create a distribution point first
        dp_data = {
            "point_id": "DP-CAPACITY-001",
            "point_type": "FDH",
            "total_ports": 100,
            "used_ports": 90,
        }
        await client.post(
            "/api/v1/fiber/distribution-points",
            json=dp_data,
            headers=auth_headers,
        )

        response = await client.get(
            "/api/v1/fiber/analytics/capacity-planning",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_distribution_points" in data
        assert "total_ports" in data
        assert "used_ports" in data
        assert "available_ports" in data
        assert "utilization_percentage" in data
        assert "points_near_capacity" in data

    async def test_coverage_summary(
        self,
        client: AsyncClient,
        service_area: ServiceArea,
        auth_headers: dict,
    ):
        """Test getting coverage summary."""
        response = await client.get(
            "/api/v1/fiber/analytics/coverage-summary",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_service_areas" in data
        assert "serviceable_areas" in data
        assert "residential" in data
        assert "commercial" in data


# ============================================================================
# Validation Tests
# ============================================================================


class TestValidation:
    """Test API validation and error handling."""

    async def test_create_cable_invalid_fiber_count(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test creating cable with invalid fiber count."""
        cable_data = {
            "cable_id": "FC-INVALID-001",
            "fiber_type": "SINGLE_MODE",
            "fiber_count": 0,  # Invalid
        }

        response = await client.post(
            "/api/v1/fiber/cables",
            json=cable_data,
            headers=auth_headers,
        )

        assert response.status_code == 422

    async def test_create_cable_duplicate_cable_id(
        self,
        client: AsyncClient,
        fiber_cable: FiberCable,
        auth_headers: dict,
    ):
        """Test creating cable with duplicate cable_id."""
        cable_data = {
            "cable_id": "FC-TEST-001",  # Already exists
            "fiber_type": "SINGLE_MODE",
            "fiber_count": 24,
        }

        response = await client.post(
            "/api/v1/fiber/cables",
            json=cable_data,
            headers=auth_headers,
        )

        assert response.status_code == 400

    async def test_unauthorized_access(
        self,
        client: AsyncClient,
    ):
        """Test accessing API without authentication."""
        response = await client.get("/api/v1/fiber/cables")

        assert response.status_code == 401

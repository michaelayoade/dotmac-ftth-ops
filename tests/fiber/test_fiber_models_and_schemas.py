"""
Tests for Fiber Infrastructure Models and Schemas

Comprehensive tests for fiber cable, distribution point, service area,
splice point, health metrics, and OTDR test models and schemas.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from pydantic import ValidationError

from dotmac.platform.fiber.models import (
    FiberCable,
    DistributionPoint,
    ServiceArea,
    SplicePoint,
    FiberHealthMetric,
    OTDRTestResult,
    FiberType,
    FiberCableStatus,
    CableInstallationType,
    DistributionPointType,
    ServiceAreaType,
    SpliceStatus,
    FiberHealthStatus,
)
from dotmac.platform.fiber.schemas import (
    FiberCableCreate,
    FiberCableUpdate,
    FiberCableResponse,
    DistributionPointCreate,
    DistributionPointUpdate,
    DistributionPointResponse,
    ServiceAreaCreate,
    ServiceAreaUpdate,
    ServiceAreaResponse,
    SplicePointCreate,
    SplicePointUpdate,
    SplicePointResponse,
    HealthMetricCreate,
    HealthMetricResponse,
    OTDRTestCreate,
    OTDRTestResponse,
)


# ============================================================================
# Fiber Cable Schema Tests
# ============================================================================


class TestFiberCableSchemas:
    """Test fiber cable schema validation and serialization."""

    def test_create_fiber_cable_minimum_fields(self):
        """Test creating fiber cable with minimum required fields."""
        cable = FiberCableCreate(
            cable_id="FC-001",
            fiber_type=FiberType.SINGLE_MODE,
            fiber_count=12,
        )
        assert cable.cable_id == "FC-001"
        assert cable.fiber_type == FiberType.SINGLE_MODE
        assert cable.fiber_count == 12
        assert cable.name is None
        assert cable.installation_type is None

    def test_create_fiber_cable_all_fields(self):
        """Test creating fiber cable with all fields populated."""
        cable = FiberCableCreate(
            cable_id="FC-002",
            name="Main Trunk Line A",
            fiber_type=FiberType.SINGLE_MODE,
            fiber_count=144,
            installation_type=CableInstallationType.UNDERGROUND,
            start_site_id="SITE-001",
            end_site_id="SITE-002",
            length_km=5.2,
            route_geojson={"type": "LineString", "coordinates": [[0, 0], [1, 1]]},
            manufacturer="Corning",
            model="SMF-28",
            installation_date=datetime.now(),
            warranty_expiry_date=datetime.now() + timedelta(days=365 * 25),
            attenuation_db_per_km=0.35,
            max_capacity=1000,
            notes="High-capacity trunk cable",
        )
        assert cable.name == "Main Trunk Line A"
        assert cable.fiber_count == 144
        assert cable.length_km == 5.2
        assert cable.manufacturer == "Corning"

    def test_create_fiber_cable_invalid_fiber_count(self):
        """Test fiber count validation (must be > 0)."""
        with pytest.raises(ValidationError) as exc_info:
            FiberCableCreate(
                cable_id="FC-003",
                fiber_type=FiberType.SINGLE_MODE,
                fiber_count=0,  # Invalid
            )
        assert "greater than 0" in str(exc_info.value)

    def test_create_fiber_cable_invalid_length(self):
        """Test length validation (must be > 0 if provided)."""
        with pytest.raises(ValidationError) as exc_info:
            FiberCableCreate(
                cable_id="FC-004",
                fiber_type=FiberType.MULTI_MODE,
                fiber_count=24,
                length_km=-1.5,  # Invalid
            )
        assert "greater than 0" in str(exc_info.value)

    def test_update_fiber_cable_schema(self):
        """Test fiber cable update schema."""
        update = FiberCableUpdate(
            name="Updated Cable Name",
            status=FiberCableStatus.ACTIVE,
            attenuation_db_per_km=0.40,
        )
        assert update.name == "Updated Cable Name"
        assert update.status == FiberCableStatus.ACTIVE
        # fiber_type is not in FiberCableUpdate schema

    def test_fiber_cable_response_schema(self):
        """Test fiber cable response schema with from_attributes."""
        cable_data = {
            "id": uuid4(),
            "cable_id": "FC-005",
            "name": "Test Cable",
            "fiber_type": FiberType.SINGLE_MODE,
            "fiber_count": 48,
            "status": FiberCableStatus.ACTIVE,
            "installation_type": CableInstallationType.AERIAL,
            "start_site_id": "SITE-A",
            "end_site_id": "SITE-B",
            "length_km": 2.5,
            "route_geojson": None,
            "manufacturer": "Prysmian",
            "model": "SM-48",
            "installation_date": datetime.now(),
            "warranty_expiry_date": None,
            "attenuation_db_per_km": 0.38,
            "max_capacity": 500,
            "notes": None,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "user@example.com",
            "updated_by": "user@example.com",
            "tenant_id": "tenant-001",
        }
        response = FiberCableResponse(**cable_data)
        assert str(response.id) == str(cable_data["id"])
        assert response.cable_id == "FC-005"
        assert response.fiber_count == 48


# ============================================================================
# Distribution Point Schema Tests
# ============================================================================


class TestDistributionPointSchemas:
    """Test distribution point schema validation."""

    def test_create_distribution_point_minimum(self):
        """Test creating distribution point with minimum fields."""
        dp = DistributionPointCreate(
            point_id="DP-001",
            point_type=DistributionPointType.FDH,
        )
        assert dp.point_id == "DP-001"
        assert dp.point_type == DistributionPointType.FDH
        assert dp.used_ports == 0  # Default value

    def test_create_distribution_point_full(self):
        """Test creating distribution point with all fields."""
        dp = DistributionPointCreate(
            point_id="DP-002",
            point_type=DistributionPointType.FDT,
            name="Main Street Cabinet",
            site_id="SITE-MAIN",
            location_geojson={"type": "Point", "coordinates": [0, 0]},
            address="123 Main St, City, State 12345",
            total_ports=96,
            used_ports=48,
            manufacturer="CommScope",
            model="CF-96",
            installation_date=datetime.now(),
            notes="Street-level distribution cabinet",
        )
        assert dp.name == "Main Street Cabinet"
        assert dp.total_ports == 96
        assert dp.used_ports == 48

    def test_create_distribution_point_invalid_ports(self):
        """Test port validation."""
        with pytest.raises(ValidationError) as exc_info:
            DistributionPointCreate(
                point_id="DP-003",
                point_type=DistributionPointType.SPLITTER,
                total_ports=0,  # Invalid
            )
        assert "greater than 0" in str(exc_info.value)

        with pytest.raises(ValidationError) as exc_info:
            DistributionPointCreate(
                point_id="DP-004",
                point_type=DistributionPointType.SPLITTER,
                used_ports=-5,  # Invalid
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_port_utilization_response(self):
        """Test port utilization calculation in response."""
        from dotmac.platform.fiber.schemas import PortUtilizationResponse

        util = PortUtilizationResponse(
            point_id="DP-005",
            total_ports=100,
            used_ports=85,
            available_ports=15,
            utilization_percentage=85.0,
            is_full=False,
            is_near_capacity=True,
        )
        assert util.utilization_percentage == 85.0
        assert util.is_near_capacity is True
        assert util.is_full is False


# ============================================================================
# Service Area Schema Tests
# ============================================================================


class TestServiceAreaSchemas:
    """Test service area schema validation."""

    def test_create_service_area_minimum(self):
        """Test creating service area with minimum fields."""
        area = ServiceAreaCreate(
            area_id="SA-001",
            name="Residential Area A",
            area_type=ServiceAreaType.RESIDENTIAL,
        )
        assert area.area_id == "SA-001"
        assert area.name == "Residential Area A"
        assert area.is_serviceable is False  # Default
        assert area.homes_passed == 0  # Default

    def test_create_service_area_full(self):
        """Test creating service area with all fields."""
        area = ServiceAreaCreate(
            area_id="SA-002",
            name="Downtown Business District",
            area_type=ServiceAreaType.COMMERCIAL,
            is_serviceable=True,
            coverage_geojson={"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]},
            postal_codes=["12345", "12346"],
            construction_status="COMPLETED",
            go_live_date=datetime.now(),
            homes_passed=500,
            homes_connected=350,
            businesses_passed=50,
            businesses_connected=42,
            notes="High-penetration business area",
        )
        assert area.is_serviceable is True
        assert area.homes_passed == 500
        assert area.homes_connected == 350
        assert len(area.postal_codes) == 2

    def test_service_area_invalid_counts(self):
        """Test service area count validation."""
        with pytest.raises(ValidationError) as exc_info:
            ServiceAreaCreate(
                area_id="SA-003",
                name="Test Area",
                area_type=ServiceAreaType.MIXED,
                homes_passed=-10,  # Invalid
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_coverage_statistics_response(self):
        """Test coverage statistics response calculation."""
        from dotmac.platform.fiber.schemas import CoverageStatisticsResponse

        stats = CoverageStatisticsResponse(
            area_id="SA-004",
            area_name="Suburban Area",
            area_type="residential",
            is_serviceable=True,
            residential={
                "passed": 1000,
                "connected": 650,
                "penetration_rate": 65.0,
            },
            commercial={
                "passed": 0,
                "connected": 0,
                "penetration_rate": 0.0,
            },
            total={
                "passed": 1000,
                "connected": 650,
                "penetration_rate": 65.0,
            },
        )
        assert stats.residential["penetration_rate"] == 65.0


# ============================================================================
# Splice Point Schema Tests
# ============================================================================


class TestSplicePointSchemas:
    """Test splice point schema validation."""

    def test_create_splice_point_minimum(self):
        """Test creating splice point with minimum fields."""
        splice = SplicePointCreate(
            splice_id="SP-001",
            cable_id=uuid4(),
        )
        assert splice.splice_id == "SP-001"
        assert splice.distribution_point_id is None
        assert splice.splice_type is None

    def test_create_splice_point_full(self):
        """Test creating splice point with all fields."""
        splice = SplicePointCreate(
            splice_id="SP-002",
            cable_id=uuid4(),
            distribution_point_id=uuid4(),
            splice_type="fusion",
            location_geojson={"type": "Point", "coordinates": [0, 0]},
            enclosure_type="dome",
            insertion_loss_db=0.05,
            return_loss_db=55.0,
            last_test_date=datetime.now(),
            notes="Low-loss fusion splice",
        )
        assert splice.splice_type == "fusion"
        assert splice.insertion_loss_db == 0.05
        assert splice.return_loss_db == 55.0

    def test_splice_point_invalid_loss(self):
        """Test splice loss validation."""
        with pytest.raises(ValidationError) as exc_info:
            SplicePointCreate(
                splice_id="SP-003",
                cable_id=uuid4(),
                insertion_loss_db=-0.1,  # Invalid
            )
        assert "greater than or equal to 0" in str(exc_info.value)


# ============================================================================
# Health Metric Schema Tests
# ============================================================================


class TestHealthMetricSchemas:
    """Test health metric schema validation."""

    def test_create_health_metric_minimum(self):
        """Test creating health metric with minimum fields."""
        metric = HealthMetricCreate(
            cable_id=uuid4(),
            health_status=FiberHealthStatus.GOOD,
        )
        assert metric.health_status == FiberHealthStatus.GOOD
        assert metric.measured_at is None
        assert metric.health_score is None

    def test_create_health_metric_full(self):
        """Test creating health metric with all fields."""
        metric = HealthMetricCreate(
            cable_id=uuid4(),
            health_status=FiberHealthStatus.FAIR,
            measured_at=datetime.now(),
            health_score=75.5,
            total_loss_db=3.2,
            splice_loss_db=0.8,
            connector_loss_db=0.5,
            detected_issues=[
                {"type": "high_loss", "location_km": 2.5, "severity": "medium"}
            ],
            recommendations=["Test strand 12 at 2.5km", "Check splice quality"],
        )
        assert metric.health_score == 75.5
        assert metric.total_loss_db == 3.2
        assert len(metric.detected_issues) == 1
        assert len(metric.recommendations) == 2

    def test_health_metric_invalid_score(self):
        """Test health score validation (0-100)."""
        with pytest.raises(ValidationError) as exc_info:
            HealthMetricCreate(
                cable_id=uuid4(),
                health_status=FiberHealthStatus.EXCELLENT,
                health_score=150,  # Invalid
            )
        assert "less than or equal to 100" in str(exc_info.value)


# ============================================================================
# OTDR Test Schema Tests
# ============================================================================


class TestOTDRTestSchemas:
    """Test OTDR test result schema validation."""

    def test_create_otdr_test_minimum(self):
        """Test creating OTDR test with minimum fields."""
        test = OTDRTestCreate(
            cable_id=uuid4(),
            strand_id=1,
        )
        assert test.strand_id == 1
        assert test.events_detected == 0  # Default
        assert test.test_date is None

    def test_create_otdr_test_full(self):
        """Test creating OTDR test with all fields."""
        test = OTDRTestCreate(
            cable_id=uuid4(),
            strand_id=12,
            test_date=datetime.now(),
            wavelength_nm=1550,
            pulse_width_ns=100,
            total_loss_db=4.2,
            length_km=5.18,
            events_detected=3,
            events=[
                {"type": "splice", "distance_km": 1.2, "loss_db": 0.05},
                {"type": "splice", "distance_km": 2.8, "loss_db": 0.08},
                {"type": "connector", "distance_km": 5.1, "loss_db": 0.3},
            ],
            pass_fail=True,
            tester_id="TECH-001",
            notes="Baseline test after installation",
        )
        assert test.strand_id == 12
        assert test.wavelength_nm == 1550
        assert test.total_loss_db == 4.2
        assert test.events_detected == 3
        assert len(test.events) == 3
        assert test.pass_fail is True

    def test_otdr_test_invalid_strand(self):
        """Test strand_id validation (must be > 0)."""
        with pytest.raises(ValidationError) as exc_info:
            OTDRTestCreate(
                cable_id=uuid4(),
                strand_id=0,  # Invalid
            )
        assert "greater than 0" in str(exc_info.value)

    def test_otdr_test_invalid_length(self):
        """Test length validation."""
        with pytest.raises(ValidationError) as exc_info:
            OTDRTestCreate(
                cable_id=uuid4(),
                strand_id=1,
                length_km=-1.0,  # Invalid
            )
        assert "greater than or equal to 0" in str(exc_info.value)


# ============================================================================
# Integration Tests (Schema to Model)
# ============================================================================


class TestSchemaToModelIntegration:
    """Test schema to model conversion patterns."""

    def test_fiber_cable_create_to_model(self):
        """Test converting FiberCableCreate schema to model."""
        schema_data = FiberCableCreate(
            cable_id="FC-INT-001",
            name="Integration Test Cable",
            fiber_type=FiberType.SINGLE_MODE,
            fiber_count=48,
            installation_type=CableInstallationType.DIRECT_BURIAL,
            length_km=3.5,
        )

        # Simulate model creation from schema
        model_data = schema_data.model_dump()
        assert model_data["cable_id"] == "FC-INT-001"
        assert model_data["fiber_type"] == FiberType.SINGLE_MODE
        assert model_data["fiber_count"] == 48
        assert model_data["length_km"] == 3.5

    def test_distribution_point_response_from_model(self):
        """Test creating DistributionPointResponse from model data."""
        model_data = {
            "id": uuid4(),
            "point_id": "DP-INT-001",
            "point_type": DistributionPointType.FAT,
            "name": "Test Cabinet",
            "status": FiberCableStatus.ACTIVE,
            "site_id": "SITE-001",
            "location_geojson": None,
            "address": "123 Test St",
            "total_ports": 48,
            "used_ports": 24,
            "manufacturer": "Test Corp",
            "model": "TC-48",
            "installation_date": None,
            "notes": None,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": None,
            "updated_by": None,
            "tenant_id": "test-tenant",
        }

        response = DistributionPointResponse(**model_data)
        assert response.point_id == "DP-INT-001"
        assert response.total_ports == 48
        assert response.used_ports == 24


# ============================================================================
# Enum Validation Tests
# ============================================================================


class TestEnumValidation:
    """Test enum type validation in schemas."""

    def test_fiber_type_enum_values(self):
        """Test all FiberType enum values are valid."""
        for fiber_type in [
            FiberType.SINGLE_MODE,
            FiberType.MULTI_MODE,
        ]:
            cable = FiberCableCreate(
                cable_id=f"FC-{fiber_type.value}",
                fiber_type=fiber_type,
                fiber_count=24,
            )
            assert cable.fiber_type == fiber_type

    def test_cable_status_enum_values(self):
        """Test all FiberCableStatus enum values are valid."""
        for status in [
            FiberCableStatus.ACTIVE,
            FiberCableStatus.INACTIVE,
            FiberCableStatus.UNDER_CONSTRUCTION,
            FiberCableStatus.MAINTENANCE,
            FiberCableStatus.DAMAGED,
            FiberCableStatus.RETIRED,
        ]:
            update = FiberCableUpdate(status=status)
            assert update.status == status

    def test_installation_type_enum_values(self):
        """Test all CableInstallationType enum values are valid."""
        for install_type in [
            CableInstallationType.AERIAL,
            CableInstallationType.UNDERGROUND,
            CableInstallationType.DIRECT_BURIAL,
            CableInstallationType.DUCT,
        ]:
            cable = FiberCableCreate(
                cable_id=f"FC-{install_type.value}",
                fiber_type=FiberType.SINGLE_MODE,
                fiber_count=12,
                installation_type=install_type,
            )
            assert cable.installation_type == install_type

    def test_health_status_enum_values(self):
        """Test all FiberHealthStatus enum values are valid."""
        for health in [
            FiberHealthStatus.EXCELLENT,
            FiberHealthStatus.GOOD,
            FiberHealthStatus.FAIR,
            FiberHealthStatus.DEGRADED,
            FiberHealthStatus.CRITICAL,
        ]:
            metric = HealthMetricCreate(
                cable_id=uuid4(),
                health_status=health,
            )
            assert metric.health_status == health

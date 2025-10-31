
"""
Comprehensive tests for Access Network Router.

Tests OLT management, ONU provisioning, and driver operations through the
FastAPI router layer. Covers success, error, and edge cases.
"""

from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from dotmac.platform.access.drivers import (


    DeviceDiscovery,
    OLTAlarm,
    OltMetrics,
    ONUProvisionRequest,
    ONUProvisionResult,
)
from dotmac.platform.access.router import configure_access_service, get_access_service

from dotmac.platform.access.service import AccessNetworkService, OLTOverview
from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.voltha.schemas import (
    DeviceDetailResponse,
    DeviceListResponse,
    LogicalDeviceDetailResponse,
    LogicalDeviceListResponse,
    PONStatistics,
    VOLTHAAlarmListResponse,
    VOLTHAHealthResponse,
)




pytestmark = pytest.mark.integration

@pytest.fixture
def mock_access_service():
    """Create a mock AccessNetworkService."""
    return AsyncMock(spec=AccessNetworkService)


@pytest.fixture
def test_user():
    """Create a test user."""
    return UserInfo(
        user_id=str(uuid4()),
        tenant_id=f"test_tenant_{uuid4()}",
        email="test@example.com",
        is_platform_admin=True,  # Give admin access for testing
        username="testuser",
        roles=["admin"],
        permissions=["read", "write", "admin"],
    )


@pytest.fixture
def client(test_app: FastAPI, mock_access_service: AsyncMock, test_user: UserInfo):
    """Create test client with access router registered and mocked dependencies."""
    from dotmac.platform.access.router import router as access_router

    # Register the access router (router already has /access prefix)
    test_app.include_router(access_router, prefix="/api/v1")

    # Override authentication - CRITICAL for avoiding 403 errors
    test_app.dependency_overrides[get_current_user] = lambda: test_user

    # Override the access service dependency
    def override_get_access_service():
        return mock_access_service

    test_app.dependency_overrides[get_access_service] = override_get_access_service

    # Create client
    test_client = TestClient(test_app)

    # Wrap request method to add tenant header automatically
    original_request = test_client.request

    def request_with_tenant(method, url, **kwargs):
        # Add tenant header if not already present
        headers = kwargs.get('headers')
        if headers is None:
            headers = {}
        if 'X-Tenant-ID' not in headers and 'x-tenant-id' not in headers:
            headers['X-Tenant-ID'] = 'test-tenant'
        kwargs['headers'] = headers
        return original_request(method, url, **kwargs)

    test_client.request = request_with_tenant

    yield test_client

    # Cleanup
    test_app.dependency_overrides.clear()


class TestAccessNetworkHealth:
    """Test health check endpoints."""

    def test_health_check_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test successful health check."""
        mock_access_service.health = AsyncMock(
            return_value=VOLTHAHealthResponse(
                healthy=True,
                state="HEALTHY",
                message="All systems operational",
                total_devices=5,
            )
        )

        response = client.get("/api/v1/access/health")

        assert response.status_code == 200
        data = response.json()
        assert data["healthy"] is True
        assert data["state"] == "HEALTHY"
        assert data["message"] == "All systems operational"

    def test_health_check_unhealthy(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test health check when service is unhealthy."""
        mock_access_service.health = AsyncMock(
            return_value=VOLTHAHealthResponse(
                healthy=False,
                state="UNHEALTHY",
                message="Connection error",
                total_devices=0,
            )
        )

        response = client.get("/api/v1/access/health")

        assert response.status_code == 200
        data = response.json()
        assert data["healthy"] is False
        assert data["state"] == "UNHEALTHY"


class TestLogicalDevices:
    """Test logical device endpoints."""

    def test_list_logical_devices_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test listing logical devices."""
        mock_access_service.list_logical_devices = AsyncMock(
            return_value=LogicalDeviceListResponse(
                devices=[
                    {
                        "id": "logical_olt1",
                        "datapath_id": "0x1",
                        "desc": {"hardware_desc": "Simulation"},
                    }
                ],
                total=1,
            )
        )

        response = client.get("/api/v1/access/logical-devices")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["devices"]) == 1
        assert data["devices"][0]["id"] == "logical_olt1"

    def test_get_logical_device_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting a specific logical device."""
        device_id = "logical_olt1"
        mock_access_service.get_logical_device = AsyncMock(
            return_value=LogicalDeviceDetailResponse(
                device={
                    "id": device_id,
                    "datapath_id": "0x1",
                    "desc": {"hardware_desc": "Simulation", "software_desc": "v1.0"},
                    "ports": [],
                }
            )
        )

        response = client.get(f"/api/v1/access/logical-devices/{device_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["device"]["id"] == device_id
        assert "datapath_id" in data["device"]

    def test_get_logical_device_not_found(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting non-existent logical device."""
        mock_access_service.get_logical_device = AsyncMock(return_value=None)

        response = client.get("/api/v1/access/logical-devices/nonexistent")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestDevices:
    """Test device endpoints."""

    def test_list_devices_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test listing devices."""
        mock_access_service.list_devices = AsyncMock(
            return_value=DeviceListResponse(
                devices=[
                    {
                        "id": "olt1",
                        "type": "openolt",
                        "admin_state": "ENABLED",
                        "oper_status": "ACTIVE",
                    }
                ],
                total=1,
            )
        )

        response = client.get("/api/v1/access/devices")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["devices"][0]["id"] == "olt1"

    def test_get_device_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting a specific device."""
        device_id = "olt1"
        mock_access_service.get_device = AsyncMock(
            return_value=DeviceDetailResponse(
                device={
                    "id": device_id,
                    "type": "openolt",
                    "admin_state": "ENABLED",
                    "oper_status": "ACTIVE",
                    "connect_status": "REACHABLE",
                    "ports": [],
                }
            )
        )

        response = client.get(f"/api/v1/access/devices/{device_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["device"]["id"] == device_id
        assert data["device"]["type"] == "openolt"

    def test_get_device_not_found(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting non-existent device."""
        mock_access_service.get_device = AsyncMock(return_value=None)

        response = client.get("/api/v1/access/devices/nonexistent")

        assert response.status_code == 404


class TestDeviceOperations:
    """Test device operation endpoints."""

    def test_operate_device_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test successful device operation."""
        mock_access_service.operate_device = AsyncMock(return_value=True)

        response = client.post("/api/v1/access/devices/olt1/enable")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_operate_device_not_implemented(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test unsupported device operation."""
        mock_access_service.operate_device = AsyncMock(return_value=False)

        response = client.post("/api/v1/access/devices/olt1/unsupported_op")

        assert response.status_code == 501
        assert "not supported" in response.json()["detail"].lower()


class TestAlarms:
    """Test alarm endpoints."""

    def test_get_alarms_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting all alarms."""
        mock_access_service.get_alarms_v2 = AsyncMock(
            return_value=VOLTHAAlarmListResponse(
                alarms=[
                    {
                        "id": "alarm1",
                        "resource_id": "olt1",
                        "severity": "MAJOR",
                        "description": "ONU signal degradation",
                        "type": "EQUIPMENT",
                        "category": "PON",
                        "state": "RAISED",
                        "raised_ts": "2025-10-26T10:00:00Z",
                    }
                ],
                total=1,
                active=1,
                cleared=0,
            )
        )

        response = client.get("/api/v1/access/alarms")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["alarms"]) == 1

    def test_get_device_alarms_filtered(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting alarms for a specific device."""
        device_id = "olt1"
        mock_access_service.get_alarms_v2 = AsyncMock(
            return_value=VOLTHAAlarmListResponse(
                alarms=[
                    {
                        "id": "alarm1",
                        "resource_id": device_id,
                        "severity": "MAJOR",
                        "description": "Test alarm",
                        "type": "EQUIPMENT",
                        "category": "PON",
                        "state": "RAISED",
                        "raised_ts": "2025-10-26T10:00:00Z",
                    },
                    {
                        "id": "alarm2",
                        "resource_id": "olt2",
                        "severity": "MINOR",
                        "description": "Other alarm",
                        "type": "EQUIPMENT",
                        "category": "PON",
                        "state": "RAISED",
                        "raised_ts": "2025-10-26T10:00:01Z",
                    },
                ],
                total=2,
                active=2,
                cleared=0,
            )
        )

        response = client.get(f"/api/v1/access/devices/{device_id}/alarms")

        assert response.status_code == 200
        data = response.json()
        # Should only return alarms for the specified device
        assert all(alarm["resource_id"] == device_id for alarm in data["alarms"])

    def test_acknowledge_alarm_not_implemented(
        self,
        client: TestClient,
    ):
        """Test alarm acknowledgement (not yet implemented)."""
        response = client.post("/api/v1/access/alarms/alarm1/acknowledge")

        assert response.status_code == 501
        assert "not supported" in response.json()["detail"].lower()

    def test_clear_alarm_not_implemented(
        self,
        client: TestClient,
    ):
        """Test alarm clearing (not yet implemented)."""
        response = client.post("/api/v1/access/alarms/alarm1/clear")

        assert response.status_code == 501


class TestStatistics:
    """Test statistics endpoints."""

    def test_get_port_statistics(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting port statistics."""
        mock_access_service.get_port_statistics = AsyncMock(
            return_value={
                "rx_packets": 1000,
                "tx_packets": 900,
                "rx_bytes": 50000,
                "tx_bytes": 45000,
            }
        )

        response = client.get("/api/v1/access/devices/olt1/ports/1/statistics")

        assert response.status_code == 200
        data = response.json()
        assert "rx_packets" in data
        assert data["rx_packets"] == 1000

    def test_get_pon_statistics(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting PON statistics."""
        mock_access_service.get_statistics = AsyncMock(
            return_value=PONStatistics(
                total_olts=2,
                total_onus=10,
                active_onus=8,
                inactive_onus=2,
            )
        )

        response = client.get("/api/v1/access/statistics")

        assert response.status_code == 200
        data = response.json()
        assert data["total_olts"] == 2
        assert data["active_onus"] == 8


class TestOLTOperations:
    """Test OLT-specific operations."""

    def test_get_olt_overview(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test getting OLT overview."""
        olt_id = "olt1"
        mock_access_service.get_olt_overview = AsyncMock(
            return_value=OLTOverview(
                device_id=olt_id,
                serial_number="ABCD12345678",
                model="OLT-4000",
                firmware_version="1.0.0",
                admin_state="ENABLED",
                oper_status="ACTIVE",
                connect_status="REACHABLE",
                total_onus=5,
                online_onus=4,
                total_pon_ports=8,
                active_pon_ports=8,
                pon_ports=[],
            )
        )

        response = client.get(f"/api/v1/access/olts/{olt_id}/overview")

        assert response.status_code == 200
        data = response.json()
        assert data["device_id"] == olt_id
        assert data["total_onus"] == 5

    def test_list_onus_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test listing ONUs for an OLT."""
        olt_id = "olt1"
        mock_access_service.list_onus = AsyncMock(
            return_value=[
                DeviceDiscovery(
                    serial_number="ABCD12345678",
                    onu_id="1",
                    state="ACTIVE",
                    rssi=-25.5,
                    metadata={"vendor": "Huawei", "model": "HG8310M", "pon_port": 1},
                )
            ]
        )

        response = client.get(f"/api/v1/access/olts/{olt_id}/onus")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["serial_number"] == "ABCD12345678"

    def test_list_onus_not_implemented(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test listing ONUs when driver doesn't support it."""
        mock_access_service.list_onus = AsyncMock(side_effect=NotImplementedError("Not supported"))

        response = client.get("/api/v1/access/olts/olt1/onus")

        assert response.status_code == 501

    def test_collect_metrics_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test collecting OLT metrics."""
        olt_id = "olt1"
        mock_access_service.collect_metrics = AsyncMock(
            return_value=OltMetrics(
                olt_id=olt_id,
                pon_ports_up=8,
                pon_ports_total=8,
                onu_online=5,
                onu_total=5,
                upstream_rate_mbps=1000.0,
                downstream_rate_mbps=2500.0,
            )
        )

        response = client.get(f"/api/v1/access/olts/{olt_id}/metrics")

        assert response.status_code == 200
        data = response.json()
        assert data["olt_id"] == olt_id
        assert data["pon_ports_up"] == 8
        assert data["onu_total"] == 5

    def test_fetch_alarms_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test fetching OLT alarms."""
        olt_id = "olt1"
        mock_access_service.fetch_alarms = AsyncMock(
            return_value=[
                OLTAlarm(
                    alarm_id="1",
                    severity="MAJOR",
                    description="Temperature high",
                    message="Temperature high",
                    raised_at=1729936800.0,  # Unix timestamp
                )
            ]
        )

        response = client.get(f"/api/v1/access/olts/{olt_id}/alarms")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["severity"] == "MAJOR"


class TestONUProvisioning:
    """Test ONU provisioning operations."""

    def test_provision_onu_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test successful ONU provisioning."""
        olt_id = "olt1"
        mock_access_service.provision_onu = AsyncMock(
            return_value=ONUProvisionResult(
                success=True,
                onu_id="olt1:ABCD12345678",
                message="ONU provisioned successfully",
            )
        )

        payload = {
            "serial_number": "ABCD12345678",
            "olt_device_id": olt_id,
            "pon_port": 1,
            "subscriber_id": "sub123",
            "vlan": 100,
        }

        response = client.post(f"/api/v1/access/olts/{olt_id}/onus", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "onu_id" in data

    def test_provision_onu_with_profiles(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test ONU provisioning with line and service profiles."""
        olt_id = "olt1"
        mock_access_service.provision_onu = AsyncMock(
            return_value=ONUProvisionResult(
                success=True,
                onu_id="olt1:ABCD12345678",
                message="ONU provisioned with profiles",
            )
        )

        payload = {
            "serial_number": "ABCD12345678",
            "olt_device_id": olt_id,
            "pon_port": 1,
            "line_profile_id": "profile_1g",
            "service_profile_id": "svc_internet",
            "bandwidth_profile": "100M",
        }

        response = client.post(f"/api/v1/access/olts/{olt_id}/onus", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_provision_onu_not_implemented(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test ONU provisioning when not supported by driver."""
        mock_access_service.provision_onu = AsyncMock(
            side_effect=NotImplementedError("Provisioning not supported")
        )

        payload = {
            "serial_number": "ABCD12345678",
            "olt_device_id": "olt1",
            "pon_port": 1,
        }

        response = client.post("/api/v1/access/olts/olt1/onus", json=payload)

        assert response.status_code == 501

    def test_remove_onu_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test successful ONU removal."""
        olt_id = "olt1"
        onu_id = "olt1:ABCD12345678"
        mock_access_service.remove_onu = AsyncMock(return_value=True)

        response = client.delete(f"/api/v1/access/olts/{olt_id}/onus/{onu_id}")

        assert response.status_code == 200
        assert response.json() is True

    def test_apply_service_profile_success(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test applying service profile to ONU."""
        olt_id = "olt1"
        onu_id = "olt1:ABCD12345678"
        mock_access_service.apply_service_profile = AsyncMock(
            return_value=ONUProvisionResult(
                success=True,
                onu_id=onu_id,
                message="Profile applied",
            )
        )

        profile = {"bandwidth_profile": "100M", "vlan": 100}

        response = client.post(
            f"/api/v1/access/olts/{olt_id}/onus/{onu_id}/service-profile",
            json=profile,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestONUDiscovery:
    """Test ONU discovery operations."""

    def test_discover_all_onus(
        self,
        client: TestClient,
        mock_access_service: AsyncMock,
    ):
        """Test discovering all ONUs across all OLTs."""
        mock_access_service.discover_all_onus = AsyncMock(
            return_value=[
                DeviceDiscovery(
                    serial_number="ABCD12345678",
                    onu_id="1",
                    state="ACTIVE",
                    rssi=-25.5,
                    metadata={"vendor": "Huawei", "model": "HG8310M", "pon_port": 1},
                ),
                DeviceDiscovery(
                    serial_number="EFGH87654321",
                    onu_id="2",
                    state="ACTIVE",
                    rssi=-28.0,
                    metadata={"vendor": "Nokia", "model": "G-010S-A", "pon_port": 2},
                ),
            ]
        )

        response = client.get("/api/v1/access/discover-onus")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["serial_number"] == "ABCD12345678"
        assert data[0]["metadata"]["vendor"] == "Huawei"
        assert data[1]["serial_number"] == "EFGH87654321"
        assert data[1]["metadata"]["vendor"] == "Nokia"

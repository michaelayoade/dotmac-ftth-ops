from datetime import datetime

import pytest

from dotmac.platform.auth import dependencies as auth_dependencies
from dotmac.platform.network_monitoring.router import (
    get_monitoring_service,
)
from dotmac.platform.network_monitoring.router import (
    router as monitoring_router,
)
from dotmac.platform.network_monitoring.schemas import (
    AlertSeverity,
    DeviceType,
    DeviceTypeSummary,
    NetworkAlertResponse,
    NetworkOverviewResponse,
)

pytestmark = pytest.mark.integration

# Some environments still expect require_user alias; provide compatibility after import.
if not hasattr(auth_dependencies, "require_user"):
    auth_dependencies.require_user = auth_dependencies.require_auth  # type: ignore[attr-defined]


class _StubMonitoringService:
    """Stubbed monitoring service used for API integration tests."""

    def __init__(self) -> None:
        self.overview_calls: list[str] = []

    async def get_network_overview(self, tenant_id: str) -> NetworkOverviewResponse:
        self.overview_calls.append(tenant_id)

        return NetworkOverviewResponse(
            tenant_id=tenant_id,
            total_devices=3,
            online_devices=2,
            offline_devices=1,
            degraded_devices=0,
            active_alerts=1,
            critical_alerts=1,
            warning_alerts=0,
            device_type_summary=[
                DeviceTypeSummary(
                    device_type=DeviceType.OLT,
                    total_count=1,
                    online_count=1,
                    offline_count=0,
                    degraded_count=0,
                ),
                DeviceTypeSummary(
                    device_type=DeviceType.ONU,
                    total_count=2,
                    online_count=1,
                    offline_count=1,
                    degraded_count=0,
                ),
            ],
            recent_offline_devices=["olt-2"],
            recent_alerts=[
                NetworkAlertResponse(
                    alert_id="alert-1",
                    severity=AlertSeverity.CRITICAL,
                    title="OLT Link Down",
                    description="Primary uplink is unreachable",
                    device_id="olt-2",
                    device_name="Core OLT-2",
                    device_type=DeviceType.OLT,
                    triggered_at=datetime.utcnow(),
                    tenant_id=tenant_id,
                )
            ],
            data_source_status={
                "inventory.netbox": "3 device(s) from NetBox",
                "inventory.voltha": "1 ONU device(s) from VOLTHA",
                "alerts.alarm_service": "No active alarms",
            },
        )


class _StubDeviceService:
    """Stub device service to verify optional device_type handling."""

    def __init__(self) -> None:
        self.health_calls: list[tuple[str, object, str]] = []

    async def get_device_health(self, device_id: str, device_type, tenant_id: str):
        from dotmac.platform.network_monitoring.schemas import DeviceHealthResponse, DeviceStatus

        self.health_calls.append((device_id, device_type, tenant_id))
        resolved_type = device_type or DeviceType.OLT
        return DeviceHealthResponse(
            device_id=device_id,
            device_name="stub-device",
            device_type=resolved_type,
            status=DeviceStatus.ONLINE,
            tenant_id=tenant_id,
        )


class _StubAlertRuleService:
    """Stub service for alert rule aliases."""

    def __init__(self) -> None:
        self.list_calls: list[str] = []
        self.create_calls: list[dict] = []

    async def get_alert_rules(self, tenant_id: str):
        self.list_calls.append(tenant_id)
        return [
            {
                "rule_id": "rule-1",
                "tenant_id": tenant_id,
                "name": "High CPU",
                "description": "Detect sustained high CPU usage",
                "device_type": DeviceType.ROUTER.value,
                "metric_name": "cpu_usage_percent",
                "condition": "gt",
                "threshold": 85.0,
                "severity": AlertSeverity.WARNING.value,
                "enabled": True,
                "created_at": datetime.utcnow(),
            }
        ]

    async def create_alert_rule(
        self,
        tenant_id: str,
        name: str,
        description: str | None,
        device_type,
        metric_name: str,
        condition: str,
        threshold: float,
        severity,
        enabled: bool,
    ):
        self.create_calls.append(
            {
                "tenant_id": tenant_id,
                "name": name,
                "description": description,
                "device_type": device_type,
                "metric_name": metric_name,
                "condition": condition,
                "threshold": threshold,
                "severity": severity,
                "enabled": enabled,
            }
        )
        return {
            "rule_id": "rule-new",
            "tenant_id": tenant_id,
            "name": name,
            "description": description,
            "device_type": device_type.value if hasattr(device_type, "value") else device_type,
            "metric_name": metric_name,
            "condition": condition,
            "threshold": threshold,
            "severity": AlertSeverity.WARNING.value,
            "enabled": enabled,
            "created_at": datetime.utcnow(),
        }


@pytest.mark.asyncio
async def test_network_overview_api_integration(test_app, authenticated_client) -> None:
    """
    Ensure the REST network overview endpoint returns tenant-scoped data along with
    the upstream data source status map.
    """

    stub_service = _StubMonitoringService()

    # Ensure the network monitoring router is registered on the test app
    existing_paths = {getattr(route, "path", "") for route in test_app.router.routes}
    if (
        "/network/overview" not in existing_paths
        and "/api/v1/network/overview" not in existing_paths
    ):
        test_app.include_router(monitoring_router, prefix="/api/v1")

    # Override the monitoring service dependency for the duration of this test
    test_app.dependency_overrides[get_monitoring_service] = lambda: stub_service

    try:
        response = await authenticated_client.get("/api/v1/network/overview")
    finally:
        # Ensure override is always removed to avoid cross-test contamination
        test_app.dependency_overrides.pop(get_monitoring_service, None)

    assert response.status_code == 200, response.json()

    payload = response.json()
    assert payload["total_devices"] == 3
    assert payload["active_alerts"] == 1

    # Data source status should be surfaced exactly as provided by the service
    assert payload["data_source_status"] == {
        "inventory.netbox": "3 device(s) from NetBox",
        "inventory.voltha": "1 ONU device(s) from VOLTHA",
        "alerts.alarm_service": "No active alarms",
    }

    # Validate that the stub was invoked with the tenant from the authentication fixture
    assert stub_service.overview_calls == ["test-tenant"]


@pytest.mark.asyncio
async def test_device_health_allows_missing_device_type(test_app, authenticated_client) -> None:
    """
    Device health endpoint should accept requests without explicit device_type and
    pass None through to the service for auto-detection.
    """

    stub_service = _StubDeviceService()

    existing_paths = {getattr(route, "path", "") for route in test_app.router.routes}
    if (
        "/network/devices/{device_id}/health" not in existing_paths
        and "/api/v1/network/devices/{device_id}/health" not in existing_paths
    ):
        test_app.include_router(monitoring_router, prefix="/api/v1")

    test_app.dependency_overrides[get_monitoring_service] = lambda: stub_service
    try:
        response = await authenticated_client.get("/api/v1/network/devices/dev-123/health")
    finally:
        test_app.dependency_overrides.pop(get_monitoring_service, None)

    assert response.status_code == 200, response.json()
    payload = response.json()
    assert payload["device_id"] == "dev-123"
    assert payload["device_type"] == DeviceType.OLT.value
    assert stub_service.health_calls == [("dev-123", None, "test-tenant")]


@pytest.mark.asyncio
async def test_alert_rule_alias_endpoints(test_app, authenticated_client) -> None:
    """
    Frontend-friendly /network/alert-rules alias should route to the same handlers.
    """

    stub_service = _StubAlertRuleService()

    existing_paths = {getattr(route, "path", "") for route in test_app.router.routes}
    if (
        "/network/alert-rules" not in existing_paths
        and "/api/v1/network/alert-rules" not in existing_paths
    ):
        test_app.include_router(monitoring_router, prefix="/api/v1")

    test_app.dependency_overrides[get_monitoring_service] = lambda: stub_service
    try:
        list_resp = await authenticated_client.get("/api/v1/network/alert-rules")
        create_resp = await authenticated_client.post(
            "/api/v1/network/alert-rules",
            json={
                "name": "High CPU",
                "description": "Detect sustained high CPU usage",
                "metric_name": "cpu_usage_percent",
                "condition": "gt",
                "threshold": 90.0,
                "severity": "warning",
                "enabled": True,
            },
        )
    finally:
        test_app.dependency_overrides.pop(get_monitoring_service, None)

    assert list_resp.status_code == 200, list_resp.json()
    list_payload = list_resp.json()
    assert len(list_payload) == 1
    assert list_payload[0]["rule_id"] == "rule-1"

    assert create_resp.status_code == 201, create_resp.json()
    create_payload = create_resp.json()
    assert create_payload["rule_id"] == "rule-new"
    assert stub_service.create_calls  # Ensure stub was invoked

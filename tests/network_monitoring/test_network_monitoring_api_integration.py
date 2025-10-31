from datetime import datetime

import pytest

from dotmac.platform.auth import dependencies as auth_dependencies


# Some environments still expect require_user alias; provide compatibility before router import.





pytestmark = pytest.mark.integration

if not hasattr(auth_dependencies, "require_user"):
    auth_dependencies.require_user = auth_dependencies.require_auth  # type: ignore[attr-defined]

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

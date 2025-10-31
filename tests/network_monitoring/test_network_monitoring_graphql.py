from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient
from strawberry.fastapi import GraphQLRouter
from strawberry.fastapi.context import BaseContext

from dotmac.platform.graphql.schema import schema
from dotmac.platform.network_monitoring.schemas import (



    AlertSeverity,
    DeviceType,
    NetworkAlertResponse,
    NetworkOverviewResponse,
)





pytestmark = pytest.mark.integration

def _build_overview(tenant_id: str) -> NetworkOverviewResponse:
    return NetworkOverviewResponse(
        tenant_id=tenant_id,
        total_devices=4,
        online_devices=3,
        offline_devices=1,
        degraded_devices=0,
        active_alerts=2,
        critical_alerts=1,
        warning_alerts=1,
        device_type_summary=[],
        recent_offline_devices=["router-2"],
        recent_alerts=[
            NetworkAlertResponse(
                alert_id="alert-router",
                severity=AlertSeverity.WARNING,
                title="Router CPU high",
                description="CPU above 80% threshold",
                device_id="router-2",
                device_name="Aggregation Router 2",
                device_type=DeviceType.ROUTER,
                triggered_at=datetime.utcnow(),
                tenant_id=tenant_id,
            )
        ],
        data_source_status={
            "inventory.netbox": "4 device(s) from NetBox",
            "alerts.alarm_service": "2 active alarms",
        },
    )


@pytest.mark.asyncio
async def test_network_overview_graphql(monkeypatch) -> None:
    """
    Validate the GraphQL networkOverview query returns the dataSourceStatus collection.
    """

    invocation_log: list[str] = []

    class _StubMonitoringService:
        def __init__(self, tenant_id: str, session=None, **kwargs) -> None:
            self._tenant_id = tenant_id

        async def get_network_overview(self, tenant_id: str) -> NetworkOverviewResponse:
            invocation_log.append(tenant_id)
            return _build_overview(tenant_id)

    # Replace the real monitoring service with our stub for the lifetime of this test
    monkeypatch.setattr(
        "dotmac.platform.network_monitoring.service.NetworkMonitoringService",
        _StubMonitoringService,
    )
    monkeypatch.setattr(
        "dotmac.platform.graphql.queries.network.NetworkMonitoringService",
        _StubMonitoringService,
    )

    app = FastAPI()

    class _TestContext(BaseContext):
        def __init__(self, request: Request):
            super().__init__()
            self.request = request
            self.current_user = SimpleNamespace(tenant_id="test-tenant")
            self.db = None
            self.loaders = SimpleNamespace()

    async def _context_getter(request: Request):
        return _TestContext(request)

    graphql_router = GraphQLRouter(
        schema,
        path="/api/v1/graphql",
        context_getter=_context_getter,
    )
    app.include_router(graphql_router)

    query = """
    query {
      networkOverview {
        tenantId
        totalDevices
        dataSourceStatus {
          name
          status
        }
        recentAlerts {
          alertId
          severity
        }
      }
    }
    """

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v1/graphql",
            json={"query": query},
        )

    assert response.status_code == 200, response.json()

    payload = response.json()
    assert "errors" not in payload

    overview = payload["data"]["networkOverview"]
    assert overview["tenantId"] == "test-tenant"
    assert overview["totalDevices"] == 4

    data_source_status = overview["dataSourceStatus"]
    assert isinstance(data_source_status, list)
    assert {"name": "inventory.netbox", "status": "4 device(s) from NetBox"} in data_source_status
    assert {"name": "alerts.alarm_service", "status": "2 active alarms"} in data_source_status

    # Ensure the resolver invoked our stub with the authenticated tenant
    assert invocation_log == ["test-tenant"]

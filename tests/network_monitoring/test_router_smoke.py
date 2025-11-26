"""Smoke tests for network diagnostics/monitoring router to match UI calls."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import require_user
from dotmac.platform.network_monitoring.router import router as monitoring_router, get_monitoring_service
from dotmac.platform.network_monitoring.schemas import (
    AcknowledgeAlertRequest,
    AlertRuleResponse,
    AlertSeverity,
    CreateAlertRuleRequest,
    DeviceHealthResponse,
    DeviceMetricsResponse,
    DeviceStatus,
    DeviceType,
    NetworkAlertResponse,
    NetworkOverviewResponse,
    TrafficStatsResponse,
)


def _now() -> datetime:
    return datetime.now()


class FakeMonitoringService:
    """Stub service returning deterministic monitoring data."""

    def __init__(self, tenant_id: str) -> None:
        self.tenant_id = tenant_id

    async def get_network_overview(self, tenant_id: str) -> NetworkOverviewResponse:
        return NetworkOverviewResponse(
            tenant_id=tenant_id,
            total_devices=2,
            online_devices=2,
            total_bandwidth_in_bps=1000.0,
            total_bandwidth_out_bps=800.0,
            recent_alerts=[
                NetworkAlertResponse(
                    alert_id="alert-1",
                    severity=AlertSeverity.WARNING,
                    title="High CPU",
                    description="CPU above threshold",
                    device_id="dev-1",
                    device_name="OLT-1",
                    device_type=DeviceType.OLT,
                    triggered_at=_now() - timedelta(minutes=5),
                    acknowledged_at=None,
                    resolved_at=None,
                    is_active=True,
                    is_acknowledged=False,
                    tenant_id=tenant_id,
                )
            ],
        )

    async def get_all_devices(self, tenant_id: str, device_type: DeviceType | None = None):
        devices = [
            DeviceHealthResponse(
                device_id="dev-1",
                device_name="OLT-1",
                device_type=DeviceType.OLT,
                status=DeviceStatus.ONLINE,
                management_ipv4="10.0.0.1",
                last_seen=_now(),
                uptime_seconds=3600,
            ),
            DeviceHealthResponse(
                device_id="dev-2",
                device_name="CPE-1",
                device_type=DeviceType.CPE,
                status=DeviceStatus.DEGRADED,
                management_ipv4="10.0.0.2",
                last_seen=_now(),
                uptime_seconds=1800,
            ),
        ]
        if device_type:
            return [d for d in devices if d.device_type == device_type]
        return devices

    async def get_device_health(self, device_id: str, device_type: DeviceType | None, tenant_id: str):
        for d in await self.get_all_devices(tenant_id):
            if d.device_id == device_id:
                return d
        return None

    async def get_device_metrics(self, device_id: str, device_type: DeviceType | None, tenant_id: str):
        health = await self.get_device_health(device_id, device_type, tenant_id)
        if not health:
            return None
        traffic = await self.get_traffic_stats(device_id, device_type, tenant_id)
        return DeviceMetricsResponse(
            device_id=device_id,
            device_name=health.device_name,
            device_type=health.device_type,
            health=health,
            traffic=traffic,
            custom_metrics={"cpu_usage_percent": 42.0},
        )

    async def get_traffic_stats(self, device_id: str, device_type: DeviceType | None, tenant_id: str):
        return TrafficStatsResponse(
            device_id=device_id,
            device_name="OLT-1",
            timestamp=_now(),
            total_bytes_in=1024,
            total_bytes_out=2048,
            total_packets_in=100,
            total_packets_out=200,
            current_rate_in_bps=100.0,
            current_rate_out_bps=200.0,
            interfaces=[],
        )

    async def get_alerts(
        self,
        tenant_id: str,
        severity: AlertSeverity | None = None,
        active_only: bool = True,
        device_id: str | None = None,
        limit: int = 100,
    ):
        alert = NetworkAlertResponse(
            alert_id="alert-1",
            severity=AlertSeverity.WARNING,
            title="High CPU",
            description="CPU above threshold",
            device_id=device_id or "dev-1",
            device_name="OLT-1",
            device_type=DeviceType.OLT,
            triggered_at=_now(),
            acknowledged_at=None,
            resolved_at=None,
            is_active=True,
            is_acknowledged=False,
            tenant_id=tenant_id,
        )
        return [alert]

    async def acknowledge_alert(self, alert_id: str, tenant_id: str, user_id: str, note: str | None):
        return NetworkAlertResponse(
            alert_id=alert_id,
            severity=AlertSeverity.INFO,
            title="Acked",
            description=note or "Acknowledged",
            device_id="dev-1",
            device_name="OLT-1",
            device_type=DeviceType.OLT,
            triggered_at=_now() - timedelta(minutes=1),
            acknowledged_at=_now(),
            resolved_at=None,
            is_active=True,
            is_acknowledged=True,
            tenant_id=tenant_id,
        )

    async def create_alert_rule(
        self,
        tenant_id: str,
        name: str,
        description: str | None,
        device_type: DeviceType | None,
        metric_name: str,
        condition: str,
        threshold: float,
        severity: AlertSeverity,
        enabled: bool,
    ) -> AlertRuleResponse:
        return AlertRuleResponse(
            rule_id="rule-1",
            tenant_id=tenant_id,
            name=name,
            description=description,
            device_type=device_type,
            metric_name=metric_name,
            condition=condition,
            threshold=threshold,
            severity=severity,
            enabled=enabled,
            created_at=_now(),
        )

    async def get_alert_rules(self, tenant_id: str):
        return [
            AlertRuleResponse(
                rule_id="rule-1",
                tenant_id=tenant_id,
                name="High CPU",
                description="Trigger on CPU > 80%",
                device_type=DeviceType.OLT,
                metric_name="cpu_usage_percent",
                condition="gt",
                threshold=80.0,
                severity=AlertSeverity.WARNING,
                enabled=True,
                created_at=_now(),
            )
        ]


@pytest.fixture
def monitoring_app():
    app = FastAPI()
    app.include_router(monitoring_router, prefix="/api/v1")

    test_user = UserInfo(
        user_id=str(uuid4()),
        username="monitoring-tester",
        email="monitoring@example.com",
        tenant_id="tenant-1",
    )

    async def override_user():
        return test_user

    app.dependency_overrides[require_user] = override_user
    app.dependency_overrides[get_monitoring_service] = lambda current_user=test_user: FakeMonitoringService(
        tenant_id=current_user.tenant_id or "tenant-1"
    )
    return app


@pytest_asyncio.fixture
async def monitoring_client(monitoring_app):
    transport = ASGITransport(app=monitoring_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_overview_and_devices(monitoring_client: AsyncClient):
    overview = await monitoring_client.get("/api/v1/network/overview", follow_redirects=True)
    assert overview.status_code == 200
    devices = await monitoring_client.get("/api/v1/network/devices", follow_redirects=True)
    assert devices.status_code == 200
    device_list = devices.json()
    assert isinstance(device_list, list) and device_list


@pytest.mark.asyncio
async def test_device_health_metrics_and_traffic(monitoring_client: AsyncClient):
    health = await monitoring_client.get("/api/v1/network/devices/dev-1/health", follow_redirects=True)
    assert health.status_code == 200
    metrics = await monitoring_client.get("/api/v1/network/devices/dev-1/metrics", follow_redirects=True)
    assert metrics.status_code == 200
    traffic = await monitoring_client.get("/api/v1/network/devices/dev-1/traffic", follow_redirects=True)
    assert traffic.status_code == 200


@pytest.mark.asyncio
async def test_alerts_and_ack(monitoring_client: AsyncClient):
    alerts = await monitoring_client.get("/api/v1/network/alerts", follow_redirects=True)
    assert alerts.status_code == 200
    ack = await monitoring_client.post(
        "/api/v1/network/alerts/alert-1/acknowledge",
        json=AcknowledgeAlertRequest(note="ack").model_dump(),
        follow_redirects=True,
    )
    assert ack.status_code == 200
    body = ack.json()
    assert body["is_acknowledged"] is True


@pytest.mark.asyncio
async def test_alert_rules_crud(monitoring_client: AsyncClient):
    create = await monitoring_client.post(
        "/api/v1/network/alerts/rules",
        json=CreateAlertRuleRequest(
            name="High CPU",
            description="CPU > 80",
            device_type=DeviceType.OLT,
            metric_name="cpu_usage_percent",
            condition="gt",
            threshold=80.0,
            severity=AlertSeverity.WARNING,
            enabled=True,
        ).model_dump(),
        follow_redirects=True,
    )
    assert create.status_code == 201
    rules = await monitoring_client.get("/api/v1/network/alerts/rules", follow_redirects=True)
    assert rules.status_code == 200
    assert rules.json()

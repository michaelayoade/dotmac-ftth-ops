"""Integration-style test for network overview aggregation."""

from __future__ import annotations

import pytest

from dotmac.platform.network_monitoring.schemas import AlertSeverity, NetworkAlertResponse
from dotmac.platform.network_monitoring.service import NetworkMonitoringService
from datetime import datetime, timezone


pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_network_overview_aggregates_devices_and_alerts(monkeypatch):
    service = NetworkMonitoringService("tenant-monitoring", session=None)

    async def fake_devices(tenant_id: str):
        return [
            {"id": "1", "status": "online", "type": "olt"},
            {"id": "2", "status": "offline", "type": "onu"},
            {"id": "3", "status": "degraded", "type": "olt"},
        ]

    async def fake_alerts(tenant_id: str):
        return [
            NetworkAlertResponse(
                alert_id="a1",
                severity=AlertSeverity.CRITICAL,
                title="Down",
                description="OLT down",
                device_id="1",
                device_name="OLT-1",
                device_type="olt",
                triggered_at=datetime.now(tz=timezone.utc),
                acknowledged_at=None,
                resolved_at=None,
                is_active=True,
                is_acknowledged=False,
                tenant_id=tenant_id,
            )
        ]

    monkeypatch.setattr(service, "_get_tenant_devices", fake_devices)
    monkeypatch.setattr(service, "_get_active_alerts", fake_alerts)

    overview = await service.get_network_overview("tenant-monitoring")

    assert overview.total_devices == 3
    assert overview.online_devices == 1
    assert overview.offline_devices == 1
    assert overview.degraded_devices == 1
    assert overview.active_alerts == 1
    assert overview.critical_alerts == 1
    assert overview.warning_alerts == 0

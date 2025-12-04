"""
Tests covering tenant scoping for the dual-stack metrics router.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_async_session
from dotmac.platform.monitoring.dual_stack_metrics import (
    DualStackMetrics,
    DualStackMetricsCollector,
    MetricsAggregator,
)
from dotmac.platform.monitoring.dual_stack_metrics_router import router as dual_stack_router

pytestmark = pytest.mark.integration


def _tenant_user(tenant_id: str) -> UserInfo:
    return UserInfo(
        user_id=str(uuid4()),
        username=f"user-{tenant_id}",
        email=f"{tenant_id}@example.com",
        roles=["user"],
        permissions=["read"],
        tenant_id=tenant_id,
        is_platform_admin=False,
    )


def _admin_user() -> UserInfo:
    return UserInfo(
        user_id=str(uuid4()),
        username="platform-admin",
        email="admin@example.com",
        roles=["platform_admin"],
        permissions=["*"],
        tenant_id=None,
        is_platform_admin=True,
    )


@pytest.fixture
def app(async_db_session: AsyncSession) -> FastAPI:
    """FastAPI app containing the dual-stack metrics router."""
    application = FastAPI()

    async def override_session():
        yield async_db_session

    application.include_router(dual_stack_router, prefix="/api/v1")
    application.dependency_overrides[get_async_session] = override_session
    return application


async def _request(app: FastAPI, user: UserInfo, path: str):
    async def override_user():
        return user

    app.dependency_overrides[get_current_user] = override_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(path)
    return response


@pytest.mark.asyncio
async def test_dual_stack_metrics_scope_defaults_to_user_tenant(app: FastAPI, monkeypatch):
    """Non-admin users should automatically be scoped to their own tenant."""
    tenant_user = _tenant_user("tenant-alpha")

    captured = {}

    async def fake_collect(self):
        # Ensure collector receives resolved tenant
        captured["collector_tenant"] = self.tenant_id
        metrics = DualStackMetrics()
        metrics.total_subscribers = 5
        metrics.dual_stack_subscribers = 3
        return metrics

    async def fake_trend(self, metric_name, period, tenant_id=None):
        captured["trend_tenant"] = tenant_id
        return [{"timestamp": "2024-01-01T00:00:00Z", "value": 0.0}]

    monkeypatch.setattr(DualStackMetricsCollector, "collect_all_metrics", fake_collect)
    monkeypatch.setattr(MetricsAggregator, "get_trend_data", fake_trend)

    current_response = await _request(app, tenant_user, "/api/v1/metrics/dual-stack/current")
    assert current_response.status_code == 200
    assert captured["collector_tenant"] == "tenant-alpha"

    trend_response = await _request(
        app, tenant_user, "/api/v1/metrics/dual-stack/trend/ipv4_bandwidth_mbps"
    )
    assert trend_response.status_code == 200
    assert captured["trend_tenant"] == "tenant-alpha"


@pytest.mark.asyncio
async def test_dual_stack_metrics_prevents_cross_tenant_access(app: FastAPI):
    """Users must not request metrics for a different tenant."""
    tenant_user = _tenant_user("tenant-alpha")

    response = await _request(
        app,
        tenant_user,
        "/api/v1/metrics/dual-stack/current?tenant_id=tenant-beta",
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_dual_stack_metrics_admin_can_target_tenant(app: FastAPI, monkeypatch):
    """Platform admins may specify the tenant they wish to inspect."""
    admin_user = _admin_user()
    captured = {}

    async def fake_collect(self):
        captured["tenant_id"] = self.tenant_id
        return DualStackMetrics()

    monkeypatch.setattr(DualStackMetricsCollector, "collect_all_metrics", fake_collect)

    response = await _request(
        app, admin_user, "/api/v1/metrics/dual-stack/current?tenant_id=tenant-gamma"
    )
    assert response.status_code == 200
    assert captured["tenant_id"] == "tenant-gamma"

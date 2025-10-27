"""
Tests for the alert management router to ensure persistence and tenant scoping.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_async_session
from dotmac.platform.monitoring.alert_router import router as alert_router
from dotmac.platform.monitoring.alert_webhook_router import cache_channels, get_alert_router
from dotmac.platform.monitoring.models import MonitoringAlertChannel


def _make_admin() -> UserInfo:
    return UserInfo(
        user_id=str(uuid4()),
        username="platform-admin",
        email="admin@example.com",
        roles=["platform_admin"],
        permissions=["*"],
        tenant_id=None,
        is_platform_admin=True,
    )


def _make_tenant_user(tenant_id: str) -> UserInfo:
    return UserInfo(
        user_id=str(uuid4()),
        username=f"user-{tenant_id}",
        email=f"{tenant_id}@example.com",
        roles=["user"],
        permissions=["read"],
        tenant_id=tenant_id,
        is_platform_admin=False,
    )


@pytest_asyncio.fixture(autouse=True)
async def _reset_alert_state(async_db_session: AsyncSession):
    """Clear alert channel state between tests."""
    await async_db_session.execute(delete(MonitoringAlertChannel))
    await async_db_session.commit()
    cache_channels([])
    get_alert_router().replace_channels([])


@pytest.fixture
def app(async_db_session: AsyncSession) -> FastAPI:
    """FastAPI application with alert router and dependency overrides."""
    application = FastAPI()

    async def override_session():
        yield async_db_session

    application.include_router(alert_router, prefix="/api/v1")
    application.dependency_overrides[get_async_session] = override_session

    return application


async def _request(
    app: FastAPI,
    user: UserInfo,
    method: str,
    path: str,
    **kwargs,
) -> AsyncClient:
    """Utility to perform a request with a specific user context."""

    async def override_user():
        return user

    app.dependency_overrides[get_current_user] = override_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.request(method, path, **kwargs)
    return response


@pytest.mark.asyncio
async def test_create_alert_channel_persists_and_populates_cache(
    app: FastAPI,
    async_db_session: AsyncSession,
):
    """Creating a channel stores it in the database and primes the router cache."""
    admin = _make_admin()

    payload = {
        "id": "chan-test",
        "name": "Test Channel",
        "channel_type": "slack",
        "webhook_url": "https://hooks.slack.com/services/test",
        "enabled": True,
        "tenant_id": "tenant-alpha",
        "severities": ["critical", "warning"],
    }

    response = await _request(
        app,
        admin,
        "POST",
        "/api/v1/alerts/channels",
        json=payload,
    )
    assert response.status_code == 201, response.text

    stored = await async_db_session.get(MonitoringAlertChannel, "chan-test")
    assert stored is not None
    assert stored.tenant_id == "tenant-alpha"
    assert stored.config["webhook_url"] == payload["webhook_url"]

    router_channels = get_alert_router().channels
    assert "chan-test" in router_channels
    assert router_channels["chan-test"].webhook_url == payload["webhook_url"]


@pytest.mark.asyncio
async def test_list_alert_channels_respects_tenant_boundaries(
    app: FastAPI,
    async_db_session: AsyncSession,
):
    """Non-admin users should only see channels for their tenant."""
    admin = _make_admin()

    for channel_id, tenant_id in (("chan-alpha", "tenant-alpha"), ("chan-beta", "tenant-beta")):
        payload = {
            "id": channel_id,
            "name": f"Channel {tenant_id}",
            "channel_type": "webhook",
            "webhook_url": f"https://example.com/{channel_id}",
            "enabled": True,
            "tenant_id": tenant_id,
        }
        response = await _request(
            app,
            admin,
            "POST",
            "/api/v1/alerts/channels",
            json=payload,
        )
        assert response.status_code == 201

    user_alpha = _make_tenant_user("tenant-alpha")
    response_alpha = await _request(
        app,
        user_alpha,
        "GET",
        "/api/v1/alerts/channels",
    )
    assert response_alpha.status_code == 200
    data_alpha = response_alpha.json()
    assert len(data_alpha) == 1
    assert data_alpha[0]["id"] == "chan-alpha"

    user_beta = _make_tenant_user("tenant-beta")
    response_beta = await _request(
        app,
        user_beta,
        "GET",
        "/api/v1/alerts/channels",
    )
    assert response_beta.status_code == 200
    data_beta = response_beta.json()
    assert len(data_beta) == 1
    assert data_beta[0]["id"] == "chan-beta"


@pytest.mark.asyncio
async def test_send_test_alert_requires_admin(app: FastAPI):
    """Regular users must not trigger outbound test notifications."""
    admin = _make_admin()
    payload = {
        "id": "chan-test",
        "name": "Test",
        "channel_type": "slack",
        "webhook_url": "https://hooks.slack.com/services/test",
        "enabled": True,
        "tenant_id": "tenant-alpha",
    }
    create_response = await _request(
        app,
        admin,
        "POST",
        "/api/v1/alerts/channels",
        json=payload,
    )
    assert create_response.status_code == 201

    tenant_user = _make_tenant_user("tenant-alpha")
    response = await _request(
        app,
        tenant_user,
        "POST",
        "/api/v1/alerts/test",
        json={"channel_id": "chan-test", "message": "hello"},
    )
    assert response.status_code == 403

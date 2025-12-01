"""Smoke tests for Access alarm acknowledge/clear endpoints with feature flag handling."""

from __future__ import annotations

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.integration

from dotmac.platform.access.router import get_access_service
from dotmac.platform.access.router import router as access_router
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.settings import get_settings


class FakeAccessService:
    """Minimal stub that pretends to ack/clear alarms successfully."""

    async def acknowledge_alarm(self, alarm_id: str, olt_id: str | None, actor: str | None = None):
        return {"success": True, "acknowledged_by": actor or "tester", "driver_supported": True}

    async def clear_alarm(self, alarm_id: str, olt_id: str | None, actor: str | None = None):
        return {"success": True, "cleared_by": actor or "tester", "driver_supported": True}


class FakeSettings:
    def __init__(self, enabled: bool = True) -> None:
        self.features = type("Features", (), {"pon_alarm_actions_enabled": enabled})()


@pytest.fixture
def access_app():
    app = FastAPI()
    app.include_router(access_router, prefix="/api/v1")

    test_user = UserInfo(
        user_id="user-access",
        username="access-tester",
        email="access@example.com",
        tenant_id="tenant-1",
    )

    async def override_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_access_service] = lambda: FakeAccessService()
    app.dependency_overrides[get_settings] = lambda: FakeSettings(enabled=True)
    return app


@pytest_asyncio.fixture
async def access_client(access_app):
    transport = ASGITransport(app=access_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_access_acknowledge_alarm(access_client: AsyncClient):
    resp = await access_client.post("/api/v1/access/alarms/alarm-1/acknowledge")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "acknowledged"
    assert body["driver_supported"] is True


@pytest.mark.asyncio
async def test_access_clear_alarm(access_client: AsyncClient):
    resp = await access_client.post("/api/v1/access/alarms/alarm-1/clear")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "cleared"
    assert body["driver_supported"] is True


@pytest.mark.asyncio
async def test_access_alarm_actions_disabled(access_app):
    # Override feature flag to false
    access_app.dependency_overrides[get_settings] = lambda: FakeSettings(enabled=False)
    transport = ASGITransport(app=access_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post("/api/v1/access/alarms/alarm-1/acknowledge", follow_redirects=True)
        assert resp.status_code == 501

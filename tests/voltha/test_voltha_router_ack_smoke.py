"""Smoke tests for VOLTHA alarm acknowledge/clear routes with feature gating."""

from __future__ import annotations

from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.integration

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.settings import Settings, get_settings
from dotmac.platform.voltha.router import get_voltha_service
from dotmac.platform.voltha.router import router as voltha_router
from dotmac.platform.voltha.schemas import (
    AlarmAcknowledgeRequest,
    AlarmClearRequest,
    AlarmOperationResponse,
)


class FakeVOLTHAService:
    async def acknowledge_alarm(
        self, alarm_id: str, request: AlarmAcknowledgeRequest
    ) -> AlarmOperationResponse:
        return AlarmOperationResponse(
            success=True,
            message="acknowledged",
            alarm_id=alarm_id,
            operation="acknowledge",
            timestamp="2023-01-01T00:00:00Z",
        )

    async def clear_alarm(
        self, alarm_id: str, request: AlarmClearRequest
    ) -> AlarmOperationResponse:
        return AlarmOperationResponse(
            success=True,
            message="cleared",
            alarm_id=alarm_id,
            operation="clear",
            timestamp="2023-01-01T00:00:00Z",
        )


@pytest.fixture
def voltha_app():
    app = FastAPI()
    app.include_router(voltha_router, prefix="/api/v1")

    test_user = UserInfo(
        user_id=str(uuid4()),
        username="voltha-tester",
        email="voltha@example.com",
        tenant_id="tenant-1",
        permissions=["isp.network.pon.write"],
    )

    async def override_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_voltha_service] = lambda: FakeVOLTHAService()
    app.dependency_overrides[get_settings] = lambda: Settings(
        features=Settings.FeatureFlags(pon_alarm_actions_enabled=True)
    )  # type: ignore[arg-type]
    # Bypass RBAC permission enforcement for the smoke tests
    app.dependency_overrides[require_permission("isp.network.pon.write")] = lambda: None
    app.dependency_overrides[require_permission("isp.network.pon.read")] = lambda: None
    return app


@pytest_asyncio.fixture
async def voltha_client(voltha_app):
    transport = ASGITransport(app=voltha_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_voltha_acknowledge_alarm(voltha_client: AsyncClient):
    resp = await voltha_client.post(
        "/api/v1/voltha/alarms/alarm-123/acknowledge", json={"acknowledged_by": "tester"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["operation"] == "acknowledge"


@pytest.mark.asyncio
async def test_voltha_clear_alarm(voltha_client: AsyncClient):
    resp = await voltha_client.post(
        "/api/v1/voltha/alarms/alarm-123/clear", json={"cleared_by": "tester"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["operation"] == "clear"

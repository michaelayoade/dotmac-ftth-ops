"""Tests for tenant OSS configuration router."""

import os
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant.dependencies import require_tenant_admin
from dotmac.platform.tenant.models import Tenant
from dotmac.platform.tenant.oss_router import router

# Get the actual NETBOX_URL and API_TOKEN from environment for assertions


pytestmark = pytest.mark.integration

EXPECTED_NETBOX_URL = os.getenv("NETBOX_URL", "http://localhost:8080")
EXPECTED_NETBOX_API_TOKEN = os.getenv("NETBOX_API_TOKEN", None)


@pytest_asyncio.fixture
async def tenant(async_db_session: AsyncSession) -> Tenant:
    tenant_id = f"tenant-{uuid4().hex[:8]}"
    tenant = Tenant(id=tenant_id, name="Tenant One", slug=f"tenant-{uuid4().hex[:8]}")
    async_db_session.add(tenant)
    await async_db_session.commit()
    return tenant


@pytest.fixture
def oss_client(async_db_session: AsyncSession, tenant: Tenant) -> TestClient:
    app = FastAPI()
    app.include_router(router)

    user = UserInfo(
        user_id="user-1",
        tenant_id=tenant.id,
        roles=["tenant_admin"],
        permissions=["isp.oss.read", "isp.oss.configure"],
    )

    read_dep = require_permission("isp.oss.read")
    write_dep = require_permission("isp.oss.configure")

    async def _override_session() -> AsyncSession:
        return async_db_session

    async def _override_read():
        return user

    async def _override_write():
        return user

    async def _override_tenant_admin():
        return user, tenant

    app.dependency_overrides[get_session_dependency] = _override_session
    app.dependency_overrides[require_tenant_admin] = _override_tenant_admin
    app.dependency_overrides[read_dep] = _override_read
    app.dependency_overrides[write_dep] = _override_write
    app.dependency_overrides[get_current_user] = _override_read

    return TestClient(app)


def test_get_default_configuration(oss_client: TestClient) -> None:
    response = oss_client.get("/api/v1/tenant/oss/netbox")
    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "netbox"
    assert payload["config"]["url"] == EXPECTED_NETBOX_URL
    assert payload["overrides"] == {}


def test_update_and_reset_configuration(
    oss_client: TestClient,
) -> None:
    update_payload = {"url": "https://netbox.example.com", "api_token": "TOKEN123"}
    response = oss_client.patch("/api/v1/tenant/oss/netbox", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["config"]["url"] == "https://netbox.example.com"
    assert data["config"]["api_token"] == "TOKEN123"
    assert data["overrides"]["url"] == "https://netbox.example.com"
    assert data["overrides"]["api_token"] == "TOKEN123"

    # Reset configuration
    reset_resp = oss_client.delete("/api/v1/tenant/oss/netbox")
    assert reset_resp.status_code == 204

    # Fetch again - should return defaults
    final_resp = oss_client.get("/api/v1/tenant/oss/netbox")
    assert final_resp.status_code == 200
    final_data = final_resp.json()
    assert final_data["config"]["url"] == EXPECTED_NETBOX_URL
    assert final_data["config"]["api_token"] == EXPECTED_NETBOX_API_TOKEN
    assert final_data["overrides"] == {}

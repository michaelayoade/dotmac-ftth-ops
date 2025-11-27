"""Smoke test to ensure audit listing returns pagination metadata expected by the UI."""

import pytest
import pytest_asyncio

pytestmark = pytest.mark.unit
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.audit.models import (
    AuditActivity,
    AuditActivityCreate,
    ActivitySeverity,
    ActivityType,
)
from dotmac.platform.audit.router import router
from dotmac.platform.audit.service import AuditService
from dotmac.platform.db import AsyncSessionLocal, Base as DbBase
from dotmac.platform.tenant import get_current_tenant_id


@pytest.fixture
def audit_app(monkeypatch):
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")

    test_user = UserInfo(
        user_id="audit-user",
        username="audit",
        email="audit@example.com",
        tenant_id="tenant-123",
        permissions=["security.audit.read"],
    )

    async def override_user():
        return test_user

    async def override_tenant():
        return "tenant-123"

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_current_tenant_id] = override_tenant
    return app


@pytest_asyncio.fixture
async def audit_client(audit_app):
    transport = ASGITransport(app=audit_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_list_activities_returns_total_pages(audit_client):
    # Ensure schema exists (SQLite fallback)
    async with AsyncSessionLocal() as session:
        await session.run_sync(lambda sync_sess: DbBase.metadata.create_all(sync_sess.get_bind()))

    resp = await audit_client.get(
        "/api/v1/audit/activities?per_page=2&page=1", headers={"X-Tenant-ID": "tenant-123"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_pages" in data
    assert data["per_page"] == 2
    assert data["page"] == 1
    # Allow zero when no seed data exists
    assert data["total_pages"] >= 0

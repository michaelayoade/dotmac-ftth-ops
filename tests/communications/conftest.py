"""Shared fixtures for communications tests."""

import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException, Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.communications.metrics_router import router as metrics_router
from dotmac.platform.communications.models import CommunicationLog
from dotmac.platform.db import get_async_session, get_session_dependency


@pytest_asyncio.fixture(autouse=True)
async def clean_communication_logs(async_db_session: AsyncSession):
    """Ensure CommunicationLog table is empty before each test."""
    await async_db_session.execute(delete(CommunicationLog))
    await async_db_session.commit()
    yield
    try:
        await async_db_session.execute(delete(CommunicationLog))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()


@pytest.fixture
def auth_headers():
    return {"X-Tenant-ID": "test-tenant", "Authorization": "Bearer test-token"}


@pytest.fixture
async def client(async_db_session: AsyncSession):
    """Async HTTP client with metrics router mounted."""
    app = FastAPI()

    async def override_async_session():
        yield async_db_session

    def override_sync_session():
        return async_db_session

    def override_current_user(request: Request):
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Missing tenant context")
        return UserInfo(
            user_id="test-user",
            email="test@example.com",
            username="tester",
            tenant_id=tenant_id,
            roles=["admin"],
            permissions=["communications:read"],
        )

    app.dependency_overrides[get_async_session] = override_async_session
    app.dependency_overrides[get_session_dependency] = override_sync_session
    app.dependency_overrides[get_current_user] = override_current_user
    app.include_router(metrics_router, prefix="/api/v1/metrics/communications")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client

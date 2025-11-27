"""
Tests for the tenant branding router used by the ISP Operations app.
"""

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.tenant.branding_router import get_tenant_service
from dotmac.platform.tenant.branding_router import router as branding_router
from dotmac.platform.tenant.schemas import TenantBrandingConfig, TenantBrandingResponse
from dotmac.platform.tenant.service import TenantService

pytestmark = pytest.mark.integration


@pytest.fixture
def tenant_user() -> UserInfo:
    return UserInfo(
        user_id="user-1",
        username="tenant-admin",
        email="admin@example.com",
        tenant_id="tenant-123",
        roles=["tenant_admin"],
        permissions=[],
    )


@pytest.fixture
def non_admin_user() -> UserInfo:
    return UserInfo(
        user_id="user-2",
        username="viewer",
        email="viewer@example.com",
        tenant_id="tenant-123",
        roles=["viewer"],
        permissions=[],
    )


def _build_branding_response() -> TenantBrandingResponse:
    return TenantBrandingResponse(
        tenant_id="tenant-123",
        branding=TenantBrandingConfig(
            product_name="Tenant ISP",
            support_email="support@tenant-isp.example.com",
            logo_light_url="https://cdn.example.com/logo.svg",
        ),
    )


def _build_test_app(
    user: UserInfo,
    service: TenantService,
) -> FastAPI:
    app = FastAPI()

    async def override_user(
        request=None,
        token=None,
        api_key=None,
        credentials=None,
    ) -> UserInfo:
        return user

    async def override_service() -> TenantService:
        return service

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_tenant_service] = override_service
    app.include_router(branding_router, prefix="/api/v1")
    return app


@pytest.mark.asyncio
async def test_get_branding_success(tenant_user: UserInfo):
    service = AsyncMock(spec=TenantService)
    service.get_tenant_branding.return_value = _build_branding_response()

    app = _build_test_app(tenant_user, service)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/api/v1/branding")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_id"] == "tenant-123"
        assert data["branding"]["product_name"] == "Tenant ISP"
        service.get_tenant_branding.assert_awaited_once_with("tenant-123")


@pytest.mark.asyncio
async def test_update_branding_requires_admin(tenant_user: UserInfo, non_admin_user: UserInfo):
    service = AsyncMock(spec=TenantService)
    service.get_tenant_branding.return_value = _build_branding_response()
    service.update_tenant_branding.return_value = _build_branding_response()

    # Admin user succeeds
    app = _build_test_app(tenant_user, service)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.put(
            "/api/v1/branding",
            json={
                "branding": {
                    "product_name": "Updated ISP",
                    "support_email": "updated@example.com",
                }
            },
        )
        assert resp.status_code == 200
        service.update_tenant_branding.assert_awaited_once()

    # Non admin user is forbidden
    service.update_tenant_branding.reset_mock()
    app = _build_test_app(non_admin_user, service)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.put(
            "/api/v1/branding",
            json={"branding": {"product_name": "Updated ISP"}},
        )
        assert resp.status_code == 403
        service.update_tenant_branding.assert_not_called()

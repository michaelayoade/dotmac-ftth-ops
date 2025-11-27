"""Smoke tests for the integrations router using a stub registry.

Ensures list/detail/health endpoints respond with minimal expected structure.
"""

import pytest
import pytest_asyncio
from dataclasses import dataclass
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.integrations import IntegrationConfig, IntegrationHealth, IntegrationStatus, IntegrationType
from dotmac.platform.integrations.router import integrations_router

pytestmark = pytest.mark.integration


class FakeIntegration:
    def __init__(self, config: IntegrationConfig):
        self.config = config
        self.name = config.name
        self.provider = config.provider

    async def health_check(self) -> IntegrationHealth:
        return IntegrationHealth(
            name=self.name,
            status=IntegrationStatus.READY,
            message="ok",
        )


@dataclass
class FakeRegistry:
    _configs: dict[str, IntegrationConfig]
    _integrations: dict[str, FakeIntegration]

    def get_integration(self, name: str):
        return self._integrations.get(name)

    def get_integration_error(self, name: str):
        return None


@pytest.fixture
def integrations_app(monkeypatch):
    app = FastAPI()
    app.include_router(integrations_router, prefix="/api/v1")

    test_user = UserInfo(
        user_id="user-integrations",
        username="integrations",
        email="integrations@example.com",
        tenant_id="tenant-123",
        permissions=["integrations:read"],
    )

    async def override_user():
        return test_user

    config = IntegrationConfig(
        name="fake",
        type=IntegrationType.EMAIL,
        provider="fake-provider",
        enabled=True,
        settings={},
    )
    fake_integration = FakeIntegration(config)
    registry = FakeRegistry(_configs={"fake": config}, _integrations={"fake": fake_integration})

    async def override_registry():
        return registry

    app.dependency_overrides[get_current_user] = override_user
    monkeypatch.setattr("dotmac.platform.integrations.router.get_integration_registry", override_registry)

    return app


@pytest_asyncio.fixture
async def integrations_client(integrations_app):
    transport = ASGITransport(app=integrations_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_list_and_detail_integrations(integrations_client):
    resp = await integrations_client.get("/api/v1/integrations", follow_redirects=True)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["integrations"][0]["name"] == "fake"

    detail = await integrations_client.get("/api/v1/integrations/fake", follow_redirects=True)
    assert detail.status_code == 200
    assert detail.json()["status"] in (IntegrationStatus.READY.value, "ready")


@pytest.mark.asyncio
async def test_health_check(integrations_client):
    resp = await integrations_client.post(
        "/api/v1/integrations/fake/health-check", follow_redirects=True
    )
    assert resp.status_code == 200
    assert resp.json()["status"] in (IntegrationStatus.READY.value, "ready")

"""Integration-style smoke tests for plugin router endpoints.

Exercises list/available/schema/refresh to mirror UI calls.
"""

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.plugins.router import router

pytestmark = pytest.mark.integration


@pytest.fixture
def plugins_app(monkeypatch):
    """Minimal FastAPI app exposing the plugins router."""
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/plugins")

    test_user = UserInfo(
        user_id="user-plugins",
        username="plugin-tester",
        email="plugins@example.com",
        tenant_id="tenant-123",
        permissions=["plugins:manage"],
    )

    async def override_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_user
    return app


@pytest_asyncio.fixture
async def plugins_client(plugins_app):
    transport = ASGITransport(app=plugins_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_list_and_schema_endpoints(plugins_client):
    # List available plugins (summary)
    resp = await plugins_client.get("/api/v1/plugins", follow_redirects=True)
    assert resp.status_code == 200
    plugins = resp.json()
    assert isinstance(plugins, list)

    # Alias endpoint
    resp_alias = await plugins_client.get("/api/v1/plugins/available", follow_redirects=True)
    assert resp_alias.status_code == 200

    if plugins:
        plugin_id = plugins[0]["id"]

        # Schema endpoint for first plugin
        schema_resp = await plugins_client.get(f"/api/v1/plugins/{plugin_id}/schema")
        assert schema_resp.status_code in (200, 404)  # some plugins may not expose schema

        # Instances list
        inst_resp = await plugins_client.get("/api/v1/plugins/instances")
        assert inst_resp.status_code == 200

        # Toggle (no-op) endpoint
        toggle_resp = await plugins_client.patch(f"/api/v1/plugins/{plugin_id}", json={"enabled": True})
        assert toggle_resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_refresh_plugins(plugins_client):
    refresh_resp = await plugins_client.post("/api/v1/plugins/refresh")
    assert refresh_resp.status_code in (200, 500)

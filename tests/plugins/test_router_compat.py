import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.plugins import schema
from dotmac.platform.plugins.router import get_registry, router
from dotmac.platform.auth.dependencies import get_current_user

pytestmark = pytest.mark.integration


class _StubRegistry:
    def __init__(self) -> None:
        self.plugin_config = schema.PluginConfig(
            name="dummy",
            type=schema.PluginType.NOTIFICATION,
            version="1.0.0",
            description="Dummy plugin",
            fields=[],
        )
        self.instance_id = uuid.uuid4()
        self.instance = schema.PluginInstance(
            id=self.instance_id,
            plugin_name="dummy",
            instance_name="default",
            config_schema=self.plugin_config,
            status=schema.PluginStatus.ACTIVE,
        )

    async def initialize(self) -> None:  # compatibility with get_registry
        return None

    def list_available_plugins(self):
        return [self.plugin_config]

    def list_plugin_instances(self):
        return [self.instance]

    async def get_plugin_instance(self, instance_id):
        return self.instance if instance_id == self.instance_id else None

    async def test_plugin_connection(self, instance_id, test_config=None):
        return schema.PluginTestResult(
            success=True,
            message="ok",
            details={},
            timestamp="2024-01-01T00:00:00Z",
            response_time_ms=0,
        )


@pytest.fixture
def client():
    app = FastAPI()
    stub = _StubRegistry()
    app.dependency_overrides[get_registry] = lambda: stub
    app.dependency_overrides[get_current_user] = lambda: object()  # bypass auth
    app.include_router(router, prefix="/api/v1/plugins")
    with TestClient(app) as http:
        yield http, stub


def test_list_plugins_returns_ui_shape(client):
    http, _ = client
    resp = http.get("/api/v1/plugins/")
    assert resp.status_code == 200
    data = resp.json()
    assert data and data[0]["id"] == "dummy"
    assert data[0]["enabled"] is True


def test_toggle_plugin_patch(client):
    http, _ = client
    resp = http.patch("/api/v1/plugins/dummy", params={"enabled": False})
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "dummy"
    assert body["enabled"] is False


def test_refresh_plugin_instance_alias(client):
    http, stub = client
    instance_id = stub.instance_id
    resp = http.post(f"/api/v1/plugins/instances/{instance_id}/refresh")
    assert resp.status_code == 202
    assert resp.json()["instance_id"] == str(instance_id)

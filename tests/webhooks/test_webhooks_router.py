import uuid

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_async_db
from dotmac.platform.webhooks.models import DeliveryStatus, WebhookDelivery
from dotmac.platform.webhooks.router import router

pytestmark = pytest.mark.integration


@pytest.fixture
def webhooks_app(async_db_session, monkeypatch):
    """Create a FastAPI app with the webhooks router and test overrides."""
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")

    test_user = UserInfo(
        user_id="user-123",
        username="test",
        email="test@example.com",
        tenant_id="tenant-123",
        permissions=["webhooks:manage"],
    )

    async def override_current_user():
        return test_user

    async def override_async_db():
        yield async_db_session

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_async_db] = override_async_db

    class FakeRBACService:
        async def user_has_all_permissions(self, user_id: str, permissions: list[str]) -> bool:
            return True

    monkeypatch.setattr(
        "dotmac.platform.auth.rbac_dependencies.RBACService",
        lambda _session: FakeRBACService(),
    )

    return app, test_user, async_db_session


@pytest_asyncio.fixture
async def webhooks_client(webhooks_app):
    app, _, _ = webhooks_app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


async def _create_subscription(client: AsyncClient):
    payload = {
        "url": "https://example.com/webhook",
        "description": "Invoice events",
        "events": ["invoice.created", "invoice.paid"],
        "headers": {"X-Test": "value"},
        "retry_enabled": True,
        "max_retries": 3,
        "timeout_seconds": 30,
        "custom_metadata": {"source": "tests"},
    }
    response = await client.post("/api/v1/webhooks/subscriptions", json=payload)
    assert response.status_code == 201
    data = response.json()
    return data["id"], data["secret"]


@pytest.mark.asyncio
async def test_create_and_list_subscriptions(webhooks_client):
    sub_id, secret = await _create_subscription(webhooks_client)
    assert secret

    list_response = await webhooks_client.get("/api/v1/webhooks/subscriptions")
    assert list_response.status_code == 200
    subscriptions = list_response.json()
    assert len(subscriptions) == 1
    assert subscriptions[0]["id"] == sub_id


@pytest.mark.asyncio
async def test_create_subscription_with_custom_events(webhooks_client):
    """Router should accept arbitrary event names for UI compatibility."""
    payload = {
        "url": "https://hooks.example.com/custom",
        "description": "Custom events",
        "events": ["custom.event", "tenant.something-happened"],
    }
    response = await webhooks_client.post("/api/v1/webhooks/subscriptions", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["events"] == ["custom.event", "tenant.something-happened"]


@pytest.mark.asyncio
async def test_get_update_and_delete_subscription(webhooks_client):
    sub_id, _ = await _create_subscription(webhooks_client)

    get_response = await webhooks_client.get(f"/api/v1/webhooks/subscriptions/{sub_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == sub_id

    update_payload = {"description": "Updated description", "retry_enabled": False}
    update_response = await webhooks_client.patch(
        f"/api/v1/webhooks/subscriptions/{sub_id}", json=update_payload
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "Updated description"
    assert update_response.json()["retry_enabled"] is False

    delete_response = await webhooks_client.delete(f"/api/v1/webhooks/subscriptions/{sub_id}")
    assert delete_response.status_code == 204

    missing_response = await webhooks_client.get(f"/api/v1/webhooks/subscriptions/{sub_id}")
    assert missing_response.status_code == 404


@pytest.mark.asyncio
async def test_rotate_secret_changes_value(webhooks_client):
    sub_id, original_secret = await _create_subscription(webhooks_client)

    rotate_response = await webhooks_client.post(
        f"/api/v1/webhooks/subscriptions/{sub_id}/rotate-secret"
    )
    assert rotate_response.status_code == 200
    new_secret = rotate_response.json()["secret"]
    assert new_secret
    assert new_secret != original_secret


@pytest.mark.asyncio
async def test_list_deliveries_for_subscription(webhooks_app, webhooks_client):
    _, _, session = webhooks_app
    sub_id, _ = await _create_subscription(webhooks_client)

    delivery = WebhookDelivery(
        subscription_id=uuid.UUID(sub_id),
        tenant_id="tenant-123",
        event_type="invoice.created",
        event_id="evt-1",
        event_data={"foo": "bar"},
        status=DeliveryStatus.SUCCESS,
        response_code=200,
        response_body="OK",
        attempt_number=1,
    )
    session.add(delivery)
    await session.commit()

    list_response = await webhooks_client.get(f"/api/v1/webhooks/subscriptions/{sub_id}/deliveries")
    assert list_response.status_code == 200
    deliveries = list_response.json()
    assert len(deliveries) == 1
    assert deliveries[0]["event_id"] == "evt-1"

    single_response = await webhooks_client.get(
        f"/api/v1/webhooks/deliveries/{deliveries[0]['id']}"
    )
    assert single_response.status_code == 200
    assert single_response.json()["status"] == DeliveryStatus.SUCCESS.value


@pytest.mark.asyncio
async def test_recent_deliveries_endpoint(webhooks_app, webhooks_client):
    _, _, session = webhooks_app
    sub_id, _ = await _create_subscription(webhooks_client)

    delivery = WebhookDelivery(
        subscription_id=uuid.UUID(sub_id),
        tenant_id="tenant-123",
        event_type="invoice.paid",
        event_id="evt-2",
        event_data={"amount": 100},
        status=DeliveryStatus.SUCCESS,
        response_code=200,
        attempt_number=1,
    )
    session.add(delivery)
    await session.commit()

    response = await webhooks_client.get("/api/v1/webhooks/deliveries")
    assert response.status_code == 200
    deliveries = response.json()
    assert len(deliveries) == 1
    assert deliveries[0]["event_type"] == "invoice.paid"


@pytest.mark.asyncio
async def test_subscription_requires_tenant(webhooks_app):
    app, _, session = webhooks_app

    tenantless_user = UserInfo(
        user_id="user-tenantless",
        username="tenantless",
        email="tenantless@example.com",
        tenant_id=None,
        permissions=["webhooks:manage"],
    )

    async def override_user():
        return tenantless_user

    original = app.dependency_overrides[get_current_user]
    app.dependency_overrides[get_current_user] = override_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        payload = {
            "url": "https://example.com/no-tenant",
            "events": ["invoice.created"],
        }
        response = await client.post("/api/v1/webhooks/subscriptions", json=payload)
        assert response.status_code == 400

    app.dependency_overrides[get_current_user] = original
    await session.rollback()

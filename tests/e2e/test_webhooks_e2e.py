"""
End-to-End Webhooks Tests.

Covers: Webhooks Router + Webhook Delivery Service + Webhook Models + Event Bus
Strategy: Test complete webhook lifecycle from HTTP request through delivery and retry

Expected Coverage:
- Webhook Router: → 90%+
- Webhook Delivery Service: → 85%+
- Webhook Subscription Service: → 90%+
- Webhook Event Bus: → 80%+
- Webhook Models: → 95%+
"""

import os
import uuid
from unittest.mock import AsyncMock, Mock, patch

import httpx
import pytest
import pytest_asyncio

from dotmac.platform.webhooks.delivery import WebhookDeliveryService
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import (
    DeliveryStatus,
    WebhookDelivery,
    WebhookSubscription,
)

# Set test environment

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]

os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-e2e-tests"

# ==================== Fixtures ====================


@pytest_asyncio.fixture
async def db_session(e2e_db_session):
    """Use shared async session from per-test E2E engine."""
    yield e2e_db_session


# Note: Use shared fixtures from tests/e2e/conftest.py
# - tenant_id, user_id, async_client, auth_headers
# This file only defines webhook-specific fixtures below


@pytest_asyncio.fixture
async def webhook_subscription(db_session):
    """Create a test webhook subscription."""
    # Use e2e-test-tenant from shared fixture
    subscription = WebhookSubscription(
        tenant_id="e2e-test-tenant",
        url="https://example.com/webhook",
        description="Test webhook subscription",
        events=["invoice.created", "invoice.paid", "customer.created"],
        secret="test-secret-key",
        headers={"Authorization": "Bearer test-token"},
        is_active=True,
        retry_enabled=True,
        max_retries=3,
        timeout_seconds=30,
        success_count=0,
        failure_count=0,
        custom_metadata={},  # Initialize to avoid MetaData assignment errors
    )
    db_session.add(subscription)
    await db_session.commit()
    await db_session.refresh(subscription)
    return subscription


@pytest.fixture
def mock_webhook_endpoint():
    """Create a mock webhook endpoint that returns successful responses."""
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.text = '{"status": "ok"}'
    return mock_response


# ==================== Webhook Subscription CRUD Tests ====================


class TestWebhookSubscriptionCRUD:
    """Test webhook subscription create, read, update, delete via API."""

    async def test_create_webhook_subscription_success(self, async_client, auth_headers):
        """Test creating a new webhook subscription via API."""
        payload = {
            "url": "https://api.example.com/webhooks",
            "description": "Production webhook endpoint",
            "events": ["invoice.created", "invoice.paid", "payment.succeeded"],
            "headers": {"Authorization": "Bearer secret-token"},
            "retry_enabled": True,
            "max_retries": 5,
            "timeout_seconds": 60,
            "custom_metadata": {"environment": "production"},
        }

        response = await async_client.post(
            "/api/v1/webhooks/subscriptions",
            json=payload,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["url"] == payload["url"]
        assert data["description"] == payload["description"]
        assert set(data["events"]) == set(payload["events"])
        assert data["is_active"] is True
        assert data["retry_enabled"] is True
        assert data["max_retries"] == 5
        assert data["timeout_seconds"] == 60
        assert "id" in data
        assert "created_at" in data

    async def test_create_webhook_subscription_invalid_events(self, async_client, auth_headers):
        """Test creating subscription with invalid event types."""
        payload = {
            "url": "https://api.example.com/webhooks",
            "events": ["invalid.event", "another.invalid.event"],
        }

        response = await async_client.post(
            "/api/v1/webhooks/subscriptions",
            json=payload,
            headers=auth_headers,
        )

        assert response.status_code == 422  # Validation error

    async def test_list_webhook_subscriptions(
        self, async_client, webhook_subscription, auth_headers
    ):
        """Test listing webhook subscriptions."""
        response = await async_client.get("/api/v1/webhooks/subscriptions", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(sub["id"] == str(webhook_subscription.id) for sub in data)

    async def test_list_webhook_subscriptions_with_filters(
        self, async_client, webhook_subscription, auth_headers
    ):
        """Test listing subscriptions with filters."""
        # Filter by active status
        response = await async_client.get(
            "/api/v1/webhooks/subscriptions?is_active=true", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert all(sub["is_active"] is True for sub in data)

        # Filter by event type - skip this test for SQLite as it doesn't support json_contains
        # This would work with PostgreSQL in production
        # response = await async_client.get(
        #     "/api/v1/webhooks/subscriptions?event_type=invoice.created"
        # )
        # assert response.status_code == 200
        # data = response.json()
        # assert all("invoice.created" in sub["events"] for sub in data)

    async def test_get_webhook_subscription_by_id(
        self, async_client, webhook_subscription, auth_headers
    ):
        """Test retrieving a specific webhook subscription."""
        response = await async_client.get(
            f"/api/v1/webhooks/subscriptions/{webhook_subscription.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == str(webhook_subscription.id)
        assert data["url"] == webhook_subscription.url
        assert data["description"] == webhook_subscription.description

    async def test_get_webhook_subscription_not_found(self, async_client, auth_headers):
        """Test retrieving non-existent subscription."""
        fake_id = str(uuid.uuid4())
        response = await async_client.get(
            f"/api/v1/webhooks/subscriptions/{fake_id}", headers=auth_headers
        )

        assert response.status_code == 404

    async def test_update_webhook_subscription(
        self, async_client, webhook_subscription, auth_headers
    ):
        """Test updating a webhook subscription."""
        update_data = {
            "description": "Updated description",
            "is_active": False,
            "max_retries": 5,
        }

        response = await async_client.patch(
            f"/api/v1/webhooks/subscriptions/{webhook_subscription.id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["description"] == "Updated description"
        assert data["is_active"] is False
        assert data["max_retries"] == 5

    async def test_delete_webhook_subscription(
        self, async_client, webhook_subscription, auth_headers
    ):
        """Test deleting a webhook subscription."""
        response = await async_client.delete(
            f"/api/v1/webhooks/subscriptions/{webhook_subscription.id}",
            headers=auth_headers,
        )

        assert response.status_code == 204

        # Verify deletion
        get_response = await async_client.get(
            f"/api/v1/webhooks/subscriptions/{webhook_subscription.id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 404

    async def test_rotate_webhook_secret(
        self, async_client, webhook_subscription, db_session, auth_headers
    ):
        """Test rotating webhook signing secret."""
        # Store the original secret before rotation
        original_secret = webhook_subscription.secret

        # Refresh to ensure we have the latest metadata
        await db_session.refresh(webhook_subscription)

        # Initialize custom_metadata if it's None
        if webhook_subscription.custom_metadata is None:
            webhook_subscription.custom_metadata = {}
            await db_session.commit()
            await db_session.refresh(webhook_subscription)

        response = await async_client.post(
            f"/api/v1/webhooks/subscriptions/{webhook_subscription.id}/rotate-secret",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert "secret" in data
        assert data["secret"] != original_secret  # Compare with original secret
        assert "message" in data


# ==================== Webhook Delivery Tests ====================


class TestWebhookDelivery:
    """Test webhook delivery service and lifecycle."""

    async def test_deliver_webhook_success(self, db_session, webhook_subscription, tenant_id):
        """Test successful webhook delivery."""
        with patch("httpx.AsyncClient.post") as mock_post:
            # Mock successful response
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.text = '{"status": "received"}'
            mock_post.return_value = mock_response

            delivery_service = WebhookDeliveryService(db_session)

            event_data = {
                "invoice_id": "inv_123",
                "amount": 100.00,
                "currency": "USD",
            }

            delivery = await delivery_service.deliver(
                subscription=webhook_subscription,
                event_type="invoice.created",
                event_data=event_data,
                tenant_id=tenant_id,
            )

            assert delivery is not None
            assert delivery.status == DeliveryStatus.SUCCESS
            assert delivery.event_type == "invoice.created"
            assert delivery.response_code == 200
            assert delivery.attempt_number == 1
            assert delivery.duration_ms is not None

    async def test_deliver_webhook_failure_with_retry(
        self, db_session, webhook_subscription, tenant_id
    ):
        """Test failed webhook delivery with retry scheduling."""
        with patch("httpx.AsyncClient.post") as mock_post:
            # Mock failed response
            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.text = "Internal Server Error"
            mock_post.return_value = mock_response

            delivery_service = WebhookDeliveryService(db_session)

            event_data = {"test": "data"}

            delivery = await delivery_service.deliver(
                subscription=webhook_subscription,
                event_type="invoice.created",
                event_data=event_data,
                tenant_id=tenant_id,
            )

            assert delivery.status == DeliveryStatus.RETRYING
            assert delivery.response_code == 500
            assert delivery.next_retry_at is not None
            assert delivery.error_message is not None

    async def test_deliver_webhook_timeout(self, db_session, webhook_subscription, tenant_id):
        """Test webhook delivery timeout."""
        with patch("httpx.AsyncClient.post") as mock_post:
            # Mock timeout exception
            mock_post.side_effect = httpx.TimeoutException("Request timeout")

            delivery_service = WebhookDeliveryService(db_session)

            event_data = {"test": "data"}

            delivery = await delivery_service.deliver(
                subscription=webhook_subscription,
                event_type="invoice.created",
                event_data=event_data,
                tenant_id=tenant_id,
            )

            assert delivery.status == DeliveryStatus.RETRYING
            assert "timeout" in delivery.error_message.lower()

    async def test_deliver_webhook_410_disables_subscription(
        self, db_session, webhook_subscription, tenant_id
    ):
        """Test that 410 Gone response disables subscription."""
        # Initialize custom_metadata to avoid MetaData assignment error
        if webhook_subscription.custom_metadata is None:
            webhook_subscription.custom_metadata = {}
            await db_session.commit()
            await db_session.refresh(webhook_subscription)

        with patch("httpx.AsyncClient.post") as mock_post:
            # Mock 410 Gone response
            mock_response = AsyncMock()
            mock_response.status_code = 410
            mock_response.text = "Gone"
            mock_post.return_value = mock_response

            delivery_service = WebhookDeliveryService(db_session)

            event_data = {"test": "data"}

            delivery = await delivery_service.deliver(
                subscription=webhook_subscription,
                event_type="invoice.created",
                event_data=event_data,
                tenant_id=tenant_id,
            )

            assert delivery.status == DeliveryStatus.DISABLED
            assert delivery.response_code == 410

            # Verify subscription is disabled
            await db_session.refresh(webhook_subscription)
            assert webhook_subscription.is_active is False

    async def test_manual_retry_delivery(
        self, async_client, db_session, webhook_subscription, tenant_id, auth_headers
    ):
        """Test manually retrying a failed delivery."""
        # Create a failed delivery
        delivery = WebhookDelivery(
            tenant_id=tenant_id,
            subscription_id=webhook_subscription.id,
            event_type="invoice.created",
            event_id=str(uuid.uuid4()),
            event_data={"test": "data"},
            status=DeliveryStatus.FAILED,
            attempt_number=1,
            error_message="Initial failure",
        )
        db_session.add(delivery)
        await db_session.commit()
        await db_session.refresh(delivery)

        # Patch in the delivery module where httpx is actually used
        with patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient") as mock_client:
            # Create mock context manager for async with
            mock_client_instance = AsyncMock()
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            mock_client.return_value.__aexit__.return_value = None

            # Mock successful retry response
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.text = "OK"
            mock_client_instance.post.return_value = mock_response

            response = await async_client.post(
                f"/api/v1/webhooks/deliveries/{delivery.id}/retry", headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert "message" in data


# ==================== Webhook Events and Event Bus Tests ====================


class TestWebhookEventBus:
    """Test event publishing and webhook triggering."""

    async def test_publish_event_triggers_webhooks(
        self, db_session, webhook_subscription, tenant_id
    ):
        """Test that publishing an event triggers matching webhooks."""
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.text = "OK"
            mock_post.return_value = mock_response

            event_bus = get_event_bus()

            event_data = {
                "invoice_id": "inv_456",
                "amount": 250.00,
            }

            delivered_count = await event_bus.publish(
                event_type="invoice.created",
                event_data=event_data,
                tenant_id=tenant_id,
                db=db_session,
            )

            assert delivered_count == 1
            assert mock_post.called

    async def test_publish_event_no_matching_subscriptions(
        self, db_session, webhook_subscription, tenant_id
    ):
        """Test publishing event with no matching subscriptions."""
        event_bus = get_event_bus()

        event_data = {"test": "data"}

        # Event type not in subscription's events list
        delivered_count = await event_bus.publish(
            event_type="ticket.created",
            event_data=event_data,
            tenant_id=tenant_id,
            db=db_session,
        )

        assert delivered_count == 0

    async def test_publish_event_inactive_subscription_ignored(
        self, db_session, webhook_subscription, tenant_id
    ):
        """Test that inactive subscriptions are not triggered."""
        # Disable subscription
        webhook_subscription.is_active = False
        await db_session.commit()

        event_bus = get_event_bus()

        event_data = {"test": "data"}

        delivered_count = await event_bus.publish(
            event_type="invoice.created",
            event_data=event_data,
            tenant_id=tenant_id,
            db=db_session,
        )

        assert delivered_count == 0

    async def test_list_available_events(self, async_client, auth_headers):
        """Test listing available webhook event types."""
        response = await async_client.get("/api/v1/webhooks/events", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert "total" in data
        assert "events" in data
        assert data["total"] > 0

        # Check for standard events
        event_types = [evt["event_type"] for evt in data["events"]]
        assert "invoice.created" in event_types
        assert "invoice.paid" in event_types
        assert "customer.created" in event_types

    async def test_get_event_details(self, async_client, auth_headers):
        """Test getting details for a specific event type."""
        response = await async_client.get(
            "/api/v1/webhooks/events/invoice.created", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["event_type"] == "invoice.created"
        assert "description" in data


# ==================== Webhook Delivery History Tests ====================


class TestWebhookDeliveryHistory:
    """Test webhook delivery history and logging."""

    async def test_list_deliveries_for_subscription(
        self, async_client, db_session, webhook_subscription, tenant_id, auth_headers
    ):
        """Test listing delivery history for a subscription."""
        # Create some deliveries
        for i in range(3):
            delivery = WebhookDelivery(
                tenant_id=tenant_id,
                subscription_id=webhook_subscription.id,
                event_type="invoice.created",
                event_id=f"evt_{i}",
                event_data={"test": i},
                status=DeliveryStatus.SUCCESS,
                attempt_number=1,
            )
            db_session.add(delivery)
        await db_session.commit()

        response = await async_client.get(
            f"/api/v1/webhooks/subscriptions/{webhook_subscription.id}/deliveries",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert len(data) == 3

    async def test_list_deliveries_with_status_filter(
        self, async_client, db_session, webhook_subscription, tenant_id, auth_headers
    ):
        """Test filtering deliveries by status."""
        # Create deliveries with different statuses
        success_delivery = WebhookDelivery(
            tenant_id=tenant_id,
            subscription_id=webhook_subscription.id,
            event_type="invoice.created",
            event_id="evt_success",
            event_data={"test": "success"},
            status=DeliveryStatus.SUCCESS,
            attempt_number=1,
        )
        failed_delivery = WebhookDelivery(
            tenant_id=tenant_id,
            subscription_id=webhook_subscription.id,
            event_type="invoice.created",
            event_id="evt_failed",
            event_data={"test": "failed"},
            status=DeliveryStatus.FAILED,
            attempt_number=3,
        )
        db_session.add_all([success_delivery, failed_delivery])
        await db_session.commit()

        response = await async_client.get(
            f"/api/v1/webhooks/subscriptions/{webhook_subscription.id}/deliveries?status=failed",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert all(d["status"] == "failed" for d in data)

    async def test_list_all_recent_deliveries(
        self, async_client, db_session, webhook_subscription, tenant_id, auth_headers
    ):
        """Test listing recent deliveries across all subscriptions."""
        # Create deliveries
        for i in range(5):
            delivery = WebhookDelivery(
                tenant_id=tenant_id,
                subscription_id=webhook_subscription.id,
                event_type="invoice.created",
                event_id=f"evt_{i}",
                event_data={"test": i},
                status=DeliveryStatus.SUCCESS,
                attempt_number=1,
            )
            db_session.add(delivery)
        await db_session.commit()

        response = await async_client.get(
            "/api/v1/webhooks/deliveries?limit=10", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert len(data) <= 10

    async def test_get_delivery_by_id(
        self, async_client, db_session, webhook_subscription, tenant_id, auth_headers
    ):
        """Test retrieving specific delivery details."""
        delivery = WebhookDelivery(
            tenant_id=tenant_id,
            subscription_id=webhook_subscription.id,
            event_type="invoice.paid",
            event_id="evt_details",
            event_data={"invoice_id": "inv_789"},
            status=DeliveryStatus.SUCCESS,
            response_code=200,
            attempt_number=1,
            duration_ms=150,
        )
        db_session.add(delivery)
        await db_session.commit()
        await db_session.refresh(delivery)

        response = await async_client.get(
            f"/api/v1/webhooks/deliveries/{delivery.id}", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == str(delivery.id)
        assert data["event_type"] == "invoice.paid"
        assert data["status"] == "success"
        assert data["response_code"] == 200
        assert data["duration_ms"] == 150


# ==================== Full Webhook Lifecycle E2E Test ====================


class TestWebhookLifecycleE2E:
    """Test complete webhook lifecycle from creation to delivery and retry."""

    async def test_complete_webhook_lifecycle(
        self, async_client, db_session, tenant_id, auth_headers
    ):
        """
        Test full webhook lifecycle:
        1. Create subscription
        2. Trigger event
        3. Verify delivery
        4. Simulate failure
        5. Retry delivery
        6. Check statistics
        """
        # Step 1: Create webhook subscription
        create_payload = {
            "url": "https://api.example.com/webhooks/endpoint",
            "description": "E2E test webhook",
            "events": ["invoice.created", "invoice.paid"],
            "retry_enabled": True,
            "max_retries": 3,
        }

        create_response = await async_client.post(
            "/api/v1/webhooks/subscriptions",
            json=create_payload,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        subscription_data = create_response.json()
        subscription_id = subscription_data["id"]

        # Step 2: Trigger event with successful delivery
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.text = "OK"
            mock_post.return_value = mock_response

            event_bus = get_event_bus()
            await event_bus.publish(
                event_type="invoice.created",
                event_data={"invoice_id": "inv_e2e_test", "amount": 500.00},
                tenant_id=tenant_id,
                db=db_session,
            )

        # Step 3: Verify delivery was logged
        deliveries_response = await async_client.get(
            f"/api/v1/webhooks/subscriptions/{subscription_id}/deliveries",
            headers=auth_headers,
        )
        assert deliveries_response.status_code == 200
        deliveries = deliveries_response.json()
        assert len(deliveries) >= 1
        assert deliveries[0]["status"] == "success"

        # Step 4: Check subscription statistics
        subscription_response = await async_client.get(
            f"/api/v1/webhooks/subscriptions/{subscription_id}",
            headers=auth_headers,
        )
        assert subscription_response.status_code == 200
        updated_subscription = subscription_response.json()
        assert updated_subscription["success_count"] >= 1
        assert updated_subscription["last_triggered_at"] is not None

        # Step 5: Simulate failed delivery
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 503
            mock_response.text = "Service Unavailable"
            mock_post.return_value = mock_response

            await event_bus.publish(
                event_type="invoice.paid",
                event_data={"invoice_id": "inv_e2e_fail", "amount": 300.00},
                tenant_id=tenant_id,
                db=db_session,
            )

        # Step 6: Verify failed delivery is in retry state
        deliveries_response = await async_client.get(
            f"/api/v1/webhooks/subscriptions/{subscription_id}/deliveries",
            headers=auth_headers,
        )
        deliveries = deliveries_response.json()
        failed_deliveries = [d for d in deliveries if d["status"] == "retrying"]
        assert len(failed_deliveries) >= 1

        # Step 7: Manual retry
        if failed_deliveries:
            failed_delivery_id = failed_deliveries[0]["id"]

            with patch("httpx.AsyncClient.post") as mock_post:
                mock_response = AsyncMock()
                mock_response.status_code = 200
                mock_response.text = "OK"
                mock_post.return_value = mock_response

                retry_response = await async_client.post(
                    f"/api/v1/webhooks/deliveries/{failed_delivery_id}/retry",
                    headers=auth_headers,
                )
                assert retry_response.status_code == 200

        # Step 8: Update subscription (disable it)
        update_response = await async_client.patch(
            f"/api/v1/webhooks/subscriptions/{subscription_id}",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert update_response.status_code == 200
        assert update_response.json()["is_active"] is False

        # Step 9: Verify events no longer trigger disabled subscription
        with patch("httpx.AsyncClient.post") as mock_post:
            await event_bus.publish(
                event_type="invoice.created",
                event_data={"invoice_id": "inv_after_disable"},
                tenant_id=tenant_id,
                db=db_session,
            )

            # Should not call webhook endpoint
            mock_post.assert_not_called()

        # Step 10: Delete subscription
        delete_response = await async_client.delete(
            f"/api/v1/webhooks/subscriptions/{subscription_id}",
            headers=auth_headers,
        )
        assert delete_response.status_code == 204


# ==================== Webhook Security Tests ====================


class TestWebhookSecurity:
    """Test webhook security features (HMAC signatures, secrets)."""

    async def test_webhook_signature_generation(self, db_session, webhook_subscription, tenant_id):
        """Test that webhooks include HMAC signature."""
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.text = "OK"
            mock_post.return_value = mock_response

            delivery_service = WebhookDeliveryService(db_session)

            event_data = {"test": "signature"}

            await delivery_service.deliver(
                subscription=webhook_subscription,
                event_type="invoice.created",
                event_data=event_data,
                tenant_id=tenant_id,
            )

            # Verify signature header was included
            call_args = mock_post.call_args
            headers = call_args[1]["headers"]

            assert "X-Webhook-Signature" in headers
            assert "X-Webhook-Event-Id" in headers
            assert "X-Webhook-Event-Type" in headers
            assert headers["X-Webhook-Event-Type"] == "invoice.created"

    async def test_webhook_custom_headers(self, db_session, tenant_id):
        """Test that custom headers are included in webhook requests."""
        subscription = WebhookSubscription(
            tenant_id=tenant_id,
            url="https://example.com/webhook",
            events=["test.event"],
            secret="secret",
            headers={
                "Authorization": "Bearer custom-token",
                "X-Custom-Header": "custom-value",
            },
            is_active=True,
            retry_enabled=False,
            max_retries=0,
            timeout_seconds=30,
        )
        db_session.add(subscription)
        await db_session.commit()

        with patch("httpx.AsyncClient.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.text = "OK"
            mock_post.return_value = mock_response

            delivery_service = WebhookDeliveryService(db_session)

            await delivery_service.deliver(
                subscription=subscription,
                event_type="test.event",
                event_data={"test": "data"},
                tenant_id=tenant_id,
            )

            call_args = mock_post.call_args
            headers = call_args[1]["headers"]

            assert headers["Authorization"] == "Bearer custom-token"
            assert headers["X-Custom-Header"] == "custom-value"


# ==================== Edge Cases and Error Handling ====================


class TestWebhookEdgeCases:
    """Test edge cases and error handling."""

    async def test_webhook_with_no_retry_fails_immediately(self, db_session, tenant_id):
        """Test that webhooks with retry disabled fail immediately."""
        subscription = WebhookSubscription(
            tenant_id=tenant_id,
            url="https://example.com/webhook",
            events=["test.event"],
            secret="secret",
            is_active=True,
            retry_enabled=False,
            max_retries=0,
            timeout_seconds=30,
        )
        db_session.add(subscription)
        await db_session.commit()

        with patch("httpx.AsyncClient.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.text = "Error"
            mock_post.return_value = mock_response

            delivery_service = WebhookDeliveryService(db_session)

            delivery = await delivery_service.deliver(
                subscription=subscription,
                event_type="test.event",
                event_data={"test": "data"},
                tenant_id=tenant_id,
            )

            assert delivery.status == DeliveryStatus.FAILED
            assert delivery.next_retry_at is None

    async def test_webhook_max_retries_exhausted(self, db_session, tenant_id):
        """Test that max retries are respected."""
        subscription = WebhookSubscription(
            tenant_id=tenant_id,
            url="https://example.com/webhook",
            events=["test.event"],
            secret="secret",
            is_active=True,
            retry_enabled=True,
            max_retries=2,
            timeout_seconds=30,
        )
        db_session.add(subscription)
        await db_session.commit()

        delivery = WebhookDelivery(
            tenant_id=tenant_id,
            subscription_id=subscription.id,
            event_type="test.event",
            event_id="evt_max_retry",
            event_data={"test": "data"},
            status=DeliveryStatus.RETRYING,
            attempt_number=2,  # Already at max
        )
        db_session.add(delivery)
        await db_session.commit()

        with patch("httpx.AsyncClient.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.text = "Error"
            mock_post.return_value = mock_response

            delivery_service = WebhookDeliveryService(db_session)

            # Simulate retry
            delivery.attempt_number += 1
            await delivery_service._attempt_delivery(
                delivery=delivery,
                subscription=subscription,
                payload_bytes=b'{"test": "data"}',
                headers={"Content-Type": "application/json"},
            )

            # Should be marked as failed, not retrying
            assert delivery.status == DeliveryStatus.FAILED

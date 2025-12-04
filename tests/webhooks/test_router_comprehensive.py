"""
Comprehensive tests for webhooks router.

Covers all webhook subscription and delivery endpoints.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.webhooks.router import router

pytestmark = pytest.mark.integration

pytestmark = pytest.mark.asyncio


def _override_webhook_permissions(app: FastAPI, mock_user):
    permission_dependency = require_permission("webhooks:manage")
    app.dependency_overrides[permission_dependency] = lambda: mock_user


@pytest.fixture
def app():
    """Create test FastAPI app."""
    test_app = FastAPI()
    test_app.include_router(router, prefix="/api/v1")
    return test_app


@pytest.fixture
def mock_user():
    """Mock authenticated user."""
    from dotmac.platform.auth.core import UserInfo

    return UserInfo(
        user_id="test-user-123",
        tenant_id="test-tenant-123",
        email="test@example.com",
    )


@pytest.fixture
def mock_subscription_service():
    """Mock WebhookSubscriptionService."""
    service = MagicMock()

    now = datetime.now(UTC)

    # Create mock objects with attributes (not dicts)
    def make_subscription(**overrides):
        sub = MagicMock()
        defaults = {
            "id": "sub-123",
            "url": "https://example.com/webhook",
            "description": "Test webhook",
            "events": ["invoice.created"],
            "is_active": True,
            "retry_enabled": True,
            "max_retries": 3,
            "timeout_seconds": 30,
            "success_count": 0,
            "failure_count": 0,
            "last_triggered_at": None,
            "last_success_at": None,
            "last_failure_at": None,
            "created_at": now,
            "updated_at": now,
            "custom_metadata": {},
            "secret": "whsec_test123",
        }
        defaults.update(overrides)
        for key, value in defaults.items():
            setattr(sub, key, value)
        return sub

    # Helper to create mock delivery
    def make_delivery(**overrides):
        delivery = MagicMock()
        defaults = {
            "id": "del-123",
            "subscription_id": "sub-123",
            "event_type": "invoice.created",
            "event_id": "evt-123",
            "status": "success",
            "response_code": 200,
            "error_message": None,
            "attempt_number": 1,
            "duration_ms": 150,
            "created_at": datetime.now(UTC),
            "next_retry_at": None,
        }
        defaults.update(overrides)
        for key, value in defaults.items():
            setattr(delivery, key, value)
        return delivery

    service.create_subscription = AsyncMock(return_value=make_subscription())
    service.list_subscriptions = AsyncMock(return_value=[])
    service.get_subscription = AsyncMock(return_value=make_subscription())
    service.update_subscription = AsyncMock(
        return_value=make_subscription(events=["invoice.paid", "payment.succeeded"])
    )
    service.delete_subscription = AsyncMock()
    service.rotate_secret = AsyncMock(
        return_value="whsec_new123"
    )  # Returns string, not subscription
    service.get_deliveries = AsyncMock(return_value=[])  # For subscription-specific deliveries
    service.get_recent_deliveries = AsyncMock(return_value=[])  # For all deliveries
    service.get_delivery = AsyncMock(return_value=make_delivery())  # For single delivery lookup
    return service


@pytest.fixture
def mock_delivery_service():
    """Mock WebhookDeliveryService."""
    service = MagicMock()

    def make_delivery(**overrides):
        delivery = MagicMock()
        defaults = {
            "id": "del-123",
            "subscription_id": "sub-123",
            "event_type": "invoice.created",
            "status": "success",
            "response_status": 200,
            "created_at": datetime.now(UTC),
        }
        defaults.update(overrides)
        for key, value in defaults.items():
            setattr(delivery, key, value)
        return delivery

    service.list_deliveries = AsyncMock(return_value=[])
    service.get_delivery = AsyncMock(return_value=make_delivery())
    service.retry_delivery = AsyncMock(return_value=True)  # Returns boolean success
    return service


@pytest.fixture
def mock_sub_service_cls(mock_subscription_service):
    """Patch WebhookSubscriptionService class."""
    with patch(
        "dotmac.platform.webhooks.router.WebhookSubscriptionService",
        return_value=mock_subscription_service,
    ):
        yield


@pytest.fixture
def mock_del_service_cls(mock_delivery_service):
    """Patch WebhookDeliveryService class."""
    with patch(
        "dotmac.platform.webhooks.router.WebhookDeliveryService", return_value=mock_delivery_service
    ):
        yield


@pytest.fixture
def setup_dependencies(app, mock_user, mock_sub_service_cls, mock_del_service_cls):
    """Setup dependency overrides."""
    from dotmac.platform.auth.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_user
    _override_webhook_permissions(app, mock_user)

    yield app

    app.dependency_overrides.clear()


# ============================================================================
# Subscription Endpoints
# ============================================================================


class TestCreateSubscription:
    """Test POST /subscriptions."""

    async def test_create_subscription_success(self, setup_dependencies):
        """Test creating a webhook subscription."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/webhooks/subscriptions",
                json={
                    "url": "https://example.com/webhook",
                    "events": ["invoice.created"],
                },
            )

            assert response.status_code == 201
            data = response.json()
            assert data["secret"] == "whsec_test123"
            assert data["id"] == "sub-123"
            assert data["url"] == "https://example.com/webhook"

    async def test_create_subscription_with_description(self, setup_dependencies):
        """Test creating subscription with description."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/webhooks/subscriptions",
                json={
                    "url": "https://example.com/webhook",
                    "events": ["invoice.created"],
                    "description": "Production webhook",
                },
            )

            assert response.status_code == 201
            body = response.json()
            assert body["secret"] == "whsec_test123"

    async def test_create_subscription_service_error(self, app, mock_user):
        """Test create subscription when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.create_subscription = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/v1/webhooks/subscriptions",
                    json={
                        "url": "https://example.com/webhook",
                        "events": ["invoice.created"],
                    },
                )

                assert response.status_code == 500
                assert "Failed to create webhook subscription" in response.json()["detail"]

        app.dependency_overrides.clear()


class TestListSubscriptions:
    """Test GET /subscriptions."""

    async def test_list_subscriptions_empty(self, setup_dependencies):
        """Test listing subscriptions when none exist."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/webhooks/subscriptions")

            assert response.status_code == 200
            assert response.json() == []

    async def test_list_subscriptions_with_filters(self, setup_dependencies):
        """Test listing subscriptions with event filter."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/api/v1/webhooks/subscriptions", params={"event_type": "invoice.created"}
            )

            assert response.status_code == 200

    async def test_list_subscriptions_service_error(self, app, mock_user):
        """Test list subscriptions when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.list_subscriptions = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/subscriptions")

                assert response.status_code == 500
                assert "Failed to list webhook subscriptions" in response.json()["detail"]

        app.dependency_overrides.clear()


class TestGetSubscription:
    """Test GET /subscriptions/{subscription_id}."""

    async def test_get_subscription_success(self, setup_dependencies):
        """Test getting a specific subscription."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/webhooks/subscriptions/sub-123")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "sub-123"

    async def test_get_subscription_not_found(self, app, mock_user):
        """Test getting non-existent subscription."""
        from dotmac.platform.auth.dependencies import get_current_user

        not_found_service = MagicMock()
        not_found_service.get_subscription = AsyncMock(return_value=None)

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=not_found_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/subscriptions/nonexistent")

                assert response.status_code == 404
                assert "not found" in response.json()["detail"].lower()

        app.dependency_overrides.clear()

    async def test_get_subscription_service_error(self, app, mock_user):
        """Test get subscription when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.get_subscription = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/subscriptions/sub-123")

                assert response.status_code == 500
                assert "Failed to get webhook subscription" in response.json()["detail"]

        app.dependency_overrides.clear()


class TestUpdateSubscription:
    """Test PATCH /subscriptions/{subscription_id}."""

    async def test_update_subscription_events(self, setup_dependencies):
        """Test updating subscription events."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.patch(
                "/api/v1/webhooks/subscriptions/sub-123",
                json={"events": ["invoice.paid", "payment.succeeded"]},
            )

            assert response.status_code == 200
            data = response.json()
            assert "invoice.paid" in data["events"]

    async def test_update_subscription_url(self, setup_dependencies):
        """Test updating subscription URL."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.patch(
                "/api/v1/webhooks/subscriptions/sub-123",
                json={"url": "https://new.example.com/webhook"},
            )

            assert response.status_code == 200

    async def test_update_subscription_not_found(self, app, mock_user):
        """Test updating non-existent subscription."""
        from dotmac.platform.auth.dependencies import get_current_user

        not_found_service = MagicMock()
        not_found_service.update_subscription = AsyncMock(return_value=None)

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=not_found_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.patch(
                    "/api/v1/webhooks/subscriptions/nonexistent", json={"events": ["invoice.paid"]}
                )

                assert response.status_code == 404

        app.dependency_overrides.clear()

    async def test_update_subscription_service_error(self, app, mock_user):
        """Test update subscription when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.update_subscription = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.patch(
                    "/api/v1/webhooks/subscriptions/sub-123", json={"events": ["invoice.paid"]}
                )

                assert response.status_code == 500

        app.dependency_overrides.clear()


class TestDeleteSubscription:
    """Test DELETE /subscriptions/{subscription_id}."""

    async def test_delete_subscription_success(self, setup_dependencies):
        """Test deleting a subscription."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.delete("/api/v1/webhooks/subscriptions/sub-123")

            assert response.status_code == 204

    async def test_delete_subscription_not_found(self, app, mock_user):
        """Test deleting non-existent subscription."""
        from dotmac.platform.auth.dependencies import get_current_user

        not_found_service = MagicMock()
        not_found_service.delete_subscription = AsyncMock(return_value=False)

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=not_found_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.delete("/api/v1/webhooks/subscriptions/nonexistent")

                assert response.status_code == 404

        app.dependency_overrides.clear()

    async def test_delete_subscription_service_error(self, app, mock_user):
        """Test delete subscription when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.delete_subscription = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.delete("/api/v1/webhooks/subscriptions/sub-123")

                assert response.status_code == 500

        app.dependency_overrides.clear()


class TestRotateSecret:
    """Test POST /subscriptions/{subscription_id}/rotate-secret."""

    async def test_rotate_secret_success(self, setup_dependencies):
        """Test rotating webhook secret."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/webhooks/subscriptions/sub-123/rotate-secret")

            assert response.status_code == 200
            data = response.json()
            assert data["secret"] == "whsec_new123"
            assert "message" in data

    async def test_rotate_secret_not_found(self, app, mock_user):
        """Test rotating secret for non-existent subscription."""
        from dotmac.platform.auth.dependencies import get_current_user

        not_found_service = MagicMock()
        not_found_service.rotate_secret = AsyncMock(return_value=None)

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=not_found_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/v1/webhooks/subscriptions/nonexistent/rotate-secret"
                )

                assert response.status_code == 404

        app.dependency_overrides.clear()

    async def test_rotate_secret_service_error(self, app, mock_user):
        """Test rotate secret when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.rotate_secret = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post("/api/v1/webhooks/subscriptions/sub-123/rotate-secret")

                assert response.status_code == 500

        app.dependency_overrides.clear()


class TestGetSubscriptionDeliveries:
    """Test GET /subscriptions/{subscription_id}/deliveries."""

    async def test_get_subscription_deliveries(self, setup_dependencies):
        """Test getting deliveries for a subscription."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/webhooks/subscriptions/sub-123/deliveries")

            assert response.status_code == 200
            assert isinstance(response.json(), list)

    async def test_get_subscription_deliveries_service_error(self, app, mock_user):
        """Test get subscription deliveries when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.get_deliveries = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/subscriptions/sub-123/deliveries")

                assert response.status_code == 500

        app.dependency_overrides.clear()


# ============================================================================
# Delivery Endpoints
# ============================================================================


class TestListDeliveries:
    """Test GET /deliveries."""

    async def test_list_deliveries_all(self, setup_dependencies):
        """Test listing all deliveries."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/webhooks/deliveries")

            assert response.status_code == 200
            assert isinstance(response.json(), list)

    async def test_list_deliveries_with_status_filter(self, setup_dependencies):
        """Test listing deliveries filtered by status."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/webhooks/deliveries", params={"status": "failed"})

            assert response.status_code == 200

    async def test_list_deliveries_service_error(self, app, mock_user):
        """Test list deliveries when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.get_recent_deliveries = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/deliveries")

                assert response.status_code == 500

        app.dependency_overrides.clear()


class TestGetDelivery:
    """Test GET /deliveries/{delivery_id}."""

    async def test_get_delivery_success(self, setup_dependencies):
        """Test getting a specific delivery."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/webhooks/deliveries/del-123")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "del-123"

    async def test_get_delivery_not_found(self, app, mock_user):
        """Test getting non-existent delivery."""
        from dotmac.platform.auth.dependencies import get_current_user

        not_found_service = MagicMock()
        not_found_service.get_delivery = AsyncMock(return_value=None)

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=not_found_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/deliveries/nonexistent")

                assert response.status_code == 404

        app.dependency_overrides.clear()

    async def test_get_delivery_service_error(self, app, mock_user):
        """Test get delivery when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.get_delivery = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookSubscriptionService",
            return_value=failing_service,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/deliveries/del-123")

                assert response.status_code == 500

        app.dependency_overrides.clear()


class TestRetryDelivery:
    """Test POST /deliveries/{delivery_id}/retry."""

    async def test_retry_delivery_success(self, setup_dependencies):
        """Test retrying a failed delivery."""
        app = setup_dependencies

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/webhooks/deliveries/del-123/retry")

            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "success" in data["message"].lower()

    async def test_retry_delivery_failed(self, app, mock_user):
        """Test retry when delivery cannot be retried."""
        from dotmac.platform.auth.dependencies import get_current_user

        failed_service = MagicMock()
        failed_service.retry_delivery = AsyncMock(return_value=False)

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookDeliveryService", return_value=failed_service
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post("/api/v1/webhooks/deliveries/del-123/retry")

                assert response.status_code == 400
                assert "cannot be retried" in response.json()["detail"].lower()

        app.dependency_overrides.clear()

    async def test_retry_delivery_service_error(self, app, mock_user):
        """Test retry delivery when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        failing_service = MagicMock()
        failing_service.retry_delivery = AsyncMock(side_effect=Exception("Database error"))

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch(
            "dotmac.platform.webhooks.router.WebhookDeliveryService", return_value=failing_service
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post("/api/v1/webhooks/deliveries/del-123/retry")

                assert response.status_code == 500

        app.dependency_overrides.clear()


# ============================================================================
# Event Discovery Endpoints
# ============================================================================


class TestListEvents:
    """Test GET /events."""

    async def test_list_events(self, setup_dependencies):
        """Test listing available event types."""
        app = setup_dependencies

        with patch("dotmac.platform.webhooks.router.get_event_bus") as mock_bus:
            # Mock event schema object
            mock_schema = MagicMock()
            mock_schema.event_type = "invoice.created"
            mock_schema.description = "Invoice created"
            mock_schema.schema = None
            mock_schema.example = None

            # get_registered_events returns dict, not list
            mock_bus.return_value.get_registered_events.return_value = {
                "invoice.created": mock_schema
            }

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/events")

                assert response.status_code == 200
                data = response.json()
                assert len(data["events"]) == 1
                assert data["events"][0]["event_type"] == "invoice.created"

    async def test_list_events_service_error(self, app, mock_user):
        """Test list events when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch("dotmac.platform.webhooks.router.get_event_bus") as mock_bus:
            mock_bus.return_value.get_registered_events.side_effect = Exception("Event bus error")

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/events")

                assert response.status_code == 500

        app.dependency_overrides.clear()


class TestGetEventSchema:
    """Test GET /events/{event_type}."""

    async def test_get_event_schema_success(self, setup_dependencies):
        """Test getting schema for a specific event."""
        app = setup_dependencies

        with patch("dotmac.platform.webhooks.router.get_event_bus") as mock_bus:
            # Mock event schema
            mock_schema = MagicMock()
            mock_schema.event_type = "invoice.created"
            mock_schema.description = "Invoice created"
            mock_schema.json_schema = {
                "type": "object",
                "properties": {"invoice_id": {"type": "string"}},
            }
            mock_schema.example = None

            # get_registered_events returns dict
            mock_bus.return_value.get_registered_events.return_value = {
                "invoice.created": mock_schema
            }

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/events/invoice.created")

                assert response.status_code == 200
                data = response.json()
                assert data["event_type"] == "invoice.created"
                assert "schema" in data

    async def test_get_event_schema_not_found(self, setup_dependencies):
        """Test getting schema for non-existent event."""
        app = setup_dependencies

        with patch("dotmac.platform.webhooks.router.get_event_bus") as mock_bus:
            # Return empty dict so event_type not found
            mock_bus.return_value.get_registered_events.return_value = {}

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/events/nonexistent")

                assert response.status_code == 404

    async def test_get_event_schema_service_error(self, app, mock_user):
        """Test get event schema when service fails."""
        from dotmac.platform.auth.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = lambda: mock_user
        _override_webhook_permissions(app, mock_user)

        with patch("dotmac.platform.webhooks.router.get_event_bus") as mock_bus:
            mock_bus.return_value.get_registered_events.side_effect = Exception("Event bus error")

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/webhooks/events/invoice.created")

                assert response.status_code == 500

        app.dependency_overrides.clear()

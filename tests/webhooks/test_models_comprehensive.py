"""Comprehensive tests for webhook models."""

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from dotmac.platform.webhooks.models import (
    DeliveryStatus,
    WebhookDeliveryResponse,
    WebhookEvent,
    WebhookEventPayload,
    WebhookSubscriptionCreate,
    WebhookSubscriptionResponse,
    WebhookSubscriptionUpdate,
    generate_webhook_secret,
)


@pytest.mark.unit
class TestDeliveryStatus:
    """Test DeliveryStatus enum."""

    def test_delivery_status_values(self):
        """Test all delivery status values."""
        assert DeliveryStatus.PENDING == "pending"
        assert DeliveryStatus.SUCCESS == "success"
        assert DeliveryStatus.FAILED == "failed"
        assert DeliveryStatus.RETRYING == "retrying"
        assert DeliveryStatus.DISABLED == "disabled"

    def test_delivery_status_membership(self):
        """Test status membership."""
        assert "pending" in [s.value for s in DeliveryStatus]
        assert "success" in [s.value for s in DeliveryStatus]


@pytest.mark.unit
class TestWebhookEvent:
    """Test WebhookEvent enum."""

    def test_webhook_event_billing(self):
        """Test billing event values."""
        assert WebhookEvent.INVOICE_CREATED == "invoice.created"
        assert WebhookEvent.PAYMENT_SUCCEEDED == "payment.succeeded"
        assert WebhookEvent.SUBSCRIPTION_CREATED == "subscription.created"

    def test_webhook_event_customer(self):
        """Test customer event values."""
        assert WebhookEvent.CUSTOMER_CREATED == "customer.created"
        assert WebhookEvent.CUSTOMER_UPDATED == "customer.updated"

    def test_webhook_event_user(self):
        """Test user event values."""
        assert WebhookEvent.USER_REGISTERED == "user.registered"
        assert WebhookEvent.USER_LOGIN == "user.login"

    def test_all_events_accessible(self):
        """Test that all events are accessible."""
        events = [e.value for e in WebhookEvent]
        assert len(events) > 30  # Should have many events


@pytest.mark.unit
class TestWebhookSubscriptionCreate:
    """Test WebhookSubscriptionCreate schema."""

    def test_create_subscription_minimal(self):
        """Test creating subscription with minimal fields."""
        sub = WebhookSubscriptionCreate(
            url="https://example.com/webhook",
            events=["invoice.created"],
        )
        assert str(sub.url) == "https://example.com/webhook"
        assert sub.events == ["invoice.created"]
        assert sub.retry_enabled is True
        assert sub.max_retries == 3
        assert sub.timeout_seconds == 30

    def test_create_subscription_full(self):
        """Test creating subscription with all fields."""
        sub = WebhookSubscriptionCreate(
            url="https://example.com/webhook",
            description="Test webhook",
            events=["invoice.created", "payment.succeeded"],
            headers={"Authorization": "Bearer token"},
            retry_enabled=False,
            max_retries=5,
            timeout_seconds=60,
            custom_metadata={"key": "value"},
        )
        assert sub.description == "Test webhook"
        assert len(sub.events) == 2
        assert sub.headers == {"Authorization": "Bearer token"}
        assert sub.retry_enabled is False
        assert sub.max_retries == 5
        assert sub.timeout_seconds == 60
        assert sub.custom_metadata == {"key": "value"}

    def test_create_subscription_validates_events(self):
        """Test that event validation works."""
        with pytest.raises(ValidationError) as exc_info:
            WebhookSubscriptionCreate(
                url="https://example.com/webhook",
                events=["invalid.event"],
            )
        assert "Invalid event types" in str(exc_info.value)

    def test_create_subscription_requires_events(self):
        """Test that at least one event is required."""
        with pytest.raises(ValidationError) as exc_info:
            WebhookSubscriptionCreate(
                url="https://example.com/webhook",
                events=[],
            )
        assert "at least 1 item" in str(exc_info.value).lower()

    def test_create_subscription_validates_url(self):
        """Test that URL validation works."""
        with pytest.raises(ValidationError):
            WebhookSubscriptionCreate(
                url="not-a-url",
                events=["invoice.created"],
            )

    def test_create_subscription_validates_max_retries(self):
        """Test max_retries validation."""
        with pytest.raises(ValidationError):
            WebhookSubscriptionCreate(
                url="https://example.com/webhook",
                events=["invoice.created"],
                max_retries=11,  # Max is 10
            )

    def test_create_subscription_validates_timeout(self):
        """Test timeout validation."""
        with pytest.raises(ValidationError):
            WebhookSubscriptionCreate(
                url="https://example.com/webhook",
                events=["invoice.created"],
                timeout_seconds=301,  # Max is 300
            )

    def test_create_subscription_strips_whitespace(self):
        """Test that whitespace is stripped."""
        sub = WebhookSubscriptionCreate(
            url="  https://example.com/webhook  ",
            description="  Test  ",
            events=["invoice.created"],
        )
        # URL normalization handled by pydantic HttpUrl
        assert sub.description == "Test"

    def test_create_subscription_mixed_valid_invalid_events(self):
        """Test validation with mix of valid and invalid events."""
        with pytest.raises(ValidationError) as exc_info:
            WebhookSubscriptionCreate(
                url="https://example.com/webhook",
                events=["invoice.created", "invalid.event", "payment.succeeded"],
            )
        error_str = str(exc_info.value)
        assert "Invalid event types" in error_str
        assert "invalid.event" in error_str


@pytest.mark.unit
class TestWebhookSubscriptionUpdate:
    """Test WebhookSubscriptionUpdate schema."""

    def test_update_subscription_all_none(self):
        """Test update with all None fields."""
        update = WebhookSubscriptionUpdate()
        assert update.url is None
        assert update.description is None
        assert update.events is None
        assert update.is_active is None

    def test_update_subscription_partial(self):
        """Test partial update."""
        update = WebhookSubscriptionUpdate(
            description="Updated description",
            is_active=False,
        )
        assert update.description == "Updated description"
        assert update.is_active is False
        assert update.url is None

    def test_update_subscription_validates_events(self):
        """Test event validation in updates."""
        with pytest.raises(ValidationError) as exc_info:
            WebhookSubscriptionUpdate(
                events=["invoice.created", "invalid.event"],
            )
        assert "Invalid event types" in str(exc_info.value)

    def test_update_subscription_none_events_allowed(self):
        """Test that None events are allowed."""
        update = WebhookSubscriptionUpdate(events=None)
        assert update.events is None

    def test_update_subscription_validates_constraints(self):
        """Test that constraints are validated."""
        with pytest.raises(ValidationError):
            WebhookSubscriptionUpdate(max_retries=11)

        with pytest.raises(ValidationError):
            WebhookSubscriptionUpdate(timeout_seconds=1)  # Min is 5


@pytest.mark.unit
class TestWebhookSubscriptionResponse:
    """Test WebhookSubscriptionResponse schema."""

    def test_subscription_response_from_dict(self):
        """Test creating response from dict."""
        data = {
            "id": str(uuid.uuid4()),
            "url": "https://example.com/webhook",
            "description": "Test",
            "events": ["invoice.created"],
            "is_active": True,
            "retry_enabled": True,
            "max_retries": 3,
            "timeout_seconds": 30,
            "success_count": 10,
            "failure_count": 2,
            "last_triggered_at": datetime.now(UTC),
            "last_success_at": datetime.now(UTC),
            "last_failure_at": None,
            "created_at": datetime.now(UTC),
            "updated_at": None,
            "custom_metadata": {},
        }
        response = WebhookSubscriptionResponse(**data)
        assert response.id == data["id"]
        assert response.url == data["url"]
        assert response.success_count == 10

    def test_subscription_response_uuid_conversion(self):
        """Test UUID to string conversion."""
        test_uuid = uuid.uuid4()
        data = {
            "id": test_uuid,  # Pass as UUID
            "url": "https://example.com/webhook",
            "description": None,
            "events": [],
            "is_active": True,
            "retry_enabled": True,
            "max_retries": 3,
            "timeout_seconds": 30,
            "success_count": 0,
            "failure_count": 0,
            "last_triggered_at": None,
            "last_success_at": None,
            "last_failure_at": None,
            "created_at": datetime.now(UTC),
            "updated_at": None,
            "custom_metadata": {},
        }
        response = WebhookSubscriptionResponse(**data)
        assert response.id == str(test_uuid)
        assert isinstance(response.id, str)


@pytest.mark.unit
class TestWebhookDeliveryResponse:
    """Test WebhookDeliveryResponse schema."""

    def test_delivery_response_from_dict(self):
        """Test creating delivery response from dict."""
        data = {
            "id": str(uuid.uuid4()),
            "subscription_id": str(uuid.uuid4()),
            "event_type": "invoice.created",
            "event_id": "evt_123",
            "status": DeliveryStatus.SUCCESS,
            "response_code": 200,
            "error_message": None,
            "attempt_number": 1,
            "duration_ms": 150,
            "created_at": datetime.now(UTC),
            "next_retry_at": None,
        }
        response = WebhookDeliveryResponse(**data)
        assert response.event_type == "invoice.created"
        assert response.status == DeliveryStatus.SUCCESS
        assert response.response_code == 200

    def test_delivery_response_uuid_conversion(self):
        """Test UUID conversion for id and subscription_id."""
        test_id = uuid.uuid4()
        sub_id = uuid.uuid4()
        data = {
            "id": test_id,
            "subscription_id": sub_id,
            "event_type": "invoice.created",
            "event_id": "evt_123",
            "status": DeliveryStatus.PENDING,
            "response_code": None,
            "error_message": None,
            "attempt_number": 1,
            "duration_ms": None,
            "created_at": datetime.now(UTC),
            "next_retry_at": None,
        }
        response = WebhookDeliveryResponse(**data)
        assert response.id == str(test_id)
        assert response.subscription_id == str(sub_id)


@pytest.mark.unit
class TestWebhookEventPayload:
    """Test WebhookEventPayload schema."""

    def test_event_payload_minimal(self):
        """Test creating payload with minimal fields."""
        payload = WebhookEventPayload(
            id="evt_123",
            type="invoice.created",
            data={"invoice_id": "inv_123"},
        )
        assert payload.id == "evt_123"
        assert payload.type == "invoice.created"
        assert payload.data == {"invoice_id": "inv_123"}
        assert isinstance(payload.timestamp, datetime)
        assert payload.tenant_id is None
        assert payload.custom_metadata == {}

    def test_event_payload_full(self):
        """Test creating payload with all fields."""
        timestamp = datetime.now(UTC)
        payload = WebhookEventPayload(
            id="evt_123",
            type="invoice.created",
            timestamp=timestamp,
            data={"invoice_id": "inv_123"},
            tenant_id="tenant_123",
            custom_metadata={"key": "value"},
        )
        assert payload.timestamp == timestamp
        assert payload.tenant_id == "tenant_123"
        assert payload.custom_metadata == {"key": "value"}

    def test_event_payload_auto_timestamp(self):
        """Test that timestamp is auto-generated."""
        payload = WebhookEventPayload(
            id="evt_123",
            type="invoice.created",
            data={},
        )
        # Timestamp should be recent
        now = datetime.now(UTC)
        assert (now - payload.timestamp).total_seconds() < 1


@pytest.mark.unit
class TestGenerateWebhookSecret:
    """Test webhook secret generation."""

    def test_generate_secret_returns_string(self):
        """Test that secret is a string."""
        secret = generate_webhook_secret()
        assert isinstance(secret, str)

    def test_generate_secret_length(self):
        """Test secret length."""
        secret = generate_webhook_secret()
        # URL-safe base64 of 32 bytes is about 43 characters
        assert len(secret) >= 32

    def test_generate_secret_uniqueness(self):
        """Test that secrets are unique."""
        secret1 = generate_webhook_secret()
        secret2 = generate_webhook_secret()
        assert secret1 != secret2

    def test_generate_secret_url_safe(self):
        """Test that secret is URL-safe."""
        secret = generate_webhook_secret()
        # Should only contain URL-safe characters
        assert all(c.isalnum() or c in "-_" for c in secret)

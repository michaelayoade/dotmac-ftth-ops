"""Comprehensive tests for webhook delivery service."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from dotmac.platform.webhooks.delivery import WebhookDeliveryService
from dotmac.platform.webhooks.models import (
    DeliveryStatus,
    WebhookDelivery,
    WebhookSubscription,
)

pytestmark = pytest.mark.unit


@pytest.fixture
def mock_db():
    """Create mock database session."""

    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock()
    db.add = AsyncMock()
    return db


@pytest.fixture
def mock_subscription():
    """Create mock webhook subscription."""
    subscription = MagicMock(spec=WebhookSubscription)
    subscription.id = uuid.uuid4()
    subscription.tenant_id = "tenant_123"
    subscription.url = "https://example.com/webhook"
    subscription.secret = "test_secret_key"
    subscription.events = ["invoice.created"]
    subscription.headers = {}
    subscription.is_active = True
    subscription.retry_enabled = True
    subscription.max_retries = 3
    subscription.timeout_seconds = 30
    return subscription


@pytest.fixture
def delivery_service(mock_db):
    """Create delivery service instance."""
    return WebhookDeliveryService(mock_db)


@pytest.mark.unit
class TestGenerateSignature:
    """Test HMAC signature generation."""

    def test_generate_signature_deterministic(self, delivery_service):
        """Test that signature generation is deterministic."""
        payload = b'{"key": "value"}'
        secret = "test_secret"

        sig1 = delivery_service._generate_signature(payload, secret)
        sig2 = delivery_service._generate_signature(payload, secret)

        assert sig1 == sig2
        assert isinstance(sig1, str)
        assert len(sig1) == 64  # SHA256 hex digest length

    def test_generate_signature_different_payloads(self, delivery_service):
        """Test that different payloads produce different signatures."""
        secret = "test_secret"
        payload1 = b'{"key": "value1"}'
        payload2 = b'{"key": "value2"}'

        sig1 = delivery_service._generate_signature(payload1, secret)
        sig2 = delivery_service._generate_signature(payload2, secret)

        assert sig1 != sig2

    def test_generate_signature_different_secrets(self, delivery_service):
        """Test that different secrets produce different signatures."""
        payload = b'{"key": "value"}'
        secret1 = "secret1"
        secret2 = "secret2"

        sig1 = delivery_service._generate_signature(payload, secret1)
        sig2 = delivery_service._generate_signature(payload, secret2)

        assert sig1 != sig2


@pytest.mark.unit
class TestBuildHeaders:
    """Test HTTP header building."""

    def test_build_headers_default(self, delivery_service, mock_subscription):
        """Test building headers with default subscription."""
        event_id = "evt_123"
        event_type = "invoice.created"
        signature = "abc123signature"

        headers = delivery_service._build_headers(
            subscription=mock_subscription,
            signature=signature,
            event_id=event_id,
            event_type=event_type,
        )

        assert headers["Content-Type"] == "application/json"
        assert headers["User-Agent"] == "DotMac-Webhooks/1.0"
        assert headers["X-Webhook-Signature"] == signature
        assert headers["X-Webhook-Event-Id"] == event_id
        assert headers["X-Webhook-Event-Type"] == event_type
        assert "X-Webhook-Timestamp" in headers

    def test_build_headers_with_custom_headers(self, delivery_service, mock_subscription):
        """Test building headers with custom subscription headers."""
        mock_subscription.headers = {
            "Authorization": "Bearer token123",
            "X-Custom-Header": "value",
        }

        headers = delivery_service._build_headers(
            subscription=mock_subscription,
            signature="sig",
            event_id="evt_1",
            event_type="invoice.created",
        )

        # Should include custom headers
        assert headers["Authorization"] == "Bearer token123"
        assert headers["X-Custom-Header"] == "value"

        # Should still include standard headers
        assert headers["Content-Type"] == "application/json"
        assert headers["X-Webhook-Signature"] == "sig"


@pytest.mark.unit
@pytest.mark.asyncio
class TestDeliver:
    """Test webhook delivery."""

    @patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_deliver_success_200(
        self, mock_client_class, delivery_service, mock_subscription, mock_db
    ):
        """Test successful delivery with 200 OK."""
        # Mock HTTP response
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.text = "OK"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        # Mock subscription service
        with patch.object(
            delivery_service.subscription_service, "update_statistics", new=AsyncMock()
        ):
            delivery = await delivery_service.deliver(
                subscription=mock_subscription,
                event_type="invoice.created",
                event_data={"invoice_id": "inv_123"},
                tenant_id="tenant_123",
            )

        assert delivery.status == DeliveryStatus.SUCCESS
        assert delivery.response_code == 200
        assert delivery.event_type == "invoice.created"
        assert delivery.attempt_number == 1
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called()

    @patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_deliver_success_201(
        self, mock_client_class, delivery_service, mock_subscription, mock_db
    ):
        """Test successful delivery with 201 Created."""
        mock_response = AsyncMock()
        mock_response.status_code = 201
        mock_response.text = "Created"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        with patch.object(
            delivery_service.subscription_service, "update_statistics", new=AsyncMock()
        ):
            delivery = await delivery_service.deliver(
                subscription=mock_subscription,
                event_type="invoice.created",
                event_data={"invoice_id": "inv_123"},
            )

        assert delivery.status == DeliveryStatus.SUCCESS
        assert delivery.response_code == 201

    @patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_deliver_failure_500(
        self, mock_client_class, delivery_service, mock_subscription, mock_db
    ):
        """Test failed delivery with 500 Internal Server Error."""
        mock_response = AsyncMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        with patch.object(
            delivery_service.subscription_service, "update_statistics", new=AsyncMock()
        ):
            delivery = await delivery_service.deliver(
                subscription=mock_subscription,
                event_type="invoice.created",
                event_data={"invoice_id": "inv_123"},
            )

        # Should be marked as retrying (since retry is enabled)
        assert delivery.status == DeliveryStatus.RETRYING
        assert delivery.response_code == 500
        assert "HTTP 500" in delivery.error_message
        assert delivery.next_retry_at is not None

    @patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_deliver_410_gone_disables_subscription(
        self, mock_client_class, delivery_service, mock_subscription, mock_db
    ):
        """Test that 410 Gone disables subscription."""
        mock_response = AsyncMock()
        mock_response.status_code = 410
        mock_response.text = "Gone"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        with patch.object(
            delivery_service.subscription_service, "disable_subscription", new=AsyncMock()
        ) as mock_disable:
            delivery = await delivery_service.deliver(
                subscription=mock_subscription,
                event_type="invoice.created",
                event_data={"invoice_id": "inv_123"},
            )

        assert delivery.status == DeliveryStatus.DISABLED
        assert delivery.response_code == 410
        assert "410 Gone" in delivery.error_message
        mock_disable.assert_called_once()

    @patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_deliver_timeout(
        self, mock_client_class, delivery_service, mock_subscription, mock_db
    ):
        """Test delivery timeout handling."""
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_client_class.return_value = mock_client

        with patch.object(
            delivery_service.subscription_service, "update_statistics", new=AsyncMock()
        ):
            delivery = await delivery_service.deliver(
                subscription=mock_subscription,
                event_type="invoice.created",
                event_data={"invoice_id": "inv_123"},
            )

        assert delivery.status == DeliveryStatus.RETRYING
        assert "timeout" in delivery.error_message.lower()

    @patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_deliver_generic_exception(
        self, mock_client_class, delivery_service, mock_subscription, mock_db
    ):
        """Test generic exception handling during delivery."""
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(side_effect=Exception("Connection error"))
        mock_client_class.return_value = mock_client

        with patch.object(
            delivery_service.subscription_service, "update_statistics", new=AsyncMock()
        ):
            delivery = await delivery_service.deliver(
                subscription=mock_subscription,
                event_type="invoice.created",
                event_data={"invoice_id": "inv_123"},
            )

        assert delivery.status == DeliveryStatus.RETRYING
        assert "Connection error" in delivery.error_message

    @pytest.mark.asyncio
    async def test_deliver_generates_event_id(self, delivery_service, mock_subscription, mock_db):
        """Test that delivery generates event ID if not provided."""
        with patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient"):
            with patch.object(delivery_service, "_attempt_delivery", new=AsyncMock()):
                delivery = await delivery_service.deliver(
                    subscription=mock_subscription,
                    event_type="invoice.created",
                    event_data={"invoice_id": "inv_123"},
                )

        assert delivery.event_id is not None
        # Should be a valid UUID format
        assert len(delivery.event_id) == 36

    @pytest.mark.asyncio
    async def test_deliver_uses_provided_event_id(
        self, delivery_service, mock_subscription, mock_db
    ):
        """Test that delivery uses provided event ID."""
        custom_event_id = "evt_custom_123"

        with patch("dotmac.platform.webhooks.delivery.httpx.AsyncClient"):
            with patch.object(delivery_service, "_attempt_delivery", new=AsyncMock()):
                delivery = await delivery_service.deliver(
                    subscription=mock_subscription,
                    event_type="invoice.created",
                    event_data={"invoice_id": "inv_123"},
                    event_id=custom_event_id,
                )

        assert delivery.event_id == custom_event_id


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleFailure:
    """Test failure handling and retry logic."""

    @pytest.mark.asyncio
    async def test_handle_failure_schedules_retry(
        self, delivery_service, mock_subscription, mock_db
    ):
        """Test that failure schedules retry when enabled."""
        delivery = MagicMock(spec=WebhookDelivery)
        delivery.attempt_number = 1
        delivery.status = DeliveryStatus.FAILED

        mock_subscription.retry_enabled = True
        mock_subscription.max_retries = 3

        with patch.object(
            delivery_service.subscription_service, "update_statistics", new=AsyncMock()
        ):
            await delivery_service._handle_failure(delivery, mock_subscription)

        assert delivery.status == DeliveryStatus.RETRYING
        assert delivery.next_retry_at is not None

    @pytest.mark.asyncio
    async def test_handle_failure_no_more_retries(
        self, delivery_service, mock_subscription, mock_db
    ):
        """Test that failure without retries marks as failed."""
        delivery = MagicMock(spec=WebhookDelivery)
        delivery.attempt_number = 3
        delivery.status = DeliveryStatus.FAILED

        mock_subscription.retry_enabled = True
        mock_subscription.max_retries = 3

        with patch.object(
            delivery_service.subscription_service, "update_statistics", new=AsyncMock()
        ):
            await delivery_service._handle_failure(delivery, mock_subscription)

        assert delivery.status == DeliveryStatus.FAILED
        # Should not set next_retry_at when no retries left

    @pytest.mark.asyncio
    async def test_handle_failure_retry_disabled(
        self, delivery_service, mock_subscription, mock_db
    ):
        """Test failure handling when retry is disabled."""
        delivery = MagicMock(spec=WebhookDelivery)
        delivery.attempt_number = 1
        delivery.status = DeliveryStatus.FAILED

        mock_subscription.retry_enabled = False

        with patch.object(
            delivery_service.subscription_service, "update_statistics", new=AsyncMock()
        ):
            await delivery_service._handle_failure(delivery, mock_subscription)

        assert delivery.status == DeliveryStatus.FAILED


@pytest.mark.unit
@pytest.mark.asyncio
class TestRetryDelivery:
    """Test manual retry delivery."""

    @pytest.mark.asyncio
    async def test_retry_delivery_not_found(self, delivery_service, mock_db):
        """Test retrying non-existent delivery."""
        delivery_id = str(uuid.uuid4())
        tenant_id = "tenant_123"

        with patch.object(
            delivery_service.subscription_service, "get_delivery", new=AsyncMock(return_value=None)
        ):
            result = await delivery_service.retry_delivery(delivery_id, tenant_id)

        assert result is False

    @pytest.mark.asyncio
    async def test_retry_delivery_already_succeeded(self, delivery_service, mock_db):
        """Test retrying delivery that already succeeded."""
        delivery_id = str(uuid.uuid4())
        tenant_id = "tenant_123"

        mock_delivery = MagicMock(spec=WebhookDelivery)
        mock_delivery.status = DeliveryStatus.SUCCESS

        with patch.object(
            delivery_service.subscription_service,
            "get_delivery",
            new=AsyncMock(return_value=mock_delivery),
        ):
            result = await delivery_service.retry_delivery(delivery_id, tenant_id)

        assert result is False

    @pytest.mark.asyncio
    async def test_retry_delivery_subscription_inactive(
        self, delivery_service, mock_db, mock_subscription
    ):
        """Test retrying when subscription is inactive."""
        delivery_id = str(uuid.uuid4())
        tenant_id = "tenant_123"

        mock_delivery = MagicMock(spec=WebhookDelivery)
        mock_delivery.status = DeliveryStatus.FAILED
        mock_delivery.subscription_id = mock_subscription.id
        mock_delivery.event_type = "invoice.created"
        mock_delivery.event_id = "evt_123"
        mock_delivery.event_data = {}

        mock_subscription.is_active = False

        with patch.object(
            delivery_service.subscription_service,
            "get_delivery",
            new=AsyncMock(return_value=mock_delivery),
        ):
            with patch.object(
                delivery_service.subscription_service,
                "get_subscription",
                new=AsyncMock(return_value=mock_subscription),
            ):
                result = await delivery_service.retry_delivery(delivery_id, tenant_id)

        assert result is False


@pytest.mark.unit
@pytest.mark.asyncio
class TestProcessPendingRetries:
    """Test processing pending retries."""

    @pytest.mark.asyncio
    async def test_process_pending_retries_no_deliveries(self, delivery_service, mock_db):
        """Test processing when no pending retries."""
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        count = await delivery_service.process_pending_retries(limit=100)

        assert count == 0

    @pytest.mark.asyncio
    async def test_process_pending_retries_subscription_inactive(self, delivery_service, mock_db):
        """Test processing retry when subscription is inactive."""
        # Mock delivery ready for retry
        mock_delivery = MagicMock(spec=WebhookDelivery)
        mock_delivery.id = uuid.uuid4()
        mock_delivery.subscription_id = uuid.uuid4()
        mock_delivery.status = DeliveryStatus.RETRYING
        mock_delivery.next_retry_at = datetime.now(UTC) - timedelta(minutes=5)
        mock_delivery.event_type = "invoice.created"
        mock_delivery.event_id = "evt_123"
        mock_delivery.event_data = {}
        mock_delivery.tenant_id = "tenant_123"
        mock_delivery.attempt_number = 1

        # Mock execute results for deliveries
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_delivery]

        deliveries_result = MagicMock()
        deliveries_result.scalars.return_value = mock_scalars

        # Mock subscription not found
        subscription_result = MagicMock()
        subscription_result.scalar_one_or_none.return_value = None

        mock_db.execute.side_effect = [deliveries_result, subscription_result]

        count = await delivery_service.process_pending_retries(limit=100)

        # Should mark as failed and not retry
        assert mock_delivery.status == DeliveryStatus.FAILED
        assert count == 0

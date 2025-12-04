"""Tests for customer event publisher."""

import json
from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from dotmac.platform.events.customer_publisher import CustomerEventPublisher

pytestmark = pytest.mark.unit


class TestCustomerEventPublisher:
    """Test CustomerEventPublisher class."""

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        redis = AsyncMock()
        redis.publish = AsyncMock(return_value=1)
        return redis

    @pytest.fixture
    def publisher(self, mock_redis):
        """Create publisher instance."""
        return CustomerEventPublisher(mock_redis)

    def test_initialization(self, mock_redis):
        """Test publisher initialization."""
        publisher = CustomerEventPublisher(mock_redis)
        assert publisher.redis == mock_redis

    def test_serialize_datetime(self, publisher):
        """Test datetime serialization."""
        dt = datetime(2025, 1, 1, 12, 0, 0)
        result = publisher._serialize_value(dt)
        assert isinstance(result, str)
        assert "2025-01-01" in result

    def test_serialize_decimal(self, publisher):
        """Test Decimal serialization."""
        dec = Decimal("123.45")
        result = publisher._serialize_value(dec)
        assert result == 123.45
        assert isinstance(result, float)

    def test_serialize_uuid(self, publisher):
        """Test UUID serialization."""
        uid = uuid4()
        result = publisher._serialize_value(uid)
        assert result == str(uid)
        assert isinstance(result, str)

    def test_serialize_dict_filters_none(self, publisher):
        """Test dictionary serialization filters None values."""
        data = {"key1": "value1", "key2": None, "key3": "value3"}
        result = publisher._serialize_dict(data)
        assert "key1" in result
        assert "key2" not in result
        assert "key3" in result

    def test_serialize_dict_with_datetime(self, publisher):
        """Test dictionary with datetime values."""
        dt = datetime(2025, 1, 1)
        data = {"timestamp": dt, "name": "test"}
        result = publisher._serialize_dict(data)
        assert isinstance(result["timestamp"], str)
        assert result["name"] == "test"

    @pytest.mark.asyncio
    async def test_publish_network_status_update(self, publisher, mock_redis):
        """Test publishing network status update."""
        await publisher.publish_network_status_update(
            customer_id="cust-123",
            connection_status="online",
            network_data={"ipv4_address": "10.0.0.1", "signal_strength": 85},
        )

        # Verify Redis publish was called
        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        # Verify channel name
        assert channel == "customer:cust-123:network_status"

        # Verify payload
        payload = json.loads(payload_json)
        assert payload["customer_id"] == "cust-123"
        assert payload["connection_status"] == "online"
        assert payload["ipv4_address"] == "10.0.0.1"
        assert payload["signal_strength"] == 85
        assert "last_seen_at" in payload
        assert "updated_at" in payload

    @pytest.mark.asyncio
    async def test_publish_network_status_handles_error(self, publisher, mock_redis):
        """Test network status publish handles Redis errors."""
        mock_redis.publish.side_effect = Exception("Redis error")

        # Should not raise, just log error
        await publisher.publish_network_status_update(
            customer_id="cust-123",
            connection_status="offline",
            network_data={},
        )

        mock_redis.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_publish_device_update(self, publisher, mock_redis):
        """Test publishing device update."""
        await publisher.publish_device_update(
            customer_id="cust-123",
            device_id="dev-456",
            device_type="ONT",
            device_name="ONT-Main",
            status="active",
            health_status="healthy",
            is_online=True,
            change_type="status",
            previous_value="inactive",
            new_value="active",
            metrics={"temperature": 65},
        )

        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        assert channel == "customer:cust-123:devices"

        payload = json.loads(payload_json)
        assert payload["device_id"] == "dev-456"
        assert payload["device_type"] == "ONT"
        assert payload["is_online"] is True
        assert payload["change_type"] == "status"
        assert payload["temperature"] == 65
        assert payload["last_seen_at"] is not None

    @pytest.mark.asyncio
    async def test_publish_device_update_offline(self, publisher, mock_redis):
        """Test publishing device update for offline device."""
        await publisher.publish_device_update(
            customer_id="cust-123",
            device_id="dev-456",
            device_type="Router",
            device_name="Router-1",
            status="inactive",
            health_status="critical",
            is_online=False,
            change_type="status",
        )

        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        payload = json.loads(payload_json)
        assert payload["is_online"] is False
        assert payload["last_seen_at"] is None

    @pytest.mark.asyncio
    async def test_publish_device_update_handles_error(self, publisher, mock_redis):
        """Test device update handles Redis errors."""
        mock_redis.publish.side_effect = Exception("Connection failed")

        await publisher.publish_device_update(
            customer_id="cust-123",
            device_id="dev-456",
            device_type="ONT",
            device_name="ONT-1",
            status="active",
            health_status="healthy",
            is_online=True,
            change_type="status",
        )

        mock_redis.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_publish_ticket_update(self, publisher, mock_redis):
        """Test publishing ticket update."""
        ticket_data = {
            "id": "ticket-789",
            "ticket_number": "TKT-001",
            "title": "Network issue",
            "status": "open",
        }

        await publisher.publish_ticket_update(
            customer_id="cust-123",
            action="created",
            ticket_data=ticket_data,
            changed_by="user-001",
            changed_by_name="Support Agent",
            changes=["status: new -> open"],
            comment="Ticket created",
        )

        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        assert channel == "customer:cust-123:tickets"

        payload = json.loads(payload_json)
        assert payload["action"] == "created"
        assert payload["changed_by"] == "user-001"
        assert payload["changed_by_name"] == "Support Agent"
        assert payload["changes"] == ["status: new -> open"]
        assert payload["comment"] == "Ticket created"
        assert payload["ticket"]["id"] == "ticket-789"

    @pytest.mark.asyncio
    async def test_publish_ticket_update_handles_error(self, publisher, mock_redis):
        """Test ticket update handles errors."""
        mock_redis.publish.side_effect = Exception("Publish failed")

        await publisher.publish_ticket_update(
            customer_id="cust-123",
            action="updated",
            ticket_data={"id": "ticket-1"},
        )

        mock_redis.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_publish_activity(self, publisher, mock_redis):
        """Test publishing customer activity."""
        activity_data = {
            "id": "activity-001",
            "type": "login",
            "title": "Customer logged in",
            "description": "Login from mobile app",
            "timestamp": datetime.utcnow(),
        }

        await publisher.publish_activity(
            customer_id="cust-123",
            activity_data=activity_data,
        )

        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        assert channel == "customer:cust-123:activities"

        payload = json.loads(payload_json)
        assert payload["customer_id"] == "cust-123"
        assert payload["id"] == "activity-001"
        assert payload["type"] == "login"

    @pytest.mark.asyncio
    async def test_publish_activity_handles_error(self, publisher, mock_redis):
        """Test activity publish handles errors."""
        mock_redis.publish.side_effect = Exception("Failed")

        await publisher.publish_activity(
            customer_id="cust-123",
            activity_data={"id": "act-1", "type": "test"},
        )

        mock_redis.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_publish_note_update_created(self, publisher, mock_redis):
        """Test publishing note creation."""
        note_data = {"id": "note-001", "content": "Customer called about issue"}

        await publisher.publish_note_update(
            customer_id="cust-123",
            action="created",
            note_data=note_data,
            changed_by="user-001",
            changed_by_name="Agent Smith",
        )

        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        assert channel == "customer:cust-123:notes"

        payload = json.loads(payload_json)
        assert payload["action"] == "created"
        assert payload["note"]["id"] == "note-001"
        assert payload["changed_by"] == "user-001"

    @pytest.mark.asyncio
    async def test_publish_note_update_deleted(self, publisher, mock_redis):
        """Test publishing note deletion."""
        await publisher.publish_note_update(
            customer_id="cust-123",
            action="deleted",
            note_data=None,
            changed_by="user-001",
        )

        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        payload = json.loads(payload_json)
        assert payload["action"] == "deleted"
        assert payload["note"] is None

    @pytest.mark.asyncio
    async def test_publish_note_update_handles_error(self, publisher, mock_redis):
        """Test note update handles errors."""
        mock_redis.publish.side_effect = Exception("Error")

        await publisher.publish_note_update(
            customer_id="cust-123",
            action="updated",
            note_data={"id": "note-1"},
            changed_by="user-1",
        )

        mock_redis.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_publish_subscription_update(self, publisher, mock_redis):
        """Test publishing subscription update."""
        subscription_data = {
            "id": "sub-001",
            "plan_name": "Premium 100Mbps",
            "price": Decimal("49.99"),
            "start_date": datetime(2025, 1, 1),
        }

        await publisher.publish_subscription_update(
            customer_id="cust-123",
            action="upgraded",
            subscription_data=subscription_data,
        )

        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        assert channel == "customer:cust-123:subscription"

        payload = json.loads(payload_json)
        assert payload["action"] == "upgraded"
        assert payload["id"] == "sub-001"
        assert payload["price"] == 49.99  # Decimal converted to float
        assert isinstance(payload["start_date"], str)  # datetime converted to ISO

    @pytest.mark.asyncio
    async def test_publish_subscription_update_handles_error(self, publisher, mock_redis):
        """Test subscription update handles errors."""
        mock_redis.publish.side_effect = Exception("Failed")

        await publisher.publish_subscription_update(
            customer_id="cust-123",
            action="canceled",
            subscription_data={"id": "sub-1"},
        )

        mock_redis.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_publish_billing_update(self, publisher, mock_redis):
        """Test publishing billing update."""
        billing_data = {
            "invoice_id": "inv-001",
            "amount": Decimal("99.99"),
            "due_date": datetime(2025, 2, 1),
            "status": "unpaid",
        }

        await publisher.publish_billing_update(
            customer_id="cust-123",
            action="invoice_created",
            billing_data=billing_data,
        )

        mock_redis.publish.assert_called_once()
        channel, payload_json = mock_redis.publish.call_args[0]

        assert channel == "customer:cust-123:billing"

        payload = json.loads(payload_json)
        assert payload["action"] == "invoice_created"
        assert payload["invoice_id"] == "inv-001"
        assert payload["amount"] == 99.99
        assert isinstance(payload["due_date"], str)

    @pytest.mark.asyncio
    async def test_publish_billing_update_handles_error(self, publisher, mock_redis):
        """Test billing update handles errors."""
        mock_redis.publish.side_effect = Exception("Publish error")

        await publisher.publish_billing_update(
            customer_id="cust-123",
            action="payment_failed",
            billing_data={"invoice_id": "inv-1"},
        )

        mock_redis.publish.assert_called_once()

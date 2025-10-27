"""
Tests for RADIUS Service with IPv6 Support

Test dual-stack IP assignment in RADIUS subscriber management.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.radius.schemas import (
    RADIUSSubscriberCreate,
    RADIUSSubscriberUpdate,
)
from dotmac.platform.radius.service import RADIUSService


@pytest.fixture
def mock_session():
    """Mock database session"""
    session = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture
def radius_service(mock_session):
    """Create RADIUS service with mocked dependencies"""
    with patch("dotmac.platform.settings.settings") as mock_settings:
        mock_settings.radius.shared_secret = "test_secret"
        mock_settings.is_production = False
        service = RADIUSService(session=mock_session, tenant_id="test_tenant")
        service.repository = AsyncMock()
        return service


class TestRADIUSServiceCreateSubscriberIPv6:
    """Test creating RADIUS subscribers with IPv6 support."""

    @pytest.mark.asyncio
    async def test_create_subscriber_ipv4_only(self, radius_service):
        """Test creating subscriber with IPv4 address only."""
        # Mock repository responses
        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=None)

        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.create_radcheck = AsyncMock(return_value=mock_radcheck)
        radius_service.repository.create_radreply = AsyncMock()

        # Create subscriber
        data = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv4_address="192.168.1.100",
        )

        result = await radius_service.create_subscriber(data)

        # Verify radcheck created
        radius_service.repository.create_radcheck.assert_called_once()

        # Verify IPv4 radreply created
        ipv4_call = None
        for call in radius_service.repository.create_radreply.call_args_list:
            if call.kwargs.get("attribute") == "Framed-IP-Address":
                ipv4_call = call
                break

        assert ipv4_call is not None
        assert ipv4_call.kwargs["value"] == "192.168.1.100"

        # Verify response
        assert result.framed_ipv4_address == "192.168.1.100"
        assert result.framed_ipv6_address is None

    @pytest.mark.asyncio
    async def test_create_subscriber_ipv6_only(self, radius_service):
        """Test creating subscriber with IPv6 address only."""
        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=None)

        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.create_radcheck = AsyncMock(return_value=mock_radcheck)
        radius_service.repository.create_radreply = AsyncMock()

        # Create subscriber
        data = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv6_address="2001:db8::100",
        )

        result = await radius_service.create_subscriber(data)

        # Verify IPv6 radreply created
        ipv6_call = None
        for call in radius_service.repository.create_radreply.call_args_list:
            if call.kwargs.get("attribute") == "Framed-IPv6-Address":
                ipv6_call = call
                break

        assert ipv6_call is not None
        assert ipv6_call.kwargs["value"] == "2001:db8::100"

        # Verify response
        assert result.framed_ipv4_address is None
        assert result.framed_ipv6_address == "2001:db8::100"

    @pytest.mark.asyncio
    async def test_create_subscriber_dual_stack(self, radius_service):
        """Test creating subscriber with both IPv4 and IPv6."""
        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=None)

        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.create_radcheck = AsyncMock(return_value=mock_radcheck)
        radius_service.repository.create_radreply = AsyncMock()

        # Create subscriber
        data = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv4_address="10.1.1.50",
            framed_ipv6_address="2001:db8::50",
            delegated_ipv6_prefix="2001:db8:1::/64",
        )

        result = await radius_service.create_subscriber(data)

        # Verify all three IP-related radreply entries created
        call_args_list = radius_service.repository.create_radreply.call_args_list
        attributes_created = {
            call.kwargs["attribute"]: call.kwargs["value"] for call in call_args_list
        }

        assert "Framed-IP-Address" in attributes_created
        assert attributes_created["Framed-IP-Address"] == "10.1.1.50"

        assert "Framed-IPv6-Address" in attributes_created
        assert attributes_created["Framed-IPv6-Address"] == "2001:db8::50"

        assert "Delegated-IPv6-Prefix" in attributes_created
        assert attributes_created["Delegated-IPv6-Prefix"] == "2001:db8:1::/64"

        # Verify response
        assert result.framed_ipv4_address == "10.1.1.50"
        assert result.framed_ipv6_address == "2001:db8::50"
        assert result.delegated_ipv6_prefix == "2001:db8:1::/64"

    @pytest.mark.asyncio
    async def test_create_subscriber_ipv6_prefix_delegation_only(self, radius_service):
        """Test creating subscriber with IPv6 prefix delegation only."""
        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=None)

        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.create_radcheck = AsyncMock(return_value=mock_radcheck)
        radius_service.repository.create_radreply = AsyncMock()

        # Create subscriber
        data = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            delegated_ipv6_prefix="2001:db8:abcd::/48",
        )

        result = await radius_service.create_subscriber(data)

        # Verify IPv6 prefix delegation radreply created
        pd_call = None
        for call in radius_service.repository.create_radreply.call_args_list:
            if call.kwargs.get("attribute") == "Delegated-IPv6-Prefix":
                pd_call = call
                break

        assert pd_call is not None
        assert pd_call.kwargs["value"] == "2001:db8:abcd::/48"

        assert result.delegated_ipv6_prefix == "2001:db8:abcd::/48"


class TestRADIUSServiceGetSubscriberIPv6:
    """Test retrieving RADIUS subscribers with IPv6 support."""

    @pytest.mark.asyncio
    async def test_get_subscriber_dual_stack(self, radius_service):
        """Test getting subscriber with dual-stack IPs."""
        # Mock radcheck
        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=mock_radcheck)

        # Mock radreply entries
        mock_replies = [
            MagicMock(attribute="Framed-IP-Address", value="192.168.1.100"),
            MagicMock(attribute="Framed-IPv6-Address", value="2001:db8::100"),
            MagicMock(attribute="Delegated-IPv6-Prefix", value="2001:db8:1::/64"),
            MagicMock(attribute="Session-Timeout", value="3600"),
        ]

        radius_service.repository.get_radreplies_by_username = AsyncMock(return_value=mock_replies)

        # Get subscriber
        result = await radius_service.get_subscriber("testuser")

        # Verify all IP addresses retrieved
        assert result.framed_ipv4_address == "192.168.1.100"
        assert result.framed_ipv6_address == "2001:db8::100"
        assert result.delegated_ipv6_prefix == "2001:db8:1::/64"
        assert result.session_timeout == 3600


class TestRADIUSServiceUpdateSubscriberIPv6:
    """Test updating RADIUS subscribers with IPv6 support."""

    @pytest.mark.asyncio
    async def test_update_subscriber_ipv4_address(self, radius_service):
        """Test updating IPv4 address."""
        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=mock_radcheck)
        radius_service.repository.get_radreplies_by_username = AsyncMock(return_value=[])
        radius_service.repository.delete_radreply = AsyncMock()
        radius_service.repository.create_radreply = AsyncMock()

        # Update subscriber
        data = RADIUSSubscriberUpdate(framed_ipv4_address="10.2.2.200")
        await radius_service.update_subscriber("testuser", data)

        # Verify old IPv4 deleted
        radius_service.repository.delete_radreply.assert_any_call(
            "test_tenant", "testuser", "Framed-IP-Address"
        )

        # Verify new IPv4 created
        ipv4_call = None
        for call in radius_service.repository.create_radreply.call_args_list:
            if call.kwargs.get("attribute") == "Framed-IP-Address":
                ipv4_call = call
                break

        assert ipv4_call is not None
        assert ipv4_call.kwargs["value"] == "10.2.2.200"

    @pytest.mark.asyncio
    async def test_update_subscriber_ipv6_address(self, radius_service):
        """Test updating IPv6 address."""
        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=mock_radcheck)
        radius_service.repository.get_radreplies_by_username = AsyncMock(return_value=[])
        radius_service.repository.delete_radreply = AsyncMock()
        radius_service.repository.create_radreply = AsyncMock()

        # Update subscriber
        data = RADIUSSubscriberUpdate(framed_ipv6_address="2001:db8::200")
        await radius_service.update_subscriber("testuser", data)

        # Verify old IPv6 deleted
        radius_service.repository.delete_radreply.assert_any_call(
            "test_tenant", "testuser", "Framed-IPv6-Address"
        )

        # Verify new IPv6 created
        ipv6_call = None
        for call in radius_service.repository.create_radreply.call_args_list:
            if call.kwargs.get("attribute") == "Framed-IPv6-Address":
                ipv6_call = call
                break

        assert ipv6_call is not None
        assert ipv6_call.kwargs["value"] == "2001:db8::200"

    @pytest.mark.asyncio
    async def test_update_subscriber_delegated_prefix(self, radius_service):
        """Test updating IPv6 delegated prefix."""
        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=mock_radcheck)
        radius_service.repository.get_radreplies_by_username = AsyncMock(return_value=[])
        radius_service.repository.delete_radreply = AsyncMock()
        radius_service.repository.create_radreply = AsyncMock()

        # Update subscriber
        data = RADIUSSubscriberUpdate(delegated_ipv6_prefix="2001:db8:cafe::/64")
        await radius_service.update_subscriber("testuser", data)

        # Verify old prefix deleted
        radius_service.repository.delete_radreply.assert_any_call(
            "test_tenant", "testuser", "Delegated-IPv6-Prefix"
        )

        # Verify new prefix created
        pd_call = None
        for call in radius_service.repository.create_radreply.call_args_list:
            if call.kwargs.get("attribute") == "Delegated-IPv6-Prefix":
                pd_call = call
                break

        assert pd_call is not None
        assert pd_call.kwargs["value"] == "2001:db8:cafe::/64"

    @pytest.mark.asyncio
    async def test_update_subscriber_dual_stack(self, radius_service):
        """Test updating both IPv4 and IPv6 addresses."""
        mock_radcheck = MagicMock()
        mock_radcheck.id = 1
        mock_radcheck.tenant_id = "test_tenant"
        mock_radcheck.subscriber_id = "sub123"
        mock_radcheck.username = "testuser"
        mock_radcheck.created_at = datetime.utcnow()
        mock_radcheck.updated_at = datetime.utcnow()

        radius_service.repository.get_radcheck_by_username = AsyncMock(return_value=mock_radcheck)
        radius_service.repository.get_radreplies_by_username = AsyncMock(return_value=[])
        radius_service.repository.delete_radreply = AsyncMock()
        radius_service.repository.create_radreply = AsyncMock()

        # Update subscriber
        data = RADIUSSubscriberUpdate(
            framed_ipv4_address="172.16.1.1",
            framed_ipv6_address="fe80::1",
            delegated_ipv6_prefix="2001:db8::/56",
        )
        await radius_service.update_subscriber("testuser", data)

        # Verify all deletions
        radius_service.repository.delete_radreply.assert_any_call(
            "test_tenant", "testuser", "Framed-IP-Address"
        )
        radius_service.repository.delete_radreply.assert_any_call(
            "test_tenant", "testuser", "Framed-IPv6-Address"
        )
        radius_service.repository.delete_radreply.assert_any_call(
            "test_tenant", "testuser", "Delegated-IPv6-Prefix"
        )

        # Verify all new values created
        call_args_list = radius_service.repository.create_radreply.call_args_list
        attributes_created = {
            call.kwargs["attribute"]: call.kwargs["value"] for call in call_args_list
        }

        assert attributes_created["Framed-IP-Address"] == "172.16.1.1"
        assert attributes_created["Framed-IPv6-Address"] == "fe80::1"
        assert attributes_created["Delegated-IPv6-Prefix"] == "2001:db8::/56"

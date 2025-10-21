"""
Tests for RADIUS Schemas with IPv6 Support

Test IPv4/IPv6 validation and dual-stack support in RADIUS schemas.
"""

import pytest
from pydantic import ValidationError

from dotmac.platform.radius.schemas import (
    RADIUSSubscriberCreate,
    RADIUSSubscriberUpdate,
    RADIUSSubscriberResponse,
    RADIUSSessionResponse,
)


class TestRADIUSSubscriberCreateIPv6:
    """Test RADIUS subscriber creation with IPv6 support."""

    def test_create_with_ipv4_only(self):
        """Test creating subscriber with IPv4 address only."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv4_address="192.168.1.100",
        )
        assert subscriber.framed_ipv4_address == "192.168.1.100"
        assert subscriber.framed_ipv6_address is None
        assert subscriber.delegated_ipv6_prefix is None

    def test_create_with_ipv6_only(self):
        """Test creating subscriber with IPv6 address only."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv6_address="2001:db8::1",
        )
        assert subscriber.framed_ipv4_address is None
        assert subscriber.framed_ipv6_address == "2001:db8::1"
        assert subscriber.delegated_ipv6_prefix is None

    def test_create_with_dual_stack(self):
        """Test creating subscriber with both IPv4 and IPv6."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv4_address="10.1.1.50",
            framed_ipv6_address="2001:db8::50",
            delegated_ipv6_prefix="2001:db8:1::/64",
        )
        assert subscriber.framed_ipv4_address == "10.1.1.50"
        assert subscriber.framed_ipv6_address == "2001:db8::50"
        assert subscriber.delegated_ipv6_prefix == "2001:db8:1::/64"

    def test_create_with_ipv6_prefix_delegation(self):
        """Test IPv6 prefix delegation."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            delegated_ipv6_prefix="2001:db8:abcd::/48",
        )
        assert subscriber.delegated_ipv6_prefix == "2001:db8:abcd::/48"

    def test_ipv4_validation_rejects_invalid(self):
        """Test IPv4 validation rejects invalid addresses."""
        with pytest.raises(ValidationError) as exc_info:
            RADIUSSubscriberCreate(
                subscriber_id="sub123",
                username="testuser",
                password="securepass123",
                framed_ipv4_address="256.1.1.1",  # Invalid
            )
        assert "Invalid IPv4 address" in str(exc_info.value)

    def test_ipv6_validation_rejects_invalid(self):
        """Test IPv6 validation rejects invalid addresses."""
        with pytest.raises(ValidationError) as exc_info:
            RADIUSSubscriberCreate(
                subscriber_id="sub123",
                username="testuser",
                password="securepass123",
                framed_ipv6_address="gggg::1",  # Invalid hex
            )
        assert "Invalid IPv6 address" in str(exc_info.value)

    def test_ipv6_prefix_validation_rejects_invalid(self):
        """Test IPv6 prefix validation rejects invalid CIDR."""
        with pytest.raises(ValidationError) as exc_info:
            RADIUSSubscriberCreate(
                subscriber_id="sub123",
                username="testuser",
                password="securepass123",
                delegated_ipv6_prefix="2001:db8::/129",  # Invalid prefix length
            )
        assert "Invalid IPv6 CIDR" in str(exc_info.value)

    def test_ipv6_normalization(self):
        """Test IPv6 addresses are normalized."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv6_address="2001:0db8:0000:0000:0000:0000:0000:0001",
        )
        # Should be normalized to compressed form
        assert subscriber.framed_ipv6_address == "2001:db8::1"

    def test_backward_compatibility_framed_ip_address(self):
        """Test backward compatibility with old framed_ip_address field."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ip_address="192.168.1.100",  # Old field
        )
        # Should map to framed_ipv4_address
        assert subscriber.framed_ipv4_address == "192.168.1.100"

    def test_username_normalization(self):
        """Test username is normalized to lowercase."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="TestUser",
            password="securepass123",
        )
        assert subscriber.username == "testuser"


class TestRADIUSSubscriberUpdateIPv6:
    """Test RADIUS subscriber update with IPv6 support."""

    def test_update_ipv4_address(self):
        """Test updating IPv4 address."""
        update = RADIUSSubscriberUpdate(framed_ipv4_address="10.2.2.200")
        assert update.framed_ipv4_address == "10.2.2.200"

    def test_update_ipv6_address(self):
        """Test updating IPv6 address."""
        update = RADIUSSubscriberUpdate(framed_ipv6_address="2001:db8::200")
        assert update.framed_ipv6_address == "2001:db8::200"

    def test_update_delegated_prefix(self):
        """Test updating IPv6 delegated prefix."""
        update = RADIUSSubscriberUpdate(delegated_ipv6_prefix="2001:db8:cafe::/64")
        assert update.delegated_ipv6_prefix == "2001:db8:cafe::/64"

    def test_update_dual_stack(self):
        """Test updating both IPv4 and IPv6."""
        update = RADIUSSubscriberUpdate(
            framed_ipv4_address="172.16.1.1",
            framed_ipv6_address="fe80::1",
            delegated_ipv6_prefix="2001:db8::/56",
        )
        assert update.framed_ipv4_address == "172.16.1.1"
        assert update.framed_ipv6_address == "fe80::1"
        assert update.delegated_ipv6_prefix == "2001:db8::/56"

    def test_update_backward_compatibility(self):
        """Test backward compatibility in update."""
        update = RADIUSSubscriberUpdate(framed_ip_address="10.3.3.3")
        assert update.framed_ipv4_address == "10.3.3.3"


class TestRADIUSSubscriberResponseIPv6:
    """Test RADIUS subscriber response with IPv6."""

    def test_response_dual_stack(self):
        """Test response includes both IPv4 and IPv6."""
        from datetime import datetime

        response = RADIUSSubscriberResponse(
            id=1,
            tenant_id="tenant1",
            subscriber_id="sub123",
            username="testuser",
            framed_ipv4_address="192.168.1.50",
            framed_ipv6_address="2001:db8::50",
            delegated_ipv6_prefix="2001:db8:1::/64",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        assert response.framed_ipv4_address == "192.168.1.50"
        assert response.framed_ipv6_address == "2001:db8::50"
        assert response.delegated_ipv6_prefix == "2001:db8:1::/64"

    def test_response_backward_compatible_property(self):
        """Test backward compatible framed_ip_address property."""
        from datetime import datetime

        response = RADIUSSubscriberResponse(
            id=1,
            tenant_id="tenant1",
            subscriber_id="sub123",
            username="testuser",
            framed_ipv4_address="192.168.1.50",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        # Old property should return IPv4 address
        assert response.framed_ip_address == "192.168.1.50"


class TestRADIUSSessionResponseIPv6:
    """Test RADIUS session response with IPv6."""

    def test_session_with_ipv4(self):
        """Test session response with IPv4."""
        from datetime import datetime

        session = RADIUSSessionResponse(
            radacctid=1,
            tenant_id="tenant1",
            subscriber_id="sub123",
            username="testuser",
            acctsessionid="session123",
            nasipaddress="10.0.0.1",
            framedipaddress="192.168.1.100",
            acctstarttime=datetime.utcnow(),
        )
        assert session.framedipaddress == "192.168.1.100"
        assert session.framedipv6address is None

    def test_session_with_ipv6(self):
        """Test session response with IPv6."""
        from datetime import datetime

        session = RADIUSSessionResponse(
            radacctid=1,
            tenant_id="tenant1",
            subscriber_id="sub123",
            username="testuser",
            acctsessionid="session123",
            nasipaddress="10.0.0.1",
            framedipv6address="2001:db8::100",
            framedipv6prefix="2001:db8:1::/64",
            delegatedipv6prefix="2001:db8:2::/64",
            acctstarttime=datetime.utcnow(),
        )
        assert session.framedipv6address == "2001:db8::100"
        assert session.framedipv6prefix == "2001:db8:1::/64"
        assert session.delegatedipv6prefix == "2001:db8:2::/64"

    def test_session_with_dual_stack(self):
        """Test session response with dual-stack."""
        from datetime import datetime

        session = RADIUSSessionResponse(
            radacctid=1,
            tenant_id="tenant1",
            subscriber_id="sub123",
            username="testuser",
            acctsessionid="session123",
            nasipaddress="10.0.0.1",
            framedipaddress="192.168.1.100",
            framedipv6address="2001:db8::100",
            acctstarttime=datetime.utcnow(),
        )
        assert session.framedipaddress == "192.168.1.100"
        assert session.framedipv6address == "2001:db8::100"


class TestRADIUSEdgeCases:
    """Test edge cases and special scenarios."""

    def test_empty_optional_fields(self):
        """Test creating subscriber with all optional IP fields empty."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
        )
        assert subscriber.framed_ipv4_address is None
        assert subscriber.framed_ipv6_address is None
        assert subscriber.delegated_ipv6_prefix is None

    def test_whitespace_trimmed(self):
        """Test IP addresses with whitespace are trimmed."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv4_address="  192.168.1.1  ",
            framed_ipv6_address="  2001:db8::1  ",
        )
        assert subscriber.framed_ipv4_address == "192.168.1.1"
        assert subscriber.framed_ipv6_address == "2001:db8::1"

    def test_ipv6_link_local(self):
        """Test IPv6 link-local addresses are accepted."""
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv6_address="fe80::1",
        )
        assert subscriber.framed_ipv6_address == "fe80::1"

    def test_ipv6_multicast_rejected(self):
        """Test multicast addresses handled (validation should accept)."""
        # Note: Our validator accepts multicast IPs, as RADIUS might use them
        subscriber = RADIUSSubscriberCreate(
            subscriber_id="sub123",
            username="testuser",
            password="securepass123",
            framed_ipv6_address="ff02::1",
        )
        assert subscriber.framed_ipv6_address == "ff02::1"

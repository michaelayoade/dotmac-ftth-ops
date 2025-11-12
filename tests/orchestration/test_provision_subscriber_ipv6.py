"""
Tests for Subscriber Provisioning Workflow with IPv6 Support

Test dual-stack and IPv6-only provisioning scenarios.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.orchestration.workflows.provision_subscriber import (
    allocate_ip_handler,
    configure_cpe_handler,
    create_radius_account_handler,
    release_ip_handler,
)


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.query = MagicMock()
    return session


@pytest.fixture
def base_input_data():
    """Base input data for provisioning"""
    return {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "service_address": "123 Main St",
        "service_city": "Springfield",
        "service_state": "IL",
        "service_postal_code": "62701",
        "connection_type": "fiber",
        "service_plan_id": "plan-100mbps",
        "bandwidth_mbps": 100,
        "vlan_id": 100,
        "tenant_id": "tenant-123",
    }


@pytest.fixture
def base_context():
    """Base workflow context"""
    return {
        "subscriber_id": "sub-12345",
        "subscriber_number": "SUB-ABCD1234",
        "customer_id": "cust-67890",
    }


@pytest.mark.integration
class TestIPAllocationHandlerDualStack:
    """Test IP allocation handler with dual-stack support."""

    @pytest.mark.asyncio
    async def test_allocate_dual_stack_ips(self, base_input_data, base_context, mock_db_session):
        """Test dual-stack IP allocation (IPv4 + IPv6)."""
        input_data = {
            **base_input_data,
            "enable_ipv6": True,
            "ipv4_prefix_id": 10,
            "ipv6_prefix_id": 20,
        }

        # Mock NetBox service
        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as mock_netbox:
            mock_service = mock_netbox.return_value
            mock_service.allocate_dual_stack_ips = AsyncMock(
                return_value=(
                    {"id": 100, "address": "203.0.113.50/24"},
                    {"id": 200, "address": "2001:db8::50/64"},
                )
            )

            result = await allocate_ip_handler(input_data, base_context, mock_db_session)

            # Verify dual-stack allocation called
            # Phase 2: Test is lenient about new parameters (subscriber_id, ipv6_pd_*)
            mock_service.allocate_dual_stack_ips.assert_called_once()
            call_kwargs = mock_service.allocate_dual_stack_ips.call_args[1]
            assert call_kwargs["ipv4_prefix_id"] == 10
            assert call_kwargs["ipv6_prefix_id"] == 20
            assert call_kwargs["description"] == "Subscriber SUB-ABCD1234"
            assert call_kwargs["dns_name"] == "sub-SUB-ABCD1234.ftth.net"
            assert call_kwargs["tenant"] == "tenant-123"

            # Verify both IPs returned
            assert result["output_data"]["ipv4_address"] == "203.0.113.50/24"
            assert result["output_data"]["ipv6_address"] == "2001:db8::50/64"
            assert result["output_data"]["ipv4_id"] == 100
            assert result["output_data"]["ipv6_id"] == 200

            # Verify context updates
            assert result["context_updates"]["ipv4_address"] == "203.0.113.50/24"
            assert result["context_updates"]["ipv6_address"] == "2001:db8::50/64"

    @pytest.mark.asyncio
    async def test_allocate_ipv4_only(self, base_input_data, base_context, mock_db_session):
        """Test IPv4-only allocation (backward compatibility)."""
        input_data = {
            **base_input_data,
            "enable_ipv6": False,
            "ipv4_prefix_id": 10,
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as mock_netbox:
            mock_service = mock_netbox.return_value
            mock_service.allocate_ip = AsyncMock(
                return_value={"id": 100, "address": "192.168.1.50/24"}
            )

            result = await allocate_ip_handler(input_data, base_context, mock_db_session)

            # Verify IPv4-only allocation
            assert result["output_data"]["ipv4_address"] == "192.168.1.50/24"
            assert "ipv6_address" not in result["output_data"]

    @pytest.mark.asyncio
    async def test_allocate_ipv6_only(self, base_input_data, base_context, mock_db_session):
        """Test IPv6-only allocation."""
        input_data = {
            **base_input_data,
            "enable_ipv6": True,
            "ipv6_prefix_id": 20,
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as mock_netbox:
            mock_service = mock_netbox.return_value
            mock_service.allocate_ip = AsyncMock(
                return_value={"id": 200, "address": "2001:db8::100/64"}
            )

            result = await allocate_ip_handler(input_data, base_context, mock_db_session)

            # Verify IPv6-only allocation
            assert result["output_data"]["ipv6_address"] == "2001:db8::100/64"
            assert "ipv4_address" not in result["output_data"]

    @pytest.mark.asyncio
    async def test_static_dual_stack_ips(self, base_input_data, base_context, mock_db_session):
        """Test using static IPs (no NetBox allocation)."""
        input_data = {
            **base_input_data,
            "ipv4_address": "10.1.1.50",
            "ipv6_address": "2001:db8:cafe::50",
            "ipv6_prefix": "2001:db8:cafe::/64",
        }

        result = await allocate_ip_handler(input_data, base_context, mock_db_session)

        # Verify static IPs used
        assert result["output_data"]["ipv4_address"] == "10.1.1.50"
        assert result["output_data"]["ipv6_address"] == "2001:db8:cafe::50"
        assert result["output_data"]["ipv6_prefix"] == "2001:db8:cafe::/64"
        assert result["output_data"]["static_ip"] is True
        assert result["compensation_data"]["skipped"] is True

    @pytest.mark.asyncio
    async def test_allocation_disabled(self, base_input_data, base_context, mock_db_session):
        """Test IP allocation disabled."""
        input_data = {
            **base_input_data,
            "allocate_ip_from_netbox": False,
        }

        result = await allocate_ip_handler(input_data, base_context, mock_db_session)

        assert result["output_data"]["skipped"] is True

    @pytest.mark.asyncio
    async def test_missing_prefix_ids_raises_error(
        self, base_input_data, base_context, mock_db_session
    ):
        """Test that missing prefix IDs raises error."""
        input_data = {**base_input_data}  # No prefix IDs

        with pytest.raises(ValueError) as exc_info:
            await allocate_ip_handler(input_data, base_context, mock_db_session)

        assert "No IP allocation strategy specified" in str(exc_info.value)


@pytest.mark.integration
class TestIPReleaseHandlerDualStack:
    """Test IP release compensation handler with dual-stack support."""

    @pytest.mark.asyncio
    async def test_release_dual_stack_ips(self, mock_db_session):
        """Test releasing both IPv4 and IPv6 addresses."""
        compensation_data = {
            "ipv4_id": 100,
            "ipv6_id": 200,
            "ipv4_address": "203.0.113.50/24",
            "ipv6_address": "2001:db8::50/64",
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as mock_netbox:
            mock_service = mock_netbox.return_value
            mock_service.delete_ip_address = AsyncMock()

            await release_ip_handler({}, compensation_data, mock_db_session)

            # Verify both IPs released
            assert mock_service.delete_ip_address.call_count == 2
            mock_service.delete_ip_address.assert_any_call(100)
            mock_service.delete_ip_address.assert_any_call(200)

    @pytest.mark.asyncio
    async def test_release_ipv4_only(self, mock_db_session):
        """Test releasing IPv4 only."""
        compensation_data = {
            "ipv4_id": 100,
            "ipv4_address": "192.168.1.50/24",
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as mock_netbox:
            mock_service = mock_netbox.return_value
            mock_service.delete_ip_address = AsyncMock()

            await release_ip_handler({}, compensation_data, mock_db_session)

            # Verify only IPv4 released
            mock_service.delete_ip_address.assert_called_once_with(100)

    @pytest.mark.asyncio
    async def test_release_ipv6_only(self, mock_db_session):
        """Test releasing IPv6 only."""
        compensation_data = {
            "ipv6_id": 200,
            "ipv6_address": "2001:db8::50/64",
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as mock_netbox:
            mock_service = mock_netbox.return_value
            mock_service.delete_ip_address = AsyncMock()

            await release_ip_handler({}, compensation_data, mock_db_session)

            # Verify only IPv6 released
            mock_service.delete_ip_address.assert_called_once_with(200)

    @pytest.mark.asyncio
    async def test_release_handles_failures_gracefully(self, mock_db_session):
        """Test that IP release handles failures without raising."""
        compensation_data = {
            "ipv4_id": 100,
            "ipv6_id": 200,
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as mock_netbox:
            mock_service = mock_netbox.return_value
            mock_service.delete_ip_address = AsyncMock(side_effect=Exception("NetBox unavailable"))

            # Should not raise exception
            await release_ip_handler({}, compensation_data, mock_db_session)

            # Both deletions attempted despite failures
            assert mock_service.delete_ip_address.call_count == 2

    @pytest.mark.asyncio
    async def test_release_skipped_allocation(self, mock_db_session):
        """Test that skipped allocations are not released."""
        compensation_data = {"skipped": True}

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as mock_netbox:
            mock_service = mock_netbox.return_value
            mock_service.delete_ip_address = AsyncMock()

            await release_ip_handler({}, compensation_data, mock_db_session)

            # No release should be attempted
            mock_service.delete_ip_address.assert_not_called()


@pytest.mark.integration
class TestRADIUSAccountHandlerDualStack:
    """Test RADIUS account creation with dual-stack support."""

    @pytest.mark.asyncio
    async def test_create_radius_account_dual_stack(self, base_input_data, mock_db_session):
        """Test creating RADIUS account with dual-stack IPs."""
        context = {
            "subscriber_id": "sub-12345",
            "subscriber_number": "SUB-ABCD1234",
            "ipv4_address": "203.0.113.50/24",
            "ipv6_address": "2001:db8::50/64",
            "ipv6_prefix": "2001:db8:1::/64",
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.RADIUSService"
        ) as mock_radius:
            mock_service = mock_radius.return_value
            mock_user = MagicMock()
            mock_user.id = "radius-user-123"
            mock_service.create_subscriber = AsyncMock(return_value=mock_user)

            await create_radius_account_handler(base_input_data, context, mock_db_session)

            # Verify RADIUS creation called with dual-stack IPs (CIDR stripped)
            call_args = mock_service.create_subscriber.call_args[0][0]
            assert call_args.framed_ipv4_address == "203.0.113.50"
            assert call_args.framed_ipv6_address == "2001:db8::50"
            assert call_args.delegated_ipv6_prefix == "2001:db8:1::/64"
            assert call_args.username == "john.doe@example.com"
            assert call_args.subscriber_id == "sub-12345"

    @pytest.mark.asyncio
    async def test_create_radius_account_ipv4_only(self, base_input_data, mock_db_session):
        """Test creating RADIUS account with IPv4 only."""
        context = {
            "subscriber_id": "sub-12345",
            "subscriber_number": "SUB-ABCD1234",
            "ipv4_address": "192.168.1.50/24",
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.RADIUSService"
        ) as mock_radius:
            mock_service = mock_radius.return_value
            mock_user = MagicMock()
            mock_user.id = "radius-user-123"
            mock_service.create_subscriber = AsyncMock(return_value=mock_user)

            await create_radius_account_handler(base_input_data, context, mock_db_session)

            # Verify only IPv4 passed (CIDR stripped)
            call_args = mock_service.create_subscriber.call_args[0][0]
            assert call_args.framed_ipv4_address == "192.168.1.50"
            assert call_args.framed_ipv6_address is None

    @pytest.mark.asyncio
    async def test_create_radius_account_ipv6_only(self, base_input_data, mock_db_session):
        """Test creating RADIUS account with IPv6 only."""
        context = {
            "subscriber_id": "sub-12345",
            "subscriber_number": "SUB-ABCD1234",
            "ipv6_address": "2001:db8::100/64",
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.RADIUSService"
        ) as mock_radius:
            mock_service = mock_radius.return_value
            mock_user = MagicMock()
            mock_user.id = "radius-user-123"
            mock_service.create_subscriber = AsyncMock(return_value=mock_user)

            await create_radius_account_handler(base_input_data, context, mock_db_session)

            # Verify only IPv6 passed (CIDR stripped)
            call_args = mock_service.create_subscriber.call_args[0][0]
            assert call_args.framed_ipv4_address is None
            assert call_args.framed_ipv6_address == "2001:db8::100"


@pytest.mark.integration
class TestCPEConfigurationHandlerDualStack:
    """Test CPE configuration with dual-stack support."""

    @pytest.mark.asyncio
    async def test_configure_cpe_dual_stack(self, base_input_data, mock_db_session):
        """Test configuring CPE with dual-stack WAN."""
        input_data = {
            **base_input_data,
            "cpe_mac": "AA:BB:CC:DD:EE:FF",
        }

        context = {
            "subscriber_id": "sub-12345",
            "subscriber_number": "SUB-ABCD1234",
            "ipv4_address": "203.0.113.50/24",
            "ipv6_address": "2001:db8::50/64",
            "ipv6_prefix": "2001:db8:1::/64",
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.GenieACSService"
        ) as mock_genieacs:
            mock_service = mock_genieacs.return_value
            mock_service.configure_device = AsyncMock(
                return_value={"device_id": "cpe-12345", "status": "configured"}
            )

            await configure_cpe_handler(input_data, context, mock_db_session)

            # Verify CPE configured with dual-stack
            call_kwargs = mock_service.configure_device.call_args.kwargs
            assert call_kwargs["wan_ipv4"] == "203.0.113.50/24"
            assert call_kwargs["wan_ipv6"] == "2001:db8::50/64"
            assert call_kwargs["ipv6_prefix"] == "2001:db8:1::/64"
            assert call_kwargs["mac_address"] == "AA:BB:CC:DD:EE:FF"

    @pytest.mark.asyncio
    async def test_configure_cpe_ipv4_only(self, base_input_data, mock_db_session):
        """Test configuring CPE with IPv4 only."""
        input_data = {
            **base_input_data,
            "cpe_mac": "AA:BB:CC:DD:EE:FF",
        }

        context = {
            "subscriber_id": "sub-12345",
            "subscriber_number": "SUB-ABCD1234",
            "ipv4_address": "192.168.1.50/24",
        }

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.GenieACSService"
        ) as mock_genieacs:
            mock_service = mock_genieacs.return_value
            mock_service.configure_device = AsyncMock(
                return_value={"device_id": "cpe-12345", "status": "configured"}
            )

            await configure_cpe_handler(input_data, context, mock_db_session)

            # Verify only IPv4 passed
            call_kwargs = mock_service.configure_device.call_args.kwargs
            assert call_kwargs["wan_ipv4"] == "192.168.1.50/24"
            assert call_kwargs.get("wan_ipv6") is None

"""
Tests for network profile integration in provisioning workflows.

Tests Phase 1 implementation:
- Network profile creation during provisioning
- Static IP priority from network profile
- Dynamic IP writeback to network profile
- Profile data flowing through workflow context
- Profile soft-delete during deprovisioning
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.network.models import IPv6AssignmentMode
from dotmac.platform.orchestration.workflows.deprovision_subscriber import (
    delete_network_profile_handler,
)
from dotmac.platform.orchestration.workflows.provision_subscriber import (
    allocate_ip_handler,
    create_network_profile_handler,
)


class TestNetworkProfileCreation:
    """Test network profile creation during provisioning."""

    @pytest.mark.asyncio
    async def test_create_network_profile_handler_success(self):
        """Test successful network profile creation."""
        # Arrange
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())
        profile_id = uuid4()

        input_data = {
            "tenant_id": tenant_id,
            "service_vlan": 100,
            "inner_vlan": 1000,
            "qinq_enabled": True,
            "circuit_id": "OLT1/1/1/1:1",
            "remote_id": "FTTH-CPE-12345",
            "option82_policy": "log",
            "static_ipv4": "10.0.1.100",
            "static_ipv6": "2001:db8::1",
            "delegated_ipv6_prefix": "2001:db8:1::/56",
            "ipv6_pd_size": 56,
            "ipv6_assignment_mode": "dual_stack",
        }

        context = {
            "subscriber_id": subscriber_id,
            "tenant_id": tenant_id,
        }

        db_mock = MagicMock()

        # Mock profile service
        mock_profile = MagicMock()
        mock_profile.id = profile_id
        mock_profile.service_vlan = 100
        mock_profile.inner_vlan = 1000
        mock_profile.qinq_enabled = True
        mock_profile.static_ipv4 = "10.0.1.100"
        mock_profile.static_ipv6 = "2001:db8::1"
        mock_profile.delegated_ipv6_prefix = "2001:db8:1::/56"
        mock_profile.ipv6_assignment_mode = IPv6AssignmentMode.DUAL_STACK

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.SubscriberNetworkProfileService"
        ) as MockProfileService:
            mock_service = MockProfileService.return_value
            mock_service.upsert_profile = AsyncMock(return_value=mock_profile)

            # Act
            result = await create_network_profile_handler(input_data, context, db_mock)

            # Assert
            assert result["output_data"]["network_profile_id"] == str(profile_id)
            assert result["output_data"]["service_vlan"] == 100
            assert result["output_data"]["qinq_enabled"] is True
            assert result["output_data"]["ipv6_assignment_mode"] == "dual_stack"

            # Check context updates
            assert result["context_updates"]["network_profile_id"] == str(profile_id)
            assert result["context_updates"]["service_vlan"] == 100
            assert result["context_updates"]["inner_vlan"] == 1000
            assert result["context_updates"]["qinq_enabled"] is True
            assert result["context_updates"]["static_ipv4"] == "10.0.1.100"
            assert result["context_updates"]["static_ipv6"] == "2001:db8::1"

            # Verify service was called
            mock_service.upsert_profile.assert_called_once()
            call_args = mock_service.upsert_profile.call_args[0]
            assert call_args[0] == subscriber_id
            profile_data = call_args[1]
            assert profile_data["service_vlan"] == 100
            assert profile_data["circuit_id"] == "OLT1/1/1/1:1"

    @pytest.mark.asyncio
    async def test_create_network_profile_handler_defaults(self):
        """Test network profile creation with default values."""
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())
        profile_id = uuid4()

        input_data = {
            "tenant_id": tenant_id,
            # Minimal data - should use defaults
        }

        context = {
            "subscriber_id": subscriber_id,
        }

        db_mock = MagicMock()

        mock_profile = MagicMock()
        mock_profile.id = profile_id
        mock_profile.service_vlan = None
        mock_profile.qinq_enabled = False
        mock_profile.ipv6_assignment_mode = IPv6AssignmentMode.DUAL_STACK

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.SubscriberNetworkProfileService"
        ) as MockProfileService:
            mock_service = MockProfileService.return_value
            mock_service.upsert_profile = AsyncMock(return_value=mock_profile)

            # Act
            result = await create_network_profile_handler(input_data, context, db_mock)

            # Assert
            assert result["output_data"]["qinq_enabled"] is False
            mock_service.upsert_profile.assert_called_once()


class TestStaticIPPriority:
    """Test static IP priority from network profile."""

    @pytest.mark.asyncio
    async def test_allocate_ip_handler_uses_profile_static_ips(self):
        """Test that static IPs from network profile are used first."""
        # Arrange
        input_data = {
            "allocate_ip_from_netbox": True,
            "tenant_id": str(uuid4()),
        }

        context = {
            "subscriber_id": str(uuid4()),
            "subscriber_number": "SUB-123",
            # Static IPs from network profile (set by create_network_profile_handler)
            "static_ipv4": "10.0.1.100",
            "static_ipv6": "2001:db8::1",
            "delegated_ipv6_prefix": "2001:db8:1::/56",
        }

        db_mock = MagicMock()

        # Act
        result = await allocate_ip_handler(input_data, context, db_mock)

        # Assert
        assert result["output_data"]["ipv4_address"] == "10.0.1.100"
        assert result["output_data"]["ipv6_address"] == "2001:db8::1"
        assert result["output_data"]["ipv6_prefix"] == "2001:db8:1::/56"
        assert result["output_data"]["static_ip"] is True
        assert result["output_data"]["source"] == "network_profile"
        assert result["compensation_data"]["skipped"] is True

    @pytest.mark.asyncio
    async def test_allocate_ip_handler_dynamic_allocation(self):
        """Test dynamic IP allocation when no static IPs in profile."""
        # Arrange
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())

        input_data = {
            "allocate_ip_from_netbox": True,
            "enable_ipv6": True,
            "ipv4_prefix_id": 123,
            "ipv6_prefix_id": 456,
            "tenant_id": tenant_id,
        }

        context = {
            "subscriber_id": subscriber_id,
            "subscriber_number": "SUB-123",
            "tenant_id": tenant_id,
            # No static IPs in context (profile doesn't have them)
        }

        db_mock = MagicMock()

        # Mock NetBox service
        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as MockNetBoxService:
            mock_netbox = MockNetBoxService.return_value
            mock_netbox.allocate_dual_stack_ips = AsyncMock(
                return_value=(
                    {"address": "10.0.1.200/24", "id": 1},
                    {"address": "2001:db8::200/64", "id": 2},
                )
            )

            # Mock profile service for writeback
            with patch(
                "dotmac.platform.orchestration.workflows.provision_subscriber.SubscriberNetworkProfileService"
            ) as MockProfileService:
                mock_profile_service = MockProfileService.return_value
                mock_profile_service.upsert_profile = AsyncMock()

                # Act
                result = await allocate_ip_handler(input_data, context, db_mock)

                # Assert
                assert result["output_data"]["ipv4_address"] == "10.0.1.200/24"
                assert result["output_data"]["ipv6_address"] == "2001:db8::200/64"
                assert result["output_data"]["source"] == "netbox_dynamic"

                # Verify writeback to profile was called
                mock_profile_service.upsert_profile.assert_called_once()
                call_args = mock_profile_service.upsert_profile.call_args[0]
                assert call_args[0] == subscriber_id
                assert call_args[1]["static_ipv4"] == "10.0.1.200/24"
                assert call_args[1]["static_ipv6"] == "2001:db8::200/64"


class TestNetworkProfileCleanup:
    """Test network profile cleanup during deprovisioning."""

    @pytest.mark.asyncio
    async def test_delete_network_profile_handler_success(self):
        """Test successful network profile deletion."""
        # Arrange
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())
        profile_id = uuid4()

        input_data = {
            "tenant_id": tenant_id,
        }

        context = {
            "subscriber_id": subscriber_id,
            "tenant_id": tenant_id,
        }

        db_mock = MagicMock()

        # Mock profile
        mock_profile = MagicMock()
        mock_profile.id = profile_id
        mock_profile.service_vlan = 100

        with patch(
            "dotmac.platform.orchestration.workflows.deprovision_subscriber.SubscriberNetworkProfileService"
        ) as MockProfileService:
            mock_service = MockProfileService.return_value
            mock_service.get_by_subscriber_id = AsyncMock(return_value=mock_profile)
            mock_service.delete_profile = AsyncMock()

            # Act
            result = await delete_network_profile_handler(input_data, context, db_mock)

            # Assert
            assert result["output_data"]["network_profile_deleted"] is True
            assert result["compensation_data"]["subscriber_id"] == subscriber_id
            assert result["compensation_data"]["profile_id"] == str(profile_id)

            # Verify delete was called
            mock_service.delete_profile.assert_called_once_with(subscriber_id)

    @pytest.mark.asyncio
    async def test_delete_network_profile_handler_not_found(self):
        """Test graceful handling when network profile doesn't exist."""
        # Arrange
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())

        input_data = {
            "tenant_id": tenant_id,
        }

        context = {
            "subscriber_id": subscriber_id,
            "tenant_id": tenant_id,
        }

        db_mock = MagicMock()

        with patch(
            "dotmac.platform.orchestration.workflows.deprovision_subscriber.SubscriberNetworkProfileService"
        ) as MockProfileService:
            mock_service = MockProfileService.return_value
            mock_service.get_by_subscriber_id = AsyncMock(return_value=None)

            # Act
            result = await delete_network_profile_handler(input_data, context, db_mock)

            # Assert
            assert result["output_data"]["skipped"] is True


class TestContextPropagation:
    """Test that network profile data propagates through workflow context."""

    @pytest.mark.asyncio
    async def test_context_contains_profile_data(self):
        """Test that create_network_profile_handler adds all necessary data to context."""
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())
        profile_id = uuid4()

        input_data = {
            "tenant_id": tenant_id,
            "service_vlan": 100,
            "inner_vlan": 1000,
            "qinq_enabled": True,
            "static_ipv4": "10.0.1.100",
            "static_ipv6": "2001:db8::1",
            "delegated_ipv6_prefix": "2001:db8:1::/56",
            "ipv6_assignment_mode": "dual_stack",
        }

        context = {
            "subscriber_id": subscriber_id,
        }

        db_mock = MagicMock()

        mock_profile = MagicMock()
        mock_profile.id = profile_id
        mock_profile.service_vlan = 100
        mock_profile.inner_vlan = 1000
        mock_profile.qinq_enabled = True
        mock_profile.static_ipv4 = "10.0.1.100"
        mock_profile.static_ipv6 = "2001:db8::1"
        mock_profile.delegated_ipv6_prefix = "2001:db8:1::/56"
        mock_profile.ipv6_assignment_mode = IPv6AssignmentMode.DUAL_STACK

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.SubscriberNetworkProfileService"
        ) as MockProfileService:
            mock_service = MockProfileService.return_value
            mock_service.upsert_profile = AsyncMock(return_value=mock_profile)

            # Act
            result = await create_network_profile_handler(input_data, context, db_mock)

            # Assert - verify all required context keys are present
            context_updates = result["context_updates"]
            required_keys = [
                "network_profile_id",
                "service_vlan",
                "inner_vlan",
                "qinq_enabled",
                "static_ipv4",
                "static_ipv6",
                "delegated_ipv6_prefix",
                "ipv6_assignment_mode",
            ]

            for key in required_keys:
                assert key in context_updates, f"Missing required context key: {key}"

            # These values are consumed by subsequent handlers
            assert context_updates["service_vlan"] == 100  # Used by RADIUS and VOLTHA
            assert context_updates["static_ipv4"] == "10.0.1.100"  # Used by IP allocation
            assert context_updates["ipv6_assignment_mode"] == "dual_stack"  # Used by RADIUS

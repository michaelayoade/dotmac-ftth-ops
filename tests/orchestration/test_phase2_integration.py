"""
Tests for Phase 2: NetBox/VOLTHA Integration

Tests Phase 2 implementation:
- IPv6 Prefix Delegation (DHCPv6-PD) from NetBox
- QinQ (802.1ad) double VLAN tagging in VOLTHA
- DHCPv6-PD configuration in GenieACS
- End-to-end integration with provisioning workflow
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.orchestration.workflows.provision_subscriber import (

pytestmark = pytest.mark.integration
    activate_onu_handler,
    allocate_ip_handler,
    configure_cpe_handler,
)


class TestIPv6PrefixDelegation:
    """Test IPv6 Prefix Delegation (DHCPv6-PD) in NetBox."""

    @pytest.mark.asyncio
    async def test_allocate_dual_stack_with_ipv6_pd(self):
        """Test dual-stack IP allocation with IPv6 prefix delegation."""
        # Arrange
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())

        input_data = {
            "allocate_ip_from_netbox": True,
            "enable_ipv6": True,
            "ipv4_prefix_id": 123,
            "ipv6_prefix_id": 456,
            "tenant_id": tenant_id,
            "ipv6_pd_parent_prefix_id": 789,  # Phase 2: Parent prefix for PD
            "ipv6_pd_size": 56,  # Phase 2: /56 delegation
        }

        context = {
            "subscriber_id": subscriber_id,
            "subscriber_number": "SUB-123",
            "tenant_id": tenant_id,
        }

        db_mock = MagicMock()

        # Mock NetBox service - returns 3-tuple with IPv6 PD
        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
        ) as MockNetBoxService:
            mock_netbox = MockNetBoxService.return_value
            mock_netbox.allocate_dual_stack_ips = AsyncMock(
                return_value=(
                    {"address": "10.0.1.200/24", "id": 1},  # IPv4
                    {"address": "2001:db8::200/64", "id": 2},  # IPv6
                    {"prefix": "2001:db8:1::/56", "id": 3},  # IPv6 PD
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
                assert result["output_data"]["ipv6_pd_prefix"] == "2001:db8:1::/56"
                assert result["output_data"]["ipv6_pd_id"] == 3
                assert result["context_updates"]["delegated_ipv6_prefix"] == "2001:db8:1::/56"

                # Verify NetBox was called with PD parameters
                mock_netbox.allocate_dual_stack_ips.assert_called_once()
                call_kwargs = mock_netbox.allocate_dual_stack_ips.call_args[1]
                assert call_kwargs["ipv6_pd_parent_prefix_id"] == 789
                assert call_kwargs["ipv6_pd_size"] == 56
                assert call_kwargs["subscriber_id"] == subscriber_id

                # Verify writeback included IPv6 PD prefix
                mock_profile_service.upsert_profile.assert_called_once()
                profile_data = mock_profile_service.upsert_profile.call_args[0][1]
                assert profile_data["delegated_ipv6_prefix"] == "2001:db8:1::/56"

    @pytest.mark.asyncio
    async def test_allocate_dual_stack_without_ipv6_pd(self):
        """Test dual-stack allocation without IPv6 PD (backward compatible)."""
        # Arrange
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())

        input_data = {
            "allocate_ip_from_netbox": True,
            "enable_ipv6": True,
            "ipv4_prefix_id": 123,
            "ipv6_prefix_id": 456,
            "tenant_id": tenant_id,
            # No ipv6_pd_parent_prefix_id - should work without PD
        }

        context = {
            "subscriber_id": subscriber_id,
            "subscriber_number": "SUB-123",
            "tenant_id": tenant_id,
        }

        db_mock = MagicMock()

        # Mock NetBox service - returns 2-tuple (no IPv6 PD)
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
                assert "ipv6_pd_prefix" not in result["output_data"]  # No PD
                assert "delegated_ipv6_prefix" not in result["context_updates"]

                # Verify NetBox was called without PD parameters
                call_kwargs = mock_netbox.allocate_dual_stack_ips.call_args[1]
                assert call_kwargs["ipv6_pd_size"] is None


class TestQinQVLANTagging:
    """Test QinQ (802.1ad) double VLAN tagging in VOLTHA."""

    @pytest.mark.asyncio
    async def test_activate_onu_with_qinq(self):
        """Test ONU activation with QinQ double VLAN tagging."""
        # Arrange
        subscriber_id = str(uuid4())

        input_data = {
            "configure_voltha": True,
            "onu_serial": "ALCL12345678",
            "bandwidth_mbps": 1000,
        }

        context = {
            "subscriber_id": subscriber_id,
            "subscriber_number": "SUB-123",
            "service_vlan": 100,  # S-VLAN (outer)
            "inner_vlan": 1000,  # C-VLAN (inner)
            "qinq_enabled": True,  # Phase 2: QinQ enabled
        }

        db_mock = MagicMock()

        # Mock VOLTHA service
        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.VOLTHAService"
        ) as MockVOLTHAService:
            mock_voltha = MockVOLTHAService.return_value
            mock_voltha.activate_onu = AsyncMock(
                return_value={
                    "onu_id": "onu-456",
                    "status": "active",
                }
            )

            # Act
            result = await activate_onu_handler(input_data, context, db_mock)

            # Assert
            assert result["output_data"]["onu_id"] == "onu-456"
            assert result["output_data"]["onu_status"] == "active"

            # Verify VOLTHA was called with QinQ parameters
            mock_voltha.activate_onu.assert_called_once()
            call_kwargs = mock_voltha.activate_onu.call_args[1]
            assert call_kwargs["qinq_enabled"] is True
            assert call_kwargs["inner_vlan"] == 1000
            assert call_kwargs["vlan_id"] == 100

    @pytest.mark.asyncio
    async def test_activate_onu_without_qinq(self):
        """Test ONU activation with standard single VLAN (backward compatible)."""
        # Arrange
        subscriber_id = str(uuid4())

        input_data = {
            "configure_voltha": True,
            "onu_serial": "ALCL12345678",
            "bandwidth_mbps": 1000,
        }

        context = {
            "subscriber_id": subscriber_id,
            "subscriber_number": "SUB-123",
            "service_vlan": 100,
            "qinq_enabled": False,  # Standard single VLAN
        }

        db_mock = MagicMock()

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.VOLTHAService"
        ) as MockVOLTHAService:
            mock_voltha = MockVOLTHAService.return_value
            mock_voltha.activate_onu = AsyncMock(
                return_value={
                    "onu_id": "onu-456",
                    "status": "active",
                }
            )

            # Act
            result = await activate_onu_handler(input_data, context, db_mock)

            # Assert
            assert result["output_data"]["onu_id"] == "onu-456"

            # Verify VOLTHA was called without QinQ
            call_kwargs = mock_voltha.activate_onu.call_args[1]
            assert call_kwargs["qinq_enabled"] is False
            assert call_kwargs["inner_vlan"] is None


class TestDHCPv6PDConfiguration:
    """Test DHCPv6-PD configuration in GenieACS."""

    @pytest.mark.asyncio
    async def test_configure_cpe_with_ipv6_pd(self):
        """Test CPE configuration with DHCPv6-PD enabled."""
        # Arrange
        subscriber_id = str(uuid4())

        input_data = {
            "configure_genieacs": True,
            "cpe_mac": "AA:BB:CC:DD:EE:FF",
        }

        context = {
            "subscriber_id": subscriber_id,
            "subscriber_number": "SUB-123",
            "ipv4_address": "10.0.1.200/24",
            "ipv6_address": "2001:db8::200/64",
            "delegated_ipv6_prefix": "2001:db8:1::/56",  # Phase 2: IPv6 PD
        }

        db_mock = MagicMock()

        # Mock GenieACS service
        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.GenieACSService"
        ) as MockGenieACSService:
            mock_genieacs = MockGenieACSService.return_value
            mock_genieacs.configure_device = AsyncMock(
                return_value={
                    "device_id": "cpe-789",
                    "status": "configured",
                }
            )

            # Act
            result = await configure_cpe_handler(input_data, context, db_mock)

            # Assert
            assert result["output_data"]["cpe_id"] == "cpe-789"
            assert result["output_data"]["cpe_status"] == "configured"

            # Verify GenieACS was called with IPv6 PD parameters
            mock_genieacs.configure_device.assert_called_once()
            call_kwargs = mock_genieacs.configure_device.call_args[1]
            assert call_kwargs["ipv6_prefix"] == "2001:db8:1::/56"
            assert call_kwargs["ipv6_pd_enabled"] is True

    @pytest.mark.asyncio
    async def test_configure_cpe_without_ipv6_pd(self):
        """Test CPE configuration without DHCPv6-PD (backward compatible)."""
        # Arrange
        subscriber_id = str(uuid4())

        input_data = {
            "configure_genieacs": True,
            "cpe_mac": "AA:BB:CC:DD:EE:FF",
        }

        context = {
            "subscriber_id": subscriber_id,
            "subscriber_number": "SUB-123",
            "ipv4_address": "10.0.1.200/24",
            "ipv6_address": "2001:db8::200/64",
            # No delegated_ipv6_prefix
        }

        db_mock = MagicMock()

        with patch(
            "dotmac.platform.orchestration.workflows.provision_subscriber.GenieACSService"
        ) as MockGenieACSService:
            mock_genieacs = MockGenieACSService.return_value
            mock_genieacs.configure_device = AsyncMock(
                return_value={
                    "device_id": "cpe-789",
                    "status": "configured",
                }
            )

            # Act
            result = await configure_cpe_handler(input_data, context, db_mock)

            # Assert
            assert result["output_data"]["cpe_id"] == "cpe-789"

            # Verify GenieACS was called without IPv6 PD
            call_kwargs = mock_genieacs.configure_device.call_args[1]
            assert call_kwargs["ipv6_prefix"] is None
            assert call_kwargs["ipv6_pd_enabled"] is False


class TestEndToEndPhase2Integration:
    """Test end-to-end integration of all Phase 2 features."""

    @pytest.mark.asyncio
    async def test_full_provisioning_with_all_phase2_features(self):
        """
        Test complete provisioning workflow with all Phase 2 features enabled:
        - IPv6 Prefix Delegation
        - QinQ double VLAN tagging
        - DHCPv6-PD configuration
        """
        # Arrange
        subscriber_id = str(uuid4())
        tenant_id = str(uuid4())

        # Input data with all Phase 2 parameters
        input_data = {
            "allocate_ip_from_netbox": True,
            "enable_ipv6": True,
            "ipv4_prefix_id": 123,
            "ipv6_prefix_id": 456,
            "ipv6_pd_parent_prefix_id": 789,
            "ipv6_pd_size": 56,
            "tenant_id": tenant_id,
            "configure_voltha": True,
            "onu_serial": "ALCL12345678",
            "bandwidth_mbps": 1000,
            "configure_genieacs": True,
            "cpe_mac": "AA:BB:CC:DD:EE:FF",
        }

        # Context from network profile (Phase 1)
        context = {
            "subscriber_id": subscriber_id,
            "subscriber_number": "SUB-123",
            "tenant_id": tenant_id,
            "service_vlan": 100,
            "inner_vlan": 1000,
            "qinq_enabled": True,
            "ipv6_pd_size": 56,
        }

        db_mock = MagicMock()

        # Mock all services
        with (
            patch(
                "dotmac.platform.orchestration.workflows.provision_subscriber.NetBoxService"
            ) as MockNetBoxService,
            patch(
                "dotmac.platform.orchestration.workflows.provision_subscriber.VOLTHAService"
            ) as MockVOLTHAService,
            patch(
                "dotmac.platform.orchestration.workflows.provision_subscriber.GenieACSService"
            ) as MockGenieACSService,
            patch(
                "dotmac.platform.orchestration.workflows.provision_subscriber.SubscriberNetworkProfileService"
            ) as MockProfileService,
        ):
            # Setup mocks
            mock_netbox = MockNetBoxService.return_value
            mock_netbox.allocate_dual_stack_ips = AsyncMock(
                return_value=(
                    {"address": "10.0.1.200/24", "id": 1},
                    {"address": "2001:db8::200/64", "id": 2},
                    {"prefix": "2001:db8:1::/56", "id": 3},
                )
            )

            mock_profile_service = MockProfileService.return_value
            mock_profile_service.upsert_profile = AsyncMock()

            mock_voltha = MockVOLTHAService.return_value
            mock_voltha.activate_onu = AsyncMock(
                return_value={"onu_id": "onu-456", "status": "active"}
            )

            mock_genieacs = MockGenieACSService.return_value
            mock_genieacs.configure_device = AsyncMock(
                return_value={"device_id": "cpe-789", "status": "configured"}
            )

            # Act - Step 1: IP Allocation with IPv6 PD
            ip_result = await allocate_ip_handler(input_data, context, db_mock)

            # Update context with allocated IPs
            context.update(ip_result["context_updates"])

            # Act - Step 2: VOLTHA ONU Activation with QinQ
            onu_result = await activate_onu_handler(input_data, context, db_mock)

            # Act - Step 3: GenieACS CPE Configuration with DHCPv6-PD
            cpe_result = await configure_cpe_handler(input_data, context, db_mock)

            # Assert - All steps completed successfully
            assert ip_result["output_data"]["ipv6_pd_prefix"] == "2001:db8:1::/56"
            assert onu_result["output_data"]["onu_status"] == "active"
            assert cpe_result["output_data"]["cpe_status"] == "configured"

            # Assert - IPv6 PD flows through workflow
            assert context["delegated_ipv6_prefix"] == "2001:db8:1::/56"

            # Verify NetBox received PD parameters
            netbox_call = mock_netbox.allocate_dual_stack_ips.call_args[1]
            assert netbox_call["ipv6_pd_parent_prefix_id"] == 789
            assert netbox_call["ipv6_pd_size"] == 56

            # Verify VOLTHA received QinQ parameters
            voltha_call = mock_voltha.activate_onu.call_args[1]
            assert voltha_call["qinq_enabled"] is True
            assert voltha_call["vlan_id"] == 100
            assert voltha_call["inner_vlan"] == 1000

            # Verify GenieACS received DHCPv6-PD parameters
            genieacs_call = mock_genieacs.configure_device.call_args[1]
            assert genieacs_call["ipv6_prefix"] == "2001:db8:1::/56"
            assert genieacs_call["ipv6_pd_enabled"] is True

            # Verify profile was updated with all allocated resources
            profile_update = mock_profile_service.upsert_profile.call_args[0][1]
            assert profile_update["static_ipv4"] == "10.0.1.200/24"
            assert profile_update["static_ipv6"] == "2001:db8::200/64"
            assert profile_update["delegated_ipv6_prefix"] == "2001:db8:1::/56"

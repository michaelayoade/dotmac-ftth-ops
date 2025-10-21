"""
Complete End-to-End Provisioning Workflow Integration Tests

Tests the full subscriber provisioning flow across all systems:
RADIUS + NetBox + WireGuard with dual-stack support.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
from dotmac.platform.radius.service import RADIUSService
from dotmac.platform.netbox.client import NetBoxClient
from dotmac.platform.wireguard.schemas import WireGuardServerCreate, WireGuardPeerCreate
from dotmac.platform.wireguard.service import WireGuardService


@pytest.mark.integration
@pytest.mark.asyncio
class TestCompleteProvisioningWorkflow:
    """End-to-end integration tests for complete provisioning."""

    async def test_complete_dual_stack_provisioning_e2e(self, async_db_session):
        """
        Test complete subscriber provisioning with all systems.

        Flow:
        1. Allocate dual-stack IPs from NetBox
        2. Create RADIUS subscriber with allocated IPs
        3. Create WireGuard peer with same IPs
        4. Verify all systems have consistent data
        """
        # Setup NetBox client
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.netbox_url = "http://netbox.test"
            mock_settings.external_services.vault_url = "http://vault.test"
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            # 1. Allocate IPs from NetBox
            netbox = NetBoxClient(api_token="test_token")
            netbox.request = AsyncMock()

            ipv4_response = {
                "id": 100,
                "address": "100.64.1.50/24",
                "status": {"value": "active"},
                "description": "Customer subscriber001",
                "dns_name": "subscriber001.isp.com",
            }

            ipv6_response = {
                "id": 200,
                "address": "2001:db8:100::50/64",
                "status": {"value": "active"},
                "description": "Customer subscriber001",
                "dns_name": "subscriber001.isp.com",
            }

            netbox.request.side_effect = [ipv4_response, ipv6_response]

            ipv4, ipv6 = await netbox.allocate_dual_stack_ips(
                ipv4_prefix_id=1,
                ipv6_prefix_id=2,
                description="Customer subscriber001",
                dns_name="subscriber001.isp.com",
                tenant=10,
            )

            # Extract IPs (remove CIDR)
            subscriber_ipv4 = ipv4["address"].split("/")[0]
            subscriber_ipv6 = ipv6["address"].split("/")[0]

            # 2. Create RADIUS subscriber
            radius_service = RADIUSService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            radius_data = RADIUSSubscriberCreate(
                subscriber_id="subscriber001",
                username="sub001@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address=subscriber_ipv4,
                framed_ipv6_address=subscriber_ipv6,
                framed_ipv6_prefix="2001:db8:100::/64",
                download_speed="100M",
                upload_speed="50M",
            )

            radius_sub = await radius_service.create_subscriber(radius_data)

            # 3. Create WireGuard VPN access
            wg_service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # First create server if not exists
            server_data = WireGuardServerCreate(
                name="Main VPN Server",
                server_ipv4="10.8.0.1/24",
                server_ipv6="fd00:8::1/64",
                public_endpoint="vpn.isp.com:51820",
                listen_port=51820,
            )

            wg_server = await wg_service.create_server(server_data)

            # Create peer for subscriber
            peer_data = WireGuardPeerCreate(
                server_id=wg_server.server_id,
                name="subscriber001 VPN",
                description="VPN access for subscriber001",
                customer_id="subscriber001",
                # Auto-allocate VPN IPs (different from public IPs)
            )

            wg_peer = await wg_service.create_peer(peer_data)

            # 4. Verify all systems consistent
            # Verify NetBox allocated IPs
            assert subscriber_ipv4 == "100.64.1.50"
            assert subscriber_ipv6 == "2001:db8:100::50"

            # Verify RADIUS has same IPs
            assert radius_sub.framed_ipv4_address == subscriber_ipv4
            assert radius_sub.framed_ipv6_address == subscriber_ipv6

            # Verify WireGuard peer created
            assert wg_peer.customer_id == "subscriber001"
            assert wg_peer.peer_ipv4 is not None  # VPN IP allocated
            assert wg_peer.peer_ipv6 is not None  # VPN IP allocated

            # Verify subscriber can be retrieved
            retrieved = await radius_service.get_subscriber("subscriber001")
            assert retrieved is not None
            assert retrieved.framed_ipv4_address == subscriber_ipv4

    async def test_provisioning_with_auto_allocation_e2e(self, async_db_session):
        """
        Test provisioning with automatic IP allocation everywhere.

        Flow:
        1. Auto-allocate IPs from NetBox
        2. Use allocated IPs in RADIUS
        3. Auto-allocate VPN IPs in WireGuard
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.netbox_url = "http://netbox.test"
            mock_settings.external_services.vault_url = "http://vault.test"
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            # NetBox auto-allocation
            netbox = NetBoxClient(api_token="test_token")
            netbox.request = AsyncMock()

            ipv4_alloc = {
                "id": 101,
                "address": "100.64.2.10/24",
                "dns_name": "auto-sub002.isp.com",
            }

            ipv6_alloc = {
                "id": 201,
                "address": "2001:db8:200::10/64",
                "dns_name": "auto-sub002.isp.com",
            }

            netbox.request.side_effect = [ipv4_alloc, ipv6_alloc]

            ipv4, ipv6 = await netbox.allocate_dual_stack_ips(
                ipv4_prefix_id=1,
                ipv6_prefix_id=2,
                dns_name="auto-sub002.isp.com",
            )

            # RADIUS with allocated IPs
            radius_service = RADIUSService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            radius_data = RADIUSSubscriberCreate(
                subscriber_id="auto-sub002",
                username="auto002@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address=ipv4["address"].split("/")[0],
                framed_ipv6_address=ipv6["address"].split("/")[0],
                framed_ipv6_prefix="2001:db8:200::/64",
            )

            radius_sub = await radius_service.create_subscriber(radius_data)

            # WireGuard with auto VPN IPs
            wg_service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            server_data = WireGuardServerCreate(
                name="Auto Alloc Server",
                server_ipv4="10.9.0.1/24",
                server_ipv6="fd00:9::1/64",
                public_endpoint="vpn.isp.com:51820",
                listen_port=51820,
            )

            server = await wg_service.create_server(server_data)

            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="auto-sub002 VPN",
                customer_id="auto-sub002",
            )

            peer = await wg_service.create_peer(peer_data)

            # Verify auto-allocations
            assert radius_sub.framed_ipv4_address == "100.64.2.10"
            assert radius_sub.framed_ipv6_address == "2001:db8:200::10"
            assert peer.peer_ipv4 is not None
            assert peer.peer_ipv6 is not None

    async def test_provisioning_ipv4_only_legacy_support(self, async_db_session):
        """
        Test backward compatibility with IPv4-only provisioning.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False
            mock_settings.external_services.vault_url = "http://vault.test"

            # RADIUS IPv4-only
            radius_service = RADIUSService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            radius_data = RADIUSSubscriberCreate(
                subscriber_id="legacy-sub003",
                username="legacy003@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address="192.168.1.100",
            )

            radius_sub = await radius_service.create_subscriber(radius_data)

            # WireGuard IPv4-only
            wg_service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            server_data = WireGuardServerCreate(
                name="IPv4-Only Server",
                server_ipv4="10.10.0.1/24",
                public_endpoint="vpn4.isp.com:51820",
                listen_port=51820,
            )

            server = await wg_service.create_server(server_data)

            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="legacy-sub003 VPN",
                customer_id="legacy-sub003",
            )

            peer = await wg_service.create_peer(peer_data)

            # Verify IPv4-only
            assert radius_sub.framed_ipv4_address == "192.168.1.100"
            assert radius_sub.framed_ipv6_address is None
            assert peer.peer_ipv4 is not None
            assert peer.peer_ipv6 is None

    async def test_deprovisioning_cleanup_e2e(self, async_db_session):
        """
        Test complete cleanup when deprovisioning subscriber.

        Flow:
        1. Provision subscriber (RADIUS + WireGuard)
        2. Deprovision subscriber
        3. Verify all systems cleaned up
        4. Verify IPs can be reallocated
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False
            mock_settings.external_services.vault_url = "http://vault.test"
            mock_settings.external_services.netbox_url = "http://netbox.test"

            # 1. Provision
            radius_service = RADIUSService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            radius_data = RADIUSSubscriberCreate(
                subscriber_id="deprovision-sub004",
                username="deprov004@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address="100.64.3.100",
                framed_ipv6_address="2001:db8:300::100",
            )

            radius_sub = await radius_service.create_subscriber(radius_data)

            wg_service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            server_data = WireGuardServerCreate(
                name="Deprov Server",
                server_ipv4="10.11.0.1/24",
                server_ipv6="fd00:11::1/64",
                public_endpoint="vpn.isp.com:51820",
                listen_port=51820,
            )

            server = await wg_service.create_server(server_data)

            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="deprovision-sub004 VPN",
                customer_id="deprovision-sub004",
                peer_ipv4="10.11.0.100",
                peer_ipv6="fd00:11::100",
            )

            peer = await wg_service.create_peer(peer_data)

            # Store IPs for reallocation test
            public_ipv4 = radius_sub.framed_ipv4_address
            public_ipv6 = radius_sub.framed_ipv6_address
            vpn_ipv4 = peer.peer_ipv4
            vpn_ipv6 = peer.peer_ipv6

            # 2. Deprovision
            await wg_service.delete_peer(peer.peer_id)
            await radius_service.delete_subscriber("deprovision-sub004")

            # Mock NetBox IP deletion
            netbox = NetBoxClient(api_token="test_token")
            netbox.request = AsyncMock(return_value=None)

            await netbox.delete_ip(ip_id=100)  # IPv4
            await netbox.delete_ip(ip_id=200)  # IPv6

            # 3. Verify cleanup
            deleted_sub = await radius_service.get_subscriber("deprovision-sub004")
            assert deleted_sub is None

            deleted_peer = await wg_service.get_peer(peer.peer_id)
            assert deleted_peer is None

            # 4. Verify IPs can be reallocated
            new_radius_data = RADIUSSubscriberCreate(
                subscriber_id="new-sub005",
                username="new005@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address=public_ipv4,  # Reuse
                framed_ipv6_address=public_ipv6,  # Reuse
            )

            new_sub = await radius_service.create_subscriber(new_radius_data)
            assert new_sub.framed_ipv4_address == public_ipv4

            new_peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="new-sub005 VPN",
                peer_ipv4=vpn_ipv4,  # Reuse
                peer_ipv6=vpn_ipv6,  # Reuse
            )

            new_peer = await wg_service.create_peer(new_peer_data)
            assert new_peer.peer_ipv4 == vpn_ipv4

    async def test_multi_tenant_provisioning_isolation(self, async_db_session):
        """
        Test tenant isolation across all provisioning systems.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False
            mock_settings.external_services.vault_url = "http://vault.test"

            # Tenant A
            radius_a = RADIUSService(
                session=async_db_session,
                tenant_id="tenant_a"
            )

            sub_a_data = RADIUSSubscriberCreate(
                subscriber_id="tenant-a-sub001",
                username="tena001@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address="10.1.1.10",
                framed_ipv6_address="2001:db8:a::10",
            )

            sub_a = await radius_a.create_subscriber(sub_a_data)

            # Tenant B (same IPs, different tenant)
            radius_b = RADIUSService(
                session=async_db_session,
                tenant_id="tenant_b"
            )

            sub_b_data = RADIUSSubscriberCreate(
                subscriber_id="tenant-b-sub001",
                username="tenb001@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address="10.1.1.10",  # Same IP allowed
                framed_ipv6_address="2001:db8:a::10",  # Same IP allowed
            )

            sub_b = await radius_b.create_subscriber(sub_b_data)

            # Verify tenant isolation
            assert sub_a.tenant_id == "tenant_a"
            assert sub_b.tenant_id == "tenant_b"

            # Tenant A cannot see Tenant B's data
            tenant_a_view = await radius_a.get_subscriber("tenant-b-sub001")
            assert tenant_a_view is None

    async def test_bulk_provisioning_performance(self, async_db_session):
        """
        Test bulk provisioning of 100 subscribers.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            radius_service = RADIUSService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            import time
            start_time = time.time()

            # Provision 100 subscribers
            for i in range(1, 101):
                sub_data = RADIUSSubscriberCreate(
                    subscriber_id=f"bulk-sub{i:03d}",
                    username=f"bulk{i:03d}@isp.com",
                    password="SecurePassword123!",
                    framed_ipv4_address=f"100.64.10.{i}",
                    framed_ipv6_address=f"2001:db8:bulk::{i:x}",
                )

                await radius_service.create_subscriber(sub_data)

            elapsed = time.time() - start_time

            # Performance assertion (should complete in reasonable time)
            assert elapsed < 60  # Less than 60 seconds for 100 subscribers

            # Verify all created
            first_sub = await radius_service.get_subscriber("bulk-sub001")
            last_sub = await radius_service.get_subscriber("bulk-sub100")

            assert first_sub is not None
            assert last_sub is not None

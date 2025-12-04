"""
Complete End-to-End Provisioning Workflow Integration Tests

Tests the full subscriber provisioning flow across all systems:
RADIUS + NetBox + WireGuard with dual-stack support.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.netbox.client import NetBoxClient
from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
from dotmac.platform.radius.service import RADIUSService
from dotmac.platform.subscribers.models import SubscriberStatus
from dotmac.platform.wireguard.client import WireGuardClient
from dotmac.platform.wireguard.service import WireGuardService


@pytest.mark.integration
@pytest.mark.serial_only
@pytest.mark.asyncio
class TestCompleteProvisioningWorkflow:
    """End-to-end integration tests for complete provisioning."""

    @pytest.fixture
    def mock_wireguard_client(self):
        """Create a mock WireGuard client for testing."""
        client = MagicMock(spec=WireGuardClient)

        async def mock_generate_keypair():
            unique_suffix = uuid4().hex[:32]
            private_key = f"priv{unique_suffix}".ljust(44, "=")[:44]
            public_key = f"pub{unique_suffix}".ljust(44, "=")[:44]
            return (private_key, public_key)

        # Mock IP allocation to return sequential IPs
        ip_counter = {"ipv4": 2, "ipv6": 2}

        async def mock_allocate_peer_ip(server_subnet: str, used_ips: list[str]):
            if ":" in server_subnet:  # IPv6
                ip_counter["ipv6"] += 1
                base = server_subnet.split("/")[0].rsplit(":", 1)[0]
                return f"{base}::{ip_counter['ipv6']}"
            else:  # IPv4
                ip_counter["ipv4"] += 1
                base = server_subnet.split("/")[0].rsplit(".", 1)[0]
                return f"{base}.{ip_counter['ipv4']}"

        async def mock_generate_peer_config(
            server_public_key: str,
            server_endpoint: str,
            peer_private_key: str,
            peer_address: str,
            dns_servers: list[str],
            allowed_ips: list[str],
        ):
            return f"""[Interface]
PrivateKey = {peer_private_key}
Address = {peer_address}
DNS = {", ".join(dns_servers) if dns_servers else ""}

[Peer]
PublicKey = {server_public_key}
Endpoint = {server_endpoint}
AllowedIPs = {", ".join(allowed_ips)}
PersistentKeepalive = 25
"""

        client.generate_keypair = mock_generate_keypair
        client.allocate_peer_ip = mock_allocate_peer_ip
        client.generate_peer_config = mock_generate_peer_config
        client.add_peer = AsyncMock()
        client.remove_peer = AsyncMock()
        client.get_peer_stats = AsyncMock(return_value=None)
        return client

    async def test_complete_dual_stack_provisioning_e2e(
        self, async_db_session, smoke_test_tenant, subscriber_factory, mock_wireguard_client
    ):
        """
        Test complete subscriber provisioning with all systems.

        Flow:
        1. Allocate dual-stack IPs from NetBox
        2. Create RADIUS subscriber with allocated IPs
        3. Create WireGuard peer with same IPs
        4. Verify all systems have consistent data
        """
        # Setup NetBox client
        with patch("dotmac.platform.settings.settings") as mock_settings:
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
            # Generate unique ID per test run to avoid constraint violations
            unique_id = str(uuid4())[:8]
            radius_service = RADIUSService(session=async_db_session, tenant_id="smoke-test-tenant")

            radius_data = RADIUSSubscriberCreate(
                subscriber_id=f"subscriber{unique_id}",
                username=f"sub{unique_id}@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address=subscriber_ipv4,
                framed_ipv6_address=subscriber_ipv6,
                framed_ipv6_prefix="2001:db8:100::/64",
            )

            # Create Subscriber record first
            await subscriber_factory.create(
                id=radius_data.subscriber_id,
                tenant_id="smoke-test-tenant",
                username=radius_data.username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            radius_sub = await radius_service.create_subscriber(radius_data)

            # 3. Create WireGuard VPN access
            wg_service = WireGuardService(
                session=async_db_session,
                client=mock_wireguard_client,
                tenant_id="smoke-test-tenant",
            )

            # First create server if not exists
            wg_server = await wg_service.create_server(
                name="Main VPN Server",
                server_ipv4="10.8.0.1/24",
                server_ipv6="fd00:8::1/64",
                public_endpoint="vpn.isp.com:51820",
                listen_port=51820,
            )

            # Create peer for subscriber
            wg_peer = await wg_service.create_peer(
                server_id=wg_server.id,
                name=f"{radius_data.subscriber_id} VPN",
                description=f"VPN access for {radius_data.subscriber_id}",
                customer_id=radius_data.subscriber_id,
                # Auto-allocate VPN IPs (different from public IPs)
            )

            # 4. Verify all systems consistent
            # Verify NetBox allocated IPs
            assert subscriber_ipv4 == "100.64.1.50"
            assert subscriber_ipv6 == "2001:db8:100::50"

            # Verify RADIUS has same IPs
            assert radius_sub.framed_ipv4_address == subscriber_ipv4
            assert radius_sub.framed_ipv6_address == subscriber_ipv6

            # Verify WireGuard peer created
            assert wg_peer.customer_id == radius_data.subscriber_id
            assert wg_peer.peer_ipv4 is not None  # VPN IP allocated
            assert wg_peer.peer_ipv6 is not None  # VPN IP allocated

            # Verify subscriber can be retrieved
            retrieved = await radius_service.get_subscriber(subscriber_id=radius_data.subscriber_id)
            assert retrieved is not None
            assert retrieved.framed_ipv4_address == subscriber_ipv4

    async def test_provisioning_with_auto_allocation_e2e(
        self, async_db_session, smoke_test_tenant, subscriber_factory, mock_wireguard_client
    ):
        """
        Test provisioning with automatic IP allocation everywhere.

        Flow:
        1. Auto-allocate IPs from NetBox
        2. Use allocated IPs in RADIUS
        3. Auto-allocate VPN IPs in WireGuard
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
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
            # Generate unique ID per test run to avoid constraint violations
            unique_id = str(uuid4())[:8]
            radius_service = RADIUSService(session=async_db_session, tenant_id="smoke-test-tenant")

            radius_data = RADIUSSubscriberCreate(
                subscriber_id=f"autosub{unique_id}",
                username=f"auto{unique_id}@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address=ipv4["address"].split("/")[0],
                framed_ipv6_address=ipv6["address"].split("/")[0],
                framed_ipv6_prefix="2001:db8:200::/64",
            )

            # Create Subscriber record first
            await subscriber_factory.create(
                id=radius_data.subscriber_id,
                tenant_id="smoke-test-tenant",
                username=radius_data.username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            radius_sub = await radius_service.create_subscriber(radius_data)

            # WireGuard with auto VPN IPs
            wg_service = WireGuardService(
                session=async_db_session,
                client=mock_wireguard_client,
                tenant_id="smoke-test-tenant",
            )

            server = await wg_service.create_server(
                name="Auto Alloc Server",
                server_ipv4="10.9.0.1/24",
                server_ipv6="fd00:9::1/64",
                public_endpoint="vpn.isp.com:51820",
                listen_port=51820,
            )

            peer = await wg_service.create_peer(
                server_id=server.id,
                name=f"{radius_data.subscriber_id} VPN",
                customer_id=radius_data.subscriber_id,
            )

            # Verify auto-allocations
            assert radius_sub.framed_ipv4_address == "100.64.2.10"
            assert radius_sub.framed_ipv6_address == "2001:db8:200::10"
            assert peer.peer_ipv4 is not None
            assert peer.peer_ipv6 is not None

    async def test_provisioning_ipv4_only_legacy_support(
        self, async_db_session, smoke_test_tenant, subscriber_factory, mock_wireguard_client
    ):
        """
        Test backward compatibility with IPv4-only provisioning.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False
            mock_settings.external_services.vault_url = "http://vault.test"

            # RADIUS IPv4-only
            # Generate unique ID per test run to avoid constraint violations
            unique_id = str(uuid4())[:8]
            radius_service = RADIUSService(session=async_db_session, tenant_id="smoke-test-tenant")

            radius_data = RADIUSSubscriberCreate(
                subscriber_id=f"legacy{unique_id}",
                username=f"legacy{unique_id}@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address="192.168.1.100",
            )

            # Create Subscriber record first
            await subscriber_factory.create(
                id=radius_data.subscriber_id,
                tenant_id="smoke-test-tenant",
                username=radius_data.username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            radius_sub = await radius_service.create_subscriber(radius_data)

            # WireGuard IPv4-only
            wg_service = WireGuardService(
                session=async_db_session,
                client=mock_wireguard_client,
                tenant_id="smoke-test-tenant",
            )

            server = await wg_service.create_server(
                name="IPv4-Only Server",
                server_ipv4="10.10.0.1/24",
                public_endpoint="vpn4.isp.com:51820",
                listen_port=51820,
            )

            peer = await wg_service.create_peer(
                server_id=server.id,
                name=f"{radius_data.subscriber_id} VPN",
                customer_id=radius_data.subscriber_id,
            )

            # Verify IPv4-only
            assert radius_sub.framed_ipv4_address == "192.168.1.100"
            assert radius_sub.framed_ipv6_address is None
            assert peer.peer_ipv4 is not None
            assert peer.peer_ipv6 is None

    async def test_deprovisioning_cleanup_e2e(
        self, async_db_session, smoke_test_tenant, subscriber_factory, mock_wireguard_client
    ):
        """
        Test complete cleanup when deprovisioning subscriber.

        Flow:
        1. Provision subscriber (RADIUS + WireGuard)
        2. Deprovision subscriber
        3. Verify all systems cleaned up
        4. Verify IPs can be reallocated
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False
            mock_settings.external_services.vault_url = "http://vault.test"
            mock_settings.external_services.netbox_url = "http://netbox.test"

            # 1. Provision
            # Generate unique ID per test run to avoid constraint violations
            unique_id = str(uuid4())[:8]
            radius_service = RADIUSService(session=async_db_session, tenant_id="smoke-test-tenant")

            radius_data = RADIUSSubscriberCreate(
                subscriber_id=f"deprov{unique_id}",
                username=f"deprov{unique_id}@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address="100.64.3.100",
                framed_ipv6_address="2001:db8:300::100",
            )

            # Create Subscriber record first
            await subscriber_factory.create(
                id=radius_data.subscriber_id,
                tenant_id="smoke-test-tenant",
                username=radius_data.username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            radius_sub = await radius_service.create_subscriber(radius_data)

            wg_service = WireGuardService(
                session=async_db_session,
                client=mock_wireguard_client,
                tenant_id="smoke-test-tenant",
            )

            server = await wg_service.create_server(
                name="Deprov Server",
                server_ipv4="10.11.0.1/24",
                server_ipv6="fd00:11::1/64",
                public_endpoint="vpn.isp.com:51820",
                listen_port=51820,
            )

            peer = await wg_service.create_peer(
                server_id=server.id,
                name=f"{radius_data.subscriber_id} VPN",
                customer_id=radius_data.subscriber_id,
                peer_ipv4="10.11.0.100",
                peer_ipv6="fd00:11::100",
            )

            # Store IPs for reallocation test
            public_ipv4 = radius_sub.framed_ipv4_address
            public_ipv6 = radius_sub.framed_ipv6_address
            vpn_ipv4 = peer.peer_ipv4
            vpn_ipv6 = peer.peer_ipv6

            # 2. Deprovision
            await wg_service.delete_peer(peer.id)
            await radius_service.delete_subscriber(subscriber_id=radius_data.subscriber_id)

            # Mock NetBox IP deletion
            netbox = NetBoxClient(api_token="test_token")
            netbox.request = AsyncMock(return_value=None)

            await netbox.delete_ip_address(ip_id=100)  # IPv4
            await netbox.delete_ip_address(ip_id=200)  # IPv6

            # 3. Verify cleanup
            deleted_sub = await radius_service.get_subscriber(
                subscriber_id=radius_data.subscriber_id
            )
            assert deleted_sub is None

            deleted_peer = await wg_service.get_peer(peer.id)
            assert deleted_peer is None

            # 4. Verify IPs can be reallocated
            unique_id_new = str(uuid4())[:8]
            new_radius_data = RADIUSSubscriberCreate(
                subscriber_id=f"newsub{unique_id_new}",
                username=f"new{unique_id_new}@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address=public_ipv4,  # Reuse
                framed_ipv6_address=public_ipv6,  # Reuse
            )

            # Create Subscriber record for new subscriber
            await subscriber_factory.create(
                id=new_radius_data.subscriber_id,
                tenant_id="smoke-test-tenant",
                username=new_radius_data.username,
                subscriber_number=f"SUB-{unique_id_new.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            new_sub = await radius_service.create_subscriber(new_radius_data)
            assert new_sub.framed_ipv4_address == public_ipv4

            new_peer = await wg_service.create_peer(
                server_id=server.id,
                name=f"{new_radius_data.subscriber_id} VPN",
                peer_ipv4=vpn_ipv4,  # Reuse
                peer_ipv6=vpn_ipv6,  # Reuse
            )
            assert new_peer.peer_ipv4 == vpn_ipv4

    async def test_multi_tenant_provisioning_isolation(
        self, async_db_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test tenant isolation across all provisioning systems.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False
            mock_settings.external_services.vault_url = "http://vault.test"

            # Tenant A
            unique_id_a = str(uuid4())[:8]
            radius_a = RADIUSService(session=async_db_session, tenant_id="tenant_a")

            sub_a_data = RADIUSSubscriberCreate(
                subscriber_id=f"tena{unique_id_a}",
                username=f"tena{unique_id_a}@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address="10.1.1.10",
                framed_ipv6_address="2001:db8:a::10",
            )

            # Create Subscriber record for tenant A
            await subscriber_factory.create(
                id=sub_a_data.subscriber_id,
                tenant_id="tenant_a",
                username=sub_a_data.username,
                subscriber_number=f"SUB-{unique_id_a.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            sub_a = await radius_a.create_subscriber(sub_a_data)

            # Tenant B (same IPs, different tenant)
            unique_id_b = str(uuid4())[:8]
            radius_b = RADIUSService(session=async_db_session, tenant_id="tenant_b")

            sub_b_data = RADIUSSubscriberCreate(
                subscriber_id=f"tenb{unique_id_b}",
                username=f"tenb{unique_id_b}@isp.com",
                password="SecurePassword123!",
                framed_ipv4_address="10.1.1.10",  # Same IP allowed
                framed_ipv6_address="2001:db8:a::10",  # Same IP allowed
            )

            # Create Subscriber record for tenant B
            await subscriber_factory.create(
                id=sub_b_data.subscriber_id,
                tenant_id="tenant_b",
                username=sub_b_data.username,
                subscriber_number=f"SUB-{unique_id_b.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            sub_b = await radius_b.create_subscriber(sub_b_data)

            # Verify tenant isolation
            assert sub_a.tenant_id == "tenant_a"
            assert sub_b.tenant_id == "tenant_b"

            # Tenant A cannot see Tenant B's data
            tenant_a_view = await radius_a.get_subscriber(subscriber_id=sub_b_data.subscriber_id)
            assert tenant_a_view is None

    async def test_bulk_provisioning_performance(
        self, async_db_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test bulk provisioning of 100 subscribers.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            radius_service = RADIUSService(session=async_db_session, tenant_id="smoke-test-tenant")

            import time

            # Generate unique base ID for this test run to avoid constraint violations
            base_unique_id = str(uuid4())[:8]
            start_time = time.time()

            # Provision 100 subscribers
            for i in range(1, 101):
                sub_data = RADIUSSubscriberCreate(
                    subscriber_id=f"bulk{base_unique_id}{i:03d}",
                    username=f"bulk{base_unique_id}{i:03d}@isp.com",
                    password="SecurePassword123!",
                    framed_ipv4_address=f"100.64.10.{i}",
                    framed_ipv6_address=f"2001:db8:1000::{i:x}",
                )

                # Create Subscriber record first
                unique_id = str(uuid4())[:8]
                await subscriber_factory.create(
                    id=sub_data.subscriber_id,
                    tenant_id="smoke-test-tenant",
                    username=sub_data.username,
                    subscriber_number=f"SUB-{unique_id.upper()}",
                    status=SubscriberStatus.ACTIVE,
                )

                await radius_service.create_subscriber(sub_data)

            elapsed = time.time() - start_time

            # Performance assertion (should complete in reasonable time)
            assert elapsed < 60  # Less than 60 seconds for 100 subscribers

            # Verify all created
            first_sub = await radius_service.get_subscriber(
                subscriber_id=f"bulk{base_unique_id}001"
            )
            last_sub = await radius_service.get_subscriber(subscriber_id=f"bulk{base_unique_id}100")

            assert first_sub is not None
            assert last_sub is not None

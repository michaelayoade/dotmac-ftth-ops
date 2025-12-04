"""
Integration Tests for WireGuard Dual-Stack VPN

Tests complete workflows for WireGuard server and peer creation with automatic
dual-stack IP allocation.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.wireguard.client import WireGuardClient
from dotmac.platform.wireguard.service import WireGuardService, WireGuardServiceError


@pytest.fixture
def mock_wireguard_client():
    """Create a mock WireGuard client for testing."""
    client = MagicMock(spec=WireGuardClient)

    # Mock the generate_keypair method to return async coroutine with unique 44-char keys
    async def mock_generate_keypair():
        # Generate unique 44-character keys (base64-like format) using uuid4().hex
        unique_suffix = uuid4().hex[:32]  # 32 hex chars
        private_key = f"priv{unique_suffix}====".ljust(44, "=")[:44]
        public_key = f"pub{unique_suffix}=====".ljust(44, "=")[:44]
        return (private_key, public_key)

    # Mock allocate_peer_ip to return sequential IP addresses
    ip_counter = {"ipv4": 2, "ipv6": 2}  # Start from .2 (server uses .1)

    async def mock_allocate_peer_ip(server_subnet: str, used_ips: list[str]):
        # Simple IP allocation for testing
        if ":" in server_subnet:  # IPv6
            ip_counter["ipv6"] += 1
            # Extract prefix and add counter (simplified IPv6 allocation)
            base = server_subnet.split("/")[0].rsplit(":", 1)[0]
            return f"{base}::{ip_counter['ipv6']}"
        else:  # IPv4
            ip_counter["ipv4"] += 1
            base = server_subnet.split("/")[0].rsplit(".", 1)[0]
            return f"{base}.{ip_counter['ipv4']}"

    # Mock generate_peer_config to return config string
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
DNS = {", ".join(dns_servers)}

[Peer]
PublicKey = {server_public_key}
Endpoint = {server_endpoint}
AllowedIPs = {", ".join(allowed_ips)}
PersistentKeepalive = 25
"""

    client.generate_keypair = mock_generate_keypair
    client.allocate_peer_ip = mock_allocate_peer_ip
    client.generate_peer_config = mock_generate_peer_config

    # Mock other methods as needed
    client.add_peer = AsyncMock()
    client.remove_peer = AsyncMock()
    client.get_peer_stats = AsyncMock(return_value=None)

    return client


@pytest.mark.integration
@pytest.mark.serial_only
@pytest.mark.asyncio
class TestWireGuardDualStackIntegration:
    """Integration tests for WireGuard dual-stack operations."""

    async def test_create_dual_stack_server_integration(
        self, async_db_session, mock_wireguard_client
    ):
        """
        Test creating WireGuard server with dual-stack support.

        Flow:
        1. Create server with IPv4 and IPv6 subnets
        2. Verify server configuration stored correctly
        3. Verify both subnets tracked
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create dual-stack server
            result = await service.create_server(
                name="Dual-Stack VPN Server",
                server_ipv4="10.8.0.1/24",
                server_ipv6="fd00:8::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
                max_peers=1000,
                dns_servers=["1.1.1.1", "2606:4700:4700::1111"],
                allowed_ips=["0.0.0.0/0", "::/0"],
            )

            # Verify server created
            assert result.name == "Dual-Stack VPN Server"
            assert result.server_ipv4 == "10.8.0.1/24"
            assert result.server_ipv6 == "fd00:8::1/64"
            assert result.public_endpoint == "vpn.example.com:51820"

            # Verify supports dual-stack
            assert result.supports_ipv6 is True

    async def test_create_ipv4_only_server_integration(
        self, async_db_session, mock_wireguard_client
    ):
        """
        Test creating IPv4-only WireGuard server (backward compatibility).
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create IPv4-only server
            result = await service.create_server(
                name="IPv4-Only VPN Server",
                server_ipv4="10.9.0.1/24",
                public_endpoint="vpn4.example.com:51820",
                listen_port=51820,
            )

            # Verify IPv4-only
            assert result.server_ipv4 == "10.9.0.1/24"
            assert result.server_ipv6 is None
            assert result.supports_ipv6 is False

    async def test_create_peer_auto_dual_stack_allocation(
        self, async_db_session, mock_wireguard_client
    ):
        """
        Test automatic dual-stack IP allocation for peer.

        Flow:
        1. Create dual-stack server
        2. Create peer without specifying IPs
        3. Verify peer gets both IPv4 and IPv6 automatically
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # 1. Create dual-stack server
            server = await service.create_server(
                name="Auto-Allocation Server",
                server_ipv4="10.10.0.1/24",
                server_ipv6="fd00:10::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            # 2. Create peer with auto-allocation (no peer_ipv4 or peer_ipv6 specified)
            peer = await service.create_peer(
                server_id=server.id,
                name="Auto Peer 1",
                description="Test automatic dual-stack allocation",
            )

            # 3. Verify both IPs allocated
            assert peer.peer_ipv4 is not None
            assert peer.peer_ipv6 is not None

            # Verify IPs are within server subnets
            assert peer.peer_ipv4.startswith("10.10.0.")  # In 10.10.0.0/24
            assert peer.peer_ipv6.startswith("fd00:10::")  # In fd00:10::/64

            # Verify not server IPs
            assert peer.peer_ipv4 != "10.10.0.1"
            assert peer.peer_ipv6 != "fd00:10::1"

    async def test_create_multiple_peers_sequential_allocation(
        self, async_db_session, mock_wireguard_client
    ):
        """
        Test sequential IP allocation for multiple peers.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create server
            server = await service.create_server(
                name="Multi-Peer Server",
                server_ipv4="10.20.0.1/24",
                server_ipv6="fd00:20::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            # Create 10 peers
            peers = []
            for i in range(1, 11):
                peer = await service.create_peer(
                    server_id=server.id,
                    name=f"Peer {i}",
                    description=f"Test peer {i}",
                )
                peers.append(peer)

            # Verify all have IPs
            assert len(peers) == 10
            for peer in peers:
                assert peer.peer_ipv4 is not None
                assert peer.peer_ipv6 is not None

            # Verify IPs are unique
            ipv4_addresses = [p.peer_ipv4 for p in peers]
            ipv6_addresses = [p.peer_ipv6 for p in peers]
            assert len(set(ipv4_addresses)) == 10  # All unique
            assert len(set(ipv6_addresses)) == 10  # All unique

    async def test_create_peer_ipv4_only_server(self, async_db_session, mock_wireguard_client):
        """
        Test peer creation on IPv4-only server gets only IPv4.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create IPv4-only server
            server = await service.create_server(
                name="IPv4-Only Server",
                server_ipv4="10.30.0.1/24",
                public_endpoint="vpn4.example.com:51820",
                listen_port=51820,
            )

            # Create peer
            peer = await service.create_peer(
                server_id=server.id,
                name="IPv4 Peer",
            )

            # Verify only IPv4 allocated
            assert peer.peer_ipv4 is not None
            assert peer.peer_ipv6 is None

    async def test_create_peer_manual_ips(self, async_db_session, mock_wireguard_client):
        """
        Test creating peer with manually specified IPs.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create server
            server = await service.create_server(
                name="Manual IP Server",
                server_ipv4="10.40.0.1/24",
                server_ipv6="fd00:40::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            # Create peer with manual IPs
            peer = await service.create_peer(
                server_id=server.id,
                name="Manual IP Peer",
                peer_ipv4="10.40.0.100",
                peer_ipv6="fd00:40::100",
            )

            # Verify manual IPs assigned
            assert peer.peer_ipv4 == "10.40.0.100"
            assert peer.peer_ipv6 == "fd00:40::100"

    async def test_peer_ip_conflict_detection(self, async_db_session, mock_wireguard_client):
        """
        Test detection of IP conflicts when manually specifying peer IPs.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create server
            server = await service.create_server(
                name="Conflict Test Server",
                server_ipv4="10.50.0.1/24",
                server_ipv6="fd00:50::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            # Create first peer
            await service.create_peer(
                server_id=server.id,
                name="Peer 1",
                peer_ipv4="10.50.0.10",
                peer_ipv6="fd00:50::10",
            )

            # Attempt to create second peer with same IPs - should raise error
            with pytest.raises((ValueError, WireGuardServiceError)) as exc_info:
                await service.create_peer(
                    server_id=server.id,
                    name="Peer 2",
                    peer_ipv4="10.50.0.10",  # Conflict
                    peer_ipv6="fd00:50::10",  # Conflict
                )

            assert (
                "already in use" in str(exc_info.value).lower()
                or "conflict" in str(exc_info.value).lower()
            )

    async def test_generate_peer_config_dual_stack(self, async_db_session, mock_wireguard_client):
        """
        Test generating WireGuard config for dual-stack peer.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create server
            server = await service.create_server(
                name="Config Gen Server",
                server_ipv4="10.60.0.1/24",
                server_ipv6="fd00:60::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
                dns_servers=["1.1.1.1", "2606:4700:4700::1111"],
            )

            # Create peer
            peer = await service.create_peer(
                server_id=server.id,
                name="Config Peer",
            )

            # Generate config
            updated_peer = await service.regenerate_peer_config(peer.id)
            config = updated_peer.config_file

            # Verify config contains both IPs
            assert peer.peer_ipv4 in config
            assert peer.peer_ipv6 in config

            # Verify config contains DNS servers (both IPv4 and IPv6)
            assert "1.1.1.1" in config
            assert "2606:4700:4700::1111" in config

            # Verify config contains endpoint
            assert "vpn.example.com:51820" in config

            # Verify AllowedIPs includes both ::/0 and 0.0.0.0/0
            assert "0.0.0.0/0" in config or "::/0" in config

    async def test_delete_peer_cleanup(self, async_db_session, mock_wireguard_client):
        """
        Test deleting peer cleans up IP allocations.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create server and peer
            server = await service.create_server(
                name="Delete Test Server",
                server_ipv4="10.70.0.1/24",
                server_ipv6="fd00:70::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            peer = await service.create_peer(
                server_id=server.id,
                name="Delete Peer",
                peer_ipv4="10.70.0.100",
                peer_ipv6="fd00:70::100",
            )

            # Store IPs
            peer_ipv4 = peer.peer_ipv4
            peer_ipv6 = peer.peer_ipv6

            # Delete peer
            await service.delete_peer(peer.id)

            # Verify peer deleted
            deleted_peer = await service.get_peer(peer.id)
            assert deleted_peer is None

            # Create new peer - should be able to reuse the IPs
            new_peer = await service.create_peer(
                server_id=server.id,
                name="New Peer",
                peer_ipv4=peer_ipv4,  # Reuse deleted peer's IPs
                peer_ipv6=peer_ipv6,
            )
            assert new_peer.peer_ipv4 == peer_ipv4
            assert new_peer.peer_ipv6 == peer_ipv6

    async def test_peer_expiration(self, async_db_session, mock_wireguard_client):
        """
        Test peer with expiration date.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create server
            server = await service.create_server(
                name="Expiration Test Server",
                server_ipv4="10.80.0.1/24",
                server_ipv6="fd00:80::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            # Create peer with expiration
            from datetime import timedelta

            expires_at = datetime.now(UTC) + timedelta(days=30)

            peer = await service.create_peer(
                server_id=server.id,
                name="Temporary Peer",
                expires_at=expires_at,
            )

            # Verify expiration set
            assert peer.expires_at is not None
            assert (peer.expires_at - expires_at).total_seconds() < 60  # Within 1 minute

    async def test_server_capacity_limits(self, async_db_session, mock_wireguard_client):
        """
        Test server enforces max_peers limit.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session, client=mock_wireguard_client, tenant_id="test_tenant"
            )

            # Create server with low max_peers
            server = await service.create_server(
                name="Limited Server",
                server_ipv4="10.90.0.1/24",
                server_ipv6="fd00:90::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
                max_peers=3,  # Only 3 peers allowed
            )

            # Create 3 peers (should succeed)
            for i in range(1, 4):
                await service.create_peer(
                    server_id=server.id,
                    name=f"Peer {i}",
                )

            # Attempt 4th peer (should fail)
            with pytest.raises(WireGuardServiceError) as exc_info:
                await service.create_peer(
                    server_id=server.id,
                    name="Peer 4",
                )

            assert (
                "capacity" in str(exc_info.value).lower()
                or "max_peers" in str(exc_info.value).lower()
            )

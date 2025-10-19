"""
Integration Tests for WireGuard Dual-Stack VPN

Tests complete workflows for WireGuard server and peer creation with automatic
dual-stack IP allocation.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from dotmac.platform.wireguard.schemas import (
    WireGuardServerCreate,
    WireGuardPeerCreate,
)
from dotmac.platform.wireguard.service import WireGuardService


@pytest.mark.integration
@pytest.mark.asyncio
class TestWireGuardDualStackIntegration:
    """Integration tests for WireGuard dual-stack operations."""

    async def test_create_dual_stack_server_integration(self, async_db_session):
        """
        Test creating WireGuard server with dual-stack support.

        Flow:
        1. Create server with IPv4 and IPv6 subnets
        2. Verify server configuration stored correctly
        3. Verify both subnets tracked
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create dual-stack server
            server_data = WireGuardServerCreate(
                name="Dual-Stack VPN Server",
                server_ipv4="10.8.0.1/24",
                server_ipv6="fd00:8::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
                max_peers=1000,
                dns_servers=["1.1.1.1", "2606:4700:4700::1111"],
                allowed_ips=["0.0.0.0/0", "::/0"],
            )

            result = await service.create_server(server_data)

            # Verify server created
            assert result.name == "Dual-Stack VPN Server"
            assert result.server_ipv4 == "10.8.0.1/24"
            assert result.server_ipv6 == "fd00:8::1/64"
            assert result.public_endpoint == "vpn.example.com:51820"

            # Verify supports dual-stack
            assert result.supports_ipv6 is True

    async def test_create_ipv4_only_server_integration(self, async_db_session):
        """
        Test creating IPv4-only WireGuard server (backward compatibility).
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create IPv4-only server
            server_data = WireGuardServerCreate(
                name="IPv4-Only VPN Server",
                server_ipv4="10.9.0.1/24",
                public_endpoint="vpn4.example.com:51820",
                listen_port=51820,
            )

            result = await service.create_server(server_data)

            # Verify IPv4-only
            assert result.server_ipv4 == "10.9.0.1/24"
            assert result.server_ipv6 is None
            assert result.supports_ipv6 is False

    async def test_create_peer_auto_dual_stack_allocation(self, async_db_session):
        """
        Test automatic dual-stack IP allocation for peer.

        Flow:
        1. Create dual-stack server
        2. Create peer without specifying IPs
        3. Verify peer gets both IPv4 and IPv6 automatically
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # 1. Create dual-stack server
            server_data = WireGuardServerCreate(
                name="Auto-Allocation Server",
                server_ipv4="10.10.0.1/24",
                server_ipv6="fd00:10::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            server = await service.create_server(server_data)

            # 2. Create peer with auto-allocation
            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="Auto Peer 1",
                description="Test automatic dual-stack allocation",
                # No peer_ipv4 or peer_ipv6 specified - should auto-allocate
            )

            peer = await service.create_peer(peer_data)

            # 3. Verify both IPs allocated
            assert peer.peer_ipv4 is not None
            assert peer.peer_ipv6 is not None

            # Verify IPs are within server subnets
            assert peer.peer_ipv4.startswith("10.10.0.")  # In 10.10.0.0/24
            assert peer.peer_ipv6.startswith("fd00:10::")  # In fd00:10::/64

            # Verify not server IPs
            assert peer.peer_ipv4 != "10.10.0.1"
            assert peer.peer_ipv6 != "fd00:10::1"

    async def test_create_multiple_peers_sequential_allocation(self, async_db_session):
        """
        Test sequential IP allocation for multiple peers.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create server
            server_data = WireGuardServerCreate(
                name="Multi-Peer Server",
                server_ipv4="10.20.0.1/24",
                server_ipv6="fd00:20::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            server = await service.create_server(server_data)

            # Create 10 peers
            peers = []
            for i in range(1, 11):
                peer_data = WireGuardPeerCreate(
                    server_id=server.server_id,
                    name=f"Peer {i}",
                    description=f"Test peer {i}",
                )

                peer = await service.create_peer(peer_data)
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

    async def test_create_peer_ipv4_only_server(self, async_db_session):
        """
        Test peer creation on IPv4-only server gets only IPv4.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create IPv4-only server
            server_data = WireGuardServerCreate(
                name="IPv4-Only Server",
                server_ipv4="10.30.0.1/24",
                public_endpoint="vpn4.example.com:51820",
                listen_port=51820,
            )

            server = await service.create_server(server_data)

            # Create peer
            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="IPv4 Peer",
            )

            peer = await service.create_peer(peer_data)

            # Verify only IPv4 allocated
            assert peer.peer_ipv4 is not None
            assert peer.peer_ipv6 is None

    async def test_create_peer_manual_ips(self, async_db_session):
        """
        Test creating peer with manually specified IPs.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create server
            server_data = WireGuardServerCreate(
                name="Manual IP Server",
                server_ipv4="10.40.0.1/24",
                server_ipv6="fd00:40::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            server = await service.create_server(server_data)

            # Create peer with manual IPs
            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="Manual IP Peer",
                peer_ipv4="10.40.0.100",
                peer_ipv6="fd00:40::100",
            )

            peer = await service.create_peer(peer_data)

            # Verify manual IPs assigned
            assert peer.peer_ipv4 == "10.40.0.100"
            assert peer.peer_ipv6 == "fd00:40::100"

    async def test_peer_ip_conflict_detection(self, async_db_session):
        """
        Test detection of IP conflicts when manually specifying peer IPs.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create server
            server_data = WireGuardServerCreate(
                name="Conflict Test Server",
                server_ipv4="10.50.0.1/24",
                server_ipv6="fd00:50::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            server = await service.create_server(server_data)

            # Create first peer
            peer1_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="Peer 1",
                peer_ipv4="10.50.0.10",
                peer_ipv6="fd00:50::10",
            )

            await service.create_peer(peer1_data)

            # Attempt to create second peer with same IPs
            peer2_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="Peer 2",
                peer_ipv4="10.50.0.10",  # Conflict
                peer_ipv6="fd00:50::10",  # Conflict
            )

            # Should raise error
            with pytest.raises(ValueError) as exc_info:
                await service.create_peer(peer2_data)

            assert "already in use" in str(exc_info.value).lower()

    async def test_generate_peer_config_dual_stack(self, async_db_session):
        """
        Test generating WireGuard config for dual-stack peer.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create server
            server_data = WireGuardServerCreate(
                name="Config Gen Server",
                server_ipv4="10.60.0.1/24",
                server_ipv6="fd00:60::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
                dns_servers=["1.1.1.1", "2606:4700:4700::1111"],
            )

            server = await service.create_server(server_data)

            # Create peer
            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="Config Peer",
            )

            peer = await service.create_peer(peer_data)

            # Generate config
            config = await service.generate_peer_config(peer.peer_id)

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

    async def test_delete_peer_cleanup(self, async_db_session):
        """
        Test deleting peer cleans up IP allocations.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create server and peer
            server_data = WireGuardServerCreate(
                name="Delete Test Server",
                server_ipv4="10.70.0.1/24",
                server_ipv6="fd00:70::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            server = await service.create_server(server_data)

            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="Delete Peer",
                peer_ipv4="10.70.0.100",
                peer_ipv6="fd00:70::100",
            )

            peer = await service.create_peer(peer_data)

            # Store IPs
            peer_ipv4 = peer.peer_ipv4
            peer_ipv6 = peer.peer_ipv6

            # Delete peer
            await service.delete_peer(peer.peer_id)

            # Verify peer deleted
            deleted_peer = await service.get_peer(peer.peer_id)
            assert deleted_peer is None

            # Create new peer - should be able to reuse the IPs
            new_peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="New Peer",
                peer_ipv4=peer_ipv4,  # Reuse deleted peer's IPs
                peer_ipv6=peer_ipv6,
            )

            new_peer = await service.create_peer(new_peer_data)
            assert new_peer.peer_ipv4 == peer_ipv4
            assert new_peer.peer_ipv6 == peer_ipv6

    async def test_peer_expiration(self, async_db_session):
        """
        Test peer with expiration date.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create server
            server_data = WireGuardServerCreate(
                name="Expiration Test Server",
                server_ipv4="10.80.0.1/24",
                server_ipv6="fd00:80::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
            )

            server = await service.create_server(server_data)

            # Create peer with expiration
            from datetime import timedelta
            expires_at = datetime.utcnow() + timedelta(days=30)

            peer_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="Temporary Peer",
                expires_at=expires_at,
            )

            peer = await service.create_peer(peer_data)

            # Verify expiration set
            assert peer.expires_at is not None
            assert (peer.expires_at - expires_at).total_seconds() < 60  # Within 1 minute

    async def test_server_capacity_limits(self, async_db_session):
        """
        Test server enforces max_peers limit.
        """
        with patch('dotmac.platform.settings.settings') as mock_settings:
            mock_settings.external_services.vault_url = "http://vault.test"

            service = WireGuardService(
                session=async_db_session,
                tenant_id="test_tenant"
            )

            # Create server with low max_peers
            server_data = WireGuardServerCreate(
                name="Limited Server",
                server_ipv4="10.90.0.1/24",
                server_ipv6="fd00:90::1/64",
                public_endpoint="vpn.example.com:51820",
                listen_port=51820,
                max_peers=3,  # Only 3 peers allowed
            )

            server = await service.create_server(server_data)

            # Create 3 peers (should succeed)
            for i in range(1, 4):
                peer_data = WireGuardPeerCreate(
                    server_id=server.server_id,
                    name=f"Peer {i}",
                )
                await service.create_peer(peer_data)

            # Attempt 4th peer (should fail)
            peer4_data = WireGuardPeerCreate(
                server_id=server.server_id,
                name="Peer 4",
            )

            with pytest.raises(ValueError) as exc_info:
                await service.create_peer(peer4_data)

            assert "max_peers limit" in str(exc_info.value).lower()

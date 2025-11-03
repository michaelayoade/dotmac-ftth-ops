"""
Tests for WireGuard Service with IPv6 Support

Test dual-stack VPN server and peer management.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.wireguard.models import WireGuardServerStatus
from dotmac.platform.wireguard.service import WireGuardService

pytestmark = pytest.mark.unit


@pytest.fixture
def mock_session():
    """Mock database session"""
    session = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def mock_client():
    """Mock WireGuard client"""
    client = AsyncMock()
    client.generate_keypair = AsyncMock(return_value=("private_key_test", "public_key_test"))
    client.allocate_peer_ip = AsyncMock()
    client.generate_peer_config = AsyncMock(return_value="[Interface]\nPrivateKey = test")
    client.health_check = AsyncMock(return_value={"healthy": True})
    return client


@pytest.fixture
def wireguard_service(mock_session, mock_client):
    """Create WireGuard service with mocked dependencies"""
    tenant_id = uuid4()
    return WireGuardService(
        session=mock_session,
        client=mock_client,
        tenant_id=tenant_id,
        encryption_service=None,
        vault_client=None,
    )


class TestWireGuardServerDualStack:
    """Test WireGuard server creation with dual-stack support."""

    @pytest.mark.asyncio
    async def test_create_server_dual_stack(self, wireguard_service, mock_session):
        """Test creating dual-stack WireGuard server."""
        with patch("dotmac.platform.wireguard.service.WireGuardServer") as MockServer:
            mock_server_instance = MagicMock()
            mock_server_instance.id = uuid4()
            MockServer.return_value = mock_server_instance

            await wireguard_service.create_server(
                name="Test VPN Server",
                public_endpoint="vpn.example.com:51820",
                server_ipv4="10.8.0.1/24",
                server_ipv6="fd00:8::1/64",
                listen_port=51820,
                description="Test dual-stack VPN",
            )

            # Verify server was created with correct parameters
            call_kwargs = MockServer.call_args.kwargs
            assert call_kwargs["server_ipv4"] == "10.8.0.1/24"
            assert call_kwargs["server_ipv6"] == "fd00:8::1/64"
            assert call_kwargs["status"] == WireGuardServerStatus.ACTIVE
            assert mock_session.add.called
            assert mock_session.commit.called

    @pytest.mark.asyncio
    async def test_create_server_ipv4_only(self, wireguard_service, mock_session):
        """Test creating IPv4-only server (backward compatibility)."""
        with patch("dotmac.platform.wireguard.service.WireGuardServer") as MockServer:
            mock_server_instance = MagicMock()
            MockServer.return_value = mock_server_instance

            await wireguard_service.create_server(
                name="IPv4 VPN Server",
                public_endpoint="vpn.example.com:51820",
                server_ipv4="10.9.0.1/24",
                listen_port=51820,
            )

            call_kwargs = MockServer.call_args.kwargs
            assert call_kwargs["server_ipv4"] == "10.9.0.1/24"
            assert call_kwargs["server_ipv6"] is None

    @pytest.mark.asyncio
    async def test_create_server_with_dual_stack_default_routes(
        self, wireguard_service, mock_session
    ):
        """Test that dual-stack server includes both IPv4 and IPv6 default routes."""
        with patch("dotmac.platform.wireguard.service.WireGuardServer") as MockServer:
            mock_server_instance = MagicMock()
            MockServer.return_value = mock_server_instance

            await wireguard_service.create_server(
                name="Full Tunnel VPN",
                public_endpoint="vpn.example.com:51820",
                server_ipv4="10.8.0.1/24",
                server_ipv6="fd00:8::1/64",
            )

            call_kwargs = MockServer.call_args.kwargs
            assert "0.0.0.0/0" in call_kwargs["allowed_ips"]
            assert "::/0" in call_kwargs["allowed_ips"]


class TestWireGuardPeerDualStack:
    """Test WireGuard peer creation with dual-stack support."""

    @pytest.mark.asyncio
    async def test_create_peer_dual_stack_auto_allocate(
        self, wireguard_service, mock_session, mock_client
    ):
        """Test creating peer with automatic dual-stack IP allocation."""
        with (
            patch("dotmac.platform.wireguard.service.WireGuardPeer") as MockPeer,
            patch("dotmac.platform.wireguard.service.select") as mock_select,
        ):
            server_id = uuid4()

            # Mock server with dual-stack
            mock_server = MagicMock()
            mock_server.id = server_id
            mock_server.server_ipv4 = "10.8.0.1/24"
            mock_server.server_ipv6 = "fd00:8::1/64"
            mock_server.public_key = "server_public_key"
            mock_server.public_endpoint = "vpn.example.com:51820"
            mock_server.dns_servers = ["1.1.1.1", "1.0.0.1"]
            mock_server.allowed_ips = ["0.0.0.0/0", "::/0"]
            mock_server.has_capacity = True
            mock_server.current_peers = 0

            wireguard_service.get_server = AsyncMock(return_value=mock_server)

            # Mock select() to return a mock query
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query

            # Mock database query results
            mock_ipv4_result = MagicMock()
            mock_ipv4_result.all.return_value = []
            mock_ipv6_result = MagicMock()
            mock_ipv6_result.all.return_value = []
            mock_session.execute.side_effect = [mock_ipv4_result, mock_ipv6_result]

            # Mock IP allocation
            mock_client.allocate_peer_ip.side_effect = ["10.8.0.2/32", "fd00:8::2/128"]

            # Mock peer instance
            mock_peer_instance = MagicMock()
            mock_peer_instance.id = uuid4()
            mock_peer_instance.allowed_ips = ["0.0.0.0/0", "::/0"]
            MockPeer.return_value = mock_peer_instance

            await wireguard_service.create_peer(
                server_id=server_id,
                name="Test Peer",
                description="Dual-stack test peer",
            )

            # Verify both IPs were allocated
            assert mock_client.allocate_peer_ip.call_count == 2

            # Verify peer was created with both IPs
            call_kwargs = MockPeer.call_args.kwargs
            assert call_kwargs["peer_ipv4"] == "10.8.0.2/32"
            assert call_kwargs["peer_ipv6"] == "fd00:8::2/128"

    @pytest.mark.asyncio
    async def test_create_peer_ipv4_only_server(self, wireguard_service, mock_session, mock_client):
        """Test creating peer on IPv4-only server."""
        with (
            patch("dotmac.platform.wireguard.service.WireGuardPeer") as MockPeer,
            patch("dotmac.platform.wireguard.service.select") as mock_select,
        ):
            server_id = uuid4()

            # Mock IPv4-only server
            mock_server = MagicMock()
            mock_server.id = server_id
            mock_server.server_ipv4 = "10.9.0.1/24"
            mock_server.server_ipv6 = None
            mock_server.public_key = "server_public_key"
            mock_server.public_endpoint = "vpn.example.com:51820"
            mock_server.dns_servers = ["1.1.1.1"]
            mock_server.allowed_ips = ["0.0.0.0/0"]
            mock_server.has_capacity = True
            mock_server.current_peers = 0

            wireguard_service.get_server = AsyncMock(return_value=mock_server)

            # Mock select() to return a mock query
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query

            # Mock database query
            mock_ipv4_result = MagicMock()
            mock_ipv4_result.all.return_value = []
            mock_session.execute.return_value = mock_ipv4_result

            # Mock IPv4 allocation only
            mock_client.allocate_peer_ip.return_value = "10.9.0.2/32"

            mock_peer_instance = MagicMock()
            MockPeer.return_value = mock_peer_instance

            await wireguard_service.create_peer(
                server_id=server_id,
                name="IPv4 Only Peer",
            )

            # Verify only IPv4 allocated
            assert mock_client.allocate_peer_ip.call_count == 1

            # Verify peer created with only IPv4
            call_kwargs = MockPeer.call_args.kwargs
            assert call_kwargs["peer_ipv4"] == "10.9.0.2/32"
            assert call_kwargs["peer_ipv6"] is None

    @pytest.mark.asyncio
    async def test_create_peer_with_static_dual_stack_ips(
        self, wireguard_service, mock_session, mock_client
    ):
        """Test creating peer with static dual-stack IPs."""
        with (
            patch("dotmac.platform.wireguard.service.WireGuardPeer") as MockPeer,
            patch("dotmac.platform.wireguard.service.select") as mock_select,
        ):
            server_id = uuid4()

            mock_server = MagicMock()
            mock_server.id = server_id
            mock_server.server_ipv4 = "10.8.0.1/24"
            mock_server.server_ipv6 = "fd00:8::1/64"
            mock_server.public_key = "server_public_key"
            mock_server.public_endpoint = "vpn.example.com:51820"
            mock_server.dns_servers = ["1.1.1.1"]
            mock_server.allowed_ips = ["0.0.0.0/0", "::/0"]
            mock_server.has_capacity = True
            mock_server.current_peers = 0

            wireguard_service.get_server = AsyncMock(return_value=mock_server)

            # Mock select to avoid building real SQLAlchemy queries with patched model
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query

            existing_ipv4_result = MagicMock()
            existing_ipv4_result.first.return_value = None
            existing_ipv6_result = MagicMock()
            existing_ipv6_result.first.return_value = None
            mock_session.execute.side_effect = [existing_ipv4_result, existing_ipv6_result]

            mock_peer_instance = MagicMock()
            MockPeer.return_value = mock_peer_instance

            await wireguard_service.create_peer(
                server_id=server_id,
                name="Static IP Peer",
                peer_ipv4="10.8.0.100/32",
                peer_ipv6="fd00:8::100/128",
            )

            # Verify no IP allocation was needed
            mock_client.allocate_peer_ip.assert_not_called()

            # Verify static IPs used
            call_kwargs = MockPeer.call_args.kwargs
            assert call_kwargs["peer_ipv4"] == "10.8.0.100/32"
            assert call_kwargs["peer_ipv6"] == "fd00:8::100/128"

    @pytest.mark.asyncio
    async def test_peer_config_includes_both_ips(
        self, wireguard_service, mock_session, mock_client
    ):
        """Test that peer config includes both IPv4 and IPv6 addresses."""
        with (
            patch("dotmac.platform.wireguard.service.WireGuardPeer") as MockPeer,
            patch("dotmac.platform.wireguard.service.select") as mock_select,
        ):
            server_id = uuid4()

            mock_server = MagicMock()
            mock_server.id = server_id
            mock_server.server_ipv4 = "10.8.0.1/24"
            mock_server.server_ipv6 = "fd00:8::1/64"
            mock_server.public_key = "server_public_key"
            mock_server.public_endpoint = "vpn.example.com:51820"
            mock_server.dns_servers = ["1.1.1.1"]
            mock_server.allowed_ips = ["0.0.0.0/0", "::/0"]
            mock_server.has_capacity = True
            mock_server.current_peers = 0

            wireguard_service.get_server = AsyncMock(return_value=mock_server)

            # Mock select() to return a mock query
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query

            # Mock database queries
            mock_ipv4_result = MagicMock()
            mock_ipv4_result.all.return_value = []
            mock_ipv6_result = MagicMock()
            mock_ipv6_result.all.return_value = []
            mock_session.execute.side_effect = [mock_ipv4_result, mock_ipv6_result]

            mock_client.allocate_peer_ip.side_effect = ["10.8.0.2/32", "fd00:8::2/128"]

            mock_peer_instance = MagicMock()
            mock_peer_instance.allowed_ips = ["0.0.0.0/0", "::/0"]
            MockPeer.return_value = mock_peer_instance

            await wireguard_service.create_peer(
                server_id=server_id,
                name="Config Test Peer",
            )

            # Verify config was generated with dual-stack addresses
            mock_client.generate_peer_config.assert_called_once()
            call_kwargs = mock_client.generate_peer_config.call_args.kwargs
            assert call_kwargs["peer_address"] == "10.8.0.2/32, fd00:8::2/128"


class TestWireGuardPeerConfigRegeneration:
    """Test peer config regeneration with IPv6."""

    @pytest.mark.asyncio
    async def test_regenerate_config_dual_stack(self, wireguard_service, mock_session, mock_client):
        """Test regenerating config for dual-stack peer."""
        peer_id = uuid4()
        server_id = uuid4()

        # Mock peer with dual-stack
        mock_peer = MagicMock()
        mock_peer.id = peer_id
        mock_peer.server_id = server_id
        mock_peer.peer_ipv4 = "10.8.0.50/32"
        mock_peer.peer_ipv6 = "fd00:8::50/128"
        mock_peer.allowed_ips = ["0.0.0.0/0", "::/0"]

        # Mock server
        mock_server = MagicMock()
        mock_server.id = server_id
        mock_server.public_key = "server_public_key_new"
        mock_server.public_endpoint = "vpn.example.com:51820"
        mock_server.dns_servers = ["1.1.1.1"]

        wireguard_service.get_peer = AsyncMock(return_value=mock_peer)
        wireguard_service.get_server = AsyncMock(return_value=mock_server)

        # Regenerate config
        await wireguard_service.regenerate_peer_config(peer_id)

        # Verify new config generated with both IPs
        mock_client.generate_peer_config.assert_called_once()
        call_kwargs = mock_client.generate_peer_config.call_args.kwargs
        assert call_kwargs["peer_address"] == "10.8.0.50/32, fd00:8::50/128"

    @pytest.mark.asyncio
    async def test_regenerate_config_ipv4_only(self, wireguard_service, mock_session, mock_client):
        """Test regenerating config for IPv4-only peer."""
        peer_id = uuid4()
        server_id = uuid4()

        # Mock IPv4-only peer
        mock_peer = MagicMock()
        mock_peer.id = peer_id
        mock_peer.server_id = server_id
        mock_peer.peer_ipv4 = "10.9.0.50/32"
        mock_peer.peer_ipv6 = None
        mock_peer.allowed_ips = ["0.0.0.0/0"]

        mock_server = MagicMock()
        mock_server.id = server_id
        mock_server.public_key = "server_public_key"
        mock_server.public_endpoint = "vpn.example.com:51820"
        mock_server.dns_servers = ["1.1.1.1"]

        wireguard_service.get_peer = AsyncMock(return_value=mock_peer)
        wireguard_service.get_server = AsyncMock(return_value=mock_server)

        # Regenerate config
        await wireguard_service.regenerate_peer_config(peer_id)

        # Verify config generated with only IPv4
        call_kwargs = mock_client.generate_peer_config.call_args.kwargs
        assert call_kwargs["peer_address"] == "10.9.0.50/32"


class TestWireGuardIPAllocationEdgeCases:
    """Test edge cases in IP allocation."""

    @pytest.mark.asyncio
    async def test_ipv6_allocation_avoids_used_ips(
        self, wireguard_service, mock_session, mock_client
    ):
        """Test that IPv6 allocation avoids already-used addresses."""
        with (
            patch("dotmac.platform.wireguard.service.WireGuardPeer") as MockPeer,
            patch("dotmac.platform.wireguard.service.select") as mock_select,
        ):
            server_id = uuid4()

            mock_server = MagicMock()
            mock_server.id = server_id
            mock_server.server_ipv4 = "10.8.0.1/24"
            mock_server.server_ipv6 = "fd00:8::1/64"
            mock_server.public_key = "server_public_key"
            mock_server.public_endpoint = "vpn.example.com:51820"
            mock_server.dns_servers = ["1.1.1.1"]
            mock_server.allowed_ips = ["0.0.0.0/0", "::/0"]
            mock_server.has_capacity = True
            mock_server.current_peers = 10

            wireguard_service.get_server = AsyncMock(return_value=mock_server)

            # Mock select() to return a mock query
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query

            # Mock existing addresses
            mock_ipv4_result = MagicMock()
            mock_ipv4_result.all.return_value = [("10.8.0.2/32",), ("10.8.0.3/32",)]

            mock_ipv6_result = MagicMock()
            mock_ipv6_result.all.return_value = [
                ("fd00:8::2/128",),
                ("fd00:8::3/128",),
                ("fd00:8::4/128",),
            ]

            mock_session.execute.side_effect = [mock_ipv4_result, mock_ipv6_result]

            mock_client.allocate_peer_ip.side_effect = ["10.8.0.4/32", "fd00:8::5/128"]

            mock_peer_instance = MagicMock()
            mock_peer_instance.allowed_ips = ["0.0.0.0/0", "::/0"]
            MockPeer.return_value = mock_peer_instance

            await wireguard_service.create_peer(
                server_id=server_id,
                name="Allocation Test Peer",
            )

            # Verify IPv6 allocation was called with used IPs
            ipv6_call = mock_client.allocate_peer_ip.call_args_list[1]
            used_ipv6s = ipv6_call[0][1]
            assert "fd00:8::2/128" in used_ipv6s
            assert "fd00:8::3/128" in used_ipv6s
            assert "fd00:8::4/128" in used_ipv6s
            assert "fd00:8::1/64" in used_ipv6s  # Server IP included

    @pytest.mark.asyncio
    async def test_create_peer_partial_ipv6_input(
        self, wireguard_service, mock_session, mock_client
    ):
        """Test creating peer with only IPv4 provided on dual-stack server."""
        with (
            patch("dotmac.platform.wireguard.service.WireGuardPeer") as MockPeer,
            patch("dotmac.platform.wireguard.service.select") as mock_select,
        ):
            server_id = uuid4()

            mock_server = MagicMock()
            mock_server.id = server_id
            mock_server.server_ipv4 = "10.8.0.1/24"
            mock_server.server_ipv6 = "fd00:8::1/64"
            mock_server.public_key = "server_public_key"
            mock_server.public_endpoint = "vpn.example.com:51820"
            mock_server.dns_servers = ["1.1.1.1"]
            mock_server.allowed_ips = ["0.0.0.0/0", "::/0"]
            mock_server.has_capacity = True
            mock_server.current_peers = 0

            wireguard_service.get_server = AsyncMock(return_value=mock_server)

            # Mock select() to return a mock query
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query

            existing_ipv4_result = MagicMock()
            existing_ipv4_result.first.return_value = None
            # Mock database query
            mock_ipv6_result = MagicMock()
            mock_ipv6_result.all.return_value = []
            mock_session.execute.side_effect = [existing_ipv4_result, mock_ipv6_result]

            # Mock IPv6 allocation (IPv4 already provided)
            mock_client.allocate_peer_ip.return_value = "fd00:8::2/128"

            mock_peer_instance = MagicMock()
            mock_peer_instance.allowed_ips = ["0.0.0.0/0", "::/0"]
            MockPeer.return_value = mock_peer_instance

            await wireguard_service.create_peer(
                server_id=server_id,
                name="Partial Input Peer",
                peer_ipv4="10.8.0.100/32",  # IPv4 provided
                # peer_ipv6 not provided, should auto-allocate
            )

            # Verify IPv6 was auto-allocated
            mock_client.allocate_peer_ip.assert_called_once()

            # Verify both IPs assigned
            call_kwargs = MockPeer.call_args.kwargs
            assert call_kwargs["peer_ipv4"] == "10.8.0.100/32"
            assert call_kwargs["peer_ipv6"] == "fd00:8::2/128"

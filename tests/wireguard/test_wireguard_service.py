"""
Comprehensive WireGuard Service Tests.

Tests the WireGuard service layer including:
- Server management (create, get, list, update, delete)
- Peer management (create, get, list, update, delete)
- Config generation and retrieval
- Statistics syncing
- Health checks
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, call
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.wireguard.client import WireGuardClient, WireGuardStats
from dotmac.platform.wireguard.models import (
    WireGuardPeer,
    WireGuardPeerStatus,
    WireGuardServer,
    WireGuardServerStatus,
)
from dotmac.platform.wireguard.service import WireGuardService, WireGuardServiceError


@pytest.fixture
def tenant_id():
    """Test tenant ID."""
    return uuid4()


@pytest.fixture
def mock_session():
    """Create mock database session."""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.rollback = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def mock_wireguard_client():
    """Create mock WireGuard client."""
    client = AsyncMock(spec=WireGuardClient)

    # Mock keypair generation
    async def mock_generate_keypair():
        return "priv_key_" + str(uuid4())[:8], "pub_key_" + str(uuid4())[:8]

    client.generate_keypair = AsyncMock(side_effect=mock_generate_keypair)

    # Mock IP allocation
    async def mock_allocate_ip(server_ip, used_ips):
        # Simple mock: allocate next IP
        return "10.8.0.100/32"

    client.allocate_peer_ip = AsyncMock(side_effect=mock_allocate_ip)

    # Mock config generation
    async def mock_generate_config(**kwargs):
        return "[Interface]\nPrivateKey = test\n"

    client.generate_peer_config = AsyncMock(side_effect=mock_generate_config)

    # Mock health check
    async def mock_health_check():
        return {"healthy": True, "version": "1.0.0"}

    client.health_check = AsyncMock(side_effect=mock_health_check)

    # Mock stats
    async def mock_get_stats():
        return []

    client.get_peer_stats = AsyncMock(side_effect=mock_get_stats)

    return client


@pytest.fixture
def wireguard_service(mock_session, mock_wireguard_client, tenant_id):
    """Create WireGuard service instance."""
    return WireGuardService(
        session=mock_session,
        client=mock_wireguard_client,
        tenant_id=tenant_id,
    )


@pytest.mark.asyncio
class TestWireGuardServerManagement:
    """Test WireGuard server management operations."""

    async def test_create_server_success(self, wireguard_service, mock_session):
        """Test creating a WireGuard server."""
        result = await wireguard_service.create_server(
            name="Test VPN Server",
            public_endpoint="vpn.example.com:51820",
            server_ipv4="10.8.0.1/24",
            description="Test server",
            location="US-East-1",
            max_peers=500,
        )

        # Verify session interactions
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once()

        # Verify server was created
        added_server = mock_session.add.call_args[0][0]
        assert isinstance(added_server, WireGuardServer)
        assert added_server.name == "Test VPN Server"
        assert added_server.public_endpoint == "vpn.example.com:51820"
        assert added_server.server_ipv4 == "10.8.0.1/24"
        assert added_server.location == "US-East-1"
        assert added_server.max_peers == 500
        assert added_server.status == WireGuardServerStatus.ACTIVE

    async def test_create_server_with_defaults(self, wireguard_service, mock_session):
        """Test creating server with default values."""
        await wireguard_service.create_server(
            name="Default Server",
            public_endpoint="vpn.test.com:51820",
            server_ipv4="10.9.0.1/24",
        )

        added_server = mock_session.add.call_args[0][0]
        assert added_server.listen_port == 51820  # Default port
        assert added_server.max_peers == 1000  # Default max peers
        assert added_server.dns_servers == ["1.1.1.1", "1.0.0.1"]  # Default DNS
        assert added_server.allowed_ips == ["0.0.0.0/0", "::/0"]  # Default allowed IPs

    async def test_create_server_generates_keys(self, wireguard_service, mock_wireguard_client):
        """Test that server creation generates keypair."""
        await wireguard_service.create_server(
            name="Key Test Server",
            public_endpoint="vpn.test.com:51820",
            server_ipv4="10.8.0.1/24",
        )

        mock_wireguard_client.generate_keypair.assert_called_once()

    async def test_create_server_rollback_on_error(
        self, wireguard_service, mock_session, mock_wireguard_client
    ):
        """Test that errors trigger rollback."""
        mock_session.commit.side_effect = Exception("Database error")

        with pytest.raises(WireGuardServiceError, match="Failed to create server"):
            await wireguard_service.create_server(
                name="Error Server",
                public_endpoint="vpn.test.com:51820",
                server_ipv4="10.8.0.1/24",
            )

        mock_session.rollback.assert_called_once()

    async def test_get_server_found(self, wireguard_service, mock_session, tenant_id):
        """Test getting an existing server."""
        server_id = uuid4()
        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Test Server",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="test_pub_key",
            private_key_encrypted="test_priv_key",
            status=WireGuardServerStatus.ACTIVE,
        )

        # Mock query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        result = await wireguard_service.get_server(server_id)

        assert result == mock_server
        mock_session.execute.assert_called_once()

    async def test_get_server_not_found(self, wireguard_service, mock_session):
        """Test getting non-existent server."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        result = await wireguard_service.get_server(uuid4())

        assert result is None

    async def test_list_servers(self, wireguard_service, mock_session):
        """Test listing servers."""
        mock_servers = [MagicMock(spec=WireGuardServer) for _ in range(3)]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_servers
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute.return_value = mock_result

        result = await wireguard_service.list_servers()

        assert len(result) == 3
        mock_session.execute.assert_called_once()

    async def test_list_servers_with_filters(self, wireguard_service, mock_session):
        """Test listing servers with status and location filters."""
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute.return_value = mock_result

        await wireguard_service.list_servers(
            status=WireGuardServerStatus.ACTIVE,
            location="US-East-1",
            limit=50,
            offset=10,
        )

        mock_session.execute.assert_called_once()

    async def test_update_server_success(self, wireguard_service, mock_session, tenant_id):
        """Test updating server attributes."""
        server_id = uuid4()
        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Old Name",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="test_key",
            private_key_encrypted="encrypted",
            status=WireGuardServerStatus.ACTIVE,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        updated = await wireguard_service.update_server(
            server_id,
            name="New Name",
            description="Updated description",
            max_peers=2000,
        )

        assert mock_server.name == "New Name"
        assert mock_server.description == "Updated description"
        assert mock_server.max_peers == 2000
        mock_session.commit.assert_called_once()

    async def test_update_server_not_found(self, wireguard_service, mock_session):
        """Test updating non-existent server."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        with pytest.raises(WireGuardServiceError, match="not found"):
            await wireguard_service.update_server(uuid4(), name="New Name")

    async def test_delete_server_success(self, wireguard_service, mock_session, tenant_id):
        """Test soft deleting a server."""
        server_id = uuid4()
        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Test Server",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="test_key",
            private_key_encrypted="encrypted",
            status=WireGuardServerStatus.ACTIVE,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        await wireguard_service.delete_server(server_id)

        assert mock_server.deleted_at is not None
        assert mock_server.status == WireGuardServerStatus.INACTIVE
        mock_session.commit.assert_called_once()

    async def test_delete_server_not_found(self, wireguard_service, mock_session):
        """Test deleting non-existent server."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        with pytest.raises(WireGuardServiceError, match="not found"):
            await wireguard_service.delete_server(uuid4())


@pytest.mark.asyncio
class TestWireGuardPeerManagement:
    """Test WireGuard peer management operations."""

    async def test_create_peer_success(self, wireguard_service, mock_session, tenant_id):
        """Test creating a WireGuard peer."""
        server_id = uuid4()
        customer_id = uuid4()

        # Mock server with capacity
        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Test Server",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="server_pub_key",
            private_key_encrypted="encrypted",
            status=WireGuardServerStatus.ACTIVE,
            max_peers=1000,
            current_peers=10,
            dns_servers=["1.1.1.1"],
            allowed_ips=["0.0.0.0/0"],
        )

        # Mock get_server
        mock_get_result = MagicMock()
        mock_get_result.scalar_one_or_none.return_value = mock_server

        # Mock used IPs query
        mock_ips_result = MagicMock()
        mock_ips_result.all.return_value = []

        mock_session.execute.side_effect = [mock_get_result, mock_ips_result]

        result = await wireguard_service.create_peer(
            server_id=server_id,
            name="Test Peer",
            customer_id=customer_id,
            description="Test peer connection",
        )

        # Verify peer was added
        mock_session.add.assert_called_once()
        added_peer = mock_session.add.call_args[0][0]
        assert isinstance(added_peer, WireGuardPeer)
        assert added_peer.name == "Test Peer"
        assert added_peer.customer_id == customer_id
        assert added_peer.server_id == server_id
        assert added_peer.status == WireGuardPeerStatus.ACTIVE

        # Verify server peer count increased
        assert mock_server.current_peers == 11

    async def test_create_peer_server_not_found(self, wireguard_service, mock_session):
        """Test creating peer with non-existent server."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        with pytest.raises(WireGuardServiceError, match="not found"):
            await wireguard_service.create_peer(
                server_id=uuid4(),
                name="Test Peer",
            )

    async def test_create_peer_server_at_capacity(self, wireguard_service, mock_session, tenant_id):
        """Test creating peer when server is at capacity."""
        server_id = uuid4()

        # Mock server at capacity
        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Full Server",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="server_pub_key",
            private_key_encrypted="encrypted",
            status=WireGuardServerStatus.ACTIVE,
            max_peers=100,
            current_peers=100,  # At capacity
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        with pytest.raises(WireGuardServiceError, match="at capacity"):
            await wireguard_service.create_peer(
                server_id=server_id,
                name="Test Peer",
            )

    async def test_create_peer_with_provided_key(
        self, wireguard_service, mock_session, mock_wireguard_client, tenant_id
    ):
        """Test creating peer with provided public key."""
        server_id = uuid4()
        provided_public_key = "user_provided_pub_key"

        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Test Server",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="server_pub_key",
            private_key_encrypted="encrypted",
            status=WireGuardServerStatus.ACTIVE,
            max_peers=1000,
            current_peers=0,
            dns_servers=["1.1.1.1"],
            allowed_ips=["0.0.0.0/0"],
        )

        mock_get_result = MagicMock()
        mock_get_result.scalar_one_or_none.return_value = mock_server
        mock_ips_result = MagicMock()
        mock_ips_result.all.return_value = []
        mock_session.execute.side_effect = [mock_get_result, mock_ips_result]

        await wireguard_service.create_peer(
            server_id=server_id,
            name="Custom Key Peer",
            generate_keys=False,
            public_key=provided_public_key,
        )

        # Verify keypair was not generated
        mock_wireguard_client.generate_keypair.assert_not_called()

        # Verify provided key was used
        added_peer = mock_session.add.call_args[0][0]
        assert added_peer.public_key == provided_public_key

    async def test_get_peer_found(self, wireguard_service, mock_session, tenant_id):
        """Test getting an existing peer."""
        peer_id = uuid4()
        mock_peer = WireGuardPeer(
            id=peer_id,
            tenant_id=tenant_id,
            server_id=uuid4(),
            name="Test Peer",
            public_key="peer_pub_key",
            peer_ipv4="10.8.0.2/32",
            status=WireGuardPeerStatus.ACTIVE,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_peer
        mock_session.execute.return_value = mock_result

        result = await wireguard_service.get_peer(peer_id)

        assert result == mock_peer

    async def test_list_peers_with_filters(self, wireguard_service, mock_session):
        """Test listing peers with various filters."""
        server_id = uuid4()
        customer_id = uuid4()

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute.return_value = mock_result

        await wireguard_service.list_peers(
            server_id=server_id,
            customer_id=customer_id,
            status=WireGuardPeerStatus.ACTIVE,
            limit=25,
            offset=5,
        )

        mock_session.execute.assert_called_once()

    async def test_update_peer_success(self, wireguard_service, mock_session, tenant_id):
        """Test updating peer attributes."""
        peer_id = uuid4()
        mock_peer = WireGuardPeer(
            id=peer_id,
            tenant_id=tenant_id,
            server_id=uuid4(),
            name="Old Name",
            public_key="peer_key",
            peer_ipv4="10.8.0.2/32",
            status=WireGuardPeerStatus.ACTIVE,
            enabled=True,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_peer
        mock_session.execute.return_value = mock_result

        await wireguard_service.update_peer(
            peer_id,
            name="New Name",
            description="Updated",
            enabled=False,
        )

        assert mock_peer.name == "New Name"
        assert mock_peer.description == "Updated"
        assert mock_peer.enabled is False
        mock_session.commit.assert_called_once()

    async def test_delete_peer_success(self, wireguard_service, mock_session, tenant_id):
        """Test soft deleting a peer and updating server count."""
        peer_id = uuid4()
        server_id = uuid4()

        mock_peer = WireGuardPeer(
            id=peer_id,
            tenant_id=tenant_id,
            server_id=server_id,
            name="Test Peer",
            public_key="peer_key",
            peer_ipv4="10.8.0.2/32",
            status=WireGuardPeerStatus.ACTIVE,
        )

        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Test Server",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="server_key",
            private_key_encrypted="encrypted",
            status=WireGuardServerStatus.ACTIVE,
            current_peers=5,
        )

        # Mock get_peer and get_server
        mock_peer_result = MagicMock()
        mock_peer_result.scalar_one_or_none.return_value = mock_peer

        mock_server_result = MagicMock()
        mock_server_result.scalar_one_or_none.return_value = mock_server

        mock_session.execute.side_effect = [mock_peer_result, mock_server_result]

        await wireguard_service.delete_peer(peer_id)

        assert mock_peer.deleted_at is not None
        assert mock_peer.status == WireGuardPeerStatus.DISABLED
        assert mock_server.current_peers == 4  # Decremented
        mock_session.commit.assert_called_once()

    async def test_get_peer_config_success(self, wireguard_service, mock_session, tenant_id):
        """Test retrieving peer configuration."""
        peer_id = uuid4()
        config_content = "[Interface]\nPrivateKey = test_key\n"

        mock_peer = WireGuardPeer(
            id=peer_id,
            tenant_id=tenant_id,
            server_id=uuid4(),
            name="Test Peer",
            public_key="peer_key",
            peer_ipv4="10.8.0.2/32",
            status=WireGuardPeerStatus.ACTIVE,
            config_file=config_content,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_peer
        mock_session.execute.return_value = mock_result

        result = await wireguard_service.get_peer_config(peer_id)

        assert result == config_content

    async def test_get_peer_config_not_found(self, wireguard_service, mock_session, tenant_id):
        """Test retrieving config for peer without config file."""
        peer_id = uuid4()

        mock_peer = WireGuardPeer(
            id=peer_id,
            tenant_id=tenant_id,
            server_id=uuid4(),
            name="Test Peer",
            public_key="peer_key",
            peer_ipv4="10.8.0.2/32",
            status=WireGuardPeerStatus.ACTIVE,
            config_file=None,  # No config
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_peer
        mock_session.execute.return_value = mock_result

        with pytest.raises(WireGuardServiceError, match="No config file"):
            await wireguard_service.get_peer_config(peer_id)


@pytest.mark.asyncio
class TestWireGuardStatisticsAndMonitoring:
    """Test WireGuard statistics and monitoring operations."""

    @pytest.mark.xfail(reason="Complex mocking of SQLAlchemy query execution - requires refactoring")
    async def test_sync_peer_stats_success(
        self, wireguard_service, mock_session, mock_wireguard_client, tenant_id
    ):
        """Test syncing peer statistics from WireGuard."""
        server_id = uuid4()
        peer_id = uuid4()

        # Mock server
        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Test Server",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="server_key",
            private_key_encrypted="encrypted",
            status=WireGuardServerStatus.ACTIVE,
        )

        # Mock peer
        mock_peer = WireGuardPeer(
            id=peer_id,
            tenant_id=tenant_id,
            server_id=server_id,
            name="Test Peer",
            public_key="peer_key",
            peer_ipv4="10.8.0.2/32",
            status=WireGuardPeerStatus.INACTIVE,
        )

        # Mock WireGuard stats
        now = datetime.utcnow()
        stats = [
            WireGuardStats(
                public_key="peer_key",
                endpoint="1.2.3.4:12345",
                latest_handshake=now,
                transfer_rx=1000000,
                transfer_tx=2000000,
                allowed_ips=["0.0.0.0/0"],
            )
        ]
        mock_wireguard_client.get_peer_stats.return_value = stats

        # Mock database queries
        mock_server_result = MagicMock()
        mock_server_result.scalar_one_or_none.return_value = mock_server

        mock_peer_result = MagicMock()
        mock_peer_result.scalar_one_or_none.return_value = mock_peer

        # First call: get_server, second call: find peer by public key
        def execute_side_effect(*args, **kwargs):
            if not hasattr(execute_side_effect, 'call_count'):
                execute_side_effect.call_count = 0
            execute_side_effect.call_count += 1
            if execute_side_effect.call_count == 1:
                return mock_server_result
            else:
                return mock_peer_result

        mock_session.execute.side_effect = execute_side_effect

        updated_count = await wireguard_service.sync_peer_stats(server_id)

        assert updated_count == 1
        assert mock_peer.last_handshake == now
        assert mock_peer.endpoint == "1.2.3.4:12345"
        assert mock_peer.rx_bytes == 1000000
        assert mock_peer.tx_bytes == 2000000
        assert mock_peer.status == WireGuardPeerStatus.ACTIVE  # Updated based on handshake
        mock_session.commit.assert_called_once()

    async def test_get_server_health_success(
        self, wireguard_service, mock_session, mock_wireguard_client, tenant_id
    ):
        """Test getting server health status."""
        server_id = uuid4()

        mock_server = WireGuardServer(
            id=server_id,
            tenant_id=tenant_id,
            name="Test Server",
            public_endpoint="vpn.test.com:51820",
            listen_port=51820,
            server_ipv4="10.8.0.1/24",
            public_key="server_key",
            private_key_encrypted="encrypted",
            status=WireGuardServerStatus.ACTIVE,
            current_peers=10,
            max_peers=100,
        )

        # Mock get_server
        mock_server_result = MagicMock()
        mock_server_result.scalar_one_or_none.return_value = mock_server

        # Mock active peers count
        mock_count_result = MagicMock()
        mock_count_result.scalar_one.return_value = 8

        mock_session.execute.side_effect = [mock_server_result, mock_count_result]

        health = await wireguard_service.get_server_health(server_id)

        assert health["server_id"] == str(server_id)
        assert health["server_name"] == "Test Server"
        assert health["status"] == "active"
        assert health["healthy"] is True
        assert health["total_peers"] == 10
        assert health["active_peers"] == 8
        assert health["has_capacity"] is True
        assert "capacity_used_percent" in health

    async def test_get_dashboard_stats(self, wireguard_service, mock_session):
        """Test getting dashboard statistics."""
        # Mock servers by status
        mock_servers_result = MagicMock()
        mock_servers_result.all.return_value = [
            (WireGuardServerStatus.ACTIVE, 5),
            (WireGuardServerStatus.INACTIVE, 2),
        ]

        # Mock peers by status
        mock_peers_result = MagicMock()
        mock_peers_result.all.return_value = [
            (WireGuardPeerStatus.ACTIVE, 100),
            (WireGuardPeerStatus.INACTIVE, 20),
        ]

        # Mock traffic
        mock_traffic_result = MagicMock()
        mock_traffic_result.one.return_value = (5000000, 10000000)

        mock_session.execute.side_effect = [
            mock_servers_result,
            mock_peers_result,
            mock_traffic_result,
        ]

        stats = await wireguard_service.get_dashboard_stats()

        assert stats["servers"]["total"] == 7
        assert stats["servers"]["by_status"]["active"] == 5
        assert stats["peers"]["total"] == 120
        assert stats["peers"]["by_status"]["active"] == 100
        assert stats["traffic"]["total_rx_bytes"] == 5000000
        assert stats["traffic"]["total_tx_bytes"] == 10000000
        assert stats["traffic"]["total_bytes"] == 15000000

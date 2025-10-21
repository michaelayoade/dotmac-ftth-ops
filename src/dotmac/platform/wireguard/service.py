"""
WireGuard VPN Service Layer.

Database-backed service for WireGuard VPN server and peer management.
"""

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.secrets import (
    AsyncVaultClient,
    DataClassification,
    EncryptedField,
    SymmetricEncryptionService,
    VaultError,
)
from dotmac.platform.settings import Environment, settings
from dotmac.platform.wireguard.client import WireGuardClient, WireGuardClientError
from dotmac.platform.wireguard.models import (
    WireGuardPeer,
    WireGuardPeerStatus,
    WireGuardServer,
    WireGuardServerStatus,
)

logger = logging.getLogger(__name__)


class WireGuardServiceError(Exception):
    """Base exception for WireGuard service errors."""

    pass


class WireGuardService:
    """
    WireGuard VPN Service with database backing.

    Manages WireGuard servers and peers, synchronizing state between
    the database and the running WireGuard container.
    """

    def __init__(
        self,
        session: AsyncSession,
        client: WireGuardClient,
        tenant_id: UUID,
        encryption_service: SymmetricEncryptionService | None = None,
        vault_client: AsyncVaultClient | None = None,
    ):
        """
        Initialize WireGuard service.

        Args:
            session: Database session
            client: WireGuard client
            tenant_id: Tenant ID for multi-tenancy
            encryption_service: Encryption service for encrypting keys (fallback)
            vault_client: Vault/OpenBao client for storing keys (preferred)
        """
        self.session = session
        self.client = client
        self.tenant_id = tenant_id
        self.encryption_service = encryption_service  # Fallback encryption
        self.vault_client = vault_client  # Preferred: use Vault for secrets

    # ========================================================================
    # Server Management
    # ========================================================================

    async def create_server(
        self,
        name: str,
        public_endpoint: str,
        server_ipv4: str,
        server_ipv6: str | None = None,
        listen_port: int = 51820,
        description: str | None = None,
        location: str | None = None,
        max_peers: int = 1000,
        dns_servers: list[str] | None = None,
        allowed_ips: list[str] | None = None,
    ) -> WireGuardServer:
        """
        Create a new WireGuard server with dual-stack support.

        Args:
            name: Server name
            public_endpoint: Public endpoint (hostname:port)
            server_ipv4: Server VPN IPv4 address (CIDR)
            server_ipv6: Server VPN IPv6 address (CIDR, optional)
            listen_port: UDP listen port
            description: Server description
            location: Server location
            max_peers: Maximum number of peers
            dns_servers: DNS servers for peers
            allowed_ips: Default allowed IPs for peers

        Returns:
            Created WireGuardServer

        Raises:
            WireGuardServiceError: If server creation fails
        """
        try:
            # Generate server keypair
            private_key, public_key = await self.client.generate_keypair()

            # Store private key in Vault (preferred) or encrypt in database (fallback)
            vault_path = None
            private_key_encrypted = None

            if self.vault_client:
                # PREFERRED: Store in Vault/OpenBao
                vault_path = f"wireguard/servers/{public_key}/private-key"
                try:
                    await self.vault_client.set_secret(
                        vault_path,
                        {
                            "private_key": private_key,
                            "tenant_id": str(self.tenant_id),
                            "created_at": datetime.utcnow().isoformat(),
                            "classification": "restricted",
                        },
                    )
                    # Store reference to Vault path, not the actual key
                    private_key_encrypted = f"vault:{vault_path}"
                    logger.info(f"Stored WireGuard server private key in Vault at {vault_path}")
                except VaultError as e:
                    logger.error(
                        f"Failed to store key in Vault: {e}, falling back to encrypted storage"
                    )
                    vault_path = None

            if not vault_path:
                # FALLBACK: Encrypt and store in database
                if self.encryption_service:
                    encrypted_field = self.encryption_service.encrypt(
                        private_key, classification=DataClassification.RESTRICTED
                    )
                    private_key_encrypted = encrypted_field.encrypted_data
                    logger.warning(
                        "Storing WireGuard private key encrypted in database (Vault unavailable)"
                    )
                else:
                    environment = getattr(settings, "environment", Environment.DEVELOPMENT)
                    if environment == Environment.PRODUCTION:
                        logger.error(
                            "Unable to securely store WireGuard private key: Vault unavailable and no encryption service configured."
                        )
                        raise WireGuardServiceError(
                            "WireGuard private key could not be stored securely. Vault must be operational or encryption fallback configured."
                        )
                    logger.warning(
                        "Vault unavailable and no encryption service configured; storing WireGuard private key in database (development mode only)."
                    )
                    private_key_encrypted = private_key

            # Create server record
            server = WireGuardServer(
                tenant_id=self.tenant_id,
                name=name,
                description=description,
                public_endpoint=public_endpoint,
                listen_port=listen_port,
                server_ipv4=server_ipv4,
                server_ipv6=server_ipv6,
                public_key=public_key,
                private_key_encrypted=private_key_encrypted,
                status=WireGuardServerStatus.ACTIVE,
                location=location,
                max_peers=max_peers,
                dns_servers=dns_servers or ["1.1.1.1", "1.0.0.1"],
                allowed_ips=allowed_ips or ["0.0.0.0/0", "::/0"],
            )

            self.session.add(server)
            await self.session.commit()
            await self.session.refresh(server)

            logger.info(f"Created WireGuard server: {server.id} ({server.name})")
            return server

        except Exception as e:
            await self.session.rollback()
            raise WireGuardServiceError(f"Failed to create server: {e}") from e

    async def get_server(self, server_id: UUID) -> WireGuardServer | None:
        """Get server by ID."""
        result = await self.session.execute(
            select(WireGuardServer)
            .where(
                WireGuardServer.id == server_id,
                WireGuardServer.tenant_id == self.tenant_id,
                WireGuardServer.deleted_at.is_(None),
            )
            .options(selectinload(WireGuardServer.peers))
        )
        return result.scalar_one_or_none()

    async def decrypt_server_private_key(self, server: WireGuardServer) -> str:
        """
        Decrypt server private key from Vault or encrypted storage.

        Args:
            server: WireGuardServer instance

        Returns:
            Decrypted private key

        Raises:
            WireGuardServiceError: If decryption fails or no encryption service configured
        """
        encrypted_key = str(server.private_key_encrypted)

        # Check if key is stored in Vault
        if encrypted_key.startswith("vault:"):
            vault_path = encrypted_key[6:]  # Remove "vault:" prefix
            if not self.vault_client:
                raise WireGuardServiceError(
                    "Private key is in Vault but no Vault client configured"
                )

            try:
                secret = await self.vault_client.get_secret(vault_path)
                private_key = secret.get("private_key") if secret else None
                if not isinstance(private_key, str):
                    raise WireGuardServiceError(f"Private key not found in Vault at {vault_path}")
                return private_key
            except VaultError as e:
                raise WireGuardServiceError(
                    f"Failed to retrieve private key from Vault: {e}"
                ) from e

        # Check if key is encrypted with SymmetricEncryptionService
        if self.encryption_service:
            try:
                # Reconstruct EncryptedField from stored data
                encrypted_field = EncryptedField(
                    algorithm="fernet",
                    encrypted_data=encrypted_key,
                    classification=DataClassification.RESTRICTED,
                )
                decrypted = self.encryption_service.decrypt(encrypted_field)
                if not isinstance(decrypted, str):
                    raise WireGuardServiceError("Decrypted private key is not a string")
                return decrypted
            except Exception as e:
                # If decryption fails, might be unencrypted
                logger.warning(f"Failed to decrypt with encryption service: {e}, returning as-is")
                return encrypted_key

        # Fallback: assume unencrypted
        logger.warning("No Vault or encryption service - returning private key as-is")
        return encrypted_key

    async def list_servers(
        self,
        status: WireGuardServerStatus | None = None,
        location: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WireGuardServer]:
        """List servers with optional filtering."""
        query = select(WireGuardServer).where(
            WireGuardServer.tenant_id == self.tenant_id,
            WireGuardServer.deleted_at.is_(None),
        )

        if status:
            query = query.where(WireGuardServer.status == status)
        if location:
            query = query.where(WireGuardServer.location == location)

        query = query.limit(limit).offset(offset).order_by(WireGuardServer.created_at.desc())

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update_server(
        self,
        server_id: UUID,
        **updates: Any,
    ) -> WireGuardServer:
        """Update server attributes."""
        server = await self.get_server(server_id)
        if not server:
            raise WireGuardServiceError(f"Server {server_id} not found")

        # Update allowed fields
        allowed_fields = {
            "name",
            "description",
            "status",
            "max_peers",
            "dns_servers",
            "allowed_ips",
            "location",
            "metadata_",
        }

        for key, value in updates.items():
            if key in allowed_fields and value is not None:
                setattr(server, key, value)

        await self.session.commit()
        await self.session.refresh(server)

        logger.info(f"Updated WireGuard server: {server_id}")
        return server

    async def delete_server(self, server_id: UUID) -> None:
        """Soft delete a server."""
        server = await self.get_server(server_id)
        if not server:
            raise WireGuardServiceError(f"Server {server_id} not found")

        server.deleted_at = datetime.utcnow()
        server.status = WireGuardServerStatus.INACTIVE

        await self.session.commit()
        logger.info(f"Deleted WireGuard server: {server_id}")

    # ========================================================================
    # Peer Management
    # ========================================================================

    async def create_peer(
        self,
        server_id: UUID,
        name: str,
        customer_id: UUID | None = None,
        subscriber_id: str | None = None,
        description: str | None = None,
        generate_keys: bool = True,
        public_key: str | None = None,
        peer_ipv4: str | None = None,
        peer_ipv6: str | None = None,
        allowed_ips: list[str] | None = None,
    ) -> WireGuardPeer:
        """
        Create a new WireGuard peer with dual-stack support.

        Args:
            server_id: Server ID
            name: Peer name
            customer_id: Optional customer ID
            subscriber_id: Optional subscriber ID
            description: Peer description
            generate_keys: Whether to generate keys automatically
            public_key: Peer public key (if not generating)
            peer_ipv4: Peer VPN IPv4 (if not auto-allocating)
            peer_ipv6: Peer VPN IPv6 (if not auto-allocating)
            allowed_ips: Allowed IPs (overrides server default)

        Returns:
            Created WireGuardPeer

        Raises:
            WireGuardServiceError: If peer creation fails
        """
        try:
            # Get server
            server = await self.get_server(server_id)
            if not server:
                raise WireGuardServiceError(f"Server {server_id} not found")

            if not server.has_capacity:
                raise WireGuardServiceError(
                    f"Server {server_id} is at capacity ({server.current_peers}/{server.max_peers})"
                )

            # Generate or use provided keys
            if generate_keys:
                private_key, public_key = await self.client.generate_keypair()
            elif not public_key:
                raise WireGuardServiceError("Must provide public_key if generate_keys=False")
            else:
                private_key = None

            # Allocate IPv4 if not provided
            if not peer_ipv4:
                # Get all used IPv4 addresses
                used_ipv4_result = await self.session.execute(
                    select(WireGuardPeer.peer_ipv4).where(
                        WireGuardPeer.server_id == server_id,
                        WireGuardPeer.deleted_at.is_(None),
                    )
                )
                used_ips = [row[0] for row in used_ipv4_result.all()]
                used_ips.append(server.server_ipv4)  # Include server IP

                peer_ipv4 = await self.client.allocate_peer_ip(
                    server.server_ipv4,
                    used_ips,
                )

            # Allocate IPv6 if server has IPv6 and peer IPv6 not provided
            if server.server_ipv6 and not peer_ipv6:
                # Get all used IPv6 addresses
                used_ipv6_result = await self.session.execute(
                    select(WireGuardPeer.peer_ipv6).where(
                        WireGuardPeer.server_id == server_id,
                        WireGuardPeer.peer_ipv6.is_not(None),
                        WireGuardPeer.deleted_at.is_(None),
                    )
                )
                used_ipv6s = [row[0] for row in used_ipv6_result.all() if row[0]]
                used_ipv6s.append(server.server_ipv6)  # Include server IPv6

                # Allocate next IPv6 address
                peer_ipv6 = await self.client.allocate_peer_ip(
                    server.server_ipv6,
                    used_ipv6s,
                )

            # Create peer record
            peer = WireGuardPeer(
                tenant_id=self.tenant_id,
                server_id=server_id,
                customer_id=customer_id,
                subscriber_id=subscriber_id,
                name=name,
                description=description,
                public_key=public_key,
                peer_ipv4=peer_ipv4,
                peer_ipv6=peer_ipv6,
                allowed_ips=allowed_ips or server.allowed_ips,
                status=WireGuardPeerStatus.ACTIVE,
            )

            # Generate config file
            if private_key:
                # Build peer addresses (dual-stack if IPv6 available)
                peer_addresses = [peer_ipv4]
                if peer_ipv6:
                    peer_addresses.append(peer_ipv6)
                peer_address_str = ", ".join(peer_addresses)

                config_content = await self.client.generate_peer_config(
                    server_public_key=server.public_key,
                    server_endpoint=server.public_endpoint,
                    peer_private_key=private_key,
                    peer_address=peer_address_str,
                    dns_servers=server.dns_servers,
                    allowed_ips=peer.allowed_ips,
                )
                peer.config_file = config_content

            self.session.add(peer)

            # Update server peer count
            server.current_peers += 1

            await self.session.commit()
            await self.session.refresh(peer)

            logger.info(f"Created WireGuard peer: {peer.id} ({peer.name}) on server {server_id}")
            return peer

        except Exception as e:
            await self.session.rollback()
            raise WireGuardServiceError(f"Failed to create peer: {e}") from e

    async def get_peer(self, peer_id: UUID) -> WireGuardPeer | None:
        """Get peer by ID."""
        result = await self.session.execute(
            select(WireGuardPeer)
            .where(
                WireGuardPeer.id == peer_id,
                WireGuardPeer.tenant_id == self.tenant_id,
                WireGuardPeer.deleted_at.is_(None),
            )
            .options(selectinload(WireGuardPeer.server))
        )
        return result.scalar_one_or_none()

    async def list_peers(
        self,
        server_id: UUID | None = None,
        customer_id: UUID | None = None,
        subscriber_id: str | None = None,
        status: WireGuardPeerStatus | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WireGuardPeer]:
        """List peers with optional filtering."""
        query = select(WireGuardPeer).where(
            WireGuardPeer.tenant_id == self.tenant_id,
            WireGuardPeer.deleted_at.is_(None),
        )

        if server_id:
            query = query.where(WireGuardPeer.server_id == server_id)
        if customer_id:
            query = query.where(WireGuardPeer.customer_id == customer_id)
        if subscriber_id:
            query = query.where(WireGuardPeer.subscriber_id == subscriber_id)
        if status:
            query = query.where(WireGuardPeer.status == status)

        query = query.limit(limit).offset(offset).order_by(WireGuardPeer.created_at.desc())

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update_peer(
        self,
        peer_id: UUID,
        **updates: Any,
    ) -> WireGuardPeer:
        """Update peer attributes."""
        peer = await self.get_peer(peer_id)
        if not peer:
            raise WireGuardServiceError(f"Peer {peer_id} not found")

        # Update allowed fields
        allowed_fields = {
            "name",
            "description",
            "status",
            "enabled",
            "allowed_ips",
            "metadata_",
            "notes",
        }

        for key, value in updates.items():
            if key in allowed_fields and value is not None:
                setattr(peer, key, value)

        await self.session.commit()
        await self.session.refresh(peer)

        logger.info(f"Updated WireGuard peer: {peer_id}")
        return peer

    async def delete_peer(self, peer_id: UUID) -> None:
        """Soft delete a peer and update server peer count."""
        peer = await self.get_peer(peer_id)
        if not peer:
            raise WireGuardServiceError(f"Peer {peer_id} not found")

        # Update server peer count
        server = await self.get_server(peer.server_id)
        if server:
            server.current_peers = max(0, server.current_peers - 1)

        peer.deleted_at = datetime.utcnow()
        peer.status = WireGuardPeerStatus.DISABLED

        await self.session.commit()
        logger.info(f"Deleted WireGuard peer: {peer_id}")

    async def get_peer_config(self, peer_id: UUID) -> str:
        """Get peer configuration file."""
        peer = await self.get_peer(peer_id)
        if not peer:
            raise WireGuardServiceError(f"Peer {peer_id} not found")

        if not peer.config_file:
            raise WireGuardServiceError(f"No config file for peer {peer_id}")

        return str(peer.config_file)

    async def regenerate_peer_config(self, peer_id: UUID) -> WireGuardPeer:
        """Regenerate peer configuration with new keys."""
        peer = await self.get_peer(peer_id)
        if not peer:
            raise WireGuardServiceError(f"Peer {peer_id} not found")

        server = await self.get_server(peer.server_id)
        if not server:
            raise WireGuardServiceError(f"Server {peer.server_id} not found")

        # Generate new keypair
        private_key, public_key = await self.client.generate_keypair()
        peer.public_key = public_key

        # Build peer addresses (dual-stack if IPv6 available)
        peer_addresses = [peer.peer_ipv4]
        if peer.peer_ipv6:
            peer_addresses.append(peer.peer_ipv6)
        peer_address_str = ", ".join(peer_addresses)

        # Generate new config
        config_content = await self.client.generate_peer_config(
            server_public_key=server.public_key,
            server_endpoint=server.public_endpoint,
            peer_private_key=private_key,
            peer_address=peer_address_str,
            dns_servers=server.dns_servers,
            allowed_ips=peer.allowed_ips,
        )
        peer.config_file = config_content

        await self.session.commit()
        await self.session.refresh(peer)

        logger.info(f"Regenerated config for peer: {peer_id}")
        return peer

    # ========================================================================
    # Statistics and Monitoring
    # ========================================================================

    async def sync_peer_stats(self, server_id: UUID) -> int:
        """
        Sync peer statistics from WireGuard container to database.

        Args:
            server_id: Server ID

        Returns:
            Number of peers updated

        Raises:
            WireGuardServiceError: If sync fails
        """
        try:
            server = await self.get_server(server_id)
            if not server:
                raise WireGuardServiceError(f"Server {server_id} not found")

            # Get stats from WireGuard
            stats_list = await self.client.get_peer_stats()

            updated_count = 0
            total_rx = 0
            total_tx = 0

            for stats in stats_list:
                # Find peer by public key
                result = await self.session.execute(
                    select(WireGuardPeer).where(
                        WireGuardPeer.server_id == server_id,
                        WireGuardPeer.public_key == stats.public_key,
                        WireGuardPeer.deleted_at.is_(None),
                    )
                )
                peer = result.scalar_one_or_none()

                if peer:
                    peer.last_handshake = stats.latest_handshake
                    peer.endpoint = stats.endpoint
                    peer.rx_bytes = stats.transfer_rx
                    peer.tx_bytes = stats.transfer_tx
                    peer.last_stats_update = datetime.utcnow()

                    # Update status based on handshake
                    if stats.latest_handshake:
                        time_since = datetime.utcnow() - stats.latest_handshake
                        if time_since.total_seconds() < 180:  # 3 minutes
                            peer.status = WireGuardPeerStatus.ACTIVE
                        else:
                            peer.status = WireGuardPeerStatus.INACTIVE

                    updated_count += 1
                    total_rx += stats.transfer_rx
                    total_tx += stats.transfer_tx

            # Update server totals
            server.total_rx_bytes = total_rx
            server.total_tx_bytes = total_tx
            server.last_stats_update = datetime.utcnow()

            await self.session.commit()

            logger.info(f"Synced stats for {updated_count} peers on server {server_id}")
            return updated_count

        except Exception as e:
            await self.session.rollback()
            raise WireGuardServiceError(f"Failed to sync stats: {e}") from e

    async def get_server_health(self, server_id: UUID) -> dict[str, Any]:
        """Get server health status."""
        server = await self.get_server(server_id)
        if not server:
            raise WireGuardServiceError(f"Server {server_id} not found")

        try:
            # Get WireGuard health
            wg_health = await self.client.health_check()

            # Count active peers
            active_peers_result = await self.session.execute(
                select(func.count(WireGuardPeer.id)).where(
                    WireGuardPeer.server_id == server_id,
                    WireGuardPeer.status == WireGuardPeerStatus.ACTIVE,
                    WireGuardPeer.enabled.is_(True),
                    WireGuardPeer.deleted_at.is_(None),
                )
            )
            active_peers = active_peers_result.scalar_one()

            return {
                "server_id": str(server_id),
                "server_name": server.name,
                "status": server.status.value,
                "healthy": wg_health["healthy"],
                "total_peers": server.current_peers,
                "active_peers": active_peers,
                "capacity_used_percent": server.utilization_percent,
                "has_capacity": server.has_capacity,
                "wireguard": wg_health,
            }

        except WireGuardClientError as e:
            logger.error(f"WireGuard health check failed: {e}")
            return {
                "server_id": str(server_id),
                "server_name": server.name,
                "status": WireGuardServerStatus.DEGRADED.value,
                "healthy": False,
                "error": str(e),
            }

    async def get_dashboard_stats(self) -> dict[str, Any]:
        """Get dashboard statistics for tenant."""
        # Count servers by status
        servers_result = await self.session.execute(
            select(
                WireGuardServer.status,
                func.count(WireGuardServer.id),
            )
            .where(
                WireGuardServer.tenant_id == self.tenant_id,
                WireGuardServer.deleted_at.is_(None),
            )
            .group_by(WireGuardServer.status)
        )
        servers_by_status = {row[0].value: row[1] for row in servers_result.all()}

        # Count peers by status
        peers_result = await self.session.execute(
            select(
                WireGuardPeer.status,
                func.count(WireGuardPeer.id),
            )
            .where(
                WireGuardPeer.tenant_id == self.tenant_id,
                WireGuardPeer.deleted_at.is_(None),
            )
            .group_by(WireGuardPeer.status)
        )
        peers_by_status = {row[0].value: row[1] for row in peers_result.all()}

        # Total traffic
        traffic_result = await self.session.execute(
            select(
                func.sum(WireGuardPeer.rx_bytes),
                func.sum(WireGuardPeer.tx_bytes),
            ).where(
                WireGuardPeer.tenant_id == self.tenant_id,
                WireGuardPeer.deleted_at.is_(None),
            )
        )
        traffic_row = traffic_result.one()
        total_rx = traffic_row[0] or 0
        total_tx = traffic_row[1] or 0

        return {
            "servers": {
                "total": sum(servers_by_status.values()),
                "by_status": servers_by_status,
            },
            "peers": {
                "total": sum(peers_by_status.values()),
                "by_status": peers_by_status,
            },
            "traffic": {
                "total_rx_bytes": total_rx,
                "total_tx_bytes": total_tx,
                "total_bytes": total_rx + total_tx,
            },
        }

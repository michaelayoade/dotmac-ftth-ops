"""
WireGuard Client for LinuxServer WireGuard Container.

This client integrates with the LinuxServer WireGuard Docker container
by managing configuration files and executing wg commands.
"""

import asyncio
import ipaddress
import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class WireGuardStats:
    """WireGuard peer statistics from wg show."""

    public_key: str
    endpoint: str | None
    latest_handshake: datetime | None
    transfer_rx: int
    transfer_tx: int
    allowed_ips: list[str]


@dataclass
class WireGuardServerConfig:
    """WireGuard server configuration."""

    interface: str
    private_key: str
    public_key: str
    listen_port: int
    address: str
    post_up: str | None = None
    post_down: str | None = None


@dataclass
class WireGuardPeerConfig:
    """WireGuard peer configuration."""

    public_key: str
    preshared_key: str | None
    allowed_ips: list[str]
    endpoint: str | None = None
    persistent_keepalive: int | None = None


class WireGuardClientError(Exception):
    """Base exception for WireGuard client errors."""

    pass


class WireGuardClient:
    """
    Client for managing LinuxServer WireGuard container.

    This client manages WireGuard configuration files and executes
    wg commands via Docker exec to interact with the running container.
    """

    _PEER_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+$")

    def __init__(
        self,
        container_name: str = "isp-wireguard",
        config_base_path: str = "/config",
        server_interface: str = "wg0",
    ):
        """
        Initialize WireGuard client.

        Args:
            container_name: Name of the WireGuard Docker container
            config_base_path: Base configuration path inside container
            server_interface: WireGuard interface name (default: wg0)
        """
        self.container_name = container_name
        self.config_base_path = config_base_path
        self.server_interface = server_interface

    def _sanitize_peer_name(self, peer_name: str) -> str:
        """Validate peer name to prevent path traversal and command injection."""
        if not self._PEER_NAME_PATTERN.match(peer_name):
            raise WireGuardClientError(
                "Invalid peer name. Only alphanumeric characters, dash, underscore, and dot are allowed."
            )
        return peer_name

    @staticmethod
    def _validate_preshared_key(preshared_key: str) -> None:
        """Ensure preshared keys follow WireGuard base64 format (32 bytes -> 43 chars)."""
        if not preshared_key or not re.fullmatch(r"[A-Za-z0-9+/=]{43,44}", preshared_key):
            raise WireGuardClientError("Invalid preshared key format.")

    async def _docker_exec(
        self, command: list[str], *, input_data: bytes | None = None
    ) -> tuple[str, str]:
        """
        Execute command inside WireGuard container.

        Args:
            command: Command to execute
            input_data: Optional data to send to stdin

        Returns:
            Tuple of (stdout, stderr)

        Raises:
            WireGuardClientError: If command fails
        """
        full_command = ["docker", "exec", self.container_name] + command

        try:
            process = await asyncio.create_subprocess_exec(
                *full_command,
                stdin=asyncio.subprocess.PIPE if input_data is not None else None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate(input=input_data)

            if process.returncode != 0:
                raise WireGuardClientError(
                    f"Command failed: {' '.join(command)}\nError: {stderr.decode('utf-8')}"
                )

            return stdout.decode("utf-8"), stderr.decode("utf-8")

        except Exception as e:
            raise WireGuardClientError(f"Failed to execute command: {e}") from e

    async def get_server_config(self) -> WireGuardServerConfig:
        """
        Read WireGuard server configuration.

        Returns:
            WireGuardServerConfig object

        Raises:
            WireGuardClientError: If config cannot be read
        """
        config_path = f"{self.config_base_path}/wg_confs/{self.server_interface}.conf"

        try:
            stdout, _ = await self._docker_exec(["cat", config_path])
            return self._parse_server_config(stdout)
        except Exception as e:
            raise WireGuardClientError(f"Failed to read server config: {e}") from e

    def _parse_server_config(self, config_content: str) -> WireGuardServerConfig:
        """Parse WireGuard server configuration file."""
        lines = config_content.strip().split("\n")
        config: dict[str, Any] = {}

        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip().lower().replace(" ", "_")
                value = value.strip()
                config[key] = value

        return WireGuardServerConfig(
            interface=self.server_interface,
            private_key=config.get("privatekey", ""),
            public_key=config.get("publickey", ""),  # May not be in config
            listen_port=int(config.get("listenport", 51820)),
            address=config.get("address", ""),
            post_up=config.get("postup"),
            post_down=config.get("postdown"),
        )

    async def get_server_public_key(self) -> str:
        """
        Get server public key using wg command.

        Returns:
            Server public key (base64)

        Raises:
            WireGuardClientError: If key cannot be retrieved
        """
        try:
            stdout, _ = await self._docker_exec(["wg", "show", self.server_interface, "public-key"])
            return stdout.strip()
        except Exception as e:
            raise WireGuardClientError(f"Failed to get server public key: {e}") from e

    async def get_peer_stats(self, public_key: str | None = None) -> list[WireGuardStats]:
        """
        Get peer statistics from wg show.

        Args:
            public_key: Optional peer public key to filter

        Returns:
            List of WireGuardStats objects

        Raises:
            WireGuardClientError: If stats cannot be retrieved
        """
        try:
            stdout, _ = await self._docker_exec(["wg", "show", self.server_interface, "dump"])
            return self._parse_peer_stats(stdout, public_key)
        except Exception as e:
            raise WireGuardClientError(f"Failed to get peer stats: {e}") from e

    def _parse_peer_stats(
        self, dump_output: str, filter_public_key: str | None = None
    ) -> list[WireGuardStats]:
        """Parse wg show dump output into WireGuardStats objects."""
        stats: list[WireGuardStats] = []
        lines = dump_output.strip().split("\n")

        # Skip first line (server info)
        for line in lines[1:]:
            parts = line.split("\t")
            if len(parts) < 6:
                continue

            public_key = parts[0]
            if filter_public_key and public_key != filter_public_key:
                continue

            # Parse endpoint
            endpoint = parts[2] if parts[2] != "(none)" else None

            # Parse latest handshake (Unix timestamp)
            latest_handshake = None
            if parts[4] != "0":
                try:
                    latest_handshake = datetime.fromtimestamp(int(parts[4]))
                except (ValueError, OSError):
                    pass

            # Parse transfer
            transfer_rx = int(parts[5]) if parts[5] else 0
            transfer_tx = int(parts[6]) if parts[6] else 0

            # Parse allowed IPs
            allowed_ips = parts[3].split(",") if parts[3] else []

            stats.append(
                WireGuardStats(
                    public_key=public_key,
                    endpoint=endpoint,
                    latest_handshake=latest_handshake,
                    transfer_rx=transfer_rx,
                    transfer_tx=transfer_tx,
                    allowed_ips=allowed_ips,
                )
            )

        return stats

    async def read_peer_config(self, peer_name: str) -> str:
        """
        Read peer configuration file.

        Args:
            peer_name: Peer directory name (e.g., "peer1")

        Returns:
            Peer configuration file content

        Raises:
            WireGuardClientError: If config cannot be read
        """
        safe_peer_name = self._sanitize_peer_name(peer_name)
        config_path = f"{self.config_base_path}/{safe_peer_name}/{safe_peer_name}.conf"

        try:
            stdout, _ = await self._docker_exec(["cat", config_path])
            return stdout
        except Exception as e:
            raise WireGuardClientError(f"Failed to read peer config for {peer_name}: {e}") from e

    async def write_peer_config(
        self,
        peer_name: str,
        config_content: str,
    ) -> None:
        """
        Write peer configuration file.

        Args:
            peer_name: Peer directory name (e.g., "peer1")
            config_content: Full configuration file content

        Raises:
            WireGuardClientError: If config cannot be written
        """
        safe_peer_name = self._sanitize_peer_name(peer_name)
        config_path = f"{self.config_base_path}/{safe_peer_name}/{safe_peer_name}.conf"

        try:
            # Create peer directory if it doesn't exist
            await self._docker_exec(["mkdir", "-p", f"{self.config_base_path}/{safe_peer_name}"])

            # Write config file via tee to avoid shell interpolation
            await self._docker_exec(
                ["tee", config_path],
                input_data=config_content.encode("utf-8"),
            )
            await self._docker_exec(["chmod", "600", config_path])
        except Exception as e:
            raise WireGuardClientError(f"Failed to write peer config for {peer_name}: {e}") from e

    async def generate_peer_config(
        self,
        server_public_key: str,
        server_endpoint: str,
        peer_private_key: str,
        peer_address: str,
        dns_servers: list[str] | None = None,
        allowed_ips: list[str] | None = None,
        persistent_keepalive: int | None = 25,
    ) -> str:
        """
        Generate peer configuration file content.

        Args:
            server_public_key: Server's public key
            server_endpoint: Server endpoint (host:port)
            peer_private_key: Peer's private key
            peer_address: Peer's VPN IP address
            dns_servers: DNS servers for peer
            allowed_ips: Allowed IPs for peer (default: 0.0.0.0/0, ::/0)
            persistent_keepalive: Keepalive interval in seconds

        Returns:
            Generated configuration file content
        """
        if dns_servers is None:
            dns_servers = ["1.1.1.1", "1.0.0.1"]
        if allowed_ips is None:
            allowed_ips = ["0.0.0.0/0", "::/0"]

        config = f"""[Interface]
PrivateKey = {peer_private_key}
Address = {peer_address}
DNS = {", ".join(dns_servers)}

[Peer]
PublicKey = {server_public_key}
Endpoint = {server_endpoint}
AllowedIPs = {", ".join(allowed_ips)}
"""

        if persistent_keepalive:
            config += f"PersistentKeepalive = {persistent_keepalive}\n"

        return config

    async def generate_keypair(self) -> tuple[str, str]:
        """
        Generate WireGuard keypair.

        Returns:
            Tuple of (private_key, public_key)

        Raises:
            WireGuardClientError: If keypair generation fails
        """
        try:
            # Generate private key
            stdout, _ = await self._docker_exec(["wg", "genkey"])
            private_key = stdout.strip()

            # Derive public key
            process = await asyncio.create_subprocess_exec(
                "docker",
                "exec",
                "-i",
                self.container_name,
                "wg",
                "pubkey",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await process.communicate(input=private_key.encode())

            if process.returncode != 0:
                raise WireGuardClientError(f"Failed to derive public key: {stderr_bytes.decode()}")

            public_key = stdout_bytes.decode().strip()

            return private_key, public_key

        except Exception as e:
            raise WireGuardClientError(f"Failed to generate keypair: {e}") from e

    async def generate_preshared_key(self) -> str:
        """
        Generate WireGuard preshared key.

        Returns:
            Preshared key (base64)

        Raises:
            WireGuardClientError: If key generation fails
        """
        try:
            stdout, _ = await self._docker_exec(["wg", "genpsk"])
            return stdout.strip()
        except Exception as e:
            raise WireGuardClientError(f"Failed to generate preshared key: {e}") from e

    async def add_peer_to_interface(
        self,
        public_key: str,
        allowed_ips: list[str],
        preshared_key: str | None = None,
    ) -> None:
        """
        Add peer to WireGuard interface dynamically.

        Args:
            public_key: Peer's public key
            allowed_ips: Allowed IPs for peer
            preshared_key: Optional preshared key

        Raises:
            WireGuardClientError: If peer cannot be added
        """
        command = [
            "wg",
            "set",
            self.server_interface,
            "peer",
            public_key,
            "allowed-ips",
            ",".join(allowed_ips),
        ]

        # Handle preshared key if provided
        if preshared_key:
            self._validate_preshared_key(preshared_key)
            # wg requires preshared key to be in a file, so write to temp file
            # Use /dev/shm (memory-backed tmpfs) for better security in container
            # Generate secure random filename
            temp_basename = f"wg_psk_{secrets.token_urlsafe(16)}.tmp"
            # Safe: /dev/shm inside container is isolated, ephemeral, memory-backed
            temp_filename = f"/dev/shm/{temp_basename}"  # nosec B108

            try:
                # Write preshared key to temp file in container with restrictive permissions
                await self._docker_exec(
                    ["sh", "-c", f"umask 077 && tee {temp_filename} > /dev/null"],
                    input_data=f"{preshared_key}\n".encode(),
                )

                # Add preshared-key argument to command
                command.extend(["preshared-key", temp_filename])

                # Execute wg set command
                await self._docker_exec(command)

            except Exception as e:
                raise WireGuardClientError(f"Failed to add peer with preshared key: {e}") from e
            finally:
                # Always cleanup temp file (success or failure)
                try:
                    cleanup_cmd = ["rm", "-f", temp_filename]
                    await self._docker_exec(cleanup_cmd)
                except Exception:
                    # Log but don't fail on cleanup errors
                    logger.warning(f"Failed to cleanup temp file {temp_filename}")
        else:
            # No preshared key, execute command normally
            try:
                await self._docker_exec(command)
            except Exception as e:
                raise WireGuardClientError(f"Failed to add peer: {e}") from e

    async def remove_peer_from_interface(self, public_key: str) -> None:
        """
        Remove peer from WireGuard interface dynamically.

        Args:
            public_key: Peer's public key

        Raises:
            WireGuardClientError: If peer cannot be removed
        """
        try:
            await self._docker_exec(
                [
                    "wg",
                    "set",
                    self.server_interface,
                    "peer",
                    public_key,
                    "remove",
                ]
            )
        except Exception as e:
            raise WireGuardClientError(f"Failed to remove peer: {e}") from e

    async def reload_interface(self) -> None:
        """
        Reload WireGuard interface configuration.

        This typically requires restarting the interface or the entire container.

        Raises:
            WireGuardClientError: If reload fails
        """
        try:
            # For LinuxServer WireGuard, we can trigger a reload by
            # restarting the container or using wg-quick
            await self._docker_exec(["wg-quick", "down", self.server_interface])
            await self._docker_exec(["wg-quick", "up", self.server_interface])
        except Exception as e:
            logger.warning(f"Failed to reload interface: {e}")
            # Don't raise - interface might already be up/down

    async def get_peer_qr_code(self, peer_name: str) -> bytes | None:
        """
        Get QR code for peer configuration.

        Args:
            peer_name: Peer directory name

        Returns:
            QR code PNG image bytes, or None if not found

        Raises:
            WireGuardClientError: If QR code cannot be read
        """
        safe_peer_name = self._sanitize_peer_name(peer_name)
        qr_path = f"{self.config_base_path}/{safe_peer_name}/{safe_peer_name}.png"

        try:
            # Check if QR code exists
            await self._docker_exec(["test", "-f", qr_path])

            # Read QR code
            process = await asyncio.create_subprocess_exec(
                "docker",
                "exec",
                self.container_name,
                "cat",
                qr_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                return None

            return stdout

        except Exception:
            return None

    async def allocate_peer_ip(
        self,
        server_network: str,
        used_ips: list[str],
    ) -> str:
        """
        Allocate next available IP address for a peer.

        Args:
            server_network: Server network CIDR (e.g., "10.8.0.0/24")
            used_ips: List of already allocated IPs

        Returns:
            Allocated IP address with /32 suffix (e.g., "10.8.0.5/32")

        Raises:
            WireGuardClientError: If no IPs available
        """
        try:
            network = ipaddress.ip_network(server_network, strict=False)
            used_set = {ipaddress.ip_address(ip.split("/")[0]) for ip in used_ips}

            # Start from .2 (server is .1)
            for ip in network.hosts():
                if ip == network.network_address + 1:
                    # Skip .1 (server)
                    continue
                if ip not in used_set:
                    return f"{ip}/32"

            raise WireGuardClientError("No available IP addresses in network")

        except Exception as e:
            raise WireGuardClientError(f"Failed to allocate IP: {e}") from e

    async def health_check(self) -> dict[str, Any]:
        """
        Perform health check on WireGuard service.

        Returns:
            Health status dictionary

        Raises:
            WireGuardClientError: If health check fails
        """
        try:
            # Check if interface exists
            stdout, _ = await self._docker_exec(["wg", "show", self.server_interface])

            # Check if container is responsive
            is_healthy = bool(stdout.strip())

            # Get peer count
            stats = await self.get_peer_stats()
            active_peers = sum(
                1
                for s in stats
                if s.latest_handshake
                and (datetime.utcnow() - s.latest_handshake).total_seconds() < 180
            )

            return {
                "healthy": is_healthy,
                "interface": self.server_interface,
                "total_peers": len(stats),
                "active_peers": active_peers,
            }

        except Exception as e:
            raise WireGuardClientError(f"Health check failed: {e}") from e

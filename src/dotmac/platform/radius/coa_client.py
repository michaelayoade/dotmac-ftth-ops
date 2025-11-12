"""
RADIUS CoA/DM Client Implementation

Implements RFC 5176 Change of Authorization (CoA) and Disconnect Messages (DM)
for dynamic session control.

This module provides functionality to send CoA/DM packets to RADIUS servers
to disconnect sessions, update bandwidth limits, or change service policies.

Configuration:
- Uses dotmac.platform.settings for RADIUS server configuration
- Fetches RADIUS shared secret from HashiCorp Vault in production
- Falls back to settings if Vault is unavailable (development only)
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from functools import cached_property
from importlib import resources
from ipaddress import IPv4Address, IPv6Address, ip_address
from typing import Any

import httpx
import pyrad.packet as radius_packet
import structlog
from pyrad.client import Client, Timeout
from pyrad.dictionary import Dictionary

from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


class RADIUSCoAError(RuntimeError):
    """Base exception for RADIUS CoA errors."""


class RADIUSTimeoutError(RADIUSCoAError):
    """Raised when the RADIUS server does not respond in time."""


@dataclass(slots=True)
class RadiusResponse:
    """Structured representation of a RADIUS reply."""

    code: int
    identifier: int
    attributes: Mapping[str, list[Any]]

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""
        return {
            "code": self.code,
            "identifier": self.identifier,
            "attributes": {key: list(values) for key, values in self.attributes.items()},
        }


def _load_default_dictionary() -> Dictionary:
    """Load the bundled RADIUS dictionaries from pyrad."""
    try:
        dictionary_pkg = resources.files("pyrad.dictionary")
        base_dict = str(dictionary_pkg.joinpath("dictionary"))
        coa_dict = str(dictionary_pkg.joinpath("dictionary.rfc5176"))
        return Dictionary(base_dict, coa_dict)
    except FileNotFoundError as exc:
        raise RADIUSCoAError("Unable to locate RADIUS dictionary files") from exc


class CoAClient:
    """
    RADIUS CoA/DM Client using pyrad for binary protocol handling.

    This implementation avoids shelling out to radclient and constructs
    properly-encoded RADIUS packets using pyrad's type-safe API.

    Configuration is loaded from settings and Vault:
    - Server/port/timeout: From settings (dotmac.platform.settings)
    - Shared secret: From Vault (production) or settings (development)
    - Dictionary paths: From settings
    """

    def __init__(
        self,
        radius_server: str | None = None,
        coa_port: int | None = None,
        radius_secret: str | None = None,
        timeout: int | None = None,
        dictionary_paths: Iterable[str] | None = None,
        tenant_id: str | None = None,
    ):
        """
        Initialize CoA client.

        All parameters are optional and will be loaded from settings/Vault if not provided.
        This allows flexible usage: explicit parameters for testing, auto-config for production.

        Args:
            radius_server: RADIUS server IP or hostname (default: from settings)
            coa_port: CoA port (default: from settings, RFC 5176 default: 3799)
            radius_secret: Shared secret (default: from Vault or settings)
            timeout: Request timeout in seconds (default: from settings)
            dictionary_paths: RADIUS dictionary files (default: from settings)
            tenant_id: Tenant ID for multi-tenant Vault secret lookup
        """
        # Load configuration from settings if not explicitly provided
        self.radius_server = radius_server or settings.radius.server_host
        self.coa_port = coa_port or settings.radius.coa_port
        self.timeout = timeout or settings.radius.timeout_seconds
        self.tenant_id = tenant_id

        # Fetch shared secret from Vault or settings
        if radius_secret is None:
            self.radius_secret = self._load_radius_secret(tenant_id)
        else:
            self.radius_secret = radius_secret

        # Dictionary paths from settings (NOT Vault - these are not secrets)
        if dictionary_paths is None:
            self._dictionary_paths = tuple(settings.radius.dictionary_paths)
        else:
            self._dictionary_paths = tuple(dictionary_paths)

        # RADIUS packet codes (RFC 5176)
        self._coa_request_code = getattr(radius_packet, "CoARequest", 43)
        self._coa_ack_code = getattr(radius_packet, "CoAACK", 44)
        self._coa_nak_code = getattr(radius_packet, "CoANAK", 45)
        self._disconnect_request_code = getattr(radius_packet, "DisconnectRequest", 40)
        self._disconnect_ack_code = getattr(radius_packet, "DisconnectACK", 41)
        self._disconnect_nak_code = getattr(radius_packet, "DisconnectNAK", 42)

    def _load_radius_secret(self, tenant_id: str | None = None) -> str:
        """
        Load RADIUS shared secret from Vault or settings.

        In production, secrets MUST come from Vault.
        In development, falls back to settings if Vault is unavailable.

        Args:
            tenant_id: Optional tenant ID for multi-tenant secret lookup

        Returns:
            RADIUS shared secret

        Raises:
            RADIUSCoAError: If secret cannot be loaded in production
        """
        # Try Vault first if enabled
        if settings.vault.enabled:
            try:
                from dotmac.platform.secrets import get_vault_secret

                # Construct vault path based on tenant
                if tenant_id:
                    vault_path = f"radius/tenant-{tenant_id}/shared-secret"
                else:
                    vault_path = "radius/shared-secret"

                logger.info(
                    "Loading RADIUS secret from Vault",
                    vault_path=vault_path,
                    tenant_id=tenant_id,
                )

                secret_data = get_vault_secret(vault_path)
                if secret_data and "value" in secret_data:
                    logger.info("Successfully loaded RADIUS secret from Vault")
                    return str(secret_data["value"])

                logger.warning(
                    "RADIUS secret not found in Vault, falling back to settings",
                    vault_path=vault_path,
                )

            except Exception as e:
                logger.warning(
                    "Failed to load RADIUS secret from Vault, falling back to settings",
                    error=str(e),
                    tenant_id=tenant_id,
                )

        # Fallback to settings
        if settings.radius.shared_secret:
            if settings.is_production:
                logger.error(
                    "SECURITY WARNING: Using RADIUS secret from settings in production! "
                    "Secrets MUST be stored in Vault for production deployments."
                )
            else:
                logger.info("Using RADIUS secret from settings (development mode)")

            return str(settings.radius.shared_secret)

        # Development fallback for local testing when no secret is configured anywhere
        if not settings.is_production:
            fallback_secret = "changeme_radius_shared_secret"
            logger.warning(
                "Using fallback RADIUS secret for development. "
                "Set RADIUS_SECRET in .env or configure Vault to override.",
                tenant_id=tenant_id,
            )
            return fallback_secret

        # No secret available
        raise RADIUSCoAError(
            "RADIUS shared secret not configured. "
            "Set RADIUS_SECRET environment variable or configure Vault."
        )

    @cached_property
    def _dictionary(self) -> Dictionary:
        """Return the RADIUS dictionary to use for packet construction."""
        if self._dictionary_paths:
            return Dictionary(*self._dictionary_paths)
        return _load_default_dictionary()

    def _create_client(self) -> Client:
        """Instantiate a pyrad client configured for CoA operations."""
        client = Client(
            server=self.radius_server,
            secret=self.radius_secret.encode("utf-8"),
            dict=self._dictionary,
        )
        client.coaport = self.coa_port
        client.timeout = self.timeout
        return client

    async def disconnect_session(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Send Disconnect-Request (DM) to terminate a user session.

        Args:
            username: RADIUS username to disconnect
            nas_ip: NAS IP address (optional, helps with routing)
            session_id: Acct-Session-Id (optional, for specific session)

        Returns:
            Dictionary with result status and structured response details.
        """
        client = self._create_client()

        try:
            packet = client.CreateCoAPacket(code=self._disconnect_request_code)
            packet["User-Name"] = username

            if nas_ip:
                packet["NAS-IP-Address"] = self._validate_nas_ip(nas_ip)

            if session_id:
                packet["Acct-Session-Id"] = session_id

            response = await self._send_packet(client, packet)
        except (ValueError, RADIUSCoAError) as exc:
            logger.error(
                "radius_disconnect_failed",
                username=username,
                nas_ip=nas_ip,
                session_id=session_id,
                error=str(exc),
                exc_info=True,
            )
            return {
                "success": False,
                "message": f"Failed to send disconnect request: {exc}",
                "username": username,
                "error": str(exc),
            }

        success = response.code == self._disconnect_ack_code
        message = (
            "Disconnect acknowledged by RADIUS server"
            if success
            else f"Disconnect rejected (code={response.code})"
        )

        if success:
            logger.info(
                "radius_disconnect_sent",
                username=username,
                nas_ip=nas_ip,
                session_id=session_id,
                details=response.to_dict(),
            )
        else:
            logger.warning(
                "radius_disconnect_rejected",
                username=username,
                nas_ip=nas_ip,
                session_id=session_id,
                details=response.to_dict(),
            )

        return {
            "success": success,
            "message": message,
            "username": username,
            "details": response.to_dict(),
        }

    async def send_disconnect(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> bool:
        """Compatibility wrapper returning boolean success value."""
        result = await self.disconnect_session(username, nas_ip=nas_ip, session_id=session_id)
        return bool(result.get("success"))

    async def update_ipv6_prefix(
        self,
        username: str,
        delegated_prefix: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Send CoA request to update IPv6 delegated prefix (Phase 4).

        Args:
            username: RADIUS username
            delegated_prefix: IPv6 prefix in CIDR notation (e.g., "2001:db8::/56")
            nas_ip: NAS IP address
            session_id: Acct-Session-Id (optional, for specific session)

        Returns:
            Dictionary with result status and structured response details.
        """
        client = self._create_client()

        try:
            # Validate IPv6 prefix format
            if not delegated_prefix or "/" not in delegated_prefix:
                raise ValueError(f"Invalid IPv6 prefix format: {delegated_prefix}")

            # Create CoA packet with IPv6 prefix delegation attributes
            packet = client.CreateCoAPacket(code=self._coa_request_code)
            packet["User-Name"] = username

            # RFC 4818: Delegated-IPv6-Prefix
            # Format: prefix-length/prefix (e.g., "56 2001:db8::/56")
            prefix_parts = delegated_prefix.split("/")
            prefix_length = prefix_parts[1]
            # Some RADIUS implementations expect: "length prefix"
            packet["Delegated-IPv6-Prefix"] = f"{prefix_length} {delegated_prefix}"

            if nas_ip:
                packet["NAS-IP-Address"] = self._validate_nas_ip(nas_ip)

            if session_id:
                packet["Acct-Session-Id"] = session_id

            response = await self._send_packet(client, packet)
        except (ValueError, RADIUSCoAError) as exc:
            logger.error(
                "radius_coa_ipv6_failed",
                username=username,
                delegated_prefix=delegated_prefix,
                nas_ip=nas_ip,
                error=str(exc),
                exc_info=True,
            )
            return {
                "success": False,
                "message": f"Failed to send IPv6 CoA request: {exc}",
                "username": username,
                "delegated_prefix": delegated_prefix,
                "error": str(exc),
            }

        success = response.code == self._coa_ack_code
        message = (
            "IPv6 prefix update acknowledged by RADIUS server"
            if success
            else f"IPv6 prefix update rejected (code={response.code})"
        )

        if success:
            logger.info(
                "radius_coa_ipv6_sent",
                username=username,
                delegated_prefix=delegated_prefix,
                nas_ip=nas_ip,
                details=response.to_dict(),
            )
        else:
            logger.warning(
                "radius_coa_ipv6_rejected",
                username=username,
                delegated_prefix=delegated_prefix,
                nas_ip=nas_ip,
                details=response.to_dict(),
            )

        return {
            "success": success,
            "message": message,
            "username": username,
            "delegated_prefix": delegated_prefix,
            "details": response.to_dict(),
        }

    async def change_bandwidth(
        self,
        username: str,
        download_kbps: int,
        upload_kbps: int,
        nas_ip: str | None = None,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        nas_vendor: str | None = None,
    ) -> dict[str, Any]:
        """
        Send CoA request to change bandwidth limits with vendor-aware packet construction.

        Args:
            username: RADIUS username
            download_kbps: Download speed in Kbps
            upload_kbps: Upload speed in Kbps
            nas_ip: NAS IP address
            download_burst_kbps: Optional download burst speed in Kbps
            upload_burst_kbps: Optional upload burst speed in Kbps
            nas_vendor: Optional NAS vendor override (mikrotik, cisco, huawei, juniper)

        Returns:
            Dictionary with result status and structured response details.
        """
        from dotmac.platform.radius.vendors import get_coa_strategy
        from dotmac.platform.settings import settings

        client = self._create_client()

        try:
            if download_kbps <= 0 or upload_kbps <= 0:
                raise ValueError("Bandwidth values must be greater than zero")

            # Get vendor-specific CoA strategy
            if settings.radius.vendor_aware and nas_vendor:
                strategy = get_coa_strategy(vendor=nas_vendor, tenant_id=self.tenant_id)
                logger.info(
                    "Using vendor-specific CoA strategy",
                    vendor=nas_vendor,
                    username=username,
                )
            else:
                # Fallback to Mikrotik if vendor-aware disabled or vendor not specified
                from dotmac.platform.radius.vendors import MikrotikCoAStrategy

                strategy = MikrotikCoAStrategy()
                logger.debug(
                    "Using Mikrotik CoA strategy (default)",
                    username=username,
                )

            # Build vendor-specific CoA packet
            packet_attrs = strategy.build_bandwidth_change_packet(
                username=username,
                download_kbps=download_kbps,
                upload_kbps=upload_kbps,
                download_burst_kbps=download_burst_kbps,
                upload_burst_kbps=upload_burst_kbps,
                nas_ip=nas_ip,
            )

            # Create CoA packet and populate with vendor-specific attributes
            packet = client.CreateCoAPacket(code=self._coa_request_code)
            for attr_name, attr_value in packet_attrs.items():
                if attr_name == "NAS-IP-Address":
                    # Validate IP addresses
                    packet[attr_name] = self._validate_nas_ip(attr_value)
                else:
                    packet[attr_name] = attr_value

            response = await self._send_packet(client, packet)
        except (ValueError, RADIUSCoAError) as exc:
            logger.error(
                "radius_coa_bandwidth_failed",
                username=username,
                download_kbps=download_kbps,
                upload_kbps=upload_kbps,
                nas_ip=nas_ip,
                error=str(exc),
                exc_info=True,
            )
            return {
                "success": False,
                "message": f"Failed to send CoA request: {exc}",
                "username": username,
                "download_kbps": download_kbps,
                "upload_kbps": upload_kbps,
                "error": str(exc),
            }

        # Validate response using vendor-specific strategy
        success = strategy.validate_response(response.to_dict())
        message = (
            "Bandwidth change acknowledged by RADIUS server"
            if success
            else f"Bandwidth change rejected (code={response.code})"
        )

        if success:
            logger.info(
                "radius_coa_bandwidth_sent",
                username=username,
                download_kbps=download_kbps,
                upload_kbps=upload_kbps,
                vendor=nas_vendor or "mikrotik",
                details=response.to_dict(),
            )
        else:
            logger.warning(
                "radius_coa_bandwidth_rejected",
                username=username,
                download_kbps=download_kbps,
                upload_kbps=upload_kbps,
                vendor=nas_vendor or "mikrotik",
                details=response.to_dict(),
            )

        return {
            "success": success,
            "message": message,
            "username": username,
            "download_kbps": download_kbps,
            "upload_kbps": upload_kbps,
            "details": response.to_dict(),
        }

    async def _send_packet(self, client: Client, packet: Any) -> RadiusResponse:
        """Send a CoA packet and return a structured response."""
        try:
            reply = await asyncio.to_thread(client.SendPacket, packet)
        except Timeout as exc:
            raise RADIUSTimeoutError("RADIUS server did not respond to CoA request") from exc
        except Exception as exc:
            raise RADIUSCoAError("Failed to send CoA packet") from exc

        return self._parse_response(reply)

    def _parse_response(self, reply: Any) -> RadiusResponse:
        """Convert pyrad reply packet into structured data."""
        attributes: dict[str, list[Any]] = {}
        for attribute in reply.keys():
            values = reply[attribute]
            attributes[attribute] = list(values if isinstance(values, list) else [values])

        identifier = getattr(reply, "id", getattr(reply, "identifier", 0))
        return RadiusResponse(code=reply.code, identifier=identifier, attributes=attributes)

    @staticmethod
    def _validate_nas_ip(value: str) -> str:
        """Ensure NAS IP addresses are valid IPv4 or IPv6 strings."""
        parsed = ip_address(value)
        if isinstance(parsed, (IPv4Address, IPv6Address)):
            return str(parsed)
        raise ValueError("Invalid NAS IP address")


class CoAClientHTTP:
    """
    Alternative CoA implementation using HTTP API.

    Some RADIUS servers (like FreeRADIUS 3.2+) can expose a REST API
    for CoA/DM operations. This client uses that instead of radclient.

    This is useful when:
    - radclient is not available in container
    - You want centralized CoA server
    - You need queuing and retry logic
    """

    def __init__(
        self,
        api_url: str = "http://localhost:8080/coa",
        api_key: str | None = None,
        timeout: int = 5,
    ):
        """
        Initialize HTTP CoA client.

        Args:
            api_url: CoA API endpoint URL
            api_key: API authentication key
            timeout: Request timeout in seconds
        """
        self.api_url = api_url
        self.api_key = api_key
        self.timeout = timeout

    async def disconnect_session(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Send disconnect request via HTTP API.

        Args:
            username: RADIUS username to disconnect
            nas_ip: NAS IP address
            session_id: Acct-Session-Id

        Returns:
            Dictionary with result status
        """
        payload = {
            "action": "disconnect",
            "username": username,
            "nas_ip": nas_ip,
            "session_id": session_id,
        }

        try:
            async with httpx.AsyncClient() as client:
                headers = {}
                if self.api_key:
                    headers["Authorization"] = f"Bearer {self.api_key}"

                response = await client.post(
                    f"{self.api_url}/disconnect",
                    json=payload,
                    headers=headers,
                    timeout=self.timeout,
                )

                response.raise_for_status()
                result = response.json()

                logger.info(
                    "radius_disconnect_http_sent",
                    username=username,
                    result=result,
                )

                return {
                    "success": True,
                    "message": "Disconnect request sent via HTTP API",
                    "username": username,
                    "details": result,
                }

        except Exception as e:
            logger.error(
                "radius_disconnect_http_failed",
                username=username,
                error=str(e),
                exc_info=True,
            )

            return {
                "success": False,
                "message": f"Failed to send disconnect via HTTP: {str(e)}",
                "username": username,
                "error": str(e),
            }

    async def send_disconnect(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> bool:
        result = await self.disconnect_session(username, nas_ip=nas_ip, session_id=session_id)
        return bool(result.get("success"))


async def disconnect_session_helper(
    username: str,
    nas_ip: str | None = None,
    session_id: str | None = None,
    radius_server: str | None = None,
    coa_port: int | None = None,
    radius_secret: str | None = None,
    use_http: bool | None = None,
    http_api_url: str | None = None,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    """
    Helper function to disconnect a RADIUS session.

    Automatically chooses between native RADIUS (pyrad) and HTTP API based on configuration.

    Args:
        username: RADIUS username to disconnect
        nas_ip: NAS IP address
        session_id: Acct-Session-Id
        radius_server: RADIUS server hostname/IP
        coa_port: CoA port number
        radius_secret: RADIUS shared secret
        use_http: Use HTTP API instead of radclient
        http_api_url: HTTP API endpoint URL
        tenant_id: Tenant identifier for per-tenant secrets

    Returns:
        Dictionary with disconnect result
    """
    effective_use_http = settings.radius.use_http_api if use_http is None else use_http

    if effective_use_http:
        api_url = http_api_url or settings.radius.http_api_url
        if not api_url:
            raise RADIUSCoAError("HTTP API requested for CoA but no URL is configured")

        http_client = CoAClientHTTP(
            api_url=api_url,
            api_key=settings.radius.http_api_key or None,
            timeout=settings.radius.timeout_seconds,
        )
        return await http_client.disconnect_session(
            username=username,
            nas_ip=nas_ip,
            session_id=session_id,
        )
    else:
        client_kwargs: dict[str, Any] = {"tenant_id": tenant_id}

        if radius_server:
            client_kwargs["radius_server"] = radius_server
        if coa_port:
            client_kwargs["coa_port"] = coa_port
        if radius_secret:
            client_kwargs["radius_secret"] = radius_secret

        radclient = CoAClient(**client_kwargs)
        return await radclient.disconnect_session(
            username=username,
            nas_ip=nas_ip,
            session_id=session_id,
        )

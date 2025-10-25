"""
Base types and protocols for multi-vendor RADIUS support.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol


class NASVendor(str, Enum):
    """Supported NAS vendor types."""

    MIKROTIK = "mikrotik"
    CISCO = "cisco"
    HUAWEI = "huawei"
    JUNIPER = "juniper"
    GENERIC = "generic"  # Fallback for unknown vendors


@dataclass(frozen=True)
class RadReplySpec:
    """
    Specification for a RADIUS reply attribute.

    Used by bandwidth builders to generate vendor-specific radreply entries.
    """

    attribute: str
    value: str
    op: str = "="
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for database storage."""
        return {
            "attribute": self.attribute,
            "value": self.value,
            "op": self.op,
        }


class BandwidthAttributeBuilder(Protocol):
    """
    Protocol for building vendor-specific bandwidth attributes.

    Implementations generate RADIUS reply attributes (radreply) and
    CoA payloads that match each vendor's expected format.
    """

    vendor: NASVendor

    def build_radreply(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        profile_name: str | None = None,
    ) -> list[RadReplySpec]:
        """
        Build RADIUS reply attributes for bandwidth control.

        Args:
            download_rate_kbps: Download speed in Kbps
            upload_rate_kbps: Upload speed in Kbps
            download_burst_kbps: Optional download burst in Kbps
            upload_burst_kbps: Optional upload burst in Kbps
            profile_name: Optional profile name for reference

        Returns:
            List of RADIUS reply attribute specifications
        """
        ...

    def build_coa_attributes(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
    ) -> dict[str, str]:
        """
        Build CoA packet attributes for bandwidth change.

        Args:
            download_rate_kbps: Download speed in Kbps
            upload_rate_kbps: Upload speed in Kbps
            download_burst_kbps: Optional download burst in Kbps
            upload_burst_kbps: Optional upload burst in Kbps

        Returns:
            Dictionary of RADIUS attribute name -> value
        """
        ...


class CoAStrategy(Protocol):
    """
    Protocol for vendor-specific CoA/DM operations.

    Handles building CoA packets and validating responses
    according to vendor-specific requirements.
    """

    vendor: NASVendor

    def build_bandwidth_change_packet(
        self,
        username: str,
        download_kbps: int,
        upload_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        nas_ip: str | None = None,
    ) -> dict[str, Any]:
        """
        Build vendor-specific CoA packet for bandwidth change.

        Args:
            username: RADIUS username
            download_kbps: Download speed in Kbps
            upload_kbps: Upload speed in Kbps
            download_burst_kbps: Optional download burst
            upload_burst_kbps: Optional upload burst
            nas_ip: NAS IP address

        Returns:
            Dictionary of packet attributes
        """
        ...

    def build_disconnect_packet(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Build vendor-specific disconnect packet.

        Args:
            username: RADIUS username
            nas_ip: NAS IP address
            session_id: Session ID

        Returns:
            Dictionary of packet attributes
        """
        ...

    def validate_response(self, response: dict[str, Any]) -> bool:
        """
        Validate vendor-specific CoA response.

        Args:
            response: CoA response from RADIUS server

        Returns:
            True if response indicates success
        """
        ...

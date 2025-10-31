"""
Vendor-specific CoA strategy implementations.

Each strategy builds CoA/DM packets according to vendor-specific requirements.
"""

from __future__ import annotations

from typing import Any

import structlog

from dotmac.platform.radius.vendors.base import NASVendor

logger = structlog.get_logger(__name__)


class MikrotikCoAStrategy:
    """Mikrotik CoA strategy."""

    vendor = NASVendor.MIKROTIK

    def build_bandwidth_change_packet(
        self,
        username: str,
        download_kbps: int,
        upload_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        nas_ip: str | None = None,
    ) -> dict[str, Any]:
        """Build Mikrotik CoA packet for bandwidth change."""
        # Mikrotik format: download/upload [download_burst/upload_burst]
        rate_limit = f"{download_kbps}k/{upload_kbps}k"

        if download_burst_kbps and upload_burst_kbps:
            rate_limit += f" {download_burst_kbps}k/{upload_burst_kbps}k"

        packet = {
            "User-Name": username,
            "Mikrotik-Rate-Limit": rate_limit,
        }

        if nas_ip:
            packet["NAS-IP-Address"] = nas_ip

        logger.debug(
            "Built Mikrotik CoA bandwidth change packet",
            username=username,
            rate_limit=rate_limit,
        )

        return packet

    def build_disconnect_packet(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Build Mikrotik disconnect packet."""
        packet = {"User-Name": username}

        if nas_ip:
            packet["NAS-IP-Address"] = nas_ip

        if session_id:
            packet["Acct-Session-Id"] = session_id

        return packet

    def validate_response(self, response: dict[str, Any]) -> bool:
        """Validate Mikrotik CoA response."""
        # Check for CoA-ACK (code 44) or Disconnect-ACK (code 41)
        code = response.get("code")
        return code in [41, 44]


class CiscoCoAStrategy:
    """Cisco CoA strategy."""

    vendor = NASVendor.CISCO

    def build_bandwidth_change_packet(
        self,
        username: str,
        download_kbps: int,
        upload_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        nas_ip: str | None = None,
    ) -> dict[str, Any]:
        """Build Cisco CoA packet for bandwidth change."""
        # Convert to bps for Cisco
        input_rate_bps = upload_kbps * 1000
        output_rate_bps = download_kbps * 1000

        packet = {
            "User-Name": username,
            "Cisco-AVPair": f"subscriber:rate-limit={input_rate_bps} {output_rate_bps}",
        }

        if nas_ip:
            packet["NAS-IP-Address"] = nas_ip

        logger.debug(
            "Built Cisco CoA bandwidth change packet",
            username=username,
            input_rate_bps=input_rate_bps,
            output_rate_bps=output_rate_bps,
        )

        return packet

    def build_disconnect_packet(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Build Cisco disconnect packet."""
        packet = {"User-Name": username}

        if nas_ip:
            packet["NAS-IP-Address"] = nas_ip

        if session_id:
            packet["Acct-Session-Id"] = session_id

        # Cisco may require specific disconnect cause
        packet["Acct-Terminate-Cause"] = "Admin-Reset"

        return packet

    def validate_response(self, response: dict[str, Any]) -> bool:
        """Validate Cisco CoA response."""
        code = response.get("code")
        return code in [41, 44]


class HuaweiCoAStrategy:
    """Huawei CoA strategy."""

    vendor = NASVendor.HUAWEI

    def build_bandwidth_change_packet(
        self,
        username: str,
        download_kbps: int,
        upload_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        nas_ip: str | None = None,
    ) -> dict[str, Any]:
        """Build Huawei CoA packet for bandwidth change."""
        packet = {
            "User-Name": username,
            "Huawei-Input-Rate-Limit": str(upload_kbps),
            "Huawei-Output-Rate-Limit": str(download_kbps),
        }

        if download_burst_kbps:
            packet["Huawei-Output-Peak-Rate"] = str(download_burst_kbps)

        if upload_burst_kbps:
            packet["Huawei-Input-Peak-Rate"] = str(upload_burst_kbps)

        if nas_ip:
            packet["NAS-IP-Address"] = nas_ip

        logger.debug(
            "Built Huawei CoA bandwidth change packet",
            username=username,
            download_kbps=download_kbps,
            upload_kbps=upload_kbps,
        )

        return packet

    def build_disconnect_packet(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Build Huawei disconnect packet."""
        packet = {"User-Name": username}

        if nas_ip:
            packet["NAS-IP-Address"] = nas_ip

        if session_id:
            packet["Acct-Session-Id"] = session_id

        return packet

    def validate_response(self, response: dict[str, Any]) -> bool:
        """Validate Huawei CoA response."""
        code = response.get("code")
        return code in [41, 44]


class JuniperCoAStrategy:
    """Juniper CoA strategy."""

    vendor = NASVendor.JUNIPER

    def build_bandwidth_change_packet(
        self,
        username: str,
        download_kbps: int,
        upload_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        nas_ip: str | None = None,
    ) -> dict[str, Any]:
        """Build Juniper CoA packet for bandwidth change."""
        # Convert to bps for Juniper
        upload_rate_bps = upload_kbps * 1000
        download_rate_bps = download_kbps * 1000

        packet = {
            "User-Name": username,
            "Juniper-Rate-Limit-In": str(upload_rate_bps),
            "Juniper-Rate-Limit-Out": str(download_rate_bps),
        }

        if nas_ip:
            packet["NAS-IP-Address"] = nas_ip

        logger.debug(
            "Built Juniper CoA bandwidth change packet",
            username=username,
            upload_rate_bps=upload_rate_bps,
            download_rate_bps=download_rate_bps,
        )

        return packet

    def build_disconnect_packet(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Build Juniper disconnect packet."""
        packet = {"User-Name": username}

        if nas_ip:
            packet["NAS-IP-Address"] = nas_ip

        if session_id:
            packet["Acct-Session-Id"] = session_id

        return packet

    def validate_response(self, response: dict[str, Any]) -> bool:
        """Validate Juniper CoA response."""
        code = response.get("code")
        return code in [41, 44]

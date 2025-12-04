"""
Vendor-specific bandwidth attribute builders.

Each builder generates RADIUS reply attributes and CoA payloads
according to vendor-specific requirements.
"""

from __future__ import annotations

import structlog

from dotmac.platform.radius.vendors.base import (
    NASVendor,
    RadReplySpec,
)

logger = structlog.get_logger(__name__)


class MikrotikBandwidthBuilder:
    """
    Mikrotik bandwidth attribute builder.

    Uses Mikrotik-Rate-Limit VSA (Vendor-Specific Attribute).
    Format: "rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate]] [burst-threshold] [burst-time] [priority] [min-rx-rate[/min-tx-rate]]"

    Example: "10000k/5000k 15000k/7500k"
    """

    vendor = NASVendor.MIKROTIK

    def build_radreply(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        profile_name: str | None = None,
    ) -> list[RadReplySpec]:
        """Build Mikrotik-Rate-Limit attribute."""
        # Mikrotik format: download/upload [download_burst/upload_burst]
        rate_limit = f"{download_rate_kbps}k/{upload_rate_kbps}k"

        if download_burst_kbps and upload_burst_kbps:
            rate_limit += f" {download_burst_kbps}k/{upload_burst_kbps}k"

        attributes = [
            RadReplySpec(
                attribute="Mikrotik-Rate-Limit",
                value=rate_limit,
                op="=",
                metadata={
                    "vendor": "mikrotik",
                    "download_kbps": download_rate_kbps,
                    "upload_kbps": upload_rate_kbps,
                },
            )
        ]

        logger.debug(
            "Built Mikrotik bandwidth attributes",
            rate_limit=rate_limit,
            profile_name=profile_name,
        )

        return attributes

    def build_coa_attributes(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
    ) -> dict[str, str]:
        """Build Mikrotik CoA attributes."""
        rate_limit = f"{download_rate_kbps}k/{upload_rate_kbps}k"

        if download_burst_kbps and upload_burst_kbps:
            rate_limit += f" {download_burst_kbps}k/{upload_burst_kbps}k"

        return {"Mikrotik-Rate-Limit": rate_limit}


class CiscoBandwidthBuilder:
    """
    Cisco bandwidth attribute builder.

    Uses Cisco-AVPair for subscriber QoS policies.
    Supports multiple AVPair formats:
    - ip:sub-qos-policy-in=<policy-name>
    - ip:sub-qos-policy-out=<policy-name>
    - subscriber:sub-qos-policy-in=<policy-name>
    - subscriber:sub-qos-policy-out=<policy-name>

    For explicit rate limiting:
    - ip:rate-limit=<input-rate> <output-rate>
    """

    vendor = NASVendor.CISCO

    def build_radreply(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        profile_name: str | None = None,
    ) -> list[RadReplySpec]:
        """Build Cisco-AVPair attributes for QoS."""
        attributes = []

        # If profile name provided, use policy-based approach
        if profile_name:
            attributes.extend(
                [
                    RadReplySpec(
                        attribute="Cisco-AVPair",
                        value=f"subscriber:sub-qos-policy-in={profile_name}",
                        op="+=",
                        metadata={"vendor": "cisco", "direction": "input"},
                    ),
                    RadReplySpec(
                        attribute="Cisco-AVPair",
                        value=f"subscriber:sub-qos-policy-out={profile_name}",
                        op="+=",
                        metadata={"vendor": "cisco", "direction": "output"},
                    ),
                ]
            )
        else:
            # Use rate-based approach (convert Kbps to bps for Cisco)
            input_rate_bps = upload_rate_kbps * 1000
            output_rate_bps = download_rate_kbps * 1000

            attributes.append(
                RadReplySpec(
                    attribute="Cisco-AVPair",
                    value=f"ip:rate-limit={input_rate_bps} {output_rate_bps}",
                    op="+=",
                    metadata={
                        "vendor": "cisco",
                        "download_kbps": download_rate_kbps,
                        "upload_kbps": upload_rate_kbps,
                    },
                )
            )

        logger.debug(
            "Built Cisco bandwidth attributes",
            profile_name=profile_name,
            download_kbps=download_rate_kbps,
            upload_kbps=upload_rate_kbps,
        )

        return attributes

    def build_coa_attributes(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
    ) -> dict[str, str]:
        """Build Cisco CoA attributes."""
        # Cisco CoA typically uses policy change via AVPair
        # This is a simplified version - real deployments may use more complex policies
        input_rate_bps = upload_rate_kbps * 1000
        output_rate_bps = download_rate_kbps * 1000

        return {"Cisco-AVPair": f"subscriber:rate-limit={input_rate_bps} {output_rate_bps}"}


class HuaweiBandwidthBuilder:
    """
    Huawei bandwidth attribute builder.

    Uses Huawei VSAs:
    - Huawei-Qos-Profile-Name: QoS profile name
    - Huawei-Input-Rate-Limit: Upload rate limit
    - Huawei-Output-Rate-Limit: Download rate limit
    - Huawei-Input-Peak-Rate: Upload burst
    - Huawei-Output-Peak-Rate: Download burst
    """

    vendor = NASVendor.HUAWEI

    def build_radreply(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        profile_name: str | None = None,
    ) -> list[RadReplySpec]:
        """Build Huawei QoS attributes."""
        attributes = []

        # If profile name provided, use profile-based approach
        if profile_name:
            attributes.append(
                RadReplySpec(
                    attribute="Huawei-Qos-Profile-Name",
                    value=profile_name,
                    op="=",
                    metadata={"vendor": "huawei"},
                )
            )

        # Add explicit rate limits (Huawei expects Kbps)
        attributes.extend(
            [
                RadReplySpec(
                    attribute="Huawei-Input-Rate-Limit",
                    value=str(upload_rate_kbps),
                    op="=",
                    metadata={"vendor": "huawei", "direction": "upload"},
                ),
                RadReplySpec(
                    attribute="Huawei-Output-Rate-Limit",
                    value=str(download_rate_kbps),
                    op="=",
                    metadata={"vendor": "huawei", "direction": "download"},
                ),
            ]
        )

        # Add burst rates if provided
        if download_burst_kbps:
            attributes.append(
                RadReplySpec(
                    attribute="Huawei-Output-Peak-Rate",
                    value=str(download_burst_kbps),
                    op="=",
                    metadata={"vendor": "huawei", "direction": "download_burst"},
                )
            )

        if upload_burst_kbps:
            attributes.append(
                RadReplySpec(
                    attribute="Huawei-Input-Peak-Rate",
                    value=str(upload_burst_kbps),
                    op="=",
                    metadata={"vendor": "huawei", "direction": "upload_burst"},
                )
            )

        logger.debug(
            "Built Huawei bandwidth attributes",
            profile_name=profile_name,
            download_kbps=download_rate_kbps,
            upload_kbps=upload_rate_kbps,
        )

        return attributes

    def build_coa_attributes(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
    ) -> dict[str, str]:
        """Build Huawei CoA attributes."""
        attributes = {
            "Huawei-Input-Rate-Limit": str(upload_rate_kbps),
            "Huawei-Output-Rate-Limit": str(download_rate_kbps),
        }

        if download_burst_kbps:
            attributes["Huawei-Output-Peak-Rate"] = str(download_burst_kbps)

        if upload_burst_kbps:
            attributes["Huawei-Input-Peak-Rate"] = str(upload_burst_kbps)

        return attributes


class JuniperBandwidthBuilder:
    """
    Juniper bandwidth attribute builder.

    Uses Juniper VSAs:
    - ERX-Qos-Profile-Name: QoS profile name
    - ERX-Ingress-Policy-Name: Ingress (upload) policy
    - ERX-Egress-Policy-Name: Egress (download) policy
    - Juniper-Rate-Limit-In: Upload rate (alternative)
    - Juniper-Rate-Limit-Out: Download rate (alternative)
    """

    vendor = NASVendor.JUNIPER

    def build_radreply(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
        profile_name: str | None = None,
    ) -> list[RadReplySpec]:
        """Build Juniper QoS attributes."""
        attributes = []

        # If profile name provided, use profile-based approach
        if profile_name:
            attributes.extend(
                [
                    RadReplySpec(
                        attribute="ERX-Qos-Profile-Name",
                        value=profile_name,
                        op="=",
                        metadata={"vendor": "juniper"},
                    ),
                    RadReplySpec(
                        attribute="ERX-Ingress-Policy-Name",
                        value=f"{profile_name}-qos-in",
                        op="=",
                        metadata={"vendor": "juniper", "direction": "ingress"},
                    ),
                    RadReplySpec(
                        attribute="ERX-Egress-Policy-Name",
                        value=f"{profile_name}-qos-out",
                        op="=",
                        metadata={"vendor": "juniper", "direction": "egress"},
                    ),
                ]
            )
        else:
            # Use rate-based approach (Juniper expects bps, so multiply by 1000)
            upload_rate_bps = upload_rate_kbps * 1000
            download_rate_bps = download_rate_kbps * 1000

            attributes.extend(
                [
                    RadReplySpec(
                        attribute="Juniper-Rate-Limit-In",
                        value=str(upload_rate_bps),
                        op="=",
                        metadata={"vendor": "juniper", "direction": "upload"},
                    ),
                    RadReplySpec(
                        attribute="Juniper-Rate-Limit-Out",
                        value=str(download_rate_bps),
                        op="=",
                        metadata={"vendor": "juniper", "direction": "download"},
                    ),
                ]
            )

        logger.debug(
            "Built Juniper bandwidth attributes",
            profile_name=profile_name,
            download_kbps=download_rate_kbps,
            upload_kbps=upload_rate_kbps,
        )

        return attributes

    def build_coa_attributes(
        self,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
    ) -> dict[str, str]:
        """Build Juniper CoA attributes."""
        upload_rate_bps = upload_rate_kbps * 1000
        download_rate_bps = download_rate_kbps * 1000

        return {
            "Juniper-Rate-Limit-In": str(upload_rate_bps),
            "Juniper-Rate-Limit-Out": str(download_rate_bps),
        }

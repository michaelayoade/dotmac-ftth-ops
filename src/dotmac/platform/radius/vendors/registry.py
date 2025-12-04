"""
Vendor capability registry and factory.

Provides runtime lookup of bandwidth builders and CoA strategies
based on NAS vendor type.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from dotmac.platform.radius.vendors.base import (
    BandwidthAttributeBuilder,
    CoAStrategy,
    NASVendor,
)
from dotmac.platform.radius.vendors.builders import (
    CiscoBandwidthBuilder,
    HuaweiBandwidthBuilder,
    JuniperBandwidthBuilder,
    MikrotikBandwidthBuilder,
)
from dotmac.platform.radius.vendors.coa_strategies import (
    CiscoCoAStrategy,
    HuaweiCoAStrategy,
    JuniperCoAStrategy,
    MikrotikCoAStrategy,
)

if TYPE_CHECKING:
    pass

logger = structlog.get_logger(__name__)


# Global registries
_BANDWIDTH_BUILDERS: dict[NASVendor, type[BandwidthAttributeBuilder]] = {
    NASVendor.MIKROTIK: MikrotikBandwidthBuilder,
    NASVendor.CISCO: CiscoBandwidthBuilder,
    NASVendor.HUAWEI: HuaweiBandwidthBuilder,
    NASVendor.JUNIPER: JuniperBandwidthBuilder,
    NASVendor.GENERIC: MikrotikBandwidthBuilder,  # Default fallback
}

_COA_STRATEGIES: dict[NASVendor, type[CoAStrategy]] = {
    NASVendor.MIKROTIK: MikrotikCoAStrategy,
    NASVendor.CISCO: CiscoCoAStrategy,
    NASVendor.HUAWEI: HuaweiCoAStrategy,
    NASVendor.JUNIPER: JuniperCoAStrategy,
    NASVendor.GENERIC: MikrotikCoAStrategy,  # Default fallback
}

# Tenant-specific overrides: {tenant_id: {vendor: builder_class}}
_TENANT_BANDWIDTH_OVERRIDES: dict[str, dict[NASVendor, type[BandwidthAttributeBuilder]]] = {}
_TENANT_COA_OVERRIDES: dict[str, dict[NASVendor, type[CoAStrategy]]] = {}


def get_bandwidth_builder(
    vendor: NASVendor | str | None = None,
    tenant_id: str | None = None,
) -> BandwidthAttributeBuilder:
    """
    Get bandwidth attribute builder for vendor.

    Args:
        vendor: NAS vendor type (defaults to Mikrotik)
        tenant_id: Optional tenant ID for tenant-specific overrides

    Returns:
        Bandwidth attribute builder instance
    """
    # Normalize vendor to enum
    if vendor is None:
        vendor = NASVendor.MIKROTIK
    elif isinstance(vendor, str):
        try:
            vendor = NASVendor(vendor.lower())
        except ValueError:
            logger.warning(
                "Unknown vendor, falling back to Mikrotik",
                vendor=vendor,
                tenant_id=tenant_id,
            )
            vendor = NASVendor.MIKROTIK

    # Check for tenant-specific override
    if tenant_id and tenant_id in _TENANT_BANDWIDTH_OVERRIDES:
        tenant_overrides = _TENANT_BANDWIDTH_OVERRIDES[tenant_id]
        if vendor in tenant_overrides:
            builder_class = tenant_overrides[vendor]
            logger.debug(
                "Using tenant-specific bandwidth builder",
                vendor=vendor,
                tenant_id=tenant_id,
                builder=builder_class.__name__,
            )
            return builder_class()

    # Get from global registry
    builder_class = _BANDWIDTH_BUILDERS.get(vendor, MikrotikBandwidthBuilder)

    logger.debug(
        "Using bandwidth builder",
        vendor=vendor,
        builder=builder_class.__name__,
    )

    return builder_class()


def get_coa_strategy(
    vendor: NASVendor | str | None = None,
    tenant_id: str | None = None,
) -> CoAStrategy:
    """
    Get CoA strategy for vendor.

    Args:
        vendor: NAS vendor type (defaults to Mikrotik)
        tenant_id: Optional tenant ID for tenant-specific overrides

    Returns:
        CoA strategy instance
    """
    # Normalize vendor to enum
    if vendor is None:
        vendor = NASVendor.MIKROTIK
    elif isinstance(vendor, str):
        try:
            vendor = NASVendor(vendor.lower())
        except ValueError:
            logger.warning(
                "Unknown vendor, falling back to Mikrotik",
                vendor=vendor,
                tenant_id=tenant_id,
            )
            vendor = NASVendor.MIKROTIK

    # Check for tenant-specific override
    if tenant_id and tenant_id in _TENANT_COA_OVERRIDES:
        tenant_overrides = _TENANT_COA_OVERRIDES[tenant_id]
        if vendor in tenant_overrides:
            strategy_class = tenant_overrides[vendor]
            logger.debug(
                "Using tenant-specific CoA strategy",
                vendor=vendor,
                tenant_id=tenant_id,
                strategy=strategy_class.__name__,
            )
            return strategy_class()

    # Get from global registry
    strategy_class = _COA_STRATEGIES.get(vendor, MikrotikCoAStrategy)

    logger.debug(
        "Using CoA strategy",
        vendor=vendor,
        strategy=strategy_class.__name__,
    )

    return strategy_class()


def register_vendor_override(
    tenant_id: str,
    vendor: NASVendor,
    bandwidth_builder: type[BandwidthAttributeBuilder] | None = None,
    coa_strategy: type[CoAStrategy] | None = None,
) -> None:
    """
    Register tenant-specific vendor overrides.

    Allows MSPs to customize vendor behavior per tenant without code changes.

    Args:
        tenant_id: Tenant identifier
        vendor: NAS vendor type
        bandwidth_builder: Optional custom bandwidth builder class
        coa_strategy: Optional custom CoA strategy class
    """
    if bandwidth_builder:
        if tenant_id not in _TENANT_BANDWIDTH_OVERRIDES:
            _TENANT_BANDWIDTH_OVERRIDES[tenant_id] = {}
        _TENANT_BANDWIDTH_OVERRIDES[tenant_id][vendor] = bandwidth_builder

        logger.info(
            "Registered tenant bandwidth builder override",
            tenant_id=tenant_id,
            vendor=vendor,
            builder=bandwidth_builder.__name__,
        )

    if coa_strategy:
        if tenant_id not in _TENANT_COA_OVERRIDES:
            _TENANT_COA_OVERRIDES[tenant_id] = {}
        _TENANT_COA_OVERRIDES[tenant_id][vendor] = coa_strategy

        logger.info(
            "Registered tenant CoA strategy override",
            tenant_id=tenant_id,
            vendor=vendor,
            strategy=coa_strategy.__name__,
        )


def get_supported_vendors() -> list[NASVendor]:
    """
    Get list of supported NAS vendors.

    Returns:
        List of supported vendor types
    """
    return list(_BANDWIDTH_BUILDERS.keys())


def clear_tenant_overrides(tenant_id: str) -> None:
    """
    Clear all tenant-specific overrides.

    Args:
        tenant_id: Tenant identifier
    """
    _TENANT_BANDWIDTH_OVERRIDES.pop(tenant_id, None)
    _TENANT_COA_OVERRIDES.pop(tenant_id, None)

    logger.info("Cleared tenant overrides", tenant_id=tenant_id)

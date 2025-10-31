"""
RADIUS Vendor Support

Multi-vendor NAS capability system for generating vendor-specific
RADIUS attributes and CoA payloads.

Supports:
- Mikrotik (default)
- Cisco
- Huawei
- Juniper
- Generic fallback

Architecture:
- Strategy pattern for bandwidth attribute generation
- Vendor-specific CoA payload builders
- Capability registry for NAS metadata
- Tenant-level overrides
"""

from dotmac.platform.radius.vendors.base import (
    BandwidthAttributeBuilder,
    CoAStrategy,
    NASVendor,
    RadReplySpec,
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
from dotmac.platform.radius.vendors.registry import (
    get_bandwidth_builder,
    get_coa_strategy,
    register_vendor_override,
)

__all__ = [
    # Enums and base types
    "NASVendor",
    "RadReplySpec",
    # Protocols
    "BandwidthAttributeBuilder",
    "CoAStrategy",
    # Builders
    "MikrotikBandwidthBuilder",
    "CiscoBandwidthBuilder",
    "HuaweiBandwidthBuilder",
    "JuniperBandwidthBuilder",
    # CoA Strategies
    "MikrotikCoAStrategy",
    "CiscoCoAStrategy",
    "HuaweiCoAStrategy",
    "JuniperCoAStrategy",
    # Registry
    "get_bandwidth_builder",
    "get_coa_strategy",
    "register_vendor_override",
]

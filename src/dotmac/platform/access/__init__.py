"""
Access network driver framework.

This package provides a vendor-agnostic abstraction for managing Optical Line
Terminal (OLT) platforms. Individual drivers implement the operations using
the protocols that each vendor exposes (VOLTHA, CLI, SNMP, proprietary APIs,
etc.).
"""

from .service import AccessNetworkService, OLTOverview  # noqa: F401
from .registry import AccessDriverRegistry, DriverDescriptor  # noqa: F401

__all__ = [
    "AccessNetworkService",
    "AccessDriverRegistry",
    "DriverDescriptor",
    "OLTOverview",
]

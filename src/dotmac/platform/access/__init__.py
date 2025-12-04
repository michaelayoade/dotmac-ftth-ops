"""
Access network driver framework.

This package provides a vendor-agnostic abstraction for managing Optical Line
Terminal (OLT) and access network platforms. Individual drivers implement the
operations using the protocols that each vendor exposes (VOLTHA, CLI, SNMP,
proprietary APIs, etc.).

Stack Placement: ISP-ONLY
-------------------------
This module is deployed ONLY in the ISP tenant stack (docker-compose.isp.yml).
It should NOT be included in the platform admin stack. Each ISP tenant uses
their own OLT/access infrastructure with vendor-specific drivers.

Maturity: Beta (~70%)
---------------------
- Driver registry and base interface: Complete
- VOLTHA driver adapter: Complete
- Huawei OLT driver (CLI/SNMP): Complete
- Mikrotik RouterOS driver (API): Complete
- SNMP collector: Complete
- Feature flag for alarm actions: Implemented

Available Drivers:
- drivers/voltha.py: VOLTHA PON management (OLT/ONU)
- drivers/huawei.py: Huawei OLT driver (SSH CLI + SNMP)
- drivers/mikrotik.py: Mikrotik RouterOS for PPPoE/Hotspot/DHCP access
- drivers/base.py: Abstract base driver interface

Feature Flags:
- pon_alarm_actions_enabled: Controls alarm ack/clear operations per vendor
"""

from .registry import AccessDriverRegistry, DriverDescriptor  # noqa: F401
from .service import AccessNetworkService, OLTOverview  # noqa: F401

__all__ = [
    "AccessNetworkService",
    "AccessDriverRegistry",
    "DriverDescriptor",
    "OLTOverview",
]

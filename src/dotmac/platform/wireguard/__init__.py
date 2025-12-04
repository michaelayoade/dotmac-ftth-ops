"""
WireGuard VPN Management Module.

Provides WireGuard VPN server and peer management for ISP operations.
Used primarily for secure tunnels between the cloud platform and
remote OLT/network equipment at customer sites.

Stack Placement: ISP-ONLY
-------------------------
This module is deployed ONLY in the ISP tenant stack (docker-compose.isp.yml).
It should NOT be included in the platform admin stack. Each ISP tenant manages
their own VPN tunnels for secure access to remote network equipment.

Maturity: Beta (~75%)
---------------------
- Server and peer management: Complete
- Key generation and configuration: Complete
- Status monitoring: Complete
- Integration with Access module for OLT tunnels: Complete
"""

from dotmac.platform.wireguard.client import WireGuardClient
from dotmac.platform.wireguard.models import (
    WireGuardPeer,
    WireGuardPeerStatus,
    WireGuardServer,
    WireGuardServerStatus,
)
from dotmac.platform.wireguard.service import WireGuardService

__all__ = [
    "WireGuardClient",
    "WireGuardService",
    "WireGuardServer",
    "WireGuardServerStatus",
    "WireGuardPeer",
    "WireGuardPeerStatus",
]

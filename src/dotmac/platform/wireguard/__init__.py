"""
WireGuard VPN Management Module.

Provides WireGuard VPN server and peer management for ISP operations.
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

"""
API Gateway module for DotMac Platform Services.

Provides centralized request routing, rate limiting, circuit breaking,
and gateway-specific middleware.
"""

from dotmac.platform.api.gateway import APIGateway
from dotmac.platform.api.routing import Route, RouteRegistry

__all__ = [
    "APIGateway",
    "RouteRegistry",
    "Route",
]

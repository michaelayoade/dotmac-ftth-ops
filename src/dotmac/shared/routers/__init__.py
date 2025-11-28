"""
Declarative Router Registry.

Single source of truth for all API route registrations across services.
"""

from .registry import (
    RouterEntry,
    ServiceScope,
    ROUTER_REGISTRY,
    get_routers_for_scope,
    register_routers_for_scope,
)

__all__ = [
    "RouterEntry",
    "ServiceScope",
    "ROUTER_REGISTRY",
    "get_routers_for_scope",
    "register_routers_for_scope",
]

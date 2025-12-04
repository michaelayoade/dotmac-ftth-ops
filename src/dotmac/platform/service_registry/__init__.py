"""
Service Registry using HashiCorp Consul.
Provides service registration, deregistration, discovery, and health checking.
"""

from typing import Any

from .consul_registry import (
    ConsulServiceInfo,
    ConsulServiceRegistry,
    deregister_service,
    discover_services,
    get_consul_registry,
    get_healthy_services,
    register_service,
)
from .models import ServiceHealth, ServiceInfo, ServiceStatus

# Optional HTTP client with service discovery
ServiceClient: type[Any] | None
try:
    from .client import ServiceClient as _ImportedServiceClient

    ServiceClient = _ImportedServiceClient
except ImportError:
    ServiceClient = None

# Backward compatibility exports
ServiceRegistry = ConsulServiceRegistry
get_service_registry = get_consul_registry

__all__ = [
    # New Consul-based API
    "register_service",
    "deregister_service",
    "discover_services",
    "get_healthy_services",
    "ConsulServiceInfo",
    # HTTP client with service discovery
    "ServiceClient",
    # Backward compatibility
    "ServiceRegistry",
    "get_service_registry",
    "ServiceInfo",
    "ServiceHealth",
    "ServiceStatus",
]

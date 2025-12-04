"""
Consul-based service registry implementation.

Simple wrapper around HashiCorp Consul for service discovery.
"""

from dataclasses import dataclass
from typing import Any

import consul
import consul.aio
import structlog

from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


@dataclass
class ConsulServiceInfo:
    """Service information from Consul."""

    name: str
    address: str
    port: int
    service_id: str
    tags: list[str]
    meta: dict[str, str]
    health: str = "passing"

    @property
    def url(self) -> str:
        """Get service URL."""
        return f"http://{self.address}:{self.port}"


class ConsulServiceRegistry:
    """
    Consul-based service registry.

    Provides a simple interface to Consul for service registration,
    discovery, and health checking.
    """

    def __init__(self, consul_host: str = "localhost", consul_port: int = 8500) -> None:
        """Initialize Consul client."""
        self.consul = consul.aio.Consul(host=consul_host, port=consul_port)
        self._registered_services: set[str] = set()

    async def register(
        self,
        name: str,
        address: str,
        port: int,
        service_id: str | None = None,
        tags: list[str] | None = None,
        meta: dict[str, str] | None = None,
        health_check: str | None = None,
        health_interval: str = "30s",
    ) -> str:
        """
        Register a service with Consul.

        Args:
            name: Service name
            address: Service address
            port: Service port
            service_id: Unique service ID (auto-generated if None)
            tags: Service tags
            meta: Service metadata
            health_check: Health check endpoint (e.g., "/health")
            health_interval: Health check interval

        Returns:
            Service ID
        """
        if service_id is None:
            service_id = f"{name}-{address}-{port}"

        check_args: dict[str, Any] | None = None
        if health_check:
            check_args = {
                "HTTP": f"http://{address}:{port}{health_check}",
                "Interval": health_interval,
                "Timeout": "10s",
                "DeregisterCriticalServiceAfter": "90s",
            }

        await self.consul.agent.service.register(
            name=name,
            service_id=service_id,
            address=address,
            port=port,
            tags=tags or [],
            meta=meta or {},
            check=check_args,
        )
        self._registered_services.add(service_id)
        logger.info(f"Registered service '{name}' with ID '{service_id}' at {address}:{port}")
        return service_id

    async def deregister(self, service_id: str) -> None:
        """Deregister a service from Consul."""
        await self.consul.agent.service.deregister(service_id)
        self._registered_services.discard(service_id)
        logger.info(f"Deregistered service with ID '{service_id}'")

    async def discover(
        self, service_name: str, only_healthy: bool = True
    ) -> list[ConsulServiceInfo]:
        """
        Discover services by name.

        Args:
            service_name: Name of service to discover
            only_healthy: Only return healthy services

        Returns:
            List of service instances
        """
        _, services = await self.consul.health.service(service_name, passing=only_healthy)

        result = []
        for service_data in services:
            service = service_data["Service"]
            node_info = service_data.get("Node", {})
            checks = service_data["Checks"]

            # Determine health status
            health_status = "passing"
            for check in checks:
                if check["Status"] != "passing":
                    health_status = check["Status"]
                    break

            address = service.get("Address") or node_info.get("Address") or ""

            service_info = ConsulServiceInfo(
                name=service["Service"],
                address=address,
                port=service["Port"],
                service_id=service["ID"],
                tags=service.get("Tags", []),
                meta=service.get("Meta", {}),
                health=health_status,
            )
            result.append(service_info)

        logger.debug(f"Discovered {len(result)} instances of service '{service_name}'")
        return result

    async def get_healthy_services(self, service_name: str) -> list[ConsulServiceInfo]:
        """Get only healthy instances of a service."""
        return await self.discover(service_name, only_healthy=True)

    async def close(self) -> None:
        """Clean up and deregister all services."""
        for service_id in list(self._registered_services):
            await self.deregister(service_id)

    async def __aenter__(self) -> "ConsulServiceRegistry":
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        await self.close()


# Global instance
_consul_registry: ConsulServiceRegistry | None = None


def get_consul_registry() -> ConsulServiceRegistry:
    """Get or create global Consul registry instance."""
    global _consul_registry
    if _consul_registry is None:
        # Get Consul configuration from settings if available
        consul_host = getattr(settings, "consul_host", "localhost")
        consul_port = getattr(settings, "consul_port", 8500)
        _consul_registry = ConsulServiceRegistry(consul_host, consul_port)
    return _consul_registry


# Convenience functions for direct use
async def register_service(
    name: str,
    address: str,
    port: int,
    service_id: str | None = None,
    tags: list[str] | None = None,
    meta: dict[str, str] | None = None,
    health_check: str | None = None,
) -> str:
    """Register a service with Consul."""
    registry = get_consul_registry()
    return await registry.register(
        name=name,
        address=address,
        port=port,
        service_id=service_id,
        tags=tags,
        meta=meta,
        health_check=health_check,
    )


async def deregister_service(service_id: str) -> None:
    """Deregister a service from Consul."""
    registry = get_consul_registry()
    await registry.deregister(service_id)


async def discover_services(
    service_name: str, only_healthy: bool = True
) -> list[ConsulServiceInfo]:
    """Discover services by name."""
    registry = get_consul_registry()
    return await registry.discover(service_name, only_healthy)


async def get_healthy_services(service_name: str) -> list[ConsulServiceInfo]:
    """Get only healthy instances of a service."""
    registry = get_consul_registry()
    return await registry.get_healthy_services(service_name)

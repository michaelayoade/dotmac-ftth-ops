"""
HTTP client with service discovery and automatic retry.

Provides a simple way to make HTTP requests to services registered in Consul
with automatic service discovery, load balancing, and retry logic.
"""

import random
from typing import Any

import httpx
import structlog
from tenacity import retry, retry_if_not_exception_type, stop_after_attempt, wait_exponential

from .consul_registry import get_healthy_services

logger = structlog.get_logger(__name__)


class ServiceClient:
    """HTTP client with service discovery and retry for Consul-registered services."""

    def __init__(self, service_name: str, timeout: float = 30.0) -> None:
        """Initialize service client.

        Args:
            service_name: Name of the service to connect to
            timeout: Request timeout in seconds
        """
        self.service_name = service_name
        self._client = httpx.AsyncClient(timeout=timeout)

    async def _get_service_url(self) -> str:
        """Get healthy service instance URL with load balancing."""
        services = await get_healthy_services(self.service_name)

        if not services:
            raise ConnectionError(f"No healthy instances for service: {self.service_name}")

        # Simple random load balancing
        service = random.choice(services)
        return service.url

    async def get(self, path: str, **kwargs: Any) -> httpx.Response:
        """GET request with service discovery."""
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> httpx.Response:
        """POST request with service discovery."""
        return await self._request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> httpx.Response:
        """PUT request with service discovery."""
        return await self._request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> httpx.Response:
        """DELETE request with service discovery."""
        return await self._request("DELETE", path, **kwargs)

    @retry(
        retry=retry_if_not_exception_type(httpx.HTTPStatusError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        """Make HTTP request with service discovery and retry."""
        base_url = await self._get_service_url()
        url = f"{base_url}{path}"

        logger.debug("Service request", service=self.service_name, method=method, url=url)

        response = await self._client.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    async def close(self) -> None:
        """Close HTTP client."""
        await self._client.aclose()

    async def __aenter__(self) -> "ServiceClient":
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        await self.close()


# Usage example:
#
# async with ServiceClient("auth-service") as client:
#     response = await client.get("/api/verify-token", params={"token": "..."})
#     user_data = response.json()

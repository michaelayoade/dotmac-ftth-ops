"""
Robust HTTP Client Base Class.

Provides connection pooling, retries, circuit breakers, and tenant-aware logging
for all OSS/BSS HTTP clients (VOLTHA, GenieACS, NetBox, etc.).
"""

import asyncio
from typing import Any, ClassVar
from urllib.parse import urljoin

import httpx
import structlog
from pybreaker import CircuitBreaker, CircuitBreakerError
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = structlog.get_logger(__name__)


class RobustHTTPClient:
    """
    Base class for robust HTTP clients with:
    - Connection pooling (persistent httpx.AsyncClient)
    - Retry logic with exponential backoff (tenacity)
    - Circuit breakers (pybreaker)
    - Tenant-aware structured logging
    - Configurable timeouts per operation
    """

    # Class-level connection pool (one client per tenant + service combo)
    _client_pool: ClassVar[dict[str, httpx.AsyncClient]] = {}
    _circuit_breakers: ClassVar[dict[str, CircuitBreaker]] = {}

    def __init__(
        self,
        service_name: str,
        base_url: str,
        tenant_id: str | None = None,
        api_token: str | None = None,
        username: str | None = None,
        password: str | None = None,
        verify_ssl: bool = True,
        default_timeout: float = 30.0,
        max_retries: int = 3,
        circuit_breaker_threshold: int = 5,
        circuit_breaker_timeout: int = 60,
        max_connections: int = 20,
        max_keepalive_connections: int = 10,
    ):
        """
        Initialize robust HTTP client.

        Args:
            service_name: Name of the service (e.g., "voltha", "genieacs", "netbox")
            base_url: Base URL for the API
            tenant_id: Tenant ID for multi-tenancy support
            api_token: Bearer token for authentication
            username: Basic auth username
            password: Basic auth password
            verify_ssl: Verify SSL certificates
            default_timeout: Default timeout in seconds
            max_retries: Maximum retry attempts
            circuit_breaker_threshold: Failures before opening circuit
            circuit_breaker_timeout: Seconds before trying again after circuit opens
            max_connections: Maximum concurrent connections
            max_keepalive_connections: Maximum keep-alive connections
        """
        self.service_name = service_name
        self.base_url = base_url.rstrip("/") + "/"
        self.tenant_id = tenant_id
        self.verify_ssl = verify_ssl
        self.default_timeout = default_timeout
        self.max_retries = max_retries

        # Setup authentication
        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        self.auth = None

        if api_token:
            self.headers["Authorization"] = f"Bearer {api_token}"
        elif username and password:
            self.auth = (username, password)

        # Create tenant-aware logger
        if tenant_id:
            self.logger = logger.bind(
                service=service_name,
                tenant_id=tenant_id,
            )
        else:
            self.logger = logger.bind(service=service_name)

        # Connection pooling key
        pool_key = f"{service_name}:{tenant_id or 'default'}:{base_url}"

        # Create or reuse HTTP client (connection pooling)
        if pool_key not in self._client_pool:
            self._client_pool[pool_key] = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self.headers,
                auth=self.auth,
                verify=verify_ssl,
                timeout=httpx.Timeout(default_timeout, connect=5.0),
                limits=httpx.Limits(
                    max_connections=max_connections,
                    max_keepalive_connections=max_keepalive_connections,
                ),
                follow_redirects=True,
            )
            self.logger.debug(
                "http_client.pool.created",
                pool_key=pool_key,
                max_connections=max_connections,
            )

        self.client = self._client_pool[pool_key]

        # Create or reuse circuit breaker
        breaker_key = f"{service_name}:{tenant_id or 'default'}"
        if breaker_key not in self._circuit_breakers:
            self._circuit_breakers[breaker_key] = CircuitBreaker(
                fail_max=circuit_breaker_threshold,
                reset_timeout=circuit_breaker_timeout,
                name=breaker_key,
                listeners=[self._circuit_breaker_listener()],
            )
            self.logger.debug(
                "circuit_breaker.created",
                breaker_key=breaker_key,
                fail_max=circuit_breaker_threshold,
                reset_timeout=circuit_breaker_timeout,
            )

        self.circuit_breaker = self._circuit_breakers[breaker_key]

    def _circuit_breaker_listener(self):
        """Create circuit breaker event listener for logging."""
        service_name = self.service_name
        tenant_id = self.tenant_id
        log = self.logger

        class Listener:
            def state_change(self, breaker, old_state, new_state):
                log.warning(
                    "circuit_breaker.state_change",
                    service=service_name,
                    tenant_id=tenant_id,
                    old_state=str(old_state),
                    new_state=str(new_state),
                    failure_count=breaker.fail_counter,
                )

        return Listener()

    async def request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        timeout: float | None = None,
        retry: bool = True,
    ) -> Any:
        """
        Make HTTP request with retry logic and circuit breaker.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            endpoint: API endpoint (relative to base_url)
            params: Query parameters
            json: JSON body
            timeout: Request timeout (overrides default)
            retry: Enable retry logic (default True)

        Returns:
            Response JSON data or empty dict

        Raises:
            httpx.HTTPStatusError: On HTTP errors (4xx/5xx)
            httpx.RequestError: On network errors
            CircuitBreakerError: When circuit is open
            RetryError: When all retries exhausted
        """
        url = urljoin(self.base_url, endpoint.lstrip("/"))
        request_timeout = timeout or self.default_timeout

        self.logger.debug(
            "http_request.started",
            method=method,
            endpoint=endpoint,
            timeout=request_timeout,
        )

        # Wrap in circuit breaker
        try:
            if retry:
                result = await self._request_with_retry(
                    method=method,
                    url=url,
                    params=params,
                    json=json,
                    timeout=request_timeout,
                )
            else:
                result = await self._request_once(
                    method=method,
                    url=url,
                    params=params,
                    json=json,
                    timeout=request_timeout,
                )

            self.logger.debug(
                "http_request.success",
                method=method,
                endpoint=endpoint,
            )
            return result

        except CircuitBreakerError as e:
            self.logger.error(
                "http_request.circuit_open",
                method=method,
                endpoint=endpoint,
                error=str(e),
            )
            raise

        except RetryError as e:
            self.logger.error(
                "http_request.retry_exhausted",
                method=method,
                endpoint=endpoint,
                error=str(e),
            )
            raise

        except httpx.HTTPStatusError as e:
            self.logger.error(
                "http_request.http_error",
                method=method,
                endpoint=endpoint,
                status_code=e.response.status_code,
                error=str(e),
            )
            raise

        except httpx.RequestError as e:
            self.logger.error(
                "http_request.network_error",
                method=method,
                endpoint=endpoint,
                error=str(e),
            )
            raise

    @CircuitBreaker
    async def _request_with_retry(
        self,
        method: str,
        url: str,
        params: dict[str, Any] | None,
        json: dict[str, Any] | None,
        timeout: float,
    ) -> Any:
        """Make request with retry logic."""
        attempt = 0

        async for attempt_state in AsyncRetrying(
            stop=stop_after_attempt(self.max_retries),
            wait=wait_exponential(multiplier=1, min=1, max=10),
            retry=retry_if_exception_type(
                (
                    httpx.TimeoutException,
                    httpx.ConnectError,
                    httpx.NetworkError,
                )
            ),
            reraise=True,
        ):
            with attempt_state:
                attempt += 1
                if attempt > 1:
                    self.logger.info(
                        "http_request.retry",
                        method=method,
                        url=url,
                        attempt=attempt,
                        max_retries=self.max_retries,
                    )

                response = await self.client.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json,
                    timeout=timeout,
                )

                # Retry on 5xx errors
                if response.status_code >= 500:
                    self.logger.warning(
                        "http_request.server_error",
                        method=method,
                        url=url,
                        status_code=response.status_code,
                        attempt=attempt,
                    )
                    if attempt < self.max_retries:
                        await asyncio.sleep(min(2 ** attempt * 0.5, 5.0))
                        raise httpx.NetworkError(f"Server error: {response.status_code}")

                # Retry on 429 (rate limit)
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After", "5")
                    wait_time = int(retry_after) if retry_after.isdigit() else 5
                    self.logger.warning(
                        "http_request.rate_limited",
                        method=method,
                        url=url,
                        retry_after=wait_time,
                    )
                    if attempt < self.max_retries:
                        await asyncio.sleep(wait_time)
                        raise httpx.NetworkError("Rate limited")

                response.raise_for_status()

                # Handle empty responses
                if response.status_code == 204 or not response.content:
                    return {}

                return response.json()

    async def _request_once(
        self,
        method: str,
        url: str,
        params: dict[str, Any] | None,
        json: dict[str, Any] | None,
        timeout: float,
    ) -> Any:
        """Make single request without retry."""
        response = await self.client.request(
            method=method,
            url=url,
            params=params,
            json=json,
            timeout=timeout,
        )

        response.raise_for_status()

        if response.status_code == 204 or not response.content:
            return {}

        return response.json()

    async def close(self):
        """Close HTTP client and cleanup resources."""
        pool_key = f"{self.service_name}:{self.tenant_id or 'default'}:{self.base_url}"
        if pool_key in self._client_pool:
            await self._client_pool[pool_key].aclose()
            del self._client_pool[pool_key]
            self.logger.debug("http_client.closed", pool_key=pool_key)

    @classmethod
    async def close_all(cls):
        """Close all pooled HTTP clients."""
        for key, client in list(cls._client_pool.items()):
            await client.aclose()
            logger.debug("http_client.pool.closed", pool_key=key)
        cls._client_pool.clear()
        cls._circuit_breakers.clear()

    def __del__(self):
        """Cleanup on deletion."""
        # Note: Cannot await in __del__, so we just log
        # Resources will be cleaned up when event loop closes
        pass

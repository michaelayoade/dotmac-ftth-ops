"""
Ansible AWX API Client

Provides interface to AWX REST API for automation workflows.
Uses RobustHTTPClient for consistent architecture with other external service clients.
"""

import os
import re
from typing import Any, cast
from urllib.parse import urljoin

import httpx
import structlog

from dotmac.platform.core.http_client import RobustHTTPClient

logger = structlog.get_logger(__name__)


class AWXClient(RobustHTTPClient):  # type: ignore[misc]
    """
    AWX REST API Client for Ansible automation

    Extends RobustHTTPClient for automatic circuit breaker protection,
    connection pooling, and retry logic.
    """

    # Configurable timeouts for different operations
    TIMEOUTS = {
        "health_check": 5.0,
        "list": 10.0,
        "get": 10.0,
        "launch": 60.0,
        "cancel": 30.0,
    }

    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        token: str | None = None,
        tenant_id: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
    ):
        """
        Initialize AWX client with robust HTTP capabilities.

        Args:
            base_url: AWX API URL (defaults to settings.external_services.awx_url)
            username: Basic auth username (defaults to AWX_USERNAME env var)
            password: Basic auth password (defaults to AWX_PASSWORD env var)
            token: Bearer token (defaults to AWX_TOKEN env var)
            tenant_id: Tenant ID for multi-tenancy support
            verify_ssl: Verify SSL certificates (default True)
            timeout_seconds: Default timeout in seconds
            max_retries: Maximum retry attempts
        """
        # Load from centralized settings (Phase 2 implementation)
        if base_url is None:
            try:
                from dotmac.platform.settings import settings

                base_url = settings.external_services.awx_url
            except (ImportError, AttributeError):
                # Fallback to environment variable if settings not available
                base_url = os.getenv("AWX_URL", "http://localhost:80")

        if base_url is None:
            raise ValueError("AWX base URL is required")

        # Normalise base URL to avoid duplicated /api/v2 segments
        base_url = re.sub(r"/api(?:/v2)?/?$", "/", base_url.rstrip("/"))
        if not base_url.endswith("/"):
            base_url += "/"

        username = username or os.getenv("AWX_USERNAME", "admin")
        password = password or os.getenv("AWX_PASSWORD", "password")
        token = token or os.getenv("AWX_TOKEN", "")

        # Initialize robust HTTP client
        super().__init__(
            service_name="awx",
            base_url=base_url,
            tenant_id=tenant_id,
            api_token=token if token else None,
            username=username if not token else None,
            password=password if not token else None,
            verify_ssl=verify_ssl,
            default_timeout=timeout_seconds,
            max_retries=max_retries,
        )

        # API base path
        self.api_base = urljoin(self.base_url, "api/v2/")

    async def _awx_request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        """
        Make HTTP request to AWX API using robust base client.

        Args:
            method: HTTP method
            endpoint: API endpoint (relative to api_base)
            params: Query parameters
            json: JSON body
            timeout: Request timeout (overrides default)

        Returns:
            Response JSON data
        """
        # Construct full endpoint with api/v2/ prefix
        full_endpoint = urljoin(self.api_base, endpoint.lstrip("/"))
        # Make endpoint relative to base_url
        relative_endpoint = full_endpoint.replace(self.base_url, "")

        return await self.request(
            method=method,
            endpoint=relative_endpoint,
            params=params,
            json=json,
            timeout=timeout,
        )

    # =========================================================================
    # Job Template Operations
    # =========================================================================

    async def get_job_templates(self) -> list[dict[str, Any]]:
        """Get all job templates"""
        response = await self._awx_request(
            "GET", "job_templates/", timeout=self.TIMEOUTS["list"]
        )
        response_dict = cast(dict[str, Any], response) if isinstance(response, dict) else {}
        return cast(list[dict[str, Any]], response_dict.get("results", []))

    async def get_job_template(self, template_id: int) -> dict[str, Any] | None:
        """Get job template by ID"""
        try:
            response = await self._awx_request(
                "GET", f"job_templates/{template_id}/", timeout=self.TIMEOUTS["get"]
            )
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def launch_job_template(
        self, template_id: int, extra_vars: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Launch job template with optional extra variables"""
        payload = {}
        if extra_vars:
            payload["extra_vars"] = extra_vars

        response = await self._awx_request(
            "POST",
            f"job_templates/{template_id}/launch/",
            json=payload,
            timeout=self.TIMEOUTS["launch"],
        )
        return cast(dict[str, Any], response)

    # =========================================================================
    # Job Operations
    # =========================================================================

    async def get_jobs(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get all jobs with pagination"""
        response = await self._awx_request(
            "GET",
            "jobs/",
            params={"page_size": limit},
            timeout=self.TIMEOUTS["list"],
        )
        response_dict = cast(dict[str, Any], response) if isinstance(response, dict) else {}
        return cast(list[dict[str, Any]], response_dict.get("results", []))

    async def get_job(self, job_id: int) -> dict[str, Any] | None:
        """Get job by ID"""
        try:
            response = await self._awx_request(
                "GET", f"jobs/{job_id}/", timeout=self.TIMEOUTS["get"]
            )
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def cancel_job(self, job_id: int) -> dict[str, Any]:
        """Cancel running job"""
        response = await self._awx_request(
            "POST", f"jobs/{job_id}/cancel/", timeout=self.TIMEOUTS["cancel"]
        )
        return cast(dict[str, Any], response)

    # =========================================================================
    # Inventory Operations
    # =========================================================================

    async def get_inventories(self) -> list[dict[str, Any]]:
        """Get all inventories"""
        response = await self._awx_request(
            "GET", "inventories/", timeout=self.TIMEOUTS["list"]
        )
        response_dict = cast(dict[str, Any], response) if isinstance(response, dict) else {}
        return cast(list[dict[str, Any]], response_dict.get("results", []))

    # =========================================================================
    # Health Check
    # =========================================================================

    async def ping(self) -> bool:
        """Check if AWX is accessible"""
        try:
            await self._awx_request("GET", "ping/", timeout=self.TIMEOUTS["health_check"])
            return True
        except Exception as e:
            logger.warning("awx.ping.failed", error=str(e))
            return False

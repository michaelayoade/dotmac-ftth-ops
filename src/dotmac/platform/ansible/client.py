"""
Ansible AWX API Client

Provides interface to AWX REST API for automation workflows.
"""

import asyncio
import os
from typing import Any, cast
from urllib.parse import urljoin

import httpx
import structlog

logger = structlog.get_logger(__name__)


class AWXClient:
    """AWX REST API Client for Ansible automation"""

    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        token: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
    ):
        """Initialize AWX client (defaults to settings.external_services.awx_url)"""
        # Load from centralized settings (Phase 2 implementation)
        if base_url is None:
            try:
                from dotmac.platform.settings import settings

                base_url_value = settings.external_services.awx_url
            except (ImportError, AttributeError):
                # Fallback to environment variable if settings not available
                base_url_value = os.getenv("AWX_URL", "http://localhost:80")
        else:
            base_url_value = base_url
        self.username = username or os.getenv("AWX_USERNAME", "admin")
        self.password = password or os.getenv("AWX_PASSWORD", "password")
        self.token = token or os.getenv("AWX_TOKEN", "")
        self.verify_ssl = verify_ssl

        if not base_url_value.endswith("/"):
            base_url_value = f"{base_url_value}/"

        self.base_url: str = base_url_value
        self.api_base: str = urljoin(self.base_url, "api/v2/")

        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

        self.auth = None
        if not self.token and self.username and self.password:
            self.auth = (self.username, self.password)
        self.timeout_seconds = timeout_seconds
        self.max_retries = max(0, max_retries)
        self._limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        """Make HTTP request to AWX API"""
        url = urljoin(self.api_base, endpoint)

        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    verify=self.verify_ssl,
                    timeout=httpx.Timeout(self.timeout_seconds),
                    limits=self._limits,
                ) as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=self.headers,
                        params=params,
                        json=json,
                        auth=self.auth,
                    )

                response.raise_for_status()

                if response.status_code == 204 or not response.content:
                    return {}

                return response.json()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code >= 500 and attempt < self.max_retries:
                    last_error = exc
                    await asyncio.sleep(min(2**attempt * 0.5, 5.0))
                    continue
                raise
            except httpx.RequestError as exc:
                last_error = exc
                if attempt < self.max_retries:
                    await asyncio.sleep(min(2**attempt * 0.5, 5.0))
                    continue
                raise

        if last_error:
            raise last_error

        raise RuntimeError("AWX request failed without raising an exception")

    # Job Templates
    async def get_job_templates(self) -> list[dict[str, Any]]:
        """Get all job templates"""
        response = await self._request("GET", "job_templates/")
        response_dict = cast(dict[str, Any], response)
        return cast(list[dict[str, Any]], response_dict.get("results", []))

    async def get_job_template(self, template_id: int) -> dict[str, Any] | None:
        """Get job template by ID"""
        try:
            response = await self._request("GET", f"job_templates/{template_id}/")
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def launch_job_template(
        self, template_id: int, extra_vars: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Launch job template"""
        payload = {}
        if extra_vars:
            payload["extra_vars"] = extra_vars

        response = await self._request("POST", f"job_templates/{template_id}/launch/", json=payload)
        return cast(dict[str, Any], response)

    # Jobs
    async def get_jobs(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get all jobs"""
        response = await self._request("GET", "jobs/", params={"page_size": limit})
        response_dict = cast(dict[str, Any], response)
        return cast(list[dict[str, Any]], response_dict.get("results", []))

    async def get_job(self, job_id: int) -> dict[str, Any] | None:
        """Get job by ID"""
        try:
            response = await self._request("GET", f"jobs/{job_id}/")
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def cancel_job(self, job_id: int) -> dict[str, Any]:
        """Cancel running job"""
        response = await self._request("POST", f"jobs/{job_id}/cancel/")
        return cast(dict[str, Any], response)

    # Inventories
    async def get_inventories(self) -> list[dict[str, Any]]:
        """Get all inventories"""
        response = await self._request("GET", "inventories/")
        response_dict = cast(dict[str, Any], response)
        return cast(list[dict[str, Any]], response_dict.get("results", []))

    # Health check
    async def ping(self) -> bool:
        """Check if AWX is accessible"""
        try:
            await self._request("GET", "ping/")
            return True
        except Exception as e:
            logger.warning("awx.ping.failed", error=str(e))
            return False

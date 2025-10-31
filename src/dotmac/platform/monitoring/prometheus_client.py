"""
HTTP client for querying Prometheus metrics.
"""

from __future__ import annotations

from typing import Any

import structlog

from dotmac.platform.core.http_client import RobustHTTPClient

logger = structlog.get_logger(__name__)


class PrometheusQueryError(RuntimeError):
    """Raised when Prometheus returns an error response."""


class PrometheusClient(RobustHTTPClient):
    """Client wrapper around the Prometheus HTTP API."""

    def __init__(
        self,
        base_url: str,
        tenant_id: str | None = None,
        *,
        api_token: str | None = None,
        username: str | None = None,
        password: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 15.0,
        max_retries: int = 2,
    ) -> None:
        super().__init__(
            service_name="prometheus",
            base_url=base_url,
            tenant_id=tenant_id,
            api_token=api_token,
            username=username,
            password=password,
            verify_ssl=verify_ssl,
            default_timeout=timeout_seconds,
            max_retries=max_retries,
        )

    async def query(self, query: str, timeout: float | None = None) -> dict[str, Any]:
        """
        Execute an instant PromQL query.

        Args:
            query: PromQL expression.
            timeout: Override request timeout.

        Returns:
            Parsed JSON payload returned by Prometheus.

        Raises:
            PrometheusQueryError: When Prometheus indicates an error state.
        """
        payload = await self.request(
            "GET",
            "api/v1/query",
            params={"query": query},
            timeout=timeout,
        )

        if not isinstance(payload, dict):
            raise PrometheusQueryError("Unexpected payload type from Prometheus")

        status = payload.get("status")
        if status != "success":
            error_type = payload.get("errorType")
            error = payload.get("error")
            raise PrometheusQueryError(
                f"Prometheus query failed (status={status}, type={error_type}, error={error})"
            )

        return payload

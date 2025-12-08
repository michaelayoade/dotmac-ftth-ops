"""
Usage Reporter

Reports usage metrics from ISP instance to Control Plane.
"""

import hashlib
import hmac
import json
from datetime import datetime
from typing import Any
from uuid import uuid4

import httpx
import structlog

logger = structlog.get_logger(__name__)


class UsageReporter:
    """
    Reports usage metrics to Control Plane.

    Features:
    - Signed payloads (HMAC)
    - Idempotency keys to prevent duplicates
    - Async reporting
    """

    def __init__(
        self,
        tenant_id: str,
        control_plane_url: str,
        signing_key: str,
        instance_api_key: str,
    ):
        self.tenant_id = tenant_id
        self.control_plane_url = control_plane_url
        self.signing_key = signing_key
        self.instance_api_key = instance_api_key

    async def report_usage(self, metrics: dict[str, Any]) -> bool:
        """
        Send signed usage snapshot to Control Plane.

        Args:
            metrics: Dictionary containing usage metrics:
                - active_subscribers: Number of active subscribers
                - total_subscribers: Total subscribers (including inactive)
                - api_calls_24h: API calls in last 24 hours
                - storage_bytes: Storage usage in bytes
                - radius_sessions: Active RADIUS sessions

        Returns:
            True if report was accepted, False otherwise.
        """
        idempotency_key = str(uuid4())
        timestamp = datetime.utcnow().isoformat()

        payload = {
            "tenant_id": self.tenant_id,
            "timestamp": timestamp,
            "idempotency_key": idempotency_key,
            "metrics": {
                "active_subscribers": metrics.get("active_subscribers", 0),
                "total_subscribers": metrics.get("total_subscribers", 0),
                "api_calls_24h": metrics.get("api_calls_24h", 0),
                "storage_bytes": metrics.get("storage_bytes", 0),
                "radius_sessions": metrics.get("radius_sessions", 0),
            },
        }

        # Sign the payload
        signature = self._sign_payload(payload)

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self.control_plane_url}/api/v1/tenants/{self.tenant_id}/usage",
                    json=payload,
                    headers={
                        "X-Instance-API-Key": self.instance_api_key,
                        "X-Signature": signature,
                        "X-Idempotency-Key": idempotency_key,
                    },
                )

                if response.status_code == 409:
                    # Duplicate idempotency key - already processed
                    logger.debug(
                        "usage_report_duplicate",
                        idempotency_key=idempotency_key,
                    )
                    return True

                response.raise_for_status()

            logger.info(
                "usage_reported",
                tenant_id=self.tenant_id,
                active_subscribers=payload["metrics"]["active_subscribers"],
                idempotency_key=idempotency_key,
            )
            return True

        except httpx.HTTPError as e:
            logger.error(
                "usage_report_failed",
                error=str(e),
                tenant_id=self.tenant_id,
            )
            return False

    def _sign_payload(self, payload: dict[str, Any]) -> str:
        """Create HMAC signature for payload."""
        message = json.dumps(payload, sort_keys=True).encode()
        return hmac.new(
            self.signing_key.encode(),
            message,
            hashlib.sha256
        ).hexdigest()

    async def collect_and_report(self, db_session_factory, redis) -> bool:
        """
        Collect current metrics and report to Control Plane.

        This is typically called by a scheduled job.
        """
        from sqlalchemy import func, select
        from isp_app.subscribers.models import Subscriber

        # Collect metrics from database
        async with db_session_factory() as session:
            # Active subscribers
            active_result = await session.execute(
                select(func.count()).select_from(Subscriber).where(
                    Subscriber.status == "active"
                )
            )
            active_subscribers = active_result.scalar() or 0

            # Total subscribers
            total_result = await session.execute(
                select(func.count()).select_from(Subscriber)
            )
            total_subscribers = total_result.scalar() or 0

        # Get RADIUS sessions from Redis (if available)
        radius_sessions = 0
        try:
            radius_sessions = await redis.scard(f"radius:sessions:{self.tenant_id}") or 0
        except Exception:
            pass

        # Get API call count from Redis (if tracking)
        api_calls_24h = 0
        try:
            api_calls_24h = int(await redis.get(f"api_calls:24h:{self.tenant_id}") or 0)
        except Exception:
            pass

        metrics = {
            "active_subscribers": active_subscribers,
            "total_subscribers": total_subscribers,
            "api_calls_24h": api_calls_24h,
            "storage_bytes": 0,  # TODO: Implement storage tracking
            "radius_sessions": radius_sessions,
        }

        return await self.report_usage(metrics)


# Scheduled job for periodic reporting
async def scheduled_usage_report(
    tenant_id: str,
    control_plane_url: str,
    signing_key: str,
    instance_api_key: str,
    db_session_factory,
    redis,
):
    """
    Scheduled job to report usage metrics.

    Run this via Celery beat or APScheduler every 5-15 minutes.
    """
    reporter = UsageReporter(
        tenant_id=tenant_id,
        control_plane_url=control_plane_url,
        signing_key=signing_key,
        instance_api_key=instance_api_key,
    )

    success = await reporter.collect_and_report(db_session_factory, redis)

    if not success:
        logger.warning(
            "scheduled_usage_report_failed",
            tenant_id=tenant_id,
        )

    return success

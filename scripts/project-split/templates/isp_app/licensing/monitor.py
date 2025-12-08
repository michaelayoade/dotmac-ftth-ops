"""
License Monitor

Background job to monitor license compliance and alert on issues.
"""

from datetime import datetime
from typing import Any, Optional

import structlog

from isp_app.licensing.enforcement import LicenseEnforcer
from isp_app.licensing.usage_reporter import UsageReporter

logger = structlog.get_logger(__name__)


class AlertService:
    """Interface for sending alerts."""

    async def send(self, level: str, title: str, message: str, metadata: Optional[dict] = None):
        """Send an alert. Override this for actual implementation."""
        logger.info(
            f"alert_{level}",
            title=title,
            message=message,
            metadata=metadata,
        )


class LicenseMonitor:
    """
    Background job to monitor license compliance.

    Runs periodically to:
    - Check subscriber count against limits
    - Alert on approaching/exceeded caps
    - Report usage to control plane
    - Mark tenant as over-cap for reporting
    """

    def __init__(
        self,
        enforcer: LicenseEnforcer,
        usage_reporter: UsageReporter,
        alert_service: Optional[AlertService] = None,
        redis=None,
    ):
        self.enforcer = enforcer
        self.usage_reporter = usage_reporter
        self.alerts = alert_service or AlertService()
        self.redis = redis

    async def run_check(self) -> dict[str, Any]:
        """
        Periodic compliance check.

        Returns status dict with check results.
        """
        try:
            status = await self.enforcer.check_subscriber_cap()
            license_token = await self.enforcer.get_license()

            result = {
                "timestamp": datetime.utcnow().isoformat(),
                "tenant_id": self.enforcer.tenant_id,
                "status": status["status"],
                "current_subscribers": status["current_subscribers"],
                "max_subscribers": status["max_subscribers"],
                "usage_percent": status["usage_percent"],
                "alerts_sent": [],
            }

            # Send alerts based on status
            if status["status"] == "critical":
                await self.alerts.send(
                    level="critical",
                    title="Subscriber Cap Critical",
                    message=(
                        f"Usage at {status['usage_percent']}% "
                        f"({status['current_subscribers']}/{status['max_subscribers']})"
                    ),
                    metadata={
                        "overage_policy": status["overage_policy"],
                        "can_add_subscribers": status["can_add_subscribers"],
                    },
                )
                result["alerts_sent"].append("critical_cap_alert")

                # Mark tenant as over-cap for control plane reporting
                await self._mark_over_cap(status)

            elif status["status"] == "warning":
                await self.alerts.send(
                    level="warning",
                    title="Subscriber Cap Warning",
                    message=(
                        f"Usage at {status['usage_percent']}% "
                        f"({status['current_subscribers']}/{status['max_subscribers']})"
                    ),
                )
                result["alerts_sent"].append("warning_cap_alert")

            # Check license expiration
            days_until_expiry = (license_token.expires_at - datetime.utcnow()).days
            if days_until_expiry <= 7:
                await self.alerts.send(
                    level="warning" if days_until_expiry > 3 else "critical",
                    title="License Expiring Soon",
                    message=f"License expires in {days_until_expiry} days",
                )
                result["alerts_sent"].append("expiry_alert")
                result["days_until_expiry"] = days_until_expiry

            # Report usage to control plane
            if self.usage_reporter:
                reported = await self._report_usage(status)
                result["usage_reported"] = reported

            logger.info(
                "license_monitor_check_complete",
                status=status["status"],
                usage_percent=status["usage_percent"],
            )

            return result

        except Exception as e:
            logger.error("license_monitor_error", error=str(e))
            await self.alerts.send(
                level="critical",
                title="License Monitor Error",
                message=f"Failed to check license compliance: {e}",
            )
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "tenant_id": self.enforcer.tenant_id,
                "status": "error",
                "error": str(e),
            }

    async def _mark_over_cap(self, status: dict[str, Any]):
        """Mark tenant as over-cap in Redis for control plane reporting."""
        if self.redis:
            import json

            await self.redis.setex(
                f"over_cap:{self.enforcer.tenant_id}",
                3600,  # 1 hour TTL
                json.dumps({
                    "timestamp": datetime.utcnow().isoformat(),
                    "current": status["current_subscribers"],
                    "max": status["max_subscribers"],
                    "overage": status["current_subscribers"] - status["max_subscribers"],
                }),
            )

    async def _report_usage(self, status: dict[str, Any]) -> bool:
        """Report current usage to control plane."""
        if not self.usage_reporter:
            return False

        return await self.usage_reporter.report_usage({
            "active_subscribers": status["current_subscribers"],
            "total_subscribers": status["current_subscribers"],  # TODO: Include inactive
        })


# Celery task wrapper
def create_monitor_task(
    enforcer: LicenseEnforcer,
    usage_reporter: UsageReporter,
    alert_service: Optional[AlertService] = None,
    redis=None,
):
    """
    Create a Celery-compatible task function.

    Usage:
        from celery import shared_task

        @shared_task
        def license_monitor_task():
            return asyncio.run(create_monitor_task(...)())
    """
    monitor = LicenseMonitor(
        enforcer=enforcer,
        usage_reporter=usage_reporter,
        alert_service=alert_service,
        redis=redis,
    )

    async def task():
        return await monitor.run_check()

    return task

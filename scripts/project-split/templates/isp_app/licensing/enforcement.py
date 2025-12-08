"""
License Enforcement

Enforces license limits on ISP instance operations.
"""

from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
import structlog
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from isp_app.licensing.models import (
    FeatureNotLicensedError,
    LicenseExpiredError,
    LicenseInvalidError,
    LicenseToken,
    OveragePolicy,
    SubscriberCapExceededError,
)
from isp_app.subscribers.models import Subscriber

logger = structlog.get_logger(__name__)


class LicenseEnforcer:
    """
    Enforces license limits on ISP instance.

    - Caches license with short TTL (5-15 min)
    - Validates on write operations (subscriber creation)
    - Reports usage to control plane
    - Handles offline scenarios with grace period
    """

    CACHE_TTL_SECONDS = 300  # 5 minutes
    REFRESH_INTERVAL_SECONDS = 600  # 10 minutes

    def __init__(
        self,
        tenant_id: str,
        license_signing_key: str,
        control_plane_url: str,
        instance_api_key: str,
        redis: Redis,
        db_session_factory,
    ):
        self.tenant_id = tenant_id
        self.signing_key = license_signing_key
        self.control_plane_url = control_plane_url
        self.instance_api_key = instance_api_key
        self.redis = redis
        self.db_session_factory = db_session_factory

        # In-memory cache
        self._cached_license: Optional[LicenseToken] = None
        self._cache_expires_at: Optional[datetime] = None

    async def get_license(self) -> LicenseToken:
        """
        Get current license, from cache or control plane.

        Priority:
        1. In-memory cache (fastest)
        2. Redis cache
        3. Fetch from control plane
        4. Fallback to last valid license (offline mode)
        """
        # Check memory cache first
        if self._cached_license and self._cache_expires_at and self._cache_expires_at > datetime.utcnow():
            return self._cached_license

        # Check Redis cache
        cached = await self.redis.get(f"license:{self.tenant_id}")
        if cached:
            try:
                license_token = LicenseToken.from_jwt(cached.decode(), self.signing_key)
                self._update_memory_cache(license_token)
                return license_token
            except Exception as e:
                logger.warning("cached_license_invalid", error=str(e))

        # Fetch from control plane
        return await self._fetch_license_from_control_plane()

    async def _fetch_license_from_control_plane(self) -> LicenseToken:
        """Pull license from control plane (self-heal)."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"{self.control_plane_url}/api/v1/tenants/{self.tenant_id}/license",
                    headers={"X-Instance-API-Key": self.instance_api_key},
                )
                response.raise_for_status()

            token_str = response.json()["license_token"]
            license_token = LicenseToken.from_jwt(token_str, self.signing_key)

            # Cache it
            await self._cache_license(token_str, license_token)

            logger.info(
                "license_fetched",
                version=license_token.version,
                max_subscribers=license_token.max_subscribers,
            )

            return license_token

        except httpx.HTTPError as e:
            logger.error("license_fetch_failed", error=str(e))
            # Fall back to last valid cached license with grace period
            return await self._get_fallback_license()

    async def receive_license_push(self, token_str: str) -> LicenseToken:
        """
        Receive pushed license from control plane.

        Called when control plane pushes a new license (e.g., on plan change).
        """
        license_token = LicenseToken.from_jwt(token_str, self.signing_key)

        if license_token.tenant_id != self.tenant_id:
            raise LicenseInvalidError("License tenant_id mismatch")

        await self._cache_license(token_str, license_token)

        logger.info(
            "license_received",
            version=license_token.version,
            max_subscribers=license_token.max_subscribers,
            expires_at=license_token.expires_at.isoformat(),
        )

        return license_token

    async def _cache_license(self, token_str: str, license_token: LicenseToken):
        """Cache license in Redis and memory."""
        # Redis cache with TTL
        await self.redis.setex(
            f"license:{self.tenant_id}",
            self.CACHE_TTL_SECONDS,
            token_str,
        )

        # Also store as "last valid" for offline fallback (no TTL)
        await self.redis.set(
            f"license:{self.tenant_id}:last_valid",
            token_str,
        )

        self._update_memory_cache(license_token)

    def _update_memory_cache(self, license_token: LicenseToken):
        """Update in-memory cache."""
        self._cached_license = license_token
        self._cache_expires_at = datetime.utcnow() + timedelta(seconds=self.CACHE_TTL_SECONDS)

    async def _get_fallback_license(self) -> LicenseToken:
        """Get last valid license for offline/error scenarios."""
        cached = await self.redis.get(f"license:{self.tenant_id}:last_valid")
        if not cached:
            raise LicenseInvalidError("No valid license available")

        license_token = LicenseToken.from_jwt(cached.decode(), self.signing_key)

        # Check grace period
        grace_expires = license_token.expires_at + timedelta(hours=license_token.grace_period_hours)

        if datetime.utcnow() > grace_expires:
            raise LicenseExpiredError(
                f"License expired and grace period ended at {grace_expires.isoformat()}"
            )

        logger.warning(
            "using_fallback_license",
            version=license_token.version,
            expired_at=license_token.expires_at.isoformat(),
            grace_expires=grace_expires.isoformat(),
        )

        return license_token

    # ========================================
    # ENFORCEMENT METHODS
    # ========================================

    async def check_subscriber_cap(self) -> dict[str, Any]:
        """
        Check current subscriber count against cap.

        Returns status dict for UI display.
        """
        license_token = await self.get_license()
        current_count = await self._get_active_subscriber_count()

        status = license_token.get_usage_status(current_count)
        status["can_add_subscribers"] = await self._can_add_subscribers(
            license_token, current_count
        )

        return status

    async def enforce_subscriber_creation(self) -> None:
        """
        Write-path guard: Call BEFORE creating/activating a subscriber.

        Raises SubscriberCapExceededError if blocked by policy.
        """
        license_token = await self.get_license()
        current_count = await self._get_active_subscriber_count()

        if current_count >= license_token.max_subscribers:
            # At or over cap - apply policy
            if license_token.overage_policy == OveragePolicy.BLOCK:
                logger.warning(
                    "subscriber_creation_blocked",
                    current=current_count,
                    max=license_token.max_subscribers,
                )
                raise SubscriberCapExceededError(
                    f"Subscriber limit reached ({current_count}/{license_token.max_subscribers}). "
                    f"Please upgrade your plan to add more subscribers."
                )

            elif license_token.overage_policy == OveragePolicy.WARN:
                logger.warning(
                    "subscriber_creation_over_cap_warning",
                    current=current_count,
                    max=license_token.max_subscribers,
                )
                # Allow but log warning - caller should show warning to user

            elif license_token.overage_policy == OveragePolicy.ALLOW_AND_BILL:
                logger.info(
                    "subscriber_creation_over_cap_billable",
                    current=current_count,
                    max=license_token.max_subscribers,
                )
                # Allow - overage will be billed
                await self._record_overage_event(current_count, license_token.max_subscribers)

    async def enforce_feature(self, feature_key: str) -> None:
        """
        Check if a feature is licensed.

        Raises FeatureNotLicensedError if not included in plan.
        """
        license_token = await self.get_license()

        if not license_token.is_feature_enabled(feature_key):
            logger.warning(
                "feature_not_licensed",
                feature=feature_key,
                tenant_id=self.tenant_id,
            )
            raise FeatureNotLicensedError(
                f"Feature '{feature_key}' is not included in your plan. "
                f"Please upgrade to access this feature."
            )

    async def _get_active_subscriber_count(self) -> int:
        """Get count of active subscribers from database."""
        async with self.db_session_factory() as session:
            result = await session.execute(
                select(func.count()).select_from(Subscriber).where(
                    Subscriber.status == "active"
                )
            )
            return result.scalar() or 0

    async def _can_add_subscribers(
        self, license_token: LicenseToken, current_count: int
    ) -> bool:
        """Check if new subscribers can be added."""
        if current_count < license_token.max_subscribers:
            return True
        return license_token.overage_policy != OveragePolicy.BLOCK

    async def _record_overage_event(self, current: int, cap: int):
        """Record overage event for billing."""
        import json

        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "current": current,
            "cap": cap,
            "overage": current - cap + 1,
        }
        await self.redis.lpush(
            f"overage_events:{self.tenant_id}",
            json.dumps(event),
        )

        logger.info(
            "overage_event_recorded",
            current=current,
            cap=cap,
            overage=event["overage"],
        )


# Dependency injection helper
_enforcer_instance: Optional[LicenseEnforcer] = None


def get_license_enforcer() -> LicenseEnforcer:
    """Get the singleton LicenseEnforcer instance."""
    global _enforcer_instance
    if _enforcer_instance is None:
        raise RuntimeError("LicenseEnforcer not initialized. Call init_license_enforcer() first.")
    return _enforcer_instance


def init_license_enforcer(
    tenant_id: str,
    license_signing_key: str,
    control_plane_url: str,
    instance_api_key: str,
    redis: Redis,
    db_session_factory,
) -> LicenseEnforcer:
    """Initialize the singleton LicenseEnforcer instance."""
    global _enforcer_instance
    _enforcer_instance = LicenseEnforcer(
        tenant_id=tenant_id,
        license_signing_key=license_signing_key,
        control_plane_url=control_plane_url,
        instance_api_key=instance_api_key,
        redis=redis,
        db_session_factory=db_session_factory,
    )
    return _enforcer_instance

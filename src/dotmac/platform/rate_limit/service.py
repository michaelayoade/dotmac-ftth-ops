"""
Rate Limiting Service.

Redis-backed rate limiting with sliding window algorithm.
"""

import hashlib
import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.rate_limit.models import (
    RateLimitAction,
    RateLimitLog,
    RateLimitRule,
    RateLimitScope,
    RateLimitWindow,
)
from dotmac.platform.redis_client import RedisClientType
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded."""

    def __init__(
        self,
        rule_name: str,
        limit: int,
        window: RateLimitWindow,
        retry_after: int,
        current_count: int,
    ):
        self.rule_name = rule_name
        self.limit = limit
        self.window = window
        self.retry_after = retry_after
        self.current_count = current_count
        super().__init__(
            f"Rate limit exceeded for {rule_name}: {current_count}/{limit} per {window.value}"
        )


class RateLimitService:
    """Service for rate limiting with Redis backend."""

    def __init__(self, db: AsyncSession, redis: RedisClientType | None = None):
        """Initialize rate limit service."""
        self.db = db
        self.redis = redis  # Will be injected or created

    async def _get_redis(self) -> RedisClientType:
        """Get Redis connection."""
        if self.redis is None:
            # Create Redis connection from settings
            import redis.asyncio as aioredis

            redis_url = settings.redis.redis_url
            self.redis = await aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self.redis

    def _get_window_seconds(self, window: RateLimitWindow) -> int:
        """Convert window enum to seconds."""
        if window == RateLimitWindow.SECOND:
            return 1
        elif window == RateLimitWindow.MINUTE:
            return 60
        elif window == RateLimitWindow.HOUR:
            return 3600
        elif window == RateLimitWindow.DAY:
            return 86400
        else:
            return 60  # Default to minute

    def _generate_key(
        self,
        tenant_id: str,
        scope: RateLimitScope,
        identifier: str,
        rule_id: str,
    ) -> str:
        """Generate Redis key for rate limit tracking."""
        # Use hash to keep key length reasonable
        # MD5 used for identifier hashing, not security
        id_hash = hashlib.md5(identifier.encode(), usedforsecurity=False).hexdigest()[:12]  # nosec B324
        return f"ratelimit:{tenant_id}:{scope.value}:{id_hash}:{rule_id}"

    async def check_rate_limit(
        self,
        tenant_id: str,
        endpoint: str,
        method: str,
        user_id: UUID | None = None,
        ip_address: str | None = None,
        api_key_id: str | None = None,
    ) -> tuple[bool, RateLimitRule | None, int]:
        """
        Check if request should be rate limited.

        Returns:
            Tuple of (is_allowed, rule_applied, current_count)
        """
        # Get applicable rules
        rules = await self._get_applicable_rules(tenant_id, endpoint)

        if not rules:
            return (True, None, 0)

        # Check exemptions first
        for rule in rules:
            if await self._is_exempt(rule, user_id, ip_address, api_key_id):
                continue

            # Check rate limit for this rule
            identifier = self._get_identifier(
                rule.scope, tenant_id, user_id, ip_address, api_key_id, endpoint
            )

            if identifier is None:
                continue

            is_allowed, current_count = await self._check_limit(
                tenant_id=tenant_id,
                rule=rule,
                identifier=identifier,
            )

            if not is_allowed:
                # Log violation
                await self._log_violation(
                    tenant_id=tenant_id,
                    rule=rule,
                    endpoint=endpoint,
                    method=method,
                    user_id=user_id,
                    ip_address=ip_address,
                    api_key_id=api_key_id,
                    current_count=current_count,
                )

                # Determine action
                if rule.action == RateLimitAction.BLOCK:
                    return (False, rule, current_count)
                elif rule.action == RateLimitAction.LOG_ONLY:
                    logger.warning(
                        "Rate limit exceeded (log only)",
                        rule=rule.name,
                        count=current_count,
                        limit=rule.max_requests,
                    )
                    return (True, rule, current_count)
                # For THROTTLE and CAPTCHA, return False but let caller handle
                else:
                    return (False, rule, current_count)

        return (True, None, 0)

    async def increment(
        self,
        tenant_id: str,
        endpoint: str,
        user_id: UUID | None = None,
        ip_address: str | None = None,
        api_key_id: str | None = None,
    ) -> None:
        """Increment rate limit counters for successful requests."""
        rules = await self._get_applicable_rules(tenant_id, endpoint)

        for rule in rules:
            if await self._is_exempt(rule, user_id, ip_address, api_key_id):
                continue

            identifier = self._get_identifier(
                rule.scope, tenant_id, user_id, ip_address, api_key_id, endpoint
            )

            if identifier is None:
                continue

            await self._increment_counter(tenant_id, rule, identifier)

    async def _get_applicable_rules(self, tenant_id: str, endpoint: str) -> list[RateLimitRule]:
        """Get rate limit rules applicable to endpoint."""
        stmt = (
            select(RateLimitRule)
            .where(
                RateLimitRule.tenant_id == tenant_id,
                RateLimitRule.is_active.is_(True),
                RateLimitRule.deleted_at.is_(None),
            )
            .order_by(RateLimitRule.priority.desc())
        )

        result = await self.db.execute(stmt)
        all_rules = list(result.scalars().all())

        # Filter by endpoint pattern
        applicable_rules = []
        for rule in all_rules:
            if rule.endpoint_pattern is None or rule.scope == RateLimitScope.GLOBAL:
                applicable_rules.append(rule)
            elif re.match(rule.endpoint_pattern, endpoint):
                applicable_rules.append(rule)

        return applicable_rules

    async def _is_exempt(
        self,
        rule: RateLimitRule,
        user_id: UUID | None,
        ip_address: str | None,
        api_key_id: str | None,
    ) -> bool:
        """Check if request is exempt from rate limit."""
        if user_id and str(user_id) in rule.exempt_user_ids:
            return True
        if ip_address and ip_address in rule.exempt_ip_addresses:
            return True
        if api_key_id and api_key_id in rule.exempt_api_keys:
            return True
        return False

    def _get_identifier(
        self,
        scope: RateLimitScope,
        tenant_id: str,
        user_id: UUID | None,
        ip_address: str | None,
        api_key_id: str | None,
        endpoint: str,
    ) -> str | None:
        """Get identifier based on scope."""
        if scope == RateLimitScope.GLOBAL:
            return "global"
        elif scope == RateLimitScope.PER_TENANT:
            return tenant_id
        elif scope == RateLimitScope.PER_USER:
            return str(user_id) if user_id else None
        elif scope == RateLimitScope.PER_IP:
            return ip_address
        elif scope == RateLimitScope.PER_API_KEY:
            return api_key_id
        elif scope == RateLimitScope.PER_ENDPOINT:
            return endpoint
        else:
            return None

    async def _check_limit(
        self, tenant_id: str, rule: RateLimitRule, identifier: str
    ) -> tuple[bool, int]:
        """
        Check if limit is exceeded using sliding window.

        Returns:
            Tuple of (is_allowed, current_count)
        """
        redis = await self._get_redis()
        key = self._generate_key(tenant_id, rule.scope, identifier, str(rule.id))

        # Use Redis sorted set for sliding window
        now = datetime.now(UTC).timestamp()
        window_start = now - rule.window_seconds

        # Remove old entries outside window
        await redis.zremrangebyscore(key, 0, window_start)

        # Count current entries in window
        current_count = await redis.zcount(key, window_start, now)

        # Check limit
        is_allowed = current_count < rule.max_requests

        return (is_allowed, current_count)

    async def _increment_counter(
        self, tenant_id: str, rule: RateLimitRule, identifier: str
    ) -> None:
        """Increment rate limit counter."""
        redis = await self._get_redis()
        key = self._generate_key(tenant_id, rule.scope, identifier, str(rule.id))

        now = datetime.now(UTC).timestamp()

        # Add current request to sorted set
        await redis.zadd(key, {str(now): now})

        # Set expiration to window + 60 seconds buffer
        await redis.expire(key, rule.window_seconds + 60)

    async def _log_violation(
        self,
        tenant_id: str,
        rule: RateLimitRule,
        endpoint: str,
        method: str,
        user_id: UUID | None,
        ip_address: str | None,
        api_key_id: str | None,
        current_count: int,
    ) -> None:
        """Log rate limit violation."""
        log_entry = RateLimitLog(
            tenant_id=tenant_id,
            rule_id=rule.id,
            rule_name=rule.name,
            user_id=user_id,
            ip_address=ip_address,
            api_key_id=api_key_id,
            endpoint=endpoint,
            method=method,
            current_count=current_count,
            limit=rule.max_requests,
            window=rule.window,
            action=rule.action,
            was_blocked=(rule.action == RateLimitAction.BLOCK),
        )

        self.db.add(log_entry)
        # Don't commit here - let the caller handle transaction

        logger.warning(
            "Rate limit exceeded",
            rule=rule.name,
            endpoint=endpoint,
            user_id=str(user_id) if user_id else None,
            ip_address=ip_address,
            current_count=current_count,
            limit=rule.max_requests,
        )

    async def get_rate_limit_status(
        self,
        tenant_id: str,
        endpoint: str,
        user_id: UUID | None = None,
        ip_address: str | None = None,
        api_key_id: str | None = None,
    ) -> dict[str, Any]:
        """Get current rate limit status for debugging."""
        rules = await self._get_applicable_rules(tenant_id, endpoint)

        limits: list[dict[str, Any]] = []
        status: dict[str, Any] = {
            "endpoint": endpoint,
            "rules_applied": len(rules),
            "limits": limits,
        }

        for rule in rules:
            if await self._is_exempt(rule, user_id, ip_address, api_key_id):
                continue

            identifier = self._get_identifier(
                rule.scope, tenant_id, user_id, ip_address, api_key_id, endpoint
            )

            if identifier is None:
                continue

            is_allowed, current_count = await self._check_limit(tenant_id, rule, identifier)

            limits.append(
                {
                    "rule_name": rule.name,
                    "scope": rule.scope.value,
                    "current_count": current_count,
                    "limit": rule.max_requests,
                    "window": rule.window.value,
                    "is_allowed": is_allowed,
                    "remaining": max(0, rule.max_requests - current_count),
                }
            )

        return status

    async def reset_limit(
        self,
        tenant_id: str,
        rule_id: UUID,
        identifier: str,
    ) -> bool:
        """Reset rate limit counter for specific identifier."""
        stmt = select(RateLimitRule).where(
            RateLimitRule.tenant_id == tenant_id,
            RateLimitRule.id == rule_id,
            RateLimitRule.deleted_at.is_(None),
        )

        result = await self.db.execute(stmt)
        rule = result.scalar_one_or_none()

        if not rule:
            return False

        redis = await self._get_redis()
        key = self._generate_key(tenant_id, rule.scope, identifier, str(rule.id))

        await redis.delete(key)

        logger.info("Rate limit reset", rule=rule.name, identifier=identifier)

        return True

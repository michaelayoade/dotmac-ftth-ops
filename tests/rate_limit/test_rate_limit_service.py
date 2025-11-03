from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from dotmac.platform.rate_limit.models import RateLimitAction, RateLimitScope, RateLimitWindow
from dotmac.platform.rate_limit.service import RateLimitService

pytestmark = pytest.mark.unit


def _make_rule(
    scope: RateLimitScope = RateLimitScope.PER_TENANT,
    *,
    max_requests: int = 5,
    window: RateLimitWindow = RateLimitWindow.MINUTE,
):
    """Create a lightweight RateLimitRule-like object for testing."""
    return SimpleNamespace(
        id=uuid4(),
        name="tenant-limit",
        scope=scope,
        max_requests=max_requests,
        window=window,
        window_seconds=60,
        action=RateLimitAction.BLOCK,
        exempt_user_ids=[],
        exempt_ip_addresses=[],
        exempt_api_keys=[],
        endpoint_pattern=None,
        is_active=True,
        deleted_at=None,
    )


@pytest.mark.asyncio
async def test_check_rate_limit_uses_tenant_identifier():
    tenant_id = "tenant-123"
    rule = _make_rule()

    db = AsyncMock()
    service = RateLimitService(db=db, redis=AsyncMock())

    service._get_applicable_rules = AsyncMock(return_value=[rule])  # type: ignore[attr-defined]
    service._is_exempt = AsyncMock(return_value=False)  # type: ignore[attr-defined]
    service._check_limit = AsyncMock(return_value=(False, 7))  # type: ignore[attr-defined]
    service._log_violation = AsyncMock()  # type: ignore[attr-defined]

    allowed, applied_rule, count = await service.check_rate_limit(
        tenant_id=tenant_id,
        endpoint="/api/v1/resource",
        method="GET",
    )

    service._check_limit.assert_awaited_once()
    _, call_kwargs = service._check_limit.await_args  # type: ignore[attr-defined]
    assert call_kwargs["identifier"] == tenant_id

    service._log_violation.assert_awaited_once()
    assert allowed is False
    assert applied_rule is rule
    assert count == 7


@pytest.mark.asyncio
async def test_increment_counter_for_tenant_scope():
    tenant_id = "tenant-789"
    rule = _make_rule()

    db = AsyncMock()
    service = RateLimitService(db=db, redis=AsyncMock())

    service._get_applicable_rules = AsyncMock(return_value=[rule])  # type: ignore[attr-defined]
    service._is_exempt = AsyncMock(return_value=False)  # type: ignore[attr-defined]
    service._increment_counter = AsyncMock()  # type: ignore[attr-defined]

    await service.increment(
        tenant_id=tenant_id,
        endpoint="/api/v1/resource",
    )

    service._increment_counter.assert_awaited_once()
    call_args = service._increment_counter.await_args  # type: ignore[attr-defined]
    assert call_args[0][2] == tenant_id  # args: (tenant_id, rule, identifier)

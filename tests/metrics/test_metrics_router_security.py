from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.metrics.router import (
    _require_metrics_permission,
    require_metrics_manage,
    require_metrics_read,
)

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_require_metrics_permission_accepts_alias(monkeypatch):
    """Legacy alias permissions should bypass the fallback checker."""

    async def fail_checker(*args, **kwargs):
        raise AssertionError("Fallback permission checker should not be invoked")

    monkeypatch.setattr(
        "dotmac.platform.metrics.router.require_permission",
        lambda permission: fail_checker,
    )

    dependency = _require_metrics_permission("metrics.read", ("metrics:read",))
    user = UserInfo(
        user_id="user-1",
        email="user@example.com",
        permissions=["metrics:read"],
        roles=[],
        tenant_id="tenant-1",
    )

    result = await dependency(current_user=user, db=AsyncMock())
    assert result is user


@pytest.mark.asyncio
async def test_require_metrics_permission_falls_back_to_checker(monkeypatch):
    """When user lacks direct permissions, fallback checker should be used."""

    calls: dict[str, tuple[UserInfo, AsyncMock] | None] = {"args": None}

    async def fake_checker(*, current_user, db):
        calls["args"] = (current_user, db)
        return current_user

    monkeypatch.setattr(
        "dotmac.platform.metrics.router.require_permission",
        lambda permission: fake_checker,
    )

    dependency = _require_metrics_permission("metrics.read", ("metrics:read",))
    user = UserInfo(
        user_id="user-2",
        email="user2@example.com",
        permissions=[],  # No metrics permissions granted
        roles=[],
        tenant_id="tenant-1",
    )
    db = AsyncMock()

    result = await dependency(current_user=user, db=db)
    assert result is user
    assert calls["args"] == (user, db)


@pytest.mark.asyncio
async def test_require_metrics_permission_propagates_checker_error(monkeypatch):
    """Ensure HTTP errors from the fallback checker bubble up to the caller."""

    async def failing_checker(*, current_user, db):
        raise HTTPException(status_code=403, detail="forbidden")

    monkeypatch.setattr(
        "dotmac.platform.metrics.router.require_permission",
        lambda permission: failing_checker,
    )

    dependency = _require_metrics_permission("metrics.read", ("metrics:read",))
    user = UserInfo(
        user_id="user-3",
        email="user3@example.com",
        permissions=[],
        roles=[],
        tenant_id="tenant-1",
    )

    with pytest.raises(HTTPException) as exc:
        await dependency(current_user=user, db=AsyncMock())

    assert exc.value.status_code == 403
    assert exc.value.detail == "forbidden"


@pytest.mark.asyncio
async def test_require_metrics_permission_allows_admin_role(monkeypatch):
    """Admin role should grant access without invoking fallback checker."""

    async def fail_checker(*args, **kwargs):
        raise AssertionError("Fallback checker should not be invoked for admins")

    monkeypatch.setattr(
        "dotmac.platform.metrics.router.require_permission",
        lambda permission: fail_checker,
    )

    dependency = _require_metrics_permission("metrics.read", ("metrics:read",))
    admin_user = UserInfo(
        user_id="admin-1",
        email="admin@example.com",
        permissions=[],
        roles=["admin"],
        tenant_id="tenant-1",
        is_platform_admin=False,
    )

    result = await dependency(current_user=admin_user, db=AsyncMock())
    assert result is admin_user


@pytest.mark.asyncio
async def test_require_metrics_manage_alias(monkeypatch):
    """Validate manage dependency accepts colon-style alias."""

    async def fail_checker(*args, **kwargs):
        raise AssertionError("Fallback checker should not be invoked for alias")

    monkeypatch.setattr(
        "dotmac.platform.metrics.router.require_permission",
        lambda permission: fail_checker,
    )

    user = UserInfo(
        user_id="user-manage",
        email="user@example.com",
        permissions=["metrics:manage"],
        roles=[],
        tenant_id="tenant-1",
    )

    result = await require_metrics_manage(current_user=user, db=AsyncMock())
    assert result is user


@pytest.mark.asyncio
async def test_require_metrics_read_allows_wildcard(monkeypatch):
    """Wildcard metrics permission should short-circuit without checker call."""

    async def fail_checker(*args, **kwargs):
        raise AssertionError("Fallback checker should not be invoked for wildcard")

    monkeypatch.setattr(
        "dotmac.platform.metrics.router.require_permission",
        lambda permission: fail_checker,
    )

    wildcard_user = UserInfo(
        user_id="wildcard",
        email="wildcard@example.com",
        permissions=["metrics:*"],
        roles=[],
        tenant_id="tenant-1",
    )

    result = await require_metrics_read(current_user=wildcard_user, db=AsyncMock())
    assert result is wildcard_user

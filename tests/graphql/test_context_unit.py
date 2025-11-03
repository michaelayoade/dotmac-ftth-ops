"""
Unit tests for GraphQL Context helper logic.

These tests exercise authentication, tenant resolution, and the
`Context.get_context` factory without invoking external services.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException, status
from starlette.requests import Request

from dotmac.platform.auth.core import TokenType, UserInfo
from dotmac.platform.graphql.context import Context

pytestmark = pytest.mark.unit


class DummySession:
    """Minimal async session stub."""

    def __init__(self) -> None:
        self.closed = False

    async def close(self) -> None:
        self.closed = True


def build_request(
    *,
    headers: dict[str, str] | None = None,
    tenant_id: str | None = None,
) -> Request:
    """Create a Starlette request with optional headers/state."""

    raw_headers = []
    headers = headers or {}
    for key, value in headers.items():
        raw_headers.append((key.lower().encode(), value.encode()))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "path": "/graphql",
        "query_string": b"",
        "headers": raw_headers,
    }

    async def receive() -> dict[str, Any]:  # pragma: no cover - not invoked
        return {"type": "http.request"}

    request = Request(scope, receive)
    request.state.tenant_id = tenant_id
    return request


@pytest.fixture(autouse=True)
def patch_loaders(monkeypatch: pytest.MonkeyPatch) -> None:
    """Avoid instantiating real DataLoaders in unit tests."""

    class DummyLoader:
        def __init__(self, _db: Any) -> None:
            pass

    monkeypatch.setattr(
        "dotmac.platform.graphql.context.DataLoaderRegistry",
        DummyLoader,
    )


def test_require_authenticated_user_with_user(monkeypatch: pytest.MonkeyPatch) -> None:
    """`require_authenticated_user` should return the logged-in user."""
    request = build_request()
    context = Context(request=request, db=DummySession(), current_user=UserInfo(user_id="1"))

    result = context.require_authenticated_user()
    assert isinstance(result, UserInfo)
    assert result.user_id == "1"


def test_require_authenticated_user_without_user() -> None:
    """`require_authenticated_user` should raise 401 when unauthenticated."""
    request = build_request()
    context = Context(request=request, db=DummySession(), current_user=None)

    with pytest.raises(HTTPException) as exc:
        context.require_authenticated_user()

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_active_tenant_id_for_regular_user() -> None:
    """Regular users should resolve to their own tenant."""
    user = UserInfo(user_id="1", tenant_id="tenant-1")
    request = build_request()
    context = Context(request=request, db=DummySession(), current_user=user)

    assert context.get_active_tenant_id() == "tenant-1"


def test_get_active_tenant_id_mismatch_raises() -> None:
    """Mismatch between user tenant and request tenant should raise 403."""
    user = UserInfo(user_id="1", tenant_id="tenant-1")
    request = build_request(tenant_id="tenant-2")
    context = Context(request=request, db=DummySession(), current_user=user)

    with pytest.raises(HTTPException) as exc:
        context.get_active_tenant_id()

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN


def test_get_active_tenant_id_platform_admin_requires_header() -> None:
    """Platform admins must supply X-Target-Tenant-ID when no tenant context."""
    user = UserInfo(user_id="1", tenant_id=None, is_platform_admin=True)
    request = build_request()
    context = Context(request=request, db=DummySession(), current_user=user)

    with pytest.raises(HTTPException) as exc:
        context.get_active_tenant_id()

    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST


def test_get_active_tenant_id_platform_admin_with_header() -> None:
    """Platform admins should resolve tenant from header."""
    user = UserInfo(user_id="1", tenant_id=None, is_platform_admin=True)
    request = build_request(headers={"X-Target-Tenant-ID": "tenant-42"})
    context = Context(request=request, db=DummySession(), current_user=user)

    assert context.get_active_tenant_id() == "tenant-42"


def test_dict_style_accessors() -> None:
    """Context should behave like a dict for legacy access."""
    user = UserInfo(user_id="1", tenant_id="tenant-1")
    request = build_request()
    context = Context(request=request, db=DummySession(), current_user=user)

    assert "tenant_id" in context
    assert context["tenant_id"] == "tenant-1"
    assert context.get("missing", "default") == "default"


@pytest.mark.asyncio
async def test_get_context_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Context.get_context should authenticate and return a populated context."""
    dummy_session = DummySession()
    monkeypatch.setattr(
        "dotmac.platform.graphql.context.AsyncSessionLocal",
        lambda: dummy_session,
    )
    called = {}

    def fake_verify(token: str, expected_type: TokenType | None = None) -> dict[str, Any]:
        called["token"] = token
        assert expected_type is TokenType.ACCESS
        return {
            "sub": "user-123",
            "tenant_id": "tenant-xyz",
            "roles": ["reader"],
            "permissions": ["analytics:view"],
            "email": "user@example.com",
        }

    monkeypatch.setattr(
        "dotmac.platform.graphql.context.jwt_service.verify_token",
        fake_verify,
    )

    request = build_request(headers={"Authorization": "Bearer test-token"})
    context = await Context.get_context(request)

    assert isinstance(context, Context)
    assert context.current_user is not None
    assert context.current_user.user_id == "user-123"
    assert called["token"] == "test-token"


@pytest.mark.asyncio
async def test_get_context_missing_token(monkeypatch: pytest.MonkeyPatch) -> None:
    """Missing authentication should raise 401 and close session."""
    dummy_session = DummySession()
    monkeypatch.setattr(
        "dotmac.platform.graphql.context.AsyncSessionLocal",
        lambda: dummy_session,
    )

    request = build_request()

    with pytest.raises(HTTPException) as exc:
        await Context.get_context(request)

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert dummy_session.closed is True


@pytest.mark.asyncio
async def test_get_context_verify_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """If token verification fails, session should be closed and error propagated."""
    dummy_session = DummySession()
    monkeypatch.setattr(
        "dotmac.platform.graphql.context.AsyncSessionLocal",
        lambda: dummy_session,
    )

    def fake_verify(token: str, expected_type: TokenType | None = None) -> dict[str, Any]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "invalid")

    monkeypatch.setattr(
        "dotmac.platform.graphql.context.jwt_service.verify_token",
        fake_verify,
    )

    request = build_request(headers={"Authorization": "Bearer bad"})

    with pytest.raises(HTTPException) as exc:
        await Context.get_context(request)

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert dummy_session.closed is True

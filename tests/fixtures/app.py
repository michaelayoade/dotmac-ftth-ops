"""FastAPI application fixtures used across the test suite."""

from __future__ import annotations

from contextlib import suppress
from typing import Any, AsyncIterator, Callable
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.fixtures.environment import HAS_FASTAPI

if not HAS_FASTAPI:  # pragma: no cover - FastAPI optional in some environments
    __all__: list[str] = []
else:
    from fastapi import FastAPI, Request, status
    from fastapi.testclient import TestClient
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from dotmac.platform.auth.core import TokenType, UserInfo, jwt_service
    from dotmac.platform.auth.dependencies import (
        get_current_user,
        get_current_user_optional,
    )
    from dotmac.platform.redis_client import get_redis_client
    from dotmac.platform.routers import register_routers
    from dotmac.platform.tenant import TenantConfiguration, TenantMiddleware, TenantMode, get_current_tenant_id
    from dotmac.platform.db import get_async_session, get_session_dependency

    from tests.fixtures.environment import HAS_DATABASE_BASE

    try:
        import pytest_asyncio
    except ImportError:  # pragma: no cover - fallback when pytest-asyncio unavailable
        pytest_asyncio = None

    AsyncFixture = pytest_asyncio.fixture if pytest_asyncio else pytest.fixture

    def _default_user() -> UserInfo:
        return UserInfo(
            user_id="550e8400-e29b-41d4-a716-446655440000",
            email="test@example.com",
            username="testuser",
            roles=["admin"],
            permissions=[
                "read",
                "write",
                "admin",
                "billing:subscriptions:write",
                "billing:subscriptions:read",
                "billing:invoices:write",
                "billing:invoices:read",
                "billing:payments:write",
                "billing:payments:read",
            ],
            tenant_id="test-tenant",
            is_platform_admin=True,
        )

    async def _resolve_user_from_request(request: Request) -> UserInfo | None:
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        if not token:
            token = request.cookies.get("access_token")
        if not token:
            return None

        with suppress(Exception):
            claims = jwt_service.verify_token(token, expected_type=TokenType.ACCESS)
            return UserInfo(
                user_id=claims.get("sub", ""),
                email=claims.get("email"),
                username=claims.get("username"),
                roles=claims.get("roles", []),
                permissions=claims.get("permissions", []),
                tenant_id=claims.get("tenant_id"),
                is_platform_admin=claims.get("is_platform_admin", False),
            )
        return None

    def _override_auth_dependencies(app: FastAPI) -> None:
        async def override_get_current_user(request: Request) -> UserInfo:
            user = await _resolve_user_from_request(request)
            return user or _default_user()

        async def override_get_current_user_optional(request: Request) -> UserInfo | None:
            return await _resolve_user_from_request(request)

        app.dependency_overrides[get_current_user] = override_get_current_user
        app.dependency_overrides[get_current_user_optional] = override_get_current_user_optional

    def _override_tenant_dependency(app: FastAPI) -> None:
        def override_get_current_tenant_id() -> str:
            return "test-tenant"

        app.dependency_overrides[get_current_tenant_id] = override_get_current_tenant_id

    def _override_db_dependency(app: FastAPI, async_session_factory: async_sessionmaker[AsyncSession]) -> None:
        async def override_session_dependency() -> AsyncIterator[AsyncSession]:
            async with async_session_factory() as session:
                try:
                    yield session
                except Exception:
                    await session.rollback()
                    raise
                finally:
                    await session.close()

        app.dependency_overrides[get_async_session] = override_session_dependency
        app.dependency_overrides[get_session_dependency] = override_session_dependency

        # Some modules import get_async_session from dotmac.platform.database
        try:
            from dotmac.platform.database import (
                get_async_session as get_async_session_from_database,
            )

            app.dependency_overrides[get_async_session_from_database] = override_session_dependency
        except ImportError:
            pass

    def _override_rbac_and_cache(app: FastAPI) -> None:
        # RBAC guard
        with suppress(ImportError):
            patcher = patch(
                "dotmac.platform.auth.rbac_service.RBACService.user_has_all_permissions",
                new_callable=AsyncMock,
                return_value=True,
            )
            patcher.start()

        # Redis client
        mock_redis = MagicMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.set = AsyncMock(return_value=True)
        mock_redis.delete = AsyncMock(return_value=True)
        mock_redis.exists = AsyncMock(return_value=False)
        mock_redis.expire = AsyncMock(return_value=True)
        mock_redis.ttl = AsyncMock(return_value=-1)
        mock_redis.keys = AsyncMock(return_value=[])
        mock_redis.scan = AsyncMock(return_value=(0, []))
        mock_redis.ping = AsyncMock(return_value=True)

        app.dependency_overrides[get_redis_client] = lambda: mock_redis

    def _include_all_routers(app: FastAPI) -> None:
        register_routers(app)
        if not getattr(app.state, "include_fiber", False):
            try:
                app.state.include_fiber = True
            except AttributeError:
                pass

    def _build_app(async_db_engine, *, override_auth: bool) -> FastAPI:
        app = FastAPI(title="Test App")

        try:
            tenant_config = TenantConfiguration(
                mode=TenantMode.MULTI,
                require_tenant_header=False,
                tenant_header_name="X-Tenant-ID",
            )
            app.add_middleware(TenantMiddleware, config=tenant_config)
        except ImportError:
            pass

        if override_auth:
            _override_auth_dependencies(app)
        _override_tenant_dependency(app)

        SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
        _override_db_dependency(app, SessionMaker)
        _override_rbac_and_cache(app)
        _include_all_routers(app)
        return app

    @pytest.fixture
    def test_app(async_db_engine) -> FastAPI:
        """FastAPI application configured with lightweight overrides."""
        app = _build_app(async_db_engine, override_auth=True)
        try:
            yield app
        finally:
            app.dependency_overrides.clear()

    class _HybridResponse:
        """Wrapper supporting sync and async access to HTTP responses."""

        def __init__(
            self,
            sync_client: TestClient,
            app: FastAPI,
            method: str,
            args: tuple[Any, ...],
            kwargs: dict[str, Any],
        ) -> None:
            self._sync_client = sync_client
            self._app = app
            self._method = method
            self._args = args
            self._kwargs = kwargs
            self._sync_response: Any | None = None

        def _ensure_sync(self):
            if self._sync_response is None:
                handler = getattr(self._sync_client, self._method)
                self._sync_response = handler(*self._args, **self._kwargs)
            return self._sync_response

        def __getattr__(self, name: str):
            return getattr(self._ensure_sync(), name)

        def __await__(self):
            async def _run():
                transport = ASGITransport(app=self._app)
                async with AsyncClient(
                    transport=transport,
                    base_url="http://testserver",
                    cookies=self._sync_client.cookies,
                ) as client:
                    handler = getattr(client, self._method)
                    response = await handler(*self._args, **self._kwargs)
                    self._sync_client.cookies.update(response.cookies)
                    return response

            return _run().__await__()

    class HybridTestClient:
        """Client compatible with sync and async usage."""

        def __init__(self, app: FastAPI) -> None:
            self._app = app
            self._sync_client = TestClient(app)

        def _make_request(self, method: str, *args: Any, **kwargs: Any) -> _HybridResponse:
            return _HybridResponse(self._sync_client, self._app, method, args, kwargs)

        def get(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("get", *args, **kwargs)

        def post(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("post", *args, **kwargs)

        def put(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("put", *args, **kwargs)

        def patch(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("patch", *args, **kwargs)

        def delete(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("delete", *args, **kwargs)

        def __getattr__(self, name: str):
            return getattr(self._sync_client, name)

    @pytest.fixture
    def test_client(test_app: FastAPI) -> HybridTestClient:
        """Hybrid HTTP client."""
        return HybridTestClient(test_app)

    @AsyncFixture
    async def authenticated_client(test_app: FastAPI) -> AsyncIterator[AsyncClient]:
        """Async HTTP client with authentication headers."""
        test_token = jwt_service.create_access_token(
            subject="test-user-123",
            additional_claims={
                "scopes": ["read", "write", "admin"],
                "tenant_id": "test-tenant",
                "email": "test@example.com",
                "username": "testuser",
            },
        )

        transport = ASGITransport(app=test_app)
        async with AsyncClient(
            transport=transport,
            base_url="http://testserver",
            headers={
                "Authorization": f"Bearer {test_token}",
                "X-Tenant-ID": "test-tenant",
            },
        ) as client:
            yield client

    @AsyncFixture
    async def unauthenticated_client(async_session, async_db_engine) -> AsyncIterator[AsyncClient]:
        """Async client without auth overrides for negative testing."""
        app = _build_app(async_db_engine, override_auth=False)

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session_dependency] = override_session
        app.dependency_overrides[get_async_session] = override_session

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield client

    __all__ = [
        "HybridTestClient",
        "authenticated_client",
        "test_app",
        "test_client",
        "unauthenticated_client",
    ]

"""FastAPI application fixtures used across the test suite."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Any

import pytest

from tests.fixtures.environment import HAS_FASTAPI, _is_integration_test

if not HAS_FASTAPI:  # pragma: no cover - FastAPI optional in some environments
    __all__: list[str] = []
else:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.testclient import TestClient
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

    from dotmac.platform.auth.core import (
        TokenType,
        UserInfo,
        _claims_to_user_info,
        jwt_service,
    )
    from dotmac.platform.auth.core import (
        get_current_user as core_get_current_user,
    )
    from dotmac.platform.auth.core import (
        get_current_user_optional as core_get_current_user_optional,
    )
    from dotmac.platform.auth.dependencies import (
        get_current_user,
        get_current_user_optional,
    )
    from dotmac.platform.db import get_async_session, get_session_dependency
    from dotmac.platform.redis_client import get_redis_client
    from dotmac.platform.routers import register_routers
    from dotmac.platform.tenant import (
        TenantConfiguration,
        TenantMiddleware,
        TenantMode,
        get_current_tenant_id,
        set_tenant_config,
    )
    from tests.fixtures.app_stubs import create_mock_redis, start_infrastructure_patchers
    from tests.fixtures.database import _session_scope

    try:
        import pytest_asyncio
    except ImportError:  # pragma: no cover - fallback when pytest-asyncio unavailable
        pytest_asyncio = None

    AsyncFixture = pytest_asyncio.fixture if pytest_asyncio else pytest.fixture

    logger = logging.getLogger(__name__)

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

        try:
            claims = jwt_service.verify_token(token, expected_type=TokenType.ACCESS)
        except HTTPException as exc:
            logger.debug("JWT verification failed for test request: %s", exc.detail)
            return None
        except Exception:  # pragma: no cover - defensive
            logger.exception("Unexpected error verifying JWT for test request")
            return None

        return _claims_to_user_info(claims)

    def _override_auth_dependencies(app: FastAPI) -> None:
        async def override_get_current_user(request: Request) -> UserInfo:
            user = await _resolve_user_from_request(request)
            return user or _default_user()

        async def override_get_current_user_optional(request: Request) -> UserInfo | None:
            return await _resolve_user_from_request(request)

        app.dependency_overrides[get_current_user] = override_get_current_user
        app.dependency_overrides[get_current_user_optional] = override_get_current_user_optional
        app.dependency_overrides[core_get_current_user] = override_get_current_user
        app.dependency_overrides[core_get_current_user_optional] = (
            override_get_current_user_optional
        )

    def _override_tenant_dependency(app: FastAPI) -> None:
        def override_get_current_tenant_id(request: Request) -> str:
            header_tenant = request.headers.get("X-Tenant-ID") if request else None
            if header_tenant:
                return header_tenant
            return "test-tenant"

        app.dependency_overrides[get_current_tenant_id] = override_get_current_tenant_id

    def _override_db_dependency(app: FastAPI, async_db_engine: AsyncEngine) -> None:
        async def override_session_dependency() -> AsyncIterator[AsyncSession]:
            async with _session_scope(async_db_engine) as session:
                yield session

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

    _INFRA_PATCHERS: list[Any] = []
    _INFRA_PATCHERS_STARTED = False

    def _ensure_infrastructure_patchers() -> None:
        global _INFRA_PATCHERS_STARTED
        if _INFRA_PATCHERS_STARTED:
            return

        patchers = start_infrastructure_patchers()
        if patchers:
            _INFRA_PATCHERS.extend(patchers)
        _INFRA_PATCHERS_STARTED = True

    @pytest.fixture(scope="session", autouse=True)
    def _teardown_infrastructure_patchers() -> None:
        global _INFRA_PATCHERS_STARTED
        try:
            yield
        finally:
            for patcher in _INFRA_PATCHERS:
                with suppress(RuntimeError, AttributeError):
                    patcher.stop()
            _INFRA_PATCHERS.clear()
            _INFRA_PATCHERS_STARTED = False

    def _override_rbac_and_cache(app: FastAPI) -> None:
        _ensure_infrastructure_patchers()

        if not _is_integration_test:
            mock_redis = create_mock_redis()
            app.state._redis_mock = mock_redis

            def _mock_redis_dependency():
                return app.state._redis_mock

            app.dependency_overrides[get_redis_client] = _mock_redis_dependency

        if _INFRA_PATCHERS:
            app.state._test_patchers = list(_INFRA_PATCHERS)
        app.state._infra_patched = True

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
                default_tenant_id="test-tenant",
                require_tenant_header=True,
                tenant_header_name="X-Tenant-ID",
            )
            set_tenant_config(tenant_config)
            app.add_middleware(TenantMiddleware, config=tenant_config)
        except ImportError:
            pass

        if override_auth:
            _override_auth_dependencies(app)
        _override_tenant_dependency(app)

        _override_db_dependency(app, async_db_engine)
        _override_rbac_and_cache(app)
        _include_all_routers(app)

        app.state._base_overrides = dict(app.dependency_overrides)
        return app

    @pytest.fixture
    def test_app(async_db_engine) -> FastAPI:
        """FastAPI application configured with lightweight overrides."""
        app = _build_app(async_db_engine, override_auth=True)
        base_overrides = getattr(app.state, "_base_overrides", {}).copy()
        try:
            yield app
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(base_overrides)

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
        """Client compatible with sync and async usage.

        Provides a unified interface so tests can call the same fixture from synchronous
        pytest functions (via `TestClient`) and async tests (via httpx) without creating
        separate clients. This keeps integration scenarios concise while still exercising
        the real ASGI stack.
        """

        def __init__(self, app: FastAPI) -> None:
            self._app = app
            self._sync_client = TestClient(app)
            self._tenant_header = "X-Tenant-ID"
            self._default_tenant = "test-tenant"

        def _apply_tenant_header(self, headers: dict[str, Any] | None) -> dict[str, Any]:
            """Ensure every request carries a tenant header unless explicitly disabled."""
            merged: dict[str, Any] = {}
            disable_default = False

            if headers:
                merged.update(headers)
                for key, value in list(merged.items()):
                    if key.lower() == self._tenant_header.lower() and value is None:
                        merged.pop(key)
                        disable_default = True

            if not disable_default:
                header_keys = {key.lower() for key in merged}
                if self._tenant_header.lower() not in header_keys:
                    merged[self._tenant_header] = self._default_tenant

            return merged

        def _make_request(self, method: str, *args: Any, **kwargs: Any) -> _HybridResponse:
            kwargs = dict(kwargs)
            kwargs["headers"] = self._apply_tenant_header(kwargs.get("headers"))
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
        async with AsyncClient(
            transport=transport,
            base_url="http://testserver",
            headers={"X-Tenant-ID": "test-tenant"},
        ) as client:
            yield client

    __all__ = [
        "HybridTestClient",
        "authenticated_client",
        "test_app",
        "test_client",
        "unauthenticated_client",
    ]

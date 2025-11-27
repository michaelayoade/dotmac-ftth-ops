"""Fixtures for E2E tests.

Provides database, HTTP client, and authentication fixtures for end-to-end testing."""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from dotmac.platform.db import Base
from tests.fixtures.environment import _import_base_and_models

# Ensure all ORM models are registered before creating tables
_import_base_and_models()


@pytest.fixture(autouse=True)
def e2e_test_environment(monkeypatch):
    """Ensure E2E tests run with consistent environment configuration."""
    monkeypatch.setenv("TESTING", "1")
    # Force lightweight, local dependencies for e2e runs
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("STORAGE__PROVIDER", "local")
    monkeypatch.setenv("STORAGE__LOCAL_PATH", "/tmp/dotmac-e2e-storage")
    monkeypatch.setenv("DOTMAC_STORAGE_LOCAL_PATH", "/tmp/dotmac-e2e-storage")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-for-e2e-tests")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/15")


@pytest_asyncio.fixture(scope="function")
async def e2e_db_engine():
    """Per-test async database engine using in-memory SQLite."""
    engine = create_async_engine(
        os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///:memory:"),
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        yield engine
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def e2e_db_session(e2e_db_engine) -> AsyncSession:
    """Async session bound to the per-test E2E engine."""
    session_maker = async_sessionmaker(
        e2e_db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_maker() as session:
        yield session


@pytest.fixture(autouse=True, scope="function")
def e2e_tenant_config(request):
    """Set e2e-specific tenant configuration only for e2e tests."""
    # Use nodeid which works reliably with pytest-xdist parallel execution
    # nodeid format: "tests/e2e/test_file.py::test_function"
    node_id = request.node.nodeid if hasattr(request.node, "nodeid") else ""

    # Check if this is an e2e test by looking at the node ID
    if "tests/e2e/" not in node_id:
        yield
        return

    original_tenant_id = os.environ.get("DEFAULT_TENANT_ID")

    from dotmac.platform.tenant.config import TenantConfiguration, set_tenant_config

    # Set e2e tenant ID
    os.environ["DEFAULT_TENANT_ID"] = "e2e-test-tenant"

    # Reinitialize tenant config with e2e environment variables
    set_tenant_config(TenantConfiguration())

    yield

    # Restore original tenant ID
    if original_tenant_id:
        os.environ["DEFAULT_TENANT_ID"] = original_tenant_id
    else:
        os.environ.pop("DEFAULT_TENANT_ID", None)

    # Reinitialize tenant config to restore original settings
    set_tenant_config(TenantConfiguration())


@pytest.fixture
def tenant_id():
    """Standard tenant ID for E2E tests."""
    return "e2e-test-tenant"


@pytest.fixture
def user_id():
    """Standard user ID for E2E tests."""
    # Use a fixed UUID for consistency across test runs
    return "12345678-1234-5678-1234-567812345678"


@pytest_asyncio.fixture
async def async_client(e2e_db_engine, tenant_id, user_id):
    """
    Create async HTTP client with dependency overrides for E2E tests.

    This allows tests to make real HTTP requests to the FastAPI app
    while using a test database and controlled dependencies.
    """
    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.database import get_async_session as get_database_async_session
    from dotmac.platform.db import get_async_session
    from dotmac.platform.main import app
    from dotmac.platform.tenant import get_current_tenant_id

    # Create a session maker for the test engine
    test_session_maker = async_sessionmaker(
        e2e_db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Ensure helper context managers inside the app use the per-test session maker
    import dotmac.platform._db_legacy as legacy_db
    import dotmac.platform.db as platform_db

    original_session_maker = legacy_db._async_session_maker
    original_session_maker_alias = legacy_db.async_session_maker
    legacy_db._async_session_maker = test_session_maker
    legacy_db.async_session_maker = test_session_maker
    platform_db.async_session_maker = test_session_maker

    # Create mock user with tenant admin permissions for e2e tests
    # NOTE: Explicitly NOT granting "platform:*" or "*" to avoid making all users platform admins
    async def mock_get_current_user(request=None, token=None, api_key=None):
        """Mock get_current_user for E2E tests - matches actual dependency signature."""
        return UserInfo(
            user_id=user_id,
            tenant_id=tenant_id,
            email="e2e-test@example.com",
            # Grant tenant-scoped permissions for e2e tests (not platform admin)
            permissions=[
                "tenant:read",
                "tenant:write",
                "tenant:admin",
                "users:read",
                "users:write",
                "users:admin",
                "customers:read",
                "customers:write",
                "customers:admin",
                "billing:read",
                "billing:write",
                "billing:admin",
                "files:read",
                "files:write",
                "files:admin",
                "webhooks:read",
                "webhooks:write",
                "webhooks:admin",
                "communications:read",
                "communications:write",
                "communications:admin",
                "data:read",
                "data:write",
                "data:admin",
            ],
            roles=["admin"],
            is_platform_admin=False,  # Explicitly not a platform admin
        )

    # Create async generator for session override - creates a new session for each request
    async def override_get_async_session():
        async with test_session_maker() as session:
            try:
                yield session
            finally:
                await session.close()

    # Import additional dependencies that need overriding
    # Patch get_current_tenant_id function to always return e2e tenant_id
    # This is necessary because some code calls get_current_tenant_id() as a function
    # rather than using it as a FastAPI dependency
    from unittest.mock import patch

    from dotmac.platform.auth.models import Role
    from dotmac.platform.db import get_session_dependency

    # Mock RBAC service to return admin role for e2e user
    async def mock_get_user_roles(self, user_id):
        # Return mock admin role for e2e tests (self param needed for instance method)
        from uuid import uuid4

        admin_role = Role(
            id=uuid4(),
            name="admin",
            display_name="Administrator",
            description="Administrator role for e2e tests",
        )
        return [admin_role]

    # Mock permission checking methods to always return True for e2e tests
    async def mock_user_has_all_permissions(self, user_id, permissions):
        # Grant all permissions for e2e tests
        return True

    async def mock_user_has_any_permission(self, user_id, permissions):
        # Grant all permissions for e2e tests
        return True

    # Patch RBACService methods
    from dotmac.platform.auth import rbac_service

    rbac_patch = patch.object(rbac_service.RBACService, "get_user_roles", new=mock_get_user_roles)
    rbac_patch.start()

    rbac_permissions_all_patch = patch.object(
        rbac_service.RBACService, "user_has_all_permissions", new=mock_user_has_all_permissions
    )
    rbac_permissions_all_patch.start()

    rbac_permissions_any_patch = patch.object(
        rbac_service.RBACService, "user_has_any_permission", new=mock_user_has_any_permission
    )
    rbac_permissions_any_patch.start()

    # Import get_async_db for webhooks router
    from dotmac.platform.db import get_async_db

    # Override app dependencies
    app.dependency_overrides[get_async_session] = override_get_async_session
    app.dependency_overrides[get_async_db] = override_get_async_session  # Webhooks router uses this
    app.dependency_overrides[get_session_dependency] = (
        override_get_async_session  # Auth router uses this
    )
    app.dependency_overrides[get_database_async_session] = override_get_async_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id
    app.dependency_overrides[get_current_user] = mock_get_current_user

    # Patch the function itself for direct calls (file storage router uses this)
    tenant_patch = patch("dotmac.platform.tenant.get_current_tenant_id", return_value=tenant_id)
    # Also patch where it's imported in file_storage.router
    router_tenant_patch = patch(
        "dotmac.platform.file_storage.router.get_current_tenant_id", return_value=tenant_id
    )

    tenant_patch.start()
    router_tenant_patch.start()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
            follow_redirects=True,
        ) as client:
            yield client
    finally:
        # Stop patches
        rbac_patch.stop()
        rbac_permissions_all_patch.stop()
        rbac_permissions_any_patch.stop()
        tenant_patch.stop()
        router_tenant_patch.stop()
        # Clear overrides after test
        app.dependency_overrides.clear()
        # Restore global session makers
        legacy_db._async_session_maker = original_session_maker
        legacy_db.async_session_maker = original_session_maker_alias
        platform_db.async_session_maker = original_session_maker_alias


@pytest_asyncio.fixture
async def client(async_client):
    """Alias for async_client for compatibility with tests using 'client' parameter."""
    yield async_client


@pytest.fixture
def auth_headers(tenant_id, user_id):
    """Auth headers for e2e tests."""
    from dotmac.platform.auth.core import JWTService

    jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-e2e-tests")
    test_token = jwt_service.create_access_token(
        subject=user_id,  # Use UUID from user_id fixture
        additional_claims={
            "scopes": ["read", "write", "admin"],
            "tenant_id": tenant_id,
            "email": "e2e-test@example.com",
        },
    )

    return {
        "Authorization": f"Bearer {test_token}",
        "X-Tenant-ID": tenant_id,
    }

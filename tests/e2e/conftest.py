"""
Fixtures for E2E tests.

Provides database, HTTP client, and authentication fixtures for end-to-end testing.
"""

import os

import pytest
import pytest_asyncio

# Set test environment variables (NOT DEFAULT_TENANT_ID - see fixture below)
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-e2e-tests"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"  # Test database

from httpx import ASGITransport, AsyncClient

# Import after environment is set
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from dotmac.platform.db import Base
from dotmac.platform.main import app
from dotmac.platform.tenant.config import TenantConfiguration, set_tenant_config


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


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create test database engine for E2E tests."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Create test database session for E2E tests."""
    async_session_maker = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    session = async_session_maker()
    try:
        yield session
    finally:
        await session.close()


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
async def async_client(db_engine, tenant_id, user_id):
    """
    Create async HTTP client with dependency overrides for E2E tests.

    This allows tests to make real HTTP requests to the FastAPI app
    while using a test database and controlled dependencies.
    """
    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.db import get_async_session
    from dotmac.platform.tenant import get_current_tenant_id

    # Create a session maker for the test engine
    test_session_maker = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Create mock user with admin permissions for e2e tests
    def mock_get_current_user():
        return UserInfo(
            user_id=user_id,
            tenant_id=tenant_id,
            email="e2e-test@example.com",
            permissions=["read", "write", "admin", "user:read", "user:write", "admin:read", "admin:write"],
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
    from unittest.mock import AsyncMock, patch

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

    # Patch RBACService.get_user_roles
    from dotmac.platform.auth import rbac_service

    rbac_patch = patch.object(
        rbac_service.RBACService, "get_user_roles", new=mock_get_user_roles
    )
    rbac_patch.start()

    # Override app dependencies
    app.dependency_overrides[get_async_session] = override_get_async_session
    app.dependency_overrides[get_session_dependency] = (
        override_get_async_session  # Auth router uses this
    )
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
        tenant_patch.stop()
        router_tenant_patch.stop()
        # Clear overrides after test
        app.dependency_overrides.clear()


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

"""
Fixtures for error handling integration tests.

Sets up a test FastAPI app with auth routers and properly configured dependencies.
"""

import os

# Disable rate limiting BEFORE importing any modules that use it
# This must be done before any rate_limit decorators are applied
os.environ["RATE_LIMIT__ENABLED"] = "false"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["TESTING"] = "1"

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Import all models at module level to register them with Base.metadata
try:
    from dotmac.platform.auth import models as auth_models  # noqa: F401
except ImportError:
    pass
try:
    from dotmac.platform.user_management import models as user_models  # noqa: F401
except ImportError:
    pass
try:
    from dotmac.platform.tenant import models as tenant_models  # noqa: F401
except ImportError:
    pass


@pytest.fixture(scope="function")
def async_db_engine():
    """Create test database engine with tables."""
    import asyncio
    import tempfile
    from pathlib import Path

    from dotmac.platform.db import Base

    # Create a temporary database file
    temp_db = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    temp_db.close()
    db_path = temp_db.name

    # Create engine with file-based SQLite
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Create all tables synchronously
    async def create_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Get or create event loop
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    loop.run_until_complete(create_tables())

    yield engine

    # Cleanup
    async def cleanup():
        await engine.dispose()

    loop.run_until_complete(cleanup())

    # Remove temporary database file
    try:
        Path(db_path).unlink()
    except (OSError, PermissionError):
        pass


@pytest.fixture
def test_app(async_db_engine):
    """Create FastAPI app with auth routers for error handling tests."""

    from dotmac.platform.database import get_async_session
    from dotmac.platform.db import get_session_dependency
    from dotmac.platform.tenant import get_current_tenant_id

    app = FastAPI(title="Error Handling Test App")

    # Add basic health endpoint for testing
    @app.get("/api/v1/health")
    async def health_check():
        return {"status": "healthy"}

    # Create session maker for async database
    async_session_maker = async_sessionmaker(
        async_db_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_session():
        async with async_session_maker() as session:
            yield session

    # Override database session dependencies
    app.dependency_overrides[get_session_dependency] = override_get_session
    app.dependency_overrides[get_async_session] = override_get_session

    # Import and register auth routers if available
    try:
        from dotmac.platform.auth.router import auth_router

        app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
    except ImportError:
        pass

    # Import and register RBAC router if available
    try:
        from dotmac.platform.auth.rbac_router import router as rbac_router

        app.include_router(rbac_router, prefix="/api/v1/auth/rbac", tags=["RBAC"])
    except ImportError:
        pass

    # Import and register API keys router if available
    try:
        from dotmac.platform.auth.api_keys_router import router as api_keys_router

        app.include_router(api_keys_router, prefix="/api/v1/auth/api-keys", tags=["API Keys"])
    except ImportError:
        pass

    # Import and register tenant router if available
    try:
        from dotmac.platform.tenant.router import router as tenant_router

        app.include_router(tenant_router, prefix="/api/v1/tenants", tags=["Tenants"])
    except ImportError:
        pass

    # Import and register admin router if available
    try:
        from dotmac.platform.admin.settings_router import router as admin_router

        app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])
    except ImportError:
        pass

    # Override auth dependencies to allow testing error scenarios
    # We don't override by default - let each test trigger auth errors naturally
    # Tests can override these if needed

    # Create a mock tenant context that doesn't reject all requests
    def override_tenant_id():
        return "test-tenant-123"

    # Don't override auth - let it fail naturally for error tests
    # But provide tenant context to avoid tenant middleware rejection
    app.dependency_overrides[get_current_tenant_id] = override_tenant_id

    return app


@pytest.fixture
def auth_headers():
    """Create authentication headers with valid JWT token."""
    from dotmac.platform.auth.core import jwt_service

    token = jwt_service.create_access_token(
        subject="test-user-123",
        additional_claims={
            "username": "testuser",
            "email": "test@example.com",
            "tenant_id": "test-tenant-123",
            "roles": ["admin"],
            "permissions": ["tenants:read", "tenants:write", "tenants:admin"],
        },
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_client(test_app):
    """Create test client for error handling tests."""
    # Patch slowapi's rate_limit decorator to be a no-op
    # This prevents issues with TestClient not providing proper Request objects
    with patch("dotmac.platform.core.rate_limiting.rate_limit") as mock_rate_limit:
        # Make the decorator a pass-through (just return the function unchanged)
        mock_rate_limit.side_effect = lambda *args, **kwargs: lambda func: func
        return TestClient(test_app)

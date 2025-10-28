"""
Fixtures for fiber infrastructure tests.
"""

import pytest
import pytest_asyncio
from fastapi import HTTPException, Request, status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import JWTService, UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.redis_client import get_redis_client
from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus

# Import shared fixtures
from tests.shared_fixtures import *  # noqa: F401, F403





pytestmark = pytest.mark.integration

@pytest_asyncio.fixture
async def test_tenant(async_db_session: AsyncSession) -> Tenant:
    """Create a test tenant for fiber tests."""
    from uuid import uuid4

    tenant = Tenant(
        id=f"tenant-{uuid4().hex}",
        name="Test Tenant for Fiber",
        slug=f"test-fiber-{uuid4().hex[:8]}",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
        billing_cycle=BillingCycle.MONTHLY,
        email="fiber-test@example.com",
    )

    async_db_session.add(tenant)
    await async_db_session.commit()
    await async_db_session.refresh(tenant)

    yield tenant

    # Cleanup
    try:
        await async_db_session.delete(tenant)
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()


@pytest.fixture
def test_tenant_id(test_tenant: Tenant) -> str:
    """Get test tenant ID as string."""
    return test_tenant.id


@pytest.fixture
def db_session(async_db_session: AsyncSession) -> AsyncSession:
    """Alias async_db_session to db_session for fiber tests."""
    return async_db_session


@pytest_asyncio.fixture
async def client(
    authenticated_client,
    async_db_session: AsyncSession,
    redis_client,
    test_tenant: Tenant,
) -> AsyncClient:
    """
    Override client to inject test database session, redis, and tenant context.

    This ensures that the FastAPI app uses the same database session
    as the tests, allowing test data to be visible to API endpoints.
    """
    app = authenticated_client._transport.app  # type: ignore[attr-defined]

    # Override database session dependency
    async def override_get_session_dependency():
        yield async_db_session

    # Override redis client dependency
    async def override_get_redis_client():
        yield redis_client

    # Override current user dependency to use test tenant ID
    async def override_get_current_user(request: Request):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        return UserInfo(
            user_id="test-user-123",
            tenant_id=test_tenant.id,
            email="test@example.com",
            roles=["admin"],
            permissions=["*"],
        )

    app.dependency_overrides[get_session_dependency] = override_get_session_dependency
    app.dependency_overrides[get_redis_client] = override_get_redis_client
    app.dependency_overrides[get_current_user] = override_get_current_user

    # Attach tenant header and auth token per request by reusing authenticated_client
    # Update Authorization header to tenant-scoped token
    authenticated_client.headers["X-Tenant-ID"] = test_tenant.id

    try:
        yield authenticated_client
    finally:
        authenticated_client.headers.pop("X-Tenant-ID", None)

    # Cleanup overrides
    app.dependency_overrides.pop(get_session_dependency, None)
    app.dependency_overrides.pop(get_redis_client, None)
    app.dependency_overrides.pop(get_current_user, None)


@pytest_asyncio.fixture
async def auth_headers(test_tenant: Tenant) -> dict[str, str]:
    """Authorization headers scoped to the test tenant."""

    jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-testing-only")

    token = jwt_service.create_access_token(
        subject="test-user-123",
        additional_claims={
            "scopes": ["read", "write", "admin"],
            "tenant_id": test_tenant.id,
            "email": "test@example.com",
        },
    )

    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": test_tenant.id,
    }

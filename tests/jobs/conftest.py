"""
Jobs test fixtures
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.redis_client import get_redis_client
from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus

pytestmark = pytest.mark.integration


@pytest.fixture
def db_session(async_db_session: AsyncSession) -> AsyncSession:
    """Alias async_db_session to db_session for jobs tests."""
    return async_db_session


@pytest_asyncio.fixture
async def test_tenant(async_db_session: AsyncSession) -> Tenant:
    """
    Create a test tenant for jobs tests.
    """
    # Create tenant directly
    tenant = Tenant(
        id=f"tenant-{uuid4().hex}",
        name="Test Tenant for Jobs",
        slug=f"test-jobs-{uuid4().hex[:8]}",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
        billing_cycle=BillingCycle.MONTHLY,
        email="jobs-test@example.com",
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


@pytest_asyncio.fixture
async def async_client(
    authenticated_client: AsyncClient,
    async_db_session: AsyncSession,
    redis_client,
    test_tenant: Tenant,
) -> AsyncClient:
    """
    Override async_client to inject test database session, redis, and tenant context.

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
    async def override_get_current_user():
        return UserInfo(
            user_id="550e8400-e29b-41d4-a716-446655440000",  # Valid UUID format
            tenant_id=test_tenant.id,  # Use actual test tenant ID
            email="test@example.com",
            roles=["admin"],
            permissions=["*"],  # Grant all permissions for testing
        )

    app.dependency_overrides[get_session_dependency] = override_get_session_dependency
    app.dependency_overrides[get_redis_client] = override_get_redis_client
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield authenticated_client

    # Cleanup overrides
    app.dependency_overrides.pop(get_session_dependency, None)
    app.dependency_overrides.pop(get_redis_client, None)
    app.dependency_overrides.pop(get_current_user, None)

"""Test fixtures for CRM module."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import JWTService
from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus


@pytest_asyncio.fixture
async def test_tenant(async_db_session: AsyncSession) -> Tenant:
    """Create a test tenant for CRM tests."""
    from uuid import uuid4

    tenant = Tenant(
        id=f"tenant-{uuid4().hex}",
        name="Test Tenant for CRM",
        slug=f"test-crm-{uuid4().hex[:8]}",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
        billing_cycle=BillingCycle.MONTHLY,
        email="crm-test@example.com",
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


@pytest.fixture
def db_session(async_db_session: AsyncSession) -> AsyncSession:
    """Alias async_db_session to db_session for CRM tests."""
    return async_db_session


@pytest_asyncio.fixture
async def async_client(test_app, async_db_session: AsyncSession, test_tenant: Tenant):
    """Async HTTP client for CRM API tests.

    Creates an httpx AsyncClient for testing async endpoints.
    Overrides database session to ensure test data is visible to API.
    """
    from uuid import uuid4

    from httpx import ASGITransport, AsyncClient

    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.db import get_session_dependency
    from dotmac.platform.user_management.models import User

    # Create a test user
    test_user = User(
        id=uuid4(),
        tenant_id=test_tenant.id,
        email="test@example.com",
        username="testuser",
        password_hash="hashed_password_for_testing",  # Required field
        first_name="Test",
        last_name="User",
        is_active=True,
        is_verified=True,
    )
    async_db_session.add(test_user)
    await async_db_session.commit()
    await async_db_session.refresh(test_user)

    # Override database session dependency
    async def override_get_session():
        yield async_db_session

    # Override get_current_user dependency
    async def override_get_current_user():
        return test_user

    test_app.dependency_overrides[get_session_dependency] = override_get_session
    test_app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    # Cleanup
    test_app.dependency_overrides.pop(get_session_dependency, None)
    test_app.dependency_overrides.pop(get_current_user, None)

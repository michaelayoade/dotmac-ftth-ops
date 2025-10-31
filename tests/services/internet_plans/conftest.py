"""
Fixtures for internet plan service tests.
"""

from uuid import uuid4

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus


@pytest_asyncio.fixture
async def test_tenant(async_db_session: AsyncSession) -> Tenant:
    """Create a tenant record scoped for internet plan tests."""
    tenant_id = str(uuid4())

    tenant = Tenant(
        id=tenant_id,
        name="Internet Plans Test Tenant",
        slug=f"internet-plans-{uuid4().hex[:8]}",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
        billing_cycle=BillingCycle.MONTHLY,
        email="internet-plans-test@example.com",
    )

    async_db_session.add(tenant)
    await async_db_session.commit()
    await async_db_session.refresh(tenant)

    try:
        yield tenant
    finally:
        try:
            await async_db_session.delete(tenant)
            await async_db_session.commit()
        except Exception:
            await async_db_session.rollback()

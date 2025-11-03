"""Fixtures for journey tests."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
import pytest_asyncio

from dotmac.platform.tenant.models import Tenant

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def test_tenant(async_session):
    """Create a test tenant for journey tests."""
    tenant = Tenant(
        id=f"test-tenant-{uuid4().hex[:8]}",
        name="Test Tenant",
        slug=f"test-tenant-{uuid4().hex[:8]}",
        is_active=True,
        created_at=datetime.now(UTC),
    )
    async_session.add(tenant)
    await async_session.flush()
    return tenant

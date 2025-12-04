import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.subscribers.models import SubscriberStatus
from dotmac.platform.subscribers.schemas import SubscriberCreate, SubscriberUpdate
from dotmac.platform.subscribers.service import SubscriberService


@pytest.mark.asyncio
async def test_create_and_get_subscriber(async_db_session: AsyncSession, test_tenant_id: str):
    service = SubscriberService(async_db_session, tenant_id=test_tenant_id)
    customer_id = uuid.uuid4()

    created = await service.create_subscriber(
        SubscriberCreate(
            customer_id=customer_id,
            full_name="Test User",
            email="test@example.com",
            plan_id=None,
        )
    )

    assert created.id
    assert created.username
    assert created.tenant_id == test_tenant_id
    assert created.customer_id == customer_id

    fetched = await service.get_subscriber(created.id)
    assert fetched is not None
    assert fetched.username == created.username


@pytest.mark.asyncio
async def test_update_subscriber(async_db_session: AsyncSession, test_tenant_id: str):
    service = SubscriberService(async_db_session, tenant_id=test_tenant_id)
    created = await service.create_subscriber(
        SubscriberCreate(full_name="User", email="u@example.com")
    )

    updated = await service.update_subscriber(
        created.id,
        SubscriberUpdate(
            full_name="Updated User",
            status=SubscriberStatus.ACTIVE,
        ),
    )

    assert updated is not None
    assert updated.full_name == "Updated User"
    assert updated.status == SubscriberStatus.ACTIVE


@pytest.mark.asyncio
async def test_delete_subscriber(async_db_session: AsyncSession, test_tenant_id: str):
    service = SubscriberService(async_db_session, tenant_id=test_tenant_id)
    created = await service.create_subscriber(
        SubscriberCreate(full_name="User", email="u@example.com")
    )

    deleted = await service.delete_subscriber(created.id)
    assert deleted is True

    fetched = await service.get_subscriber(created.id)
    assert fetched is None

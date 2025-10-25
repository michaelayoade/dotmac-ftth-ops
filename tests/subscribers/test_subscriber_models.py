from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus
from dotmac.platform.services.lifecycle.models import ServiceType


@pytest.mark.asyncio
async def test_subscriber_defaults(async_db_session):
    """Persisting a subscriber should populate default status and service type."""
    subscriber = Subscriber(
        tenant_id="tenant-123",
        username="john.doe@example.com",
        password="secret",
    )

    async_db_session.add(subscriber)
    await async_db_session.flush()
    await async_db_session.commit()

    result = await async_db_session.scalar(
        select(Subscriber).where(Subscriber.id == subscriber.id)
    )

    assert result is not None
    assert result.status is SubscriberStatus.PENDING
    assert result.service_type is ServiceType.FIBER_INTERNET
    assert result.simultaneous_use == 1


def test_subscriber_properties():
    """Computed properties should reflect service state and traffic totals."""
    subscriber = Subscriber(
        tenant_id="tenant-abc",
        username="active-user",
        password="secret",
        status=SubscriberStatus.ACTIVE,
        total_upload_bytes=1_500,
        total_download_bytes=3_000,
        subscriber_number="SUB-100",
    )

    assert subscriber.is_active is True
    assert subscriber.total_bytes == 4_500
    assert subscriber.display_name == "active-user (SUB-100)"

    subscriber.subscriber_number = None
    assert subscriber.display_name == "active-user"


@pytest.mark.asyncio
async def test_unique_username_per_tenant(async_db_session):
    """The username must be unique within the same tenant, but can repeat across tenants."""
    first = Subscriber(
        tenant_id="tenant-unique",
        username="duplicate@example.com",
        password="secret",
    )
    second_same_tenant = Subscriber(
        tenant_id="tenant-unique",
        username="duplicate@example.com",
        password="secret-2",
    )

    async_db_session.add(first)
    await async_db_session.flush()

    async_db_session.add(second_same_tenant)
    with pytest.raises(IntegrityError):
        await async_db_session.commit()

    await async_db_session.rollback()

    second_other_tenant = Subscriber(
        tenant_id="tenant-other",
        username="duplicate@example.com",
        password="secret-3",
    )
    async_db_session.add(second_other_tenant)
    await async_db_session.commit()

    found = await async_db_session.scalar(
        select(Subscriber).where(
            Subscriber.tenant_id == "tenant-other",
            Subscriber.username == "duplicate@example.com",
        )
    )
    assert found is not None

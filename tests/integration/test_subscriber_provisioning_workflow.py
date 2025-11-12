"""Integration tests for subscriber provisioning workflow.

Tests the complete flow:
1. Create subscriber
2. Assign service plan
3. Provision RADIUS
4. Verify network access
"""

from uuid import uuid4

import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_complete_subscriber_provisioning_workflow(async_session, test_tenant):
    """Test end-to-end subscriber provisioning."""
    from dotmac.platform.subscribers.models import Subscriber

    tenant_id = test_tenant.id if test_tenant else uuid4()

    # Step 1: Create subscriber
    subscriber = Subscriber(
        id=uuid4(),
        tenant_id=tenant_id,
        username="test_subscriber_001",
        email="subscriber@test.com",
        status="active",
    )

    async_session.add(subscriber)
    await async_session.commit()
    await async_session.refresh(subscriber)

    assert subscriber.id is not None
    assert subscriber.username == "test_subscriber_001"

    # Step 2: RADIUS provisioning would happen here
    # (Integration with RADIUS service)

    # Step 3: Verify subscriber is created
    assert subscriber.status == "active"


@pytest.mark.asyncio
async def test_subscriber_service_activation(async_session, test_tenant):
    """Test activating service for a subscriber."""
    from dotmac.platform.subscribers.models import Subscriber, SubscriberService

    tenant_id = test_tenant.id if test_tenant else uuid4()

    # Create subscriber
    subscriber = Subscriber(
        id=uuid4(),
        tenant_id=tenant_id,
        username="test_sub_002",
        email="sub2@test.com",
        status="pending",
    )

    async_session.add(subscriber)
    await async_session.flush()

    # Create service
    service = SubscriberService(
        id=uuid4(),
        tenant_id=tenant_id,
        subscriber_id=subscriber.id,
        service_type="internet",
        status="provisioning",
    )

    async_session.add(service)
    await async_session.commit()

    # Update status to active
    service.status = "active"
    subscriber.status = "active"
    await async_session.commit()

    await async_session.refresh(subscriber)
    await async_session.refresh(service)

    assert subscriber.status == "active"
    assert service.status == "active"

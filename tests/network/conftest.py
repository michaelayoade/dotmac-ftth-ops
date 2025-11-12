"""
Shared fixtures for network profile tests.
"""

import pytest_asyncio
from sqlalchemy import delete

# Import the subscriber factory fixture from the subscribers module
from tests.subscribers.conftest import subscriber, subscriber_factory  # noqa: F401


@pytest_asyncio.fixture(autouse=True)
async def cleanup_network_profiles(async_db_session):
    """Ensure network profile tables are cleared between tests."""
    from dotmac.platform.network.models import SubscriberNetworkProfile

    # Clean before test
    try:
        await async_db_session.execute(delete(SubscriberNetworkProfile))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()

    yield

    # Clean after test
    try:
        await async_db_session.execute(delete(SubscriberNetworkProfile))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()


# Re-export the fixtures to make them available to network tests
__all__ = ["subscriber_factory", "subscriber", "cleanup_network_profiles"]

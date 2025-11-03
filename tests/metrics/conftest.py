"""Shared fixtures for metrics tests."""

import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker

from dotmac.platform.radius.models import NAS, RadAcct, RadiusBandwidthProfile
from dotmac.platform.subscribers.models import Subscriber
from dotmac.platform.tenant.models import Tenant


@pytest_asyncio.fixture(autouse=True)
async def clear_metrics_data(async_db_engine):
    """Ensure metrics-related tables are clean before and after each test."""
    session_factory = async_sessionmaker(bind=async_db_engine, expire_on_commit=False)
    tables = [
        Subscriber,
        RadiusBandwidthProfile,
        RadAcct,
        NAS,
        Tenant,
    ]

    async def purge() -> None:
        async with session_factory() as session:
            for model in tables:
                await session.execute(delete(model))
            await session.commit()

    await purge()
    yield
    await purge()

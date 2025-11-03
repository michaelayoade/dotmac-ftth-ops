import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker

from dotmac.platform.audit.models import AuditActivity


@pytest_asyncio.fixture(autouse=True)
async def clean_audit_activities(async_db_engine):
    """Ensure the audit activity table starts empty for every audit test."""
    session_factory = async_sessionmaker(bind=async_db_engine, expire_on_commit=False)

    async def purge() -> None:
        async with session_factory() as session:
            await session.execute(delete(AuditActivity))
            await session.commit()

    await purge()
    yield
    await purge()

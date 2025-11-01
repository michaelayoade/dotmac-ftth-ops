import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import AuditActivity


@pytest_asyncio.fixture(autouse=True)
async def clean_audit_activities(async_db_session: AsyncSession):
    """Ensure the audit activity table starts empty for every test."""
    await async_db_session.execute(delete(AuditActivity))
    await async_db_session.commit()
    yield
    try:
        await async_db_session.execute(delete(AuditActivity))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()

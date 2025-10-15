"""
Database session dependencies for FastAPI
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import AsyncSessionLocal


async def get_async_session() -> AsyncIterator[AsyncSession]:
    """Get async database session for dependency injection"""
    async with AsyncSessionLocal() as session:
        yield session


# Legacy alias for compatibility
get_session = get_async_session

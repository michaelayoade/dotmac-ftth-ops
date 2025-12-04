"""TimescaleDB Database Connection."""

from collections.abc import AsyncIterator

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

# Globals
timescaledb_engine: AsyncEngine | None = None
TimeSeriesSessionLocal: async_sessionmaker[AsyncSession] | None = None


def init_timescaledb() -> None:
    """Initialize TimescaleDB connection."""
    global timescaledb_engine, TimeSeriesSessionLocal

    if not settings.timescaledb.is_configured:
        logger.info("timescaledb.disabled", reason="Not configured or disabled")
        return

    logger.info(
        "timescaledb.init.start",
        host=settings.timescaledb.host,
        database=settings.timescaledb.database,
    )

    # Create async engine
    timescaledb_engine = create_async_engine(
        settings.timescaledb.sqlalchemy_url,
        pool_size=settings.timescaledb.pool_size,
        max_overflow=settings.timescaledb.max_overflow,
        pool_timeout=settings.timescaledb.pool_timeout,
        pool_recycle=settings.timescaledb.pool_recycle,
        pool_pre_ping=settings.timescaledb.pool_pre_ping,
        echo=False,
    )

    # Create session factory
    TimeSeriesSessionLocal = async_sessionmaker(
        bind=timescaledb_engine,
        expire_on_commit=False,
    )

    logger.info("timescaledb.init.complete")


async def shutdown_timescaledb() -> None:
    """Shutdown TimescaleDB connection."""
    global timescaledb_engine

    if timescaledb_engine:
        logger.info("timescaledb.shutdown.start")
        await timescaledb_engine.dispose()
        timescaledb_engine = None
        logger.info("timescaledb.shutdown.complete")


async def get_timeseries_session() -> AsyncIterator[AsyncSession]:
    """Get TimescaleDB session (dependency injection)."""
    if not TimeSeriesSessionLocal:
        raise RuntimeError("TimescaleDB not initialized. Call init_timescaledb() first.")

    async with TimeSeriesSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

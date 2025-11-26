"""
Celery Tasks for RADIUS Operations.

Background tasks for RADIUS session synchronization and maintenance.
"""

from datetime import datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError

from dotmac.platform.celery_app import celery_app
from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.radius.models import RadAcct
from dotmac.platform.settings import settings
from dotmac.platform.timeseries import TimeSeriesSessionLocal
from dotmac.platform.timeseries.models import RadAcctTimeSeries

logger = structlog.get_logger(__name__)


@celery_app.task(name="radius.sync_sessions_to_timescaledb", bind=True, max_retries=3)
def sync_sessions_to_timescaledb(
    self: Any,
    batch_size: int = 100,
    max_age_hours: int = 24,
) -> dict[str, Any]:
    """
    Sync completed RADIUS sessions from PostgreSQL to TimescaleDB.

    This task runs periodically to ensure all completed sessions are
    captured in TimescaleDB for analytics. It's idempotent - duplicate
    insertions are handled gracefully.

    Args:
        batch_size: Number of sessions to process per batch
        max_age_hours: Only sync sessions completed within this many hours

    Returns:
        dict: Statistics about the sync operation

    Example:
        # Manual trigger
        from dotmac.platform.radius.tasks import sync_sessions_to_timescaledb
        result = sync_sessions_to_timescaledb.delay(batch_size=500)
    """
    # Check if TimescaleDB is configured
    if not settings.timescaledb.is_configured:
        logger.warning("timescaledb.not_configured", task="sync_sessions")
        return {
            "status": "skipped",
            "reason": "TimescaleDB not configured",
            "synced": 0,
        }

    import asyncio

    return asyncio.run(_sync_sessions_async(batch_size, max_age_hours))


async def _sync_sessions_async(batch_size: int, max_age_hours: int) -> dict[str, Any]:
    """
    Async implementation of session synchronization.

    Args:
        batch_size: Number of sessions per batch
        max_age_hours: Max age of sessions to sync

    Returns:
        dict: Sync statistics
    """
    start_time = datetime.now()
    total_synced = 0
    total_skipped = 0
    total_errors = 0

    # Calculate cutoff time
    cutoff_time = datetime.now() - timedelta(hours=max_age_hours)

    logger.info(
        "timescaledb.sync.start",
        batch_size=batch_size,
        max_age_hours=max_age_hours,
        cutoff_time=cutoff_time.isoformat(),
    )

    try:
        async with AsyncSessionLocal() as pg_session:
            session_factory = TimeSeriesSessionLocal
            if session_factory is None:
                raise RuntimeError("TimescaleDB session not initialized")

            async with session_factory() as ts_session:
                # Query for completed sessions not yet in TimescaleDB
                # We'll process in batches
                offset = 0

                while True:
                    # Fetch batch of completed sessions
                    stmt = (
                        select(RadAcct)
                        .where(
                            and_(
                                RadAcct.acctstoptime.isnot(None),
                                RadAcct.acctstoptime >= cutoff_time,
                            )
                        )
                        .order_by(RadAcct.acctstoptime.desc())
                        .offset(offset)
                        .limit(batch_size)
                    )

                    result = await pg_session.execute(stmt)
                    sessions = result.scalars().all()

                    if not sessions:
                        break

                    # Process each session
                    for session in sessions:
                        try:
                            # Calculate total bytes
                            input_octets = session.acctinputoctets or 0
                            output_octets = session.acctoutputoctets or 0
                            total_bytes = input_octets + output_octets

                            # Create TimescaleDB record
                            ts_record = RadAcctTimeSeries(
                                time=session.acctstoptime,
                                tenant_id=session.tenant_id,
                                subscriber_id=session.subscriber_id,
                                username=session.username,
                                session_id=session.acctsessionid,
                                nas_ip_address=session.nasipaddress,
                                total_bytes=total_bytes,
                                input_octets=input_octets,
                                output_octets=output_octets,
                                session_duration=session.acctsessiontime or 0,
                                framed_ip_address=session.framedipaddress,
                                framed_ipv6_address=session.framedipv6address,
                                terminate_cause=session.acctterminatecause,
                                session_start_time=session.acctstarttime,
                                session_stop_time=session.acctstoptime,
                            )

                            ts_session.add(ts_record)
                            total_synced += 1

                        except IntegrityError:
                            # Duplicate - already exists in TimescaleDB
                            await ts_session.rollback()
                            total_skipped += 1
                            logger.debug(
                                "timescaledb.sync.duplicate",
                                session_id=session.acctsessionid,
                                username=session.username,
                            )

                        except Exception as e:
                            # Other error - log and continue
                            await ts_session.rollback()
                            total_errors += 1
                            logger.error(
                                "timescaledb.sync.error",
                                session_id=session.acctsessionid,
                                error=str(e),
                            )

                    # Commit batch
                    try:
                        await ts_session.commit()
                    except Exception as e:
                        await ts_session.rollback()
                        logger.error("timescaledb.sync.batch_commit_failed", error=str(e))

                    # Move to next batch
                    offset += batch_size

                    # Safety limit to prevent runaway processing
                    if offset >= 10000:
                        logger.warning(
                            "timescaledb.sync.batch_limit_reached",
                            offset=offset,
                            synced=total_synced,
                        )
                        break

    except Exception as e:
        logger.error("timescaledb.sync.fatal_error", error=str(e))
        raise

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Log completion
    logger.info(
        "timescaledb.sync.complete",
        synced=total_synced,
        skipped=total_skipped,
        errors=total_errors,
        duration_seconds=duration,
    )

    return {
        "status": "completed",
        "synced": total_synced,
        "skipped": total_skipped,
        "errors": total_errors,
        "duration_seconds": duration,
        "rate_per_second": total_synced / duration if duration > 0 else 0,
    }


@celery_app.task(name="radius.cleanup_old_sessions", bind=True)
def cleanup_old_sessions(self: Any, days_old: int = 90) -> dict[str, Any]:
    """
    Clean up old RADIUS sessions from PostgreSQL.

    After sessions are synced to TimescaleDB (which has its own retention
    policy), we can optionally clean up old sessions from PostgreSQL to
    save space.

    Args:
        days_old: Delete sessions older than this many days

    Returns:
        dict: Cleanup statistics

    Note:
        This task should be used with caution. Ensure TimescaleDB sync
        is working properly before enabling automated cleanup.
    """
    import asyncio

    return asyncio.run(_cleanup_old_sessions_async(days_old))


async def _cleanup_old_sessions_async(days_old: int) -> dict[str, Any]:
    """
    Async implementation of session cleanup.

    Args:
        days_old: Age threshold for deletion

    Returns:
        dict: Cleanup statistics
    """
    cutoff_date = datetime.now() - timedelta(days=days_old)

    logger.info(
        "radius.cleanup.start",
        days_old=days_old,
        cutoff_date=cutoff_date.isoformat(),
    )

    try:
        async with AsyncSessionLocal() as session:
            # Delete old completed sessions
            stmt = select(RadAcct).where(
                and_(
                    RadAcct.acctstoptime.isnot(None),
                    RadAcct.acctstoptime < cutoff_date,
                )
            )

            result = await session.execute(stmt)
            old_sessions = result.scalars().all()
            count = len(old_sessions)

            # Delete in batches
            for old_session in old_sessions:
                await session.delete(old_session)

            await session.commit()

            logger.info(
                "radius.cleanup.complete",
                deleted=count,
            )

            return {
                "status": "completed",
                "deleted": count,
                "cutoff_date": cutoff_date.isoformat(),
            }

    except Exception as e:
        logger.error("radius.cleanup.error", error=str(e))
        raise

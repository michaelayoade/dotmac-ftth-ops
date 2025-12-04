#!/usr/bin/env python3
"""
Data Migration Script: PostgreSQL RadAcct → TimescaleDB

Migrates completed RADIUS sessions from PostgreSQL radacct table to
TimescaleDB radacct_timeseries hypertable for time-series analytics.

Usage:
    python scripts/migrate_radacct_to_timescaledb.py [--batch-size 1000] [--dry-run]

Options:
    --batch-size    Number of records to process per batch (default: 1000)
    --dry-run       Print migration plan without executing
    --start-date    Only migrate sessions after this date (YYYY-MM-DD)
    --end-date      Only migrate sessions before this date (YYYY-MM-DD)
    --tenant-id     Only migrate sessions for specific tenant
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import click
import structlog
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.radius.models import RadAcct
from dotmac.platform.settings import settings
from dotmac.platform.timeseries import init_timescaledb, TimeSeriesSessionLocal
from dotmac.platform.timeseries.models import RadAcctTimeSeries

logger = structlog.get_logger(__name__)


async def migrate_batch(
    pg_session: AsyncSession,
    ts_session: AsyncSession,
    batch_size: int,
    offset: int,
    filters: Optional[list] = None
) -> int:
    """Migrate a batch of completed RADIUS sessions."""

    # Build query for completed sessions (acctstoptime is not null)
    stmt = select(RadAcct).where(RadAcct.acctstoptime.isnot(None))

    # Apply additional filters
    if filters:
        stmt = stmt.where(and_(*filters))

    # Add pagination
    stmt = stmt.offset(offset).limit(batch_size)

    # Fetch batch
    result = await pg_session.execute(stmt)
    sessions = result.scalars().all()

    if not sessions:
        return 0

    # Transform and insert into TimescaleDB
    migrated = 0
    for session in sessions:
        # Calculate total bytes
        input_octets = session.acctinputoctets or 0
        output_octets = session.acctoutputoctets or 0
        total_bytes = input_octets + output_octets

        # Create TimescaleDB record
        ts_record = RadAcctTimeSeries(
            time=session.acctstoptime,  # Primary time dimension
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
        migrated += 1

    # Commit batch
    await ts_session.commit()

    logger.info(
        "migration.batch.complete",
        migrated=migrated,
        offset=offset,
    )

    return migrated


async def count_sessions(
    pg_session: AsyncSession,
    filters: Optional[list] = None
) -> int:
    """Count total completed sessions to migrate."""
    stmt = select(func.count()).select_from(RadAcct).where(RadAcct.acctstoptime.isnot(None))

    if filters:
        stmt = stmt.where(and_(*filters))

    result = await pg_session.execute(stmt)
    return result.scalar() or 0


@click.command()
@click.option("--batch-size", default=1000, type=int, help="Records per batch")
@click.option("--dry-run", is_flag=True, help="Print plan without executing")
@click.option("--start-date", type=str, help="Start date (YYYY-MM-DD)")
@click.option("--end-date", type=str, help="End date (YYYY-MM-DD)")
@click.option("--tenant-id", type=str, help="Specific tenant ID")
def main(
    batch_size: int,
    dry_run: bool,
    start_date: Optional[str],
    end_date: Optional[str],
    tenant_id: Optional[str]
):
    """Migrate RADIUS sessions from PostgreSQL to TimescaleDB."""

    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ]
    )

    logger.info(
        "migration.start",
        batch_size=batch_size,
        dry_run=dry_run,
        start_date=start_date,
        end_date=end_date,
        tenant_id=tenant_id,
    )

    # Validate TimescaleDB is configured
    if not settings.timescaledb.is_configured:
        logger.error("migration.failed", reason="TimescaleDB not configured")
        click.echo("❌ Error: TimescaleDB is not configured. Check TIMESCALEDB_ENABLED in .env")
        sys.exit(1)

    # Initialize TimescaleDB
    try:
        init_timescaledb()
        logger.info("timescaledb.init.success")
    except Exception as e:
        logger.error("timescaledb.init.failed", error=str(e))
        click.echo(f"❌ Error initializing TimescaleDB: {e}")
        sys.exit(1)

    # Run migration
    asyncio.run(run_migration(batch_size, dry_run, start_date, end_date, tenant_id))


async def run_migration(
    batch_size: int,
    dry_run: bool,
    start_date: Optional[str],
    end_date: Optional[str],
    tenant_id: Optional[str]
):
    """Run the migration process."""

    # Build filters
    filters = []
    if start_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        filters.append(RadAcct.acctstoptime >= start_dt)
    if end_date:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        filters.append(RadAcct.acctstoptime < end_dt)
    if tenant_id:
        filters.append(RadAcct.tenant_id == tenant_id)

    # Count total sessions
    async with AsyncSessionLocal() as pg_session:
        total_sessions = await count_sessions(pg_session, filters if filters else None)

    logger.info("migration.count", total_sessions=total_sessions)
    click.echo(f"\n📊 Total completed sessions to migrate: {total_sessions:,}")

    if dry_run:
        click.echo("\n✅ Dry run complete. No data was migrated.")
        return

    if total_sessions == 0:
        click.echo("\n✅ No sessions to migrate.")
        return

    # Confirm migration
    if not click.confirm(f"\nMigrate {total_sessions:,} sessions to TimescaleDB?"):
        click.echo("Migration cancelled.")
        return

    # Start migration
    start_time = datetime.now()
    total_migrated = 0
    offset = 0

    click.echo("\n🚀 Starting migration...\n")

    with click.progressbar(length=total_sessions, label="Migrating sessions") as bar:
        while offset < total_sessions:
            async with AsyncSessionLocal() as pg_session:
                async with TimeSeriesSessionLocal() as ts_session:
                    migrated = await migrate_batch(
                        pg_session,
                        ts_session,
                        batch_size,
                        offset,
                        filters if filters else None
                    )

                    if migrated == 0:
                        break

                    total_migrated += migrated
                    offset += batch_size
                    bar.update(migrated)

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()
    rate = total_migrated / duration if duration > 0 else 0

    logger.info(
        "migration.complete",
        total_migrated=total_migrated,
        duration_seconds=duration,
        rate_per_second=rate,
    )

    click.echo(f"\n✅ Migration complete!")
    click.echo(f"   Migrated: {total_migrated:,} sessions")
    click.echo(f"   Duration: {duration:.2f} seconds")
    click.echo(f"   Rate: {rate:.2f} sessions/second")


if __name__ == "__main__":
    main()

"""
RADIUS subscriber and session GraphQL queries.

Provides optimized queries for ISP subscriber management with batched session loading.
"""

from typing import Optional

import strawberry
import structlog
from sqlalchemy import func, select

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.radius import Session, Subscriber, SubscriberMetrics

logger = structlog.get_logger(__name__)


@strawberry.type
class RadiusQueries:
    """RADIUS subscriber and session queries."""

    @strawberry.field(description="Get RADIUS subscribers with optional filtering")  # type: ignore[misc]
    async def subscribers(
        self,
        info: strawberry.Info[Context],
        limit: int = 50,
        enabled: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> list[Subscriber]:
        """
        Get RADIUS subscribers with optional filtering.

        Args:
            limit: Maximum number of subscribers to return
            enabled: Filter by enabled status
            search: Search by username

        Returns:
            List of subscribers with their sessions
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        # Import here to avoid circular imports
        from dotmac.platform.radius.models import RadCheck

        # Build query
        stmt = select(RadCheck).where(RadCheck.attribute == "Cleartext-Password")

        # Apply tenant filter if not platform admin
        if info.context.current_user.tenant_id:
            # Assuming username format: tenant_id:username or just username
            # Adjust based on your actual schema
            pass

        # Apply search filter
        if search:
            stmt = stmt.where(RadCheck.username.ilike(f"%{search}%"))

        # Apply enabled filter (would need additional table/field)
        # This is placeholder - adjust based on your schema
        stmt = stmt.limit(limit)

        result = await info.context.db.execute(stmt)
        rad_checks = result.scalars().all()

        # Convert to GraphQL Subscriber type
        subscribers = []
        for rad_check in rad_checks:
            # Create subscriber
            subscriber = Subscriber(
                id=rad_check.id,
                subscriber_id=str(rad_check.id),
                username=rad_check.username,
                enabled=True,  # Placeholder
                framed_ip_address=None,
                bandwidth_profile_id=None,
                created_at=rad_check.created_at if hasattr(rad_check, "created_at") else None,
                updated_at=rad_check.updated_at if hasattr(rad_check, "updated_at") else None,
            )
            subscribers.append(subscriber)

        # Batch load sessions for all subscribers
        if subscribers:
            usernames = [s.username for s in subscribers]
            sessions_by_username = await info.context.loaders.get_session_loader().load_many(
                usernames
            )

            # Attach sessions to subscribers
            for subscriber, sessions in zip(subscribers, sessions_by_username):
                subscriber.sessions = [
                    Session(
                        radacctid=s.radacctid,
                        username=s.username,
                        nasipaddress=s.nasipaddress,
                        acctsessionid=s.acctsessionid,
                        acctsessiontime=s.acctsessiontime,
                        acctinputoctets=s.acctinputoctets,
                        acctoutputoctets=s.acctoutputoctets,
                        acctstarttime=s.acctstarttime,
                        acctstoptime=s.acctstoptime,
                    )
                    for s in sessions
                ]

        logger.info(
            "Fetched subscribers",
            count=len(subscribers),
            limit=limit,
            tenant_id=info.context.current_user.tenant_id,
        )

        return subscribers

    @strawberry.field(description="Get active RADIUS sessions")  # type: ignore[misc]
    async def sessions(
        self,
        info: strawberry.Info[Context],
        limit: int = 100,
        username: Optional[str] = None,
    ) -> list[Session]:
        """
        Get active RADIUS sessions.

        Args:
            limit: Maximum number of sessions to return
            username: Filter by username

        Returns:
            List of active sessions
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        # Import here to avoid circular imports
        from dotmac.platform.radius.models import RadAcct

        # Build query for active sessions
        stmt = (
            select(RadAcct)
            .where(RadAcct.acctstoptime.is_(None))
            .order_by(RadAcct.acctstarttime.desc())
        )

        # Apply username filter
        if username:
            stmt = stmt.where(RadAcct.username == username)

        stmt = stmt.limit(limit)

        result = await info.context.db.execute(stmt)
        rad_sessions = result.scalars().all()

        # Convert to GraphQL Session type
        sessions = [
            Session(
                radacctid=s.radacctid,
                username=s.username,
                nasipaddress=s.nasipaddress,
                acctsessionid=s.acctsessionid,
                acctsessiontime=s.acctsessiontime,
                acctinputoctets=s.acctinputoctets,
                acctoutputoctets=s.acctoutputoctets,
                acctstarttime=s.acctstarttime,
                acctstoptime=s.acctstoptime,
            )
            for s in rad_sessions
        ]

        logger.info(
            "Fetched active sessions",
            count=len(sessions),
            username=username,
            tenant_id=info.context.current_user.tenant_id,
        )

        return sessions

    @strawberry.field(description="Get subscriber metrics summary")  # type: ignore[misc]
    async def subscriber_metrics(
        self,
        info: strawberry.Info[Context],
    ) -> SubscriberMetrics:
        """
        Get aggregated subscriber metrics.

        Returns:
            Subscriber metrics with counts and usage stats
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        # Import here to avoid circular imports
        from dotmac.platform.radius.models import RadAcct, RadCheck

        # Count total subscribers
        stmt_total = select(func.count(RadCheck.id)).where(
            RadCheck.attribute == "Cleartext-Password"
        )
        result_total = await info.context.db.execute(stmt_total)
        total_count = result_total.scalar() or 0

        # Count active sessions
        stmt_sessions = select(func.count(RadAcct.radacctid)).where(RadAcct.acctstoptime.is_(None))
        result_sessions = await info.context.db.execute(stmt_sessions)
        active_sessions = result_sessions.scalar() or 0

        # Calculate total data usage (in MB)
        stmt_usage = select(
            func.sum(RadAcct.acctinputoctets + RadAcct.acctoutputoctets)
        ).where(RadAcct.acctstoptime.is_(None))
        result_usage = await info.context.db.execute(stmt_usage)
        total_bytes = result_usage.scalar() or 0
        total_usage_mb = float(total_bytes) / (1024 * 1024) if total_bytes else 0.0

        return SubscriberMetrics(
            total_count=int(total_count),
            enabled_count=int(total_count),  # Placeholder
            disabled_count=0,  # Placeholder
            active_sessions_count=int(active_sessions),
            total_data_usage_mb=round(total_usage_mb, 2),
        )

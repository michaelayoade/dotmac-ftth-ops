"""
RADIUS subscriber and session GraphQL queries.

Provides optimized queries for ISP subscriber management with batched session loading.
"""

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
        enabled: bool | None = None,
        search: str | None = None,
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
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        # Import here to avoid circular imports
        from dotmac.platform.radius.models import RadCheck

        # Build query
        stmt = select(RadCheck).where(
            RadCheck.attribute == "Cleartext-Password",
            RadCheck.tenant_id == tenant_id,
        )

        # Apply search filter
        if search:
            stmt = stmt.where(RadCheck.username.ilike(f"%{search}%"))

        # Apply enabled filter (would need additional table/field)
        # This is placeholder - adjust based on your schema
        stmt = stmt.limit(limit)

        result = await context.db.execute(stmt)
        rad_checks = result.scalars().all()

        # Convert to GraphQL Subscriber type
        subscribers: list[Subscriber] = []
        for rad_check in rad_checks:
            # Create subscriber
            created_at = getattr(rad_check, "created_at", None)
            updated_at = getattr(rad_check, "updated_at", None)
            subscriber = Subscriber(
                id=int(rad_check.id),
                subscriber_id=str(rad_check.id),
                username=str(rad_check.username),
                enabled=True,  # Placeholder
                framed_ip_address=None,
                bandwidth_profile_id=None,
                created_at=created_at,
                updated_at=updated_at,
            )
            subscribers.append(subscriber)

        # Batch load sessions for all subscribers
        if subscribers:
            usernames = [s.username for s in subscribers]
            sessions_by_username = await context.loaders.get_session_loader().load_many(
                usernames,
                tenant_id=tenant_id,
            )

            # Attach sessions to subscribers
            for subscriber, sessions in zip(subscribers, sessions_by_username, strict=False):
                subscriber.sessions = [
                    Session(
                        radacctid=int(s.radacctid),
                        username=str(s.username),
                        nasipaddress=str(s.nasipaddress),
                        acctsessionid=str(s.acctsessionid),
                        acctsessiontime=getattr(s, "acctsessiontime", None),
                        acctinputoctets=getattr(s, "acctinputoctets", None),
                        acctoutputoctets=getattr(s, "acctoutputoctets", None),
                        acctstarttime=getattr(s, "acctstarttime", None),
                        acctstoptime=getattr(s, "acctstoptime", None),
                    )
                    for s in sessions
                ]

        logger.info(
            "Fetched subscribers",
            count=len(subscribers),
            limit=limit,
            tenant_id=tenant_id,
        )

        return subscribers

    @strawberry.field(description="Get active RADIUS sessions")  # type: ignore[misc]
    async def sessions(
        self,
        info: strawberry.Info[Context],
        limit: int = 100,
        username: str | None = None,
    ) -> list[Session]:
        """
        Get active RADIUS sessions.

        Args:
            limit: Maximum number of sessions to return
            username: Filter by username

        Returns:
            List of active sessions
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        # Import here to avoid circular imports
        from dotmac.platform.radius.models import RadAcct

        # Build query for active sessions
        stmt = (
            select(RadAcct)
            .where(
                RadAcct.acctstoptime.is_(None),
                RadAcct.tenant_id == tenant_id,
            )
            .order_by(RadAcct.acctstarttime.desc())
        )

        # Apply username filter
        if username:
            stmt = stmt.where(RadAcct.username == username)

        stmt = stmt.limit(limit)

        result = await context.db.execute(stmt)
        rad_sessions = result.scalars().all()

        # Convert to GraphQL Session type
        sessions = [
            Session(
                radacctid=int(s.radacctid),
                username=str(s.username),
                nasipaddress=str(s.nasipaddress),
                acctsessionid=str(s.acctsessionid),
                acctsessiontime=getattr(s, "acctsessiontime", None),
                acctinputoctets=getattr(s, "acctinputoctets", None),
                acctoutputoctets=getattr(s, "acctoutputoctets", None),
                acctstarttime=getattr(s, "acctstarttime", None),
                acctstoptime=getattr(s, "acctstoptime", None),
            )
            for s in rad_sessions
        ]

        logger.info(
            "Fetched active sessions",
            count=len(sessions),
            username=username,
            tenant_id=tenant_id,
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
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        # Import here to avoid circular imports
        from dotmac.platform.radius.models import RadAcct, RadCheck

        # Count total subscribers
        stmt_total = select(func.count(RadCheck.id)).where(
            RadCheck.attribute == "Cleartext-Password",
            RadCheck.tenant_id == tenant_id,
        )
        result_total = await context.db.execute(stmt_total)
        total_count = result_total.scalar() or 0

        # Count active sessions
        stmt_sessions = select(func.count(RadAcct.radacctid)).where(
            RadAcct.acctstoptime.is_(None),
            RadAcct.tenant_id == tenant_id,
        )
        result_sessions = await context.db.execute(stmt_sessions)
        active_sessions = result_sessions.scalar() or 0

        # Calculate total data usage (in MB)
        stmt_usage = select(func.sum(RadAcct.acctinputoctets + RadAcct.acctoutputoctets)).where(
            RadAcct.acctstoptime.is_(None),
            RadAcct.tenant_id == tenant_id,
        )
        result_usage = await context.db.execute(stmt_usage)
        total_bytes = result_usage.scalar() or 0
        total_usage_mb = float(total_bytes) / (1024 * 1024) if total_bytes else 0.0

        return SubscriberMetrics(
            total_count=int(total_count),
            enabled_count=int(total_count),  # Placeholder
            disabled_count=0,  # Placeholder
            active_sessions_count=int(active_sessions),
            total_data_usage_mb=round(total_usage_mb, 2),
        )

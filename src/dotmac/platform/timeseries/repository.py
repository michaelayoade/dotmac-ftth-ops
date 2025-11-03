"""TimescaleDB Repository for RADIUS Sessions."""

from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.timeseries.models import RadAcctTimeSeries


class RadiusTimeSeriesRepository:
    """Repository for RADIUS time-series data."""

    @staticmethod
    async def insert_session(
        session: AsyncSession, tenant_id: str, subscriber_id: str, username: str, session_data: dict
    ) -> None:
        """Insert completed RADIUS session into TimescaleDB."""
        record = RadAcctTimeSeries(
            time=session_data["session_stop_time"],  # Use stop time as primary timestamp
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            username=username,
            session_id=session_data["session_id"],
            nas_ip_address=session_data["nas_ip_address"],
            total_bytes=session_data.get("total_bytes", 0),
            input_octets=session_data.get("input_octets", 0),
            output_octets=session_data.get("output_octets", 0),
            session_duration=session_data.get("session_duration", 0),
            framed_ip_address=session_data.get("framed_ip_address"),
            framed_ipv6_address=session_data.get("framed_ipv6_address"),
            terminate_cause=session_data.get("terminate_cause"),
            session_start_time=session_data["session_start_time"],
            session_stop_time=session_data["session_stop_time"],
        )
        session.add(record)
        await session.commit()

    @staticmethod
    async def get_subscriber_usage(
        session: AsyncSession,
        tenant_id: str,
        subscriber_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict:
        """Get subscriber usage for date range."""
        stmt = select(
            func.coalesce(func.sum(RadAcctTimeSeries.total_bytes), 0).label("total_bandwidth"),
            func.coalesce(func.sum(RadAcctTimeSeries.session_duration), 0).label("total_duration"),
            func.count().label("session_count"),
            func.coalesce(func.avg(RadAcctTimeSeries.session_duration), 0).label(
                "avg_session_duration"
            ),
            func.coalesce(func.max(RadAcctTimeSeries.total_bytes), 0).label("peak_bandwidth"),
        ).where(
            RadAcctTimeSeries.tenant_id == tenant_id,
            RadAcctTimeSeries.subscriber_id == subscriber_id,
            RadAcctTimeSeries.time >= start_date,
            RadAcctTimeSeries.time < end_date,
        )

        result = await session.execute(stmt)
        row = result.first()
        if row is None:
            return {
                "total_bandwidth": 0,
                "total_duration": 0,
                "session_count": 0,
                "avg_session_duration": 0.0,
                "peak_bandwidth": 0,
            }

        return {
            "total_bandwidth": int(row.total_bandwidth or 0),
            "total_duration": int(row.total_duration or 0),
            "session_count": int(row.session_count or 0),
            "avg_session_duration": float(row.avg_session_duration or 0),
            "peak_bandwidth": int(row.peak_bandwidth or 0),
        }

    @staticmethod
    async def get_tenant_usage(
        session: AsyncSession, tenant_id: str, start_date: datetime, end_date: datetime
    ) -> dict:
        """Get tenant-wide usage for date range."""
        stmt = select(
            func.coalesce(func.sum(RadAcctTimeSeries.total_bytes), 0).label("total_bandwidth"),
            func.coalesce(func.sum(RadAcctTimeSeries.session_duration), 0).label("total_duration"),
            func.count().label("session_count"),
            func.count(func.distinct(RadAcctTimeSeries.subscriber_id)).label("unique_subscribers"),
        ).where(
            RadAcctTimeSeries.tenant_id == tenant_id,
            RadAcctTimeSeries.time >= start_date,
            RadAcctTimeSeries.time < end_date,
        )

        result = await session.execute(stmt)
        row = result.first()
        if row is None:
            return {
                "total_bandwidth": 0,
                "total_duration": 0,
                "session_count": 0,
                "unique_subscribers": 0,
            }

        return {
            "total_bandwidth": int(row.total_bandwidth or 0),
            "total_duration": int(row.total_duration or 0),
            "session_count": int(row.session_count or 0),
            "unique_subscribers": int(row.unique_subscribers or 0),
        }

    @staticmethod
    async def get_hourly_bandwidth(
        session: AsyncSession,
        tenant_id: str,
        subscriber_id: str | None,
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict]:
        """Get hourly bandwidth data from continuous aggregate."""
        # Use the continuous aggregate view for better performance
        query = """
            SELECT
                hour,
                tenant_id,
                subscriber_id,
                session_count,
                total_bandwidth,
                total_duration
            FROM radacct_hourly_bandwidth
            WHERE tenant_id = :tenant_id
                AND hour >= :start_date
                AND hour < :end_date
        """

        params = {
            "tenant_id": tenant_id,
            "start_date": start_date,
            "end_date": end_date,
        }

        if subscriber_id:
            query += " AND subscriber_id = :subscriber_id"
            params["subscriber_id"] = subscriber_id

        query += " ORDER BY hour ASC"

        result = await session.execute(text(query), params)
        rows = result.fetchall()

        return [
            {
                "hour": row[0],
                "tenant_id": row[1],
                "subscriber_id": row[2],
                "session_count": row[3],
                "total_bandwidth": row[4],
                "total_duration": row[5],
            }
            for row in rows
        ]

    @staticmethod
    async def get_daily_bandwidth(
        session: AsyncSession,
        tenant_id: str,
        subscriber_id: str | None,
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict]:
        """Get daily bandwidth data from continuous aggregate."""
        # Use the continuous aggregate view for better performance
        query = """
            SELECT
                day,
                tenant_id,
                subscriber_id,
                session_count,
                total_bandwidth,
                total_duration
            FROM radacct_daily_bandwidth
            WHERE tenant_id = :tenant_id
                AND day >= :start_date
                AND day < :end_date
        """

        params = {
            "tenant_id": tenant_id,
            "start_date": start_date,
            "end_date": end_date,
        }

        if subscriber_id:
            query += " AND subscriber_id = :subscriber_id"
            params["subscriber_id"] = subscriber_id

        query += " ORDER BY day ASC"

        result = await session.execute(text(query), params)
        rows = result.fetchall()

        return [
            {
                "day": row[0],
                "tenant_id": row[1],
                "subscriber_id": row[2],
                "session_count": row[3],
                "total_bandwidth": row[4],
                "total_duration": row[5],
            }
            for row in rows
        ]

    @staticmethod
    async def get_top_subscribers(
        session: AsyncSession,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        limit: int = 10,
        metric: str = "bandwidth",
    ) -> list[dict]:
        """
        Get top N subscribers by bandwidth or session duration.

        Args:
            session: Database session
            tenant_id: Tenant ID
            start_date: Start date for analysis
            end_date: End date for analysis
            limit: Number of top subscribers to return (default 10)
            metric: Metric to sort by - "bandwidth" or "duration"

        Returns:
            List of subscriber usage dictionaries with subscriber_id, username,
            total bandwidth, total duration, and session count
        """
        # Build the query - group by subscriber and aggregate metrics
        stmt = (
            select(
                RadAcctTimeSeries.subscriber_id,
                RadAcctTimeSeries.username,
                func.sum(RadAcctTimeSeries.total_bytes).label("total_bandwidth"),
                func.sum(RadAcctTimeSeries.session_duration).label("total_duration"),
                func.count().label("session_count"),
            )
            .where(
                RadAcctTimeSeries.tenant_id == tenant_id,
                RadAcctTimeSeries.time >= start_date,
                RadAcctTimeSeries.time < end_date,
            )
            .group_by(RadAcctTimeSeries.subscriber_id, RadAcctTimeSeries.username)
        )

        # Order by the requested metric
        if metric == "duration":
            stmt = stmt.order_by(func.sum(RadAcctTimeSeries.session_duration).desc())
        else:  # Default to bandwidth
            stmt = stmt.order_by(func.sum(RadAcctTimeSeries.total_bytes).desc())

        # Limit results
        stmt = stmt.limit(limit)

        result = await session.execute(stmt)
        rows = result.all()

        return [
            {
                "subscriber_id": row.subscriber_id,
                "username": row.username,
                "total_bandwidth": int(row.total_bandwidth or 0),
                "total_duration": int(row.total_duration or 0),
                "session_count": int(row.session_count or 0),
            }
            for row in rows
        ]

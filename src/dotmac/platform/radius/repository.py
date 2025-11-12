"""
RADIUS Repository Layer

Data access layer for RADIUS entities.
Handles all database operations for RADIUS tables.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.radius.models import (
    NAS,
    RadAcct,
    RadCheck,
    RadiusBandwidthProfile,
    RadReply,
)
from dotmac.platform.subscribers.models import (
    PasswordHashingMethod,
    hash_radius_password,
)


class RADIUSRepository:
    """Repository for RADIUS operations"""

    def __init__(self, session: AsyncSession):
        self.session = session

    # =========================================================================
    # RadCheck Operations (Authentication)
    # =========================================================================

    async def create_radcheck(
        self,
        tenant_id: str,
        subscriber_id: str | None,
        username: str,
        password: str,
        hashing_method: PasswordHashingMethod = PasswordHashingMethod.BCRYPT,
    ) -> RadCheck:
        """
        Create RADIUS check entry (authentication).

        Args:
            tenant_id: Tenant identifier
            subscriber_id: Subscriber identifier (optional)
            username: RADIUS username
            password: Plain text password (will be hashed)
            hashing_method: Password hashing method (default: BCRYPT)

        Returns:
            Created RadCheck entry
        """
        # Hash the password with specified method
        hashed_password = hash_radius_password(password, hashing_method)

        radcheck = RadCheck(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            username=username,
            attribute="Cleartext-Password",  # FreeRADIUS attribute for password
            op=":=",
            value=hashed_password,  # Store hashed password with prefix
        )
        self.session.add(radcheck)
        await self.session.flush()
        return radcheck

    async def get_radcheck_by_username(self, tenant_id: str, username: str) -> RadCheck | None:
        """Get RADIUS check entry by username"""
        result = await self.session.execute(
            select(RadCheck).where(
                and_(RadCheck.tenant_id == tenant_id, RadCheck.username == username)
            )
        )
        return result.scalar_one_or_none()

    async def get_radcheck_by_subscriber(
        self, tenant_id: str, subscriber_id: str
    ) -> RadCheck | None:
        """Get RADIUS check entry by subscriber ID"""
        result = await self.session.execute(
            select(RadCheck).where(
                and_(
                    RadCheck.tenant_id == tenant_id,
                    RadCheck.subscriber_id == subscriber_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def update_radcheck_password(
        self,
        tenant_id: str,
        username: str,
        new_password: str,
        hashing_method: PasswordHashingMethod = PasswordHashingMethod.BCRYPT,
    ) -> RadCheck | None:
        """
        Update RADIUS password.

        Args:
            tenant_id: Tenant identifier
            username: RADIUS username
            new_password: New plain text password (will be hashed)
            hashing_method: Password hashing method (default: BCRYPT)

        Returns:
            Updated RadCheck entry or None if not found
        """
        radcheck = await self.get_radcheck_by_username(tenant_id, username)
        if radcheck:
            # Hash the new password
            hashed_password = hash_radius_password(new_password, hashing_method)
            radcheck.value = hashed_password  # type: ignore[assignment]
            radcheck.updated_at = datetime.utcnow()  # type: ignore[assignment]
            await self.session.flush()
        return radcheck

    async def delete_radcheck(self, tenant_id: str, username: str) -> bool:
        """Delete RADIUS check entry"""
        radcheck = await self.get_radcheck_by_username(tenant_id, username)
        if radcheck:
            await self.session.delete(radcheck)
            await self.session.flush()
            return True
        return False

    async def list_radchecks(
        self, tenant_id: str, skip: int = 0, limit: int = 100
    ) -> list[RadCheck]:
        """List all RADIUS check entries for tenant"""
        result = await self.session.execute(
            select(RadCheck).where(RadCheck.tenant_id == tenant_id).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def get_password_hashing_stats(self, tenant_id: str) -> dict[str, int]:
        """
        Get statistics on password hashing methods used.

        Returns:
            Dictionary mapping hashing method to count of subscribers using it
        """
        result = await self.session.execute(select(RadCheck).where(RadCheck.tenant_id == tenant_id))
        radchecks = result.scalars().all()

        stats: dict[str, int] = {
            "cleartext": 0,
            "md5": 0,
            "sha256": 0,
            "bcrypt": 0,
            "unknown": 0,
        }

        for radcheck in radchecks:
            password_value = radcheck.value or ""
            if ":" in password_value:
                method = password_value.split(":", 1)[0]
                if method in stats:
                    stats[method] += 1
                else:
                    stats["unknown"] += 1
            else:
                # No prefix = legacy cleartext
                stats["cleartext"] += 1

        return stats

    # =========================================================================
    # RadReply Operations (Authorization)
    # =========================================================================

    async def create_radreply(
        self,
        tenant_id: str,
        subscriber_id: str | None,
        username: str,
        attribute: str,
        value: str,
        op: str = "=",
    ) -> RadReply:
        """Create RADIUS reply entry (authorization attribute)"""
        radreply = RadReply(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            username=username,
            attribute=attribute,
            op=op,
            value=value,
        )
        self.session.add(radreply)
        await self.session.flush()
        return radreply

    async def get_radreplies_by_username(self, tenant_id: str, username: str) -> list[RadReply]:
        """Get all RADIUS reply entries for username"""
        result = await self.session.execute(
            select(RadReply).where(
                and_(RadReply.tenant_id == tenant_id, RadReply.username == username)
            )
        )
        return list(result.scalars().all())

    async def delete_radreply(self, tenant_id: str, username: str, attribute: str) -> int:
        """Delete ALL RADIUS reply attributes matching the criteria.

        Returns:
            Number of rows deleted
        """
        result = await self.session.execute(
            select(RadReply).where(
                and_(
                    RadReply.tenant_id == tenant_id,
                    RadReply.username == username,
                    RadReply.attribute == attribute,
                )
            )
        )
        radreplies = result.scalars().all()
        count = len(radreplies)
        for radreply in radreplies:
            await self.session.delete(radreply)
        if count > 0:
            await self.session.flush()
        return count

    async def delete_radreply_by_value_pattern(
        self, tenant_id: str, username: str, attribute: str, value_pattern: str
    ) -> int:
        """Delete RADIUS reply attributes matching attribute and value pattern.

        Args:
            tenant_id: Tenant ID
            username: RADIUS username
            attribute: Attribute name
            value_pattern: SQL LIKE pattern for value matching

        Returns:
            Number of rows deleted
        """
        result = await self.session.execute(
            select(RadReply).where(
                and_(
                    RadReply.tenant_id == tenant_id,
                    RadReply.username == username,
                    RadReply.attribute == attribute,
                    RadReply.value.like(value_pattern),
                )
            )
        )
        radreplies = result.scalars().all()
        count = len(radreplies)
        for radreply in radreplies:
            await self.session.delete(radreply)
        if count > 0:
            await self.session.flush()
        return count

    async def delete_all_radreplies(self, tenant_id: str, username: str) -> int:
        """Delete all RADIUS reply entries for username"""
        result = await self.session.execute(
            select(RadReply).where(
                and_(RadReply.tenant_id == tenant_id, RadReply.username == username)
            )
        )
        radreplies = result.scalars().all()
        count = len(radreplies)
        for radreply in radreplies:
            await self.session.delete(radreply)
        await self.session.flush()
        return count

    # =========================================================================
    # RadAcct Operations (Accounting/Sessions)
    # =========================================================================

    async def get_active_sessions(
        self, tenant_id: str, username: str | None = None
    ) -> list[RadAcct]:
        """Get active RADIUS sessions"""
        query = select(RadAcct).where(
            and_(RadAcct.tenant_id == tenant_id, RadAcct.acctstoptime.is_(None))
        )
        if username:
            query = query.where(RadAcct.username == username)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_session_by_id(self, radacctid: int) -> RadAcct | None:
        """Get RADIUS session by ID"""
        result = await self.session.execute(select(RadAcct).where(RadAcct.radacctid == radacctid))
        return result.scalar_one_or_none()

    async def get_sessions_by_subscriber(
        self,
        tenant_id: str,
        subscriber_id: str,
        active_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> list[RadAcct]:
        """Get RADIUS sessions for subscriber"""
        query = select(RadAcct).where(
            and_(RadAcct.tenant_id == tenant_id, RadAcct.subscriber_id == subscriber_id)
        )
        if active_only:
            query = query.where(RadAcct.acctstoptime.is_(None))
        query = query.order_by(RadAcct.acctstarttime.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_usage_stats(
        self,
        tenant_id: str,
        subscriber_id: str | None = None,
        username: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, Any]:
        """Get usage statistics"""
        query = select(
            func.count(RadAcct.radacctid).label("total_sessions"),
            func.sum(RadAcct.acctsessiontime).label("total_session_time"),
            func.sum(RadAcct.acctinputoctets).label("total_input_octets"),
            func.sum(RadAcct.acctoutputoctets).label("total_output_octets"),
            func.count(RadAcct.radacctid)
            .filter(RadAcct.acctstoptime.is_(None))
            .label("active_sessions"),
        ).where(RadAcct.tenant_id == tenant_id)

        if subscriber_id:
            query = query.where(RadAcct.subscriber_id == subscriber_id)
        if username:
            query = query.where(RadAcct.username == username)
        if start_date:
            query = query.where(RadAcct.acctstarttime >= start_date)
        if end_date:
            query = query.where(RadAcct.acctstarttime <= end_date)

        result = await self.session.execute(query)
        row = result.first()

        if row is None:
            return {
                "total_sessions": 0,
                "total_session_time": 0,
                "total_input_octets": 0,
                "total_output_octets": 0,
                "total_bytes": 0,
                "active_sessions": 0,
            }

        total_sessions = int(row.total_sessions or 0)
        total_session_time = int(row.total_session_time or 0)
        total_input_octets = int(row.total_input_octets or 0)
        total_output_octets = int(row.total_output_octets or 0)
        active_sessions = int(row.active_sessions or 0)

        return {
            "total_sessions": total_sessions,
            "total_session_time": total_session_time,
            "total_input_octets": total_input_octets,
            "total_output_octets": total_output_octets,
            "total_bytes": total_input_octets + total_output_octets,
            "active_sessions": active_sessions,
        }

    # =========================================================================
    # NAS Operations
    # =========================================================================

    async def create_nas(
        self,
        tenant_id: str,
        nasname: str,
        shortname: str,
        type: str,
        secret: str,
        ports: int | None = None,
        community: str | None = None,
        description: str | None = None,
    ) -> NAS:
        """Create NAS device"""
        nas = NAS(
            tenant_id=tenant_id,
            nasname=nasname,
            shortname=shortname,
            type=type,
            secret=secret,
            ports=ports,
            community=community,
            description=description,
        )
        self.session.add(nas)
        await self.session.flush()
        return nas

    async def get_nas_by_id(self, tenant_id: str, nas_id: int) -> NAS | None:
        """Get NAS by ID"""
        result = await self.session.execute(
            select(NAS).where(and_(NAS.tenant_id == tenant_id, NAS.id == nas_id))
        )
        return result.scalar_one_or_none()

    async def get_nas_by_name(self, tenant_id: str, nasname: str) -> NAS | None:
        """Get NAS by name (IP address)"""
        result = await self.session.execute(
            select(NAS).where(and_(NAS.tenant_id == tenant_id, NAS.nasname == nasname))
        )
        return result.scalar_one_or_none()

    async def list_nas_devices(self, tenant_id: str, skip: int = 0, limit: int = 100) -> list[NAS]:
        """List all NAS devices for tenant"""
        result = await self.session.execute(
            select(NAS).where(NAS.tenant_id == tenant_id).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def update_nas(self, nas: NAS, **updates: Any) -> NAS:
        """Update NAS device"""
        for key, value in updates.items():
            if value is not None and hasattr(nas, key):
                setattr(nas, key, value)
        nas.updated_at = datetime.utcnow()  # type: ignore[assignment]
        await self.session.flush()
        return nas

    async def delete_nas(self, tenant_id: str, nas_id: int) -> bool:
        """Delete NAS device"""
        nas = await self.get_nas_by_id(tenant_id, nas_id)
        if nas:
            await self.session.delete(nas)
            await self.session.flush()
            return True
        return False

    # =========================================================================
    # Bandwidth Profile Operations
    # =========================================================================

    async def create_bandwidth_profile(
        self,
        tenant_id: str,
        profile_id: str,
        name: str,
        download_rate_kbps: int,
        upload_rate_kbps: int,
        description: str | None = None,
        download_burst_kbps: int | None = None,
        upload_burst_kbps: int | None = None,
    ) -> RadiusBandwidthProfile:
        """Create bandwidth profile"""
        profile = RadiusBandwidthProfile(
            id=profile_id,
            tenant_id=tenant_id,
            name=name,
            description=description,
            download_rate_kbps=download_rate_kbps,
            upload_rate_kbps=upload_rate_kbps,
            download_burst_kbps=download_burst_kbps,
            upload_burst_kbps=upload_burst_kbps,
        )
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def get_bandwidth_profile(
        self, tenant_id: str, profile_id: str
    ) -> RadiusBandwidthProfile | None:
        """Get bandwidth profile by ID"""
        result = await self.session.execute(
            select(RadiusBandwidthProfile).where(
                and_(
                    RadiusBandwidthProfile.tenant_id == tenant_id,
                    RadiusBandwidthProfile.id == profile_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_bandwidth_profiles(
        self, tenant_id: str, skip: int = 0, limit: int = 100
    ) -> list[RadiusBandwidthProfile]:
        """List bandwidth profiles"""
        result = await self.session.execute(
            select(RadiusBandwidthProfile)
            .where(RadiusBandwidthProfile.tenant_id == tenant_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def update_bandwidth_profile(
        self, profile: RadiusBandwidthProfile, **updates: Any
    ) -> RadiusBandwidthProfile:
        """Update bandwidth profile"""
        for key, value in updates.items():
            if value is not None and hasattr(profile, key):
                setattr(profile, key, value)
        profile.updated_at = datetime.utcnow()  # type: ignore[assignment]
        await self.session.flush()
        return profile

    async def delete_bandwidth_profile(self, tenant_id: str, profile_id: str) -> bool:
        """Delete bandwidth profile"""
        profile = await self.get_bandwidth_profile(tenant_id, profile_id)
        if profile:
            await self.session.delete(profile)
            await self.session.flush()
            return True
        return False

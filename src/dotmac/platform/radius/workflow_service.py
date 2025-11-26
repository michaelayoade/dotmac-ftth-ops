"""
RADIUS Workflow Service

Provides workflow-compatible methods for RADIUS operations (ISP).
"""

import logging
import secrets
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class RADIUSService:
    """
    RADIUS service for workflow integration.

    Provides subscriber account creation and management for ISP workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_subscriber(
        self,
        customer_id: int | str,
        username: str,
        bandwidth_profile: str,
        tenant_id: str | None = None,
        subscriber_id: str | None = None,
        static_ip: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a RADIUS subscriber account for ISP customer.

        This method creates the necessary RADIUS database entries to enable
        PPPoE/802.1X authentication and bandwidth management for an ISP customer.

        Args:
            customer_id: Customer ID
            username: Username for authentication (typically email or account number)
            bandwidth_profile: Bandwidth profile name (e.g., "100mbps", "fiber_1gig")
            tenant_id: Tenant ID (required for multi-tenant deployments)
            subscriber_id: Subscriber ID from subscribers table (optional)
            static_ip: Static IP address to assign (optional)

        Returns:
            Dict with RADIUS account details:
            {
                "username": str,
                "password": str,
                "bandwidth_profile": str,
                "download_rate_kbps": int,
                "upload_rate_kbps": int,
                "static_ip": str | None,
                "radcheck_id": int,
                "radreply_ids": list[int],
                "status": "active"
            }

        Raises:
            ValueError: If bandwidth profile not found or username already exists
        """
        from sqlalchemy import select

        from .models import RadCheck, RadiusBandwidthProfile, RadReply

        logger.info(
            f"Creating RADIUS subscriber for customer {customer_id}, "
            f"username {username}, profile {bandwidth_profile}"
        )

        # Convert customer_id to string for consistency
        customer_id_str = str(customer_id)

        # Get tenant_id from context if not provided
        if not tenant_id:
            # Try to get from customer record
            from ..customer_management.models import Customer

            customer_stmt = select(Customer).where(Customer.id == customer_id_str)
            result = await self.db.execute(customer_stmt)
            customer = result.scalar_one_or_none()
            if customer:
                tenant_id = customer.tenant_id
            else:
                raise ValueError(f"Customer {customer_id} not found and tenant_id not provided")

        # Check if username already exists
        username_stmt = select(RadCheck).where(
            RadCheck.username == username, RadCheck.tenant_id == tenant_id
        )
        result = await self.db.execute(username_stmt)
        existing = result.scalar_one_or_none()

        if existing:
            raise ValueError(f"RADIUS username '{username}' already exists for tenant {tenant_id}")

        # Fetch bandwidth profile
        profile_stmt = select(RadiusBandwidthProfile).where(
            RadiusBandwidthProfile.name == bandwidth_profile,
            RadiusBandwidthProfile.tenant_id == tenant_id,
        )
        result = await self.db.execute(profile_stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            # Try to fetch by ID instead of name
            stmt = select(RadiusBandwidthProfile).where(
                RadiusBandwidthProfile.id == bandwidth_profile,
                RadiusBandwidthProfile.tenant_id == tenant_id,
            )
            result = await self.db.execute(stmt)
            profile = result.scalar_one_or_none()

        if not profile:
            raise ValueError(
                f"Bandwidth profile '{bandwidth_profile}' not found for tenant {tenant_id}"
            )

        # Generate secure password (16 characters, URL-safe)
        password = secrets.token_urlsafe(16)

        # Create RadCheck entry (authentication)
        radcheck = RadCheck(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            username=username,
            attribute="Cleartext-Password",
            op=":=",
            value=password,
        )
        self.db.add(radcheck)
        await self.db.flush()  # Get the ID

        logger.info(f"Created RadCheck entry: id={radcheck.id}, username={username}")

        # Create RadReply entries (authorization attributes)
        radreply_ids = []

        # Add bandwidth limits (using Mikrotik-Rate-Limit format)
        # Format: "rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate]]"
        download_kbps = profile.download_rate_kbps
        upload_kbps = profile.upload_rate_kbps
        download_burst = profile.download_burst_kbps or download_kbps
        upload_burst = profile.upload_burst_kbps or upload_kbps

        # Mikrotik-Rate-Limit attribute (works with MikroTik routers)
        rate_limit = f"{upload_kbps}k/{download_kbps}k {upload_burst}k/{download_burst}k"

        radreply_rate = RadReply(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            username=username,
            attribute="Mikrotik-Rate-Limit",
            op="=",
            value=rate_limit,
        )
        self.db.add(radreply_rate)
        await self.db.flush()
        radreply_ids.append(radreply_rate.id)

        # Add static IP if provided
        if static_ip:
            radreply_ip = RadReply(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Framed-IP-Address",
                op="=",
                value=static_ip,
            )
            self.db.add(radreply_ip)
            await self.db.flush()
            radreply_ids.append(radreply_ip.id)

        # Add session timeout (24 hours default)
        radreply_timeout = RadReply(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            username=username,
            attribute="Session-Timeout",
            op="=",
            value="86400",  # 24 hours in seconds
        )
        self.db.add(radreply_timeout)
        await self.db.flush()
        radreply_ids.append(radreply_timeout.id)

        # Add idle timeout (15 minutes default)
        radreply_idle = RadReply(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            username=username,
            attribute="Idle-Timeout",
            op="=",
            value="900",  # 15 minutes in seconds
        )
        self.db.add(radreply_idle)
        await self.db.flush()
        radreply_ids.append(radreply_idle.id)

        # Commit all changes
        await self.db.commit()

        logger.info(
            f"RADIUS subscriber created successfully: username={username}, "
            f"radcheck_id={radcheck.id}, radreply_count={len(radreply_ids)}, "
            f"bandwidth={download_kbps}kbps down / {upload_kbps}kbps up"
        )

        return {
            "username": username,
            "password": password,
            "customer_id": customer_id_str,
            "subscriber_id": subscriber_id,
            "bandwidth_profile": profile.name,
            "download_rate_kbps": download_kbps,
            "upload_rate_kbps": upload_kbps,
            "download_burst_kbps": download_burst,
            "upload_burst_kbps": upload_burst,
            "static_ip": static_ip,
            "radcheck_id": radcheck.id,
            "radreply_ids": radreply_ids,
            "session_timeout": 86400,
            "idle_timeout": 900,
            "status": "active",
        }

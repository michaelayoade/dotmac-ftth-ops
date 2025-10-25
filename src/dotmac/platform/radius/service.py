"""
RADIUS Service Layer

Business logic for RADIUS operations.
Handles subscriber management, session tracking, and usage monitoring.
"""

import os
import secrets
import string
from typing import Any
from uuid import uuid4

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.radius.coa_client import CoAClient, CoAClientHTTP
from dotmac.platform.radius.repository import RADIUSRepository
from dotmac.platform.radius.schemas import (
    BandwidthProfileCreate,
    BandwidthProfileResponse,
    NASCreate,
    NASResponse,
    NASUpdate,
    RADIUSSessionResponse,
    RADIUSSubscriberCreate,
    RADIUSSubscriberResponse,
    RADIUSSubscriberUpdate,
    RADIUSUsageQuery,
    RADIUSUsageResponse,
)
from dotmac.platform.subscribers.models import PasswordHashingMethod

logger = structlog.get_logger(__name__)


class RADIUSService:
    """Service for RADIUS operations"""

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id
        self.repository = RADIUSRepository(session)

        # Initialize CoA client for session disconnection
        # Non-sensitive configuration from env vars
        self.radius_server = os.getenv("RADIUS_SERVER_HOST", "localhost")
        self.coa_port = int(os.getenv("RADIUS_COA_PORT", "3799"))
        self.use_http_coa = os.getenv("RADIUS_COA_USE_HTTP", "false").lower() == "true"
        self.http_coa_url = os.getenv("RADIUS_COA_HTTP_URL", None)

        # RADIUS secret from Vault (Pure Vault mode in production)
        from dotmac.platform.settings import settings

        self.radius_secret = settings.radius.shared_secret

        # Production validation
        if settings.is_production and not self.radius_secret:
            raise ValueError(
                "RADIUS_SECRET must be loaded from Vault in production. "
                "Ensure VAULT_ENABLED=true and secret is migrated to vault path: radius/secret"
            )

        if self.use_http_coa and self.http_coa_url:
            self.coa_client: CoAClient | CoAClientHTTP = CoAClientHTTP(api_url=self.http_coa_url)
        else:
            self.coa_client = CoAClient(
                radius_server=self.radius_server,
                coa_port=self.coa_port,
                radius_secret=self.radius_secret,
            )

    # =========================================================================
    # Subscriber Management
    # =========================================================================

    async def create_subscriber(self, data: RADIUSSubscriberCreate) -> RADIUSSubscriberResponse:
        """
        Create RADIUS subscriber credentials

        This creates:
        1. RadCheck entry with username/password
        2. RadReply entries for bandwidth, IP, timeouts, etc.
        """
        # Check if username already exists
        existing = await self.repository.get_radcheck_by_username(self.tenant_id, data.username)
        if existing:
            raise ValueError(f"Subscriber with username '{data.username}' already exists")

        # Create authentication entry (radcheck)
        radcheck = await self.repository.create_radcheck(
            tenant_id=self.tenant_id,
            subscriber_id=data.subscriber_id,
            username=data.username,
            password=data.password,
        )

        # Create authorization entries (radreply)
        # IPv4 address
        if data.framed_ipv4_address:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Framed-IP-Address",
                value=data.framed_ipv4_address,
            )

        # IPv6 address (RFC 6911)
        if data.framed_ipv6_address:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Framed-IPv6-Address",
                value=data.framed_ipv6_address,
            )

        # IPv6 prefix delegation (RFC 4818)
        if data.delegated_ipv6_prefix:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Delegated-IPv6-Prefix",
                value=data.delegated_ipv6_prefix,
            )

        if data.session_timeout:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Session-Timeout",
                value=str(data.session_timeout),
            )

        if data.idle_timeout:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Idle-Timeout",
                value=str(data.idle_timeout),
            )

        # Apply bandwidth profile if specified
        if data.bandwidth_profile_id:
            profile_response = await self.apply_bandwidth_profile(
                username=data.username,
                subscriber_id=data.subscriber_id,
                profile_id=data.bandwidth_profile_id,
            )
            if profile_response is None:
                raise ValueError(
                    f"Bandwidth profile '{data.bandwidth_profile_id}' not found"
                )

        await self.session.commit()

        return RADIUSSubscriberResponse(
            id=radcheck.id,
            tenant_id=radcheck.tenant_id,
            subscriber_id=radcheck.subscriber_id,
            username=radcheck.username,
            bandwidth_profile_id=data.bandwidth_profile_id,
            framed_ipv4_address=data.framed_ipv4_address,
            framed_ipv6_address=data.framed_ipv6_address,
            delegated_ipv6_prefix=data.delegated_ipv6_prefix,
            session_timeout=data.session_timeout,
            idle_timeout=data.idle_timeout,
            enabled=True,
            created_at=radcheck.created_at,
            updated_at=radcheck.updated_at,
        )

    async def get_subscriber(self, username: str) -> RADIUSSubscriberResponse | None:
        """Get RADIUS subscriber by username"""
        radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
        if not radcheck:
            return None

        # Get reply attributes
        radreplies = await self.repository.get_radreplies_by_username(self.tenant_id, username)

        # Extract common attributes
        framed_ipv4 = None
        framed_ipv6 = None
        delegated_ipv6_prefix = None
        session_timeout = None
        idle_timeout = None
        bandwidth_profile_id = None
        is_enabled = True  # Default to enabled

        for reply in radreplies:
            if reply.attribute == "Framed-IP-Address":
                framed_ipv4 = reply.value
            elif reply.attribute == "Framed-IPv6-Address":
                framed_ipv6 = reply.value
            elif reply.attribute == "Delegated-IPv6-Prefix":
                delegated_ipv6_prefix = reply.value
            elif reply.attribute == "Session-Timeout":
                session_timeout = int(reply.value)
            elif reply.attribute == "Idle-Timeout":
                idle_timeout = int(reply.value)
            elif reply.attribute == "Mikrotik-Rate-Limit":
                # Skip - this is a rate limit string, not a profile ID
                pass
            elif reply.attribute == "X-Bandwidth-Profile-ID":
                # Custom attribute to store bandwidth profile ID
                bandwidth_profile_id = reply.value
            elif reply.attribute == "Auth-Type" and reply.value == "Reject":
                # Subscriber is disabled if Auth-Type := Reject exists
                is_enabled = False

        return RADIUSSubscriberResponse(
            id=radcheck.id,
            tenant_id=radcheck.tenant_id,
            subscriber_id=radcheck.subscriber_id,
            username=radcheck.username,
            bandwidth_profile_id=bandwidth_profile_id,
            framed_ipv4_address=framed_ipv4,
            framed_ipv6_address=framed_ipv6,
            delegated_ipv6_prefix=delegated_ipv6_prefix,
            session_timeout=session_timeout,
            idle_timeout=idle_timeout,
            enabled=is_enabled,
            created_at=radcheck.created_at,
            updated_at=radcheck.updated_at,
        )

    async def update_subscriber(
        self, username: str, data: RADIUSSubscriberUpdate
    ) -> RADIUSSubscriberResponse | None:
        """Update RADIUS subscriber"""
        # Update password if provided
        if data.password:
            await self.repository.update_radcheck_password(self.tenant_id, username, data.password)

        # Update reply attributes
        # IPv4 address
        if data.framed_ipv4_address is not None:
            # Delete existing and create new
            await self.repository.delete_radreply(self.tenant_id, username, "Framed-IP-Address")
            if data.framed_ipv4_address:
                radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
                await self.repository.create_radreply(
                    tenant_id=self.tenant_id,
                    subscriber_id=radcheck.subscriber_id,
                    username=username,
                    attribute="Framed-IP-Address",
                    value=data.framed_ipv4_address,
                )

        # IPv6 address
        if data.framed_ipv6_address is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Framed-IPv6-Address")
            if data.framed_ipv6_address:
                radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
                await self.repository.create_radreply(
                    tenant_id=self.tenant_id,
                    subscriber_id=radcheck.subscriber_id,
                    username=username,
                    attribute="Framed-IPv6-Address",
                    value=data.framed_ipv6_address,
                )

        # IPv6 prefix delegation
        if data.delegated_ipv6_prefix is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Delegated-IPv6-Prefix")
            if data.delegated_ipv6_prefix:
                radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
                await self.repository.create_radreply(
                    tenant_id=self.tenant_id,
                    subscriber_id=radcheck.subscriber_id,
                    username=username,
                    attribute="Delegated-IPv6-Prefix",
                    value=data.delegated_ipv6_prefix,
                )

        if data.session_timeout is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Session-Timeout")
            if data.session_timeout:
                radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
                await self.repository.create_radreply(
                    tenant_id=self.tenant_id,
                    subscriber_id=radcheck.subscriber_id,
                    username=username,
                    attribute="Session-Timeout",
                    value=str(data.session_timeout),
                )

        if data.idle_timeout is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Idle-Timeout")
            if data.idle_timeout:
                radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
                await self.repository.create_radreply(
                    tenant_id=self.tenant_id,
                    subscriber_id=radcheck.subscriber_id,
                    username=username,
                    attribute="Idle-Timeout",
                    value=str(data.idle_timeout),
                )

        # Update bandwidth profile
        if data.bandwidth_profile_id:
            radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
            await self.apply_bandwidth_profile(
                username=username,
                subscriber_id=radcheck.subscriber_id,
                profile_id=data.bandwidth_profile_id,
            )

        # Handle enable/disable
        if data.enabled is not None:
            if data.enabled:
                await self.enable_subscriber(username)
            else:
                await self.disable_subscriber(username)

        await self.session.commit()

        return await self.get_subscriber(username)

    async def delete_subscriber(self, username: str) -> bool:
        """Delete RADIUS subscriber"""
        # Delete radcheck
        deleted_check = await self.repository.delete_radcheck(self.tenant_id, username)

        # Delete all radreplies
        await self.repository.delete_all_radreplies(self.tenant_id, username)

        await self.session.commit()

        return bool(deleted_check)

    async def enable_subscriber(self, username: str) -> RADIUSSubscriberResponse | None:
        """Enable RADIUS access for subscriber"""
        # Remove any deny attributes
        await self.repository.delete_radreply(self.tenant_id, username, "Auth-Type")
        await self.session.commit()

        # Return the updated subscriber
        return await self.get_subscriber(username)

    async def disable_subscriber(self, username: str) -> RADIUSSubscriberResponse | None:
        """Disable RADIUS access for subscriber"""
        radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
        if radcheck:
            # Add Auth-Type := Reject to deny access
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=radcheck.subscriber_id,
                username=username,
                attribute="Auth-Type",
                op=":=",
                value="Reject",
            )
            await self.session.commit()

            # Return the updated subscriber
            return await self.get_subscriber(username)
        return None

    async def list_subscribers(
        self, skip: int = 0, limit: int = 100
    ) -> list[RADIUSSubscriberResponse]:
        """List all RADIUS subscribers"""
        radchecks = await self.repository.list_radchecks(self.tenant_id, skip, limit)

        subscribers = []
        for radcheck in radchecks:
            subscriber = await self.get_subscriber(radcheck.username)
            if subscriber:
                subscribers.append(subscriber)

        return subscribers

    # =========================================================================
    # Bandwidth Profile Management
    # =========================================================================

    async def _get_subscriber_nas_vendor(self, username: str) -> str:
        """
        Get NAS vendor for a subscriber.

        Looks up the subscriber's primary NAS device and returns its vendor type.
        Falls back to default vendor from settings if not found.

        Args:
            username: RADIUS username

        Returns:
            NAS vendor string (mikrotik, cisco, huawei, juniper, generic)
        """
        from dotmac.platform.settings import settings

        # Try to get vendor from subscriber's active session
        sessions = await self.repository.get_active_sessions(self.tenant_id, username)
        if sessions:
            # Get NAS from first active session
            nas_ip = str(sessions[0].nasipaddress)
            nas = await self.repository.get_nas_by_name(self.tenant_id, nas_ip)
            if nas and hasattr(nas, 'vendor'):
                logger.debug(
                    "Resolved NAS vendor from active session",
                    username=username,
                    vendor=nas.vendor,
                    nas_ip=nas_ip,
                )
                return nas.vendor

        # Fallback to default vendor from settings
        default_vendor = settings.radius.default_vendor
        logger.debug(
            "Using default NAS vendor",
            username=username,
            vendor=default_vendor,
        )
        return default_vendor

    async def apply_bandwidth_profile(
        self,
        username: str,
        profile_id: str,
        subscriber_id: str | None = None,
        nas_vendor: str | None = None,
    ) -> RADIUSSubscriberResponse | None:
        """
        Apply bandwidth profile to subscriber with vendor-aware attribute generation.

        Args:
            username: RADIUS username
            profile_id: Bandwidth profile ID
            subscriber_id: Optional subscriber ID
            nas_vendor: Optional NAS vendor override (mikrotik, cisco, huawei, juniper)

        Returns:
            Updated subscriber response or None if not found
        """
        from dotmac.platform.radius.vendors import get_bandwidth_builder
        from dotmac.platform.settings import settings

        profile = await self.repository.get_bandwidth_profile(self.tenant_id, profile_id)
        if not profile:
            logger.warning(
                "radius_bandwidth_profile_not_found",
                tenant_id=self.tenant_id,
                username=username,
                profile_id=profile_id,
            )
            return None

        # Ensure subscriber exists and obtain subscriber_id when not provided
        radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
        if not radcheck:
            logger.warning(
                "radius_subscriber_not_found_for_bandwidth",
                tenant_id=self.tenant_id,
                username=username,
                profile_id=profile_id,
            )
            return None

        subscriber_id = subscriber_id or radcheck.subscriber_id

        # Determine NAS vendor (auto-detect if not provided)
        if not nas_vendor:
            nas_vendor = await self._get_subscriber_nas_vendor(username)

        # Get vendor-specific bandwidth builder
        if settings.radius.vendor_aware:
            builder = get_bandwidth_builder(vendor=nas_vendor, tenant_id=self.tenant_id)
            logger.info(
                "Using vendor-specific bandwidth builder",
                username=username,
                vendor=nas_vendor,
                profile_id=profile_id,
            )
        else:
            # Fallback to Mikrotik if vendor-aware mode disabled
            from dotmac.platform.radius.vendors import MikrotikBandwidthBuilder
            builder = MikrotikBandwidthBuilder()
            logger.info(
                "Using Mikrotik bandwidth builder (vendor-aware disabled)",
                username=username,
                profile_id=profile_id,
            )

        # Build vendor-specific attributes using profile NAME (not UUID)
        # Policy-based vendors (Cisco/Juniper) need human-readable policy names
        attributes = builder.build_radreply(
            download_rate_kbps=profile.download_rate_kbps,
            upload_rate_kbps=profile.upload_rate_kbps,
            download_burst_kbps=profile.download_burst_kbps,
            upload_burst_kbps=profile.upload_burst_kbps,
            profile_name=profile.name,  # Use profile name, NOT UUID
        )

        # SCOPED cleanup: Remove only bandwidth-related attributes we created
        # DO NOT blanket-delete Cisco-AVPair, Huawei-*, Juniper-* as they may
        # contain VRF, DNS, ACL, and other policy entries from other features

        # 1. Remove tracking attribute (marks all our bandwidth entries)
        await self.repository.delete_radreply(
            self.tenant_id, username, "X-Bandwidth-Profile-ID"
        )

        # 2. Remove vendor-specific bandwidth attributes
        # Mikrotik: Safe to remove all (bandwidth-only attribute)
        await self.repository.delete_radreply(self.tenant_id, username, "Mikrotik-Rate-Limit")

        # Huawei: Safe to remove rate-limit attributes (bandwidth-only)
        for attr in [
            "Huawei-Input-Rate-Limit",
            "Huawei-Output-Rate-Limit",
            "Huawei-Input-Peak-Rate",
            "Huawei-Output-Peak-Rate",
            "Huawei-Qos-Profile-Name",
        ]:
            await self.repository.delete_radreply(self.tenant_id, username, attr)

        # Juniper: Safe to remove rate-limit attributes (bandwidth-only)
        for attr in ["Juniper-Rate-Limit-In", "Juniper-Rate-Limit-Out"]:
            await self.repository.delete_radreply(self.tenant_id, username, attr)

        # Cisco-AVPair: CAREFUL - only remove bandwidth/QoS entries
        # Match patterns like "subscriber:sub-qos-policy-in=*" or "ip:rate-limit=*"
        for pattern in [
            "subscriber:sub-qos-policy-in=%",
            "subscriber:sub-qos-policy-out=%",
            "ip:rate-limit=%",
        ]:
            await self.repository.delete_radreply_by_value_pattern(
                self.tenant_id, username, "Cisco-AVPair", pattern
            )

        # Juniper ERX policies: CAREFUL - only remove QoS-related entries
        # ERX-Qos-Profile-Name is bandwidth-specific, safe to remove
        # ERX-Ingress/Egress-Policy-Name may be used for ACLs, only remove if QoS-related
        await self.repository.delete_radreply(
            self.tenant_id, username, "ERX-Qos-Profile-Name"
        )
        # Only remove ERX policies if they match QoS naming patterns (e.g., contain "-qos-")
        for attr in ["ERX-Ingress-Policy-Name", "ERX-Egress-Policy-Name"]:
            await self.repository.delete_radreply_by_value_pattern(
                self.tenant_id, username, attr, "%-qos-%"
            )

        # Create vendor-specific attributes
        for attr_spec in attributes:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute=attr_spec.attribute,
                value=attr_spec.value,
                op=attr_spec.op,
            )

        # Add tracking attribute to mark these as bandwidth-profile-managed
        await self.repository.create_radreply(
            tenant_id=self.tenant_id,
            subscriber_id=subscriber_id,
            username=username,
            attribute="X-Bandwidth-Profile-ID",
            value=profile_id,  # Store UUID for tracking/debugging
            op=":=",
        )

        await self.session.flush()

        logger.info(
            "Applied bandwidth profile",
            username=username,
            profile_id=profile_id,
            vendor=nas_vendor,
            attributes=[attr.attribute for attr in attributes],
        )

        return await self.get_subscriber(username)

    # =========================================================================
    # Session Management
    # =========================================================================

    async def get_active_sessions(self, username: str | None = None) -> list[RADIUSSessionResponse]:
        """Get active RADIUS sessions"""
        sessions = await self.repository.get_active_sessions(self.tenant_id, username)

        return [
            RADIUSSessionResponse(
                radacctid=session.radacctid,
                tenant_id=session.tenant_id,
                subscriber_id=session.subscriber_id,
                username=session.username,
                acctsessionid=session.acctsessionid,
                nasipaddress=str(session.nasipaddress),
                framedipaddress=str(session.framedipaddress) if session.framedipaddress else None,
                acctstarttime=session.acctstarttime,
                acctsessiontime=session.acctsessiontime,
                acctinputoctets=session.acctinputoctets,
                acctoutputoctets=session.acctoutputoctets,
                total_bytes=session.total_bytes,
                is_active=session.is_active,
            )
            for session in sessions
        ]

    async def get_subscriber_sessions(
        self,
        subscriber_id: str | None = None,
        username: str | None = None,
        active_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> list[RADIUSSessionResponse]:
        """Get sessions for a subscriber"""
        effective_subscriber_id = subscriber_id

        if not effective_subscriber_id and username:
            radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
            if radcheck:
                effective_subscriber_id = radcheck.subscriber_id

        if not effective_subscriber_id:
            logger.warning(
                "radius_session_lookup_missing_subscriber",
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
            )
            return []

        sessions = await self.repository.get_sessions_by_subscriber(
            self.tenant_id, effective_subscriber_id, active_only, skip, limit
        )

        return [
            RADIUSSessionResponse(
                radacctid=session.radacctid,
                tenant_id=session.tenant_id,
                subscriber_id=session.subscriber_id,
                username=session.username,
                acctsessionid=session.acctsessionid,
                nasipaddress=str(session.nasipaddress),
                framedipaddress=str(session.framedipaddress) if session.framedipaddress else None,
                acctstarttime=session.acctstarttime,
                acctsessiontime=session.acctsessiontime,
                acctinputoctets=session.acctinputoctets,
                acctoutputoctets=session.acctoutputoctets,
                total_bytes=session.total_bytes,
                is_active=session.is_active,
            )
            for session in sessions
        ]

    async def disconnect_session(
        self,
        username: str | None = None,
        session_id: str | None = None,
        nas_ip: str | None = None,
    ) -> dict[str, Any]:
        """
        Disconnect an active RADIUS session using CoA/DM.

        Sends a Disconnect-Request (RFC 5176) to the RADIUS server/NAS
        to forcefully terminate a user session.

        Args:
            username: RADIUS username to disconnect
            session_id: Specific session ID (Acct-Session-Id)
            nas_ip: NAS IP address for routing

        Returns:
            Dictionary with disconnect result containing:
            - success: bool - Whether the disconnect was successful
            - message: str - Human-readable result message
            - username: str - Username that was disconnected
            - details: dict - Full server response details
            - error: str - Error message if applicable

        Raises:
            ValueError: If neither username nor session_id is provided
        """
        if not username and not session_id:
            raise ValueError("Either username or session_id must be provided")

        # If only session_id provided, look up username from radacct
        if session_id and not username:
            sessions = await self.repository.get_active_sessions(self.tenant_id, None)
            session = next(
                (s for s in sessions if s.acctsessionid == session_id),
                None,
            )
            if session:
                username = session.username
                nas_ip = nas_ip or str(session.nasipaddress)
            else:
                logger.warning(
                    "radius_session_not_found",
                    session_id=session_id,
                    tenant_id=self.tenant_id,
                )
                # Continue with provided session ID even if not found locally

        # Send CoA/DM disconnect request
        try:
            response: dict[str, Any]
            # Always use disconnect_session for full response details
            response = await self.coa_client.disconnect_session(
                username=username or "",
                nas_ip=nas_ip,
                session_id=session_id,
            )

            logger.info(
                "radius_disconnect_requested",
                username=username,
                session_id=session_id,
                nas_ip=nas_ip,
                result=response,
                tenant_id=self.tenant_id,
            )

            return response

        except Exception as e:
            logger.error(
                "radius_disconnect_error",
                username=username,
                session_id=session_id,
                error=str(e),
                tenant_id=self.tenant_id,
                exc_info=True,
            )
            return {
                "success": False,
                "message": f"Failed to disconnect session: {str(e)}",
                "username": username or "",
                "error": str(e),
            }

    # =========================================================================
    # Usage Tracking
    # =========================================================================

    async def get_usage_stats(self, query: RADIUSUsageQuery) -> RADIUSUsageResponse:
        """Get usage statistics"""
        stats = await self.repository.get_usage_stats(
            tenant_id=self.tenant_id,
            subscriber_id=query.subscriber_id,
            username=query.username,
            start_date=query.start_date,
            end_date=query.end_date,
        )

        # Get last session times
        if query.subscriber_id:
            sessions = await self.repository.get_sessions_by_subscriber(
                self.tenant_id, query.subscriber_id, active_only=False, skip=0, limit=1
            )
            last_session = sessions[0] if sessions else None
        else:
            last_session = None

        return RADIUSUsageResponse(
            subscriber_id=query.subscriber_id or "",
            username=query.username or "",
            total_sessions=stats.get("total_sessions") or 0,
            total_session_time=stats.get("total_session_time") or 0,
            total_download_bytes=stats.get("total_input_octets") or 0,
            total_upload_bytes=stats.get("total_output_octets") or 0,
            total_bytes=stats.get("total_bytes") or 0,
            active_sessions=stats.get("active_sessions") or 0,
            last_session_start=last_session.acctstarttime if last_session else None,
            last_session_stop=last_session.acctstoptime if last_session else None,
        )

    # =========================================================================
    # NAS Management
    # =========================================================================

    async def create_nas(self, data: NASCreate) -> NASResponse:
        """Create NAS device"""
        nas = await self.repository.create_nas(
            tenant_id=self.tenant_id,
            nasname=data.nasname,
            shortname=data.shortname,
            type=data.type,
            secret=data.secret,
            ports=data.ports,
            community=data.community,
            description=data.description,
        )
        await self.session.commit()

        return self._nas_to_response(nas)

    async def get_nas(self, nas_id: int) -> NASResponse | None:
        """Get NAS device by ID"""
        nas = await self.repository.get_nas_by_id(self.tenant_id, nas_id)
        if not nas:
            return None

        return self._nas_to_response(nas)

    async def update_nas(self, nas_id: int, data: NASUpdate) -> NASResponse | None:
        """Update NAS device"""
        nas = await self.repository.get_nas_by_id(self.tenant_id, nas_id)
        if not nas:
            return None

        updates = data.model_dump(exclude_unset=True)
        nas = await self.repository.update_nas(nas, **updates)
        await self.session.commit()

        return await self.get_nas(nas_id)

    async def delete_nas(self, nas_id: int) -> bool:
        """Delete NAS device"""
        deleted = await self.repository.delete_nas(self.tenant_id, nas_id)
        await self.session.commit()
        return bool(deleted)

    async def list_nas_devices(self, skip: int = 0, limit: int = 100) -> list[NASResponse]:
        """List NAS devices"""
        nas_devices = await self.repository.list_nas_devices(self.tenant_id, skip, limit)

        return [self._nas_to_response(nas) for nas in nas_devices]

    def _nas_to_response(self, nas: Any) -> NASResponse:
        """Convert NAS ORM object to response without leaking secrets."""
        return NASResponse(
            id=nas.id,
            tenant_id=nas.tenant_id,
            nasname=nas.nasname,
            shortname=nas.shortname,
            type=nas.type,
            secret_configured=bool(getattr(nas, "secret", None)),
            ports=nas.ports,
            community=nas.community,
            description=nas.description,
            created_at=nas.created_at,
            updated_at=nas.updated_at,
        )

    # =========================================================================
    # Bandwidth Profile Management
    # =========================================================================

    async def create_bandwidth_profile(
        self, data: BandwidthProfileCreate
    ) -> BandwidthProfileResponse:
        """Create bandwidth profile"""
        profile_id = str(uuid4())

        profile = await self.repository.create_bandwidth_profile(
            tenant_id=self.tenant_id,
            profile_id=profile_id,
            name=data.name,
            description=data.description,
            download_rate_kbps=data.download_rate_kbps,
            upload_rate_kbps=data.upload_rate_kbps,
            download_burst_kbps=data.download_burst_kbps,
            upload_burst_kbps=data.upload_burst_kbps,
        )
        await self.session.commit()

        return BandwidthProfileResponse(
            id=profile.id,
            tenant_id=profile.tenant_id,
            name=profile.name,
            description=profile.description,
            download_rate_kbps=profile.download_rate_kbps,
            upload_rate_kbps=profile.upload_rate_kbps,
            download_burst_kbps=profile.download_burst_kbps,
            upload_burst_kbps=profile.upload_burst_kbps,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    async def get_bandwidth_profile(self, profile_id: str) -> BandwidthProfileResponse | None:
        """Get bandwidth profile"""
        profile = await self.repository.get_bandwidth_profile(self.tenant_id, profile_id)
        if not profile:
            return None

        return BandwidthProfileResponse(
            id=profile.id,
            tenant_id=profile.tenant_id,
            name=profile.name,
            description=profile.description,
            download_rate_kbps=profile.download_rate_kbps,
            upload_rate_kbps=profile.upload_rate_kbps,
            download_burst_kbps=profile.download_burst_kbps,
            upload_burst_kbps=profile.upload_burst_kbps,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    async def list_bandwidth_profiles(
        self, skip: int = 0, limit: int = 100
    ) -> list[BandwidthProfileResponse]:
        """List all bandwidth profiles for the tenant.

        Args:
            skip: Number of records to skip for pagination
            limit: Maximum number of records to return

        Returns:
            List of bandwidth profile responses

        Raises:
            RepositoryError: If database query fails
        """
        profiles = await self.repository.list_bandwidth_profiles(self.tenant_id, skip, limit)

        return [
            BandwidthProfileResponse(
                id=profile.id,
                tenant_id=profile.tenant_id,
                name=profile.name,
                description=profile.description,
                download_rate_kbps=profile.download_rate_kbps,
                upload_rate_kbps=profile.upload_rate_kbps,
                download_burst_kbps=profile.download_burst_kbps,
                upload_burst_kbps=profile.upload_burst_kbps,
                created_at=profile.created_at,
                updated_at=profile.updated_at,
            )
            for profile in profiles
        ]

    # =========================================================================
    # Utility Methods
    # =========================================================================

    @staticmethod
    def generate_random_password(length: int = 12) -> str:
        """Generate a random password"""
        if length < 4:
            raise ValueError("Password length must be at least 4 characters")

        lowercase = secrets.choice(string.ascii_lowercase)
        uppercase = secrets.choice(string.ascii_uppercase)
        digit = secrets.choice(string.digits)
        special = secrets.choice("!@#$%^&*")

        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        remaining = [secrets.choice(alphabet) for _ in range(length - 4)]

        password_chars = [lowercase, uppercase, digit, special, *remaining]
        secrets.SystemRandom().shuffle(password_chars)
        return "".join(password_chars)

    # =========================================================================
    # Password Security Management
    # =========================================================================

    async def get_password_hashing_stats(self) -> dict[str, Any]:
        """
        Get statistics on password hashing methods used across subscribers.

        Returns:
            Dictionary with counts of each hashing method and percentage breakdown
        """
        stats = await self.repository.get_password_hashing_stats(self.tenant_id)

        total = sum(stats.values())
        percentages = {
            method: round((count / total * 100), 2) if total > 0 else 0
            for method, count in stats.items()
        }

        return {
            "total_subscribers": total,
            "counts": stats,
            "percentages": percentages,
            "weak_password_count": stats.get("cleartext", 0) + stats.get("md5", 0),
            "strong_password_count": stats.get("bcrypt", 0) + stats.get("sha256", 0),
        }

    async def upgrade_subscriber_password_hash(
        self,
        username: str,
        plain_password: str,
        target_method: PasswordHashingMethod = PasswordHashingMethod.BCRYPT,
    ) -> bool:
        """
        Upgrade a subscriber's password hash to a stronger method.

        Note: This requires the plain text password, so it should only be used:
        - During password reset flows
        - When user provides password (e.g., profile update)
        - In migration scripts where passwords are available

        Args:
            username: RADIUS username
            plain_password: Plain text password
            target_method: Target hashing method (default: BCRYPT)

        Returns:
            True if upgraded successfully, False if subscriber not found
        """
        radcheck = await self.repository.update_radcheck_password(
            self.tenant_id, username, plain_password, target_method
        )

        if radcheck:
            await self.session.commit()
            logger.info(
                "password_hash_upgraded",
                username=username,
                target_method=target_method.value,
                tenant_id=self.tenant_id,
            )
            return True

        return False

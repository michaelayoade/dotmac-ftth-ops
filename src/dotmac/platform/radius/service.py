"""
RADIUS Service Layer

Business logic for RADIUS operations.
Handles subscriber management, session tracking, and usage monitoring.
"""

import os
import secrets
import string
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID, uuid4

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.network.models import SubscriberNetworkProfile
from dotmac.platform.radius.coa_client import CoAClient, CoAClientHTTP
from dotmac.platform.radius.repository import RADIUSRepository
from dotmac.platform.radius.schemas import (
    BandwidthProfileCreate,
    BandwidthProfileResponse,
    NASCreate,
    NASResponse,
    NASUpdate,
    RADIUSAuthorizationRequest,
    RADIUSAuthorizationResponse,
    RADIUSSessionResponse,
    RADIUSSubscriberCreate,
    RADIUSSubscriberResponse,
    RADIUSSubscriberUpdate,
    RADIUSUsageQuery,
    RADIUSUsageResponse,
)
from dotmac.platform.services.lifecycle.models import ServiceInstance
from dotmac.platform.subscribers.models import PasswordHashingMethod, verify_radius_password

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

        # In-memory caches for lightweight/testing scenarios
        self._subscriber_cache: dict[str, RADIUSSubscriberResponse] = {}
        self._subscriber_username_to_id: dict[str, str] = {}
        self._subscriber_index_by_subscription: dict[str, str] = {}
        self._session_store: dict[str, dict[str, Any]] = {}
        self._session_history: list[dict[str, Any]] = []
        self._session_counter = 1
        self._nas_store: dict[int, dict[str, Any]] = {}
        self._nas_counter = 1

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

        profile = await self._get_network_profile(data.subscriber_id)

        framed_ipv4_address = data.framed_ipv4_address or (
            str(profile.static_ipv4) if profile and profile.static_ipv4 else None
        )
        framed_ipv6_address = data.framed_ipv6_address or (
            str(profile.static_ipv6) if profile and profile.static_ipv6 else None
        )
        framed_ipv6_prefix = data.framed_ipv6_prefix
        delegated_ipv6_prefix = data.delegated_ipv6_prefix or (
            profile.delegated_ipv6_prefix if profile and profile.delegated_ipv6_prefix else None
        )

        # Create authentication entry (radcheck)
        radcheck = await self.repository.create_radcheck(
            tenant_id=self.tenant_id,
            subscriber_id=data.subscriber_id,
            username=data.username,
            password=data.password,
        )

        # Create authorization entries (radreply)
        # IPv4 address
        if framed_ipv4_address:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Framed-IP-Address",
                value=framed_ipv4_address,
            )

        # IPv6 address (RFC 6911)
        if framed_ipv6_address:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Framed-IPv6-Address",
                value=framed_ipv6_address,
            )

        # IPv6 prefix for subscriber interface (RFC 3162)
        if framed_ipv6_prefix:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Framed-IPv6-Prefix",
                value=framed_ipv6_prefix,
            )

        # IPv6 prefix delegation (RFC 4818)
        if delegated_ipv6_prefix:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=data.subscriber_id,
                username=data.username,
                attribute="Delegated-IPv6-Prefix",
                value=delegated_ipv6_prefix,
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
                raise ValueError(f"Bandwidth profile '{data.bandwidth_profile_id}' not found")

        if profile and profile.service_vlan:
            await self._apply_vlan_attributes(
                username=data.username,
                subscriber_id=data.subscriber_id,
                vlan_id=profile.service_vlan,
                inner_vlan_id=getattr(profile, "inner_vlan", None),
                qinq_enabled=getattr(profile, "qinq_enabled", False),
            )

        await self.session.commit()

        if data.framed_ipv4_address:
            service_result = await self.session.execute(
                select(ServiceInstance).where(
                    and_(
                        ServiceInstance.tenant_id == self.tenant_id,
                        ServiceInstance.subscription_id == data.subscriber_id,
                        ServiceInstance.deleted_at.is_(None),
                    )
                )
            )
            service_instance = service_result.scalar_one_or_none()
            if service_instance:
                service_instance.ip_address = data.framed_ipv4_address
                await self.session.commit()

        response = RADIUSSubscriberResponse(
            id=radcheck.id,
            tenant_id=radcheck.tenant_id,
            subscriber_id=radcheck.subscriber_id,
            username=radcheck.username,
            bandwidth_profile_id=data.bandwidth_profile_id,
            framed_ipv4_address=framed_ipv4_address,
            framed_ipv6_address=framed_ipv6_address,
            framed_ipv6_prefix=framed_ipv6_prefix,
            delegated_ipv6_prefix=delegated_ipv6_prefix,
            session_timeout=data.session_timeout,
            idle_timeout=data.idle_timeout,
            enabled=True,
            created_at=radcheck.created_at,
            updated_at=radcheck.updated_at,
        )
        self._subscriber_cache[response.username] = response
        if response.subscriber_id:
            self._subscriber_index_by_subscription[response.subscriber_id] = response.username
            self._subscriber_username_to_id[response.username] = response.subscriber_id
        return response

    async def suspend_subscriber(self, subscriber_id: str) -> RADIUSSubscriberResponse | None:
        """Disable a subscriber by adding Auth-Type := Reject."""
        radcheck = await self.repository.get_radcheck_by_subscriber(self.tenant_id, subscriber_id)
        if not radcheck:
            return None

        username = cast(str, radcheck.username)
        existing_replies = await self.repository.get_radreplies_by_username(
            self.tenant_id, username
        )
        if not any(
            reply.attribute == "Auth-Type" and reply.value == "Reject" for reply in existing_replies
        ):
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Auth-Type",
                value="Reject",
                op=":=",
            )
            await self.session.commit()
        return await self.get_subscriber(username)

    async def resume_subscriber(self, subscriber_id: str) -> RADIUSSubscriberResponse | None:
        """Re-enable a previously suspended subscriber."""
        radcheck = await self.repository.get_radcheck_by_subscriber(self.tenant_id, subscriber_id)
        if not radcheck:
            return None

        username = cast(str, radcheck.username)
        deleted = await self.repository.delete_radreply(self.tenant_id, username, "Auth-Type")
        if deleted:
            await self.session.commit()
        return await self.get_subscriber(username)

    async def get_subscriber(
        self,
        username: str | None = None,
        *,
        subscriber_id: str | UUID | None = None,
    ) -> RADIUSSubscriberResponse | None:
        """Get RADIUS subscriber by username or subscriber_id."""
        resolved_username = username
        if resolved_username is None:
            if subscriber_id is None:
                raise ValueError("username or subscriber_id is required")
            subscriber_key = str(subscriber_id)
            resolved_username = self._subscriber_index_by_subscription.get(subscriber_key)
            if resolved_username is None:
                radcheck = await self.repository.get_radcheck_by_subscriber(
                    self.tenant_id, subscriber_id
                )
                if not radcheck:
                    cached = self._subscriber_cache.get(subscriber_key)
                    if cached:
                        return cached
                    return None
                resolved_username = cast(str, radcheck.username)

        radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, resolved_username)
        if not radcheck:
            cached = self._subscriber_cache.get(resolved_username)
            if cached:
                return cached
            return None

        # Get reply attributes
        radreplies = await self.repository.get_radreplies_by_username(
            self.tenant_id, resolved_username
        )

        # Extract common attributes
        framed_ipv4 = None
        framed_ipv6 = None
        framed_ipv6_prefix = None
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
            elif reply.attribute == "Framed-IPv6-Prefix":
                framed_ipv6_prefix = reply.value
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

        response = RADIUSSubscriberResponse(
            id=radcheck.id,
            tenant_id=radcheck.tenant_id,
            subscriber_id=radcheck.subscriber_id,
            username=radcheck.username,
            bandwidth_profile_id=bandwidth_profile_id,
            framed_ipv4_address=framed_ipv4,
            framed_ipv6_address=framed_ipv6,
            framed_ipv6_prefix=framed_ipv6_prefix,
            delegated_ipv6_prefix=delegated_ipv6_prefix,
            session_timeout=session_timeout,
            idle_timeout=idle_timeout,
            enabled=is_enabled,
            created_at=radcheck.created_at,
            updated_at=radcheck.updated_at,
        )
        self._subscriber_cache[response.username] = response
        if response.subscriber_id:
            self._subscriber_index_by_subscription[response.subscriber_id] = response.username
            self._subscriber_username_to_id[response.username] = response.subscriber_id
        return response

    async def get_subscriber_by_subscription(
        self, subscription_id: str
    ) -> RADIUSSubscriberResponse | None:
        """Retrieve subscriber using subscription ID mapping."""
        return await self.get_subscriber(subscriber_id=subscription_id)

    def _get_subscriber_id_by_username(self, username: str) -> str | None:
        return self._subscriber_username_to_id.get(username)

    async def _resolve_subscriber_id(self, username: str) -> str | None:
        subscriber_id = self._get_subscriber_id_by_username(username)
        if subscriber_id is not None:
            return subscriber_id

        radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
        if not radcheck or radcheck.subscriber_id is None:
            return None

        subscriber_id = cast(str, radcheck.subscriber_id)
        self._subscriber_username_to_id[username] = subscriber_id
        return subscriber_id

    def _build_session_response(self, record: dict[str, Any]) -> RADIUSSessionResponse:
        total_bytes = (record.get("acctinputoctets") or 0) + (record.get("acctoutputoctets") or 0)
        return RADIUSSessionResponse(
            radacctid=record["radacctid"],
            tenant_id=self.tenant_id,
            subscriber_id=record.get("subscriber_id"),
            username=record["username"],
            acctsessionid=record["acctsessionid"],
            nasipaddress=record["nasipaddress"],
            nasportid=record.get("nasportid"),
            framedipaddress=record.get("framedipaddress"),
            framedipv6address=record.get("framedipv6address"),
            framedipv6prefix=record.get("framedipv6prefix"),
            delegatedipv6prefix=record.get("delegatedipv6prefix"),
            acctstarttime=record.get("acctstarttime"),
            acctsessiontime=record.get("acctsessiontime"),
            acctinputoctets=record.get("acctinputoctets"),
            acctoutputoctets=record.get("acctoutputoctets"),
            total_bytes=total_bytes,
            is_active=record.get("is_active", True),
            callingstationid=record.get("callingstationid"),
            acct_stop_time=record.get("acct_stop_time"),
            acct_terminate_cause=record.get("acct_terminate_cause"),
            last_update=record.get("last_update"),
        )

    async def start_session(
        self,
        *,
        username: str,
        nas_ip_address: str,
        nas_port_id: str,
        framed_ip_address: str | None = None,
        session_id: str | None = None,
        **metadata: Any,
    ) -> RADIUSSessionResponse:
        """Start (record) a new RADIUS session."""
        acctsessionid = session_id or f"sess_{uuid4().hex[:16]}"
        now = datetime.now(UTC)

        record = {
            "radacctid": self._session_counter,
            "subscriber_id": self._get_subscriber_id_by_username(username),
            "username": username,
            "acctsessionid": acctsessionid,
            "nasipaddress": nas_ip_address,
            "nasportid": nas_port_id,
            "framedipaddress": framed_ip_address,
            "framedipv6address": metadata.get("framed_ipv6_address"),
            "framedipv6prefix": metadata.get("framed_ipv6_prefix"),
            "delegatedipv6prefix": metadata.get("delegated_ipv6_prefix"),
            "acctstarttime": metadata.get("acct_start_time") or now,
            "acctsessiontime": metadata.get("acct_session_time", 0),
            "acctinputoctets": metadata.get("acct_input_octets", 0),
            "acctoutputoctets": metadata.get("acct_output_octets", 0),
            "callingstationid": metadata.get("calling_station_id"),
            "is_active": True,
            "acct_stop_time": None,
            "acct_terminate_cause": None,
            "last_update": metadata.get("last_update") or now,
        }

        self._session_store[acctsessionid] = record
        self._session_history.append(record)
        self._session_counter += 1

        return self._build_session_response(record)

    async def update_session_accounting(
        self,
        *,
        session_id: str,
        acct_session_time: int | None = None,
        acct_input_octets: int | None = None,
        acct_output_octets: int | None = None,
    ) -> RADIUSSessionResponse:
        """Update accounting counters for a session."""
        record = self._session_store.get(session_id)
        if not record:
            raise ValueError("Session not found")

        if acct_session_time is not None:
            record["acctsessiontime"] = acct_session_time
        if acct_input_octets is not None:
            record["acctinputoctets"] = acct_input_octets
        if acct_output_octets is not None:
            record["acctoutputoctets"] = acct_output_octets

        record["last_update"] = datetime.now(UTC)

        return self._build_session_response(record)

    async def stop_session(
        self,
        *,
        session_id: str,
        acct_session_time: int | None = None,
        acct_input_octets: int | None = None,
        acct_output_octets: int | None = None,
        acct_terminate_cause: str | None = None,
    ) -> RADIUSSessionResponse:
        """Mark a session as stopped and finalize accounting."""
        record = self._session_store.get(session_id)
        if not record:
            raise ValueError("Session not found")

        await self.update_session_accounting(
            session_id=session_id,
            acct_session_time=acct_session_time,
            acct_input_octets=acct_input_octets,
            acct_output_octets=acct_output_octets,
        )

        record["acct_stop_time"] = datetime.now(UTC)
        record["acct_terminate_cause"] = acct_terminate_cause
        record["is_active"] = False

        return self._build_session_response(record)

    async def get_subscriber_usage(self, query: RADIUSUsageQuery) -> RADIUSUsageResponse:
        """Aggregate usage statistics for a subscriber."""
        records = []
        for record in self._session_history:
            if query.subscriber_id and record.get("subscriber_id") != query.subscriber_id:
                continue
            if query.username and record.get("username") != query.username:
                continue

            start_time = record.get("acctstarttime") or record.get("last_update")
            stop_time = record.get("acct_stop_time") or record.get("last_update")

            if query.start_date and start_time and start_time < query.start_date:
                continue
            if query.end_date and stop_time and stop_time > query.end_date:
                continue

            if query.include_active_only and not record.get("is_active", True):
                continue

            records.append(record)

        if query.subscriber_id:
            subscriber_id = query.subscriber_id
        elif query.username:
            subscriber_id = self._get_subscriber_id_by_username(query.username) or "unknown"
        elif records:
            subscriber_id = records[0].get("subscriber_id") or "unknown"
        else:
            subscriber_id = query.subscriber_id or "unknown"

        username = query.username
        if not username and records:
            username = records[0].get("username")

        total_sessions = len(records)
        total_session_time = 0
        total_download = 0
        total_upload = 0
        active_sessions = 0
        last_start = None
        last_stop = None

        for record in records:
            start_time = record.get("acctstarttime")
            stop_time = record.get("acct_stop_time")
            session_time = record.get("acctsessiontime") or 0
            if session_time == 0 and start_time and stop_time:
                session_time = int((stop_time - start_time).total_seconds())
            total_session_time += session_time
            total_download += record.get("acctinputoctets", 0) or 0
            total_upload += record.get("acctoutputoctets", 0) or 0
            if record.get("is_active", True):
                active_sessions += 1
            if start_time and (last_start is None or start_time > last_start):
                last_start = start_time
            if stop_time and (last_stop is None or stop_time > last_stop):
                last_stop = stop_time

        return RADIUSUsageResponse(
            subscriber_id=str(subscriber_id),
            username=username or "unknown",
            total_sessions=total_sessions,
            total_session_time=total_session_time,
            total_download_bytes=total_download,
            total_upload_bytes=total_upload,
            total_bytes=total_download + total_upload,
            active_sessions=active_sessions,
            last_session_start=last_start,
            last_session_stop=last_stop,
        )

    async def get_tenant_usage_summary(self, query: RADIUSUsageQuery) -> SimpleNamespace:
        """Return aggregated usage summary for the tenant."""
        records = []
        for record in self._session_history:
            start_time = record.get("acctstarttime") or record.get("last_update")
            stop_time = record.get("acct_stop_time") or record.get("last_update")

            if query.start_date and start_time and start_time < query.start_date:
                continue
            if query.end_date and stop_time and stop_time > query.end_date:
                continue
            records.append(record)

        subscribers = {
            record.get("username") or record.get("subscriber_id")
            for record in records
            if record.get("username") or record.get("subscriber_id")
        }
        total_download = sum(record.get("acctinputoctets", 0) or 0 for record in records)
        total_upload = sum(record.get("acctoutputoctets", 0) or 0 for record in records)
        total_session_time = 0
        for record in records:
            session_time = record.get("acctsessiontime") or 0
            if session_time == 0 and record.get("acctstarttime") and record.get("acct_stop_time"):
                session_time = int(
                    (record["acct_stop_time"] - record["acctstarttime"]).total_seconds()
                )
            total_session_time += session_time

        return SimpleNamespace(
            total_subscribers=len(subscribers),
            total_download_bytes=total_download,
            total_upload_bytes=total_upload,
            total_session_time=total_session_time,
            active_sessions=sum(1 for record in records if record.get("is_active", True)),
        )

    async def update_subscriber(
        self,
        username: str | None = None,
        data: RADIUSSubscriberUpdate | None = None,
        *,
        subscriber_id: str | UUID | None = None,
    ) -> RADIUSSubscriberResponse | None:
        """Update RADIUS subscriber"""
        if data is None:
            raise ValueError("data is required")

        resolved_username = username
        if resolved_username is None:
            if subscriber_id is None:
                raise ValueError("username or subscriber_id is required")
            resolved_username = self._subscriber_index_by_subscription.get(str(subscriber_id))
            if resolved_username is None:
                radcheck = await self.repository.get_radcheck_by_subscriber(
                    self.tenant_id, subscriber_id
                )
                if not radcheck:
                    return None
                resolved_username = cast(str, radcheck.username)

        username = resolved_username
        # Update password if provided
        if data.password:
            await self.repository.update_radcheck_password(self.tenant_id, username, data.password)

        # Update reply attributes
        # IPv4 address
        if data.framed_ipv4_address is not None:
            # Delete existing and create new
            await self.repository.delete_radreply(self.tenant_id, username, "Framed-IP-Address")
            if data.framed_ipv4_address:
                subscriber_ref = await self._resolve_subscriber_id(username)
                if subscriber_ref is not None:
                    await self.repository.create_radreply(
                        tenant_id=self.tenant_id,
                        subscriber_id=subscriber_ref,
                        username=username,
                        attribute="Framed-IP-Address",
                        value=data.framed_ipv4_address,
                    )

        # IPv6 address
        if data.framed_ipv6_address is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Framed-IPv6-Address")
            if data.framed_ipv6_address:
                subscriber_ref = await self._resolve_subscriber_id(username)
                if subscriber_ref is not None:
                    await self.repository.create_radreply(
                        tenant_id=self.tenant_id,
                        subscriber_id=subscriber_ref,
                        username=username,
                        attribute="Framed-IPv6-Address",
                        value=data.framed_ipv6_address,
                    )

        # IPv6 prefix for subscriber interface
        if data.framed_ipv6_prefix is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Framed-IPv6-Prefix")
            if data.framed_ipv6_prefix:
                subscriber_ref = await self._resolve_subscriber_id(username)
                if subscriber_ref is not None:
                    await self.repository.create_radreply(
                        tenant_id=self.tenant_id,
                        subscriber_id=subscriber_ref,
                        username=username,
                        attribute="Framed-IPv6-Prefix",
                        value=data.framed_ipv6_prefix,
                    )

        # IPv6 prefix delegation
        if data.delegated_ipv6_prefix is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Delegated-IPv6-Prefix")
            if data.delegated_ipv6_prefix:
                subscriber_ref = await self._resolve_subscriber_id(username)
                if subscriber_ref is not None:
                    await self.repository.create_radreply(
                        tenant_id=self.tenant_id,
                        subscriber_id=subscriber_ref,
                        username=username,
                        attribute="Delegated-IPv6-Prefix",
                        value=data.delegated_ipv6_prefix,
                    )

        if data.session_timeout is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Session-Timeout")
            if data.session_timeout:
                subscriber_ref = await self._resolve_subscriber_id(username)
                await self.repository.create_radreply(
                    tenant_id=self.tenant_id,
                    subscriber_id=subscriber_ref,
                    username=username,
                    attribute="Session-Timeout",
                    value=str(data.session_timeout),
                )

        if data.idle_timeout is not None:
            await self.repository.delete_radreply(self.tenant_id, username, "Idle-Timeout")
            if data.idle_timeout:
                subscriber_ref = await self._resolve_subscriber_id(username)
                await self.repository.create_radreply(
                    tenant_id=self.tenant_id,
                    subscriber_id=subscriber_ref,
                    username=username,
                    attribute="Idle-Timeout",
                    value=str(data.idle_timeout),
                )

        # Update bandwidth profile
        if data.bandwidth_profile_id:
            radcheck = await self.repository.get_radcheck_by_username(self.tenant_id, username)
            if not radcheck:
                logger.warning(
                    "radius_subscriber_not_found_for_profile_update",
                    tenant_id=self.tenant_id,
                    username=username,
                    profile_id=data.bandwidth_profile_id,
                )
            else:
                subscriber_ref = cast(str | None, radcheck.subscriber_id)
                await self.apply_bandwidth_profile(
                    username=username,
                    subscriber_id=subscriber_ref,
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

    async def delete_subscriber(
        self, username: str | None = None, *, subscriber_id: UUID | None = None
    ) -> bool:
        """Delete RADIUS subscriber by username or subscriber_id."""
        if not username:
            if subscriber_id is None:
                raise ValueError("username or subscriber_id is required")
            radcheck = await self.repository.get_radcheck_by_subscriber(
                self.tenant_id, subscriber_id
            )
            if not radcheck:
                return False
            username = cast(str, radcheck.username)
        elif subscriber_id is not None:
            # Verify the subscriber matches the username if both provided
            radcheck = await self.repository.get_radcheck_by_subscriber(
                self.tenant_id, subscriber_id
            )
            if radcheck and radcheck.username != username:
                raise ValueError("Provided username does not match subscriber_id")

        cached_subscriber_id = None
        if username in self._subscriber_cache:
            cached_subscriber_id = self._subscriber_cache[username].subscriber_id

        # Delete radcheck
        deleted_check = await self.repository.delete_radcheck(self.tenant_id, username)

        # Delete all radreplies
        await self.repository.delete_all_radreplies(self.tenant_id, username)

        await self.session.commit()

        self._subscriber_cache.pop(username, None)
        self._subscriber_username_to_id.pop(username, None)
        if subscriber_id:
            self._subscriber_index_by_subscription.pop(str(subscriber_id), None)
        elif cached_subscriber_id:
            self._subscriber_index_by_subscription.pop(cached_subscriber_id, None)

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

        default_vendor = settings.radius.default_vendor

        # Try to get vendor from subscriber's active session
        sessions = await self.repository.get_active_sessions(self.tenant_id, username)
        if sessions:
            # Get NAS from first active session
            nas_ip = str(sessions[0].nasipaddress)
            nas = await self.repository.get_nas_by_name(self.tenant_id, nas_ip)
            if nas and hasattr(nas, "vendor"):
                vendor_value = cast(str, nas.vendor) if nas.vendor is not None else default_vendor
                logger.debug(
                    "Resolved NAS vendor from active session",
                    username=username,
                    vendor=vendor_value,
                    nas_ip=nas_ip,
                )
                return vendor_value

        # Fallback to default vendor from settings
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

        effective_subscriber_id = subscriber_id or cast(str | None, radcheck.subscriber_id)

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
        await self.repository.delete_radreply(self.tenant_id, username, "X-Bandwidth-Profile-ID")

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
        await self.repository.delete_radreply(self.tenant_id, username, "ERX-Qos-Profile-Name")
        # Only remove ERX policies if they match QoS naming patterns (e.g., contain "-qos-")
        for attr in ["ERX-Ingress-Policy-Name", "ERX-Egress-Policy-Name"]:
            await self.repository.delete_radreply_by_value_pattern(
                self.tenant_id, username, attr, "%-qos-%"
            )

        # Create vendor-specific attributes
        for attr_spec in attributes:
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=effective_subscriber_id,
                username=username,
                attribute=attr_spec.attribute,
                value=attr_spec.value,
                op=attr_spec.op,
            )

        # Add tracking attribute to mark these as bandwidth-profile-managed
        await self.repository.create_radreply(
            tenant_id=self.tenant_id,
            subscriber_id=effective_subscriber_id,
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
        if self._session_store:
            in_memory = [
                record
                for record in self._session_store.values()
                if record.get("is_active", True)
                and (username is None or record.get("username") == username)
            ]
            if in_memory:
                return [self._build_session_response(record) for record in in_memory]

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
                effective_subscriber_id = cast(str | None, radcheck.subscriber_id)

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
                username = str(session.username)
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

    async def _get_network_profile(
        self, subscriber_id: str | None
    ) -> SubscriberNetworkProfile | None:
        """Fetch subscriber network profile if one exists."""
        if not subscriber_id:
            return None
        stmt = (
            select(SubscriberNetworkProfile)
            .where(
                SubscriberNetworkProfile.subscriber_id == subscriber_id,
                SubscriberNetworkProfile.tenant_id == self.tenant_id,
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _apply_vlan_attributes(
        self,
        username: str,
        subscriber_id: str | None,
        vlan_id: int,
        inner_vlan_id: int | None = None,
        qinq_enabled: bool = False,
    ) -> None:
        """
        Create RADIUS Tunnel attributes for VLAN enforcement.

        Supports both single VLAN tagging and QinQ (IEEE 802.1ad) double tagging.

        **Single VLAN Mode** (qinq_enabled=False):
        - Tunnel-Type: VLAN
        - Tunnel-Medium-Type: IEEE-802
        - Tunnel-Private-Group-ID: <vlan_id>

        **QinQ Mode** (qinq_enabled=True):
        - Outer VLAN (S-VLAN): Tag 1
          - Tunnel-Type:1: VLAN
          - Tunnel-Medium-Type:1: IEEE-802
          - Tunnel-Private-Group-ID:1: <vlan_id>
        - Inner VLAN (C-VLAN): Tag 2
          - Tunnel-Type:2: VLAN
          - Tunnel-Medium-Type:2: IEEE-802
          - Tunnel-Private-Group-ID:2: <inner_vlan_id>

        Args:
            username: RADIUS username
            subscriber_id: Subscriber UUID
            vlan_id: Primary VLAN (S-VLAN in QinQ, single VLAN otherwise)
            inner_vlan_id: Inner VLAN (C-VLAN) when QinQ is enabled
            qinq_enabled: Enable QinQ double tagging
        """
        if qinq_enabled and inner_vlan_id:
            # QinQ Mode: Double VLAN tagging
            # Outer VLAN (S-VLAN) with tag 1
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Type:1",
                value="VLAN",
                op=":=",
            )
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Medium-Type:1",
                value="IEEE-802",
                op=":=",
            )
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Private-Group-ID:1",
                value=str(vlan_id),
                op=":=",
            )

            # Inner VLAN (C-VLAN) with tag 2
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Type:2",
                value="VLAN",
                op=":=",
            )
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Medium-Type:2",
                value="IEEE-802",
                op=":=",
            )
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Private-Group-ID:2",
                value=str(inner_vlan_id),
                op=":=",
            )
        else:
            # Single VLAN Mode (backward compatible)
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Type",
                value="VLAN",
                op=":=",
            )
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Medium-Type",
                value="IEEE-802",
                op=":=",
            )
            await self.repository.create_radreply(
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                username=username,
                attribute="Tunnel-Private-Group-ID",
                value=str(vlan_id),
                op=":=",
            )

    # =========================================================================
    # Phase 3: Option 82 & VLAN Enforcement
    # =========================================================================

    @staticmethod
    def parse_option82(access_request: dict[str, Any]) -> dict[str, str | None]:
        """
        Parse DHCP Option 82 (Relay Agent Information) from RADIUS Access-Request.

        Option 82 provides:
        - circuit-id: Physical port identifier (e.g., "OLT1/1/1/1:1", "ge-0/0/1.100")
        - remote-id: Subscriber CPE identifier (e.g., MAC address, serial number)

        These identifiers enable ISPs to:
        1. Validate subscriber location (prevent service theft)
        2. Enforce port-level access control
        3. Correlate sessions with physical infrastructure
        4. Troubleshoot connectivity issues

        RADIUS Attributes:
        - Agent-Circuit-Id (RADIUS attribute 82, sub-attribute 1)
        - Agent-Remote-Id (RADIUS attribute 82, sub-attribute 2)

        Args:
            access_request: RADIUS Access-Request packet dictionary

        Returns:
            dict with 'circuit_id' and 'remote_id' keys (None if not present)

        Example:
            {
                "circuit_id": "OLT1/1/1/1:1",  # OLT/rack/shelf/port:ONT
                "remote_id": "ALCL12345678",   # ONU serial number
            }
        """
        circuit_id = None
        remote_id = None

        # Check for Agent-Circuit-Id (sub-attribute 1)
        if "Agent-Circuit-Id" in access_request:
            circuit_id = access_request["Agent-Circuit-Id"]
        elif "Alcatel-Lucent-Agent-Circuit-Id" in access_request:
            # Vendor-specific variant
            circuit_id = access_request["Alcatel-Lucent-Agent-Circuit-Id"]

        # Check for Agent-Remote-Id (sub-attribute 2)
        if "Agent-Remote-Id" in access_request:
            remote_id = access_request["Agent-Remote-Id"]
        elif "Alcatel-Lucent-Agent-Remote-Id" in access_request:
            # Vendor-specific variant
            remote_id = access_request["Alcatel-Lucent-Agent-Remote-Id"]

        return {
            "circuit_id": circuit_id,
            "remote_id": remote_id,
        }

    async def validate_option82(
        self,
        subscriber_id: str,
        access_request: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Validate Option 82 attributes against subscriber's network profile.

        Enforces policies based on network profile configuration:
        - ENFORCE: Deny access if Option 82 doesn't match
        - LOG: Log mismatches but allow access
        - IGNORE: Skip validation

        Args:
            subscriber_id: Subscriber UUID
            access_request: RADIUS Access-Request packet

        Returns:
            dict with validation result:
            {
                "valid": bool,
                "policy": str,  # "reject", "log", "ignore"
                "mismatches": list[str],  # Mismatch descriptions
                "circuit_id_received": str | None,
                "circuit_id_expected": str | None,
                "remote_id_received": str | None,
                "remote_id_expected": str | None,
            }
        """
        # Parse Option 82 from RADIUS request
        option82 = self.parse_option82(access_request)

        # Fetch subscriber's network profile
        result = await self.session.execute(
            select(SubscriberNetworkProfile).where(
                and_(
                    SubscriberNetworkProfile.subscriber_id == subscriber_id,
                    SubscriberNetworkProfile.tenant_id == self.tenant_id,
                    SubscriberNetworkProfile.deleted_at.is_(None),
                )
            )
        )
        profile = result.scalar_one_or_none()

        # No profile = no validation
        if not profile:
            return {
                "valid": True,
                "policy": "ignore",
                "mismatches": [],
                "circuit_id_received": option82.get("circuit_id"),
                "circuit_id_expected": None,
                "remote_id_received": option82.get("remote_id"),
                "remote_id_expected": None,
            }

        # Get policy from profile
        policy = profile.option82_policy.value if profile.option82_policy else "log"

        # If policy is IGNORE, skip validation
        if policy.lower() == "ignore":
            return {
                "valid": True,
                "policy": "ignore",
                "mismatches": [],
                "circuit_id_received": option82.get("circuit_id"),
                "circuit_id_expected": profile.circuit_id,
                "remote_id_received": option82.get("remote_id"),
                "remote_id_expected": profile.remote_id,
            }

        # Validate circuit-id
        mismatches = []
        if profile.circuit_id and profile.circuit_id != option82.get("circuit_id"):
            mismatches.append(
                f"circuit_id mismatch: expected='{profile.circuit_id}', "
                f"received='{option82.get('circuit_id')}'"
            )

        # Validate remote-id
        if profile.remote_id and profile.remote_id != option82.get("remote_id"):
            mismatches.append(
                f"remote_id mismatch: expected='{profile.remote_id}', "
                f"received='{option82.get('remote_id')}'"
            )

        # Determine if validation passed
        valid = len(mismatches) == 0

        # Phase 3: Audit logging
        log_data = {
            "subscriber_id": subscriber_id,
            "tenant_id": self.tenant_id,
            "policy": policy,
            "valid": valid,
            "circuit_id_expected": profile.circuit_id,
            "circuit_id_received": option82.get("circuit_id"),
            "remote_id_expected": profile.remote_id,
            "remote_id_received": option82.get("remote_id"),
            "mismatches": mismatches,
        }

        if not valid:
            if policy.lower() == "enforce":
                logger.warning(
                    "radius.option82.mismatch_rejected",
                    **log_data,
                )
            else:  # log policy
                logger.info(
                    "radius.option82.mismatch_logged",
                    **log_data,
                )
        else:
            logger.debug(
                "radius.option82.match",
                **log_data,
            )

        return {
            "valid": valid,
            "policy": policy,
            "mismatches": mismatches,
            "circuit_id_received": option82.get("circuit_id"),
            "circuit_id_expected": profile.circuit_id,
            "remote_id_received": option82.get("remote_id"),
            "remote_id_expected": profile.remote_id,
        }

    async def authorize_subscriber(
        self,
        request: "RADIUSAuthorizationRequest",
    ) -> "RADIUSAuthorizationResponse":
        """
        Authorize RADIUS Access-Request with Option 82 validation (Phase 3).

        This method performs complete RADIUS authorization:
        1. Subscriber authentication (username/password)
        2. Option 82 validation (circuit-id, remote-id)
        3. VLAN attribute injection from network profile
        4. Bandwidth profile application
        5. IPv4/IPv6 address assignment

        Args:
            request: RADIUS Access-Request with Option 82 attributes

        Returns:
            Authorization decision (Accept/Reject) with reply attributes
        """
        # Step 1: Check if subscriber exists
        subscriber = await self.get_subscriber(request.username)
        if not subscriber:
            logger.warning(
                "radius.authorization.user_not_found",
                username=request.username,
                tenant_id=self.tenant_id,
            )
            return RADIUSAuthorizationResponse(
                accept=False,
                reason=f"User '{request.username}' not found",
                reply_attributes={},
                option82_validation=None,
            )

        # Step 2: Validate password (if provided)
        if request.password:
            radcheck = await self.repository.get_radcheck_by_username(
                self.tenant_id, request.username
            )
            if not radcheck:
                logger.warning(
                    "radius.authorization.no_radcheck",
                    username=request.username,
                    tenant_id=self.tenant_id,
                )
                return RADIUSAuthorizationResponse(
                    accept=False,
                    reason="Invalid password",
                    reply_attributes={},
                    option82_validation=None,
                )

            # Verify password using proper hash verification
            if not verify_radius_password(request.password, radcheck.value):
                logger.warning(
                    "radius.authorization.invalid_password",
                    username=request.username,
                    tenant_id=self.tenant_id,
                )
                return RADIUSAuthorizationResponse(
                    accept=False,
                    reason="Invalid password",
                    reply_attributes={},
                    option82_validation=None,
                )

        # Step 3: Build Access-Request dict for Option 82 parsing
        access_request = {}
        if request.agent_circuit_id:
            access_request["Agent-Circuit-Id"] = request.agent_circuit_id
        if request.agent_remote_id:
            access_request["Agent-Remote-Id"] = request.agent_remote_id
        if request.alcatel_agent_circuit_id:
            access_request["Alcatel-Lucent-Agent-Circuit-Id"] = request.alcatel_agent_circuit_id
        if request.alcatel_agent_remote_id:
            access_request["Alcatel-Lucent-Agent-Remote-Id"] = request.alcatel_agent_remote_id

        # Step 4: Validate Option 82
        if not subscriber.subscriber_id:
            # No subscriber_id means no network profile, skip Option 82 validation
            option82_result = {
                "valid": True,
                "policy": "ignore",
                "mismatches": [],
                "circuit_id_received": None,
                "circuit_id_expected": None,
                "remote_id_received": None,
                "remote_id_expected": None,
            }
        else:
            option82_result = await self.validate_option82(
                subscriber_id=subscriber.subscriber_id,
                access_request=access_request,
            )

        # Step 5: Enforce Option 82 policy
        if not option82_result["valid"] and option82_result["policy"].lower() == "enforce":
            logger.warning(
                "radius.authorization.option82_rejected",
                username=request.username,
                tenant_id=self.tenant_id,
                option82_validation=option82_result,
            )
            return RADIUSAuthorizationResponse(
                accept=False,
                reason=f"Option 82 validation failed: {', '.join(option82_result['mismatches'])}",
                reply_attributes={},
                option82_validation=option82_result,
            )

        # Step 6: Get reply attributes from database
        radreplies = await self.repository.get_radreplies_by_username(
            self.tenant_id, request.username
        )
        reply_attributes = {reply.attribute: reply.value for reply in radreplies}

        # Step 7: Authorization successful
        logger.info(
            "radius.authorization.success",
            username=request.username,
            tenant_id=self.tenant_id,
            option82_valid=option82_result["valid"],
            option82_policy=option82_result["policy"],
            reply_attributes_count=len(reply_attributes),
        )

        return RADIUSAuthorizationResponse(
            accept=True,
            reason="Access granted",
            reply_attributes=reply_attributes,
            option82_validation=option82_result,
        )

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
        try:
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
            response = self._nas_to_response(nas)
            if data.server_ip:
                response.server_ip = data.server_ip
            return response
        except Exception:
            now = datetime.now(UTC)
            nas_id = self._nas_counter
            self._nas_counter += 1
            entry = {
                "id": nas_id,
                "tenant_id": self.tenant_id,
                "nasname": data.nasname,
                "shortname": data.shortname,
                "type": data.type,
                "secret_configured": bool(data.secret),
                "ports": data.ports,
                "community": data.community,
                "description": data.description,
                "server_ip": data.server_ip or data.nasname,
                "created_at": now,
                "updated_at": now,
                "secret": data.secret,
            }
            self._nas_store[nas_id] = entry
            return self._nas_to_response(entry)

    async def get_nas(self, nas_id: int) -> NASResponse | None:
        """Get NAS device by ID"""
        nas = await self.repository.get_nas_by_id(self.tenant_id, nas_id)
        if not nas:
            entry = self._nas_store.get(nas_id)
            if entry:
                return self._nas_to_response(entry)
            return None

        return self._nas_to_response(nas)

    async def update_nas(self, nas_id: int, data: NASUpdate) -> NASResponse | None:
        """Update NAS device"""
        nas = await self.repository.get_nas_by_id(self.tenant_id, nas_id)
        if not nas:
            entry = self._nas_store.get(nas_id)
            if not entry:
                return None
            updates = data.model_dump(exclude_unset=True)
            if "secret" in updates:
                entry["secret_configured"] = bool(updates["secret"])
                entry["secret"] = updates["secret"]
            entry.update({k: v for k, v in updates.items() if v is not None})
            entry["updated_at"] = datetime.now(UTC)
            self._nas_store[nas_id] = entry
            return self._nas_to_response(entry)

        updates = data.model_dump(exclude_unset=True)
        nas = await self.repository.update_nas(nas, **updates)
        await self.session.commit()

        return await self.get_nas(nas_id)

    async def delete_nas(self, nas_id: int) -> bool:
        """Delete NAS device"""
        deleted = await self.repository.delete_nas(self.tenant_id, nas_id)
        await self.session.commit()
        if not deleted:
            return self._nas_store.pop(nas_id, None) is not None
        return True

    async def list_nas_devices(self, skip: int = 0, limit: int = 100) -> list[NASResponse]:
        """List NAS devices"""
        nas_devices = await self.repository.list_nas_devices(self.tenant_id, skip, limit)
        if nas_devices:
            return [self._nas_to_response(nas) for nas in nas_devices]

        # Fallback to in-memory store
        entries = list(self._nas_store.values())[skip : skip + limit]
        return [self._nas_to_response(entry) for entry in entries]

    async def list_nas(self, skip: int = 0, limit: int = 100) -> list[NASResponse]:
        """Alias wrapper for listing NAS devices."""
        return await self.list_nas_devices(skip=skip, limit=limit)

    def _nas_to_response(self, nas: Any) -> NASResponse:
        """Convert NAS ORM object to response without leaking secrets."""
        if isinstance(nas, dict):
            return NASResponse(
                id=nas["id"],
                tenant_id=nas["tenant_id"],
                nasname=nas["nasname"],
                shortname=nas["shortname"],
                type=nas["type"],
                secret_configured=nas.get("secret_configured", False),
                secret=nas.get("secret"),
                ports=nas.get("ports"),
                community=nas.get("community"),
                description=nas.get("description"),
                server_ip=nas.get("server_ip") or nas.get("nasname"),
                created_at=nas.get("created_at", datetime.now(UTC)),
                updated_at=nas.get("updated_at", datetime.now(UTC)),
            )

        return NASResponse(
            id=nas.id,
            tenant_id=nas.tenant_id,
            nasname=nas.nasname,
            shortname=nas.shortname,
            type=nas.type,
            secret_configured=bool(getattr(nas, "secret", None)),
            secret=getattr(nas, "secret", None),
            ports=nas.ports,
            community=nas.community,
            description=nas.description,
            server_ip=getattr(nas, "server_ip", None) or nas.nasname,
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

"""Service layer for Subscriber management."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.subscriptions.models import SubscriptionCreateRequest
from dotmac.platform.billing.subscriptions.service import SubscriptionService
from dotmac.platform.radius.schemas import RADIUSSubscriberCreate, RADIUSSubscriberUpdate
from dotmac.platform.radius.service import RADIUSService
from dotmac.platform.subscribers.models import (
    PasswordHashingMethod,
    Subscriber,
    SubscriberStatus,
    generate_random_password,
)
from dotmac.platform.subscribers.schemas import (
    SubscriberCreate,
    SubscriberListResponse,
    SubscriberResponse,
    SubscriberUpdate,
)

logger = structlog.get_logger(__name__)


class SubscriberService:
    """Business logic for subscribers."""

    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------
    def _base_query(self):
        return select(Subscriber).where(
            Subscriber.tenant_id == self.tenant_id, Subscriber.deleted_at.is_(None)
        )

    async def list_subscribers(
        self, *, limit: int = 50, offset: int = 0, status: SubscriberStatus | None = None
    ) -> SubscriberListResponse:
        query = self._base_query().order_by(Subscriber.created_at.desc())
        if status:
            query = query.where(Subscriber.status == status)

        total_stmt = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(total_stmt)
        total = total_result.scalar_one()

        result = await self.db.execute(query.limit(limit).offset(offset))
        items = result.scalars().all()
        return SubscriberListResponse(
            items=[self._to_response(sub) for sub in items],
            total=total,
        )

    async def get_subscriber(self, subscriber_id: str) -> SubscriberResponse | None:
        result = await self.db.execute(
            self._base_query().where(Subscriber.id == subscriber_id).limit(1)
        )
        sub = result.scalar_one_or_none()
        if not sub:
            return None
        return self._to_response(sub)

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------
    async def create_subscriber(self, data: SubscriberCreate) -> SubscriberResponse:
        plain_password = data.password or generate_random_password(16)
        username = data.username or f"sub-{generate_random_password(8).lower()}"

        subscriber = Subscriber(
            tenant_id=self.tenant_id,
            customer_id=data.customer_id,
            user_id=data.user_id,
            username=username,
            subscriber_number=data.subscriber_number or "",
            full_name=data.full_name,
            email=data.email,
            phone_number=data.phone_number,
            status=data.status or SubscriberStatus.PENDING,
            service_type=data.service_type or Subscriber.service_type.default.arg,
            bandwidth_profile_id=data.bandwidth_profile_id,
            download_speed_kbps=data.download_speed_kbps,
            upload_speed_kbps=data.upload_speed_kbps,
            static_ipv4=data.static_ipv4,
            ipv6_prefix=data.ipv6_prefix,
            vlan_id=data.vlan_id,
            nas_identifier=data.nas_identifier,
            onu_serial=data.onu_serial,
            cpe_mac_address=data.cpe_mac_address,
            service_address=data.service_address,
            service_coordinates=data.service_coordinates or {},
            site_id=data.site_id,
            activation_date=data.activation_date,
            session_timeout=data.session_timeout,
            idle_timeout=data.idle_timeout,
            simultaneous_use=data.simultaneous_use or 1,
            metadata_=data.metadata or {},
        )
        subscriber.set_password(
            plain_password, method=PasswordHashingMethod.SHA256, auto_hash=True
        )

        self.db.add(subscriber)
        await self.db.flush()

        # Create RADIUS credentials
        radius_service = RADIUSService(self.db, tenant_id=self.tenant_id)
        await radius_service.create_subscriber(
            RADIUSSubscriberCreate(
                subscriber_id=subscriber.id,
                username=subscriber.username,
                password=plain_password,
                bandwidth_profile_id=data.bandwidth_profile_id,
                framed_ipv4_address=data.static_ipv4,
                delegated_ipv6_prefix=data.ipv6_prefix,
                session_timeout=data.session_timeout,
                idle_timeout=data.idle_timeout,
            )
        )

        # Create billing subscription if plan provided
        subscription_id: str | None = None
        if data.plan_id:
            if not data.customer_id:
                raise ValueError("customer_id is required when plan_id is provided")
            subscription_service = SubscriptionService(self.db)
            subscription = await subscription_service.create_subscription(
                SubscriptionCreateRequest(
                    customer_id=str(data.customer_id),
                    plan_id=data.plan_id,
                    metadata={
                        "subscriber_id": subscriber.id,
                        "service_type": str(subscriber.service_type.value),
                    },
                ),
                tenant_id=self.tenant_id,
            )
            subscription_id = subscription.id  # type: ignore[attr-defined]
            subscriber.metadata_["subscription_id"] = subscription_id

        await self.db.commit()
        await self.db.refresh(subscriber)

        return self._to_response(subscriber, subscription_id=subscription_id)

    async def update_subscriber(
        self, subscriber_id: str, data: SubscriberUpdate
    ) -> SubscriberResponse | None:
        result = await self.db.execute(
            self._base_query().where(Subscriber.id == subscriber_id).limit(1)
        )
        subscriber = result.scalar_one_or_none()
        if not subscriber:
            return None

        plain_password: str | None = None

        # Update basic fields
        for field, value in data.model_dump(exclude_none=True).items():
            if field in {"password", "plan_id", "metadata"}:
                continue
            if hasattr(subscriber, field):
                setattr(subscriber, field, value)

        if data.password:
            plain_password = data.password
            subscriber.set_password(
                plain_password, method=PasswordHashingMethod.SHA256, auto_hash=True
            )

        if data.metadata is not None:
            subscriber.metadata_ = data.metadata

        # Update billing subscription if requested
        subscription_id = subscriber.metadata_.get("subscription_id")
        if data.plan_id:
            if not subscriber.customer_id:
                raise ValueError("customer_id is required when plan_id is provided")
            subscription_service = SubscriptionService(self.db)
            subscription = await subscription_service.create_subscription(
                SubscriptionCreateRequest(
                    customer_id=str(subscriber.customer_id),
                    plan_id=data.plan_id,
                    metadata={"subscriber_id": subscriber.id},
                ),
                tenant_id=self.tenant_id,
            )
            subscription_id = subscription.id  # type: ignore[attr-defined]
            subscriber.metadata_["subscription_id"] = subscription_id

        await self.db.flush()

        # Sync RADIUS changes
        radius_update = RADIUSSubscriberUpdate(
            password=plain_password,
            bandwidth_profile_id=subscriber.bandwidth_profile_id,
            framed_ipv4_address=subscriber.static_ipv4,
            delegated_ipv6_prefix=subscriber.ipv6_prefix,
            session_timeout=subscriber.session_timeout,
            idle_timeout=subscriber.idle_timeout,
        )
        radius_service = RADIUSService(self.db, tenant_id=self.tenant_id)
        await radius_service.update_subscriber(
            username=subscriber.username,
            data=radius_update,
            subscriber_id=subscriber_id,
        )

        await self.db.commit()
        await self.db.refresh(subscriber)

        return self._to_response(subscriber, subscription_id=subscription_id)

    async def delete_subscriber(self, subscriber_id: str) -> bool:
        result = await self.db.execute(
            self._base_query().where(Subscriber.id == subscriber_id).limit(1)
        )
        subscriber = result.scalar_one_or_none()
        if not subscriber:
            return False

        subscriber.soft_delete()
        await self.db.flush()

        radius_service = RADIUSService(self.db, tenant_id=self.tenant_id)
        try:
            await radius_service.delete_subscriber(subscriber_id=subscriber_id)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to delete RADIUS subscriber", subscriber_id=subscriber_id, exc=exc)

        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _to_response(
        self, subscriber: Subscriber, *, subscription_id: str | None = None
    ) -> SubscriberResponse:
        sub_id = subscription_id or subscriber.metadata_.get("subscription_id")
        return SubscriberResponse(
            id=subscriber.id,
            tenant_id=subscriber.tenant_id,
            customer_id=subscriber.customer_id,
            user_id=subscriber.user_id,
            username=subscriber.username,
            subscriber_number=subscriber.subscriber_number or None,
            full_name=subscriber.full_name,
            email=subscriber.email,
            phone_number=subscriber.phone_number,
            status=subscriber.status,
            service_type=subscriber.service_type,
            bandwidth_profile_id=subscriber.bandwidth_profile_id,
            download_speed_kbps=subscriber.download_speed_kbps,
            upload_speed_kbps=subscriber.upload_speed_kbps,
            static_ipv4=subscriber.static_ipv4,
            ipv6_prefix=subscriber.ipv6_prefix,
            vlan_id=subscriber.vlan_id,
            nas_identifier=subscriber.nas_identifier,
            onu_serial=subscriber.onu_serial,
            cpe_mac_address=subscriber.cpe_mac_address,
            service_address=subscriber.service_address,
            service_coordinates=subscriber.service_coordinates or {},
            site_id=subscriber.site_id,
            activation_date=subscriber.activation_date,
            session_timeout=subscriber.session_timeout,
            idle_timeout=subscriber.idle_timeout,
            simultaneous_use=subscriber.simultaneous_use,
            metadata=subscriber.metadata_ or {},
            subscription_id=sub_id,
            created_at=subscriber.created_at,
            updated_at=subscriber.updated_at,
        )


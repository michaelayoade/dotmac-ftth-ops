"""
GraphQL queries for Customer Management.

Provides efficient customer queries with batched loading of activities and notes.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any
from uuid import UUID

import strawberry

if TYPE_CHECKING:
    type JSONScalar = Any
else:
    from strawberry.scalars import JSON as JSONScalar
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import InvoiceEntity
from dotmac.platform.billing.models import BillingSubscriptionTable
from dotmac.platform.customer_management.models import (
    Customer as CustomerModel,
)
from dotmac.platform.customer_management.models import (
    CustomerStatus,
)
from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.customer import (
    Customer,
    CustomerActivity,
    CustomerConnection,
    CustomerNote,
    CustomerOverviewMetrics,
    CustomerStatusEnum,
)
from dotmac.platform.graphql.types.subscription import Subscription
from dotmac.platform.subscribers.models import Subscriber
from dotmac.platform.ticketing.models import Ticket as TicketModel
from dotmac.platform.ticketing.models import TicketStatus
from dotmac.platform.wireless.models import WirelessClient

logger = structlog.get_logger(__name__)


@strawberry.type
class CustomerQueries:
    """GraphQL queries for customer management."""

    @staticmethod
    async def _get_customer_uuid_for_tenant(
        db: AsyncSession,
        tenant_id: str,
        customer_id: strawberry.ID,
    ) -> UUID | None:
        """
        Validate that the customer belongs to the active tenant and return UUID.

        Returns:
            Customer UUID if accessible for tenant; otherwise None.
        """
        try:
            customer_uuid = UUID(str(customer_id))
        except ValueError:
            logger.warning("customer.graphql.invalid_customer_id", customer_id=str(customer_id))
            return None

        stmt = (
            select(CustomerModel.id)
            .where(
                CustomerModel.id == customer_uuid,
                CustomerModel.tenant_id == tenant_id,
                CustomerModel.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        if result.scalar_one_or_none() is None:
            logger.warning(
                "customer.graphql.customer_not_in_tenant",
                customer_id=str(customer_uuid),
                tenant_id=tenant_id,
            )
            return None
        return customer_uuid

    @strawberry.field(description="Get customer by ID with activities and notes")  # type: ignore[misc]
    async def customer(
        self,
        info: strawberry.Info[Context],
        id: strawberry.ID,
        include_activities: bool = True,
        include_notes: bool = True,
    ) -> Customer | None:
        """
        Fetch a single customer by ID.

        Args:
            id: Customer UUID
            include_activities: Whether to load activities (default: True)
            include_notes: Whether to load notes (default: True)

        Returns:
            Customer with batched activities and notes, or None if not found
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        customer_uuid = await self._get_customer_uuid_for_tenant(db, tenant_id, id)
        if customer_uuid is None:
            return None

        # Fetch customer within tenant scope
        stmt = select(CustomerModel).where(
            CustomerModel.id == customer_uuid,
            CustomerModel.tenant_id == tenant_id,
        )
        result = await db.execute(stmt)
        customer_model = result.scalar_one_or_none()

        if not customer_model:
            return None

        # Convert to GraphQL type
        customer = Customer.from_model(customer_model)

        # Batch load activities if requested
        if include_activities:
            activity_loader = info.context.loaders.get_customer_activity_loader()
            activities_list = await activity_loader.load_many([str(customer_model.id)])
            if activities_list and activities_list[0]:
                customer.activities = [CustomerActivity.from_model(a) for a in activities_list[0]]

        # Batch load notes if requested
        if include_notes:
            note_loader = info.context.loaders.get_customer_note_loader()
            notes_list = await note_loader.load_many([str(customer_model.id)])
            if notes_list and notes_list[0]:
                customer.notes = [CustomerNote.from_model(n) for n in notes_list[0]]

        return customer

    @strawberry.field(description="Get list of customers with optional filters")  # type: ignore[misc]
    async def customers(
        self,
        info: strawberry.Info[Context],
        limit: int = 50,
        offset: int = 0,
        status: CustomerStatusEnum | None = None,
        search: str | None = None,
        include_activities: bool = False,
        include_notes: bool = False,
    ) -> CustomerConnection:
        """
        Fetch a list of customers with optional filtering.

        Args:
            limit: Maximum number of customers to return (default: 50)
            offset: Number of customers to skip (default: 0)
            status: Filter by customer status
            search: Search by name, email, or customer number
            include_activities: Whether to load activities (default: False for list view)
            include_notes: Whether to load notes (default: False for list view)

        Returns:
            CustomerConnection with customers and pagination info
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        # Build base query
        stmt = select(CustomerModel).where(
            CustomerModel.deleted_at.is_(None),
            CustomerModel.tenant_id == tenant_id,
        )

        # Apply filters
        if status:
            db_status = CustomerStatus(status.value)
            stmt = stmt.where(CustomerModel.status == db_status)

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                (CustomerModel.first_name.ilike(search_term))
                | (CustomerModel.last_name.ilike(search_term))
                | (CustomerModel.email.ilike(search_term))
                | (CustomerModel.customer_number.ilike(search_term))
                | (CustomerModel.company_name.ilike(search_term))
            )

        # Get total count for pagination
        count_stmt = select(func.count()).select_from(stmt.subquery())
        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar() or 0

        # Apply pagination and ordering
        stmt = stmt.order_by(CustomerModel.created_at.desc()).limit(limit).offset(offset)

        # Execute query
        result = await db.execute(stmt)
        customer_models = result.scalars().all()

        # Convert to GraphQL types
        customers = [Customer.from_model(c) for c in customer_models]

        # Batch load activities if requested
        if include_activities and customers:
            customer_ids = [str(c.id) for c in customer_models]
            activity_loader = info.context.loaders.get_customer_activity_loader()
            all_activities = await activity_loader.load_many(customer_ids)

            for customer, activities in zip(customers, all_activities, strict=False):
                if activities:
                    customer.activities = [CustomerActivity.from_model(a) for a in activities]

        # Batch load notes if requested
        if include_notes and customers:
            customer_ids = [str(c.id) for c in customer_models]
            note_loader = info.context.loaders.get_customer_note_loader()
            all_notes = await note_loader.load_many(customer_ids)

            for customer, notes in zip(customers, all_notes, strict=False):
                if notes:
                    customer.notes = [CustomerNote.from_model(n) for n in notes]

        return CustomerConnection(
            customers=customers,
            total_count=total_count,
            has_next_page=(offset + limit) < total_count,
        )

    @strawberry.field(description="Get customer overview metrics")  # type: ignore[misc]
    async def customer_metrics(self, info: strawberry.Info[Context]) -> CustomerOverviewMetrics:
        """
        Get aggregated customer metrics.

        Returns:
            CustomerOverviewMetrics with counts and lifetime value totals
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        # Get counts by status
        count_stmt = (
            select(
                func.count().label("total"),
                func.count().filter(CustomerModel.status == CustomerStatus.ACTIVE).label("active"),
                func.count()
                .filter(CustomerModel.status == CustomerStatus.PROSPECT)
                .label("prospect"),
                func.count()
                .filter(CustomerModel.status == CustomerStatus.CHURNED)
                .label("churned"),
                func.sum(CustomerModel.lifetime_value).label("total_ltv"),
            )
            .select_from(CustomerModel)
            .where(
                CustomerModel.deleted_at.is_(None),
                CustomerModel.tenant_id == tenant_id,
            )
        )

        result = await db.execute(count_stmt)
        row = result.one()

        total_customers = row.total or 0
        total_ltv = row.total_ltv or Decimal("0.00")
        avg_ltv = total_ltv / total_customers if total_customers > 0 else Decimal("0.00")

        return CustomerOverviewMetrics(
            total_customers=total_customers,
            active_customers=row.active or 0,
            prospect_customers=row.prospect or 0,
            churned_customers=row.churned or 0,
            total_lifetime_value=total_ltv,
            average_lifetime_value=avg_ltv,
        )

    @strawberry.field(description="Get customer subscriptions")  # type: ignore[misc]
    async def customer_subscriptions(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
        status: str | None = None,
        limit: int = 50,
    ) -> list[Subscription]:
        """
        Fetch all subscriptions for a customer.

        Args:
            customer_id: Customer UUID
            status: Filter by subscription status (optional)
            limit: Maximum number of subscriptions to return (default: 50)

        Returns:
            List of customer subscriptions
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        customer_uuid = await self._get_customer_uuid_for_tenant(db, tenant_id, customer_id)
        if customer_uuid is None:
            return []

        limit = max(1, min(limit, 100))

        stmt = (
            select(BillingSubscriptionTable)
            .where(
                BillingSubscriptionTable.customer_id == str(customer_uuid),
                BillingSubscriptionTable.tenant_id == tenant_id,
            )
            .order_by(BillingSubscriptionTable.created_at.desc())
            .limit(limit)
        )

        if status:
            stmt = stmt.where(BillingSubscriptionTable.status == status)

        # Execute query
        result = await db.execute(stmt)
        subscription_models = result.scalars().all()

        # Convert to GraphQL types
        return [Subscription.from_model(sub) for sub in subscription_models]

    @strawberry.field(description="Get customer network information")  # type: ignore[misc]
    async def customer_network_info(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
    ) -> JSONScalar:
        """
        Fetch network connection and service information for a customer.

        Args:
            customer_id: Customer UUID

        Returns:
            Network information including connection status, IP addresses, and service details
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        customer_uuid = await self._get_customer_uuid_for_tenant(db, tenant_id, customer_id)
        if customer_uuid is None:
            return {}

        stmt = (
            select(Subscriber)
            .where(
                Subscriber.customer_id == customer_uuid,
                Subscriber.tenant_id == tenant_id,
                Subscriber.deleted_at.is_(None),
            )
            .order_by(Subscriber.created_at.desc())
        )
        result = await db.execute(stmt)
        subscribers = result.scalars().all()

        network_info: dict[str, Any] = {
            "customer_id": str(customer_uuid),
            "services": [],
            "total_services": len(subscribers),
        }

        for subscriber in subscribers:
            download_mbps = (
                subscriber.download_speed_kbps / 1000 if subscriber.download_speed_kbps else None
            )
            service_data = {
                "service_id": subscriber.id,
                "subscriber_id": subscriber.id,
                "service_type": (
                    subscriber.service_type.value
                    if hasattr(subscriber.service_type, "value")
                    else subscriber.service_type
                ),
                "status": (
                    subscriber.status.value
                    if hasattr(subscriber.status, "value")
                    else subscriber.status
                ),
                "username": subscriber.username,
                "ipv4_address": subscriber.static_ipv4,
                "ipv6_address": subscriber.ipv6_prefix,
                "bandwidth_mbps": download_mbps,
                "download_speed_kbps": subscriber.download_speed_kbps,
                "upload_speed_kbps": subscriber.upload_speed_kbps,
                "vlan_id": subscriber.vlan_id,
                "nas_identifier": subscriber.nas_identifier,
                "onu_serial": subscriber.onu_serial,
                "cpe_mac_address": subscriber.cpe_mac_address,
                "service_address": subscriber.service_address,
                "site_id": subscriber.site_id,
                "device_metadata": subscriber.device_metadata,
                "created_at": (
                    subscriber.created_at.isoformat() if subscriber.created_at else None
                ),
                "updated_at": (
                    subscriber.updated_at.isoformat() if subscriber.updated_at else None
                ),
            }
            network_info["services"].append(service_data)

        return network_info

    @strawberry.field(description="Get customer devices")  # type: ignore[misc]
    async def customer_devices(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
        device_type: str | None = None,
        active_only: bool = True,
    ) -> JSONScalar:
        """
        Fetch devices associated with a customer.

        Args:
            customer_id: Customer UUID
            device_type: Filter by device type (optional)
            active_only: Only return active devices (default: True)

        Returns:
            List of customer devices (ONTs, routers, CPE, etc.)
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        customer_uuid = await self._get_customer_uuid_for_tenant(db, tenant_id, customer_id)
        if customer_uuid is None:
            return {"devices": [], "total_count": 0}

        stmt = (
            select(WirelessClient)
            .where(
                WirelessClient.customer_id == customer_uuid,
                WirelessClient.tenant_id == tenant_id,
            )
            .order_by(WirelessClient.last_seen.desc())
        )

        if active_only:
            stmt = stmt.where(WirelessClient.connected.is_(True))

        if device_type:
            device_type_value = str(device_type).lower()
            stmt = stmt.where(func.lower(WirelessClient.device_type) == device_type_value)

        result = await db.execute(stmt)
        devices = result.scalars().all()

        device_entries = []
        for device in devices:
            device_entries.append(
                {
                    "device_id": str(device.id),
                    "device_type": device.device_type,
                    "device_name": device.hostname or device.extra_metadata.get("device_name"),
                    "mac_address": device.mac_address,
                    "ip_address": device.ip_address,
                    "hostname": device.hostname,
                    "status": "connected" if device.connected else "disconnected",
                    "connected": device.connected,
                    "last_seen_at": device.last_seen.isoformat() if device.last_seen else None,
                    "first_seen_at": device.first_seen.isoformat() if device.first_seen else None,
                    "tx_rate_mbps": device.tx_rate_mbps,
                    "rx_rate_mbps": device.rx_rate_mbps,
                    "vendor": device.vendor,
                    "extra_metadata": device.extra_metadata,
                    "created_at": device.created_at.isoformat() if device.created_at else None,
                    "updated_at": device.updated_at.isoformat() if device.updated_at else None,
                }
            )

        return {"devices": device_entries, "total_count": len(device_entries)}

    @strawberry.field(description="Get customer tickets")  # type: ignore[misc]
    async def customer_tickets(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
        status: str | None = None,
        limit: int = 50,
    ) -> JSONScalar:
        """
        Fetch support tickets for a customer.

        Args:
            customer_id: Customer UUID
            status: Filter by ticket status (optional)
            limit: Maximum number of tickets to return (default: 50)

        Returns:
            List of customer tickets
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        customer_uuid = await self._get_customer_uuid_for_tenant(db, tenant_id, customer_id)
        if customer_uuid is None:
            return {"tickets": [], "total_count": 0}

        stmt = (
            select(TicketModel)
            .where(
                TicketModel.customer_id == customer_uuid,
                TicketModel.tenant_id == tenant_id,
            )
            .order_by(TicketModel.created_at.desc())
            .limit(max(1, min(limit, 100)))
        )

        if status:
            try:
                status_enum = TicketStatus(status)
            except ValueError:
                logger.warning(
                    "customer.graphql.invalid_ticket_status",
                    status=status,
                    tenant_id=tenant_id,
                )
                return {"tickets": [], "total_count": 0}
            stmt = stmt.where(TicketModel.status == status_enum)

        result = await db.execute(stmt)
        tickets = result.scalars().all()

        ticket_entries = []
        for ticket in tickets:
            ticket_entries.append(
                {
                    "id": str(ticket.id),
                    "ticket_number": ticket.ticket_number,
                    "subject": ticket.subject,
                    "status": (
                        ticket.status.value if hasattr(ticket.status, "value") else ticket.status
                    ),
                    "priority": (
                        ticket.priority.value
                        if hasattr(ticket.priority, "value")
                        else ticket.priority
                    ),
                    "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
                    "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
                    "assigned_to_user_id": (
                        str(ticket.assigned_to_user_id) if ticket.assigned_to_user_id else None
                    ),
                }
            )

        return {"tickets": ticket_entries, "total_count": len(ticket_entries)}

    @strawberry.field(description="Get customer billing information")  # type: ignore[misc]
    async def customer_billing(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
        include_invoices: bool = True,
        invoice_limit: int = 10,
    ) -> JSONScalar:
        """
        Fetch billing information for a customer.

        Args:
            customer_id: Customer UUID
            include_invoices: Include recent invoices (default: True)
            invoice_limit: Maximum number of invoices to include (default: 10)

        Returns:
            Billing information including balance, invoices, and payment methods
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        customer_uuid = await self._get_customer_uuid_for_tenant(db, tenant_id, customer_id)
        if customer_uuid is None:
            return {}

        billing_info: dict[str, Any] = {
            "customer_id": str(customer_uuid),
            "outstanding_balance": "0.00",
            "overdue_balance": "0.00",
            "currency": "USD",
            "invoices": [],
        }

        ZERO = Decimal("0.00")

        def cents_to_decimal(value: int | None) -> Decimal:
            if value is None:
                return ZERO
            return (Decimal(value) / Decimal("100")).quantize(Decimal("0.01"))

        if include_invoices:
            stmt = (
                select(InvoiceEntity)
                .where(
                    InvoiceEntity.customer_id == str(customer_uuid),
                    InvoiceEntity.tenant_id == tenant_id,
                )
                .order_by(InvoiceEntity.created_at.desc())
                .limit(max(1, min(invoice_limit, 50)))
            )
            result = await db.execute(stmt)
            invoices = result.scalars().all()

            if invoices:
                billing_info["currency"] = invoices[0].currency

            invoice_entries = []
            total_outstanding = ZERO
            total_overdue = ZERO
            now = datetime.now(UTC)

            for invoice in invoices:
                remaining_decimal = cents_to_decimal(invoice.remaining_balance)
                total_amount_decimal = cents_to_decimal(invoice.total_amount)

                invoice_entries.append(
                    {
                        "invoice_id": invoice.invoice_id,
                        "invoice_number": invoice.invoice_number,
                        "amount": str(total_amount_decimal),
                        "remaining_balance": str(remaining_decimal),
                        "status": (
                            invoice.status.value
                            if hasattr(invoice.status, "value")
                            else invoice.status
                        ),
                        "payment_status": (
                            invoice.payment_status.value
                            if hasattr(invoice.payment_status, "value")
                            else invoice.payment_status
                        ),
                        "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                        "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
                        "created_at": (
                            invoice.created_at.isoformat() if invoice.created_at else None
                        ),
                    }
                )

                total_outstanding += remaining_decimal
                if invoice.due_date and now > invoice.due_date and remaining_decimal > ZERO:
                    total_overdue += remaining_decimal

            billing_info["invoices"] = invoice_entries
            billing_info["outstanding_balance"] = str(total_outstanding.quantize(Decimal("0.01")))
            billing_info["overdue_balance"] = str(total_overdue.quantize(Decimal("0.01")))

        return billing_info

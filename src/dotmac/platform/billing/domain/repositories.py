"""
Domain Repositories for Billing Aggregates.

Repositories handle aggregate persistence and event publishing,
providing a clean abstraction over database operations.
"""

from __future__ import annotations

from typing import Protocol

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    PaymentEntity,
)
from dotmac.platform.billing.core.exceptions import (
    InvoiceNotFoundError,
    PaymentNotFoundError,
)
from dotmac.platform.core import get_domain_event_dispatcher
from dotmac.platform.customer_management.models import Customer as CustomerEntity

from .aggregates import Customer, Invoice, Payment
from .mappers import CustomerMapper, InvoiceMapper, PaymentMapper

logger = structlog.get_logger(__name__)


# ============================================================================
# Repository Protocols
# ============================================================================


class InvoiceRepository(Protocol):
    """Protocol for invoice aggregate repository."""

    async def get(self, invoice_id: str, tenant_id: str) -> Invoice:
        """Get invoice aggregate by ID."""
        ...

    async def save(self, invoice: Invoice) -> None:
        """Save invoice aggregate and publish domain events."""
        ...

    async def delete(self, invoice_id: str, tenant_id: str) -> None:
        """Delete invoice aggregate."""
        ...


class PaymentRepository(Protocol):
    """Protocol for payment aggregate repository."""

    async def get(self, payment_id: str, tenant_id: str) -> Payment:
        """Get payment aggregate by ID."""
        ...

    async def save(self, payment: Payment) -> None:
        """Save payment aggregate and publish domain events."""
        ...


class CustomerRepository(Protocol):
    """Protocol for customer aggregate repository."""

    async def get(self, customer_id: str, tenant_id: str) -> Customer:
        """Get customer aggregate by ID."""
        ...

    async def save(self, customer: Customer) -> None:
        """Save customer aggregate and publish domain events."""
        ...


# ============================================================================
# SQLAlchemy Repository Implementations
# ============================================================================


class SQLAlchemyInvoiceRepository:
    """SQLAlchemy-based repository for Invoice aggregates."""

    def __init__(self, db: AsyncSession) -> None:
        """
        Initialize repository.

        Args:
            db: Database session
        """
        self._db = db
        self._event_dispatcher = get_domain_event_dispatcher()

    async def get(self, invoice_id: str, tenant_id: str) -> Invoice:
        """
        Load invoice aggregate from database.

        Args:
            invoice_id: Invoice identifier
            tenant_id: Tenant identifier for isolation

        Returns:
            Invoice aggregate

        Raises:
            InvoiceNotFoundError: If invoice not found
        """
        stmt = select(InvoiceEntity).where(
            InvoiceEntity.invoice_id == invoice_id,
            InvoiceEntity.tenant_id == tenant_id,
        )
        result = await self._db.execute(stmt)
        entity = result.scalar_one_or_none()

        if not entity:
            logger.warning(
                "Invoice not found",
                invoice_id=invoice_id,
                tenant_id=tenant_id,
            )
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        # Convert entity to aggregate
        aggregate = InvoiceMapper.to_aggregate(entity)

        logger.debug(
            "Invoice loaded from database",
            invoice_id=invoice_id,
            status=aggregate.status,
        )

        return aggregate

    async def save(self, invoice: Invoice) -> None:
        """
        Save invoice aggregate to database and publish domain events.

        Args:
            invoice: Invoice aggregate to save
        """
        # Convert aggregate to entity and merge into session (handles upsert)

        merged_entity = await self._db.merge(InvoiceMapper.to_entity(invoice))
        # Ensure session knows about the merged instance (useful for tests expecting add)
        self._db.add(merged_entity)

        # Flush to ensure constraints are validated
        await self._db.flush()
        # Dispatch domain events
        events = invoice.get_domain_events()
        for event in events:
            await self._event_dispatcher.dispatch(event)

        # Clear events after publishing
        invoice.clear_domain_events()

        logger.info(
            "Invoice saved to database",
            invoice_id=invoice.id,
            status=invoice.status,
            events_published=len(events),
        )

    async def delete(self, invoice_id: str, tenant_id: str) -> None:
        """
        Delete invoice from database.

        Args:
            invoice_id: Invoice identifier
            tenant_id: Tenant identifier
        """
        stmt = select(InvoiceEntity).where(
            InvoiceEntity.invoice_id == invoice_id,
            InvoiceEntity.tenant_id == tenant_id,
        )
        result = await self._db.execute(stmt)
        entity = result.scalar_one_or_none()

        if entity:
            await self._db.delete(entity)
            logger.info("Invoice deleted", invoice_id=invoice_id)


class SQLAlchemyPaymentRepository:
    """SQLAlchemy-based repository for Payment aggregates."""

    def __init__(self, db: AsyncSession) -> None:
        """
        Initialize repository.

        Args:
            db: Database session
        """
        self._db = db
        self._event_dispatcher = get_domain_event_dispatcher()

    async def get(self, payment_id: str, tenant_id: str) -> Payment:
        """
        Load payment aggregate from database.

        Args:
            payment_id: Payment identifier
            tenant_id: Tenant identifier for isolation

        Returns:
            Payment aggregate

        Raises:
            PaymentNotFoundError: If payment not found
        """
        stmt = select(PaymentEntity).where(
            PaymentEntity.payment_id == payment_id,
            PaymentEntity.tenant_id == tenant_id,
        )
        result = await self._db.execute(stmt)
        entity = result.scalar_one_or_none()

        if not entity:
            logger.warning(
                "Payment not found",
                payment_id=payment_id,
                tenant_id=tenant_id,
            )
            raise PaymentNotFoundError(f"Payment {payment_id} not found")

        # Convert entity to aggregate
        aggregate = PaymentMapper.to_aggregate(entity)

        logger.debug(
            "Payment loaded from database",
            payment_id=payment_id,
            status=aggregate.status,
        )

        return aggregate

    async def save(self, payment: Payment) -> None:
        """
        Save payment aggregate to database and publish domain events.

        Args:
            payment: Payment aggregate to save
        """
        merged_entity = await self._db.merge(PaymentMapper.to_entity(payment))
        self._db.add(merged_entity)

        # Flush to ensure constraints are validated
        await self._db.flush()

        # Dispatch domain events
        events = payment.get_domain_events()
        for event in events:
            await self._event_dispatcher.dispatch(event)

        # Clear events after publishing
        payment.clear_domain_events()

        logger.info(
            "Payment saved to database",
            payment_id=payment.id,
            status=payment.status,
            events_published=len(events),
        )


class SQLAlchemyCustomerRepository:
    """SQLAlchemy-based repository for Customer aggregates."""

    def __init__(self, db: AsyncSession) -> None:
        """
        Initialize repository.

        Args:
            db: Database session
        """
        self._db = db
        self._event_dispatcher = get_domain_event_dispatcher()

    async def get(self, customer_id: str, tenant_id: str) -> Customer:
        """
        Load customer aggregate from database.

        Args:
            customer_id: Customer identifier
            tenant_id: Tenant identifier for isolation

        Returns:
            Customer aggregate

        Raises:
            Exception: If customer not found
        """
        stmt = select(CustomerEntity).where(
            CustomerEntity.customer_number == customer_id,
            CustomerEntity.tenant_id == tenant_id,
        )
        result = await self._db.execute(stmt)
        entity = result.scalar_one_or_none()

        if not entity:
            logger.warning(
                "Customer not found",
                customer_id=customer_id,
                tenant_id=tenant_id,
            )
            raise ValueError(f"Customer {customer_id} not found")

        # Convert entity to aggregate
        aggregate = CustomerMapper.to_aggregate(entity)

        logger.debug(
            "Customer loaded from database",
            customer_id=customer_id,
            status=aggregate.status,
        )

        return aggregate

    async def save(self, customer: Customer) -> None:
        """
        Save customer aggregate to database and publish domain events.

        Args:
            customer: Customer aggregate to save
        """
        merged_entity = await self._db.merge(CustomerMapper.to_entity(customer))
        self._db.add(merged_entity)

        # Flush to ensure constraints are validated
        await self._db.flush()

        # Dispatch domain events
        events = customer.get_domain_events()
        for event in events:
            await self._event_dispatcher.dispatch(event)

        # Clear events after publishing
        customer.clear_domain_events()

        logger.info(
            "Customer saved to database",
            customer_id=customer.id,
            status=customer.status,
            events_published=len(events),
        )

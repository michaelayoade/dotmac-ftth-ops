"""
GraphQL queries for Customer Management.

Provides efficient customer queries with batched loading of activities and notes.
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

import strawberry
import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.customer_management.models import (
    Customer as CustomerModel,
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

logger = structlog.get_logger(__name__)


@strawberry.type
class CustomerQueries:
    """GraphQL queries for customer management."""

    @strawberry.field(description="Get customer by ID with activities and notes")  # type: ignore[misc]
    async def customer(
        self,
        info: strawberry.Info[Context],
        id: strawberry.ID,
        include_activities: bool = True,
        include_notes: bool = True,
    ) -> Optional[Customer]:
        """
        Fetch a single customer by ID.

        Args:
            id: Customer UUID
            include_activities: Whether to load activities (default: True)
            include_notes: Whether to load notes (default: True)

        Returns:
            Customer with batched activities and notes, or None if not found
        """
        db: AsyncSession = info.context.db

        # Import here to avoid circular imports
        from dotmac.platform.customer_management.models import Customer as CustomerModel

        try:
            customer_id = UUID(id)
        except ValueError:
            logger.warning(f"Invalid customer ID format: {id}")
            return None

        # Fetch customer
        stmt = select(CustomerModel).where(CustomerModel.id == customer_id)
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
                customer.activities = [
                    CustomerActivity.from_model(a) for a in activities_list[0]
                ]

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
        status: Optional[CustomerStatusEnum] = None,
        search: Optional[str] = None,
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
        db: AsyncSession = info.context.db

        # Build base query
        stmt = select(CustomerModel).where(CustomerModel.deleted_at.is_(None))

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

            for customer, activities in zip(customers, all_activities):
                if activities:
                    customer.activities = [CustomerActivity.from_model(a) for a in activities]

        # Batch load notes if requested
        if include_notes and customers:
            customer_ids = [str(c.id) for c in customer_models]
            note_loader = info.context.loaders.get_customer_note_loader()
            all_notes = await note_loader.load_many(customer_ids)

            for customer, notes in zip(customers, all_notes):
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
        db: AsyncSession = info.context.db

        # Get counts by status
        count_stmt = (
            select(
                func.count().label("total"),
                func.count()
                .filter(CustomerModel.status == CustomerStatus.ACTIVE)
                .label("active"),
                func.count()
                .filter(CustomerModel.status == CustomerStatus.PROSPECT)
                .label("prospect"),
                func.count()
                .filter(CustomerModel.status == CustomerStatus.CHURNED)
                .label("churned"),
                func.sum(CustomerModel.lifetime_value).label("total_ltv"),
            )
            .select_from(CustomerModel)
            .where(CustomerModel.deleted_at.is_(None))
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

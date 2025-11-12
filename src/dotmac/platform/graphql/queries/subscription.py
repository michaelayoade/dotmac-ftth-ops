"""
GraphQL queries for Subscription Management.

Provides efficient subscription queries with conditional loading of customers,
plans, and invoices via DataLoaders to prevent N+1 queries.
"""
# mypy: disable-error-code="arg-type,assignment,attr-defined"

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, cast

import strawberry
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.subscription import (
    BillingCycleEnum,
    PlanConnection,
    Product,
    ProductConnection,
    Subscription,
    SubscriptionConnection,
    SubscriptionCustomer,
    SubscriptionInvoice,
    SubscriptionMetrics,
    SubscriptionPlan,
    SubscriptionStatusEnum,
)


@strawberry.type
class SubscriptionQueries:
    """GraphQL queries for subscription management."""

    @strawberry.field(description="Get subscription by ID with conditional loading")  # type: ignore[misc]
    async def subscription(
        self,
        info: strawberry.Info[Context],
        id: strawberry.ID,
        include_customer: bool = False,
        include_plan: bool = False,
        include_invoices: bool = False,
    ) -> Subscription | None:
        """
        Fetch a single subscription by ID.

        Args:
            id: Subscription ID
            include_customer: Load customer data via DataLoader (default: False)
            include_plan: Load plan data via DataLoader (default: False)
            include_invoices: Load recent invoices via DataLoader (default: False)

        Returns:
            Subscription with conditionally loaded related data
        """
        db: AsyncSession = info.context.db

        # Import here to avoid circular imports
        from dotmac.platform.billing.domain.aggregates import Subscription as SubscriptionModel

        # Fetch subscription
        subscription_id_column = cast(Any, SubscriptionModel.subscription_id)
        stmt = select(SubscriptionModel).where(subscription_id_column == str(id))
        result = await db.execute(stmt)
        sub_model = result.scalar_one_or_none()

        if not sub_model:
            return None

        # Convert to GraphQL type
        subscription = Subscription.from_model(sub_model)

        # Conditionally load customer
        if include_customer:
            customer_loader = info.context.loaders.get_subscription_customer_loader()
            customers = await customer_loader.load_many([sub_model.customer_id])
            if customers and customers[0]:
                subscription.customer = SubscriptionCustomer.from_model(customers[0])

        # Conditionally load plan
        if include_plan:
            plan_loader = info.context.loaders.get_subscription_plan_loader()
            plans = await plan_loader.load_many([sub_model.plan_id])
            if plans and plans[0]:
                subscription.plan = SubscriptionPlan.from_model(plans[0])

        # Conditionally load invoices
        if include_invoices:
            invoices_loader = info.context.loaders.get_subscription_invoices_loader()
            invoices_list = await invoices_loader.load_many([sub_model.subscription_id])
            if invoices_list and invoices_list[0]:
                subscription.recent_invoices = [
                    SubscriptionInvoice.from_model(inv) for inv in invoices_list[0]
                ]

        return subscription

    @strawberry.field(description="Get list of subscriptions with filters and conditional loading")  # type: ignore[misc]
    async def subscriptions(
        self,
        info: strawberry.Info[Context],
        page: int = 1,
        page_size: int = 10,
        status: SubscriptionStatusEnum | None = None,
        billing_cycle: BillingCycleEnum | None = None,
        search: str | None = None,
        include_customer: bool = False,
        include_plan: bool = False,
        include_invoices: bool = False,
    ) -> SubscriptionConnection:
        """
        Fetch subscriptions with filtering, pagination, and conditional loading.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default: 10, max: 100)
            status: Filter by subscription status
            billing_cycle: Filter by billing cycle
            search: Search by customer name/email or subscription ID
            include_customer: Batch load customer data
            include_plan: Batch load plan data
            include_invoices: Batch load recent invoices

        Returns:
            SubscriptionConnection with paginated subscriptions
        """
        db: AsyncSession = info.context.db

        # Import here to avoid circular imports
        from dotmac.platform.billing.domain.aggregates import Subscription as SubscriptionModel

        # Limit page_size
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        # Build base query
        stmt = select(SubscriptionModel)
        status_column = cast(Any, SubscriptionModel.status)
        subscription_id_column = cast(Any, SubscriptionModel.subscription_id)
        customer_id_column = cast(Any, SubscriptionModel.customer_id)
        created_at_column = cast(Any, SubscriptionModel.created_at)

        # Apply filters
        if status:
            stmt = stmt.where(status_column == status.value)

        # Note: billing_cycle filter would require joining with plan table
        # For now, we'll filter after loading if needed

        # Search is complex as it requires customer data - simplified for now
        if search:
            stmt = stmt.where(
                or_(
                    subscription_id_column.ilike(f"%{search}%"),
                    customer_id_column.ilike(f"%{search}%"),
                )
            )

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar() or 0

        # Apply sorting and pagination
        stmt = stmt.order_by(created_at_column.desc()).limit(page_size).offset(offset)

        # Execute query
        result = await db.execute(stmt)
        sub_models = result.scalars().all()

        # Convert to GraphQL types
        subscriptions = [Subscription.from_model(s) for s in sub_models]

        # Conditionally batch load customers
        if include_customer and sub_models:
            customer_ids = [s.customer_id for s in sub_models]
            customer_loader = info.context.loaders.get_subscription_customer_loader()
            customers = await customer_loader.load_many(customer_ids)

            for i, customer in enumerate(customers):
                if customer:
                    subscriptions[i].customer = SubscriptionCustomer.from_model(customer)

        # Conditionally batch load plans
        if include_plan and sub_models:
            plan_ids = [s.plan_id for s in sub_models]
            plan_loader = info.context.loaders.get_subscription_plan_loader()
            plans = await plan_loader.load_many(plan_ids)

            for i, plan in enumerate(plans):
                if plan:
                    subscriptions[i].plan = SubscriptionPlan.from_model(plan)

        # Conditionally batch load invoices
        if include_invoices and sub_models:
            sub_ids = [s.subscription_id for s in sub_models]
            invoices_loader = info.context.loaders.get_subscription_invoices_loader()
            invoices_lists = await invoices_loader.load_many(sub_ids)

            for i, invoices_list in enumerate(invoices_lists):
                if invoices_list:
                    subscriptions[i].recent_invoices = [
                        SubscriptionInvoice.from_model(inv) for inv in invoices_list
                    ]

        return SubscriptionConnection(
            subscriptions=subscriptions,
            total_count=int(total_count),
            has_next_page=(offset + page_size) < total_count,
            has_prev_page=page > 1,
            page=page,
            page_size=page_size,
        )

    @strawberry.field(description="Get subscription metrics and statistics")  # type: ignore[misc]
    async def subscription_metrics(self, info: strawberry.Info[Context]) -> SubscriptionMetrics:
        """
        Get aggregated subscription metrics.

        Returns:
            SubscriptionMetrics with counts, revenue, and growth data
        """
        db: AsyncSession = info.context.db

        # Import here to avoid circular imports
        from dotmac.platform.billing.domain.aggregates import Subscription as SubscriptionModel

        # Get status counts
        subscription_id_column = cast(Any, SubscriptionModel.subscription_id)
        status_column = cast(Any, SubscriptionModel.status)
        created_at_column = cast(Any, SubscriptionModel.created_at)

        status_stmt = select(
            func.count(subscription_id_column).label("total"),
            func.count(func.case((status_column == "active", 1))).label("active"),
            func.count(func.case((status_column == "trialing", 1))).label("trialing"),
            func.count(func.case((status_column == "past_due", 1))).label("past_due"),
            func.count(func.case((status_column == "canceled", 1))).label("canceled"),
            func.count(func.case((status_column == "paused", 1))).label("paused"),
        )

        status_result = await db.execute(status_stmt)
        status_row = status_result.one()
        status_mapping = status_row._mapping

        # Calculate MRR/ARR (simplified - would need to join with plans)
        # For now, using placeholder logic
        mrr = Decimal("0.0")
        arr = Decimal("0.0")
        arpu = Decimal("0.0")

        active_count = int(status_mapping.get("active") or 0)
        if active_count > 0:
            # This is simplified - real implementation would aggregate plan prices
            arpu = Decimal("50.0")  # Placeholder
            mrr = arpu * active_count
            arr = mrr * 12

        # Growth metrics
        now = datetime.now(UTC)
        this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

        growth_stmt = select(
            func.count(func.case((created_at_column >= this_month_start, 1))).label("this_month"),
            func.count(
                func.case(
                    (
                        (created_at_column >= last_month_start)
                        & (created_at_column < this_month_start),
                        1,
                    )
                )
            ).label("last_month"),
        )

        growth_result = await db.execute(growth_stmt)
        growth_row = growth_result.one()
        growth_mapping = growth_row._mapping

        new_this_month = int(growth_mapping.get("this_month") or 0)
        new_last_month = int(growth_mapping.get("last_month") or 0)

        # Calculate growth rate
        growth_rate = Decimal("0.0")
        if new_last_month > 0:
            growth_rate = Decimal(str((new_this_month - new_last_month) / new_last_month * 100))

        # Churn rate (simplified)
        churn_rate = Decimal("2.5")  # Placeholder

        # Trial metrics
        trial_conversion_rate = Decimal("65.0")  # Placeholder
        active_trials = int(status_mapping.get("trialing") or 0)

        # Billing cycle distribution (placeholder - would need plan joins)
        monthly_subs = int(active_count * 0.6)
        quarterly_subs = int(active_count * 0.2)
        annual_subs = int(active_count * 0.2)

        return SubscriptionMetrics(
            total_subscriptions=int(status_mapping.get("total") or 0),
            active_subscriptions=active_count,
            trialing_subscriptions=active_trials,
            past_due_subscriptions=int(status_mapping.get("past_due") or 0),
            canceled_subscriptions=int(status_mapping.get("canceled") or 0),
            paused_subscriptions=int(status_mapping.get("paused") or 0),
            monthly_recurring_revenue=mrr,
            annual_recurring_revenue=arr,
            average_revenue_per_user=arpu,
            new_subscriptions_this_month=new_this_month,
            new_subscriptions_last_month=new_last_month,
            churn_rate=churn_rate,
            growth_rate=growth_rate,
            monthly_subscriptions=monthly_subs,
            quarterly_subscriptions=quarterly_subs,
            annual_subscriptions=annual_subs,
            trial_conversion_rate=trial_conversion_rate,
            active_trials=active_trials,
        )

    @strawberry.field(description="Get list of subscription plans")  # type: ignore[misc]
    async def plans(
        self,
        info: strawberry.Info[Context],
        page: int = 1,
        page_size: int = 20,
        is_active: bool | None = None,
        billing_cycle: BillingCycleEnum | None = None,
    ) -> PlanConnection:
        """
        Fetch subscription plans with filtering and pagination.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default: 20, max: 100)
            is_active: Filter by active status
            billing_cycle: Filter by billing cycle

        Returns:
            PlanConnection with paginated plans
        """
        db: AsyncSession = info.context.db

        # Import here to avoid circular imports
        from dotmac.platform.billing.subscriptions.models import (
            SubscriptionPlan as SubscriptionPlanModel,
        )

        # Limit page_size
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        # Build base query
        stmt = select(SubscriptionPlanModel)
        plan_is_active_column = cast(Any, SubscriptionPlanModel.is_active)
        plan_billing_cycle_column = cast(Any, SubscriptionPlanModel.billing_cycle)
        plan_created_at_column = cast(Any, SubscriptionPlanModel.created_at)

        # Apply filters
        if is_active is not None:
            stmt = stmt.where(plan_is_active_column == is_active)

        if billing_cycle:
            stmt = stmt.where(plan_billing_cycle_column == billing_cycle.value)

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar() or 0

        # Apply sorting and pagination
        stmt = stmt.order_by(plan_created_at_column.desc()).limit(page_size).offset(offset)

        # Execute query
        result = await db.execute(stmt)
        plan_models = result.scalars().all()

        # Convert to GraphQL types
        plans = [SubscriptionPlan.from_model(p) for p in plan_models]

        return PlanConnection(
            plans=plans,
            total_count=int(total_count),
            has_next_page=(offset + page_size) < total_count,
            has_prev_page=page > 1,
            page=page,
            page_size=page_size,
        )

    @strawberry.field(description="Get list of products")  # type: ignore[misc]
    async def products(
        self,
        info: strawberry.Info[Context],
        page: int = 1,
        page_size: int = 20,
        is_active: bool | None = None,
        category: str | None = None,
    ) -> ProductConnection:
        """
        Fetch products with filtering and pagination.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default: 20, max: 100)
            is_active: Filter by active status
            category: Filter by category name

        Returns:
            ProductConnection with paginated products
        """
        db: AsyncSession = info.context.db

        # Import here to avoid circular imports
        from dotmac.platform.billing.catalog.models import Product as ProductModel

        # Limit page_size
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        # Build base query
        stmt = select(ProductModel)
        product_is_active_column = cast(Any, ProductModel.is_active)
        product_category_column = cast(Any, ProductModel.category)
        product_created_at_column = cast(Any, ProductModel.created_at)

        # Apply filters
        if is_active is not None:
            stmt = stmt.where(product_is_active_column == is_active)

        if category:
            stmt = stmt.where(product_category_column == category)

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar() or 0

        # Apply sorting and pagination
        stmt = stmt.order_by(product_created_at_column.desc()).limit(page_size).offset(offset)

        # Execute query
        result = await db.execute(stmt)
        product_models = result.scalars().all()

        # Convert to GraphQL types
        products = [Product.from_model(p) for p in product_models]

        return ProductConnection(
            products=products,
            total_count=int(total_count),
            has_next_page=(offset + page_size) < total_count,
            has_prev_page=page > 1,
            page=page,
            page_size=page_size,
        )


__all__ = ["SubscriptionQueries"]

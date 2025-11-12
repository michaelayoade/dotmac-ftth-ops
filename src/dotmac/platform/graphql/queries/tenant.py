"""
GraphQL queries for Tenant Management.

Provides efficient tenant queries with conditional loading of settings,
usage records, and invitations via DataLoaders.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import strawberry
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.tenant import (
    Tenant,
    TenantConnection,
    TenantInvitation,
    TenantOverviewMetrics,
    TenantSetting,
    TenantStatusEnum,
    TenantUsageRecord,
)
from dotmac.platform.tenant.models import (
    Tenant as TenantModel,
)
from dotmac.platform.tenant.models import (
    TenantPlanType,
    TenantStatus,
)

PLATFORM_TENANT_READ_PERMISSION = "platform:tenants:read"


@strawberry.type
class TenantQueries:
    """GraphQL queries for tenant management."""

    @strawberry.field(description="Get tenant by ID with conditional field loading")  # type: ignore[misc]
    async def tenant(
        self,
        info: strawberry.Info[Context],
        id: strawberry.ID,
        include_metadata: bool = False,
        include_settings: bool = False,
        include_usage: bool = False,
        include_invitations: bool = False,
    ) -> Tenant | None:
        """
        Fetch a single tenant by ID.

        Args:
            id: Tenant ID (UUID or string)
            include_metadata: Load features, settings, custom_metadata JSON (default: False)
            include_settings: Load TenantSetting records via DataLoader (default: False)
            include_usage: Load TenantUsage records via DataLoader (default: False)
            include_invitations: Load TenantInvitation records via DataLoader (default: False)

        Returns:
            Tenant with conditionally loaded related data
        """
        context = info.context
        current_user = context.require_authenticated_user()
        db: AsyncSession = context.db

        tenant_id = str(id)
        platform_access = current_user.is_platform_admin or (
            PLATFORM_TENANT_READ_PERMISSION in (current_user.permissions or [])
        )
        if not platform_access:
            active_tenant_id = context.get_active_tenant_id()
            if active_tenant_id != tenant_id:
                raise Exception("You do not have access to this tenant.")

        # Fetch tenant
        stmt = select(TenantModel).where(TenantModel.id == tenant_id)
        result = await db.execute(stmt)
        tenant_model = result.scalar_one_or_none()

        if not tenant_model:
            return None

        # Convert to GraphQL type
        tenant = Tenant.from_model(tenant_model, include_metadata=include_metadata)

        # Conditionally load settings
        if include_settings:
            settings_loader = info.context.loaders.get_tenant_settings_loader()
            settings_list = await settings_loader.load_many([str(tenant_model.id)])
            if settings_list and settings_list[0]:
                tenant.settings = [TenantSetting.from_model(s) for s in settings_list[0]]

        # Conditionally load usage records
        if include_usage:
            usage_loader = info.context.loaders.get_tenant_usage_loader()
            usage_list = await usage_loader.load_many([str(tenant_model.id)])
            if usage_list and usage_list[0]:
                tenant.usage_records = [TenantUsageRecord.from_model(u) for u in usage_list[0]]

        # Conditionally load invitations
        if include_invitations:
            invitations_loader = info.context.loaders.get_tenant_invitations_loader()
            invitations_list = await invitations_loader.load_many([str(tenant_model.id)])
            if invitations_list and invitations_list[0]:
                tenant.invitations = [TenantInvitation.from_model(i) for i in invitations_list[0]]

        return tenant

    @strawberry.field(
        description="Get list of tenants with optional filters and conditional loading"
    )  # type: ignore[misc]
    async def tenants(
        self,
        info: strawberry.Info[Context],
        page: int = 1,
        page_size: int = 10,
        status: TenantStatusEnum | None = None,
        plan: str | None = None,
        search: str | None = None,
        include_metadata: bool = False,
        include_settings: bool = False,
        include_usage: bool = False,
        include_invitations: bool = False,
    ) -> TenantConnection:
        """
        Fetch a list of tenants with optional filtering and conditional loading.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default: 10, max: 100)
            status: Filter by tenant status
            plan: Filter by plan type (free, starter, professional, enterprise, custom)
            search: Search by name, slug, or email
            include_metadata: Load features, settings, custom_metadata JSON
            include_settings: Batch load TenantSetting records
            include_usage: Batch load TenantUsage records
            include_invitations: Batch load TenantInvitation records

        Returns:
            TenantConnection with paginated tenants and metadata
        """
        context = info.context
        current_user = context.require_authenticated_user()
        permissions = set(current_user.permissions or [])
        if (
            not current_user.is_platform_admin
            and PLATFORM_TENANT_READ_PERMISSION not in permissions
        ):
            raise Exception("Platform administrator access required to list tenants.")

        db: AsyncSession = context.db

        # Limit page_size
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        # Build base query
        stmt = select(TenantModel).where(TenantModel.deleted_at.is_(None))

        # Apply filters
        if status:
            stmt = stmt.where(TenantModel.status == TenantStatus(status.value))

        if plan:
            stmt = stmt.where(TenantModel.plan_type == TenantPlanType(plan))

        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                (TenantModel.name.ilike(search_pattern))
                | (TenantModel.slug.ilike(search_pattern))
                | (TenantModel.email.ilike(search_pattern))
            )

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar() or 0

        # Apply sorting and pagination
        stmt = stmt.order_by(TenantModel.created_at.desc()).limit(page_size).offset(offset)

        # Execute query
        result = await db.execute(stmt)
        tenant_models = result.scalars().all()

        # Convert to GraphQL types
        tenants = [Tenant.from_model(t, include_metadata=include_metadata) for t in tenant_models]

        # Conditionally batch load settings
        if include_settings and tenant_models:
            tenant_ids = [str(t.id) for t in tenant_models]
            settings_loader = info.context.loaders.get_tenant_settings_loader()
            settings_lists = await settings_loader.load_many(tenant_ids)

            for i, settings_list in enumerate(settings_lists):
                if settings_list:
                    tenants[i].settings = [TenantSetting.from_model(s) for s in settings_list]

        # Conditionally batch load usage
        if include_usage and tenant_models:
            tenant_ids = [str(t.id) for t in tenant_models]
            usage_loader = info.context.loaders.get_tenant_usage_loader()
            usage_lists = await usage_loader.load_many(tenant_ids)

            for i, usage_list in enumerate(usage_lists):
                if usage_list:
                    tenants[i].usage_records = [TenantUsageRecord.from_model(u) for u in usage_list]

        # Conditionally batch load invitations
        if include_invitations and tenant_models:
            tenant_ids = [str(t.id) for t in tenant_models]
            invitations_loader = info.context.loaders.get_tenant_invitations_loader()
            invitations_lists = await invitations_loader.load_many(tenant_ids)

            for i, invitations_list in enumerate(invitations_lists):
                if invitations_list:
                    tenants[i].invitations = [
                        TenantInvitation.from_model(inv) for inv in invitations_list
                    ]

        return TenantConnection(
            tenants=tenants,
            total_count=int(total_count),
            has_next_page=(offset + page_size) < total_count,
            has_prev_page=page > 1,
            page=page,
            page_size=page_size,
        )

    @strawberry.field(description="Get tenant overview metrics and statistics")  # type: ignore[misc]
    async def tenant_metrics(self, info: strawberry.Info[Context]) -> TenantOverviewMetrics:
        """
        Get aggregated tenant metrics.

        Returns:
            TenantOverviewMetrics with counts, distribution, and growth metrics
        """
        context = info.context
        current_user = context.require_authenticated_user()
        permissions = set(current_user.permissions or [])
        if (
            not current_user.is_platform_admin
            and PLATFORM_TENANT_READ_PERMISSION not in permissions
        ):
            raise Exception("Platform administrator access required to view tenant metrics.")

        db: AsyncSession = context.db

        # Get status counts
        status_stmt = select(
            func.count(TenantModel.id).label("total"),
            func.count(func.case((TenantModel.status == TenantStatus.ACTIVE, 1))).label("active"),
            func.count(func.case((TenantModel.status == TenantStatus.TRIAL, 1))).label("trial"),
            func.count(func.case((TenantModel.status == TenantStatus.SUSPENDED, 1))).label(
                "suspended"
            ),
            func.count(func.case((TenantModel.status == TenantStatus.CANCELLED, 1))).label(
                "cancelled"
            ),
        ).where(TenantModel.deleted_at.is_(None))

        status_result = await db.execute(status_stmt)
        status_row = status_result.one()
        status_mapping = status_row._mapping

        # Get plan distribution
        plan_stmt = select(
            func.count(func.case((TenantModel.plan_type == TenantPlanType.FREE, 1))).label("free"),
            func.count(func.case((TenantModel.plan_type == TenantPlanType.STARTER, 1))).label(
                "starter"
            ),
            func.count(func.case((TenantModel.plan_type == TenantPlanType.PROFESSIONAL, 1))).label(
                "professional"
            ),
            func.count(func.case((TenantModel.plan_type == TenantPlanType.ENTERPRISE, 1))).label(
                "enterprise"
            ),
            func.count(func.case((TenantModel.plan_type == TenantPlanType.CUSTOM, 1))).label(
                "custom"
            ),
        ).where(TenantModel.deleted_at.is_(None))

        plan_result = await db.execute(plan_stmt)
        plan_row = plan_result.one()
        plan_mapping = plan_row._mapping

        # Get resource usage aggregates
        usage_stmt = select(
            func.sum(TenantModel.current_users).label("total_users"),
            func.sum(TenantModel.current_api_calls).label("total_api_calls"),
            func.sum(TenantModel.current_storage_gb).label("total_storage_gb"),
        ).where(TenantModel.deleted_at.is_(None))

        usage_result = await db.execute(usage_stmt)
        usage_row = usage_result.one()
        usage_mapping = usage_row._mapping

        # Get growth metrics (last 30 days)
        now = datetime.now(UTC)
        month_ago = now - timedelta(days=30)

        growth_stmt = select(
            func.count(func.case((TenantModel.created_at >= month_ago, 1))).label("new_tenants"),
            func.count(
                func.case(
                    (
                        (TenantModel.status == TenantStatus.CANCELLED)
                        & (TenantModel.updated_at >= month_ago),
                        1,
                    )
                )
            ).label("churned_tenants"),
        ).where(TenantModel.deleted_at.is_(None))

        growth_result = await db.execute(growth_stmt)
        growth_row = growth_result.one()
        growth_mapping = growth_row._mapping

        return TenantOverviewMetrics(
            total_tenants=int(status_mapping.get("total") or 0),
            active_tenants=int(status_mapping.get("active") or 0),
            trial_tenants=int(status_mapping.get("trial") or 0),
            suspended_tenants=int(status_mapping.get("suspended") or 0),
            cancelled_tenants=int(status_mapping.get("cancelled") or 0),
            free_plan_count=int(plan_mapping.get("free") or 0),
            starter_plan_count=int(plan_mapping.get("starter") or 0),
            professional_plan_count=int(plan_mapping.get("professional") or 0),
            enterprise_plan_count=int(plan_mapping.get("enterprise") or 0),
            custom_plan_count=int(plan_mapping.get("custom") or 0),
            total_users=int(usage_mapping.get("total_users") or 0),
            total_api_calls=int(usage_mapping.get("total_api_calls") or 0),
            total_storage_gb=Decimal(str(usage_mapping.get("total_storage_gb") or 0)),
            new_tenants_this_month=int(growth_mapping.get("new_tenants") or 0),
            churned_tenants_this_month=int(growth_mapping.get("churned_tenants") or 0),
        )


__all__ = ["TenantQueries"]

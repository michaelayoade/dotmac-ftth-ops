"""
ISP Internet Service Plan Service Layer

Business logic for managing internet service plans and subscriptions.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import InternetServicePlan, PlanStatus, PlanSubscription, PlanType
from .schemas import (
    InternetServicePlanCreate,
    InternetServicePlanResponse,
    InternetServicePlanUpdate,
    PlanComparison,
    PlanSubscriptionCreate,
    PlanSubscriptionResponse,
    PlanValidationRequest,
    PlanValidationResponse,
    UsageUpdateRequest,
)
from .validator import PlanValidator


class InternetPlanService:
    """Service for managing internet service plans."""

    def __init__(self, session: AsyncSession, tenant_id: UUID):
        self.session = session
        self.tenant_id = str(tenant_id)

    async def create_plan(self, data: InternetServicePlanCreate) -> InternetServicePlanResponse:
        """Create a new internet service plan."""
        plan = InternetServicePlan(
            tenant_id=self.tenant_id,
            plan_code=data.plan_code,
            name=data.name,
            description=data.description,
            plan_type=data.plan_type,
            status=data.status,
            download_speed=data.download_speed,
            upload_speed=data.upload_speed,
            speed_unit=data.speed_unit,
            burst_download_speed=data.burst_download_speed,
            burst_upload_speed=data.burst_upload_speed,
            burst_duration_seconds=data.burst_duration_seconds,
            has_data_cap=data.has_data_cap,
            data_cap_amount=data.data_cap_amount,
            data_cap_unit=data.data_cap_unit,
            throttle_policy=data.throttle_policy,
            throttled_download_speed=data.throttled_download_speed,
            throttled_upload_speed=data.throttled_upload_speed,
            overage_price_per_unit=data.overage_price_per_unit,
            overage_unit=data.overage_unit,
            has_fup=data.has_fup,
            fup_threshold=data.fup_threshold,
            fup_threshold_unit=data.fup_threshold_unit,
            fup_throttle_speed=data.fup_throttle_speed,
            has_time_restrictions=data.has_time_restrictions,
            unrestricted_start_time=data.unrestricted_start_time,
            unrestricted_end_time=data.unrestricted_end_time,
            unrestricted_data_unlimited=data.unrestricted_data_unlimited,
            unrestricted_speed_multiplier=data.unrestricted_speed_multiplier,
            qos_priority=data.qos_priority,
            traffic_shaping_enabled=data.traffic_shaping_enabled,
            monthly_price=data.monthly_price,
            setup_fee=data.setup_fee,
            currency=data.currency,
            billing_cycle=data.billing_cycle,
            is_public=data.is_public,
            is_promotional=data.is_promotional,
            promotion_start_date=data.promotion_start_date,
            promotion_end_date=data.promotion_end_date,
            minimum_contract_months=data.minimum_contract_months,
            early_termination_fee=data.early_termination_fee,
            contention_ratio=data.contention_ratio,
            ipv4_included=data.ipv4_included,
            ipv6_included=data.ipv6_included,
            static_ip_included=data.static_ip_included,
            static_ip_count=data.static_ip_count,
            router_included=data.router_included,
            installation_included=data.installation_included,
            technical_support_level=data.technical_support_level,
            tags=data.tags,
            features=data.features,
            restrictions=data.restrictions,
        )

        self.session.add(plan)
        await self.session.commit()
        await self.session.refresh(plan)

        return InternetServicePlanResponse.model_validate(plan)

    async def get_plan(self, plan_id: UUID) -> InternetServicePlanResponse | None:
        """Get plan by ID."""
        stmt = select(InternetServicePlan).where(
            and_(
                InternetServicePlan.id == plan_id,
                InternetServicePlan.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        plan = result.scalar_one_or_none()

        if not plan:
            return None

        return InternetServicePlanResponse.model_validate(plan)

    async def get_plan_by_code(self, plan_code: str) -> InternetServicePlanResponse | None:
        """Get plan by plan code."""
        stmt = select(InternetServicePlan).where(
            and_(
                InternetServicePlan.plan_code == plan_code.upper(),
                InternetServicePlan.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        plan = result.scalar_one_or_none()

        if not plan:
            return None

        return InternetServicePlanResponse.model_validate(plan)

    async def list_plans(
        self,
        plan_type: PlanType | None = None,
        status: PlanStatus | None = None,
        is_public: bool | None = None,
        is_promotional: bool | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[InternetServicePlanResponse]:
        """List plans with filters."""
        stmt = select(InternetServicePlan).where(InternetServicePlan.tenant_id == self.tenant_id)

        # Apply filters
        if plan_type:
            stmt = stmt.where(InternetServicePlan.plan_type == plan_type)

        if status:
            stmt = stmt.where(InternetServicePlan.status == status)

        if is_public is not None:
            stmt = stmt.where(InternetServicePlan.is_public == is_public)

        if is_promotional is not None:
            stmt = stmt.where(InternetServicePlan.is_promotional == is_promotional)

        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    InternetServicePlan.name.ilike(search_pattern),
                    InternetServicePlan.plan_code.ilike(search_pattern),
                    InternetServicePlan.description.ilike(search_pattern),
                )
            )

        # Order by created date descending
        stmt = stmt.order_by(desc(InternetServicePlan.created_at))

        # Pagination
        stmt = stmt.limit(limit).offset(offset)

        result = await self.session.execute(stmt)
        plans = result.scalars().all()

        return [InternetServicePlanResponse.model_validate(plan) for plan in plans]

    async def update_plan(
        self, plan_id: UUID, data: InternetServicePlanUpdate
    ) -> InternetServicePlanResponse | None:
        """Update plan."""
        stmt = select(InternetServicePlan).where(
            and_(
                InternetServicePlan.id == plan_id,
                InternetServicePlan.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        plan = result.scalar_one_or_none()

        if not plan:
            return None

        # Update fields
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(plan, field, value)

        plan.updated_at = datetime.utcnow()

        await self.session.commit()
        await self.session.refresh(plan)

        return InternetServicePlanResponse.model_validate(plan)

    async def delete_plan(self, plan_id: UUID) -> bool:
        """Archive plan (soft delete)."""
        stmt = select(InternetServicePlan).where(
            and_(
                InternetServicePlan.id == plan_id,
                InternetServicePlan.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        plan = result.scalar_one_or_none()

        if not plan:
            return False

        # Check for active subscriptions
        sub_stmt = select(func.count(PlanSubscription.id)).where(
            and_(
                PlanSubscription.plan_id == plan_id,
                PlanSubscription.is_active,
            )
        )
        sub_result = await self.session.execute(sub_stmt)
        active_subs = sub_result.scalar()

        if active_subs > 0:
            # Cannot delete plan with active subscriptions
            return False

        # Archive the plan
        plan.status = PlanStatus.ARCHIVED
        plan.updated_at = datetime.utcnow()

        await self.session.commit()
        return True

    async def validate_plan(
        self, plan_id: UUID, request: PlanValidationRequest
    ) -> PlanValidationResponse | None:
        """Validate plan configuration and simulate usage."""
        stmt = select(InternetServicePlan).where(
            and_(
                InternetServicePlan.id == plan_id,
                InternetServicePlan.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        plan = result.scalar_one_or_none()

        if not plan:
            return None

        # Run validation
        validator = PlanValidator(plan)
        validation_response = validator.validate(request)

        # Update plan validation status
        plan.last_validated_at = datetime.utcnow()
        plan.validation_status = validation_response.overall_status
        plan.validation_errors = [
            r.message for r in validation_response.results if not r.passed and r.severity == "error"
        ]

        await self.session.commit()

        return validation_response

    async def compare_plans(self, plan_ids: list[UUID]) -> PlanComparison:
        """Compare multiple plans side-by-side."""
        stmt = select(InternetServicePlan).where(
            and_(
                InternetServicePlan.id.in_(plan_ids),
                InternetServicePlan.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        plans = result.scalars().all()

        if not plans:
            return PlanComparison(plans=[], comparison_matrix={}, recommendations=[])

        plan_responses = [InternetServicePlanResponse.model_validate(p) for p in plans]

        # Build comparison matrix
        comparison_matrix: dict[str, list[Any]] = {
            "Plan Name": [p.name for p in plan_responses],
            "Plan Code": [p.plan_code for p in plan_responses],
            "Download Speed": [f"{p.download_speed} {p.speed_unit}" for p in plan_responses],
            "Upload Speed": [f"{p.upload_speed} {p.speed_unit}" for p in plan_responses],
            "Data Cap": [
                f"{p.data_cap_amount} {p.data_cap_unit}" if p.has_data_cap else "Unlimited"
                for p in plan_responses
            ],
            "Monthly Price": [f"{p.monthly_price} {p.currency}" for p in plan_responses],
            "Setup Fee": [f"{p.setup_fee} {p.currency}" for p in plan_responses],
            "QoS Priority": [p.qos_priority for p in plan_responses],
            "Static IPs": [
                p.static_ip_count if p.static_ip_included else 0 for p in plan_responses
            ],
            "Contract": [f"{p.minimum_contract_months} months" for p in plan_responses],
        }

        # Generate recommendations
        recommendations = []

        # Highest speed
        max_speed_plan = max(plans, key=lambda p: p.download_speed)
        recommendations.append(
            f"Highest speed: {max_speed_plan.name} ({max_speed_plan.download_speed} {max_speed_plan.speed_unit})"
        )

        # Best value
        plans_with_prices = [p for p in plans if p.monthly_price > 0]
        if plans_with_prices:
            best_value_plan = max(
                plans_with_prices, key=lambda p: p.get_speed_mbps(download=True) / p.monthly_price
            )
            recommendations.append(f"Best value: {best_value_plan.name}")

        # Unlimited data
        unlimited_plans = [p for p in plan_responses if not p.has_data_cap]
        if unlimited_plans:
            recommendations.append(f"Unlimited data: {', '.join(p.name for p in unlimited_plans)}")

        return PlanComparison(
            plans=plan_responses,
            comparison_matrix=comparison_matrix,
            recommendations=recommendations,
        )

    # Subscription management

    async def create_subscription(self, data: PlanSubscriptionCreate) -> PlanSubscriptionResponse:
        """Subscribe customer to a plan."""
        subscription = PlanSubscription(
            tenant_id=self.tenant_id,
            plan_id=data.plan_id,
            customer_id=data.customer_id,
            start_date=data.start_date,
            custom_download_speed=data.custom_download_speed,
            custom_upload_speed=data.custom_upload_speed,
            custom_data_cap=data.custom_data_cap,
            custom_monthly_price=data.custom_monthly_price,
        )

        self.session.add(subscription)
        await self.session.commit()
        await self.session.refresh(subscription)

        return PlanSubscriptionResponse.model_validate(subscription)

    async def get_subscription(self, subscription_id: UUID) -> PlanSubscriptionResponse | None:
        """Get subscription by ID."""
        stmt = select(PlanSubscription).where(
            and_(
                PlanSubscription.id == subscription_id,
                PlanSubscription.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()

        if not subscription:
            return None

        return PlanSubscriptionResponse.model_validate(subscription)

    async def list_subscriptions(
        self,
        plan_id: UUID | None = None,
        customer_id: UUID | None = None,
        is_active: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[PlanSubscriptionResponse]:
        """List subscriptions with filters."""
        stmt = select(PlanSubscription).where(PlanSubscription.tenant_id == self.tenant_id)

        if plan_id:
            stmt = stmt.where(PlanSubscription.plan_id == plan_id)

        if customer_id:
            stmt = stmt.where(PlanSubscription.customer_id == customer_id)

        if is_active is not None:
            stmt = stmt.where(PlanSubscription.is_active == is_active)

        stmt = stmt.order_by(desc(PlanSubscription.created_at))
        stmt = stmt.limit(limit).offset(offset)

        result = await self.session.execute(stmt)
        subscriptions = result.scalars().all()

        return [PlanSubscriptionResponse.model_validate(sub) for sub in subscriptions]

    async def update_usage(
        self, subscription_id: UUID, usage_data: UsageUpdateRequest
    ) -> PlanSubscriptionResponse | None:
        """Update subscription usage."""
        stmt = select(PlanSubscription).where(
            and_(
                PlanSubscription.id == subscription_id,
                PlanSubscription.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()

        if not subscription:
            return None

        # Add to current period usage
        total_usage = usage_data.download_gb + usage_data.upload_gb
        subscription.current_period_usage_gb += total_usage
        subscription.updated_at = datetime.utcnow()

        await self.session.commit()
        await self.session.refresh(subscription)

        return PlanSubscriptionResponse.model_validate(subscription)

    async def reset_usage(self, subscription_id: UUID) -> PlanSubscriptionResponse | None:
        """Reset usage for new billing period."""
        stmt = select(PlanSubscription).where(
            and_(
                PlanSubscription.id == subscription_id,
                PlanSubscription.tenant_id == self.tenant_id,
            )
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()

        if not subscription:
            return None

        subscription.current_period_usage_gb = Decimal("0.00")
        subscription.last_usage_reset = datetime.utcnow()
        subscription.updated_at = datetime.utcnow()

        await self.session.commit()
        await self.session.refresh(subscription)

        return PlanSubscriptionResponse.model_validate(subscription)

    async def get_plan_statistics(self, plan_id: UUID) -> dict[str, Any]:
        """Get statistics for a plan."""
        # Count active subscriptions
        sub_stmt = select(func.count(PlanSubscription.id)).where(
            and_(
                PlanSubscription.plan_id == plan_id,
                PlanSubscription.is_active,
            )
        )
        sub_result = await self.session.execute(sub_stmt)
        active_subscriptions = sub_result.scalar() or 0

        # Calculate MRR (assuming all on monthly billing for now)
        plan_stmt = select(InternetServicePlan).where(InternetServicePlan.id == plan_id)
        plan_result = await self.session.execute(plan_stmt)
        plan = plan_result.scalar_one_or_none()

        mrr = Decimal("0.00")
        if plan:
            mrr = plan.monthly_price * active_subscriptions

        return {
            "plan_id": str(plan_id),
            "active_subscriptions": active_subscriptions,
            "monthly_recurring_revenue": float(mrr),
        }

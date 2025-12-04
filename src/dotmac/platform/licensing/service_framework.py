"""
Service layer for composable licensing framework.

Provides business logic for:
- Dynamic plan creation from modules and quotas
- Module dependency resolution
- Subscription management with add-ons
- Feature entitlement enforcement
- Quota usage tracking and overage billing
"""

from datetime import datetime, timedelta
from typing import Any, cast
from uuid import UUID, uuid4

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.licensing.framework import (
    BillingCycle,
    EventType,
    FeatureModule,
    FeatureUsageLog,
    ModuleCapability,
    ModuleCategory,
    PlanModule,
    PlanQuotaAllocation,
    PricingModel,
    QuotaDefinition,
    ServicePlan,
    SubscriptionEvent,
    SubscriptionModule,
    SubscriptionQuotaUsage,
    SubscriptionStatus,
    TenantSubscription,
)


class ModuleResolutionError(Exception):
    """Raised when module dependencies cannot be resolved."""

    pass


class QuotaExceededError(Exception):
    """Raised when quota limit is exceeded and overage not allowed."""

    pass


class FeatureNotEntitledError(Exception):
    """Raised when tenant tries to access feature they don't have."""

    pass


class LicensingFrameworkService:
    """Service for composable licensing framework operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========================================================================
    # MODULE MANAGEMENT
    # ========================================================================

    async def create_feature_module(
        self,
        module_code: str,
        module_name: str,
        category: ModuleCategory,
        description: str,
        dependencies: list[str],
        pricing_model: PricingModel,
        base_price: float,
        config_schema: dict[str, Any],
        default_config: dict[str, Any],
    ) -> FeatureModule:
        """Create a new reusable feature module."""
        # Validate dependencies exist
        if dependencies:
            result = await self.db.execute(
                select(FeatureModule).where(FeatureModule.module_code.in_(dependencies))
            )
            existing = {m.module_code for m in result.scalars().all()}
            missing = set(dependencies) - existing
            if missing:
                raise ModuleResolutionError(f"Module dependencies not found: {', '.join(missing)}")

        module = FeatureModule(
            id=uuid4(),
            module_code=module_code,
            module_name=module_name,
            category=category,
            description=description,
            dependencies=dependencies,
            pricing_model=pricing_model,
            base_price=base_price,
            config_schema=config_schema,
            default_config=default_config,
            is_active=True,
        )
        self.db.add(module)
        await self.db.commit()
        await self.db.refresh(module)
        return module

    async def add_module_capability(
        self,
        module_id: UUID,
        capability_code: str,
        capability_name: str,
        description: str,
        api_endpoints: list[str],
        ui_routes: list[str],
        permissions: list[str],
        config: dict[str, Any],
    ) -> ModuleCapability:
        """Add a capability to a feature module."""
        capability = ModuleCapability(
            id=uuid4(),
            module_id=module_id,
            capability_code=capability_code,
            capability_name=capability_name,
            description=description,
            api_endpoints=api_endpoints,
            ui_routes=ui_routes,
            permissions=permissions,
            config=config,
            is_active=True,
        )
        self.db.add(capability)
        await self.db.commit()
        await self.db.refresh(capability)
        return capability

    async def get_module_with_dependencies(
        self, module_id: UUID
    ) -> tuple[FeatureModule, list[FeatureModule]]:
        """Get module and resolve all its dependencies recursively."""
        result = await self.db.execute(select(FeatureModule).where(FeatureModule.id == module_id))
        module = result.scalar_one_or_none()
        if not module:
            raise ValueError(f"Module {module_id} not found")

        # Recursively resolve dependencies
        dependencies = []
        if module.dependencies:
            deps = await self._resolve_dependencies(module.dependencies)
            dependencies.extend(deps)

        return module, dependencies

    async def _resolve_dependencies(
        self, module_codes: list[str], resolved: set[str] | None = None
    ) -> list[FeatureModule]:
        """Recursively resolve module dependencies."""
        if resolved is None:
            resolved = set()

        dependencies = []
        for code in module_codes:
            if code in resolved:
                continue  # Avoid circular dependencies

            result = await self.db.execute(
                select(FeatureModule).where(FeatureModule.module_code == code)
            )
            module = result.scalar_one_or_none()
            if not module:
                raise ModuleResolutionError(f"Dependency module '{code}' not found")

            resolved.add(code)
            dependencies.append(module)

            # Resolve transitive dependencies
            if module.dependencies:
                sub_deps = await self._resolve_dependencies(module.dependencies, resolved)
                dependencies.extend(sub_deps)

        return dependencies

    # ========================================================================
    # QUOTA MANAGEMENT
    # ========================================================================

    async def create_quota_definition(
        self,
        quota_code: str,
        quota_name: str,
        description: str,
        unit_name: str,
        pricing_model: PricingModel,
        unit_plural: str | None = None,
        overage_rate: float | None = None,
        is_metered: bool = False,
        reset_period: str | None = None,
        config: dict[str, Any] | None = None,
    ) -> QuotaDefinition:
        """Create a new reusable quota definition."""
        quota = QuotaDefinition(
            id=uuid4(),
            quota_code=quota_code,
            quota_name=quota_name,
            description=description,
            unit_name=unit_name,
            unit_plural=unit_plural or f"{unit_name}s",
            pricing_model=pricing_model,
            overage_rate=overage_rate,
            is_metered=is_metered,
            reset_period=reset_period,
            is_active=True,
            extra_metadata=config or {},
        )
        self.db.add(quota)
        await self.db.commit()
        await self.db.refresh(quota)
        return quota

    # ========================================================================
    # DYNAMIC PLAN BUILDER
    # ========================================================================

    async def create_service_plan(
        self,
        plan_name: str,
        plan_code: str,
        description: str,
        base_price_monthly: float,
        annual_discount_percent: float,
        is_template: bool,
        is_public: bool,
        is_custom: bool,
        trial_days: int,
        trial_modules: list[str],
        module_configs: list[
            dict[str, Any]
        ],  # [{"module_id": UUID, "included": bool, "addon": bool, "price": float}]
        quota_configs: list[
            dict[str, Any]
        ],  # [{"quota_id": UUID, "quantity": int, "allow_overage": bool, "rate": float}]
        metadata: dict[str, Any],
    ) -> ServicePlan:
        """
        Create a new service plan by composing modules and quotas.

        This is the core of the framework - allows creating completely custom plans.
        """
        # Create the plan
        plan = ServicePlan(
            id=uuid4(),
            plan_name=plan_name,
            plan_code=plan_code,
            description=description,
            version=1,
            is_template=is_template,
            is_public=is_public,
            is_custom=is_custom,
            base_price_monthly=base_price_monthly,
            annual_discount_percent=annual_discount_percent,
            trial_days=trial_days,
            trial_modules=trial_modules,
            extra_metadata=metadata,
            is_active=True,
        )
        self.db.add(plan)
        await self.db.flush()  # Get plan ID

        # Add modules to plan
        for config in module_configs:
            # Validate module exists and resolve dependencies
            module, deps = await self.get_module_with_dependencies(config["module_id"])

            # Add main module
            plan_module = PlanModule(
                id=uuid4(),
                plan_id=plan.id,
                module_id=module.id,
                included_by_default=config.get("included", True),
                is_optional_addon=config.get("addon", False),
                override_price=config.get("price"),
                trial_only=config.get("trial_only", False),
                promotional_until=config.get("promotional_until"),
                config=config.get("config", {}),
            )
            self.db.add(plan_module)

            # Auto-add dependencies as included modules
            for dep in deps:
                dep_module = PlanModule(
                    id=uuid4(),
                    plan_id=plan.id,
                    module_id=dep.id,
                    included_by_default=True,
                    is_optional_addon=False,
                    override_price=None,  # Use base price
                    trial_only=False,
                    config={},
                )
                self.db.add(dep_module)

        # Add quotas to plan
        for config in quota_configs:
            quota_allocation = PlanQuotaAllocation(
                id=uuid4(),
                plan_id=plan.id,
                quota_id=config["quota_id"],
                included_quantity=config.get("quantity", 0),
                soft_limit=config.get("soft_limit"),
                allow_overage=config.get("allow_overage", False),
                overage_rate_override=config.get("overage_rate"),
                pricing_tiers=config.get("pricing_tiers", []),
                config=config.get("config", {}),
            )
            self.db.add(quota_allocation)

        await self.db.commit()
        await self.db.refresh(plan)
        return plan

    async def duplicate_plan_as_template(
        self, source_plan_id: UUID, new_plan_name: str, new_plan_code: str
    ) -> ServicePlan:
        """Duplicate an existing plan as a reusable template."""
        # Load source plan with relationships
        result = await self.db.execute(
            select(ServicePlan)
            .options(
                selectinload(ServicePlan.included_modules),
                selectinload(ServicePlan.included_quotas),
            )
            .where(ServicePlan.id == source_plan_id)
        )
        source = result.scalar_one_or_none()
        if not source:
            raise ValueError(f"Source plan {source_plan_id} not found")

        # Create new plan with same structure
        new_plan = ServicePlan(
            id=uuid4(),
            plan_name=new_plan_name,
            plan_code=new_plan_code,
            description=source.description,
            version=1,
            is_template=True,  # Always create as template
            is_public=False,
            is_custom=False,
            base_price_monthly=source.base_price_monthly,
            annual_discount_percent=source.annual_discount_percent,
            trial_days=source.trial_days,
            trial_modules=source.trial_modules,
            extra_metadata=source.extra_metadata.copy() if source.extra_metadata else {},
            is_active=True,
        )
        self.db.add(new_plan)
        await self.db.flush()

        # Copy modules
        for pm in source.modules:
            new_pm = PlanModule(
                id=uuid4(),
                plan_id=new_plan.id,
                module_id=pm.module_id,
                included_by_default=pm.included_by_default,
                is_optional_addon=pm.is_optional_addon,
                override_price=pm.override_price,
                trial_only=pm.trial_only,
                promotional_until=pm.promotional_until,
                config=pm.config.copy() if pm.config else {},
            )
            self.db.add(new_pm)

        # Copy quotas
        for qa in source.quotas:
            new_qa = PlanQuotaAllocation(
                id=uuid4(),
                plan_id=new_plan.id,
                quota_id=qa.quota_id,
                included_quantity=qa.included_quantity,
                soft_limit=qa.soft_limit,
                allow_overage=qa.allow_overage,
                overage_rate_override=qa.overage_rate_override,
                pricing_tiers=qa.pricing_tiers.copy() if qa.pricing_tiers else [],
                config=qa.config.copy() if qa.config else {},
            )
            self.db.add(new_qa)

        await self.db.commit()
        await self.db.refresh(new_plan)
        return new_plan

    async def calculate_plan_price(
        self, plan_id: UUID, billing_cycle: BillingCycle, addon_modules: list[UUID] | None = None
    ) -> dict[str, Any]:
        """Calculate total price for a plan including add-ons."""
        # Load plan with modules
        result = await self.db.execute(
            select(ServicePlan)
            .options(selectinload(ServicePlan.included_modules).selectinload(PlanModule.module))
            .where(ServicePlan.id == plan_id)
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")

        # Base price
        base_monthly = plan.base_price_monthly

        # Add module prices (included modules)
        for pm in plan.included_modules:
            if pm.included_by_default and not pm.trial_only:
                price = pm.override_price if pm.override_price else pm.module.base_price
                base_monthly += price

        # Add optional add-on modules
        addon_price = 0.0
        if addon_modules:
            for module_id in addon_modules:
                result = await self.db.execute(
                    select(PlanModule)
                    .options(selectinload(PlanModule.module))
                    .where(
                        and_(
                            PlanModule.plan_id == plan_id,
                            PlanModule.module_id == module_id,
                            PlanModule.is_optional_addon,
                        )
                    )
                )
                addon_module = result.scalar_one_or_none()
                if addon_module:
                    price = (
                        addon_module.override_price
                        if addon_module.override_price
                        else addon_module.module.base_price
                    )
                    addon_price += price

        total_monthly = base_monthly + addon_price

        # Apply annual discount
        if billing_cycle == BillingCycle.ANNUALLY:
            annual_price = total_monthly * 12
            discount_amount = annual_price * (plan.annual_discount_percent / 100)
            total_annual = annual_price - discount_amount
        else:
            total_annual = None
            discount_amount = 0

        return {
            "base_monthly": base_monthly,
            "addon_monthly": addon_price,
            "total_monthly": total_monthly,
            "annual_discount_percent": plan.annual_discount_percent,
            "discount_amount": discount_amount,
            "total_annual": total_annual,
        }

    # ========================================================================
    # SUBSCRIPTION MANAGEMENT
    # ========================================================================

    async def create_subscription(
        self,
        tenant_id: UUID,
        plan_id: UUID,
        billing_cycle: BillingCycle,
        start_trial: bool,
        addon_module_ids: list[UUID] | None = None,
        custom_config: dict[str, Any] | None = None,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
    ) -> TenantSubscription:
        """Subscribe tenant to a service plan."""
        # Load plan with all relationships
        result = await self.db.execute(
            select(ServicePlan)
            .options(
                selectinload(ServicePlan.included_modules).selectinload(PlanModule.module),
                selectinload(ServicePlan.included_quotas).selectinload(PlanQuotaAllocation.quota),
            )
            .where(ServicePlan.id == plan_id)
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")

        # Calculate pricing
        pricing = await self.calculate_plan_price(plan_id, billing_cycle, addon_module_ids)

        # Determine trial dates
        now = datetime.utcnow()
        if start_trial and plan.trial_days > 0:
            trial_start = now
            trial_end = now + timedelta(days=plan.trial_days)
            status = SubscriptionStatus.TRIAL
        else:
            trial_start = None
            trial_end = None
            status = SubscriptionStatus.ACTIVE

        # Create subscription
        subscription = TenantSubscription(
            id=uuid4(),
            tenant_id=tenant_id,
            plan_id=plan_id,
            status=status,
            billing_cycle=billing_cycle,
            monthly_price=pricing["total_monthly"],
            annual_price=pricing.get("total_annual"),
            trial_start=trial_start,
            trial_end=trial_end,
            current_period_start=now,
            current_period_end=now
            + timedelta(days=30 if billing_cycle == BillingCycle.MONTHLY else 365),
            stripe_customer_id=stripe_customer_id,
            stripe_subscription_id=stripe_subscription_id,
            custom_config=custom_config or {},
        )
        self.db.add(subscription)
        await self.db.flush()

        # Activate modules
        for pm in plan.included_modules:
            # Include module if it's default, or if it's trial-only and we're in trial
            if pm.included_by_default or (pm.trial_only and start_trial):
                sub_module = SubscriptionModule(
                    id=uuid4(),
                    subscription_id=subscription.id,
                    module_id=pm.module_id,
                    is_enabled=True,
                    source="TRIAL" if start_trial and pm.trial_only else "PLAN",
                    addon_price=None,
                    expires_at=trial_end if pm.trial_only else pm.promotional_until,
                    config=pm.config or {},
                )
                self.db.add(sub_module)

        # Activate add-on modules
        if addon_module_ids:
            for module_id in addon_module_ids:
                result = await self.db.execute(
                    select(PlanModule)
                    .options(selectinload(PlanModule.module))
                    .where(
                        and_(
                            PlanModule.plan_id == plan_id,
                            PlanModule.module_id == module_id,
                            PlanModule.is_optional_addon,
                        )
                    )
                )
                addon_pm = result.scalar_one_or_none()
                if addon_pm is not None:
                    addon_price = (
                        addon_pm.override_price
                        if addon_pm.override_price
                        else addon_pm.module.base_price
                    )
                    sub_module = SubscriptionModule(
                        id=uuid4(),
                        subscription_id=subscription.id,
                        module_id=module_id,
                        is_enabled=True,
                        source="ADDON",
                        addon_price=addon_price,
                        expires_at=None,
                        config=addon_pm.config or {},
                    )
                    self.db.add(sub_module)

        # Initialize quota usage tracking
        for qa in plan.included_quotas:
            usage = SubscriptionQuotaUsage(
                id=uuid4(),
                subscription_id=subscription.id,
                quota_id=qa.quota_id,
                period_start=now,
                period_end=self._calculate_quota_period_end(now, qa.quota.reset_period),
                allocated_quantity=qa.included_quantity,
                current_usage=0,
                overage_quantity=0,
                overage_charges=0.0,
            )
            self.db.add(usage)

        # Log event
        event = SubscriptionEvent(
            id=uuid4(),
            subscription_id=subscription.id,
            event_type=EventType.TRIAL_STARTED if start_trial else EventType.SUBSCRIPTION_CREATED,
            event_data={
                "plan_id": str(plan_id),
                "plan_name": plan.plan_name,
                "billing_cycle": billing_cycle.value,
                "pricing": pricing,
            },
            created_by=None,  # System event
        )
        self.db.add(event)

        await self.db.commit()
        await self.db.refresh(subscription)
        return subscription

    def _calculate_quota_period_end(self, start: datetime, reset_period: str | None) -> datetime:
        """Calculate when quota period ends based on reset period."""
        if not reset_period:
            return start  # Treat as no-op period; effectively unlimited

        if reset_period == "MONTHLY":
            # Next month, same day
            if start.month == 12:
                return start.replace(year=start.year + 1, month=1)
            else:
                return start.replace(month=start.month + 1)
        elif reset_period == "QUARTERLY":
            # Add 3 months
            month = start.month + 3
            year = start.year
            while month > 12:
                month -= 12
                year += 1
            return start.replace(year=year, month=month)
        elif reset_period == "ANNUAL":
            return start.replace(year=start.year + 1)

        return start

    async def add_addon_to_subscription(
        self,
        subscription_id: UUID,
        module_id: UUID,
        activated_by: UUID | None = None,
    ) -> SubscriptionModule:
        """Add an optional add-on module to existing subscription."""
        # Load subscription with plan
        result = await self.db.execute(
            select(TenantSubscription)
            .options(selectinload(TenantSubscription.plan))
            .where(TenantSubscription.id == subscription_id)
        )
        subscription = result.scalar_one_or_none()
        if not subscription:
            raise ValueError(f"Subscription {subscription_id} not found")

        # Verify module is available as add-on for this plan
        result = await self.db.execute(
            select(PlanModule)
            .options(selectinload(PlanModule.module))
            .where(
                and_(
                    PlanModule.plan_id == subscription.plan_id,
                    PlanModule.module_id == module_id,
                    PlanModule.is_optional_addon,
                )
            )
        )
        addon_module = result.scalar_one_or_none()
        if addon_module is None:
            raise ValueError(f"Module {module_id} is not available as add-on for this plan")
        pm = cast(PlanModule, addon_module)

        # Check if already activated
        result = await self.db.execute(
            select(SubscriptionModule).where(
                and_(
                    SubscriptionModule.subscription_id == subscription_id,
                    SubscriptionModule.module_id == module_id,
                )
            )
        )
        existing = cast(SubscriptionModule | None, result.scalar_one_or_none())
        if existing:
            if existing.is_enabled:
                raise ValueError("Module already activated")
            # Re-enable if disabled
            existing.is_enabled = True
            existing.source = "ADDON"
            existing.addon_price = pm.override_price if pm.override_price else pm.module.base_price
            await self.db.commit()
            return existing

        # Activate add-on
        addon_price = pm.override_price if pm.override_price else pm.module.base_price
        sub_module = SubscriptionModule(
            id=uuid4(),
            subscription_id=subscription_id,
            module_id=module_id,
            is_enabled=True,
            source="ADDON",
            addon_price=addon_price,
            expires_at=None,
            config=pm.config or {},
        )
        self.db.add(sub_module)

        # Log event
        event = SubscriptionEvent(
            id=uuid4(),
            subscription_id=subscription_id,
            event_type=EventType.ADDON_ADDED,
            event_data={
                "module_id": str(module_id),
                "module_name": pm.module.module_name,
                "addon_price": addon_price,
            },
            created_by=activated_by,
        )
        self.db.add(event)

        await self.db.commit()
        await self.db.refresh(sub_module)
        return sub_module

    async def remove_addon_from_subscription(
        self,
        subscription_id: UUID,
        module_id: UUID,
        deactivated_by: UUID | None = None,
    ) -> None:
        """Remove an add-on module from subscription."""
        result = await self.db.execute(
            select(SubscriptionModule)
            .options(selectinload(SubscriptionModule.module))
            .where(
                and_(
                    SubscriptionModule.subscription_id == subscription_id,
                    SubscriptionModule.module_id == module_id,
                    SubscriptionModule.source == "ADDON",
                )
            )
        )
        sub_module = result.scalar_one_or_none()
        if not sub_module:
            raise ValueError("Add-on module not found in subscription")

        # Disable module
        sub_module.is_enabled = False

        # Log event
        event = SubscriptionEvent(
            id=uuid4(),
            subscription_id=subscription_id,
            event_type=EventType.ADDON_REMOVED,
            event_data={
                "module_id": str(module_id),
                "module_name": sub_module.module.module_name,
            },
            created_by=deactivated_by,
        )
        self.db.add(event)

        await self.db.commit()

    # ========================================================================
    # FEATURE ENTITLEMENT ENFORCEMENT
    # ========================================================================

    async def check_feature_entitlement(
        self,
        tenant_id: UUID,
        module_code: str,
        capability_code: str | None = None,
    ) -> bool:
        """Check if tenant has access to a specific feature module or capability."""
        # Get active subscription
        result = await self.db.execute(
            select(TenantSubscription)
            .where(
                and_(
                    TenantSubscription.tenant_id == tenant_id,
                    TenantSubscription.status.in_(
                        [
                            SubscriptionStatus.TRIAL,
                            SubscriptionStatus.ACTIVE,
                            SubscriptionStatus.PAST_DUE,  # Grace period
                        ]
                    ),
                )
            )
            .order_by(TenantSubscription.created_at.desc())
        )
        subscription = result.scalar_one_or_none()
        if not subscription:
            return False

        # Get module
        result = await self.db.execute(
            select(FeatureModule).where(FeatureModule.module_code == module_code)
        )
        module = result.scalar_one_or_none()
        if not module:
            return False

        # Check if module is active in subscription
        result = await self.db.execute(
            select(SubscriptionModule).where(
                and_(
                    SubscriptionModule.subscription_id == subscription.id,
                    SubscriptionModule.module_id == module.id,
                    SubscriptionModule.is_enabled,
                )
            )
        )
        sub_module = result.scalar_one_or_none()
        if not sub_module:
            return False

        # Check if expired (trial or promotional)
        if sub_module.expires_at and sub_module.expires_at < datetime.utcnow():
            return False

        # If checking specific capability
        if capability_code:
            result = await self.db.execute(
                select(ModuleCapability).where(
                    and_(
                        ModuleCapability.module_id == module.id,
                        ModuleCapability.capability_code == capability_code,
                        ModuleCapability.is_active,
                    )
                )
            )
            capability = result.scalar_one_or_none()
            return capability is not None

        return True

    async def get_entitled_capabilities(self, tenant_id: UUID) -> dict[str, list[str]]:
        """Get all capabilities tenant has access to, grouped by module."""
        # Get active subscription
        result = await self.db.execute(
            select(TenantSubscription)
            .options(
                selectinload(TenantSubscription.active_modules)
                .selectinload(SubscriptionModule.module)
                .selectinload(FeatureModule.capabilities)
            )
            .where(
                and_(
                    TenantSubscription.tenant_id == tenant_id,
                    TenantSubscription.status.in_(
                        [
                            SubscriptionStatus.TRIAL,
                            SubscriptionStatus.ACTIVE,
                            SubscriptionStatus.PAST_DUE,
                        ]
                    ),
                )
            )
            .order_by(TenantSubscription.created_at.desc())
        )
        subscription = result.scalar_one_or_none()
        if not subscription:
            return {}

        now = datetime.utcnow()
        capabilities = {}

        for sub_module in subscription.active_modules:
            if not sub_module.is_enabled:
                continue
            if sub_module.expires_at and sub_module.expires_at < now:
                continue

            module = sub_module.module
            module_capabilities = [
                cap.capability_code for cap in module.capabilities if cap.is_active
            ]

            if module_capabilities:
                capabilities[module.module_code] = module_capabilities

        return capabilities

    # ========================================================================
    # QUOTA ENFORCEMENT
    # ========================================================================

    async def check_quota(
        self,
        tenant_id: UUID,
        quota_code: str,
        requested_quantity: int = 1,
    ) -> dict[str, Any]:
        """
        Check if tenant has quota available.

        Returns:
            {
                "allowed": bool,
                "allocated": int,
                "current": int,
                "available": int,
                "overage_allowed": bool,
                "overage_rate": float,
            }
        """
        # Get active subscription
        result = await self.db.execute(
            select(TenantSubscription)
            .where(
                and_(
                    TenantSubscription.tenant_id == tenant_id,
                    TenantSubscription.status.in_(
                        [
                            SubscriptionStatus.TRIAL,
                            SubscriptionStatus.ACTIVE,
                        ]
                    ),
                )
            )
            .order_by(TenantSubscription.created_at.desc())
        )
        subscription = result.scalar_one_or_none()
        if not subscription:
            raise FeatureNotEntitledError("No active subscription")

        # Get quota definition
        result = await self.db.execute(
            select(QuotaDefinition).where(QuotaDefinition.quota_code == quota_code)
        )
        quota = result.scalar_one_or_none()
        if not quota:
            raise ValueError(f"Quota {quota_code} not found")

        # Get quota allocation for subscription
        result = await self.db.execute(
            select(PlanQuotaAllocation).where(
                and_(
                    PlanQuotaAllocation.plan_id == subscription.plan_id,
                    PlanQuotaAllocation.quota_id == quota.id,
                )
            )
        )
        allocation = result.scalar_one_or_none()
        if not allocation:
            # Quota not included in plan
            return {
                "allowed": False,
                "allocated": 0,
                "current": 0,
                "available": 0,
                "overage_allowed": False,
                "overage_rate": 0.0,
            }

        # Get current usage
        result = await self.db.execute(
            select(SubscriptionQuotaUsage).where(
                and_(
                    SubscriptionQuotaUsage.subscription_id == subscription.id,
                    SubscriptionQuotaUsage.quota_id == quota.id,
                )
            )
        )
        usage = cast(SubscriptionQuotaUsage | None, result.scalar_one_or_none())
        if not usage:
            # Initialize usage tracking
            usage = SubscriptionQuotaUsage(
                id=uuid4(),
                subscription_id=subscription.id,
                quota_id=quota.id,
                period_start=datetime.utcnow(),
                period_end=self._calculate_quota_period_end(datetime.utcnow(), quota.reset_period),
                allocated_quantity=allocation.included_quantity,
                current_usage=0,
                overage_quantity=0,
                overage_charges=0.0,
            )
            self.db.add(usage)
            await self.db.flush()

        assert usage is not None

        # Check if quota period needs reset
        now = datetime.utcnow()
        if usage.period_end and usage.period_end < now:
            # Reset usage for new period
            usage.period_start = now
            usage.period_end = self._calculate_quota_period_end(now, quota.reset_period)
            usage.current_usage = 0
            usage.overage_quantity = 0
            usage.overage_charges = 0.0
            await self.db.flush()

        # Calculate availability
        allocated = allocation.included_quantity
        if allocated == -1:
            # Unlimited
            return {
                "allowed": True,
                "allocated": -1,
                "current": usage.current_usage,
                "available": -1,
                "overage_allowed": False,
                "overage_rate": 0.0,
            }

        available = allocated - usage.current_usage
        overage_rate = allocation.overage_rate_override or quota.overage_rate

        if available >= requested_quantity:
            allowed = True
        elif allocation.allow_overage:
            allowed = True  # Will charge overage
        else:
            allowed = False

        return {
            "allowed": allowed,
            "allocated": allocated,
            "current": usage.current_usage,
            "available": available,
            "overage_allowed": allocation.allow_overage,
            "overage_rate": overage_rate,
            "soft_limit": allocation.soft_limit,
        }

    async def consume_quota(
        self,
        tenant_id: UUID,
        quota_code: str,
        quantity: int = 1,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Consume quota and track usage.

        Returns:
            {
                "success": bool,
                "new_usage": int,
                "overage": int,
                "overage_charge": float,
            }
        """
        # Check quota first
        check = await self.check_quota(tenant_id, quota_code, quantity)
        if not check["allowed"]:
            raise QuotaExceededError(
                f"Quota {quota_code} exceeded. Allocated: {check['allocated']}, "
                f"Current: {check['current']}, Requested: {quantity}"
            )

        # Get subscription and usage
        result = await self.db.execute(
            select(TenantSubscription)
            .where(
                and_(
                    TenantSubscription.tenant_id == tenant_id,
                    TenantSubscription.status.in_(
                        [
                            SubscriptionStatus.TRIAL,
                            SubscriptionStatus.ACTIVE,
                        ]
                    ),
                )
            )
            .order_by(TenantSubscription.created_at.desc())
        )
        subscription = result.scalar_one_or_none()
        if not subscription:
            raise ValueError(f"Subscription not found for tenant {tenant_id}")

        result = await self.db.execute(
            select(QuotaDefinition).where(QuotaDefinition.quota_code == quota_code)
        )
        quota = result.scalar_one_or_none()
        if not quota:
            raise ValueError(f"Quota definition for '{quota_code}' not found")

        result = await self.db.execute(
            select(SubscriptionQuotaUsage).where(
                and_(
                    SubscriptionQuotaUsage.subscription_id == subscription.id,
                    SubscriptionQuotaUsage.quota_id == quota.id,
                )
            )
        )
        usage = cast(SubscriptionQuotaUsage | None, result.scalar_one_or_none())
        if usage is None:
            raise ValueError(f"Quota usage for '{quota_code}' not found")

        # Update usage
        usage.current_usage += quantity
        overage = 0
        overage_charge = 0.0

        if check["allocated"] != -1 and usage.current_usage > check["allocated"]:
            overage = usage.current_usage - check["allocated"]
            usage.overage_quantity = overage
            overage_charge = overage * check["overage_rate"]
            usage.overage_charges += overage_charge

        # Log usage
        log = FeatureUsageLog(
            id=uuid4(),
            subscription_id=subscription.id,
            module_id=None,  # Could be associated if needed
            feature_name=quota_code,
            usage_count=quantity,
            metadata=metadata or {},
        )
        self.db.add(log)

        await self.db.commit()

        return {
            "success": True,
            "new_usage": usage.current_usage,
            "overage": overage,
            "overage_charge": overage_charge,
        }

    async def release_quota(
        self,
        tenant_id: UUID,
        quota_code: str,
        quantity: int = 1,
    ) -> None:
        """Release quota (e.g., when user is deleted)."""
        # Get subscription and usage
        result = await self.db.execute(
            select(TenantSubscription)
            .where(
                and_(
                    TenantSubscription.tenant_id == tenant_id,
                    TenantSubscription.status.in_(
                        [
                            SubscriptionStatus.TRIAL,
                            SubscriptionStatus.ACTIVE,
                        ]
                    ),
                )
            )
            .order_by(TenantSubscription.created_at.desc())
        )
        subscription = result.scalar_one_or_none()
        if not subscription:
            return

        result = await self.db.execute(
            select(QuotaDefinition).where(QuotaDefinition.quota_code == quota_code)
        )
        quota = result.scalar_one_or_none()
        if not quota:
            return

        result = await self.db.execute(
            select(SubscriptionQuotaUsage).where(
                and_(
                    SubscriptionQuotaUsage.subscription_id == subscription.id,
                    SubscriptionQuotaUsage.quota_id == quota.id,
                )
            )
        )
        usage = cast(SubscriptionQuotaUsage | None, result.scalar_one_or_none())
        if usage is None:
            return

        # Decrease usage
        usage.current_usage = max(0, usage.current_usage - quantity)

        # Recalculate overage
        result = await self.db.execute(
            select(PlanQuotaAllocation).where(
                and_(
                    PlanQuotaAllocation.plan_id == subscription.plan_id,
                    PlanQuotaAllocation.quota_id == quota.id,
                )
            )
        )
        allocation = result.scalar_one_or_none()
        if allocation and allocation.included_quantity != -1:
            if usage.current_usage > allocation.included_quantity:
                usage.overage_quantity = usage.current_usage - allocation.included_quantity
                overage_rate = allocation.overage_rate_override or quota.overage_rate
                usage.overage_charges = usage.overage_quantity * overage_rate
            else:
                usage.overage_quantity = 0
                usage.overage_charges = 0.0

        await self.db.commit()

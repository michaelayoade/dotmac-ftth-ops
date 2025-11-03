"""
Pricing engine service.

Simple pricing calculations with rule-based discounts - first match wins approach.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

import structlog
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.catalog.service import ProductService
from dotmac.platform.billing.currency.service import CurrencyRateService
from dotmac.platform.billing.exceptions import (
    InvalidPricingRuleError,
    PricingError,
)
from dotmac.platform.billing.models import (
    BillingPricingRuleTable,
    BillingRuleUsageTable,
)
from dotmac.platform.billing.money_utils import money_handler
from dotmac.platform.billing.pricing.models import (
    DiscountType,
    PriceAdjustment,
    PriceCalculationContext,
    PriceCalculationRequest,
    PriceCalculationResult,
    PricingRule,
    PricingRuleCreateRequest,
    PricingRuleUpdateRequest,
)
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


def generate_rule_id() -> str:
    """Generate unique pricing rule ID."""
    return f"rule_{uuid4().hex[:12]}"


def generate_usage_id() -> str:
    """Generate unique rule usage ID."""
    return f"usage_{uuid4().hex[:12]}"


class PricingEngine:
    """Simple pricing engine with rule-based discounts."""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.product_service = ProductService(db_session)

    # ========================================
    # Pricing Rule Management
    # ========================================

    async def create_pricing_rule(
        self, rule_data: PricingRuleCreateRequest, tenant_id: str
    ) -> PricingRule:
        """Create a new pricing rule."""

        # Validate rule makes sense
        if not (
            rule_data.applies_to_all
            or rule_data.applies_to_product_ids
            or rule_data.applies_to_categories
        ):
            raise InvalidPricingRuleError(
                "Rule must apply to at least something (products, categories, or all)"
            )

        # Validate discount value based on type
        if rule_data.discount_type == DiscountType.PERCENTAGE:
            max_discount = settings.billing.max_discount_percentage
            if rule_data.discount_value > max_discount:
                raise InvalidPricingRuleError(f"Percentage discount cannot exceed {max_discount}%")

        # Create database record
        db_rule = BillingPricingRuleTable(
            rule_id=generate_rule_id(),
            tenant_id=tenant_id,
            name=rule_data.name,
            applies_to_product_ids=rule_data.applies_to_product_ids,
            applies_to_categories=rule_data.applies_to_categories,
            applies_to_all=rule_data.applies_to_all,
            min_quantity=rule_data.min_quantity,
            customer_segments=rule_data.customer_segments,
            discount_type=rule_data.discount_type.value,
            discount_value=rule_data.discount_value,
            starts_at=rule_data.starts_at,
            ends_at=rule_data.ends_at,
            max_uses=rule_data.max_uses,
            metadata_json=rule_data.metadata,
        )

        self.db.add(db_rule)
        await self.db.commit()
        await self.db.refresh(db_rule)

        rule = self._db_to_pydantic_rule(db_rule)

        logger.info(
            "Pricing rule created",
            rule_id=rule.rule_id,
            name=rule.name,
            discount_type=rule.discount_type,
            discount_value=str(rule.discount_value),
            tenant_id=tenant_id,
        )

        return rule

    async def get_pricing_rule(self, rule_id: str, tenant_id: str) -> PricingRule:
        """Get pricing rule by ID."""

        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if not db_rule:
            raise PricingError(f"Pricing rule {rule_id} not found")

        return self._db_to_pydantic_rule(db_rule)

    async def list_pricing_rules(
        self,
        tenant_id: str,
        active_only: bool = True,
        product_id: str | None = None,
        category: str | None = None,
    ) -> list[PricingRule]:
        """List pricing rules with filtering."""

        stmt = select(BillingPricingRuleTable).where(BillingPricingRuleTable.tenant_id == tenant_id)

        if active_only:
            stmt = stmt.where(BillingPricingRuleTable.is_active)

        if product_id:
            # Rules that apply to this specific product or to all products
            stmt = stmt.where(
                or_(
                    BillingPricingRuleTable.applies_to_all,
                    BillingPricingRuleTable.applies_to_product_ids.contains([product_id]),
                )
            )

        if category:
            # Rules that apply to this category or to all products
            stmt = stmt.where(
                or_(
                    BillingPricingRuleTable.applies_to_all,
                    BillingPricingRuleTable.applies_to_categories.contains([category]),
                )
            )

        # Order by name (priority column not yet in database table)
        stmt = stmt.order_by(BillingPricingRuleTable.name)

        result = await self.db.execute(stmt)
        db_rules = result.scalars().all()

        return [self._db_to_pydantic_rule(db_rule) for db_rule in db_rules]

    async def update_pricing_rule(
        self, rule_id: str, updates: PricingRuleUpdateRequest, tenant_id: str
    ) -> PricingRule:
        """Update pricing rule."""

        # Get existing rule
        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if not db_rule:
            raise PricingError(f"Pricing rule {rule_id} not found")

        # Apply updates
        update_data = updates.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "metadata":
                db_rule.metadata_json = value
            else:
                setattr(db_rule, field, value)

        await self.db.commit()
        await self.db.refresh(db_rule)

        rule = self._db_to_pydantic_rule(db_rule)

        logger.info(
            "Pricing rule updated",
            rule_id=rule_id,
            updates=list(update_data.keys()),
            tenant_id=tenant_id,
        )

        return rule

    async def deactivate_pricing_rule(self, rule_id: str, tenant_id: str) -> PricingRule:
        """Deactivate pricing rule."""

        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if not db_rule:
            raise PricingError(f"Pricing rule {rule_id} not found")

        db_rule.is_active = False

        await self.db.commit()
        await self.db.refresh(db_rule)

        rule = self._db_to_pydantic_rule(db_rule)

        logger.info(
            "Pricing rule deactivated",
            rule_id=rule_id,
            tenant_id=tenant_id,
        )

        return rule

    async def delete_pricing_rule(self, rule_id: str, tenant_id: str) -> None:
        """
        Delete pricing rule permanently.

        This is a hard delete that removes the rule from the database.
        Use deactivate_pricing_rule() for soft deletes.
        """
        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if not db_rule:
            raise PricingError(f"Pricing rule {rule_id} not found")

        # Delete the rule
        await self.db.delete(db_rule)
        await self.db.commit()

        logger.info(
            "Pricing rule deleted",
            rule_id=rule_id,
            tenant_id=tenant_id,
        )

    # ========================================
    # Price Calculation Engine
    # ========================================

    async def calculate_price(
        self, request: PriceCalculationRequest, tenant_id: str
    ) -> PriceCalculationResult:
        """Calculate final price with applicable rules - first match wins."""

        # Get product information
        product = await self.product_service.get_product(request.product_id, tenant_id)

        if not product:
            raise PricingError(f"Product not found: {request.product_id}")

        currency_value = request.currency or getattr(product, "currency", None)
        if not isinstance(currency_value, str) or not currency_value:
            currency_value = settings.billing.default_currency
        calculation_currency = currency_value.upper()

        # Build calculation context
        context = PriceCalculationContext(
            product_id=product.product_id,
            quantity=request.quantity,
            customer_id=request.customer_id,
            customer_segments=request.customer_segments,
            product_category=product.category,
            base_price=product.base_price,
            calculation_date=request.calculation_date or datetime.now(UTC),
            metadata=request.metadata,
            currency=calculation_currency,
        )

        # Calculate base subtotal
        subtotal = product.base_price * request.quantity

        # Get applicable rules
        applicable_rules = await self._get_applicable_rules(context, tenant_id)

        # Apply rules - SIMPLE APPROACH: First qualifying rule wins
        final_price = subtotal
        applied_adjustments: list[PriceAdjustment] = []

        for rule in applicable_rules:
            if await self._rule_applies(rule, context, tenant_id):
                adjustment = self._apply_rule(rule, final_price, context)
                applied_adjustments.append(adjustment)
                final_price = adjustment.adjusted_price

                # Record rule usage
                await self._record_rule_usage(rule, context, tenant_id)

                # FIRST MATCH WINS - break after first applicable rule
                break

        # Calculate total discount
        total_discount = subtotal - final_price

        result = PriceCalculationResult(
            product_id=request.product_id,
            quantity=request.quantity,
            customer_id=request.customer_id,
            base_price=product.base_price,
            subtotal=subtotal,
            total_discount_amount=total_discount,
            final_price=final_price,
            applied_adjustments=applied_adjustments,
            currency=calculation_currency,
        )

        if (
            settings.billing.enable_multi_currency
            and calculation_currency != settings.billing.default_currency.upper()
        ):
            rate_service = CurrencyRateService(self.db)
            money_value = money_handler.create_money(final_price, calculation_currency)
            converted = await rate_service.convert_money(
                money_value, settings.billing.default_currency
            )
            result.normalized_currency = settings.billing.default_currency.upper()
            result.normalized_amount = converted.amount

        logger.info(
            "Price calculated",
            product_id=request.product_id,
            quantity=request.quantity,
            customer_id=request.customer_id,
            base_price=str(product.base_price),
            final_price=str(final_price),
            discount_amount=str(total_discount),
            rules_applied=len(applied_adjustments),
            tenant_id=tenant_id,
        )

        return result

    async def calculate_subscription_price(
        self,
        plan_id: str,
        customer_id: str,
        customer_segments: list[str],
        custom_price: Decimal | None,
        tenant_id: str,
    ) -> PriceCalculationResult:
        """Calculate subscription pricing with customer overrides and rules."""

        # Import here to avoid circular dependency
        from dotmac.platform.billing.subscriptions.service import SubscriptionService

        subscription_service = SubscriptionService(self.db)
        plan = await subscription_service.get_plan(plan_id, tenant_id)

        # Use custom price if set, otherwise plan price
        effective_price = plan.price if custom_price is None else custom_price
        plan_currency = getattr(plan, "currency", settings.billing.default_currency).upper()

        # Build simple context for subscription
        context = PriceCalculationContext(
            product_id=plan.product_id,
            quantity=1,  # Subscriptions are typically quantity 1
            customer_id=customer_id,
            customer_segments=customer_segments,
            product_category="subscription",  # Special category
            base_price=effective_price,
            currency=plan_currency,
        )

        # Get subscription-specific rules
        applicable_rules = await self._get_applicable_rules(context, tenant_id)

        # Apply first matching rule
        final_price = effective_price
        applied_adjustments: list[PriceAdjustment] = []

        for rule in applicable_rules:
            if await self._rule_applies(rule, context, tenant_id):
                adjustment = self._apply_rule(rule, final_price, context)
                applied_adjustments.append(adjustment)
                final_price = adjustment.adjusted_price

                # Record usage
                await self._record_rule_usage(rule, context, tenant_id)
                break  # First match wins

        result = PriceCalculationResult(
            product_id=plan.product_id,
            quantity=1,
            customer_id=customer_id,
            base_price=effective_price,
            subtotal=effective_price,
            total_discount_amount=effective_price - final_price,
            final_price=final_price,
            applied_adjustments=applied_adjustments,
            currency=plan_currency,
        )

        if (
            settings.billing.enable_multi_currency
            and plan_currency != settings.billing.default_currency.upper()
        ):
            rate_service = CurrencyRateService(self.db)
            money_value = money_handler.create_money(final_price, plan_currency)
            converted = await rate_service.convert_money(
                money_value, settings.billing.default_currency
            )
            result.normalized_currency = settings.billing.default_currency.upper()
            result.normalized_amount = converted.amount

        return result

    # ========================================
    # Private Helper Methods
    # ========================================

    async def _get_applicable_rules(
        self, context: PriceCalculationContext, tenant_id: str
    ) -> list[PricingRule]:
        """Get rules that might apply to this calculation context."""

        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.tenant_id == tenant_id,
                BillingPricingRuleTable.is_active,
            )
        )

        # Filter by time constraints
        now = context.calculation_date
        stmt = stmt.where(
            or_(
                BillingPricingRuleTable.starts_at.is_(None),
                BillingPricingRuleTable.starts_at <= now,
            )
        )
        stmt = stmt.where(
            or_(BillingPricingRuleTable.ends_at.is_(None), BillingPricingRuleTable.ends_at > now)
        )

        # Filter by product/category applicability
        stmt = stmt.where(
            or_(
                BillingPricingRuleTable.applies_to_all,
                BillingPricingRuleTable.applies_to_product_ids.contains([context.product_id]),
                BillingPricingRuleTable.applies_to_categories.contains(
                    [context.product_category or ""]
                ),
            )
        )

        # Order by name (priority column not yet in database table)
        stmt = stmt.order_by(BillingPricingRuleTable.name)

        result = await self.db.execute(stmt)
        db_rules = result.scalars().all()

        return [self._db_to_pydantic_rule(db_rule) for db_rule in db_rules]

    async def _rule_applies(
        self, rule: PricingRule, context: PriceCalculationContext, tenant_id: str
    ) -> bool:
        """Check if a rule applies to the given context."""

        # Check quantity requirement
        if rule.min_quantity and context.quantity < rule.min_quantity:
            return False

        # Check customer segments
        if rule.customer_segments:
            if not any(segment in context.customer_segments for segment in rule.customer_segments):
                return False

        # Check usage limits
        if rule.max_uses is not None:
            if rule.current_uses >= rule.max_uses:
                return False

        return True

    def _apply_rule(
        self, rule: PricingRule, current_price: Decimal, context: PriceCalculationContext
    ) -> PriceAdjustment:
        """Apply a pricing rule and return the adjustment."""

        original_price = current_price

        if rule.discount_type == DiscountType.PERCENTAGE:
            # Percentage discount
            discount_amount = current_price * (rule.discount_value / 100)
            adjusted_price = current_price - discount_amount

        elif rule.discount_type == DiscountType.FIXED_AMOUNT:
            # Fixed amount discount
            discount_amount = rule.discount_value
            adjusted_price = max(Decimal("0"), current_price - discount_amount)

        elif rule.discount_type == DiscountType.FIXED_PRICE:
            # Set to fixed price
            adjusted_price = rule.discount_value
            discount_amount = current_price - adjusted_price

        else:
            raise PricingError(f"Unsupported discount type: {rule.discount_type}")

        # Ensure price doesn't go negative
        adjusted_price = max(Decimal("0"), adjusted_price)
        discount_amount = original_price - adjusted_price

        return PriceAdjustment(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            discount_type=rule.discount_type,
            discount_value=rule.discount_value,
            original_price=original_price,
            discount_amount=discount_amount,
            adjusted_price=adjusted_price,
        )

    async def _record_rule_usage(
        self, rule: PricingRule, context: PriceCalculationContext, tenant_id: str
    ) -> None:
        """Record that a rule was used."""

        # Create usage record
        db_usage = BillingRuleUsageTable(
            usage_id=generate_usage_id(),
            tenant_id=tenant_id,
            rule_id=rule.rule_id,
            customer_id=context.customer_id,
            # invoice_id will be set later when invoice is created
        )

        self.db.add(db_usage)

        # Update rule usage count
        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule.rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if db_rule:
            current_uses_raw = getattr(db_rule, "current_uses", 0)
            current_uses = Decimal(str(current_uses_raw))
            db_rule.current_uses = current_uses + Decimal(1)

        await self.db.commit()

    def _db_to_pydantic_rule(self, db_rule: BillingPricingRuleTable) -> PricingRule:
        """Convert database rule to Pydantic model."""
        # Extract values from SQLAlchemy columns
        rule_id: str = str(db_rule.rule_id)
        tenant_id: str = str(db_rule.tenant_id)
        name: str = str(db_rule.name)
        description_raw = getattr(db_rule, "description", None)
        description: str | None = str(description_raw) if description_raw else None
        applies_to_all: bool = bool(db_rule.applies_to_all)
        is_active: bool = bool(db_rule.is_active)

        # Handle list fields
        applies_to_product_ids_raw = getattr(db_rule, "applies_to_product_ids", None)
        applies_to_product_ids: list[str] = (
            applies_to_product_ids_raw if applies_to_product_ids_raw else []
        )

        applies_to_categories_raw = getattr(db_rule, "applies_to_categories", None)
        applies_to_categories: list[str] = (
            applies_to_categories_raw if applies_to_categories_raw else []
        )

        customer_segments_raw = getattr(db_rule, "customer_segments", None)
        customer_segments: list[str] = customer_segments_raw if customer_segments_raw else []

        # Handle numeric fields
        min_quantity_raw = getattr(db_rule, "min_quantity", None)
        min_quantity: int | None = int(min_quantity_raw) if min_quantity_raw is not None else None

        discount_value: Decimal = Decimal(str(db_rule.discount_value))
        discount_type_value: str = str(db_rule.discount_type)

        max_uses_raw = getattr(db_rule, "max_uses", None)
        max_uses: int | None = int(max_uses_raw) if max_uses_raw is not None else None

        current_uses: int = int(getattr(db_rule, "current_uses", 0))

        # Handle datetime fields
        starts_at: datetime | None = getattr(db_rule, "starts_at", None)
        ends_at: datetime | None = getattr(db_rule, "ends_at", None)
        created_at: datetime = getattr(db_rule, "created_at", datetime.now(UTC))
        updated_at: datetime = getattr(db_rule, "updated_at", datetime.now(UTC))

        # Handle metadata
        metadata: dict[str, Any] = getattr(db_rule, "metadata_json", None) or {}

        return PricingRule(
            rule_id=rule_id,
            tenant_id=tenant_id,
            name=name,
            description=description,
            applies_to_product_ids=applies_to_product_ids,
            applies_to_categories=applies_to_categories,
            applies_to_all=applies_to_all,
            min_quantity=min_quantity,
            customer_segments=customer_segments,
            discount_type=DiscountType(discount_type_value),
            discount_value=discount_value,
            starts_at=starts_at,
            ends_at=ends_at,
            max_uses=max_uses,
            current_uses=current_uses,
            is_active=is_active,
            metadata=metadata,
            created_at=created_at,
            updated_at=updated_at,
        )

    async def get_applicable_rules(
        self, request: PriceCalculationRequest, tenant_id: str
    ) -> list[PricingRule]:
        """Get rules that would apply for given request (for testing/preview)."""
        product = await self.product_service.get_product(request.product_id, tenant_id)

        currency_value = request.currency or getattr(product, "currency", None)
        if not isinstance(currency_value, str) or not currency_value:
            currency_value = settings.billing.default_currency
        calculation_currency = currency_value.upper()

        context = PriceCalculationContext(
            product_id=request.product_id,
            quantity=request.quantity,
            customer_id=request.customer_id,
            customer_segments=request.customer_segments,
            product_category=product.category if product else None,
            base_price=product.base_price if product else Decimal("0"),
            currency=calculation_currency,
            calculation_date=request.calculation_date or datetime.now(UTC),
            metadata=request.metadata,
        )

        return await self._get_applicable_rules(context, tenant_id)

    async def get_rule_usage_stats(self, rule_id: str, tenant_id: str) -> dict[str, Any] | None:
        """Get usage statistics for a pricing rule."""
        # Get rule details
        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if not db_rule:
            return None

        # Get usage count from rule usage table
        from sqlalchemy import func

        usage_stmt = select(func.count(BillingRuleUsageTable.usage_id)).where(
            and_(
                BillingRuleUsageTable.rule_id == rule_id,
                BillingRuleUsageTable.tenant_id == tenant_id,
            )
        )
        usage_result = await self.db.execute(usage_stmt)
        actual_usage_count = usage_result.scalar() or 0

        return {
            "rule_id": rule_id,
            "rule_name": db_rule.name,
            "current_uses": db_rule.current_uses,
            "actual_usage_count": actual_usage_count,
            "max_uses": db_rule.max_uses,
            "usage_remaining": (
                (db_rule.max_uses - db_rule.current_uses) if db_rule.max_uses else None
            ),
            "is_active": db_rule.is_active,
            "created_at": db_rule.created_at.isoformat(),
        }

    async def reset_rule_usage(self, rule_id: str, tenant_id: str) -> bool:
        """Reset usage counter for a pricing rule."""
        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if not db_rule:
            return False

        db_rule.current_uses = Decimal(0)
        await self.db.commit()
        return True

    async def activate_rule(self, rule_id: str, tenant_id: str) -> bool:
        """Activate a pricing rule."""
        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if not db_rule:
            return False

        db_rule.is_active = True
        await self.db.commit()
        return True

    async def deactivate_rule(self, rule_id: str, tenant_id: str) -> bool:
        """Deactivate a pricing rule."""
        stmt = select(BillingPricingRuleTable).where(
            and_(
                BillingPricingRuleTable.rule_id == rule_id,
                BillingPricingRuleTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_rule = result.scalar_one_or_none()

        if not db_rule:
            return False

        db_rule.is_active = False
        await self.db.commit()
        return True

    async def detect_rule_conflicts(self, tenant_id: str) -> list[dict[str, Any]]:
        """Detect potential conflicts between pricing rules."""
        conflicts: list[dict[str, Any]] = []

        stmt = (
            select(BillingPricingRuleTable)
            .where(
                and_(
                    BillingPricingRuleTable.tenant_id == tenant_id,
                    BillingPricingRuleTable.is_active,
                )
            )
            .order_by(BillingPricingRuleTable.name)  # priority column not yet in database table
        )

        result = await self.db.execute(stmt)
        db_rules = result.scalars().all()

        rules = [self._db_to_pydantic_rule(rule) for rule in db_rules]

        # Check for overlapping rules with same priority
        priority_groups: dict[int, list[PricingRule]] = {}
        for rule in rules:
            if rule.priority not in priority_groups:
                priority_groups[rule.priority] = []
            priority_groups[rule.priority].append(rule)

        for priority, priority_rules in priority_groups.items():
            if len(priority_rules) > 1:
                # Check for overlapping conditions
                for i, rule1 in enumerate(priority_rules):
                    for rule2 in priority_rules[i + 1 :]:
                        if self._rules_overlap(rule1, rule2):
                            conflicts.append(
                                {
                                    "type": "priority_overlap",
                                    "rule1": {"id": rule1.rule_id, "name": rule1.name},
                                    "rule2": {"id": rule2.rule_id, "name": rule2.name},
                                    "priority": priority,
                                    "description": f"Rules '{rule1.name}' and '{rule2.name}' have same priority and overlapping conditions",
                                }
                            )

        return conflicts

    def _rules_overlap(self, rule1: PricingRule, rule2: PricingRule) -> bool:
        """Check if two rules have overlapping conditions."""
        # Check product overlap
        if rule1.applies_to_all or rule2.applies_to_all:
            return True

        product_overlap = bool(
            set(rule1.applies_to_product_ids) & set(rule2.applies_to_product_ids)
        )

        category_overlap = bool(set(rule1.applies_to_categories) & set(rule2.applies_to_categories))

        if not (product_overlap or category_overlap):
            return False

        # Check customer segment overlap
        if rule1.customer_segments and rule2.customer_segments:
            segment_overlap = bool(set(rule1.customer_segments) & set(rule2.customer_segments))
            if not segment_overlap:
                return False

        return True

    async def bulk_activate_rules(self, rule_ids: list[str], tenant_id: str) -> dict[str, Any]:
        """Activate multiple rules at once."""
        activated = 0
        failed = 0
        errors: list[str] = []

        for rule_id in rule_ids:
            try:
                success = await self.activate_rule(rule_id, tenant_id)
                if success:
                    activated += 1
                else:
                    failed += 1
                    errors.append(f"Rule {rule_id} not found")
            except Exception as e:
                failed += 1
                errors.append(f"Rule {rule_id}: {str(e)}")

        return {"activated": activated, "failed": failed, "errors": errors}

    async def bulk_deactivate_rules(self, rule_ids: list[str], tenant_id: str) -> dict[str, Any]:
        """Deactivate multiple rules at once."""
        deactivated = 0
        failed = 0
        errors: list[str] = []

        for rule_id in rule_ids:
            try:
                success = await self.deactivate_rule(rule_id, tenant_id)
                if success:
                    deactivated += 1
                else:
                    failed += 1
                    errors.append(f"Rule {rule_id} not found")
            except Exception as e:
                failed += 1
                errors.append(f"Rule {rule_id}: {str(e)}")

        return {"deactivated": deactivated, "failed": failed, "errors": errors}

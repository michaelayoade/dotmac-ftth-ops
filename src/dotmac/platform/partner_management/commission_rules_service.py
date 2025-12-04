"""
Commission Rules Service - Business logic for partner commission rules management.

Provides CRUD operations and rule evaluation for partner commission configurations.
"""

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.partner_management.models import Partner, PartnerCommission
from dotmac.platform.partner_management.schemas import (
    PartnerCommissionRuleCreate,
    PartnerCommissionRuleUpdate,
)

logger = structlog.get_logger(__name__)


class CommissionRulesService:
    """Service for managing partner commission rules."""

    def __init__(self, session: AsyncSession):
        """
        Initialize commission rules service.

        Args:
            session: Async database session
        """
        self.session = session

    async def create_rule(
        self,
        data: PartnerCommissionRuleCreate,
        created_by: UUID | None = None,
    ) -> PartnerCommission:
        """
        Create a new commission rule.

        Args:
            data: Commission rule creation data
            created_by: User ID of creator

        Returns:
            Created commission rule

        Raises:
            ValueError: If partner doesn't exist or validation fails
        """
        # Verify partner exists
        partner_result = await self.session.execute(
            select(Partner).where(Partner.id == data.partner_id)
        )
        partner = partner_result.scalar_one_or_none()
        if not partner:
            raise ValueError(f"Partner {data.partner_id} not found")

        # Validate commission model configuration
        self._validate_commission_config(data)

        # Create rule
        rule = PartnerCommission(
            partner_id=data.partner_id,
            tenant_id=partner.tenant_id,
            rule_name=data.rule_name,
            description=data.description,
            commission_type=data.commission_type,
            commission_rate=data.commission_rate,
            flat_fee_amount=data.flat_fee_amount,
            tier_config=data.tier_config,
            applies_to_products=data.applies_to_products,
            applies_to_customers=data.applies_to_customers,
            effective_from=data.effective_from,
            effective_to=data.effective_to,
            is_active=data.is_active,
        )

        self.session.add(rule)
        await self.session.commit()
        await self.session.refresh(rule)

        logger.info(
            "Commission rule created",
            rule_id=rule.id,
            partner_id=data.partner_id,
            rule_name=data.rule_name,
            commission_type=data.commission_type.value,
            created_by=created_by,
        )

        return rule

    async def get_rule(self, rule_id: UUID) -> PartnerCommission | None:
        """
        Get commission rule by ID.

        Args:
            rule_id: Rule ID

        Returns:
            Commission rule or None if not found
        """
        result = await self.session.execute(
            select(PartnerCommission).where(PartnerCommission.id == rule_id)
        )
        return result.scalar_one_or_none()

    async def list_rules(
        self,
        partner_id: UUID | None = None,
        is_active: bool | None = None,
        effective_date: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[Sequence[PartnerCommission], int]:
        """
        List commission rules with filters.

        Args:
            partner_id: Filter by partner ID
            is_active: Filter by active status
            effective_date: Filter by rules effective on this date
            limit: Maximum number of results
            offset: Offset for pagination

        Returns:
            Tuple of (rules list, total count)
        """
        # Build query
        query = select(PartnerCommission)
        count_query = select(func.count()).select_from(PartnerCommission)

        # Apply filters
        filters = []
        if partner_id is not None:
            filters.append(PartnerCommission.partner_id == partner_id)
        if is_active is not None:
            filters.append(PartnerCommission.is_active == is_active)
        if effective_date is not None:
            filters.append(
                and_(
                    PartnerCommission.effective_from <= effective_date,
                    or_(
                        PartnerCommission.effective_to.is_(None),
                        PartnerCommission.effective_to >= effective_date,
                    ),
                )
            )

        if filters:
            query = query.where(and_(*filters))
            count_query = count_query.where(and_(*filters))

        # Get total count
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Apply ordering and pagination
        query = query.order_by(
            PartnerCommission.partner_id,
            PartnerCommission.effective_from.desc(),
        )
        query = query.limit(limit).offset(offset)

        # Execute query
        result = await self.session.execute(query)
        rules = result.scalars().all()

        return rules, total

    async def update_rule(
        self,
        rule_id: UUID,
        data: PartnerCommissionRuleUpdate,
        updated_by: UUID | None = None,
    ) -> PartnerCommission | None:
        """
        Update commission rule.

        Args:
            rule_id: Rule ID
            data: Update data
            updated_by: User ID of updater

        Returns:
            Updated rule or None if not found

        Raises:
            ValueError: If validation fails
        """
        # Get existing rule
        rule = await self.get_rule(rule_id)
        if not rule:
            return None

        # Validate if commission model is being updated
        if data.commission_type is not None:
            # Create temporary object for validation
            temp_data = PartnerCommissionRuleCreate(
                partner_id=rule.partner_id,
                rule_name=data.rule_name or rule.rule_name,
                commission_type=data.commission_type,
                commission_rate=data.commission_rate
                if data.commission_rate is not None
                else rule.commission_rate,
                flat_fee_amount=data.flat_fee_amount
                if data.flat_fee_amount is not None
                else rule.flat_fee_amount,
                tier_config=data.tier_config if data.tier_config is not None else rule.tier_config,
                effective_from=data.effective_from or rule.effective_from,
                applies_to_products=data.applies_to_products,
                applies_to_customers=data.applies_to_customers,
            )
            self._validate_commission_config(temp_data)

        # Update fields
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(rule, field, value)

        await self.session.commit()
        await self.session.refresh(rule)

        logger.info(
            "Commission rule updated",
            rule_id=rule_id,
            updated_fields=list(update_data.keys()),
            updated_by=updated_by,
        )

        return rule

    async def delete_rule(
        self,
        rule_id: UUID,
        deleted_by: UUID | None = None,
    ) -> bool:
        """
        Delete (deactivate) commission rule.

        This is a soft delete - sets is_active to False rather than removing the record.

        Args:
            rule_id: Rule ID
            deleted_by: User ID of deleter

        Returns:
            True if deleted, False if not found
        """
        rule = await self.get_rule(rule_id)
        if not rule:
            return False

        rule.is_active = False
        await self.session.commit()

        logger.info(
            "Commission rule deleted",
            rule_id=rule_id,
            partner_id=rule.partner_id,
            deleted_by=deleted_by,
        )

        return True

    async def get_applicable_rules(
        self,
        partner_id: UUID,
        product_id: str | None = None,
        customer_id: str | None = None,
        evaluation_date: datetime | None = None,
    ) -> Sequence[PartnerCommission]:
        """
        Get applicable commission rules for a scenario.

        Rules are returned in priority order (lower priority number = higher precedence).

        Args:
            partner_id: Partner ID
            product_id: Optional product ID to match
            customer_id: Optional customer ID to match
            evaluation_date: Date to evaluate rules (defaults to now)

        Returns:
            List of applicable rules in priority order
        """
        if evaluation_date is None:
            evaluation_date = datetime.now(UTC)

        # Build query
        query = select(PartnerCommission).where(
            and_(
                PartnerCommission.partner_id == partner_id,
                PartnerCommission.is_active.is_(True),
                PartnerCommission.effective_from <= evaluation_date,
                or_(
                    PartnerCommission.effective_to.is_(None),
                    PartnerCommission.effective_to >= evaluation_date,
                ),
            )
        )

        # Apply product/customer filters
        filters = []
        if product_id:
            filters.append(
                or_(
                    PartnerCommission.applies_to_products.is_(None),
                    PartnerCommission.applies_to_products.contains([product_id]),
                )
            )
        if customer_id:
            filters.append(
                or_(
                    PartnerCommission.applies_to_customers.is_(None),
                    PartnerCommission.applies_to_customers.contains([customer_id]),
                )
            )

        if filters:
            query = query.where(and_(*filters))

        # Order by priority (lower number = higher priority)
        query = query.order_by(PartnerCommission.effective_from.desc())

        result = await self.session.execute(query)
        return result.scalars().all()

    def _validate_commission_config(
        self,
        data: PartnerCommissionRuleCreate,
    ) -> None:
        """
        Validate commission configuration based on type.

        Args:
            data: Commission rule data

        Raises:
            ValueError: If configuration is invalid
        """
        commission_type = data.commission_type

        if commission_type.value == "revenue_share":
            if data.commission_rate is None or data.commission_rate <= 0:
                raise ValueError("Revenue share model requires a valid commission_rate > 0")

        elif commission_type.value == "flat_fee":
            if data.flat_fee_amount is None or data.flat_fee_amount <= 0:
                raise ValueError("Flat fee model requires a valid flat_fee_amount > 0")

        elif commission_type.value == "tiered":
            if not data.tier_config or not isinstance(data.tier_config, dict):
                raise ValueError("Tiered model requires tier_config")
            # Validate tier structure
            if "tiers" not in data.tier_config:
                raise ValueError("tier_config must contain 'tiers' array")
            tiers = data.tier_config.get("tiers", [])
            if not tiers:
                raise ValueError("At least one tier must be defined")
            # Validate each tier
            for idx, tier in enumerate(tiers):
                if not all(k in tier for k in ["min_volume", "rate"]):
                    raise ValueError(f"Tier {idx} must have 'min_volume' and 'rate' fields")

        elif commission_type.value == "hybrid":
            if data.commission_rate is None or data.commission_rate <= 0:
                raise ValueError("Hybrid model requires a valid commission_rate > 0")
            if data.flat_fee_amount is None or data.flat_fee_amount <= 0:
                raise ValueError("Hybrid model requires a valid flat_fee_amount > 0")

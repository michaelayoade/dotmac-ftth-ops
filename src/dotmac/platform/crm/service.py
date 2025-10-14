"""
CRM Service Layer.

Provides business logic for lead management, quote generation, and site surveys.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.core.exceptions import EntityNotFoundError, ValidationError
from dotmac.platform.crm.models import (
    Lead,
    LeadSource,
    LeadStatus,
    Quote,
    QuoteStatus,
    Serviceability,
    SiteSurvey,
    SiteSurveyStatus,
)
from dotmac.platform.customer_management.models import Customer


class LeadService:
    """Service for managing leads in the sales pipeline."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_lead(
        self,
        tenant_id: str,
        first_name: str,
        last_name: str,
        email: str,
        service_address_line1: str,
        service_city: str,
        service_state_province: str,
        service_postal_code: str,
        source: LeadSource = LeadSource.WEBSITE,
        phone: str | None = None,
        company_name: str | None = None,
        service_address_line2: str | None = None,
        service_country: str = "US",
        service_coordinates: dict[str, Any] | None = None,
        interested_service_types: list[str] | None = None,
        desired_bandwidth: str | None = None,
        estimated_monthly_budget: Decimal | None = None,
        desired_installation_date: datetime | None = None,
        assigned_to_id: UUID | None = None,
        partner_id: UUID | None = None,
        priority: int = 3,
        metadata: dict[str, Any] | None = None,
        notes: str | None = None,
        created_by_id: UUID | None = None,
    ) -> Lead:
        """Create a new lead in the sales pipeline."""
        # Generate lead number
        lead_number = await self._generate_lead_number(tenant_id)

        lead = Lead(
            id=uuid4(),
            tenant_id=tenant_id,
            lead_number=lead_number,
            status=LeadStatus.NEW,
            source=source,
            priority=priority,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            company_name=company_name,
            service_address_line1=service_address_line1,
            service_address_line2=service_address_line2,
            service_city=service_city,
            service_state_province=service_state_province,
            service_postal_code=service_postal_code,
            service_country=service_country,
            service_coordinates=service_coordinates or {},
            interested_service_types=interested_service_types or [],
            desired_bandwidth=desired_bandwidth,
            estimated_monthly_budget=estimated_monthly_budget,
            desired_installation_date=desired_installation_date,
            assigned_to_id=assigned_to_id,
            partner_id=partner_id,
            metadata=metadata or {},
            notes=notes,
            created_by_id=created_by_id,
        )

        self.db.add(lead)
        await self.db.flush()
        await self.db.refresh(lead)

        return lead

    async def get_lead(self, tenant_id: str, lead_id: UUID) -> Lead:
        """Get a lead by ID."""
        stmt = select(Lead).where(
            and_(Lead.tenant_id == tenant_id, Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        result = await self.db.execute(stmt)
        lead = result.scalar_one_or_none()

        if not lead:
            raise EntityNotFoundError(f"Lead {lead_id} not found")

        return lead

    async def update_lead(
        self,
        tenant_id: str,
        lead_id: UUID,
        updated_by_id: UUID | None = None,
        **updates: Any,
    ) -> Lead:
        """Update lead fields."""
        lead = await self.get_lead(tenant_id, lead_id)

        for field, value in updates.items():
            if hasattr(lead, field):
                setattr(lead, field, value)

        lead.updated_by_id = updated_by_id
        await self.db.flush()
        await self.db.refresh(lead)

        return lead

    async def update_status(
        self,
        tenant_id: str,
        lead_id: UUID,
        new_status: LeadStatus,
        updated_by_id: UUID | None = None,
    ) -> Lead:
        """Update lead status with validation."""
        lead = await self.get_lead(tenant_id, lead_id)

        # Validate status transitions
        if new_status == LeadStatus.QUALIFIED and lead.status == LeadStatus.NEW:
            lead.qualified_at = datetime.utcnow()
        elif new_status == LeadStatus.DISQUALIFIED:
            lead.disqualified_at = datetime.utcnow()
        elif new_status == LeadStatus.WON:
            if not lead.converted_to_customer_id:
                raise ValidationError("Cannot mark lead as won without customer conversion")
            lead.converted_at = datetime.utcnow()

        lead.status = new_status
        lead.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(lead)

        return lead

    async def qualify_lead(
        self,
        tenant_id: str,
        lead_id: UUID,
        updated_by_id: UUID | None = None,
    ) -> Lead:
        """Mark lead as qualified for further engagement."""
        return await self.update_status(tenant_id, lead_id, LeadStatus.QUALIFIED, updated_by_id)

    async def disqualify_lead(
        self,
        tenant_id: str,
        lead_id: UUID,
        reason: str,
        updated_by_id: UUID | None = None,
    ) -> Lead:
        """Disqualify a lead with reason."""
        lead = await self.get_lead(tenant_id, lead_id)
        lead.status = LeadStatus.DISQUALIFIED
        lead.disqualification_reason = reason
        lead.disqualified_at = datetime.utcnow()
        lead.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(lead)

        return lead

    async def update_serviceability(
        self,
        tenant_id: str,
        lead_id: UUID,
        serviceability: Serviceability,
        notes: str | None = None,
        updated_by_id: UUID | None = None,
    ) -> Lead:
        """Update lead serviceability status."""
        lead = await self.get_lead(tenant_id, lead_id)
        lead.is_serviceable = serviceability
        lead.serviceability_checked_at = datetime.utcnow()
        if notes:
            lead.serviceability_notes = notes
        lead.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(lead)

        return lead

    async def convert_to_customer(
        self,
        tenant_id: str,
        lead_id: UUID,
        customer: Customer,
        updated_by_id: UUID | None = None,
    ) -> Lead:
        """Convert lead to customer."""
        lead = await self.get_lead(tenant_id, lead_id)

        if lead.converted_to_customer_id:
            raise ValidationError(f"Lead {lead_id} already converted to customer")

        lead.converted_to_customer_id = customer.id
        lead.converted_at = datetime.utcnow()
        lead.status = LeadStatus.WON
        lead.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(lead)

        return lead

    async def list_leads(
        self,
        tenant_id: str,
        status: LeadStatus | None = None,
        source: LeadSource | None = None,
        assigned_to_id: UUID | None = None,
        partner_id: UUID | None = None,
        serviceability: Serviceability | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[Lead]:
        """List leads with filters."""
        stmt = select(Lead).where(and_(Lead.tenant_id == tenant_id, Lead.deleted_at.is_(None)))

        if status:
            stmt = stmt.where(Lead.status == status)
        if source:
            stmt = stmt.where(Lead.source == source)
        if assigned_to_id:
            stmt = stmt.where(Lead.assigned_to_id == assigned_to_id)
        if partner_id:
            stmt = stmt.where(Lead.partner_id == partner_id)
        if serviceability:
            stmt = stmt.where(Lead.is_serviceable == serviceability)

        stmt = stmt.order_by(Lead.priority.asc(), Lead.created_at.desc())
        stmt = stmt.offset(offset).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _generate_lead_number(self, tenant_id: str) -> str:
        """Generate unique lead number for tenant."""
        # Get count of leads for this tenant
        stmt = select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        count = result.scalar_one()

        # Format: LEAD-YYYY-NNNNNN
        year = datetime.utcnow().year
        return f"LEAD-{year}-{count + 1:06d}"


class QuoteService:
    """Service for generating and managing quotes."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_quote(
        self,
        tenant_id: str,
        lead_id: UUID,
        service_plan_name: str,
        bandwidth: str,
        monthly_recurring_charge: Decimal,
        installation_fee: Decimal = Decimal("0.00"),
        equipment_fee: Decimal = Decimal("0.00"),
        activation_fee: Decimal = Decimal("0.00"),
        contract_term_months: int = 12,
        early_termination_fee: Decimal | None = None,
        promo_discount_months: int | None = None,
        promo_monthly_discount: Decimal | None = None,
        valid_days: int = 30,
        line_items: list[dict[str, Any]] | None = None,
        metadata: dict[str, Any] | None = None,
        notes: str | None = None,
        created_by_id: UUID | None = None,
    ) -> Quote:
        """Create a new quote for a lead."""
        # Verify lead exists
        lead_stmt = select(Lead).where(
            and_(Lead.tenant_id == tenant_id, Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        lead_result = await self.db.execute(lead_stmt)
        lead = lead_result.scalar_one_or_none()

        if not lead:
            raise EntityNotFoundError(f"Lead {lead_id} not found")

        # Generate quote number
        quote_number = await self._generate_quote_number(tenant_id)

        # Calculate total upfront cost
        total_upfront_cost = installation_fee + equipment_fee + activation_fee

        # Set validity period
        valid_until = datetime.utcnow() + timedelta(days=valid_days)

        quote = Quote(
            id=uuid4(),
            tenant_id=tenant_id,
            quote_number=quote_number,
            status=QuoteStatus.DRAFT,
            lead_id=lead_id,
            service_plan_name=service_plan_name,
            bandwidth=bandwidth,
            monthly_recurring_charge=monthly_recurring_charge,
            installation_fee=installation_fee,
            equipment_fee=equipment_fee,
            activation_fee=activation_fee,
            total_upfront_cost=total_upfront_cost,
            contract_term_months=contract_term_months,
            early_termination_fee=early_termination_fee,
            promo_discount_months=promo_discount_months,
            promo_monthly_discount=promo_monthly_discount,
            valid_until=valid_until,
            line_items=line_items or [],
            metadata=metadata or {},
            notes=notes,
            created_by_id=created_by_id,
        )

        self.db.add(quote)
        await self.db.flush()
        await self.db.refresh(quote)

        return quote

    async def get_quote(self, tenant_id: str, quote_id: UUID) -> Quote:
        """Get a quote by ID."""
        stmt = (
            select(Quote)
            .options(selectinload(Quote.lead))
            .where(
                and_(
                    Quote.tenant_id == tenant_id,
                    Quote.id == quote_id,
                    Quote.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.execute(stmt)
        quote = result.scalar_one_or_none()

        if not quote:
            raise EntityNotFoundError(f"Quote {quote_id} not found")

        return quote

    async def send_quote(
        self,
        tenant_id: str,
        quote_id: UUID,
        updated_by_id: UUID | None = None,
    ) -> Quote:
        """Mark quote as sent."""
        quote = await self.get_quote(tenant_id, quote_id)

        if quote.status != QuoteStatus.DRAFT:
            raise ValidationError(f"Quote {quote_id} cannot be sent in {quote.status} status")

        quote.status = QuoteStatus.SENT
        quote.sent_at = datetime.utcnow()
        quote.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(quote)

        # Update lead status
        if quote.lead.status in [LeadStatus.QUALIFIED, LeadStatus.SITE_SURVEY_COMPLETED]:
            quote.lead.status = LeadStatus.QUOTE_SENT

        return quote

    async def mark_viewed(
        self,
        tenant_id: str,
        quote_id: UUID,
    ) -> Quote:
        """Mark quote as viewed by customer."""
        quote = await self.get_quote(tenant_id, quote_id)

        if quote.status == QuoteStatus.SENT and not quote.viewed_at:
            quote.status = QuoteStatus.VIEWED
            quote.viewed_at = datetime.utcnow()
            await self.db.flush()
            await self.db.refresh(quote)

        return quote

    async def accept_quote(
        self,
        tenant_id: str,
        quote_id: UUID,
        signature_data: dict[str, Any],
        updated_by_id: UUID | None = None,
    ) -> Quote:
        """Accept a quote with e-signature."""
        quote = await self.get_quote(tenant_id, quote_id)

        if quote.status not in [QuoteStatus.SENT, QuoteStatus.VIEWED]:
            raise ValidationError(f"Quote {quote_id} cannot be accepted in {quote.status} status")

        if quote.valid_until < datetime.utcnow():
            raise ValidationError(f"Quote {quote_id} has expired")

        quote.status = QuoteStatus.ACCEPTED
        quote.accepted_at = datetime.utcnow()
        quote.signature_data = signature_data
        quote.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(quote)

        # Update lead to negotiating (next step is customer conversion)
        if quote.lead.status in [LeadStatus.QUOTE_SENT, LeadStatus.NEGOTIATING]:
            quote.lead.status = LeadStatus.NEGOTIATING

        return quote

    async def reject_quote(
        self,
        tenant_id: str,
        quote_id: UUID,
        rejection_reason: str,
        updated_by_id: UUID | None = None,
    ) -> Quote:
        """Reject a quote."""
        quote = await self.get_quote(tenant_id, quote_id)

        quote.status = QuoteStatus.REJECTED
        quote.rejected_at = datetime.utcnow()
        quote.rejection_reason = rejection_reason
        quote.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(quote)

        return quote

    async def list_quotes(
        self,
        tenant_id: str,
        lead_id: UUID | None = None,
        status: QuoteStatus | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[Quote]:
        """List quotes with filters."""
        stmt = select(Quote).where(
            and_(Quote.tenant_id == tenant_id, Quote.deleted_at.is_(None))
        )

        if lead_id:
            stmt = stmt.where(Quote.lead_id == lead_id)
        if status:
            stmt = stmt.where(Quote.status == status)

        stmt = stmt.order_by(Quote.created_at.desc())
        stmt = stmt.offset(offset).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _generate_quote_number(self, tenant_id: str) -> str:
        """Generate unique quote number for tenant."""
        stmt = select(func.count(Quote.id)).where(Quote.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        count = result.scalar_one()

        year = datetime.utcnow().year
        return f"QUOT-{year}-{count + 1:06d}"


class SiteSurveyService:
    """Service for managing site surveys."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def schedule_survey(
        self,
        tenant_id: str,
        lead_id: UUID,
        scheduled_date: datetime,
        technician_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
        notes: str | None = None,
        created_by_id: UUID | None = None,
    ) -> SiteSurvey:
        """Schedule a site survey for a lead."""
        # Verify lead exists
        lead_stmt = select(Lead).where(
            and_(Lead.tenant_id == tenant_id, Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        lead_result = await self.db.execute(lead_stmt)
        lead = lead_result.scalar_one_or_none()

        if not lead:
            raise EntityNotFoundError(f"Lead {lead_id} not found")

        # Generate survey number
        survey_number = await self._generate_survey_number(tenant_id)

        survey = SiteSurvey(
            id=uuid4(),
            tenant_id=tenant_id,
            survey_number=survey_number,
            status=SiteSurveyStatus.SCHEDULED,
            lead_id=lead_id,
            scheduled_date=scheduled_date,
            technician_id=technician_id,
            metadata=metadata or {},
            notes=notes,
            created_by_id=created_by_id,
        )

        self.db.add(survey)
        await self.db.flush()
        await self.db.refresh(survey)

        # Update lead status
        if lead.status in [LeadStatus.QUALIFIED, LeadStatus.CONTACTED]:
            lead.status = LeadStatus.SITE_SURVEY_SCHEDULED

        return survey

    async def get_survey(self, tenant_id: str, survey_id: UUID) -> SiteSurvey:
        """Get a site survey by ID."""
        stmt = (
            select(SiteSurvey)
            .options(selectinload(SiteSurvey.lead))
            .where(
                and_(
                    SiteSurvey.tenant_id == tenant_id,
                    SiteSurvey.id == survey_id,
                    SiteSurvey.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.execute(stmt)
        survey = result.scalar_one_or_none()

        if not survey:
            raise EntityNotFoundError(f"Site survey {survey_id} not found")

        return survey

    async def start_survey(
        self,
        tenant_id: str,
        survey_id: UUID,
        updated_by_id: UUID | None = None,
    ) -> SiteSurvey:
        """Mark survey as in progress."""
        survey = await self.get_survey(tenant_id, survey_id)

        if survey.status != SiteSurveyStatus.SCHEDULED:
            raise ValidationError(
                f"Survey {survey_id} cannot be started in {survey.status} status"
            )

        survey.status = SiteSurveyStatus.IN_PROGRESS
        survey.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(survey)

        return survey

    async def complete_survey(
        self,
        tenant_id: str,
        survey_id: UUID,
        serviceability: Serviceability,
        nearest_fiber_distance_meters: int | None = None,
        requires_fiber_extension: bool = False,
        fiber_extension_cost: Decimal | None = None,
        nearest_olt_id: str | None = None,
        available_pon_ports: int | None = None,
        estimated_installation_time_hours: int | None = None,
        special_equipment_required: list[str] | None = None,
        installation_complexity: str | None = None,
        photos: list[dict[str, Any]] | None = None,
        recommendations: str | None = None,
        obstacles: str | None = None,
        updated_by_id: UUID | None = None,
    ) -> SiteSurvey:
        """Complete a site survey with findings."""
        survey = await self.get_survey(tenant_id, survey_id)

        if survey.status != SiteSurveyStatus.IN_PROGRESS:
            raise ValidationError(
                f"Survey {survey_id} cannot be completed in {survey.status} status"
            )

        survey.status = SiteSurveyStatus.COMPLETED
        survey.completed_date = datetime.utcnow()
        survey.serviceability = serviceability
        survey.nearest_fiber_distance_meters = nearest_fiber_distance_meters
        survey.requires_fiber_extension = requires_fiber_extension
        survey.fiber_extension_cost = fiber_extension_cost
        survey.nearest_olt_id = nearest_olt_id
        survey.available_pon_ports = available_pon_ports
        survey.estimated_installation_time_hours = estimated_installation_time_hours
        survey.special_equipment_required = special_equipment_required or []
        survey.installation_complexity = installation_complexity
        survey.photos = photos or []
        survey.recommendations = recommendations
        survey.obstacles = obstacles
        survey.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(survey)

        # Update lead serviceability
        lead = survey.lead
        lead.is_serviceable = serviceability
        lead.serviceability_checked_at = datetime.utcnow()
        lead.serviceability_notes = f"Site survey {survey.survey_number} completed"

        if lead.status == LeadStatus.SITE_SURVEY_SCHEDULED:
            lead.status = LeadStatus.SITE_SURVEY_COMPLETED

        return survey

    async def cancel_survey(
        self,
        tenant_id: str,
        survey_id: UUID,
        updated_by_id: UUID | None = None,
    ) -> SiteSurvey:
        """Cancel a scheduled survey."""
        survey = await self.get_survey(tenant_id, survey_id)

        if survey.status not in [SiteSurveyStatus.SCHEDULED, SiteSurveyStatus.IN_PROGRESS]:
            raise ValidationError(
                f"Survey {survey_id} cannot be canceled in {survey.status} status"
            )

        survey.status = SiteSurveyStatus.CANCELED
        survey.updated_by_id = updated_by_id

        await self.db.flush()
        await self.db.refresh(survey)

        return survey

    async def list_surveys(
        self,
        tenant_id: str,
        lead_id: UUID | None = None,
        status: SiteSurveyStatus | None = None,
        technician_id: UUID | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[SiteSurvey]:
        """List site surveys with filters."""
        stmt = select(SiteSurvey).where(
            and_(SiteSurvey.tenant_id == tenant_id, SiteSurvey.deleted_at.is_(None))
        )

        if lead_id:
            stmt = stmt.where(SiteSurvey.lead_id == lead_id)
        if status:
            stmt = stmt.where(SiteSurvey.status == status)
        if technician_id:
            stmt = stmt.where(SiteSurvey.technician_id == technician_id)

        stmt = stmt.order_by(SiteSurvey.scheduled_date.desc())
        stmt = stmt.offset(offset).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _generate_survey_number(self, tenant_id: str) -> str:
        """Generate unique survey number for tenant."""
        stmt = select(func.count(SiteSurvey.id)).where(SiteSurvey.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        count = result.scalar_one()

        year = datetime.utcnow().year
        return f"SURV-{year}-{count + 1:06d}"

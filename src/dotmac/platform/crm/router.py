"""
CRM API Router.

Provides REST API endpoints for lead management, quotes, and site surveys.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.core.exceptions import EntityNotFoundError, ValidationError
from dotmac.platform.crm.models import LeadSource, LeadStatus, QuoteStatus, SiteSurveyStatus
from dotmac.platform.crm.schemas import (
    LeadConvertToCustomerRequest,
    LeadCreateRequest,
    LeadDisqualifyRequest,
    LeadResponse,
    LeadServiceabilityUpdateRequest,
    LeadStatusUpdateRequest,
    LeadUpdateRequest,
    QuoteAcceptRequest,
    QuoteCreateRequest,
    QuoteRejectRequest,
    QuoteResponse,
    SiteSurveyCompleteRequest,
    SiteSurveyResponse,
    SiteSurveyScheduleRequest,
)
from dotmac.platform.crm.service import LeadService, QuoteService, SiteSurveyService
from dotmac.platform.db import get_session_dependency
from dotmac.platform.user_management.models import User

router = APIRouter(prefix="/crm", tags=["CRM"])


# Lead Endpoints
@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead_data: LeadCreateRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new lead in the sales pipeline."""
    service = LeadService(db)

    try:
        lead = await service.create_lead(
            tenant_id=current_user.tenant_id,
            first_name=lead_data.first_name,
            last_name=lead_data.last_name,
            email=lead_data.email,
            phone=lead_data.phone,
            company_name=lead_data.company_name,
            service_address_line1=lead_data.service_address_line1,
            service_address_line2=lead_data.service_address_line2,
            service_city=lead_data.service_city,
            service_state_province=lead_data.service_state_province,
            service_postal_code=lead_data.service_postal_code,
            service_country=lead_data.service_country,
            service_coordinates=lead_data.service_coordinates,
            source=lead_data.source,
            interested_service_types=lead_data.interested_service_types,
            desired_bandwidth=lead_data.desired_bandwidth,
            estimated_monthly_budget=lead_data.estimated_monthly_budget,
            desired_installation_date=lead_data.desired_installation_date,
            assigned_to_id=lead_data.assigned_to_id,
            partner_id=lead_data.partner_id,
            priority=lead_data.priority,
            metadata=lead_data.metadata,
            notes=lead_data.notes,
            created_by_id=current_user.id,
        )
        await db.commit()
        return lead
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get a specific lead by ID."""
    service = LeadService(db)

    try:
        lead = await service.get_lead(current_user.tenant_id, lead_id)
        return lead
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/leads", response_model=list[LeadResponse])
async def list_leads(
    status_filter: LeadStatus | None = Query(None, alias="status"),
    source: LeadSource | None = None,
    assigned_to_id: UUID | None = None,
    partner_id: UUID | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """List leads with optional filters."""
    service = LeadService(db)

    leads = await service.list_leads(
        tenant_id=current_user.tenant_id,
        status=status_filter,
        source=source,
        assigned_to_id=assigned_to_id,
        partner_id=partner_id,
        offset=offset,
        limit=limit,
    )

    return leads


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID,
    lead_data: LeadUpdateRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update lead fields."""
    service = LeadService(db)

    try:
        # Convert Pydantic model to dict, excluding None values
        updates = lead_data.model_dump(exclude_unset=True)

        lead = await service.update_lead(
            tenant_id=current_user.tenant_id,
            lead_id=lead_id,
            updated_by_id=current_user.id,
            **updates,
        )
        await db.commit()
        return lead
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/leads/{lead_id}/status", response_model=LeadResponse)
async def update_lead_status(
    lead_id: UUID,
    status_data: LeadStatusUpdateRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update lead status."""
    service = LeadService(db)

    try:
        lead = await service.update_status(
            tenant_id=current_user.tenant_id,
            lead_id=lead_id,
            new_status=status_data.status,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return lead
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/leads/{lead_id}/qualify", response_model=LeadResponse)
async def qualify_lead(
    lead_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark lead as qualified."""
    service = LeadService(db)

    try:
        lead = await service.qualify_lead(
            tenant_id=current_user.tenant_id,
            lead_id=lead_id,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return lead
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/leads/{lead_id}/disqualify", response_model=LeadResponse)
async def disqualify_lead(
    lead_id: UUID,
    disqualify_data: LeadDisqualifyRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Disqualify a lead with reason."""
    service = LeadService(db)

    try:
        lead = await service.disqualify_lead(
            tenant_id=current_user.tenant_id,
            lead_id=lead_id,
            reason=disqualify_data.reason,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return lead
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/leads/{lead_id}/serviceability", response_model=LeadResponse)
async def update_lead_serviceability(
    lead_id: UUID,
    serviceability_data: LeadServiceabilityUpdateRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update lead serviceability status."""
    service = LeadService(db)

    try:
        lead = await service.update_serviceability(
            tenant_id=current_user.tenant_id,
            lead_id=lead_id,
            serviceability=serviceability_data.serviceability,
            notes=serviceability_data.notes,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return lead
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/leads/{lead_id}/convert-to-customer", response_model=LeadResponse)
async def convert_lead_to_customer(
    lead_id: UUID,
    conversion_data: LeadConvertToCustomerRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Convert a qualified lead to a customer.

    This endpoint creates a new customer from lead data and marks the lead as converted.
    The lead data is used as defaults, with any fields in the request overriding them.
    """
    from dotmac.platform.customer_management.models import (
        CustomerStatus,
        CustomerTier,
        CustomerType,
    )
    from dotmac.platform.customer_management.service import CustomerService

    lead_service = LeadService(db)
    customer_service = CustomerService(db)

    try:
        # Get the lead
        lead = await lead_service.get_lead(current_user.tenant_id, lead_id)

        # Check if already converted
        if lead.converted_to_customer_id:
            raise ValidationError(
                f"Lead {lead_id} already converted to customer {lead.converted_to_customer_id}"
            )

        # Build customer data using lead info as defaults, with overrides from request
        customer_data = {
            "tenant_id": current_user.tenant_id,
            "first_name": conversion_data.first_name or lead.first_name,
            "last_name": conversion_data.last_name or lead.last_name,
            "middle_name": conversion_data.middle_name,
            "company_name": conversion_data.company_name or lead.company_name,
            "email": conversion_data.email or lead.email,
            "phone": conversion_data.phone or lead.phone,
            "mobile": conversion_data.mobile,
            "customer_type": CustomerType(conversion_data.customer_type),
            "tier": CustomerTier(conversion_data.tier),
            "status": CustomerStatus.ACTIVE,
            # Billing address (defaults to service address if not provided)
            "address_line1": conversion_data.address_line1 or lead.service_address_line1,
            "address_line2": conversion_data.address_line2 or lead.service_address_line2,
            "city": conversion_data.city or lead.service_city,
            "state_province": conversion_data.state_province or lead.service_state_province,
            "postal_code": conversion_data.postal_code or lead.service_postal_code,
            "country": conversion_data.country or lead.service_country,
            # ISP service info
            "service_address_line1": conversion_data.service_address_line1
            or lead.service_address_line1,
            "service_address_line2": conversion_data.service_address_line2
            or lead.service_address_line2,
            "service_city": conversion_data.service_city or lead.service_city,
            "service_state_province": conversion_data.service_state_province
            or lead.service_state_province,
            "service_postal_code": conversion_data.service_postal_code or lead.service_postal_code,
            "service_country": conversion_data.service_country or lead.service_country,
            "service_coordinates": conversion_data.service_coordinates or lead.service_coordinates,
            "installation_status": conversion_data.installation_status or "pending",
            "scheduled_installation_date": conversion_data.scheduled_installation_date
            or lead.desired_installation_date,
            "installation_notes": conversion_data.installation_notes,
            "connection_type": conversion_data.connection_type,
            "service_plan_speed": conversion_data.service_plan_speed or lead.desired_bandwidth,
            # Metadata
            "metadata": {
                **lead.metadata,
                **conversion_data.metadata,
                "converted_from_lead_id": str(lead_id),
                "lead_source": lead.source.value,
                "lead_number": lead.lead_number,
            },
            "notes": conversion_data.notes or lead.notes,
        }

        # Create customer
        customer = await customer_service.create_customer(**customer_data)

        # Update lead with conversion info
        lead = await lead_service.convert_to_customer(
            tenant_id=current_user.tenant_id,
            lead_id=lead_id,
            customer=customer,
            updated_by_id=current_user.id,
        )

        await db.commit()
        await db.refresh(lead)

        return lead

    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to convert lead to customer: {str(e)}",
        )


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft delete a lead."""
    service = LeadService(db)

    try:
        lead = await service.get_lead(current_user.tenant_id, lead_id)
        from datetime import datetime

        lead.deleted_at = datetime.utcnow()
        lead.updated_by_id = current_user.id
        await db.commit()
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Quote Endpoints
@router.post("/quotes", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(
    quote_data: QuoteCreateRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new quote for a lead."""
    service = QuoteService(db)

    try:
        quote = await service.create_quote(
            tenant_id=current_user.tenant_id,
            lead_id=quote_data.lead_id,
            service_plan_name=quote_data.service_plan_name,
            bandwidth=quote_data.bandwidth,
            monthly_recurring_charge=quote_data.monthly_recurring_charge,
            installation_fee=quote_data.installation_fee,
            equipment_fee=quote_data.equipment_fee,
            activation_fee=quote_data.activation_fee,
            contract_term_months=quote_data.contract_term_months,
            early_termination_fee=quote_data.early_termination_fee,
            promo_discount_months=quote_data.promo_discount_months,
            promo_monthly_discount=quote_data.promo_monthly_discount,
            valid_days=quote_data.valid_days,
            line_items=quote_data.line_items,
            metadata=quote_data.metadata,
            notes=quote_data.notes,
            created_by_id=current_user.id,
        )
        await db.commit()
        return quote
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/quotes/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get a specific quote by ID."""
    service = QuoteService(db)

    try:
        quote = await service.get_quote(current_user.tenant_id, quote_id)
        return quote
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/quotes", response_model=list[QuoteResponse])
async def list_quotes(
    lead_id: UUID | None = None,
    status_filter: QuoteStatus | None = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """List quotes with optional filters."""
    service = QuoteService(db)

    quotes = await service.list_quotes(
        tenant_id=current_user.tenant_id,
        lead_id=lead_id,
        status=status_filter,
        offset=offset,
        limit=limit,
    )

    return quotes


@router.post("/quotes/{quote_id}/send", response_model=QuoteResponse)
async def send_quote(
    quote_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Send a quote to the customer."""
    service = QuoteService(db)

    try:
        quote = await service.send_quote(
            tenant_id=current_user.tenant_id,
            quote_id=quote_id,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return quote
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/quotes/{quote_id}/view", response_model=QuoteResponse)
async def mark_quote_viewed(
    quote_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark quote as viewed by customer."""
    service = QuoteService(db)

    try:
        quote = await service.mark_viewed(
            tenant_id=current_user.tenant_id,
            quote_id=quote_id,
        )
        await db.commit()
        return quote
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/quotes/{quote_id}/accept", response_model=QuoteResponse)
async def accept_quote(
    quote_id: UUID,
    accept_data: QuoteAcceptRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Accept a quote with e-signature."""
    service = QuoteService(db)

    try:
        quote = await service.accept_quote(
            tenant_id=current_user.tenant_id,
            quote_id=quote_id,
            signature_data=accept_data.signature_data,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return quote
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/quotes/{quote_id}/reject", response_model=QuoteResponse)
async def reject_quote(
    quote_id: UUID,
    reject_data: QuoteRejectRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Reject a quote."""
    service = QuoteService(db)

    try:
        quote = await service.reject_quote(
            tenant_id=current_user.tenant_id,
            quote_id=quote_id,
            rejection_reason=reject_data.rejection_reason,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return quote
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/quotes/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quote(
    quote_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft delete a quote."""
    service = QuoteService(db)

    try:
        quote = await service.get_quote(current_user.tenant_id, quote_id)
        from datetime import datetime

        quote.deleted_at = datetime.utcnow()
        quote.updated_by_id = current_user.id
        await db.commit()
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Site Survey Endpoints
@router.post(
    "/site-surveys", response_model=SiteSurveyResponse, status_code=status.HTTP_201_CREATED
)
async def schedule_site_survey(
    survey_data: SiteSurveyScheduleRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Schedule a site survey for a lead."""
    service = SiteSurveyService(db)

    try:
        survey = await service.schedule_survey(
            tenant_id=current_user.tenant_id,
            lead_id=survey_data.lead_id,
            scheduled_date=survey_data.scheduled_date,
            technician_id=survey_data.technician_id,
            metadata=survey_data.metadata,
            notes=survey_data.notes,
            created_by_id=current_user.id,
        )
        await db.commit()
        return survey
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/site-surveys/{survey_id}", response_model=SiteSurveyResponse)
async def get_site_survey(
    survey_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get a specific site survey by ID."""
    service = SiteSurveyService(db)

    try:
        survey = await service.get_survey(current_user.tenant_id, survey_id)
        return survey
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/site-surveys", response_model=list[SiteSurveyResponse])
async def list_site_surveys(
    lead_id: UUID | None = None,
    status_filter: SiteSurveyStatus | None = Query(None, alias="status"),
    technician_id: UUID | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """List site surveys with optional filters."""
    service = SiteSurveyService(db)

    surveys = await service.list_surveys(
        tenant_id=current_user.tenant_id,
        lead_id=lead_id,
        status=status_filter,
        technician_id=technician_id,
        offset=offset,
        limit=limit,
    )

    return surveys


@router.post("/site-surveys/{survey_id}/start", response_model=SiteSurveyResponse)
async def start_site_survey(
    survey_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark site survey as in progress."""
    service = SiteSurveyService(db)

    try:
        survey = await service.start_survey(
            tenant_id=current_user.tenant_id,
            survey_id=survey_id,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return survey
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/site-surveys/{survey_id}/complete", response_model=SiteSurveyResponse)
async def complete_site_survey(
    survey_id: UUID,
    complete_data: SiteSurveyCompleteRequest,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Complete a site survey with findings."""
    service = SiteSurveyService(db)

    try:
        survey = await service.complete_survey(
            tenant_id=current_user.tenant_id,
            survey_id=survey_id,
            serviceability=complete_data.serviceability,
            nearest_fiber_distance_meters=complete_data.nearest_fiber_distance_meters,
            requires_fiber_extension=complete_data.requires_fiber_extension,
            fiber_extension_cost=complete_data.fiber_extension_cost,
            nearest_olt_id=complete_data.nearest_olt_id,
            available_pon_ports=complete_data.available_pon_ports,
            estimated_installation_time_hours=complete_data.estimated_installation_time_hours,
            special_equipment_required=complete_data.special_equipment_required,
            installation_complexity=complete_data.installation_complexity,
            photos=complete_data.photos,
            recommendations=complete_data.recommendations,
            obstacles=complete_data.obstacles,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return survey
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/site-surveys/{survey_id}/cancel", response_model=SiteSurveyResponse)
async def cancel_site_survey(
    survey_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Cancel a site survey."""
    service = SiteSurveyService(db)

    try:
        survey = await service.cancel_survey(
            tenant_id=current_user.tenant_id,
            survey_id=survey_id,
            updated_by_id=current_user.id,
        )
        await db.commit()
        return survey
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/site-surveys/{survey_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site_survey(
    survey_id: UUID,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft delete a site survey."""
    service = SiteSurveyService(db)

    try:
        survey = await service.get_survey(current_user.tenant_id, survey_id)
        from datetime import datetime

        survey.deleted_at = datetime.utcnow()
        survey.updated_by_id = current_user.id
        await db.commit()
    except EntityNotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

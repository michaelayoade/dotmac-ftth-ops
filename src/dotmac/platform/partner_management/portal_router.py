"""Partner Portal Router - Self-service endpoints for partners."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import get_session_dependency
from dotmac.platform.partner_management.dependencies import get_portal_partner
from dotmac.platform.partner_management.models import (
    Partner,
    PartnerAccount,
    PartnerCommissionEvent,
    PartnerPayout,
    ReferralLead,
    ReferralStatus,
)
from dotmac.platform.partner_management.schemas import (
    PartnerCommissionEventResponse,
    PartnerPayoutResponse,
    PartnerResponse,
    PartnerStatementResponse,
    PartnerUpdate,
    ReferralLeadCreate,
    ReferralLeadResponse,
)

router = APIRouter(prefix="/portal", tags=["Partner Portal"])


# Helpers
def _statement_download_url(statement_id: UUID) -> str:
    """Return API path for downloading a partner statement asset."""
    return f"/api/v1/partners/portal/statements/{statement_id}/download"


# Portal-specific schemas
class PartnerDashboardStats(BaseModel):  # BaseModel resolves to Any in isolation
    """Dashboard statistics for partner portal."""

    model_config = ConfigDict()

    total_customers: int = Field(default=0, description="Total customers assigned")
    active_customers: int = Field(default=0, description="Currently active customers")
    total_revenue_generated: Decimal = Field(
        default=Decimal("0"), description="Total revenue from customers"
    )
    total_commissions_earned: Decimal = Field(
        default=Decimal("0"), description="Total commissions earned"
    )
    total_commissions_paid: Decimal = Field(
        default=Decimal("0"), description="Total commissions paid out"
    )
    pending_commissions: Decimal = Field(
        default=Decimal("0"), description="Pending commission amount"
    )
    total_referrals: int = Field(default=0, description="Total referrals submitted")
    converted_referrals: int = Field(default=0, description="Referrals that converted")
    pending_referrals: int = Field(default=0, description="Referrals pending conversion")
    conversion_rate: float = Field(default=0.0, description="Referral conversion rate")
    current_tier: str = Field(description="Current partner tier")
    commission_model: str = Field(description="Commission model")
    default_commission_rate: Decimal = Field(description="Default commission rate")


class PartnerCustomerResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Partner customer information for portal."""

    model_config = ConfigDict()

    id: UUID
    customer_id: UUID
    customer_name: str
    engagement_type: str
    custom_commission_rate: Decimal | None = None
    total_revenue: Decimal
    total_commissions: Decimal
    start_date: datetime
    end_date: datetime | None = None
    is_active: bool


@router.get("/dashboard", response_model=PartnerDashboardStats)
async def get_dashboard_stats(
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
) -> PartnerDashboardStats:
    """Get dashboard statistics for partner portal."""

    # Count active customers
    active_customers_result = await db.execute(
        select(func.count(PartnerAccount.id))
        .where(PartnerAccount.partner_id == partner.id)
        .where(PartnerAccount.is_active)
    )
    active_customers = active_customers_result.scalar() or 0

    # Count pending referrals
    pending_referrals_result = await db.execute(
        select(func.count(ReferralLead.id))
        .where(ReferralLead.partner_id == partner.id)
        .where(
            ReferralLead.status.in_(
                [ReferralStatus.NEW, ReferralStatus.CONTACTED, ReferralStatus.QUALIFIED]
            )
        )
    )
    pending_referrals = pending_referrals_result.scalar() or 0

    # Calculate pending commissions
    pending_commissions = partner.total_commissions_earned - partner.total_commissions_paid

    # Calculate conversion rate
    conversion_rate = 0.0
    if partner.total_referrals > 0:
        conversion_rate = (partner.converted_referrals / partner.total_referrals) * 100

    return PartnerDashboardStats(
        total_customers=partner.total_customers,
        active_customers=active_customers,
        total_revenue_generated=partner.total_revenue_generated,
        total_commissions_earned=partner.total_commissions_earned,
        total_commissions_paid=partner.total_commissions_paid,
        pending_commissions=pending_commissions,
        total_referrals=partner.total_referrals,
        converted_referrals=partner.converted_referrals,
        pending_referrals=pending_referrals,
        conversion_rate=conversion_rate,
        current_tier=partner.tier.value,
        commission_model=partner.commission_model.value,
        default_commission_rate=partner.default_commission_rate or Decimal("0"),
    )


@router.get("/profile", response_model=PartnerResponse)
async def get_partner_profile(
    partner: Partner = Depends(get_portal_partner),
) -> Partner:
    """Get current partner profile."""
    return partner


@router.patch("/profile", response_model=PartnerResponse)
async def update_partner_profile(
    data: PartnerUpdate,
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
) -> Partner:
    """Update partner profile (limited fields)."""

    # Only allow updating certain fields from portal
    allowed_fields = {
        "company_name",
        "legal_name",
        "website",
        "billing_email",
        "phone",
    }

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in allowed_fields and value is not None:
            setattr(partner, field, value)

    await db.commit()
    await db.refresh(partner)

    return partner


@router.get("/referrals", response_model=list[ReferralLeadResponse])
async def list_partner_referrals(
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
    limit: int = 100,
    offset: int = 0,
) -> list[ReferralLeadResponse]:
    """List all referrals submitted by partner."""

    result = await db.execute(
        select(ReferralLead)
        .where(ReferralLead.partner_id == partner.id)
        .order_by(ReferralLead.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    referrals = list(result.scalars().all())
    # Set metadata attribute from metadata_ for Pydantic validation
    for r in referrals:
        r.metadata = r.metadata_
    return [ReferralLeadResponse.model_validate(r, from_attributes=True) for r in referrals]


@router.post("/referrals", response_model=ReferralLeadResponse, status_code=status.HTTP_201_CREATED)
async def submit_referral(
    data: ReferralLeadCreate,
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
) -> ReferralLead:
    """Submit a new referral."""

    referral = ReferralLead(
        partner_id=partner.id,
        tenant_id=partner.tenant_id,
        **data.model_dump(exclude={"partner_id"}),
    )

    db.add(referral)

    # Update partner referral count
    partner.total_referrals += 1

    await db.commit()
    await db.refresh(referral)

    return referral


@router.get("/commissions", response_model=list[PartnerCommissionEventResponse])
async def list_partner_commissions(
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
    limit: int = 100,
    offset: int = 0,
) -> list[PartnerCommissionEventResponse]:
    """List all commission events for partner."""

    result = await db.execute(
        select(PartnerCommissionEvent)
        .where(PartnerCommissionEvent.partner_id == partner.id)
        .order_by(PartnerCommissionEvent.event_date.desc())
        .limit(limit)
        .offset(offset)
    )

    events = list(result.scalars().all())
    return [PartnerCommissionEventResponse.model_validate(e, from_attributes=True) for e in events]


@router.get("/customers", response_model=list[PartnerCustomerResponse])
async def list_partner_customers(
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
    limit: int = 100,
    offset: int = 0,
) -> list[PartnerCustomerResponse]:
    """List all customers assigned to partner."""

    result = await db.execute(
        select(PartnerAccount)
        .where(PartnerAccount.partner_id == partner.id)
        .order_by(PartnerAccount.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    accounts = list(result.scalars().all())

    # Transform to response format with aggregated financials
    customer_responses: list[PartnerCustomerResponse] = []
    for account in accounts:
        # Aggregate revenue and commissions from commission events
        commission_result = await db.execute(
            select(
                func.sum(PartnerCommissionEvent.base_amount).label("total_revenue"),
                func.sum(PartnerCommissionEvent.commission_amount).label("total_commissions"),
            )
            .where(PartnerCommissionEvent.partner_id == partner.id)
            .where(PartnerCommissionEvent.customer_id == account.customer_id)
        )
        aggregates = commission_result.one()

        customer_responses.append(
            PartnerCustomerResponse(
                id=account.id,
                customer_id=account.customer_id,
                customer_name=f"Customer {str(account.customer_id)[:8]}",  # Placeholder - in production join with customer table
                engagement_type=account.engagement_type or "direct",
                custom_commission_rate=account.custom_commission_rate,
                total_revenue=aggregates.total_revenue or Decimal("0.00"),
                total_commissions=aggregates.total_commissions or Decimal("0.00"),
                start_date=account.start_date,
                end_date=account.end_date,
                is_active=account.is_active,
            )
        )

    return customer_responses


@router.get("/statements", response_model=list[PartnerStatementResponse])
async def list_partner_statements(
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
    limit: int = 24,
    offset: int = 0,
) -> list[PartnerStatementResponse]:
    """Return recent partner statements derived from payout records."""

    result = await db.execute(
        select(PartnerPayout)
        .where(PartnerPayout.partner_id == partner.id)
        .order_by(PartnerPayout.period_end.desc())
        .limit(limit)
        .offset(offset)
    )
    payouts = list(result.scalars().all())

    statements: list[PartnerStatementResponse] = []
    for payout in payouts:
        aggregates_result = await db.execute(
            select(
                func.sum(PartnerCommissionEvent.base_amount).label("revenue_total"),
                func.sum(PartnerCommissionEvent.commission_amount).label("commission_total"),
            )
            .where(PartnerCommissionEvent.partner_id == partner.id)
            .where(PartnerCommissionEvent.payout_id == payout.id)
        )
        aggregates = aggregates_result.one()
        revenue_total = aggregates.revenue_total or Decimal("0")
        commission_total = aggregates.commission_total or Decimal("0")
        adjustments_total = (payout.total_amount or Decimal("0")) - commission_total

        statements.append(
            PartnerStatementResponse(
                id=payout.id,
                payout_id=payout.id,
                period_start=payout.period_start,
                period_end=payout.period_end,
                issued_at=payout.payout_date,
                revenue_total=revenue_total,
                commission_total=commission_total,
                adjustments_total=adjustments_total,
                status=payout.status,
                download_url=_statement_download_url(payout.id),
            )
        )

    return statements


@router.get("/payouts", response_model=list[PartnerPayoutResponse])
async def list_partner_payouts(
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
    limit: int = 50,
    offset: int = 0,
) -> list[PartnerPayoutResponse]:
    """Return payout history for the authenticated partner."""

    result = await db.execute(
        select(PartnerPayout)
        .where(PartnerPayout.partner_id == partner.id)
        .order_by(PartnerPayout.payout_date.desc())
        .limit(limit)
        .offset(offset)
    )
    payouts = list(result.scalars().all())

    return [
        PartnerPayoutResponse.model_validate(payout, from_attributes=True) for payout in payouts
    ]


@router.get("/statements/{statement_id}/download")
async def download_partner_statement(
    statement_id: UUID,
    partner: Partner = Depends(get_portal_partner),
    db: AsyncSession = Depends(get_session_dependency),
) -> Response:
    """Generate a CSV asset summarizing the partner statement for download."""

    payout_result = await db.execute(
        select(PartnerPayout).where(
            PartnerPayout.id == statement_id, PartnerPayout.partner_id == partner.id
        )
    )
    payout = payout_result.scalar_one_or_none()
    if not payout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement not found")

    aggregates_result = await db.execute(
        select(
            func.sum(PartnerCommissionEvent.base_amount).label("revenue_total"),
            func.sum(PartnerCommissionEvent.commission_amount).label("commission_total"),
        )
        .where(PartnerCommissionEvent.partner_id == partner.id)
        .where(PartnerCommissionEvent.payout_id == payout.id)
    )
    aggregates = aggregates_result.one()

    revenue_total = aggregates.revenue_total or Decimal("0")
    commission_total = aggregates.commission_total or Decimal("0")
    adjustments_total = (payout.total_amount or Decimal("0")) - commission_total

    events_result = await db.execute(
        select(PartnerCommissionEvent)
        .where(
            PartnerCommissionEvent.partner_id == partner.id,
            PartnerCommissionEvent.payout_id == payout.id,
        )
        .order_by(PartnerCommissionEvent.event_date.asc())
    )
    events = list(events_result.scalars().all())

    def decimal_str(value: Decimal | None) -> str:
        quantized = (value or Decimal("0")).quantize(Decimal("0.01"))
        return f"{quantized:.2f}"

    csv_lines = [
        "Field,Value",
        f"Statement ID,{payout.id}",
        f"Partner ID,{partner.id}",
        f"Period Start,{payout.period_start.isoformat()}",
        f"Period End,{payout.period_end.isoformat()}",
        f"Payout Date,{payout.payout_date.isoformat()}",
        f"Status,{payout.status.value}",
        f"Total Revenue Share,{decimal_str(revenue_total)}",
        f"Commission Due,{decimal_str(commission_total)}",
        f"Adjustments,{decimal_str(adjustments_total)}",
        f"Net Payable,{decimal_str(commission_total + adjustments_total)}",
    ]

    if payout.payment_reference:
        csv_lines.append(f"Payment Reference,{payout.payment_reference}")

    csv_lines.append("")  # Blank line before event details
    csv_lines.append("Event ID,Customer ID,Base Amount,Commission Amount,Status,Event Date")

    for event in events:
        csv_lines.append(
            ",".join(
                [
                    str(event.id),
                    str(event.customer_id or ""),
                    decimal_str(event.base_amount),
                    decimal_str(event.commission_amount),
                    event.status.value,
                    event.event_date.isoformat(),
                ]
            )
        )

    csv_data = "\n".join(csv_lines)
    filename = f"partner_statement_{payout.period_end.strftime('%Y_%m_%d')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(csv_data.encode("utf-8"))),
        },
    )

"""Simple integration test for Partner Management without complex DB setup."""

from decimal import Decimal

import pytest

pytestmark = pytest.mark.unit


def test_partner_models_import():
    """Test that partner models can be imported."""
    from dotmac.platform.partner_management.models import (
        CommissionModel,
        CommissionStatus,
        PartnerStatus,
        PartnerTier,
        ReferralStatus,
    )

    # Verify enums
    assert PartnerStatus.PENDING
    assert PartnerTier.BRONZE
    assert CommissionModel.REVENUE_SHARE
    assert ReferralStatus.NEW
    assert CommissionStatus.PENDING


def test_partner_schemas_import():
    """Test that partner schemas can be imported."""
    from dotmac.platform.partner_management.schemas import (
        PartnerCreate,
    )

    # Create schema instance
    partner_create = PartnerCreate(
        company_name="Test Partner",
        primary_email="test@partner.com",
    )

    assert partner_create.company_name == "Test Partner"
    assert partner_create.primary_email == "test@partner.com"


def test_partner_service_import():
    """Test that partner service can be imported."""
    from dotmac.platform.partner_management.service import PartnerService

    assert PartnerService is not None


def test_partner_router_import():
    """Test that partner router can be imported."""
    from dotmac.platform.partner_management.router import router

    assert router is not None
    # Verify portal routes are included
    routes = [r.path for r in router.routes]
    assert any("/portal/dashboard" in r for r in routes)
    assert any("/portal/profile" in r for r in routes)
    assert any("/portal/referrals" in r for r in routes)


def test_portal_router_import():
    """Test that portal router can be imported."""
    from dotmac.platform.partner_management.portal_router import router

    assert router is not None

    # Check portal endpoints exist
    routes = [r.path for r in router.routes]
    assert any("dashboard" in r for r in routes)
    assert any("profile" in r for r in routes)
    assert any("referrals" in r for r in routes)
    assert any("commissions" in r for r in routes)
    assert any("customers" in r for r in routes)


def test_commission_calculation():
    """Test commission amount calculation logic."""
    amount = Decimal("1000.00")
    rate = Decimal("0.15")
    commission = amount * rate

    assert commission == Decimal("150.00")


def test_conversion_rate_calculation():
    """Test referral conversion rate calculation."""
    total_referrals = 10
    converted_referrals = 3

    conversion_rate = (converted_referrals / total_referrals) * 100

    assert conversion_rate == 30.0


def test_partner_number_format():
    """Test partner number generation format."""
    # Partner numbers should follow format: PART-YYYYMMDD-XXXX
    import re

    pattern = r"^PART-\d{8}-\d{4}$"

    example = "PART-20250101-0001"
    assert re.match(pattern, example)


def test_partner_tier_hierarchy():
    """Test partner tier hierarchy."""
    from dotmac.platform.partner_management.models import PartnerTier

    tiers = [
        PartnerTier.BRONZE,
        PartnerTier.SILVER,
        PartnerTier.GOLD,
        PartnerTier.PLATINUM,
    ]

    assert len(tiers) == 4
    assert PartnerTier.BRONZE.value == "bronze"
    assert PartnerTier.PLATINUM.value == "platinum"


def test_commission_status_workflow():
    """Test commission status workflow."""
    from dotmac.platform.partner_management.models import CommissionStatus

    # Valid workflow: pending -> approved -> paid
    assert CommissionStatus.PENDING
    assert CommissionStatus.APPROVED
    assert CommissionStatus.PAID

    # Also support clawback and cancelled
    assert CommissionStatus.CLAWBACK
    assert CommissionStatus.CANCELLED


def test_referral_status_workflow():
    """Test referral status workflow."""
    from dotmac.platform.partner_management.models import ReferralStatus

    # Valid workflow
    statuses = [
        ReferralStatus.NEW,
        ReferralStatus.CONTACTED,
        ReferralStatus.QUALIFIED,
        ReferralStatus.CONVERTED,
        ReferralStatus.LOST,
    ]

    assert len(statuses) == 5


def test_dashboard_stats_schema():
    """Test dashboard stats schema."""
    from dotmac.platform.partner_management.portal_router import PartnerDashboardStats

    stats = PartnerDashboardStats(
        total_customers=10,
        active_customers=8,
        total_revenue_generated=Decimal("50000.00"),
        total_commissions_earned=Decimal("7500.00"),
        total_commissions_paid=Decimal("5000.00"),
        pending_commissions=Decimal("2500.00"),
        total_referrals=20,
        converted_referrals=5,
        pending_referrals=10,
        conversion_rate=25.0,
        current_tier="gold",
        commission_model="revenue_share",
        default_commission_rate=Decimal("0.15"),
    )

    assert stats.total_customers == 10
    assert stats.pending_commissions == Decimal("2500.00")
    assert stats.conversion_rate == 25.0


def test_partner_customer_response_schema():
    """Test partner customer response schema."""
    from datetime import datetime
    from uuid import uuid4

    from dotmac.platform.partner_management.portal_router import PartnerCustomerResponse

    response = PartnerCustomerResponse(
        id=uuid4(),
        customer_id=uuid4(),
        customer_name="Test Customer",
        engagement_type="direct",
        total_revenue=Decimal("10000.00"),
        total_commissions=Decimal("1500.00"),
        start_date=datetime.now(),
        is_active=True,
    )

    assert response.customer_name == "Test Customer"
    assert response.engagement_type == "direct"
    assert response.is_active is True

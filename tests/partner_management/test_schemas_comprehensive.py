"""
Comprehensive tests for partner management schemas.

Tests Pydantic validation for partners, users, accounts, commissions, and referrals.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from dotmac.platform.partner_management.models import (
    CommissionModel,
    CommissionStatus,
    PartnerStatus,
    PartnerTier,
    ReferralStatus,
)
from dotmac.platform.partner_management.schemas import (
    PartnerAccountCreate,
    PartnerAccountUpdate,
    PartnerCommissionEventCreate,
    PartnerCommissionEventUpdate,
    PartnerCreate,
    PartnerUpdate,
    PartnerUserCreate,
    ReferralLeadCreate,
    ReferralLeadUpdate,
)


@pytest.mark.unit
class TestPartnerCreateSchema:
    """Test PartnerCreate schema validation."""

    def test_valid_partner_create(self):
        """Test creating valid partner."""
        partner = PartnerCreate(
            company_name="Acme Solutions Ltd",
            primary_email="contact@acme.com",
            tier=PartnerTier.SILVER,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.15"),
        )

        assert partner.company_name == "Acme Solutions Ltd"
        assert partner.primary_email == "contact@acme.com"
        assert partner.tier == PartnerTier.SILVER
        assert partner.default_commission_rate == Decimal("0.15")

    def test_partner_create_minimal_fields(self):
        """Test partner creation with only required fields."""
        partner = PartnerCreate(
            company_name="Test Partner",
            primary_email="test@partner.com",
        )

        assert partner.company_name == "Test Partner"
        assert partner.primary_email == "test@partner.com"
        assert partner.tier == PartnerTier.BRONZE  # Default
        assert partner.commission_model == CommissionModel.REVENUE_SHARE  # Default

    def test_partner_create_email_normalization(self):
        """Test email normalization to lowercase."""
        partner = PartnerCreate(
            company_name="Test",
            primary_email="TEST@EXAMPLE.COM",
            billing_email="BILLING@EXAMPLE.COM",
        )

        assert partner.primary_email == "test@example.com"
        assert partner.billing_email == "billing@example.com"

    def test_partner_create_invalid_email(self):
        """Test validation fails with invalid email."""
        with pytest.raises(ValidationError) as exc_info:
            PartnerCreate(
                company_name="Test",
                primary_email="invalid-email",
            )

        errors = exc_info.value.errors()
        assert any("primary_email" in str(error) for error in errors)

    def test_partner_create_empty_company_name(self):
        """Test validation fails with empty company name."""
        with pytest.raises(ValidationError) as exc_info:
            PartnerCreate(
                company_name="",
                primary_email="test@example.com",
            )

        errors = exc_info.value.errors()
        assert any("company_name" in str(error) for error in errors)

    def test_partner_create_invalid_commission_rate(self):
        """Test validation fails with invalid commission rate."""
        # Rate > 1 (100%)
        with pytest.raises(ValidationError) as exc_info:
            PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                default_commission_rate=Decimal("1.5"),  # 150%
            )

        errors = exc_info.value.errors()
        assert any("default_commission_rate" in str(error) for error in errors)

        # Negative rate
        with pytest.raises(ValidationError):
            PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                default_commission_rate=Decimal("-0.1"),
            )

    def test_partner_create_invalid_country_code(self):
        """Test validation fails with invalid country code."""
        with pytest.raises(ValidationError) as exc_info:
            PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                country="USA",  # Should be 2-letter code
            )

        errors = exc_info.value.errors()
        assert any("country" in str(error) for error in errors)

    def test_partner_create_valid_country_code(self):
        """Test valid 2-letter country code."""
        partner = PartnerCreate(
            company_name="Test",
            primary_email="test@example.com",
            country="US",
        )

        assert partner.country == "US"

    def test_partner_create_phone_validation(self):
        """Test phone number validation."""
        # Valid phone numbers
        valid_phones = [
            "+1-555-123-4567",
            "+44 20 7123 4567",
            "555-123-4567",
            "+1 555 123-4567",  # No parentheses - validator doesn't allow them
        ]

        for phone in valid_phones:
            partner = PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                phone=phone,
            )
            assert partner.phone == phone

    def test_partner_create_invalid_phone(self):
        """Test invalid phone number."""
        with pytest.raises(ValidationError) as exc_info:
            PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                phone="ABC-DEF-GHIJ",  # Letters not allowed
            )

        errors = exc_info.value.errors()
        assert any("phone" in str(error) for error in errors)

    def test_partner_create_sla_validation(self):
        """Test SLA field validation."""
        # Valid SLA values
        partner = PartnerCreate(
            company_name="Test",
            primary_email="test@example.com",
            sla_response_hours=24,
            sla_uptime_percentage=Decimal("99.9"),
        )

        assert partner.sla_response_hours == 24
        assert partner.sla_uptime_percentage == Decimal("99.9")

        # Invalid - negative response hours
        with pytest.raises(ValidationError):
            PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                sla_response_hours=-5,
            )

        # Invalid - uptime > 100%
        with pytest.raises(ValidationError):
            PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                sla_uptime_percentage=Decimal("101.0"),
            )

    def test_partner_create_with_address(self):
        """Test partner creation with full address."""
        partner = PartnerCreate(
            company_name="Test Partner",
            primary_email="test@example.com",
            address_line1="123 Main St",
            address_line2="Suite 100",
            city="San Francisco",
            state_province="CA",
            postal_code="94105",
            country="US",
        )

        assert partner.address_line1 == "123 Main St"
        assert partner.city == "San Francisco"
        assert partner.postal_code == "94105"

    def test_partner_create_extra_fields_forbidden(self):
        """Test that extra fields are forbidden."""
        with pytest.raises(ValidationError) as exc_info:
            PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                unknown_field="value",
            )

        errors = exc_info.value.errors()
        assert any("unknown_field" in str(error) for error in errors)


@pytest.mark.unit
class TestPartnerUpdateSchema:
    """Test PartnerUpdate schema validation."""

    def test_partner_update_partial(self):
        """Test partial partner update."""
        update = PartnerUpdate(
            company_name="Updated Name",
            tier=PartnerTier.GOLD,
        )

        assert update.company_name == "Updated Name"
        assert update.tier == PartnerTier.GOLD
        assert update.primary_email is None  # Not updated

    def test_partner_update_all_none(self):
        """Test update with all fields None is valid."""
        update = PartnerUpdate()

        assert update.company_name is None
        assert update.status is None
        assert update.tier is None

    def test_partner_update_status_change(self):
        """Test changing partner status."""
        update = PartnerUpdate(
            status=PartnerStatus.SUSPENDED,
        )

        assert update.status == PartnerStatus.SUSPENDED

    def test_partner_update_dates(self):
        """Test updating partner dates."""
        now = datetime.now(UTC)

        update = PartnerUpdate(
            partnership_end_date=now,
            last_review_date=now,
            next_review_date=now,
        )

        assert update.partnership_end_date == now
        assert update.last_review_date == now


@pytest.mark.unit
class TestPartnerUserCreateSchema:
    """Test PartnerUserCreate schema validation."""

    def test_valid_partner_user_create(self):
        """Test creating valid partner user."""
        partner_id = uuid4()

        user = PartnerUserCreate(
            partner_id=partner_id,
            first_name="John",
            last_name="Doe",
            email="john.doe@partner.com",
            role="account_manager",
            is_primary_contact=True,
        )

        assert user.partner_id == partner_id
        assert user.first_name == "John"
        assert user.last_name == "Doe"
        assert user.email == "john.doe@partner.com"
        assert user.is_primary_contact is True

    def test_partner_user_email_normalization(self):
        """Test partner user email normalization."""
        user = PartnerUserCreate(
            partner_id=uuid4(),
            first_name="Test",
            last_name="User",
            email="TEST@EXAMPLE.COM",
            role="admin",
        )

        assert user.email == "test@example.com"

    def test_partner_user_invalid_email(self):
        """Test validation fails with invalid email."""
        with pytest.raises(ValidationError):
            PartnerUserCreate(
                partner_id=uuid4(),
                first_name="Test",
                last_name="User",
                email="not-an-email",
                role="admin",
            )

    def test_partner_user_empty_name(self):
        """Test validation fails with empty name."""
        with pytest.raises(ValidationError) as exc_info:
            PartnerUserCreate(
                partner_id=uuid4(),
                first_name="",
                last_name="Doe",
                email="test@example.com",
                role="admin",
            )

        errors = exc_info.value.errors()
        assert any("first_name" in str(error) for error in errors)

    def test_partner_user_with_user_id(self):
        """Test partner user with auth user linkage."""
        partner_id = uuid4()
        user_id = uuid4()

        user = PartnerUserCreate(
            partner_id=partner_id,
            first_name="Linked",
            last_name="User",
            email="linked@example.com",
            role="admin",
            user_id=user_id,
        )

        assert user.user_id == user_id


@pytest.mark.unit
class TestPartnerAccountSchema:
    """Test PartnerAccount schema validation."""

    def test_valid_partner_account_create(self):
        """Test creating valid partner account assignment."""
        partner_id = uuid4()
        customer_id = uuid4()

        account = PartnerAccountCreate(
            partner_id=partner_id,
            customer_id=customer_id,
            engagement_type="managed",
            custom_commission_rate=Decimal("0.20"),
        )

        assert account.partner_id == partner_id
        assert account.customer_id == customer_id
        assert account.engagement_type == "managed"
        assert account.custom_commission_rate == Decimal("0.20")

    def test_partner_account_without_custom_rate(self):
        """Test partner account without custom commission rate."""
        account = PartnerAccountCreate(
            partner_id=uuid4(),
            customer_id=uuid4(),
            engagement_type="referral",
        )

        assert account.custom_commission_rate is None

    def test_partner_account_invalid_commission_rate(self):
        """Test validation fails with invalid commission rate."""
        with pytest.raises(ValidationError):
            PartnerAccountCreate(
                partner_id=uuid4(),
                customer_id=uuid4(),
                engagement_type="managed",
                custom_commission_rate=Decimal("1.5"),  # > 100%
            )

    def test_partner_account_update(self):
        """Test partner account update schema."""
        update = PartnerAccountUpdate(
            engagement_type="reseller",
            is_active=False,
        )

        assert update.engagement_type == "reseller"
        assert update.is_active is False


@pytest.mark.unit
class TestCommissionEventSchema:
    """Test PartnerCommissionEvent schema validation."""

    def test_valid_commission_event_create(self):
        """Test creating valid commission event."""
        partner_id = uuid4()

        event = PartnerCommissionEventCreate(
            partner_id=partner_id,
            commission_amount=Decimal("150.00"),
            currency="USD",
            event_type="invoice_paid",
            base_amount=Decimal("1000.00"),
            commission_rate=Decimal("0.15"),
        )

        assert event.partner_id == partner_id
        assert event.commission_amount == Decimal("150.00")
        assert event.currency == "USD"
        assert event.event_type == "invoice_paid"

    def test_commission_event_with_references(self):
        """Test commission event with invoice and customer references."""
        event = PartnerCommissionEventCreate(
            partner_id=uuid4(),
            invoice_id=uuid4(),
            customer_id=uuid4(),
            commission_amount=Decimal("200.00"),
            currency="USD",
            event_type="invoice_paid",
        )

        assert event.invoice_id is not None
        assert event.customer_id is not None

    def test_commission_event_negative_amount(self):
        """Test validation fails with negative commission amount."""
        with pytest.raises(ValidationError):
            PartnerCommissionEventCreate(
                partner_id=uuid4(),
                commission_amount=Decimal("-100.00"),
                currency="USD",
                event_type="clawback",
            )

    def test_commission_event_invalid_currency(self):
        """Test validation fails with invalid currency code."""
        with pytest.raises(ValidationError):
            PartnerCommissionEventCreate(
                partner_id=uuid4(),
                commission_amount=Decimal("100.00"),
                currency="USDA",  # 4 chars instead of 3
                event_type="invoice_paid",
            )

    def test_commission_event_update(self):
        """Test commission event update schema."""
        payout_id = uuid4()

        update = PartnerCommissionEventUpdate(
            status=CommissionStatus.PAID,
            payout_id=payout_id,
            notes="Paid in batch #123",
        )

        assert update.status == CommissionStatus.PAID
        assert update.payout_id == payout_id
        assert update.notes == "Paid in batch #123"


@pytest.mark.unit
class TestReferralLeadSchema:
    """Test ReferralLead schema validation."""

    def test_valid_referral_lead_create(self):
        """Test creating valid referral lead."""
        partner_id = uuid4()

        referral = ReferralLeadCreate(
            partner_id=partner_id,
            company_name="Prospect Corp",
            contact_name="Jane Smith",
            contact_email="jane@prospect.com",
            contact_phone="+1-555-987-6543",
            estimated_value=Decimal("50000.00"),
            notes="Warm lead from conference",
        )

        assert referral.partner_id == partner_id
        assert referral.company_name == "Prospect Corp"
        assert referral.contact_name == "Jane Smith"
        assert referral.contact_email == "jane@prospect.com"
        assert referral.estimated_value == Decimal("50000.00")

    def test_referral_lead_email_normalization(self):
        """Test referral lead email normalization."""
        referral = ReferralLeadCreate(
            partner_id=uuid4(),
            contact_name="Test Contact",
            contact_email="TEST@PROSPECT.COM",
        )

        assert referral.contact_email == "test@prospect.com"

    def test_referral_lead_minimal_fields(self):
        """Test referral with only required fields."""
        referral = ReferralLeadCreate(
            partner_id=uuid4(),
            contact_name="Minimal Contact",
            contact_email="minimal@example.com",
        )

        assert referral.contact_name == "Minimal Contact"
        assert referral.company_name is None
        assert referral.estimated_value is None

    def test_referral_lead_invalid_email(self):
        """Test validation fails with invalid email."""
        with pytest.raises(ValidationError):
            ReferralLeadCreate(
                partner_id=uuid4(),
                contact_name="Test",
                contact_email="not-valid-email",
            )

    def test_referral_lead_empty_name(self):
        """Test validation fails with empty contact name."""
        with pytest.raises(ValidationError):
            ReferralLeadCreate(
                partner_id=uuid4(),
                contact_name="",
                contact_email="test@example.com",
            )

    def test_referral_lead_negative_value(self):
        """Test validation fails with negative estimated value."""
        with pytest.raises(ValidationError):
            ReferralLeadCreate(
                partner_id=uuid4(),
                contact_name="Test",
                contact_email="test@example.com",
                estimated_value=Decimal("-1000.00"),
            )

    def test_referral_lead_update(self):
        """Test referral lead update schema."""
        customer_id = uuid4()
        now = datetime.now(UTC)

        update = ReferralLeadUpdate(
            status=ReferralStatus.CONVERTED,
            converted_customer_id=customer_id,
            conversion_date=now,
            actual_value=Decimal("75000.00"),
            notes="Successfully converted!",
        )

        assert update.status == ReferralStatus.CONVERTED
        assert update.converted_customer_id == customer_id
        assert update.actual_value == Decimal("75000.00")

    def test_referral_lead_status_progression(self):
        """Test typical referral status progression updates."""
        now = datetime.now(UTC)

        # New -> Contacted
        update1 = ReferralLeadUpdate(
            status=ReferralStatus.CONTACTED,
            first_contact_date=now,
        )
        assert update1.status == ReferralStatus.CONTACTED

        # Contacted -> Qualified
        update2 = ReferralLeadUpdate(
            status=ReferralStatus.QUALIFIED,
            qualified_date=now,
        )
        assert update2.status == ReferralStatus.QUALIFIED

        # Qualified -> Converted
        update3 = ReferralLeadUpdate(
            status=ReferralStatus.CONVERTED,
            conversion_date=now,
            actual_value=Decimal("100000.00"),
        )
        assert update3.status == ReferralStatus.CONVERTED


@pytest.mark.unit
class TestEnumValues:
    """Test enum value validation in schemas."""

    def test_partner_status_enum(self):
        """Test PartnerStatus enum values."""
        statuses = [
            PartnerStatus.PENDING,
            PartnerStatus.ACTIVE,
            PartnerStatus.SUSPENDED,
            PartnerStatus.TERMINATED,
            PartnerStatus.ARCHIVED,
        ]

        for status in statuses:
            update = PartnerUpdate(status=status)
            assert update.status == status

    def test_partner_tier_enum(self):
        """Test PartnerTier enum values."""
        tiers = [
            PartnerTier.BRONZE,
            PartnerTier.SILVER,
            PartnerTier.GOLD,
            PartnerTier.PLATINUM,
            PartnerTier.DIRECT,
        ]

        for tier in tiers:
            partner = PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                tier=tier,
            )
            assert partner.tier == tier

    def test_commission_model_enum(self):
        """Test CommissionModel enum values."""
        models = [
            CommissionModel.REVENUE_SHARE,
            CommissionModel.FLAT_FEE,
            CommissionModel.TIERED,
            CommissionModel.HYBRID,
        ]

        for model in models:
            partner = PartnerCreate(
                company_name="Test",
                primary_email="test@example.com",
                commission_model=model,
            )
            assert partner.commission_model == model


@pytest.mark.unit
class TestWhitespaceStripping:
    """Test whitespace stripping configuration."""

    def test_partner_name_whitespace_stripped(self):
        """Test that whitespace is stripped from company name."""
        partner = PartnerCreate(
            company_name="  Test Partner  ",
            primary_email="test@example.com",
        )

        assert partner.company_name == "Test Partner"

    def test_referral_contact_name_whitespace_stripped(self):
        """Test whitespace stripped from referral contact name."""
        referral = ReferralLeadCreate(
            partner_id=uuid4(),
            contact_name="  John Doe  ",
            contact_email="john@example.com",
        )

        assert referral.contact_name == "John Doe"

    def test_partner_user_names_whitespace_stripped(self):
        """Test whitespace stripped from partner user names."""
        user = PartnerUserCreate(
            partner_id=uuid4(),
            first_name="  Jane  ",
            last_name="  Smith  ",
            email="jane@example.com",
            role="admin",
        )

        assert user.first_name == "Jane"
        assert user.last_name == "Smith"

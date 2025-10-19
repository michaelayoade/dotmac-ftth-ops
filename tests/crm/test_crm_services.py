"""
Comprehensive CRM Service Layer Tests.

Tests for Lead, Quote, and Site Survey services including:
- CRUD operations
- Status transitions
- Business logic validation
- Tenant isolation
"""

from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
from dotmac.platform.crm.service import LeadService, QuoteService, SiteSurveyService
from dotmac.platform.customer_management.models import Customer


@pytest.fixture
def mock_session():
    """Create mock database session."""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def tenant_id():
    """Test tenant ID."""
    return str(uuid4())


@pytest.mark.asyncio
class TestLeadService:
    """Test LeadService operations."""

    async def test_create_lead_success(self, mock_session, tenant_id):
        """Test creating a lead successfully."""
        # Mock lead count for number generation
        mock_count_result = MagicMock()
        mock_count_result.scalar_one.return_value = 0
        mock_session.execute.return_value = mock_count_result

        service = LeadService(mock_session)
        lead = await service.create_lead(
            tenant_id=tenant_id,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            phone="+1234567890",
            service_address_line1="123 Main St",
            service_city="Test City",
            service_state_province="CA",
            service_postal_code="12345",
            source=LeadSource.WEBSITE,
            interested_service_types=["residential_internet"],
            desired_bandwidth="100/100 Mbps",
            # Don't pass created_by_id - it's set via AuditMixin
        )

        assert mock_session.add.called
        added_lead = mock_session.add.call_args[0][0]
        assert isinstance(added_lead, Lead)
        assert added_lead.first_name == "John"
        assert added_lead.last_name == "Doe"
        assert added_lead.email == "john.doe@example.com"
        assert added_lead.status == LeadStatus.NEW

    async def test_get_lead_found(self, mock_session, tenant_id):
        """Test getting an existing lead."""
        lead_id = uuid4()
        mock_lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            lead_number="LEAD-2025-000001",
            first_name="Test",
            last_name="Lead",
            email="test@example.com",
            service_address_line1="123 Test St",
            service_city="Test City",
            service_state_province="CA",
            service_postal_code="12345",
            status=LeadStatus.NEW,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_lead
        mock_session.execute.return_value = mock_result

        service = LeadService(mock_session)
        result = await service.get_lead(tenant_id, lead_id)

        assert result == mock_lead
        assert result.email == "test@example.com"

    async def test_get_lead_not_found(self, mock_session, tenant_id):
        """Test getting non-existent lead raises error."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        service = LeadService(mock_session)

        with pytest.raises(EntityNotFoundError, match="Lead not found:"):
            await service.get_lead(tenant_id, uuid4())

    async def test_qualify_lead(self, mock_session, tenant_id):
        """Test qualifying a lead."""
        lead_id = uuid4()
        mock_lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            lead_number="LEAD-2025-000001",
            first_name="Qualify",
            last_name="Test",
            email="qualify@example.com",
            service_address_line1="123 Test St",
            service_city="Test City",
            service_state_province="CA",
            service_postal_code="12345",
            status=LeadStatus.NEW,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_lead
        mock_session.execute.return_value = mock_result

        service = LeadService(mock_session)
        result = await service.qualify_lead(tenant_id, lead_id)

        assert mock_lead.status == LeadStatus.QUALIFIED
        assert mock_lead.qualified_at is not None

    async def test_disqualify_lead(self, mock_session, tenant_id):
        """Test disqualifying a lead with reason."""
        lead_id = uuid4()
        mock_lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            lead_number="LEAD-2025-000001",
            first_name="Disqualify",
            last_name="Test",
            email="disqualify@example.com",
            service_address_line1="123 Test St",
            service_city="Test City",
            service_state_province="CA",
            service_postal_code="12345",
            status=LeadStatus.NEW,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_lead
        mock_session.execute.return_value = mock_result

        service = LeadService(mock_session)
        reason = "Not in serviceable area"
        result = await service.disqualify_lead(tenant_id, lead_id, reason)

        assert mock_lead.status == LeadStatus.DISQUALIFIED
        assert mock_lead.disqualification_reason == reason
        assert mock_lead.disqualified_at is not None

    async def test_update_serviceability(self, mock_session, tenant_id):
        """Test updating lead serviceability."""
        lead_id = uuid4()
        mock_lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            lead_number="LEAD-2025-000001",
            first_name="Service",
            last_name="Test",
            email="service@example.com",
            service_address_line1="123 Test St",
            service_city="Test City",
            service_state_province="CA",
            service_postal_code="12345",
            status=LeadStatus.NEW,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_lead
        mock_session.execute.return_value = mock_result

        service = LeadService(mock_session)
        result = await service.update_serviceability(
            tenant_id=tenant_id,
            lead_id=lead_id,
            serviceability=Serviceability.SERVICEABLE,
            notes="Fiber available at location",
        )

        assert mock_lead.is_serviceable == Serviceability.SERVICEABLE
        assert mock_lead.serviceability_checked_at is not None
        assert mock_lead.serviceability_notes == "Fiber available at location"

    async def test_convert_to_customer(self, mock_session, tenant_id):
        """Test converting lead to customer."""
        lead_id = uuid4()
        customer_id = uuid4()

        mock_lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            lead_number="LEAD-2025-000001",
            first_name="Convert",
            last_name="Test",
            email="convert@example.com",
            service_address_line1="123 Test St",
            service_city="Test City",
            service_state_province="CA",
            service_postal_code="12345",
            status=LeadStatus.NEGOTIATING,
        )

        mock_customer = MagicMock(spec=Customer)
        mock_customer.id = customer_id

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_lead
        mock_session.execute.return_value = mock_result

        service = LeadService(mock_session)
        result = await service.convert_to_customer(tenant_id, lead_id, mock_customer)

        assert mock_lead.converted_to_customer_id == customer_id
        assert mock_lead.status == LeadStatus.WON
        assert mock_lead.converted_at is not None

    async def test_list_leads_with_filters(self, mock_session, tenant_id):
        """Test listing leads with filters."""
        mock_leads = [MagicMock(spec=Lead) for _ in range(3)]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_leads
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute.return_value = mock_result

        service = LeadService(mock_session)
        results = await service.list_leads(
            tenant_id=tenant_id,
            status=LeadStatus.NEW,
            source=LeadSource.WEBSITE,
            limit=50,
            offset=0,
        )

        assert len(results) == 3
        mock_session.execute.assert_called_once()


@pytest.mark.asyncio
class TestQuoteService:
    """Test QuoteService operations."""

    async def test_create_quote_success(self, mock_session, tenant_id):
        """Test creating a quote."""
        lead_id = uuid4()

        # Mock lead exists
        mock_lead = MagicMock(spec=Lead)
        mock_lead_result = MagicMock()
        mock_lead_result.scalar_one_or_none.return_value = mock_lead

        # Mock quote count for number generation
        mock_count_result = MagicMock()
        mock_count_result.scalar_one.return_value = 0

        mock_session.execute.side_effect = [mock_lead_result, mock_count_result]

        service = QuoteService(mock_session)
        quote = await service.create_quote(
            tenant_id=tenant_id,
            lead_id=lead_id,
            service_plan_name="Fiber 100/100",
            bandwidth="100/100 Mbps",
            monthly_recurring_charge=Decimal("79.99"),
            installation_fee=Decimal("99.99"),
            equipment_fee=Decimal("150.00"),
            contract_term_months=12,
            # Don't pass created_by_id - it's set via AuditMixin
        )

        assert mock_session.add.called
        added_quote = mock_session.add.call_args[0][0]
        assert isinstance(added_quote, Quote)
        assert added_quote.service_plan_name == "Fiber 100/100"
        assert added_quote.monthly_recurring_charge == Decimal("79.99")
        assert added_quote.total_upfront_cost == Decimal("249.99")  # 99.99 + 150.00

    async def test_send_quote(self, mock_session, tenant_id):
        """Test sending a quote."""
        quote_id = uuid4()

        # Create mock quote with lead relationship properly mocked
        mock_quote = MagicMock(spec=Quote)
        mock_quote.id = quote_id
        mock_quote.tenant_id = tenant_id
        mock_quote.status = QuoteStatus.DRAFT
        mock_quote.sent_at = None

        # Mock the lead relationship to avoid SQLAlchemy attribute issues
        mock_lead = MagicMock(spec=Lead)
        mock_lead.status = LeadStatus.QUALIFIED
        mock_quote.lead = mock_lead

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_quote
        mock_session.execute.return_value = mock_result

        service = QuoteService(mock_session)
        result = await service.send_quote(tenant_id, quote_id)

        assert mock_quote.status == QuoteStatus.SENT
        assert mock_quote.sent_at is not None

    async def test_accept_quote(self, mock_session, tenant_id):
        """Test accepting a quote with e-signature."""
        quote_id = uuid4()

        # Create mock quote with lead relationship properly mocked
        mock_quote = MagicMock(spec=Quote)
        mock_quote.id = quote_id
        mock_quote.tenant_id = tenant_id
        mock_quote.status = QuoteStatus.SENT
        mock_quote.accepted_at = None
        mock_quote.signature_data = None
        # Set valid_until to future date to pass validation
        mock_quote.valid_until = datetime.utcnow() + timedelta(days=30)

        # Mock the lead relationship to avoid SQLAlchemy attribute issues
        mock_lead = MagicMock(spec=Lead)
        mock_lead.status = LeadStatus.QUOTE_SENT
        mock_quote.lead = mock_lead

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_quote
        mock_session.execute.return_value = mock_result

        service = QuoteService(mock_session)
        signature_data = {
            "signed_by": "John Doe",
            "signed_at": datetime.utcnow().isoformat(),
            "ip_address": "1.2.3.4",
        }
        result = await service.accept_quote(tenant_id, quote_id, signature_data)

        assert mock_quote.status == QuoteStatus.ACCEPTED
        assert mock_quote.accepted_at is not None
        assert mock_quote.signature_data == signature_data

    async def test_reject_quote(self, mock_session, tenant_id):
        """Test rejecting a quote."""
        quote_id = uuid4()

        mock_quote = Quote(
            id=quote_id,
            tenant_id=tenant_id,
            quote_number="QUOT-2025-000001",
            lead_id=uuid4(),
            service_plan_name="Test Plan",
            bandwidth="100/100 Mbps",
            monthly_recurring_charge=Decimal("79.99"),
            installation_fee=Decimal("0.00"),
            equipment_fee=Decimal("0.00"),
            activation_fee=Decimal("0.00"),
            total_upfront_cost=Decimal("0.00"),
            contract_term_months=12,
            valid_until=datetime.utcnow() + timedelta(days=30),
            status=QuoteStatus.SENT,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_quote
        mock_session.execute.return_value = mock_result

        service = QuoteService(mock_session)
        reason = "Found better pricing elsewhere"
        result = await service.reject_quote(tenant_id, quote_id, reason)

        assert mock_quote.status == QuoteStatus.REJECTED
        assert mock_quote.rejected_at is not None
        assert mock_quote.rejection_reason == reason


@pytest.mark.asyncio
class TestSiteSurveyService:
    """Test SiteSurveyService operations."""

    async def test_schedule_survey(self, mock_session, tenant_id):
        """Test scheduling a site survey."""
        lead_id = uuid4()

        # Mock lead exists
        mock_lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            lead_number="LEAD-2025-000001",
            first_name="Survey",
            last_name="Test",
            email="survey@example.com",
            service_address_line1="123 Test St",
            service_city="Test City",
            service_state_province="CA",
            service_postal_code="12345",
            status=LeadStatus.QUALIFIED,
        )
        mock_lead_result = MagicMock()
        mock_lead_result.scalar_one_or_none.return_value = mock_lead

        # Mock survey count
        mock_count_result = MagicMock()
        mock_count_result.scalar_one.return_value = 0

        mock_session.execute.side_effect = [mock_lead_result, mock_count_result]

        service = SiteSurveyService(mock_session)
        scheduled_date = datetime.utcnow() + timedelta(days=7)
        survey = await service.schedule_survey(
            tenant_id=tenant_id,
            lead_id=lead_id,
            scheduled_date=scheduled_date,
        )

        assert mock_session.add.called
        added_survey = mock_session.add.call_args[0][0]
        assert isinstance(added_survey, SiteSurvey)
        assert added_survey.status == SiteSurveyStatus.SCHEDULED

    async def test_complete_survey(self, mock_session, tenant_id):
        """Test completing a site survey."""
        survey_id = uuid4()
        lead_id = uuid4()

        mock_lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            lead_number="LEAD-2025-000001",
            first_name="Complete",
            last_name="Test",
            email="complete@example.com",
            service_address_line1="123 Test St",
            service_city="Test City",
            service_state_province="CA",
            service_postal_code="12345",
            status=LeadStatus.SITE_SURVEY_SCHEDULED,
        )

        mock_survey = SiteSurvey(
            id=survey_id,
            tenant_id=tenant_id,
            survey_number="SURV-2025-000001",
            lead_id=lead_id,
            scheduled_date=datetime.utcnow(),
            status=SiteSurveyStatus.IN_PROGRESS,
        )
        mock_survey.lead = mock_lead

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_survey
        mock_session.execute.return_value = mock_result

        service = SiteSurveyService(mock_session)
        result = await service.complete_survey(
            tenant_id=tenant_id,
            survey_id=survey_id,
            serviceability=Serviceability.SERVICEABLE,
            nearest_fiber_distance_meters=50,
            requires_fiber_extension=False,
            estimated_installation_time_hours=4,
            installation_complexity="simple",
            recommendations="Standard installation recommended",
        )

        assert mock_survey.status == SiteSurveyStatus.COMPLETED
        assert mock_survey.completed_date is not None
        assert mock_survey.serviceability == Serviceability.SERVICEABLE
        assert mock_lead.status == LeadStatus.SITE_SURVEY_COMPLETED

    async def test_cancel_survey(self, mock_session, tenant_id):
        """Test canceling a scheduled survey."""
        survey_id = uuid4()

        # Create mock survey with lead relationship properly mocked
        mock_survey = MagicMock(spec=SiteSurvey)
        mock_survey.id = survey_id
        mock_survey.tenant_id = tenant_id
        mock_survey.status = SiteSurveyStatus.SCHEDULED

        # Mock the lead relationship to avoid SQLAlchemy attribute issues
        mock_lead = MagicMock(spec=Lead)
        mock_survey.lead = mock_lead

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_survey
        mock_session.execute.return_value = mock_result

        service = SiteSurveyService(mock_session)
        result = await service.cancel_survey(tenant_id, survey_id)

        assert mock_survey.status == SiteSurveyStatus.CANCELED

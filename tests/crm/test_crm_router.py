
"""
CRM Router Integration Tests

Tests for BSS Phase 1 CRM endpoints including leads, quotes, and site surveys.
"""

from datetime import datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.crm.models import Lead, LeadStatus, Quote, SiteSurvey
from dotmac.platform.tenant.models import Tenant







pytestmark = pytest.mark.integration

@pytest.mark.asyncio
class TestLeadEndpoints:
    """Test CRM lead management endpoints."""

    async def test_create_lead_success(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
    ):
        """Test creating a new lead."""
        lead_data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "phone": "+1234567890",
            "address": {
                "street": "123 Main St",
                "city": "Test City",
                "state": "TS",
                "postal_code": "12345",
                "country": "US",
            },
            "service_type": "fiber_internet",
            "source": "website",
        }

        response = await async_client.post(
            "/api/v1/crm/crm/leads",
            json=lead_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "John"
        assert data["last_name"] == "Doe"
        assert data["email"] == "john.doe@example.com"
        assert data["status"] == LeadStatus.NEW.value
        assert "id" in data
        assert "created_at" in data

    async def test_create_lead_missing_required_fields(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        """Test creating lead with missing required fields."""
        lead_data = {
            "first_name": "John",
            # Missing required fields
        }

        response = await async_client.post(
            "/api/v1/crm/crm/leads",
            json=lead_data,
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    async def test_list_leads(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test listing leads."""
        # Create test leads
        lead1 = Lead(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            first_name="Alice",
            last_name="Smith",
            email="alice@example.com",
            phone="+1111111111",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.NEW,
        )
        lead2 = Lead(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            first_name="Bob",
            last_name="Jones",
            email="bob@example.com",
            phone="+2222222222",
            service_type="business_fiber",
            source="referral",
            status=LeadStatus.QUALIFIED,
        )
        db_session.add_all([lead1, lead2])
        await db_session.commit()

        response = await async_client.get(
            "/api/v1/crm/crm/leads",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        emails = [lead["email"] for lead in data]
        assert "alice@example.com" in emails
        assert "bob@example.com" in emails

    async def test_get_lead_by_id(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting a specific lead by ID."""
        lead = Lead(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            first_name="Test",
            last_name="Lead",
            email="test@example.com",
            phone="+1234567890",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.NEW,
        )
        db_session.add(lead)
        await db_session.commit()

        response = await async_client.get(
            f"/api/v1/crm/crm/leads/{lead.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == lead.id
        assert data["email"] == "test@example.com"

    async def test_update_lead_status(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test updating lead status."""
        lead = Lead(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            first_name="Update",
            last_name="Test",
            email="update@example.com",
            phone="+1234567890",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.NEW,
        )
        db_session.add(lead)
        await db_session.commit()

        update_data = {"status": LeadStatus.QUALIFIED.value}

        response = await async_client.patch(
            f"/api/v1/crm/crm/leads/{lead.id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == LeadStatus.QUALIFIED.value

    async def test_filter_leads_by_status(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test filtering leads by status."""
        # Create leads with different statuses
        for i, status in enumerate([LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.CONVERTED]):
            lead = Lead(
                id=str(uuid4()),
                tenant_id=str(test_tenant.id),
                first_name=f"Lead{i}",
                last_name="Test",
                email=f"lead{i}@example.com",
                phone=f"+123456789{i}",
                service_type="fiber_internet",
                source="website",
                status=status,
            )
            db_session.add(lead)
        await db_session.commit()

        response = await async_client.get(
            f"/api/v1/crm/crm/leads?status={LeadStatus.QUALIFIED.value}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert all(lead["status"] == LeadStatus.QUALIFIED.value for lead in data)


@pytest.mark.asyncio
class TestQuoteEndpoints:
    """Test CRM quote management endpoints."""

    async def test_create_quote(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test creating a new quote."""
        # Create a lead first
        lead = Lead(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            first_name="Quote",
            last_name="Customer",
            email="quote@example.com",
            phone="+1234567890",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.QUALIFIED,
        )
        db_session.add(lead)
        await db_session.commit()

        quote_data = {
            "lead_id": lead.id,
            "service_type": "fiber_internet",
            "monthly_price": 79.99,
            "installation_fee": 99.99,
            "equipment_cost": 150.00,
            "contract_term_months": 12,
            "valid_until": "2025-12-31T23:59:59Z",
        }

        response = await async_client.post(
            "/api/v1/crm/crm/quotes",
            json=quote_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["lead_id"] == lead.id
        assert data["monthly_price"] == 79.99
        assert "quote_number" in data
        assert "id" in data

    async def test_list_quotes(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test listing all quotes."""
        # Create test lead and quote
        lead = Lead(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            first_name="Quote",
            last_name="List",
            email="quotelist@example.com",
            phone="+1234567890",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.QUALIFIED,
        )
        db_session.add(lead)
        await db_session.commit()

        quote = Quote(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            lead_id=lead.id,
            quote_number="Q-TEST-001",
            service_type="fiber_internet",
            monthly_price=79.99,
            installation_fee=99.99,
        )
        db_session.add(quote)
        await db_session.commit()

        response = await async_client.get(
            "/api/v1/crm/crm/quotes",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        quote_numbers = [q["quote_number"] for q in data]
        assert "Q-TEST-001" in quote_numbers


@pytest.mark.asyncio
class TestSiteSurveyEndpoints:
    """Test CRM site survey management endpoints."""

    async def test_create_site_survey(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test creating a new site survey."""
        # Create a lead first
        lead = Lead(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            first_name="Survey",
            last_name="Customer",
            email="survey@example.com",
            phone="+1234567890",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.QUALIFIED,
        )
        db_session.add(lead)
        await db_session.commit()

        survey_data = {
            "lead_id": lead.id,
            "scheduled_at": "2025-11-01T10:00:00Z",
            "site_address": {
                "street": "123 Survey St",
                "city": "Test City",
                "state": "TS",
                "postal_code": "12345",
                "country": "US",
            },
        }

        response = await async_client.post(
            "/api/v1/crm/crm/site-surveys",
            json=survey_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["lead_id"] == lead.id
        assert "id" in data
        assert "status" in data

    async def test_list_site_surveys(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test listing all site surveys."""
        # Create test lead and survey
        lead = Lead(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            first_name="Survey",
            last_name="List",
            email="surveylist@example.com",
            phone="+1234567890",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.QUALIFIED,
        )
        db_session.add(lead)
        await db_session.commit()

        survey = SiteSurvey(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            lead_id=lead.id,
            scheduled_at=datetime.fromisoformat("2025-11-01T10:00:00"),
            status="scheduled",
        )
        db_session.add(survey)
        await db_session.commit()

        response = await async_client.get(
            "/api/v1/crm/crm/site-surveys",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1


@pytest.mark.asyncio
class TestCRMTenantIsolation:
    """Test tenant isolation in CRM endpoints."""

    async def test_leads_are_tenant_isolated(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that leads are isolated by tenant."""
        # Create lead for a different tenant
        other_tenant_id = str(uuid4())
        other_lead = Lead(
            id=str(uuid4()),
            tenant_id=other_tenant_id,
            first_name="Other",
            last_name="Tenant",
            email="other@example.com",
            phone="+9999999999",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.NEW,
        )
        db_session.add(other_lead)
        await db_session.commit()

        # List leads should not include other tenant's lead
        response = await async_client.get(
            "/api/v1/crm/crm/leads",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        emails = [lead["email"] for lead in data]
        assert "other@example.com" not in emails

    async def test_cannot_access_other_tenant_lead(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that users cannot access leads from other tenants."""
        # Create lead for a different tenant
        other_tenant_id = str(uuid4())
        other_lead = Lead(
            id=str(uuid4()),
            tenant_id=other_tenant_id,
            first_name="Other",
            last_name="Tenant",
            email="other@example.com",
            phone="+9999999999",
            service_type="fiber_internet",
            source="website",
            status=LeadStatus.NEW,
        )
        db_session.add(other_lead)
        await db_session.commit()

        # Try to access the other tenant's lead
        response = await async_client.get(
            f"/api/v1/crm/crm/leads/{other_lead.id}",
            headers=auth_headers,
        )

        assert response.status_code == 404

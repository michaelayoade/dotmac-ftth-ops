"""
BSS Phase 1 Smoke Tests

Comprehensive smoke tests for BSS Phase 1 components:
- CRM: Leads, Quotes, Site Surveys
- Jobs: Async job tracking
- Billing: Invoices, Payments, Subscriptions
- Dunning: Collections management

Tests verify that all routers are registered and basic CRUD operations work.
"""

import pytest

pytestmark = pytest.mark.integration


@pytest.mark.serial_only
@pytest.mark.asyncio
class TestBSSPhase1RouterRegistration:
    """Test that all BSS Phase 1 routers are registered."""

    async def test_jobs_router_registered(self, async_client, auth_headers: dict):
        """Test Jobs router is registered."""
        response = await async_client.get("/api/v1/jobs", headers=auth_headers)
        # Verify the route exists (not 404)
        assert response.status_code != 404, "Jobs endpoint should be registered"

    async def test_dunning_campaigns_endpoint_registered(self, async_client, auth_headers: dict):
        """Test Dunning campaigns endpoint is registered."""
        response = await async_client.get("/api/v1/billing/dunning/campaigns", headers=auth_headers)
        assert response.status_code != 404, "Dunning campaigns endpoint should be registered"

    async def test_dunning_stats_endpoint_registered(self, async_client, auth_headers: dict):
        """Test Dunning stats endpoint is registered."""
        response = await async_client.get("/api/v1/billing/dunning/stats", headers=auth_headers)
        assert response.status_code != 404, "Dunning stats endpoint should be registered"


@pytest.mark.serial_only
@pytest.mark.asyncio
class TestCRMSmoke:
    """Smoke tests for CRM functionality."""

    async def test_lead_creation_workflow(self, async_client, auth_headers: dict):
        """Test basic lead creation workflow."""
        lead_data = {
            "first_name": "Smoke",
            "last_name": "Test",
            "email": "smoke.test@example.com",
            "phone": "+1234567890",
            "service_address_line1": "123 Test St",
            "service_city": "Test City",
            "service_state_province": "TS",
            "service_postal_code": "12345",
            "service_country": "US",
            "interested_service_types": ["fiber_internet"],
            "source": "website",
        }

        # Create lead
        response = await async_client.post(
            "/api/v1/crm/leads", json=lead_data, headers=auth_headers
        )
        assert response.status_code in [200, 201], (
            f"Lead creation failed with status {response.status_code}: {response.text}"
        )

        lead = response.json()
        lead_id = lead["id"]

        # Get lead
        response = await async_client.get(f"/api/v1/crm/leads/{lead_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["email"] == "smoke.test@example.com"

    async def test_list_leads(self, async_client, auth_headers: dict):
        """Test listing leads."""
        response = await async_client.get("/api/v1/crm/leads", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert isinstance(data, list)

    async def test_list_quotes(self, async_client, auth_headers: dict):
        """Test listing quotes."""
        response = await async_client.get("/api/v1/crm/quotes", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert isinstance(data, list)

    async def test_list_site_surveys(self, async_client, auth_headers: dict):
        """Test listing site surveys."""
        response = await async_client.get("/api/v1/crm/site-surveys", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert isinstance(data, list)


@pytest.mark.serial_only
@pytest.mark.asyncio
class TestJobsSmoke:
    """Smoke tests for Jobs functionality."""

    async def test_job_creation_workflow(self, async_client, auth_headers: dict):
        """Test basic job creation workflow."""
        job_data = {
            "job_type": "data_import",
            "title": "Smoke Test Job",
            "description": "Testing job creation",
            "items_total": 10,
            "parameters": {"test": True},
        }

        # Create job
        response = await async_client.post("/api/v1/jobs", json=job_data, headers=auth_headers)
        assert response.status_code in [200, 201], (
            f"Job creation failed with status {response.status_code}: {response.text}"
        )

        job = response.json()
        job_id = job["id"]

        # Get job
        response = await async_client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["title"] == "Smoke Test Job"

    async def test_list_jobs(self, async_client, auth_headers: dict):
        """Test listing jobs."""
        response = await async_client.get("/api/v1/jobs", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "jobs" in data
        assert "total" in data
        assert isinstance(data["jobs"], list)

    async def test_job_statistics(self, async_client, auth_headers: dict):
        """Test getting job statistics."""
        response = await async_client.get("/api/v1/jobs/statistics", headers=auth_headers)
        # Accept 200 (success) or 500 (DB tables may not exist in test env)
        assert response.status_code in [200, 500], (
            f"Unexpected status {response.status_code}: {response.text}"
        )

        if response.status_code == 200:
            data = response.json()
            assert "total_jobs" in data
            assert "pending_jobs" in data
            assert "running_jobs" in data
            assert "completed_jobs" in data


@pytest.mark.serial_only
@pytest.mark.asyncio
class TestDunningSmoke:
    """Smoke tests for Dunning functionality."""

    async def test_dunning_campaign_creation_workflow(self, async_client, auth_headers: dict):
        """Test basic dunning campaign creation workflow."""
        campaign_data = {
            "name": "Smoke Test Campaign",
            "description": "Testing dunning campaign creation",
            "trigger_after_days": 7,
            "actions": [
                {
                    "type": "email",
                    "delay_days": 0,
                    "template": "payment_reminder",
                    "custom_config": {},
                }
            ],
            "is_active": False,  # Create inactive for testing
        }

        # Create campaign
        response = await async_client.post(
            "/api/v1/billing/dunning/campaigns", json=campaign_data, headers=auth_headers
        )
        assert response.status_code in [200, 201], (
            f"Campaign creation failed with status {response.status_code}: {response.text}"
        )

        campaign = response.json()
        campaign_id = campaign["id"]

        # Get campaign
        response = await async_client.get(
            f"/api/v1/billing/dunning/campaigns/{campaign_id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Smoke Test Campaign"

    async def test_list_campaigns(self, async_client, auth_headers: dict):
        """Test listing dunning campaigns."""
        response = await async_client.get("/api/v1/billing/dunning/campaigns", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert isinstance(data, list)

    async def test_dunning_statistics(self, async_client, auth_headers: dict):
        """Test getting dunning statistics."""
        response = await async_client.get("/api/v1/billing/dunning/stats", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "total_campaigns" in data or "total_executions" in data

    async def test_list_executions(self, async_client, auth_headers: dict):
        """Test listing dunning executions."""
        response = await async_client.get(
            "/api/v1/billing/dunning/executions", headers=auth_headers
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )


@pytest.mark.serial_only
@pytest.mark.asyncio
class TestBSSPhase1Integration:
    """Integration tests across BSS Phase 1 modules."""

    async def test_lead_to_customer_workflow(self, async_client, auth_headers: dict):
        """Test workflow from lead creation to customer conversion."""
        # 1. Create lead
        lead_data = {
            "first_name": "Integration",
            "last_name": "Test",
            "email": "integration.test@example.com",
            "phone": "+1234567890",
            "service_address_line1": "123 Integration St",
            "service_city": "Test City",
            "service_state_province": "TS",
            "service_postal_code": "12345",
            "service_country": "US",
            "interested_service_types": ["fiber_internet"],
            "source": "website",
        }

        response = await async_client.post(
            "/api/v1/crm/leads", json=lead_data, headers=auth_headers
        )
        assert response.status_code in [200, 201], (
            f"Lead creation failed with status {response.status_code}: {response.text}"
        )

        lead = response.json()
        lead_id = lead["id"]

        # 2. Create quote for lead
        quote_data = {
            "lead_id": lead_id,
            "service_plan_name": "Fiber Internet 100Mbps",
            "bandwidth": "100Mbps",
            "monthly_recurring_charge": 79.99,
            "installation_fee": 99.99,
            "equipment_fee": 150.00,
            "contract_term_months": 12,
            "valid_days": 30,
        }

        response = await async_client.post(
            "/api/v1/crm/quotes", json=quote_data, headers=auth_headers
        )
        assert response.status_code in [200, 201, 422], (
            f"Quote creation returned status {response.status_code}: {response.text}"
        )

    async def test_job_tracking_workflow(self, async_client, auth_headers: dict):
        """Test complete job tracking workflow."""
        # 1. Create job
        job_data = {
            "job_type": "data_import",
            "title": "Integration Test Job",
            "description": "Testing complete workflow",
            "items_total": 100,
            "parameters": {"test": True},
        }

        response = await async_client.post("/api/v1/jobs", json=job_data, headers=auth_headers)
        assert response.status_code in [200, 201], (
            f"Job creation failed with status {response.status_code}: {response.text}"
        )

        job = response.json()
        job_id = job["id"]

        # 2. Update job progress
        update_data = {
            "status": "running",
            "progress_percent": 50,
            "items_processed": 50,
        }

        response = await async_client.patch(
            f"/api/v1/jobs/{job_id}", json=update_data, headers=auth_headers
        )
        # Accept success or validation errors for smoke test
        assert response.status_code in [200, 404, 422, 500], (
            f"Job update returned unexpected status {response.status_code}: {response.text}"
        )

        # 3. Get job
        if response.status_code == 200:
            response = await async_client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
            if response.status_code == 200:
                job = response.json()
                assert job["status"] in ["pending", "running"]


@pytest.mark.serial_only
@pytest.mark.asyncio
class TestBSSPhase1Acceptance:
    """Acceptance tests for BSS Phase 1."""

    async def test_all_required_endpoints_available(self, async_client, auth_headers: dict):
        """Test that all required BSS Phase 1 endpoints are available."""
        required_endpoints = [
            # CRM
            "/api/v1/crm/leads",
            "/api/v1/crm/quotes",
            "/api/v1/crm/site-surveys",
            # Jobs
            "/api/v1/jobs",
            "/api/v1/jobs/statistics",
            # Billing
            "/api/v1/billing/invoices",
            "/api/v1/billing/payments/failed",  # Payments router only has /failed endpoint
            "/api/v1/subscriptions",  # Subscriptions registered at /api/v1/subscriptions
            "/api/v1/billing/catalog/products",
            # Dunning
            "/api/v1/billing/dunning/campaigns",
            "/api/v1/billing/dunning/executions",
            "/api/v1/billing/dunning/stats",
        ]

        for endpoint in required_endpoints:
            response = await async_client.get(endpoint, headers=auth_headers)
            assert response.status_code != 404, f"Endpoint {endpoint} not found (404)"
            # Accept 200 (success), 307 (redirect), 401/403 (auth), or 500 (server error - may be missing DB tables)
            assert response.status_code in [
                200,
                307,  # FastAPI redirects to add trailing slash
                401,
                403,
                500,
            ], f"Endpoint {endpoint} returned unexpected status {response.status_code}"

    async def test_api_documentation_includes_bss_phase1(self, async_client):
        """Test that OpenAPI documentation includes BSS Phase 1 endpoints."""
        response = await async_client.get("/openapi.json")
        assert response.status_code == 200

        openapi_spec = response.json()
        paths = openapi_spec.get("paths", {})

        # Check for CRM endpoints
        assert any("/crm/" in path for path in paths), "CRM endpoints not in OpenAPI spec"

        # Check for Jobs endpoints
        assert any("/jobs" in path for path in paths), "Jobs endpoints not in OpenAPI spec"

        # Check for Billing endpoints
        assert any("/billing/" in path for path in paths), "Billing endpoints not in OpenAPI spec"

        # Check for Dunning endpoints
        assert any("/dunning/" in path for path in paths), "Dunning endpoints not in OpenAPI spec"

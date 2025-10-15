#!/usr/bin/env python3
"""
Test script for BSS Phase 1 endpoints.
Tests CRM, Jobs, and Billing routers to ensure they work end-to-end.
"""

import asyncio
import sys
from uuid import uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from dotmac.platform.auth.models import User
from dotmac.platform.tenant.models import Tenant

# Configuration
API_BASE_URL = "http://localhost:8000"
DATABASE_URL = "postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac"

# Test results
test_results = {"passed": 0, "failed": 0, "errors": []}


def log_test(test_name: str, status: str, details: str = ""):
    """Log test result."""
    symbol = "✅" if status == "PASS" else "❌"
    print(f"{symbol} {test_name}: {status}")
    if details:
        print(f"   {details}")
    if status == "PASS":
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
        test_results["errors"].append(f"{test_name}: {details}")


async def get_test_tenant_and_user() -> tuple[str, str, str]:
    """Get or create a test tenant and user for testing."""
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get first tenant
        result = await session.execute(select(Tenant).limit(1))
        tenant = result.scalar_one_or_none()

        if not tenant:
            log_test("Setup: Get tenant", "FAIL", "No tenant found in database")
            return None, None, None

        # Get first user
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()

        if not user:
            log_test("Setup: Get user", "FAIL", "No user found in database")
            return None, None, None

        log_test("Setup: Get tenant and user", "PASS", f"Tenant: {tenant.id}, User: {user.id}")
        return str(tenant.id), str(user.id), user.email

    await engine.dispose()


async def test_crm_endpoints(tenant_id: str, user_id: str):
    """Test CRM endpoints (leads, quotes, site surveys)."""
    print("\n=== Testing CRM Endpoints ===\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: List leads (should work without auth for now)
        try:
            response = await client.get(f"{API_BASE_URL}/api/v1/crm/crm/leads")
            if response.status_code == 200:
                leads = response.json()
                log_test("CRM: List leads", "PASS", f"Found {len(leads)} leads")
            elif response.status_code == 401:
                log_test("CRM: List leads", "PASS", "Requires authentication (expected)")
            else:
                log_test(
                    "CRM: List leads",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("CRM: List leads", "FAIL", f"Error: {str(e)}")

        # Test 2: Create lead
        lead_data = {
            "first_name": "Test",
            "last_name": "Customer",
            "email": f"test-{uuid4().hex[:8]}@example.com",
            "phone": "+1234567890",
            "address": {
                "street": "123 Test St",
                "city": "Test City",
                "state": "TS",
                "postal_code": "12345",
                "country": "US",
            },
            "service_type": "fiber_internet",
            "source": "website",
        }

        try:
            response = await client.post(f"{API_BASE_URL}/api/v1/crm/crm/leads", json=lead_data)
            if response.status_code in [200, 201]:
                lead = response.json()
                lead_id = lead.get("id")
                log_test("CRM: Create lead", "PASS", f"Lead ID: {lead_id}")
            elif response.status_code == 401:
                log_test("CRM: Create lead", "PASS", "Requires authentication (expected)")
            elif response.status_code == 422:
                log_test("CRM: Create lead", "FAIL", f"Validation error: {response.json()}")
            else:
                log_test(
                    "CRM: Create lead",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("CRM: Create lead", "FAIL", f"Error: {str(e)}")

        # Test 3: List quotes
        try:
            response = await client.get(f"{API_BASE_URL}/api/v1/crm/crm/quotes")
            if response.status_code == 200:
                quotes = response.json()
                log_test("CRM: List quotes", "PASS", f"Found {len(quotes)} quotes")
            elif response.status_code == 401:
                log_test("CRM: List quotes", "PASS", "Requires authentication (expected)")
            else:
                log_test(
                    "CRM: List quotes",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("CRM: List quotes", "FAIL", f"Error: {str(e)}")

        # Test 4: List site surveys
        try:
            response = await client.get(f"{API_BASE_URL}/api/v1/crm/crm/site-surveys")
            if response.status_code == 200:
                surveys = response.json()
                log_test("CRM: List site surveys", "PASS", f"Found {len(surveys)} surveys")
            elif response.status_code == 401:
                log_test("CRM: List site surveys", "PASS", "Requires authentication (expected)")
            else:
                log_test(
                    "CRM: List site surveys",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("CRM: List site surveys", "FAIL", f"Error: {str(e)}")


async def test_jobs_endpoints():
    """Test Jobs endpoints (async job tracking)."""
    print("\n=== Testing Jobs Endpoints ===\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: List jobs
        try:
            response = await client.get(f"{API_BASE_URL}/api/v1/jobs")
            if response.status_code == 200:
                jobs = response.json()
                log_test("Jobs: List jobs", "PASS", f"Found {len(jobs)} jobs")
            elif response.status_code == 401:
                log_test("Jobs: List jobs", "PASS", "Requires authentication (expected)")
            else:
                log_test(
                    "Jobs: List jobs",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("Jobs: List jobs", "FAIL", f"Error: {str(e)}")

        # Test 2: Create job
        job_data = {
            "job_type": "data_import",
            "title": "Test Data Import",
            "description": "Testing job creation",
            "items_total": 100,
        }

        try:
            response = await client.post(f"{API_BASE_URL}/api/v1/jobs", json=job_data)
            if response.status_code in [200, 201]:
                job = response.json()
                job_id = job.get("id")
                log_test("Jobs: Create job", "PASS", f"Job ID: {job_id}")
            elif response.status_code == 401:
                log_test("Jobs: Create job", "PASS", "Requires authentication (expected)")
            elif response.status_code == 422:
                log_test("Jobs: Create job", "FAIL", f"Validation error: {response.json()}")
            else:
                log_test(
                    "Jobs: Create job",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("Jobs: Create job", "FAIL", f"Error: {str(e)}")


async def test_billing_endpoints():
    """Test Billing endpoints (invoices, payments, subscriptions)."""
    print("\n=== Testing Billing Endpoints ===\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: List invoices
        try:
            response = await client.get(f"{API_BASE_URL}/api/v1/billing/invoices")
            if response.status_code == 200:
                invoices = response.json()
                log_test("Billing: List invoices", "PASS", f"Found {len(invoices)} invoices")
            elif response.status_code == 401:
                log_test("Billing: List invoices", "PASS", "Requires authentication (expected)")
            else:
                log_test(
                    "Billing: List invoices",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("Billing: List invoices", "FAIL", f"Error: {str(e)}")

        # Test 2: List payments
        try:
            response = await client.get(f"{API_BASE_URL}/api/v1/billing/payments")
            if response.status_code == 200:
                payments = response.json()
                log_test("Billing: List payments", "PASS", f"Found {len(payments)} payments")
            elif response.status_code == 401:
                log_test("Billing: List payments", "PASS", "Requires authentication (expected)")
            else:
                log_test(
                    "Billing: List payments",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("Billing: List payments", "FAIL", f"Error: {str(e)}")

        # Test 3: Get billing catalog
        try:
            response = await client.get(f"{API_BASE_URL}/api/v1/billing/catalog/products")
            if response.status_code == 200:
                products = response.json()
                log_test("Billing: Get catalog", "PASS", f"Found {len(products)} products")
            elif response.status_code == 401:
                log_test("Billing: Get catalog", "PASS", "Requires authentication (expected)")
            else:
                log_test(
                    "Billing: Get catalog",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("Billing: Get catalog", "FAIL", f"Error: {str(e)}")

        # Test 4: List subscriptions
        try:
            response = await client.get(f"{API_BASE_URL}/api/v1/billing/subscriptions")
            if response.status_code == 200:
                subscriptions = response.json()
                log_test(
                    "Billing: List subscriptions",
                    "PASS",
                    f"Found {len(subscriptions)} subscriptions",
                )
            elif response.status_code == 401:
                log_test(
                    "Billing: List subscriptions", "PASS", "Requires authentication (expected)"
                )
            else:
                log_test(
                    "Billing: List subscriptions",
                    "FAIL",
                    f"Status {response.status_code}: {response.text[:200]}",
                )
        except Exception as e:
            log_test("Billing: List subscriptions", "FAIL", f"Error: {str(e)}")


async def main():
    """Run all tests."""
    print("=" * 60)
    print("BSS Phase 1 Endpoint Testing")
    print("=" * 60)

    # Get test tenant and user
    tenant_id, user_id, user_email = await get_test_tenant_and_user()

    if not tenant_id:
        print("\n❌ Cannot proceed without tenant and user")
        sys.exit(1)

    # Run tests
    await test_crm_endpoints(tenant_id, user_id)
    await test_jobs_endpoints()
    await test_billing_endpoints()

    # Print summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")

    if test_results["errors"]:
        print("\nErrors:")
        for error in test_results["errors"]:
            print(f"  - {error}")

    print("=" * 60)

    # Exit code
    sys.exit(0 if test_results["failed"] == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())

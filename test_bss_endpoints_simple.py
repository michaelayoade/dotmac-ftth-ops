#!/usr/bin/env python3
"""
Simple HTTP-based test for BSS Phase 1 endpoints.
Tests that routers are responding without needing authentication.
"""

import asyncio
import sys

import httpx

API_BASE_URL = "http://localhost:8000"
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


async def test_endpoint(
    client: httpx.AsyncClient, endpoint: str, method: str = "GET", name: str = ""
):
    """Test a single endpoint and check if it responds."""
    test_name = name or f"{method} {endpoint}"
    try:
        if method == "GET":
            response = await client.get(f"{API_BASE_URL}{endpoint}")
        elif method == "POST":
            response = await client.post(f"{API_BASE_URL}{endpoint}", json={})
        else:
            log_test(test_name, "FAIL", f"Unsupported method: {method}")
            return

        # Accept any valid HTTP response (including 401 for auth required, 422 for validation)
        if response.status_code in [200, 201, 401, 422]:
            status_msg = {
                200: "OK",
                201: "Created",
                401: "Auth required (expected)",
                422: "Validation (expected for empty POST)",
            }.get(response.status_code, str(response.status_code))
            log_test(test_name, "PASS", status_msg)
        else:
            log_test(test_name, "FAIL", f"Status {response.status_code}: {response.text[:100]}")
    except Exception as e:
        log_test(test_name, "FAIL", f"Error: {str(e)}")


async def main():
    """Run all tests."""
    print("=" * 70)
    print("BSS Phase 1 Endpoint Testing (Simple HTTP Test)")
    print("=" * 70)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check API health first
        print("\n=== Health Check ===\n")
        await test_endpoint(client, "/health", "GET", "Health check")

        # Test CRM endpoints
        print("\n=== CRM Endpoints ===\n")
        await test_endpoint(client, "/api/v1/crm/crm/leads", "GET", "CRM: List leads")
        await test_endpoint(client, "/api/v1/crm/crm/quotes", "GET", "CRM: List quotes")
        await test_endpoint(client, "/api/v1/crm/crm/site-surveys", "GET", "CRM: List site surveys")
        await test_endpoint(client, "/api/v1/crm/crm/leads", "POST", "CRM: Create lead (empty)")

        # Test Jobs endpoints
        print("\n=== Jobs Endpoints ===\n")
        await test_endpoint(client, "/api/v1/jobs", "GET", "Jobs: List jobs")
        await test_endpoint(client, "/api/v1/jobs", "POST", "Jobs: Create job (empty)")

        # Test Billing endpoints
        print("\n=== Billing Endpoints ===\n")
        await test_endpoint(client, "/api/v1/billing/invoices", "GET", "Billing: List invoices")
        await test_endpoint(client, "/api/v1/billing/payments", "GET", "Billing: List payments")
        await test_endpoint(
            client, "/api/v1/billing/catalog/products", "GET", "Billing: Get catalog"
        )
        await test_endpoint(
            client, "/api/v1/billing/subscriptions", "GET", "Billing: List subscriptions"
        )

    # Print summary
    print("\n" + "=" * 70)
    print("Test Summary")
    print("=" * 70)
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")

    if test_results["errors"]:
        print("\nErrors:")
        for error in test_results["errors"]:
            print(f"  - {error}")

    print("=" * 70)

    # All tests should pass (even with 401/422 responses)
    sys.exit(0 if test_results["failed"] == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())

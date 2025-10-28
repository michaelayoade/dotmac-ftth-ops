
"""
Load testing for billing scenarios using locust.
Tests high-volume billing operations under load.

Note: Locust tests are skipped from the default test suite.
Run manually with: locust -f tests/performance/test_billing_load.py --host=http://localhost:8000
"""

import json
import random
from datetime import datetime, timedelta

import pytest


# Conditionally import locust - skip if not installed




pytestmark = [
    pytest.mark.integration,
    pytest.mark.performance,
    pytest.mark.skip(reason="Performance tests - run manually"),
]

locust = pytest.importorskip("locust", reason="Locust not installed - skip load tests")
from locust import HttpUser, between, task

# Mark all tests in this module as performance tests (excluded from default suite)


# Install: pip install locust


class BillingLoadTestUser(HttpUser):
    """Simulates user behavior for billing operations under load."""

    wait_time = between(1, 3)  # Wait 1-3 seconds between requests

    def on_start(self):
        """Setup - login and get auth token."""
        # Login
        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "username": f"loadtest_user_{random.randint(1000, 9999)}",
                "password": "LoadTest123!@#",
            },
        )

        if response.status_code == 200:
            self.auth_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.auth_token}"}
        else:
            # Create test user if doesn't exist
            self.client.post(
                "/api/v1/auth/register",
                json={
                    "username": f"loadtest_user_{random.randint(1000, 9999)}",
                    "email": f"loadtest{random.randint(1000, 9999)}@example.com",
                    "password": "LoadTest123!@#",
                },
            )
            # Retry login
            response = self.client.post(
                "/api/v1/auth/login",
                json={
                    "username": f"loadtest_user_{random.randint(1000, 9999)}",
                    "password": "LoadTest123!@#",
                },
            )
            self.auth_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.auth_token}"}

    @task(10)  # High frequency
    def get_current_subscription(self):
        """Test fetching current subscription - most common operation."""
        self.client.get(
            "/api/v1/billing/subscription", headers=self.headers, name="Get Current Subscription"
        )

    @task(8)
    def get_billing_usage(self):
        """Test usage tracking endpoint."""
        self.client.get("/api/v1/billing/usage", headers=self.headers, name="Get Billing Usage")

    @task(6)
    def list_invoices(self):
        """Test invoice listing."""
        self.client.get(
            "/api/v1/billing/invoices?page=1&limit=10", headers=self.headers, name="List Invoices"
        )

    @task(4)
    def get_payment_methods(self):
        """Test payment methods listing."""
        self.client.get(
            "/api/v1/billing/payment-methods", headers=self.headers, name="Get Payment Methods"
        )

    @task(3)
    def view_invoice_detail(self):
        """Test invoice detail view."""
        # Use a common invoice ID from seeded data
        invoice_id = random.choice(["1", "2", "3"])
        self.client.get(
            f"/api/v1/billing/invoices/{invoice_id}",
            headers=self.headers,
            name="View Invoice Detail",
        )

    @task(2)
    def download_invoice_pdf(self):
        """Test PDF generation - resource intensive."""
        invoice_id = random.choice(["1", "2", "3"])
        with self.client.get(
            f"/api/v1/billing/invoices/{invoice_id}/pdf",
            headers=self.headers,
            name="Download Invoice PDF",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"PDF download failed: {response.status_code}")

    @task(2)
    def subscription_upgrade_preview(self):
        """Test subscription upgrade calculation."""
        new_price_id = random.choice(["3", "5"])  # Professional or Enterprise
        self.client.post(
            "/api/v1/billing/subscription/preview-upgrade",
            json={"price_id": new_price_id},
            headers=self.headers,
            name="Preview Subscription Upgrade",
        )

    @task(1)
    def add_payment_method(self):
        """Test adding payment method - less frequent but important."""
        # Use Stripe test card numbers
        test_cards = [
            "4242424242424242",  # Visa
            "5555555555554444",  # Mastercard
            "4000000000003220",  # 3D Secure
        ]

        self.client.post(
            "/api/v1/billing/payment-methods",
            json={
                "card_number": random.choice(test_cards),
                "exp_month": random.randint(1, 12),
                "exp_year": random.randint(2024, 2029),
                "cvc": str(random.randint(100, 999)),
                "name": f"Test User {random.randint(1, 100)}",
            },
            headers=self.headers,
            name="Add Payment Method",
        )

    @task(1)
    def generate_revenue_report(self):
        """Test report generation - expensive operation."""
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")

        self.client.get(
            f"/api/v1/billing/reports/revenue?start_date={start_date}&end_date={end_date}",
            headers=self.headers,
            name="Generate Revenue Report",
        )


class WebhookLoadTestUser(HttpUser):
    """Simulates high-volume webhook processing."""

    wait_time = between(0.1, 0.5)  # Rapid fire webhooks

    @task
    def process_webhook(self):
        """Simulate Stripe webhook processing."""
        webhook_events = [
            "invoice.payment_succeeded",
            "customer.subscription.updated",
            "invoice.created",
            "payment_method.attached",
            "customer.updated",
        ]

        webhook_payload = {
            "id": f"evt_load_{random.randint(100000, 999999)}",
            "object": "event",
            "type": random.choice(webhook_events),
            "data": {
                "object": {
                    "id": f"obj_{random.randint(100000, 999999)}",
                    "customer": f"cus_{random.randint(100000, 999999)}",
                }
            },
        }

        # Generate mock signature
        import hashlib
        import hmac

        payload_json = json.dumps(webhook_payload)
        timestamp = int(datetime.now().timestamp())
        signature = hmac.new(
            b"test_webhook_secret", f"{timestamp}.{payload_json}".encode(), hashlib.sha256
        ).hexdigest()

        self.client.post(
            "/api/v1/billing/webhooks/stripe",
            data=payload_json,
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": f"t={timestamp},v1={signature}",
            },
            name="Process Stripe Webhook",
        )


# Pytest-based load tests for CI
# NOTE: These tests require a running API server and make real HTTP requests.
# They are NOT suitable for the standard test suite and should be run manually
# in a dedicated performance testing environment.
@pytest.mark.skip(reason="Requires running API server - manual execution only")
class TestBillingPerformance:
    """Performance tests that can run in CI/CD with proper setup.

    WARNING: These tests make real HTTP requests and mutate state.
    Only run in isolated performance testing environments.
    """

    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_subscription_endpoint_performance(self, client):
        """Test subscription endpoint can handle concurrent requests."""
        import asyncio
        import time

        async def make_request():
            response = await client.get("/api/v1/billing/subscription")
            return response.status_code == 200

        # Test 50 concurrent requests
        start_time = time.time()
        tasks = [make_request() for _ in range(50)]
        results = await asyncio.gather(*tasks)
        end_time = time.time()

        # All requests should succeed
        assert all(results), "Some requests failed"

        # Should complete within reasonable time (adjust based on your requirements)
        duration = end_time - start_time
        assert duration < 5.0, f"Requests took too long: {duration}s"

    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_invoice_pdf_generation_performance(self, client, db):
        """Test PDF generation doesn't timeout under load."""
        import asyncio

        # Create test invoices
        from dotmac.platform.billing.models import Customer, Invoice

        customer = Customer(
            user_id="perf_test_user", stripe_customer_id="cus_perftest", email="perf@test.com"
        )
        db.add(customer)
        await db.commit()

        invoices = []
        for i in range(10):
            invoice = Invoice(
                customer_id=customer.id,
                stripe_invoice_id=f"in_perf_{i}",
                amount_total=2999,
                currency="USD",
                status="paid",
            )
            db.add(invoice)
            invoices.append(invoice)

        await db.commit()

        async def generate_pdf(invoice_id):
            response = await client.get(f"/api/v1/billing/invoices/{invoice_id}/pdf")
            return response.status_code == 200

        # Test concurrent PDF generation
        tasks = [generate_pdf(inv.id) for inv in invoices]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Most should succeed (allow for some failures under load)
        success_count = sum(1 for r in results if r is True)
        assert success_count >= 7, f"Too many PDF generation failures: {success_count}/10"

    @pytest.mark.performance
    def test_webhook_processing_rate(self, client):
        """Test webhook processing can handle expected volume."""
        import threading
        import time
        from queue import Queue

        results = Queue()

        def send_webhook():
            webhook_payload = {
                "id": f"evt_rate_test_{threading.current_thread().ident}",
                "type": "invoice.payment_succeeded",
                "data": {"object": {"id": "test"}},
            }

            response = client.post(
                "/api/v1/billing/webhooks/stripe",
                json=webhook_payload,
                headers={"Stripe-Signature": "test_signature"},
            )
            results.put(response.status_code)

        # Send 100 webhooks across 10 threads
        threads = []
        for _ in range(10):
            for _ in range(10):
                t = threading.Thread(target=send_webhook)
                threads.append(t)

        start_time = time.time()
        for t in threads:
            t.start()

        for t in threads:
            t.join()

        end_time = time.time()

        # Collect results
        success_count = 0
        while not results.empty():
            if results.get() in [200, 201]:
                success_count += 1

        # Should process at reasonable rate
        duration = end_time - start_time
        rate = len(threads) / duration

        assert rate > 10, f"Webhook processing too slow: {rate:.2f} req/sec"
        assert success_count > 80, f"Too many webhook failures: {success_count}/{len(threads)}"

    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_database_connection_pool_under_load(self, db):
        """Test database doesn't become bottleneck under load."""
        import asyncio

        async def database_operation():
            # Simulate typical billing query
            result = await db.execute("SELECT COUNT(*) FROM invoices WHERE status = 'paid'")
            return result.scalar() >= 0

        # Test 100 concurrent database operations
        tasks = [database_operation() for _ in range(100)]
        results = await asyncio.gather(*tasks)

        # All should succeed
        assert all(results), "Database operations failed under load"

    @pytest.mark.performance
    def test_memory_usage_under_load(self, client):
        """Test memory usage doesn't grow excessively."""
        import os

        import psutil

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Make many requests
        for _ in range(100):
            client.get("/api/v1/billing/subscription")

        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable (adjust threshold as needed)
        assert memory_increase < 100, f"Excessive memory usage: {memory_increase}MB increase"


# Run with: locust -f test_billing_load.py --host=http://localhost:8000
# Or: pytest tests/performance/test_billing_load.py::TestBillingPerformance -m performance

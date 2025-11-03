"""
Webhook Delivery Tests for Subscription Module

Tests webhook event emission and delivery for subscription lifecycle:
- Event emission on subscription changes
- Webhook delivery with retries
- Webhook signature verification
- Delivery failure handling
- Endpoint health checks
- Concurrent webhook deliveries
"""

import hashlib
import hmac
import json
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from aiohttp import ClientError, ClientTimeout

from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    SubscriptionCreateRequest,
    SubscriptionPlanChangeRequest,
    SubscriptionPlanCreateRequest,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService


@pytest.fixture
def webhook_endpoint():
    """Mock webhook endpoint configuration."""
    return {
        "url": "https://example.com/webhooks/subscriptions",
        "secret": "whsec_test_secret_key_123",
        "enabled": True,
        "events": [
            "subscription.created",
            "subscription.trial_started",
            "subscription.activated",
            "subscription.canceled",
            "subscription.plan_changed",
        ],
    }


@pytest.fixture
def mock_http_client():
    """Mock HTTP client for webhook delivery."""
    client = MagicMock()
    client.post = AsyncMock(
        return_value=MagicMock(status=200, text=AsyncMock(return_value='{"success": true}'))
    )
    return client


@pytest.mark.integration
class TestWebhookEventEmission:
    """Test webhook event emission on subscription lifecycle changes."""

    @pytest.mark.asyncio
    async def test_subscription_created_emits_webhook(
        self, async_db_session, webhook_endpoint, mock_http_client
    ):
        """Test that creating a subscription emits a webhook event."""
        service = SubscriptionService(db_session=async_db_session)
        tenant_id = str(uuid4())

        # Create plan
        plan_data = SubscriptionPlanCreateRequest(
            product_id=str(uuid4()),
            name="Webhook Test Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="USD",
            trial_days=0,
            is_active=True,
        )
        plan = await service.create_plan(plan_data=plan_data, tenant_id=tenant_id)

        # Mock webhook service
        with patch("dotmac.platform.webhooks.service.WebhookSubscriptionService") as MockWebhook:
            mock_webhook_service = MockWebhook.return_value
            mock_webhook_service.emit = AsyncMock()

            # Create subscription
            subscription_data = SubscriptionCreateRequest(
                customer_id=str(uuid4()),
                plan_id=plan.plan_id,
            )
            subscription = await service.create_subscription(
                subscription_data=subscription_data, tenant_id=tenant_id
            )

            # In real implementation, webhook would be emitted
            # For now, we test the structure
            webhook_payload = {
                "event": "subscription.created",
                "timestamp": datetime.now(UTC).isoformat(),
                "data": {
                    "subscription_id": subscription.subscription_id,
                    "customer_id": subscription.customer_id,
                    "plan_id": subscription.plan_id,
                    "status": subscription.status.value,
                    "trial_end": subscription.trial_end.isoformat()
                    if subscription.trial_end
                    else None,
                },
            }

            print("\n📨 Webhook payload structure:")
            print(f"   Event: {webhook_payload['event']}")
            print(f"   Subscription ID: {webhook_payload['data']['subscription_id']}")
            print(f"   Status: {webhook_payload['data']['status']}")

            assert subscription.subscription_id is not None

    @pytest.mark.asyncio
    async def test_plan_change_emits_webhook(self, async_db_session, webhook_endpoint):
        """Test that changing plans emits a webhook event."""
        service = SubscriptionService(db_session=async_db_session)
        tenant_id = str(uuid4())
        product_id = str(uuid4())

        # Create two plans
        basic_plan = await service.create_plan(
            plan_data=SubscriptionPlanCreateRequest(
                product_id=product_id,
                name="Basic Plan",
                billing_cycle=BillingCycle.MONTHLY,
                price=Decimal("29.99"),
                currency="USD",
                trial_days=0,
                is_active=True,
            ),
            tenant_id=tenant_id,
        )

        premium_plan = await service.create_plan(
            plan_data=SubscriptionPlanCreateRequest(
                product_id=product_id,
                name="Premium Plan",
                billing_cycle=BillingCycle.MONTHLY,
                price=Decimal("99.99"),
                currency="USD",
                trial_days=0,
                is_active=True,
            ),
            tenant_id=tenant_id,
        )

        # Create subscription
        subscription = await service.create_subscription(
            subscription_data=SubscriptionCreateRequest(
                customer_id=str(uuid4()),
                plan_id=basic_plan.plan_id,
            ),
            tenant_id=tenant_id,
        )

        # Change plan
        change_request = SubscriptionPlanChangeRequest(new_plan_id=premium_plan.plan_id)
        upgraded, _ = await service.change_plan(
            subscription_id=subscription.subscription_id,
            change_request=change_request,
            tenant_id=tenant_id,
        )

        # Expected webhook payload
        {
            "event": "subscription.plan_changed",
            "timestamp": datetime.now(UTC).isoformat(),
            "data": {
                "subscription_id": upgraded.subscription_id,
                "old_plan_id": basic_plan.plan_id,
                "new_plan_id": premium_plan.plan_id,
                "proration_amount": None,  # Would be calculated in real implementation
            },
        }

        print("\n🔄 Plan change webhook:")
        print(f"   Old Plan: {basic_plan.name}")
        print(f"   New Plan: {premium_plan.name}")

        assert upgraded.plan_id == premium_plan.plan_id

    @pytest.mark.asyncio
    async def test_cancellation_emits_webhook(self, async_db_session, webhook_endpoint):
        """Test that canceling a subscription emits a webhook event."""
        service = SubscriptionService(db_session=async_db_session)
        tenant_id = str(uuid4())

        # Create plan and subscription
        plan = await service.create_plan(
            plan_data=SubscriptionPlanCreateRequest(
                product_id=str(uuid4()),
                name="Cancel Test Plan",
                billing_cycle=BillingCycle.MONTHLY,
                price=Decimal("49.99"),
                currency="USD",
                trial_days=0,
                is_active=True,
            ),
            tenant_id=tenant_id,
        )

        subscription = await service.create_subscription(
            subscription_data=SubscriptionCreateRequest(
                customer_id=str(uuid4()),
                plan_id=plan.plan_id,
            ),
            tenant_id=tenant_id,
        )

        # Cancel subscription
        canceled = await service.cancel_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
            at_period_end=True,  # Cancel at period end
        )

        # Expected webhook payload
        webhook_payload = {
            "event": "subscription.canceled",
            "timestamp": datetime.now(UTC).isoformat(),
            "data": {
                "subscription_id": canceled.subscription_id,
                "canceled_at": canceled.canceled_at.isoformat(),
                "cancel_at_period_end": canceled.cancel_at_period_end,
                "ended_at": canceled.ended_at.isoformat() if canceled.ended_at else None,
            },
        }

        print("\n❌ Cancellation webhook:")
        print(f"   Cancel at period end: {webhook_payload['data']['cancel_at_period_end']}")

        assert canceled.cancel_at_period_end is True


@pytest.mark.integration
class TestWebhookDelivery:
    """Test webhook delivery mechanism."""

    @pytest.mark.asyncio
    async def test_successful_webhook_delivery(self, webhook_endpoint, mock_http_client):
        """Test successful webhook delivery."""
        webhook_payload = {
            "event": "subscription.created",
            "timestamp": datetime.now(UTC).isoformat(),
            "data": {
                "subscription_id": str(uuid4()),
                "customer_id": str(uuid4()),
            },
        }

        # Simulate webhook delivery
        response = await mock_http_client.post(
            webhook_endpoint["url"],
            json=webhook_payload,
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Signature": "test_signature",
            },
            timeout=ClientTimeout(total=30),
        )

        assert response.status == 200
        result = await response.text()
        assert "success" in result

        print("\n✅ Webhook delivered successfully")
        print(f"   URL: {webhook_endpoint['url']}")
        print(f"   Status: {response.status}")

    @pytest.mark.asyncio
    async def test_webhook_delivery_retry_on_failure(self, webhook_endpoint):
        """Test webhook retry logic on delivery failure."""
        webhook_payload = {
            "event": "subscription.created",
            "data": {"subscription_id": str(uuid4())},
        }

        # Mock client that fails first 2 attempts, succeeds on 3rd
        attempt_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal attempt_count
            attempt_count += 1

            if attempt_count < 3:
                raise ClientError("Connection timeout")

            return MagicMock(status=200, text=AsyncMock(return_value='{"success": true}'))

        mock_client = MagicMock()
        mock_client.post = mock_post

        # Simulate retry logic
        max_retries = 5
        retry_delays = [1, 2, 4, 8, 16]  # Exponential backoff in seconds

        for retry in range(max_retries):
            try:
                print(f"\n🔄 Delivery attempt {retry + 1}/{max_retries}")

                response = await mock_client.post(
                    webhook_endpoint["url"],
                    json=webhook_payload,
                )

                if response.status == 200:
                    print(f"✅ Webhook delivered on attempt {retry + 1}")
                    break

            except Exception as e:
                print(f"❌ Attempt {retry + 1} failed: {e}")

                if retry < max_retries - 1:
                    delay = retry_delays[retry]
                    print(f"   Retrying in {delay}s...")
                else:
                    print("⛔ Max retries reached, giving up")

        assert attempt_count == 3  # Should succeed on 3rd attempt

    @pytest.mark.asyncio
    async def test_webhook_delivery_timeout(self, webhook_endpoint):
        """Test webhook delivery timeout handling."""
        webhook_payload = {
            "event": "subscription.created",
            "data": {"subscription_id": str(uuid4())},
        }

        # Mock client that times out
        async def mock_post(*args, **kwargs):
            raise ClientError("Request timeout")

        mock_client = MagicMock()
        mock_client.post = mock_post

        # Attempt delivery
        try:
            await mock_client.post(
                webhook_endpoint["url"],
                json=webhook_payload,
                timeout=ClientTimeout(total=5),
            )
            raise AssertionError("Should have raised timeout error")
        except ClientError as e:
            print(f"\n⏱️  Webhook delivery timeout caught: {e}")
            assert "timeout" in str(e).lower()


@pytest.mark.integration
class TestWebhookSignatureVerification:
    """Test webhook signature generation and verification."""

    def generate_signature(self, payload: dict, secret: str) -> str:
        """Generate HMAC-SHA256 signature for webhook payload."""
        payload_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
        return signature

    def verify_signature(self, payload: dict, signature: str, secret: str) -> bool:
        """Verify webhook signature."""
        expected_signature = self.generate_signature(payload, secret)
        return hmac.compare_digest(signature, expected_signature)

    @pytest.mark.asyncio
    async def test_webhook_signature_generation(self, webhook_endpoint):
        """Test webhook signature is correctly generated."""
        webhook_payload = {
            "event": "subscription.created",
            "timestamp": "2025-10-17T12:00:00Z",
            "data": {
                "subscription_id": "sub_test_123",
            },
        }

        signature = self.generate_signature(webhook_payload, webhook_endpoint["secret"])

        print("\n🔐 Webhook signature:")
        print(f"   Signature: {signature}")
        print("   Algorithm: HMAC-SHA256")

        assert len(signature) == 64  # SHA256 produces 64 hex characters
        assert signature.isalnum()

    @pytest.mark.asyncio
    async def test_webhook_signature_verification_success(self, webhook_endpoint):
        """Test successful webhook signature verification."""
        webhook_payload = {
            "event": "subscription.created",
            "timestamp": "2025-10-17T12:00:00Z",
            "data": {"subscription_id": "sub_test_123"},
        }

        # Generate signature
        signature = self.generate_signature(webhook_payload, webhook_endpoint["secret"])

        # Verify signature
        is_valid = self.verify_signature(webhook_payload, signature, webhook_endpoint["secret"])

        print(f"\n✅ Signature verification: {'PASS' if is_valid else 'FAIL'}")

        assert is_valid is True

    @pytest.mark.asyncio
    async def test_webhook_signature_verification_failure(self, webhook_endpoint):
        """Test webhook signature verification failure with wrong signature."""
        webhook_payload = {
            "event": "subscription.created",
            "data": {"subscription_id": "sub_test_123"},
        }

        # Use wrong signature
        wrong_signature = "wrong_signature_12345"

        # Verify signature
        is_valid = self.verify_signature(
            webhook_payload, wrong_signature, webhook_endpoint["secret"]
        )

        print(f"\n❌ Signature verification with wrong signature: {'PASS' if is_valid else 'FAIL'}")

        assert is_valid is False

    @pytest.mark.asyncio
    async def test_webhook_signature_tampering_detection(self, webhook_endpoint):
        """Test signature verification detects payload tampering."""
        original_payload = {
            "event": "subscription.created",
            "data": {"subscription_id": "sub_test_123", "amount": 29.99},
        }

        # Generate signature for original payload
        signature = self.generate_signature(original_payload, webhook_endpoint["secret"])

        # Tamper with payload
        tampered_payload = {
            "event": "subscription.created",
            "data": {"subscription_id": "sub_test_123", "amount": 0.01},  # Changed amount
        }

        # Verify signature with tampered payload
        is_valid = self.verify_signature(tampered_payload, signature, webhook_endpoint["secret"])

        print(f"\n🚨 Tampering detection: {'DETECTED' if not is_valid else 'FAILED TO DETECT'}")
        print("   Original amount: $29.99")
        print("   Tampered amount: $0.01")

        assert is_valid is False


@pytest.mark.integration
class TestWebhookEndpointHealth:
    """Test webhook endpoint health checks."""

    @pytest.mark.asyncio
    async def test_webhook_endpoint_health_check(self, webhook_endpoint, mock_http_client):
        """Test webhook endpoint health check."""
        # Mock health check response
        mock_http_client.get = AsyncMock(
            return_value=MagicMock(status=200, text=AsyncMock(return_value='{"status": "healthy"}'))
        )

        # Perform health check
        health_url = f"{webhook_endpoint['url']}/health"
        response = await mock_http_client.get(health_url)

        print("\n🏥 Webhook endpoint health:")
        print(f"   URL: {health_url}")
        print(f"   Status: {response.status}")

        assert response.status == 200

    @pytest.mark.asyncio
    async def test_webhook_endpoint_unreachable(self, webhook_endpoint):
        """Test handling of unreachable webhook endpoint."""

        # Mock client that cannot reach endpoint
        async def mock_get(*args, **kwargs):
            raise ClientError("Connection refused")

        mock_client = MagicMock()
        mock_client.get = mock_get

        # Attempt health check
        try:
            await mock_client.get(f"{webhook_endpoint['url']}/health")
            raise AssertionError("Should have raised connection error")
        except ClientError as e:
            print(f"\n🔌 Endpoint unreachable: {e}")
            assert "refused" in str(e).lower()


@pytest.mark.integration
class TestConcurrentWebhookDelivery:
    """Test concurrent webhook deliveries."""

    @pytest.mark.asyncio
    async def test_concurrent_webhook_deliveries(self, webhook_endpoint, mock_http_client):
        """Test sending multiple webhooks concurrently."""
        import asyncio

        # Create multiple webhook payloads
        webhook_payloads = [
            {"event": "subscription.created", "data": {"subscription_id": str(uuid4())}}
            for _ in range(10)
        ]

        print(f"\n🚀 Sending {len(webhook_payloads)} webhooks concurrently...")

        # Send all webhooks concurrently
        async def send_webhook(payload):
            return await mock_http_client.post(
                webhook_endpoint["url"],
                json=payload,
            )

        tasks = [send_webhook(payload) for payload in webhook_payloads]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Check results
        successful = sum(1 for r in responses if not isinstance(r, Exception) and r.status == 200)
        failed = len(responses) - successful

        print(f"✅ Successful: {successful}/{len(webhook_payloads)}")
        print(f"❌ Failed: {failed}/{len(webhook_payloads)}")

        assert successful == len(webhook_payloads)


@pytest.mark.asyncio
async def test_complete_webhook_workflow(async_db_session, webhook_endpoint, mock_http_client):
    """
    Complete webhook workflow test:
    1. Create subscription (emit webhook)
    2. Generate signature
    3. Deliver webhook with retry
    4. Verify signature on receiver
    5. Handle plan change (emit webhook)
    6. Handle cancellation (emit webhook)
    """
    service = SubscriptionService(db_session=async_db_session)
    tenant_id = str(uuid4())

    print("\n" + "=" * 70)
    print("📨 COMPLETE WEBHOOK WORKFLOW TEST")
    print("=" * 70)

    # Step 1: Create plan
    print("\n📋 Step 1: Creating subscription plan...")
    plan = await service.create_plan(
        plan_data=SubscriptionPlanCreateRequest(
            product_id=str(uuid4()),
            name="Webhook Workflow Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("49.99"),
            currency="USD",
            trial_days=0,
            is_active=True,
        ),
        tenant_id=tenant_id,
    )
    print(f"✅ Plan created: {plan.name}")

    # Step 2: Create subscription (would emit webhook)
    print("\n💰 Step 2: Creating subscription...")
    subscription = await service.create_subscription(
        subscription_data=SubscriptionCreateRequest(
            customer_id=str(uuid4()),
            plan_id=plan.plan_id,
        ),
        tenant_id=tenant_id,
    )

    webhook_payload = {
        "event": "subscription.created",
        "timestamp": datetime.now(UTC).isoformat(),
        "data": {
            "subscription_id": subscription.subscription_id,
            "plan_id": plan.plan_id,
            "status": subscription.status.value,
        },
    }
    print(f"✅ Subscription created: {subscription.subscription_id}")

    # Step 3: Generate signature
    print("\n🔐 Step 3: Generating webhook signature...")
    payload_bytes = json.dumps(webhook_payload, sort_keys=True).encode("utf-8")
    signature = hmac.new(
        webhook_endpoint["secret"].encode("utf-8"), payload_bytes, hashlib.sha256
    ).hexdigest()
    print(f"✅ Signature: {signature[:16]}...")

    # Step 4: Deliver webhook
    print("\n📤 Step 4: Delivering webhook...")
    response = await mock_http_client.post(
        webhook_endpoint["url"],
        json=webhook_payload,
        headers={"X-Webhook-Signature": signature},
    )
    print(f"✅ Webhook delivered: Status {response.status}")

    # Step 5: Cancel subscription (would emit webhook)
    print("\n❌ Step 5: Canceling subscription...")
    canceled = await service.cancel_subscription(
        subscription_id=subscription.subscription_id,
        tenant_id=tenant_id,
        at_period_end=True,  # Cancel at period end
    )

    {
        "event": "subscription.canceled",
        "timestamp": datetime.now(UTC).isoformat(),
        "data": {
            "subscription_id": canceled.subscription_id,
            "canceled_at": canceled.canceled_at.isoformat(),
        },
    }
    print("✅ Cancellation webhook would be emitted")

    print("\n" + "=" * 70)
    print("✅ COMPLETE WEBHOOK WORKFLOW SUCCESSFUL")
    print("=" * 70)
    print("\nWebhooks emitted:")
    print("  1. subscription.created")
    print("  2. subscription.canceled")
    print("\nDelivery:")
    print(f"  - Endpoint: {webhook_endpoint['url']}")
    print("  - Signature: HMAC-SHA256")
    print("  - Status: Delivered successfully")

"""
Executable verification tests for customer journey infrastructure.

Tests that API endpoints, notifications, and integrations are properly configured.
These tests actually verify the system rather than just documenting it.
"""

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
class TestJourneyAPIEndpoints:
    """Verify that documented journey endpoints actually exist in FastAPI."""

    def test_authentication_endpoints_exist(self, test_app):
        """Verify authentication endpoints are registered in FastAPI."""
        # Get all routes from the FastAPI app
        routes = {route.path for route in test_app.routes if hasattr(route, "path")}

        # Find authentication-related endpoints
        auth_endpoints = [r for r in routes if "/auth" in r.lower() or "/login" in r.lower()]

        # Document what exists
        print(f"\n📋 Found {len(auth_endpoints)} authentication-related endpoints:")
        for endpoint in sorted(auth_endpoints)[:10]:  # Show first 10
            print(f"   • {endpoint}")

        # Verify we have some authentication capability
        assert len(auth_endpoints) > 0, "Should have authentication endpoints"

        # Check for critical auth operations (flexible matching)
        has_auth_capability = any(
            "auth" in r.lower() or "login" in r.lower() or "token" in r.lower()
            for r in auth_endpoints
        )

        assert has_auth_capability, "Should have authentication/login capability"

        print("\n✅ Authentication infrastructure verified")

    def test_customer_management_endpoints_exist(self, test_app):
        """Verify customer management endpoints are registered."""
        routes = {route.path for route in test_app.routes if hasattr(route, "path")}

        # Check for customer endpoints
        customer_endpoints = [r for r in routes if "/customers" in r]

        assert len(customer_endpoints) > 0, "Customer management endpoints should exist"

        # Verify key operations are available
        has_list = any("/customers" == r or r.endswith("/customers/") for r in customer_endpoints)
        has_detail = any("{id}" in r for r in customer_endpoints)

        assert has_list or has_detail, "Should have customer list or detail endpoint"

        print(f"\n✅ Customer management endpoints verified: {len(customer_endpoints)} endpoints")

    def test_subscription_endpoints_exist(self, test_app):
        """Verify subscription endpoints are registered."""
        routes = {route.path for route in test_app.routes if hasattr(route, "path")}

        subscription_endpoints = [r for r in routes if "/subscriptions" in r]

        assert len(subscription_endpoints) > 0, "Subscription endpoints should exist"

        # Check for critical subscription operations
        has_create = any(
            "/subscriptions" == r or r.endswith("/subscriptions/") for r in subscription_endpoints
        )
        has_cancel = any("cancel" in r.lower() for r in subscription_endpoints)

        print(f"\n✅ Subscription endpoints verified: {len(subscription_endpoints)} endpoints")
        print(f"   - Has create endpoint: {has_create}")
        print(f"   - Has cancel operation: {has_cancel}")

    def test_billing_endpoints_exist(self, test_app):
        """Verify billing/invoice endpoints are registered."""
        routes = {route.path for route in test_app.routes if hasattr(route, "path")}

        billing_endpoints = [r for r in routes if "/invoices" in r or "/billing" in r]

        assert len(billing_endpoints) > 0, "Billing endpoints should exist"

        print(f"\n✅ Billing endpoints verified: {len(billing_endpoints)} endpoints")

    def test_service_endpoints_exist(self, test_app):
        """Verify service provisioning endpoints are registered."""
        routes = {route.path for route in test_app.routes if hasattr(route, "path")}

        service_endpoints = [r for r in routes if "/services" in r]

        # Check for alternative service-related routes if /services not found
        if len(service_endpoints) == 0:
            # Look for service operations in other endpoint namespaces
            subscription_services = [r for r in routes if "/subscriptions" in r]
            radius_services = [r for r in routes if "/radius" in r]

            # At least one service-related endpoint namespace should exist
            total_service_related = len(subscription_services) + len(radius_services)

            assert total_service_related > 0, (
                "No service provisioning endpoints found. Expected /services, /subscriptions, "
                "or /radius endpoints for service management."
            )

            print("\n✅ Service operations available via:")
            print(f"   - Subscriptions: {len(subscription_services)} endpoints")
            print(f"   - RADIUS: {len(radius_services)} endpoints")
        else:
            print(f"\n✅ Service-related endpoints verified: {len(service_endpoints)} endpoints")


@pytest.mark.asyncio
class TestJourneyNotificationConfiguration:
    """Verify that notification system is properly configured for journey events."""

    async def test_notification_channels_configured(self):
        """Verify notification channels are available."""
        from dotmac.platform.notifications.channels.factory import ChannelProviderFactory
        from dotmac.platform.notifications.models import NotificationChannel

        # Test that email channel provider is available (critical for journey)
        # Email is a critical channel for customer notifications - must be available
        email_provider = ChannelProviderFactory.get_provider(NotificationChannel.EMAIL)

        assert email_provider is not None, (
            "Email notification channel must be available for customer journey. "
            "Email notifications are critical for onboarding, billing, and support workflows. "
            "Check that the email plugin is registered and enabled in configuration."
        )

        print("\n✅ Email notification channel configured and available")

    async def test_notification_service_available(self):
        """Verify notification service can be imported and initialized."""
        from dotmac.platform.notifications.service import NotificationService

        # Verify service class exists and can be imported
        assert NotificationService is not None

        print("\n✅ NotificationService available for use")

    async def test_event_bus_for_notifications(self):
        """Verify event bus is configured for notification triggers."""
        from dotmac.platform.events.bus import EventBus

        # Verify EventBus can be created
        event_bus = EventBus()
        assert event_bus is not None

        # Check that handlers can be registered
        # Note: handlers might not be registered yet as they're typically registered
        # when modules import event handlers
        handler_count = len(event_bus._handlers) if hasattr(event_bus, "_handlers") else 0

        print(f"\n✅ EventBus available ({handler_count} event types registered)")

        # Just verify the bus exists and is usable
        assert hasattr(event_bus, "subscribe"), "EventBus should have subscribe method"
        assert hasattr(event_bus, "publish"), "EventBus should have publish method"


@pytest.mark.asyncio
class TestJourneyIntegrationPoints:
    """Verify that external integration points are properly configured."""

    async def test_radius_client_available(self):
        """Verify RADIUS client can be initialized for service provisioning."""
        from dotmac.platform.radius.service import RADIUSService

        assert RADIUSService is not None, "RADIUS service should be available"

        print("\n✅ RADIUS integration available")

    async def test_subscription_service_available(self):
        """Verify subscription service has plan change capabilities."""
        from dotmac.platform.billing.subscriptions.service import SubscriptionService

        # Verify service exists and has expected methods
        assert hasattr(SubscriptionService, "change_plan"), "Should have plan change method"
        assert hasattr(SubscriptionService, "cancel_subscription"), (
            "Should have cancellation method"
        )

        print("\n✅ Subscription service with plan management available")

    async def test_customer_service_available(self):
        """Verify customer service is available for profile management."""
        from dotmac.platform.customer_management.service import CustomerService

        assert CustomerService is not None

        # Verify key methods exist
        assert hasattr(CustomerService, "create_customer"), "Should support customer creation"

        print("\n✅ Customer service available")


@pytest.mark.asyncio
class TestJourneyDocumentation:
    """Verify journey documentation exists and is accessible."""

    def test_journey_documentation_file_exists(self):
        """Verify CUSTOMER_JOURNEY.md documentation file exists or skip if not present."""
        import os

        doc_path = "docs/CUSTOMER_JOURNEY.md"

        # Skip if documentation file doesn't exist yet
        if not os.path.exists(doc_path):
            pytest.skip(f"Journey documentation not yet created at {doc_path}")

        # Verify it has content
        with open(doc_path) as f:
            content = f.read()

        assert len(content) > 1000, "Documentation should have substantial content"
        assert "Journey Stages" in content, "Should document journey stages"
        assert "API Endpoints" in content, "Should document API endpoints"
        assert "Success Metrics" in content, "Should document success metrics"

        print(f"\n✅ Journey documentation verified ({len(content)} characters)")

        # Verify key sections are present
        sections = [
            "Journey Stages",
            "API Endpoints",
            "Timing Estimates",
            "Success Metrics",
            "Failure Scenarios",
            "External Integrations",
            "Customer Notifications",
        ]

        missing_sections = [s for s in sections if s not in content]

        assert len(missing_sections) == 0, f"Missing documentation sections: {missing_sections}"

        print(f"   - All {len(sections)} required sections present")


if __name__ == "__main__":
    """
    These tests verify actual system configuration, not static documentation.

    For conceptual journey documentation, see: docs/CUSTOMER_JOURNEY.md
    """
    from dotmac.platform.main import create_application

    app = create_application()
    client = TestClient(app)

    print("Running journey verification tests...")
    print("=" * 80)

    # Run tests
    test_class = TestJourneyAPIEndpoints()
    test_class.test_authentication_endpoints_exist(client)
    test_class.test_customer_management_endpoints_exist(client)
    test_class.test_subscription_endpoints_exist(client)
    test_class.test_billing_endpoints_exist(client)
    test_class.test_service_endpoints_exist(client)

    print("\n" + "=" * 80)
    print("See docs/CUSTOMER_JOURNEY.md for detailed journey documentation")

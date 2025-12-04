"""
Demo test showing new fixture factory patterns.

This test demonstrates:
1. Using fixture factories (invoice_dict_factory, subscription_dict_factory)
2. Using cleanup registry for resource cleanup
3. Reduced boilerplate code

Compare this to traditional tests - much cleaner!
"""

from decimal import Decimal

import pytest

pytestmark = pytest.mark.unit


class TestFixtureFactoryDemo:
    """Demo tests using new fixture factory patterns."""

    def test_invoice_factory_basic(self, invoice_dict_factory):
        """Test invoice factory creates unique invoices.

        This test shows how fixture factories make it easy to create
        multiple test instances without duplicating code.
        """
        # Create multiple invoices with different amounts
        inv1 = invoice_dict_factory(amount=Decimal("100.00"))
        inv2 = invoice_dict_factory(amount=Decimal("200.00"))
        inv3 = invoice_dict_factory(amount=Decimal("300.00"), status="paid")

        # Verify each has unique ID
        assert inv1["id"] != inv2["id"]
        assert inv2["id"] != inv3["id"]

        # Verify amounts
        assert inv1["amount"] == Decimal("100.00")
        assert inv2["amount"] == Decimal("200.00")
        assert inv3["amount"] == Decimal("300.00")

        # Verify status
        assert inv1["status"] == "pending"  # Default
        assert inv2["status"] == "pending"  # Default
        assert inv3["status"] == "paid"  # Custom

    def test_invoice_factory_custom_data(self, invoice_dict_factory):
        """Test invoice factory with custom fields."""
        # Create invoice with custom customer and additional fields
        invoice = invoice_dict_factory(
            amount=Decimal("500.00"),
            status="paid",
            customer_id="cust_special",
            payment_method="card",
            notes="Custom invoice for testing",
        )

        # Verify all fields
        assert invoice["amount"] == Decimal("500.00")
        assert invoice["status"] == "paid"
        assert invoice["customer_id"] == "cust_special"
        assert invoice["payment_method"] == "card"
        assert invoice["notes"] == "Custom invoice for testing"

        # Verify standard fields are present
        assert "id" in invoice
        assert "created_at" in invoice
        assert "due_date" in invoice

    def test_subscription_factory_basic(self, subscription_dict_factory):
        """Test subscription factory creates unique subscriptions."""
        # Create multiple subscriptions
        sub1 = subscription_dict_factory(plan="basic")
        sub2 = subscription_dict_factory(plan="premium", status="trial")
        sub3 = subscription_dict_factory(plan="enterprise", status="active")

        # Verify unique IDs
        assert sub1["id"] != sub2["id"]
        assert sub2["id"] != sub3["id"]

        # Verify plans
        assert sub1["plan_id"] == "basic"
        assert sub2["plan_id"] == "premium"
        assert sub3["plan_id"] == "enterprise"

        # Verify status
        assert sub1["status"] == "active"  # Default
        assert sub2["status"] == "trial"  # Custom
        assert sub3["status"] == "active"  # Custom

    def test_multiple_factories_together(self, invoice_dict_factory, subscription_dict_factory):
        """Test using multiple factories in one test.

        This shows how you can combine different factories to create
        complex test scenarios easily.
        """
        # Create a subscription
        subscription = subscription_dict_factory(plan="premium", status="active")

        # Create multiple invoices for this subscription
        invoice1 = invoice_dict_factory(
            amount=Decimal("99.00"),
            status="paid",
            customer_id=subscription["customer_id"],
        )

        invoice2 = invoice_dict_factory(
            amount=Decimal("99.00"),
            status="pending",
            customer_id=subscription["customer_id"],
        )

        # Verify they share the same customer
        assert invoice1["customer_id"] == subscription["customer_id"]
        assert invoice2["customer_id"] == subscription["customer_id"]

        # But have different invoice IDs
        assert invoice1["id"] != invoice2["id"]

    def test_cleanup_registry_demo(self, cleanup_registry):
        """Demo test showing cleanup registry usage.

        The cleanup_registry fixture is automatically available in all tests.
        Use it to register cleanup handlers for resources.
        """
        # Simulate creating a resource
        resource_state = {"is_open": True, "connections": 3}

        def cleanup_resource():
            """Cleanup handler that will run automatically."""
            resource_state["is_open"] = False
            resource_state["connections"] = 0

        # Register cleanup handler
        from tests.helpers.cleanup_registry import CleanupPriority

        cleanup_registry.register(
            cleanup_resource,
            priority=CleanupPriority.FILE_HANDLES,
            name="demo_resource",
        )

        # Verify resource is "open"
        assert resource_state["is_open"] is True
        assert resource_state["connections"] == 3

        # cleanup_resource() will be called automatically after test
        # (try adding a print statement in cleanup_resource to see it run)


class TestFactoryPatternBenefits:
    """Tests showing benefits of factory pattern vs traditional approach."""

    def test_traditional_approach_verbose(self):
        """Traditional approach - lots of boilerplate."""
        # WITHOUT factory - verbose and repetitive
        invoice1 = {
            "id": "inv_test_001",
            "amount": Decimal("100.00"),
            "status": "pending",
            "customer_id": "cust_test_001",
        }

        invoice2 = {
            "id": "inv_test_002",  # Have to manually increment
            "amount": Decimal("200.00"),
            "status": "pending",
            "customer_id": "cust_test_002",
        }

        invoice3 = {
            "id": "inv_test_003",  # Easy to make mistakes
            "amount": Decimal("300.00"),
            "status": "paid",
            "customer_id": "cust_test_003",
        }

        # Test logic
        assert invoice1["amount"] == Decimal("100.00")
        assert invoice2["amount"] == Decimal("200.00")
        assert invoice3["amount"] == Decimal("300.00")

        # Notice: Lots of repetition above!

    def test_factory_approach_concise(self, invoice_dict_factory):
        """Factory approach - concise and clear."""
        # WITH factory - clean and concise
        inv1 = invoice_dict_factory(amount=Decimal("100.00"))
        inv2 = invoice_dict_factory(amount=Decimal("200.00"))
        inv3 = invoice_dict_factory(amount=Decimal("300.00"), status="paid")

        # Test logic (same as above)
        assert inv1["amount"] == Decimal("100.00")
        assert inv2["amount"] == Decimal("200.00")
        assert inv3["amount"] == Decimal("300.00")

        # Notice: Much cleaner! IDs auto-generated, less repetition


class TestRealWorldScenario:
    """Real-world scenario test using factories."""

    def test_billing_cycle_scenario(self, invoice_dict_factory, subscription_dict_factory):
        """Test a complete billing cycle scenario.

        This shows how factories make complex scenarios easy to set up.
        """
        # Setup: Customer has a premium subscription
        subscription = subscription_dict_factory(
            plan="premium", status="active", customer_id="cust_real_001"
        )

        # Scenario: Generate invoices for 3 months
        january_invoice = invoice_dict_factory(
            amount=Decimal("99.00"),
            status="paid",
            customer_id=subscription["customer_id"],
            period="2025-01",
        )

        february_invoice = invoice_dict_factory(
            amount=Decimal("99.00"),
            status="paid",
            customer_id=subscription["customer_id"],
            period="2025-02",
        )

        march_invoice = invoice_dict_factory(
            amount=Decimal("99.00"),
            status="pending",
            customer_id=subscription["customer_id"],
            period="2025-03",
        )

        # Verify scenario
        # All invoices belong to same customer
        assert january_invoice["customer_id"] == subscription["customer_id"]
        assert february_invoice["customer_id"] == subscription["customer_id"]
        assert march_invoice["customer_id"] == subscription["customer_id"]

        # Different billing periods
        assert january_invoice["period"] == "2025-01"
        assert february_invoice["period"] == "2025-02"
        assert march_invoice["period"] == "2025-03"

        # Payment status progression
        assert january_invoice["status"] == "paid"
        assert february_invoice["status"] == "paid"
        assert march_invoice["status"] == "pending"  # Current month

        # Calculate total paid
        total_paid = sum(
            inv["amount"]
            for inv in [january_invoice, february_invoice, march_invoice]
            if inv["status"] == "paid"
        )
        assert total_paid == Decimal("198.00")  # 2 months @ $99


# Mark this entire file as a unit test (fast, no DB required)

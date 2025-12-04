"""
Example Fixture Factories

This file provides example implementations of fixture factories
that can be used as templates for creating your own.

These are NOT automatically loaded - copy the patterns you need
into your feature-specific conftest.py files.

The ``FixtureFactory`` and ``ModelFactory`` base classes live in
``tests/helpers/fixture_factories.py`` and supply common tracking /
cleanup utilities that these examples build upon.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock

import pytest

from tests.helpers.fixture_factories import FixtureFactory, ModelFactory

# =============================================================================
# QUICK START: Working In-Memory Factory
# =============================================================================


@dataclass
class ExampleInvoice:
    """Lightweight invoice representation for in-memory testing."""

    id: str
    amount: Decimal
    status: str
    customer_id: str
    created_at: datetime
    due_date: datetime
    extras: dict[str, Any] = field(default_factory=dict)


class ExampleInvoiceFactory(FixtureFactory):
    """Simple factory that creates in-memory invoices without a database."""

    def create(
        self,
        amount: Decimal = Decimal("49.99"),
        status: str = "pending",
        customer_id: str = "cust_demo",
        **kwargs,
    ) -> ExampleInvoice:
        """Create and track a new invoice instance."""
        invoice = ExampleInvoice(
            id=self.generate_id("demo_inv"),
            amount=amount,
            status=status,
            customer_id=customer_id,
            created_at=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            extras=dict(kwargs),
        )
        self.track(invoice)
        return invoice

    async def cleanup_instance(self, instance: ExampleInvoice) -> None:  # noqa: D401 - intentional no-op
        """In-memory objects need no cleanup; override shown for completeness."""
        return None


@pytest.fixture
async def example_invoice_factory():
    """Working fixture developers can import directly."""
    factory = ExampleInvoiceFactory()
    try:
        yield factory
    finally:
        await factory.cleanup_all()


# =============================================================================
# EXAMPLE 1: Simple Dictionary Factory
# =============================================================================


@pytest.fixture
def invoice_dict_factory():
    """Factory for creating invoice test dictionaries.

    Example:
        def test_invoices(invoice_dict_factory):
            inv1 = invoice_dict_factory(amount=100)
            inv2 = invoice_dict_factory(amount=200, status="paid")
    """
    counter = [0]

    def _create(
        amount: Decimal = Decimal("100.00"),
        status: str = "pending",
        customer_id: str = "cust_test",
        **kwargs,
    ) -> dict[str, Any]:
        counter[0] += 1
        return {
            "id": f"inv_test_{counter[0]}",
            "amount": amount,
            "status": status,
            "customer_id": customer_id,
            "created_at": datetime.now(UTC),
            "due_date": datetime.now(UTC) + timedelta(days=30),
            **kwargs,
        }

    return _create


# =============================================================================
# EXAMPLE 2: Database Model Factory with Cleanup
# =============================================================================


class InvoiceFactory(ModelFactory):
    """Factory for creating Invoice model instances.

    Example:
        @pytest_asyncio.fixture
        async def invoice_factory(async_db_session):
            factory = InvoiceFactory(async_db_session)
            yield factory
            await factory.cleanup_all()

        async def test_invoices(invoice_factory):
            inv1 = await invoice_factory.create(amount=100)
            inv2 = await invoice_factory.create(amount=200, status="paid")
            # Both invoices auto-deleted after test
    """

    # Configuration (set in your implementation)
    # model_class = Invoice  # Uncomment and set your model
    id_prefix = "inv_test"

    def get_defaults(self) -> dict[str, Any]:
        """Default values for invoice creation."""
        return {
            "amount": Decimal("100.00"),
            "status": "pending",
            "customer_id": "cust_test",
            "due_date": datetime.now(UTC) + timedelta(days=30),
            "created_at": datetime.now(UTC),
        }


class SubscriptionFactory(ModelFactory):
    """Factory for creating Subscription model instances.

    Example:
        @pytest_asyncio.fixture
        async def subscription_factory(async_db_session):
            factory = SubscriptionFactory(async_db_session)
            yield factory
            await factory.cleanup_all()

        async def test_subscriptions(subscription_factory):
            sub1 = await subscription_factory.create(plan="basic")
            sub2 = await subscription_factory.create(plan="premium", status="active")
    """

    # model_class = Subscription  # Uncomment and set your model
    id_prefix = "sub_test"

    def get_defaults(self) -> dict[str, Any]:
        """Default values for subscription creation."""
        return {
            "plan_id": "basic",
            "status": "trial",
            "customer_id": "cust_test",
            "start_date": datetime.now(UTC),
            "billing_cycle": "monthly",
        }


# =============================================================================
# EXAMPLE 3: Custom Factory with Complex Logic
# =============================================================================


class CustomerFactory(FixtureFactory):
    """Factory for creating customer test data.

    Provides additional helper methods for creating related data.

    Example:
        @pytest_asyncio.fixture
        async def customer_factory(async_db_session):
            factory = CustomerFactory(async_db_session)
            yield factory
            await factory.cleanup_all()

        async def test_customer_with_subscription(customer_factory):
            customer = await customer_factory.create_with_subscription()
            assert customer.subscriptions[0].status == "active"
    """

    def __init__(self, db_session):
        """Initialize customer factory."""
        super().__init__()
        self.db = db_session

    async def create(
        self,
        email: str | None = None,
        name: str = "Test Customer",
        status: str = "active",
        **kwargs,
    ):  # -> Customer:  # Uncomment and set return type
        """Create a customer instance.

        Args:
            email: Customer email (auto-generated if not provided)
            name: Customer name
            status: Customer status
            **kwargs: Additional customer fields

        Returns:
            Created customer instance
        """
        if email is None:
            email = f"test_{self.generate_id('cust')}@example.com"

        # Replace with your actual model
        customer_data = {
            "id": self.generate_id("cust"),
            "email": email,
            "name": name,
            "status": status,
            **kwargs,
        }

        # Example - replace with your model
        # customer = Customer(**customer_data)
        # self.db.add(customer)
        # await self.db.commit()
        # await self.db.refresh(customer)

        # Track for cleanup
        # self.track(customer)

        # return customer

        # For now, return dict (replace with model)
        return customer_data

    async def create_with_subscription(
        self,
        plan: str = "basic",
        **customer_kwargs,
    ):  # -> Customer:
        """Create a customer with an active subscription.

        Args:
            plan: Subscription plan
            **customer_kwargs: Arguments for customer creation

        Returns:
            Created customer with subscription
        """
        customer = await self.create(**customer_kwargs)

        # Create subscription for customer
        # subscription = Subscription(
        #     id=self.generate_id("sub"),
        #     customer_id=customer.id,
        #     plan_id=plan,
        #     status="active",
        # )
        # self.db.add(subscription)
        # await self.db.commit()
        # self.track(subscription)

        return customer

    async def cleanup_instance(self, instance: Any) -> None:
        """Delete customer and related data.

        Args:
            instance: Customer instance to delete
        """
        # await self.db.delete(instance)
        # await self.db.commit()
        pass


# =============================================================================
# EXAMPLE 4: Mock Service Factory
# =============================================================================


@pytest.fixture
def mock_payment_gateway_factory():
    """Factory for creating payment gateway mocks.

    Useful when you need multiple mock gateways with different configurations.

    Example:
        def test_multiple_gateways(mock_payment_gateway_factory):
            success_gateway = mock_payment_gateway_factory(success=True)
            failure_gateway = mock_payment_gateway_factory(success=False)

            # Test with different gateway responses
    """
    created_mocks = []

    def _create(
        success: bool = True,
        transaction_id: str = "tx_123",
        **kwargs,
    ) -> AsyncMock:
        """Create a payment gateway mock.

        Args:
            success: Whether charge should succeed
            transaction_id: Transaction ID to return
            **kwargs: Additional return values

        Returns:
            Configured AsyncMock
        """
        gateway = AsyncMock()

        if success:
            gateway.charge.return_value = {
                "status": "success",
                "transaction_id": transaction_id,
                **kwargs,
            }
        else:
            gateway.charge.return_value = {
                "status": "failed",
                "error": "Payment declined",
                **kwargs,
            }

        gateway.refund.return_value = {
            "status": "success" if success else "failed",
        }

        created_mocks.append(gateway)
        return gateway

    yield _create

    # Cleanup - reset all mocks
    for mock in created_mocks:
        mock.reset_mock()


# =============================================================================
# EXAMPLE 5: Fixture Factory with Context Manager
# =============================================================================


class BillingTestContext(FixtureFactory):
    """Complete billing test environment.

    Provides a context with customer, plan, payment gateway, etc.

    Example:
        @pytest_asyncio.fixture
        async def billing_context(async_db_session):
            context = BillingTestContext(async_db_session)
            await context.setup()
            yield context
            await context.cleanup_all()

        async def test_billing_flow(billing_context):
            invoice = await billing_context.create_invoice(amount=100)
            payment = await billing_context.process_payment(invoice)
            assert payment.status == "success"
    """

    def __init__(self, db_session):
        """Initialize billing context."""
        super().__init__()
        self.db = db_session
        self.customer = None
        self.plan = None
        self.payment_gateway = None

    async def setup(self):
        """Set up the billing context.

        Creates default customer, plan, and payment gateway.
        """
        # Create default customer
        self.customer = await self._create_customer()

        # Create default plan
        self.plan = await self._create_plan()

        # Create mock payment gateway
        self.payment_gateway = AsyncMock()
        self.payment_gateway.charge.return_value = {
            "status": "success",
            "transaction_id": "tx_123",
        }

    async def _create_customer(self):
        """Create default test customer."""
        # Replace with your model
        customer_data = {
            "id": self.generate_id("cust"),
            "email": "test@example.com",
            "name": "Test Customer",
        }
        # customer = Customer(**customer_data)
        # self.db.add(customer)
        # await self.db.commit()
        # self.track(customer)
        # return customer
        return customer_data

    async def _create_plan(self):
        """Create default subscription plan."""
        plan_data = {
            "id": self.generate_id("plan"),
            "name": "Basic Plan",
            "price": Decimal("29.99"),
        }
        # plan = SubscriptionPlan(**plan_data)
        # self.db.add(plan)
        # await self.db.commit()
        # self.track(plan)
        # return plan
        return plan_data

    async def create_invoice(
        self,
        amount: Decimal = Decimal("100.00"),
        customer_id: str | None = None,
        **kwargs,
    ):
        """Create an invoice in this context.

        Args:
            amount: Invoice amount
            customer_id: Customer ID (uses context customer if not provided)
            **kwargs: Additional invoice fields

        Returns:
            Created invoice
        """
        invoice_data = {
            "id": self.generate_id("inv"),
            "amount": amount,
            "customer_id": customer_id or self.customer["id"],
            "status": "pending",
            **kwargs,
        }

        # invoice = Invoice(**invoice_data)
        # self.db.add(invoice)
        # await self.db.commit()
        # self.track(invoice)
        # return invoice
        return invoice_data

    async def process_payment(self, invoice: dict, **kwargs):
        """Process payment for an invoice.

        Args:
            invoice: Invoice to pay
            **kwargs: Additional payment parameters

        Returns:
            Payment result
        """
        # Use mock gateway
        result = await self.payment_gateway.charge(amount=invoice["amount"], **kwargs)
        return result

    async def cleanup_instance(self, instance: Any) -> None:
        """Clean up a single instance."""
        # await self.db.delete(instance)
        # await self.db.commit()
        pass


# =============================================================================
# USAGE EXAMPLES IN conftest.py
# =============================================================================

# Copy these examples into your feature-specific conftest.py files

"""
# Example 1: Simple dict factory
@pytest.fixture
def invoice_dict_factory():
    from tests.fixtures.example_factories import invoice_dict_factory
    yield from invoice_dict_factory()


# Example 2: Model factory with cleanup
@pytest_asyncio.fixture
async def invoice_factory(async_db_session):
    from tests.fixtures.example_factories import InvoiceFactory

    factory = InvoiceFactory(async_db_session)
    yield factory
    await factory.cleanup_all()


# Example 3: Custom factory with helpers
@pytest_asyncio.fixture
async def customer_factory(async_db_session):
    from tests.fixtures.example_factories import CustomerFactory

    factory = CustomerFactory(async_db_session)
    yield factory
    await factory.cleanup_all()


# Example 4: Mock service factory
@pytest.fixture
def mock_payment_gateway_factory():
    from tests.fixtures.example_factories import mock_payment_gateway_factory
    yield from mock_payment_gateway_factory()


# Example 5: Billing context
@pytest_asyncio.fixture
async def billing_context(async_db_session):
    from tests.fixtures.example_factories import BillingTestContext

    context = BillingTestContext(async_db_session)
    await context.setup()
    yield context
    await context.cleanup_all()
"""

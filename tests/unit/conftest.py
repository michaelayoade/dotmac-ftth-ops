"""
Unit Test Fixtures and Stubs

Provides lightweight fixtures and stubs for unit testing without database dependencies.
These fixtures enable fast, isolated tests that mock external dependencies.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import pytest

# ============================================================================
# Stub Repositories
# ============================================================================


pytestmark = pytest.mark.unit


class StubRepository:
    """Base stub repository with in-memory storage."""

    def __init__(self):
        self._store: dict[UUID, Any] = {}
        self._committed = False
        self._rolled_back = False

    def _generate_id(self) -> UUID:
        """Generate a new UUID."""
        return uuid4()

    async def add(self, entity):
        """Add entity to store."""
        if not hasattr(entity, "id") or entity.id is None:
            entity.id = self._generate_id()
        self._store[entity.id] = entity
        return entity

    async def get(self, entity_id: UUID):
        """Get entity by ID."""
        return self._store.get(entity_id)

    async def list_all(self, **filters) -> list[Any]:
        """List all entities, optionally filtered."""
        entities = list(self._store.values())

        # Simple filtering by attributes
        for key, value in filters.items():
            if value is not None:
                entities = [e for e in entities if getattr(e, key, None) == value]

        return entities

    async def update(self, entity):
        """Update entity in store."""
        if entity.id in self._store:
            self._store[entity.id] = entity
            return entity
        return None

    async def delete(self, entity_id: UUID) -> bool:
        """Delete entity from store."""
        if entity_id in self._store:
            del self._store[entity_id]
            return True
        return False

    async def commit(self):
        """Simulate commit."""
        self._committed = True

    async def rollback(self):
        """Simulate rollback."""
        self._rolled_back = True

    def clear(self):
        """Clear all data."""
        self._store.clear()
        self._committed = False
        self._rolled_back = False


class StubAsyncSession:
    """Stub for SQLAlchemy AsyncSession for unit tests."""

    def __init__(self):
        self._committed = False
        self._rolled_back = False
        self._added_entities = []
        self._flushed = False

    def add(self, instance):
        """Add instance to session."""
        self._added_entities.append(instance)

    async def flush(self):
        """Simulate flush."""
        self._flushed = True

    async def commit(self):
        """Simulate commit."""
        self._committed = True

    async def rollback(self):
        """Simulate rollback."""
        self._rolled_back = True

    async def refresh(self, instance):
        """Simulate refresh."""
        pass

    async def execute(self, statement):
        """Stub execute that returns empty result."""
        return StubResult([])

    async def close(self):
        """Close session."""
        pass

    def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if exc_type:
            await self.rollback()
        else:
            await self.commit()


class StubResult:
    """Stub for SQLAlchemy result."""

    def __init__(self, rows):
        self._rows = rows
        self._index = 0

    def scalar_one(self):
        """Return single scalar result."""
        if not self._rows:
            raise Exception("No rows found")
        return self._rows[0]

    def scalar_one_or_none(self):
        """Return single scalar result or None."""
        if not self._rows:
            return None
        return self._rows[0]

    def scalars(self):
        """Return scalars."""
        return self

    def all(self):
        """Return all results."""
        return self._rows

    def first(self):
        """Return first result."""
        return self._rows[0] if self._rows else None


# ============================================================================
# Internet Plans Stubs
# ============================================================================


class StubPlanRepository(StubRepository):
    """In-memory repository for internet plans."""

    async def get_by_code(self, plan_code: str, tenant_id: UUID):
        """Get plan by code (case-insensitive)."""
        for plan in self._store.values():
            if (
                hasattr(plan, "plan_code")
                and plan.plan_code.lower() == plan_code.lower()
                and plan.tenant_id == tenant_id
            ):
                return plan
        return None

    async def list_active_plans(self, tenant_id: UUID):
        """List active plans for tenant."""
        from dotmac.platform.services.internet_plans.models import PlanStatus

        return [
            p
            for p in self._store.values()
            if p.tenant_id == tenant_id and p.status == PlanStatus.ACTIVE
        ]

    async def get_subscriptions_count(self, plan_id: UUID, active_only: bool = True) -> int:
        """Get count of subscriptions for a plan."""
        # Return 0 for unit tests (can be overridden)
        return 0


class StubSubscriptionRepository(StubRepository):
    """In-memory repository for plan subscriptions."""

    async def list_by_plan(self, plan_id: UUID) -> list[Any]:
        """List subscriptions for a plan."""
        return [s for s in self._store.values() if s.plan_id == plan_id]

    async def list_by_customer(self, customer_id: UUID) -> list[Any]:
        """List subscriptions for a customer."""
        return [s for s in self._store.values() if s.customer_id == customer_id]

    async def get_active_by_customer(self, customer_id: UUID):
        """Get active subscription for customer."""
        for sub in self._store.values():
            if sub.customer_id == customer_id and sub.is_active:
                return sub
        return None


# ============================================================================
# Factory Functions
# ============================================================================


def create_test_plan(**overrides):
    """Create a test internet service plan with sensible defaults."""
    from dotmac.platform.services.internet_plans.models import (
        BillingCycle,
        InternetServicePlan,
        PlanStatus,
        PlanType,
        SpeedUnit,
        ThrottlePolicy,
    )

    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "plan_code": "TEST-100",
        "name": "Test 100Mbps Plan",
        "description": "Test internet plan",
        "plan_type": PlanType.RESIDENTIAL,
        "status": PlanStatus.ACTIVE,
        "download_speed": Decimal("100"),
        "upload_speed": Decimal("50"),
        "speed_unit": SpeedUnit.MBPS,
        "has_data_cap": False,
        "throttle_policy": ThrottlePolicy.NO_THROTTLE,
        "has_fup": False,
        "has_time_restrictions": False,
        "qos_priority": 50,
        "traffic_shaping_enabled": False,
        "monthly_price": Decimal("50.00"),
        "setup_fee": Decimal("25.00"),
        "currency": "USD",
        "billing_cycle": BillingCycle.MONTHLY,
        "is_public": True,
        "is_promotional": False,
        "minimum_contract_months": 12,
        "early_termination_fee": Decimal("100.00"),
        "contention_ratio": "1:20",
        "ipv4_included": True,
        "ipv6_included": True,
        "static_ip_included": False,
        "static_ip_count": 0,
        "router_included": False,
        "installation_included": False,
        "technical_support_level": "basic",
        "tags": {},
        "features": [],
        "restrictions": [],
        "validation_errors": [],
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }

    defaults.update(overrides)
    return InternetServicePlan(**defaults)


def create_test_subscription(**overrides):
    """Create a test plan subscription with sensible defaults."""
    from dotmac.platform.services.internet_plans.models import PlanSubscription

    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "plan_id": uuid4(),
        "customer_id": uuid4(),
        "start_date": datetime.now(UTC),
        "end_date": None,
        "is_active": True,
        "current_period_usage_gb": Decimal("0.00"),
        "last_usage_reset": datetime.now(UTC),
        "custom_download_speed": None,
        "custom_upload_speed": None,
        "notes": "",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }

    defaults.update(overrides)
    return PlanSubscription(**defaults)


# ============================================================================
# Pytest Fixtures
# ============================================================================


@pytest.fixture
def stub_async_session():
    """Provide a stub async session for unit tests."""
    return StubAsyncSession()


@pytest.fixture
def stub_plan_repository():
    """Provide a stub plan repository for unit tests."""
    return StubPlanRepository()


@pytest.fixture
def stub_subscription_repository():
    """Provide a stub subscription repository for unit tests."""
    return StubSubscriptionRepository()


@pytest.fixture
def tenant_id():
    """Provide a test tenant ID."""
    return uuid4()


@pytest.fixture
def customer_id():
    """Provide a test customer ID."""
    return uuid4()


@pytest.fixture
def test_plan(tenant_id):
    """Provide a test plan instance."""
    return create_test_plan(tenant_id=tenant_id)


@pytest.fixture
def test_subscription(test_plan, customer_id, tenant_id):
    """Provide a test subscription instance."""
    return create_test_subscription(
        tenant_id=tenant_id, plan_id=test_plan.id, customer_id=customer_id
    )


# ============================================================================
# Mock Service Fixtures
# ============================================================================


class MockEmailService:
    """Mock email service for unit tests."""

    def __init__(self):
        self.sent_emails = []

    async def send_email(self, to: str, subject: str, body: str, **kwargs):
        """Record sent email."""
        self.sent_emails.append({"to": to, "subject": subject, "body": body, **kwargs})
        return True

    async def send_template_email(self, template_name: str, to: str, context: dict):
        """Record sent template email."""
        self.sent_emails.append({"template": template_name, "to": to, "context": context})
        return True


class MockNotificationService:
    """Mock notification service for unit tests."""

    def __init__(self):
        self.notifications = []

    async def notify(self, user_id: UUID, message: str, **kwargs):
        """Record notification."""
        self.notifications.append({"user_id": user_id, "message": message, **kwargs})


class MockEventBus:
    """Mock event bus for unit tests."""

    def __init__(self):
        self.published_events = []

    async def publish(self, event_type: str, payload: dict):
        """Record published event."""
        self.published_events.append({"type": event_type, "payload": payload})


@pytest.fixture
def mock_email_service():
    """Provide mock email service."""
    return MockEmailService()


@pytest.fixture
def mock_notification_service():
    """Provide mock notification service."""
    return MockNotificationService()


@pytest.fixture
def mock_event_bus():
    """Provide mock event bus."""
    return MockEventBus()

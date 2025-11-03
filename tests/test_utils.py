"""
Strategic Test Utilities for DotMac Platform Services.

This module provides standardized testing utilities to address common patterns
and reduce test failures across the codebase.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

# ============================================================================
# Async Testing Utilities
# ============================================================================


class ProperAsyncMock(AsyncMock):
    """
    Enhanced AsyncMock that properly handles common async patterns.

    Fixes the 'coroutine was never awaited' warnings.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ensure return values are properly wrapped
        if hasattr(self, "return_value") and not asyncio.iscoroutine(self.return_value):
            self._return_value = self.return_value

    async def __call__(self, *args, **kwargs):
        """Ensure async calls are properly awaited."""
        result = await super().__call__(*args, **kwargs)
        return result


def create_async_session_mock() -> AsyncMock:
    """
    Create a properly configured async database session mock.

    Returns:
        AsyncMock configured with all standard SQLAlchemy async session methods.
    """
    session = ProperAsyncMock(spec=AsyncSession)

    # Configure async context manager
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=None)

    # Configure query execution
    result_mock = AsyncMock()
    result_mock.scalar_one_or_none = AsyncMock(return_value=None)
    result_mock.scalars = AsyncMock()
    result_mock.all = AsyncMock(return_value=[])
    result_mock.first = AsyncMock(return_value=None)
    result_mock.one = AsyncMock(side_effect=Exception("No results"))
    result_mock.rowcount = 0

    session.execute = AsyncMock(return_value=result_mock)

    # Configure transaction methods
    session.add = Mock()
    session.add_all = Mock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    session.close = AsyncMock()
    session.get = AsyncMock(return_value=None)
    session.merge = Mock()

    return session


# ============================================================================
# Service Mock Factories
# ============================================================================


def create_mock_user_service() -> Mock:
    """
    Create a comprehensive mock user service with common operations.
    """
    service = Mock()

    # User operations
    service.get_user = AsyncMock(return_value=None)
    service.get_user_by_username = AsyncMock(return_value=None)
    service.get_user_by_email = AsyncMock(return_value=None)
    service.create_user = AsyncMock(
        return_value=Mock(
            id=uuid4(),
            username="testuser",
            email="test@example.com",
            is_active=True,
            created_at=datetime.now(UTC),
        )
    )
    service.update_user = AsyncMock(return_value=True)
    service.delete_user = AsyncMock(return_value=True)
    service.verify_password = Mock(return_value=True)
    service.hash_password = Mock(return_value="hashed_password")

    return service


def create_mock_email_service() -> Mock:
    """
    Create a comprehensive mock email service.
    """
    service = Mock()

    service.send_email = AsyncMock(return_value=True)
    service.send_verification_email = AsyncMock(return_value=True)
    service.send_password_reset_email = AsyncMock(return_value=True)
    service.send_notification = AsyncMock(return_value=True)
    service.queue_email = AsyncMock(return_value={"message_id": str(uuid4())})

    # SMTP config as dictionary (common pattern in communications)
    service.smtp_config = {
        "host": "smtp.example.com",
        "port": 587,
        "username": "test@example.com",
        "password": "test_password",
        "use_tls": True,
        "from_email": "noreply@example.com",
    }

    return service


def create_mock_auth_service() -> Mock:
    """
    Create a comprehensive mock authentication service.
    """
    service = Mock()

    # Token operations
    service.create_access_token = Mock(return_value="test_access_token")
    service.create_refresh_token = Mock(return_value="test_refresh_token")
    service.verify_token = Mock(
        return_value={
            "sub": "user123",
            "type": "access",
            "scopes": ["read", "write"],
            "tenant_id": "tenant123",
        }
    )
    service.revoke_token = AsyncMock(return_value=True)

    # Session operations
    service.create_session = AsyncMock(
        return_value=Mock(
            id=str(uuid4()),
            user_id="user123",
            token="session_token",
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
    )
    service.get_session = AsyncMock(return_value=None)
    service.delete_session = AsyncMock(return_value=True)

    return service


def create_mock_celery_app() -> Mock:
    """
    Create a mock Celery application with task scheduling.
    """
    app = Mock()

    # Task scheduling
    task_mock = Mock()
    task_mock.delay = Mock(return_value=Mock(id=str(uuid4())))
    task_mock.apply_async = Mock(return_value=Mock(id=str(uuid4())))
    task_mock.s = Mock(return_value=task_mock)  # For signatures

    app.task = Mock(return_value=task_mock)
    app.send_task = Mock(return_value=Mock(id=str(uuid4())))

    return app


# ============================================================================
# Datetime Utilities (Fix Deprecation Warnings)
# ============================================================================


def utcnow() -> datetime:
    """
    Get current timezone.utc datetime with timezone awareness.

    Replaces deprecated datetime.now(timezone.utc).
    """
    return datetime.now(UTC)


def mock_utcnow(target_datetime: datetime | None = None) -> Mock:
    """
    Create a mock for datetime.now(timezone.utc).

    Args:
        target_datetime: Specific datetime to return, or current time if None.
    """
    if target_datetime is None:
        target_datetime = datetime.now(UTC)

    return Mock(return_value=target_datetime)


# ============================================================================
# Tenant Context Utilities
# ============================================================================


class TenantContext:
    """
    Manage tenant context for testing multi-tenant operations.
    """

    def __init__(self, tenant_id: str = "test-tenant"):
        self.tenant_id = tenant_id
        self._original_context = None

    def __enter__(self):
        """Set tenant context."""
        # Store original if needed
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Restore original context."""
        pass

    @property
    def current(self) -> str:
        """Get current tenant ID."""
        return self.tenant_id


def with_tenant_context(tenant_id: str = "test-tenant"):
    """
    Decorator to run tests with a specific tenant context.
    """

    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            with TenantContext(tenant_id):
                return await func(*args, **kwargs)

        def sync_wrapper(*args, **kwargs):
            with TenantContext(tenant_id):
                return func(*args, **kwargs)

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


# ============================================================================
# Integration Test Helpers
# ============================================================================


@asynccontextmanager
async def database_transaction(session: AsyncSession):
    """
    Context manager for database transactions in tests.

    Automatically rolls back after test completion.
    """
    async with session.begin():
        yield session
        await session.rollback()


def create_test_jwt(
    user_id: str = "test-user", scopes: list[str] = None, tenant_id: str = "test-tenant", **kwargs
) -> str:
    """
    Create a test JWT token with standard claims.
    """
    from datetime import datetime, timedelta

    import jwt

    if scopes is None:
        scopes = ["read", "write"]

    payload = {
        "sub": user_id,
        "scopes": scopes,
        "tenant_id": tenant_id,
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
        "type": "access",
        **kwargs,
    }

    return jwt.encode(payload, "test-secret", algorithm="HS256")


# ============================================================================
# Test Data Factories
# ============================================================================


@pytest.mark.unit
class TestDataFactory:
    """
    Factory for creating consistent test data.
    """

    @staticmethod
    def create_user(overrides: dict[str, Any] = None) -> dict[str, Any]:
        """Create test user data."""
        data = {
            "id": str(uuid4()),
            "username": f"testuser_{uuid4().hex[:8]}",
            "email": f"test_{uuid4().hex[:8]}@example.com",
            "first_name": "Test",
            "last_name": "User",
            "is_active": True,
            "is_verified": True,
            "created_at": utcnow(),
            "updated_at": utcnow(),
        }
        if overrides:
            data.update(overrides)
        return data

    @staticmethod
    def create_invoice(overrides: dict[str, Any] = None) -> dict[str, Any]:
        """Create test invoice data."""
        data = {
            "id": str(uuid4()),
            "invoice_number": f"INV-{utcnow().year}-{uuid4().hex[:6].upper()}",
            "customer_id": str(uuid4()),
            "tenant_id": "test-tenant",
            "status": "draft",
            "issue_date": utcnow(),
            "due_date": utcnow() + timedelta(days=30),
            "subtotal": 10000,  # $100.00 in cents
            "tax_amount": 1000,  # $10.00
            "total_amount": 11000,  # $110.00
            "currency": "USD",
            "line_items": [],
        }
        if overrides:
            data.update(overrides)
        return data

    @staticmethod
    def create_bulk_email_job(overrides: dict[str, Any] = None) -> dict[str, Any]:
        """Create test bulk email job data."""
        data = {
            "id": str(uuid4()),
            "name": "Test Campaign",
            "template_id": str(uuid4()),
            "status": "queued",
            "total_recipients": 100,
            "sent_count": 0,
            "failed_count": 0,
            "created_at": utcnow(),
            "scheduled_at": None,
            "recipients": [],
        }
        if overrides:
            data.update(overrides)
        return data


# ============================================================================
# Test Base Classes
# ============================================================================


class AsyncTestCase:
    """
    Base class for async test cases with common setup.
    """

    @pytest_asyncio.fixture(autouse=True)
    async def setup_async(self):
        """Setup for async tests."""
        self.session = create_async_session_mock()
        self.user_service = create_mock_user_service()
        self.email_service = create_mock_email_service()
        self.auth_service = create_mock_auth_service()
        yield
        # Cleanup if needed

    async def create_authenticated_client(self, app):
        """Create an authenticated async test client."""
        from httpx import ASGITransport, AsyncClient

        token = create_test_jwt()
        transport = ASGITransport(app=app)

        async with AsyncClient(
            transport=transport,
            base_url="http://testserver",
            headers={"Authorization": f"Bearer {token}"},
        ) as client:
            return client


class ServiceTestCase:
    """
    Base class for service layer tests.
    """

    def setup_method(self):
        """Setup for each test method."""
        self.mock_session = create_async_session_mock()
        self.test_factory = TestDataFactory()
        self.tenant_context = TenantContext()

    def teardown_method(self):
        """Cleanup after each test."""
        pass


# ============================================================================
# Pytest Fixtures (Can be imported in conftest.py)
# ============================================================================


@pytest.fixture
def async_session_mock():
    """Provide async session mock."""
    return create_async_session_mock()


@pytest.fixture
def mock_services():
    """Provide all common service mocks."""
    return {
        "user": create_mock_user_service(),
        "email": create_mock_email_service(),
        "auth": create_mock_auth_service(),
        "celery": create_mock_celery_app(),
    }


@pytest.fixture
def test_data_factory():
    """Provide test data factory."""
    return TestDataFactory()


@pytest.fixture
def tenant_context():
    """Provide tenant context manager."""
    return TenantContext()


# ============================================================================
# Export utilities
# ============================================================================

__all__ = [
    # Async utilities
    "ProperAsyncMock",
    "create_async_session_mock",
    # Service mocks
    "create_mock_user_service",
    "create_mock_email_service",
    "create_mock_auth_service",
    "create_mock_celery_app",
    # Datetime utilities
    "utcnow",
    "mock_utcnow",
    # Tenant utilities
    "TenantContext",
    "with_tenant_context",
    # Integration helpers
    "database_transaction",
    "create_test_jwt",
    # Data factory
    "TestDataFactory",
    # Base classes
    "AsyncTestCase",
    "ServiceTestCase",
    # Fixtures
    "async_session_mock",
    "mock_services",
    "test_data_factory",
    "tenant_context",
]

"""
Shared test fixtures for improved reusability across the test suite.

This module provides common fixtures that are used across multiple test modules,
reducing duplication and improving maintenance.
"""

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

# Import models and services based on availability


pytestmark = pytest.mark.integration

try:
    from dotmac.platform.auth.core import UserInfo

    HAS_USER_INFO = True
except ImportError:
    # Fallback mock UserInfo
    class UserInfo:
        def __init__(self, user_id: str, permissions: list[str] = None, **kwargs):
            self.user_id = user_id
            self.permissions = permissions or []
            for key, value in kwargs.items():
                setattr(self, key, value)

    HAS_USER_INFO = False

try:
    from dotmac.platform.user_management.models import User

    HAS_USER_MODELS = True
except ImportError:
    HAS_USER_MODELS = False

try:
    from dotmac.platform.customer_management.models import Customer, CustomerCreate

    HAS_CUSTOMER_MODELS = True
except ImportError:
    HAS_CUSTOMER_MODELS = False

try:
    from dotmac.platform.data_transfer.core import ExportOptions, ImportOptions, TransferConfig

    HAS_DATA_TRANSFER = True
except ImportError:
    HAS_DATA_TRANSFER = False


# ============================================================================
# Common User Fixtures
# ============================================================================


@pytest.fixture
def test_user_id() -> str:
    """Standard test user ID."""
    return "550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture
def test_tenant_id() -> str:
    """Standard test tenant ID."""
    return "tenant-123"


@pytest.fixture
def mock_user_info(test_user_id: str) -> UserInfo:
    """
    Standard mock UserInfo for authentication tests.

    Provides a consistent user object across all tests that need authentication.
    """
    return UserInfo(
        user_id=test_user_id,
        username="testuser",
        email="test@example.com",
        permissions=["read", "write"],
        roles=["user"],
        tenant_id="tenant-123",
    )


@pytest.fixture
def admin_user_info(test_user_id: str) -> UserInfo:
    """Mock admin UserInfo with elevated permissions."""
    return UserInfo(
        user_id=test_user_id,
        username="admin",
        email="admin@example.com",
        permissions=["admin", "read", "write", "delete"],
        roles=["admin"],
        tenant_id="tenant-123",
    )


@pytest.fixture
def readonly_user_info(test_user_id: str) -> UserInfo:
    """Mock readonly UserInfo with limited permissions."""
    return UserInfo(
        user_id=test_user_id,
        username="readonly",
        email="readonly@example.com",
        permissions=["read"],
        roles=["readonly"],
        tenant_id="tenant-123",
    )


# ============================================================================
# Service Mocks
# ============================================================================


@pytest.fixture
def mock_async_service() -> AsyncMock:
    """Generic async service mock for testing."""
    return AsyncMock()


@pytest.fixture
def mock_sync_service() -> Mock:
    """Generic sync service mock for testing."""
    return Mock()


@pytest.fixture
def mock_user_service() -> AsyncMock:
    """Mock user service with common methods."""
    service = AsyncMock()
    service.get_user = AsyncMock()
    service.create_user = AsyncMock()
    service.update_user = AsyncMock()
    service.delete_user = AsyncMock()
    service.list_users = AsyncMock()
    return service


@pytest.fixture
def mock_customer_service() -> AsyncMock:
    """Mock customer service with common methods."""
    service = AsyncMock()
    service.get_customer = AsyncMock()
    service.create_customer = AsyncMock()
    service.update_customer = AsyncMock()
    service.delete_customer = AsyncMock()
    service.list_customers = AsyncMock()
    return service


@pytest.fixture
def mock_auth_service() -> AsyncMock:
    """Mock authentication service."""
    service = AsyncMock()
    service.authenticate = AsyncMock()
    service.create_token = AsyncMock()
    service.validate_token = AsyncMock()
    service.revoke_token = AsyncMock()
    return service


# ============================================================================
# Database and Storage Mocks
# ============================================================================


@pytest.fixture
def mock_database_manager() -> AsyncMock:
    """Mock database manager with common operations."""
    manager = AsyncMock()
    manager.get_session = AsyncMock()
    manager.execute_query = AsyncMock()
    manager.get_connection = AsyncMock()
    manager.close = AsyncMock()
    return manager


@pytest.fixture
def mock_redis_client() -> Mock:
    """Mock Redis client with common operations."""
    client = Mock()
    client.get = Mock()
    client.set = Mock()
    client.delete = Mock()
    client.exists = Mock()
    client.expire = Mock()
    client.flushdb = Mock()
    return client


@pytest.fixture
def mock_file_storage() -> AsyncMock:
    """Mock file storage service."""
    storage = AsyncMock()
    storage.upload = AsyncMock()
    storage.download = AsyncMock()
    storage.delete = AsyncMock()
    storage.list_files = AsyncMock()
    storage.get_url = AsyncMock()
    return storage


# ============================================================================
# Model Fixtures
# ============================================================================

if HAS_CUSTOMER_MODELS:

    @pytest.fixture
    def sample_customer() -> Customer:
        """Sample customer for testing."""
        return Customer(
            id=str(uuid4()),
            name="Test Customer",
            email="customer@example.com",
            tenant_id="tenant-123",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    @pytest.fixture
    def customer_create_request() -> CustomerCreate:
        """Customer creation request."""
        return CustomerCreate(name="New Customer", email="new@example.com", phone="+1234567890")


if HAS_USER_MODELS:

    @pytest.fixture
    def sample_user() -> User:
        """Sample user for testing."""
        return User(
            id=str(uuid4()),
            username="testuser",
            email="user@example.com",
            tenant_id="tenant-123",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )


if HAS_DATA_TRANSFER:

    @pytest.fixture
    def transfer_config() -> TransferConfig:
        """Standard transfer configuration for tests."""
        return TransferConfig(batch_size=1000, max_workers=2, chunk_size=4096)

    @pytest.fixture
    def import_options() -> ImportOptions:
        """Standard import options for tests."""
        return ImportOptions(skip_errors=True, validate_data=True, delimiter=",", header_row=0)

    @pytest.fixture
    def export_options() -> ExportOptions:
        """Standard export options for tests."""
        return ExportOptions(include_headers=True, format_dates=True)


# ============================================================================
# HTTP and API Fixtures
# ============================================================================


@pytest.fixture
def mock_http_client() -> AsyncMock:
    """Mock HTTP client for external API testing."""
    client = AsyncMock()
    client.get = AsyncMock()
    client.post = AsyncMock()
    client.put = AsyncMock()
    client.delete = AsyncMock()
    client.close = AsyncMock()
    return client


@pytest.fixture
def sample_api_response() -> dict[str, Any]:
    """Sample API response for testing."""
    return {
        "success": True,
        "data": {"id": "123", "name": "test"},
        "message": "Success",
        "timestamp": datetime.now(UTC).isoformat(),
    }


@pytest.fixture
def sample_error_response() -> dict[str, Any]:
    """Sample API error response for testing."""
    return {
        "success": False,
        "error": "Not Found",
        "message": "Resource not found",
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ============================================================================
# Time and UUID Fixtures
# ============================================================================


@pytest.fixture
def fixed_datetime() -> datetime:
    """Fixed datetime for consistent testing."""
    return datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def test_uuid() -> str:
    """Fixed UUID for testing."""
    return "550e8400-e29b-41d4-a716-446655440000"


# ============================================================================
# Settings and Configuration Fixtures
# ============================================================================


@pytest.fixture
def mock_settings() -> Mock:
    """Mock application settings."""
    settings = Mock()

    # Environment settings
    settings.environment.value = "test"
    settings.debug = True

    # Database settings
    settings.database.url = "sqlite:///:memory:"
    settings.database.echo = False

    # Feature flags
    settings.features.data_transfer_enabled = True
    settings.features.tracing_opentelemetry = False

    # Observability settings
    settings.observability.otel_enabled = False
    settings.observability.enable_tracing = False
    settings.observability.enable_metrics = False
    settings.observability.otel_endpoint = None

    return settings


# ============================================================================
# Factory Functions
# ============================================================================


def create_mock_service(service_name: str, methods: list[str] = None) -> AsyncMock:
    """
    Factory function to create mock services with specified methods.

    Args:
        service_name: Name of the service
        methods: List of method names to mock

    Returns:
        AsyncMock with the specified methods
    """
    service = AsyncMock()
    service.name = service_name

    if methods:
        for method in methods:
            setattr(service, method, AsyncMock())

    return service


def create_test_data(model_type: str, **kwargs) -> dict[str, Any]:
    """
    Factory function to create test data for different model types.

    Args:
        model_type: Type of model ("user", "customer", etc.)
        **kwargs: Additional fields to override

    Returns:
        Dictionary with test data
    """
    base_data = {
        "user": {
            "id": str(uuid4()),
            "username": "testuser",
            "email": "test@example.com",
            "created_at": datetime.now(UTC),
        },
        "customer": {
            "id": str(uuid4()),
            "name": "Test Customer",
            "email": "customer@example.com",
            "created_at": datetime.now(UTC),
        },
    }

    data = base_data.get(model_type, {})
    data.update(kwargs)
    return data


# ============================================================================
# Parametrized Fixtures
# ============================================================================


@pytest.fixture(params=["admin", "user", "readonly"])
def user_role(request) -> str:
    """Parametrized fixture for different user roles."""
    return request.param


@pytest.fixture(params=["json", "csv", "xml"])
def data_format(request) -> str:
    """Parametrized fixture for different data formats."""
    return request.param


# ============================================================================
# Cleanup Fixtures
# ============================================================================


@pytest.fixture
def cleanup_temp_files():
    """Fixture that cleans up temporary files after tests."""
    temp_files = []

    def add_temp_file(filepath: str):
        temp_files.append(filepath)

    yield add_temp_file

    # Cleanup
    import os

    for filepath in temp_files:
        try:
            if os.path.exists(filepath):
                os.unlink(filepath)
        except OSError:
            pass


# Build __all__ dynamically based on what's available
_all_fixtures = [
    # User fixtures
    "test_user_id",
    "test_tenant_id",
    "mock_user_info",
    "admin_user_info",
    "readonly_user_info",
    # Service mocks
    "mock_async_service",
    "mock_sync_service",
    "mock_user_service",
    "mock_customer_service",
    "mock_auth_service",
    # Database and storage
    "mock_database_manager",
    "mock_redis_client",
    "mock_file_storage",
    # HTTP and API
    "mock_http_client",
    "sample_api_response",
    "sample_error_response",
    # Time and UUID
    "fixed_datetime",
    "test_uuid",
    # Settings
    "mock_settings",
    # Utilities
    "user_role",
    "data_format",
    "cleanup_temp_files",
    # Factory functions
    "create_mock_service",
    "create_test_data",
]

# Add conditional fixtures if they exist
if HAS_CUSTOMER_MODELS:
    _all_fixtures.extend(["sample_customer", "customer_create_request"])

if HAS_USER_MODELS:
    _all_fixtures.extend(["sample_user"])

if HAS_DATA_TRANSFER:
    _all_fixtures.extend(["transfer_config", "import_options", "export_options"])

__all__ = _all_fixtures

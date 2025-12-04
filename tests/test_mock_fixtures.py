"""
Comprehensive mock fixtures for external dependencies.
These fixtures avoid needing real Docker services for unit tests.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest

pytestmark = pytest.mark.unit


@pytest.fixture
def mock_openbao_client():
    """Mock OpenBao/Vault client for testing."""
    mock_client = Mock()

    # Mock authentication
    mock_client.is_authenticated.return_value = True
    mock_client.auth.approle.login.return_value = {"auth": {"client_token": "hvs.test_token"}}

    # Mock KV v2 operations
    mock_kv_v2 = Mock()
    mock_kv_v2.read_secret_version.return_value = {
        "data": {
            "data": {"username": "test_user", "password": "test_pass"},
            "metadata": {"version": 1, "created_time": "2024-01-01T00:00:00Z"},
        }
    }
    mock_kv_v2.create_or_update_secret.return_value = {"data": {"version": 1}}
    mock_kv_v2.delete_latest_version_of_secret.return_value = None
    mock_kv_v2.list_secrets.return_value = {"data": {"keys": ["secret1", "secret2", "secret3/"]}}

    mock_client.secrets.kv.v2 = mock_kv_v2

    # Mock KV v1 operations
    mock_kv_v1 = Mock()
    mock_kv_v1.read_secret.return_value = {
        "data": {"username": "test_user", "password": "test_pass"}
    }
    mock_kv_v1.create_or_update_secret.return_value = None
    mock_kv_v1.delete_secret.return_value = None

    mock_client.secrets.kv.v1 = mock_kv_v1

    # Mock system operations
    mock_client.sys.is_sealed.return_value = False
    mock_client.sys.read_health_status.return_value = {
        "sealed": False,
        "standby": False,
        "initialized": True,
    }

    return mock_client


@pytest.fixture
def mock_redis_client():
    """Mock Redis client for testing."""
    mock_redis = AsyncMock()

    # Mock basic operations
    mock_redis.get.return_value = None
    mock_redis.set.return_value = True
    mock_redis.delete.return_value = 1
    mock_redis.exists.return_value = 0
    mock_redis.expire.return_value = True
    mock_redis.ttl.return_value = -1

    # Mock hash operations
    mock_redis.hget.return_value = None
    mock_redis.hset.return_value = 1
    mock_redis.hdel.return_value = 1
    mock_redis.hgetall.return_value = {}
    mock_redis.hkeys.return_value = []

    # Mock list operations
    mock_redis.lpush.return_value = 1
    mock_redis.rpop.return_value = None
    mock_redis.llen.return_value = 0

    # Mock set operations
    mock_redis.sadd.return_value = 1
    mock_redis.srem.return_value = 1
    mock_redis.smembers.return_value = set()

    # Mock pub/sub
    mock_redis.publish.return_value = 0

    # Mock pipeline
    mock_pipeline = AsyncMock()
    mock_pipeline.execute.return_value = [True, True, 1]
    mock_redis.pipeline.return_value = mock_pipeline

    # Mock connection
    mock_redis.ping.return_value = b"PONG"
    mock_redis.close.return_value = None

    return mock_redis


@pytest.fixture
def mock_postgres_session():
    """Mock PostgreSQL session for testing."""
    mock_session = Mock()

    # Mock query execution
    mock_result = Mock()
    mock_result.scalar.return_value = 1
    mock_result.fetchall.return_value = []
    mock_result.fetchone.return_value = None
    mock_result.rowcount = 1

    mock_session.execute.return_value = mock_result
    mock_session.commit.return_value = None
    mock_session.rollback.return_value = None
    mock_session.close.return_value = None

    # Mock query builder
    mock_query = Mock()
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = None
    mock_query.all.return_value = []
    mock_query.count.return_value = 0

    mock_session.query.return_value = mock_query

    # Mock add/delete
    mock_session.add.return_value = None
    mock_session.delete.return_value = None
    mock_session.flush.return_value = None

    return mock_session


@pytest.fixture
def mock_async_postgres_session():
    """Mock async PostgreSQL session for testing."""
    mock_session = AsyncMock()

    # Mock async query execution
    mock_result = AsyncMock()
    mock_result.scalar.return_value = 1
    mock_result.fetchall.return_value = []
    mock_result.fetchone.return_value = None
    mock_result.rowcount = 1

    mock_session.execute.return_value = mock_result
    mock_session.commit.return_value = None
    mock_session.rollback.return_value = None
    mock_session.close.return_value = None

    # Mock async context manager
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)

    return mock_session


@pytest.fixture
def mock_otel_tracer():
    """Mock OpenTelemetry tracer for testing."""
    mock_tracer = Mock()

    # Mock span creation
    mock_span = Mock()
    mock_span.set_attribute.return_value = None
    mock_span.set_status.return_value = None
    mock_span.end.return_value = None
    mock_span.is_recording.return_value = True

    # Mock span context manager
    mock_span.__enter__ = Mock(return_value=mock_span)
    mock_span.__exit__ = Mock(return_value=None)

    mock_tracer.start_span.return_value = mock_span
    mock_tracer.start_as_current_span.return_value = mock_span

    return mock_tracer


@pytest.fixture
def mock_otel_meter():
    """Mock OpenTelemetry meter for testing."""
    mock_meter = Mock()

    # Mock instruments
    mock_counter = Mock()
    mock_counter.add.return_value = None

    mock_gauge = Mock()
    mock_gauge.set.return_value = None

    mock_histogram = Mock()
    mock_histogram.record.return_value = None

    mock_meter.create_counter.return_value = mock_counter
    mock_meter.create_gauge.return_value = mock_gauge
    mock_meter.create_histogram.return_value = mock_histogram

    return mock_meter


@pytest.fixture
def mock_http_client():
    """Mock HTTP client for testing."""
    mock_client = AsyncMock()

    # Mock response
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "ok"}
    mock_response.text = "OK"
    mock_response.headers = {}

    mock_client.get.return_value = mock_response
    mock_client.post.return_value = mock_response
    mock_client.put.return_value = mock_response
    mock_client.delete.return_value = mock_response

    # Mock context manager
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    return mock_client


@pytest.fixture
def mock_jwt_service():
    """Mock JWT service for testing."""
    mock_service = Mock()

    # Mock token operations
    mock_service.create_access_token.return_value = "eyJ0eXAiOiJKV1QiLCJhbGc"
    mock_service.create_refresh_token.return_value = "eyJ0eXAiOiJKV1QiLCJyZWY"
    mock_service.decode_token.return_value = {
        "sub": "user123",
        "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
        "iat": int(datetime.now(UTC).timestamp()),
        "type": "access",
    }
    mock_service.validate_token.return_value = True
    mock_service.refresh_token.return_value = "eyJ0eXAiOiJKV1QiLCJuZXc"

    return mock_service


@pytest.fixture
def mock_rbac_engine():
    """Mock RBAC engine for testing."""
    mock_engine = Mock()

    # Mock permission checking
    mock_engine.check_permission.return_value = True
    mock_engine.get_user_roles.return_value = ["user", "admin"]
    mock_engine.get_role_permissions.return_value = ["read:users", "write:users"]
    mock_engine.has_role.return_value = True
    mock_engine.has_permission.return_value = True

    # Mock policy evaluation
    mock_engine.evaluate_policy.return_value = True
    mock_engine.get_applicable_policies.return_value = []

    return mock_engine


@pytest.fixture
def mock_session_manager():
    """Mock session manager for testing."""
    mock_manager = Mock()

    # Mock session operations
    mock_session = {
        "id": "session123",
        "user_id": "user123",
        "created_at": datetime.now(UTC),
        "expires_at": datetime.now(UTC) + timedelta(hours=1),
        "data": {"key": "value"},
    }

    mock_manager.create_session.return_value = mock_session
    mock_manager.get_session.return_value = mock_session
    mock_manager.update_session.return_value = mock_session
    mock_manager.delete_session.return_value = True
    mock_manager.validate_session.return_value = True
    mock_manager.refresh_session.return_value = mock_session

    return mock_manager


@pytest.fixture
def mock_mfa_service():
    """Mock MFA service for testing."""
    mock_service = AsyncMock()

    # Mock enrollment
    mock_service.enroll_device.return_value = {
        "device_id": "device123",
        "secret": "JBSWY3DPEHPK3PXP",
        "qr_code": "data:image/png;base64,iVBORw0KGgo...",
        "backup_codes": ["123456", "789012"],
    }

    # Mock verification
    mock_service.verify_enrollment.return_value = {"success": True, "device_id": "device123"}

    mock_service.initiate_mfa_challenge.return_value = {
        "challenge_token": "challenge123",
        "method": "totp",
        "expires_in": 300,
    }

    mock_service.verify_mfa_challenge.return_value = {
        "success": True,
        "mfa_claims": {"mfa_verified": True},
    }

    # Mock device management
    mock_service.get_user_devices.return_value = [
        {"id": "device123", "name": "iPhone", "method": "totp", "status": "active"}
    ]

    mock_service.delete_device.return_value = True

    return mock_service


@pytest.fixture
def mock_secrets_manager():
    """Mock secrets manager for testing."""
    mock_manager = AsyncMock()

    # Mock secret operations
    mock_manager.get_secret.return_value = {"username": "test_user", "password": "test_pass"}

    mock_manager.set_secret.return_value = True
    mock_manager.delete_secret.return_value = True
    mock_manager.list_secrets.return_value = ["secret1", "secret2"]

    # Mock health check
    mock_manager.health_check.return_value = {
        "healthy": True,
        "provider": "vault",
        "version": "1.0.0",
    }

    return mock_manager


@pytest.fixture
def mock_observability_manager():
    """Mock observability manager for testing."""
    mock_manager = Mock()

    # Mock initialization
    mock_manager.initialize.return_value = None
    mock_manager.shutdown.return_value = None

    # Mock service info
    mock_manager.service_name = "test-service"
    mock_manager.initialized = True

    # Mock components
    mock_manager.tracer = Mock()
    mock_manager.meter = Mock()
    mock_manager.logger = Mock()

    return mock_manager


@pytest.fixture
def mock_database_engine():
    """Mock database engine for testing."""
    mock_engine = Mock()

    # Mock connection
    mock_connection = Mock()
    mock_connection.execute.return_value = Mock(scalar=Mock(return_value=1))
    mock_connection.__enter__ = Mock(return_value=mock_connection)
    mock_connection.__exit__ = Mock(return_value=None)

    mock_engine.connect.return_value = mock_connection
    mock_engine.dispose.return_value = None

    # Mock URL
    mock_engine.url = "postgresql://localhost/test"

    return mock_engine


@pytest.fixture
def mock_async_database_engine():
    """Mock async database engine for testing."""
    mock_engine = AsyncMock()

    # Mock async connection
    mock_connection = AsyncMock()
    mock_connection.execute.return_value = AsyncMock(scalar=Mock(return_value=1))
    mock_connection.__aenter__ = AsyncMock(return_value=mock_connection)
    mock_connection.__aexit__ = AsyncMock(return_value=None)

    mock_engine.begin.return_value = mock_connection
    mock_engine.dispose.return_value = None

    # Mock URL
    mock_engine.url = "postgresql+asyncpg://localhost/test"

    return mock_engine


@pytest.fixture
def mock_task_queue():
    """Mock task queue for testing."""
    mock_queue = AsyncMock()

    # Mock task operations
    mock_queue.enqueue.return_value = "task123"
    mock_queue.dequeue.return_value = {
        "id": "task123",
        "name": "test_task",
        "args": [],
        "kwargs": {},
        "status": "pending",
    }

    mock_queue.get_task_status.return_value = "completed"
    mock_queue.cancel_task.return_value = True
    mock_queue.list_tasks.return_value = []

    return mock_queue


@pytest.fixture
def mock_cache():
    """Mock cache for testing."""
    mock_cache = AsyncMock()

    # Mock cache operations
    mock_cache.get.return_value = None
    mock_cache.set.return_value = True
    mock_cache.delete.return_value = True
    mock_cache.clear.return_value = 0
    mock_cache.exists.return_value = False

    # Mock stats
    mock_cache.get_stats.return_value = {"hits": 0, "misses": 0, "size": 0}

    return mock_cache


@pytest.fixture
def mock_file_system():
    """Mock file system operations for testing."""
    mock_fs = Mock()

    # Mock file operations
    mock_fs.read_file.return_value = "file content"
    mock_fs.write_file.return_value = True
    mock_fs.delete_file.return_value = True
    mock_fs.file_exists.return_value = True
    mock_fs.list_files.return_value = ["file1.txt", "file2.txt"]

    # Mock directory operations
    mock_fs.create_directory.return_value = True
    mock_fs.delete_directory.return_value = True
    mock_fs.directory_exists.return_value = True

    return mock_fs


class MockAsyncContextManager:
    """Helper for creating async context managers in tests."""

    def __init__(self, return_value=None):
        self.return_value = return_value or Mock()

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return None


@pytest.fixture
def async_context_helper():
    """Helper for testing async context managers."""
    return MockAsyncContextManager


def create_mock_request(
    method: str = "GET",
    path: str = "/",
    headers: dict[str, str] | None = None,
    query_params: dict[str, str] | None = None,
    body: str | None = None,
):
    """Helper to create mock FastAPI request objects."""
    mock_request = Mock()
    mock_request.method = method
    mock_request.url.path = path
    mock_request.headers = headers or {}
    mock_request.query_params = query_params or {}
    mock_request.body = Mock(return_value=body or "")
    mock_request.state = type("State", (), {})()

    return mock_request


def create_mock_response(
    status_code: int = 200, content: Any = None, headers: dict[str, str] | None = None
):
    """Helper to create mock response objects."""
    mock_response = Mock()
    mock_response.status_code = status_code
    mock_response.content = content
    mock_response.headers = headers or {}

    if content and isinstance(content, dict):
        mock_response.json.return_value = content

    return mock_response


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Comprehensive tests for health check system.

Tests ServiceHealth class, HealthChecker class, and all service check methods
to achieve high coverage of health_checks.py module.
"""

from unittest.mock import MagicMock, patch

import pytest
from redis.exceptions import RedisError
from sqlalchemy.exc import DatabaseError

# Import the module to ensure it's loaded for coverage
from dotmac.platform.monitoring.health_checks import (
    HealthChecker,
    ServiceHealth,
    ServiceStatus,
    check_startup_dependencies,
    ensure_infrastructure_running,
)


@pytest.mark.integration
class TestServiceStatus:
    """Test ServiceStatus enum."""

    def test_service_status_values(self):
        """Test service status enum values."""
        assert ServiceStatus.HEALTHY == "healthy"
        assert ServiceStatus.DEGRADED == "degraded"
        assert ServiceStatus.UNHEALTHY == "unhealthy"


@pytest.mark.integration
class TestServiceHealth:
    """Test ServiceHealth class."""

    def test_service_health_creation(self):
        """Test creating ServiceHealth instance."""
        health = ServiceHealth("database", ServiceStatus.HEALTHY, "All good", required=True)

        assert health.name == "database"
        assert health.status == ServiceStatus.HEALTHY
        assert health.message == "All good"
        assert health.required is True

    def test_service_health_defaults(self):
        """Test ServiceHealth with default parameters."""
        health = ServiceHealth("redis", ServiceStatus.DEGRADED)

        assert health.name == "redis"
        assert health.status == ServiceStatus.DEGRADED
        assert health.message == ""
        assert health.required is True

    def test_is_healthy_property(self):
        """Test is_healthy property."""
        healthy = ServiceHealth("test", ServiceStatus.HEALTHY)
        degraded = ServiceHealth("test", ServiceStatus.DEGRADED)
        unhealthy = ServiceHealth("test", ServiceStatus.UNHEALTHY)

        assert healthy.is_healthy is True
        assert degraded.is_healthy is False
        assert unhealthy.is_healthy is False

    def test_to_dict_method(self):
        """Test to_dict serialization."""
        health = ServiceHealth("vault", ServiceStatus.DEGRADED, "Connection slow", required=False)
        result = health.to_dict()

        expected = {
            "name": "vault",
            "status": "degraded",
            "message": "Connection slow",
            "required": False,
        }
        assert result == expected


@pytest.mark.integration
class TestHealthChecker:
    """Test HealthChecker class."""

    @pytest.fixture
    def health_checker(self):
        """Create HealthChecker instance."""
        return HealthChecker()

    def test_health_checker_initialization(self, health_checker):
        """Test HealthChecker initialization."""
        assert health_checker.checks == []

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_get_redis_client_context_manager(self, mock_settings, health_checker):
        """Test Redis client context manager."""
        mock_redis_client = MagicMock()

        with patch("dotmac.platform.monitoring.health_checks.Redis") as mock_redis:
            mock_redis.from_url.return_value = mock_redis_client

            with health_checker._get_redis_client("redis://localhost:6379") as client:
                assert client == mock_redis_client
                mock_redis.from_url.assert_called_once_with(
                    "redis://localhost:6379",
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_keepalive=True,
                    socket_keepalive_options={},
                )

            # Verify client.close() was called
            mock_redis_client.close.assert_called_once()

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_get_redis_client_close_exception(self, mock_settings, health_checker):
        """Test Redis client context manager with close exception."""
        mock_redis_client = MagicMock()
        mock_redis_client.close.side_effect = Exception("Close failed")

        with patch("dotmac.platform.monitoring.health_checks.Redis") as mock_redis:
            mock_redis.from_url.return_value = mock_redis_client

            # Should not raise exception even if close fails
            with health_checker._get_redis_client("redis://localhost:6379") as client:
                assert client == mock_redis_client

    def test_check_redis_url_success(self, health_checker):
        """Test successful Redis URL check."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True

        with patch.object(health_checker, "_get_redis_client") as mock_get_client:
            mock_get_client.return_value.__enter__.return_value = mock_client

            is_healthy, message = health_checker._check_redis_url("redis://localhost:6379", "Redis")

            assert is_healthy is True
            assert message == "Redis connection successful"
            mock_client.ping.assert_called_once()

    def test_check_redis_url_redis_error(self, health_checker):
        """Test Redis URL check with Redis error."""
        mock_client = MagicMock()
        mock_client.ping.side_effect = RedisError("Connection failed")

        with patch.object(health_checker, "_get_redis_client") as mock_get_client:
            mock_get_client.return_value.__enter__.return_value = mock_client

            is_healthy, message = health_checker._check_redis_url("redis://localhost:6379", "Redis")

            assert is_healthy is False
            assert "Redis error: Connection failed" in message

    def test_check_redis_url_general_exception(self, health_checker):
        """Test Redis URL check with general exception."""
        mock_client = MagicMock()
        mock_client.ping.side_effect = Exception("Network error")

        with patch.object(health_checker, "_get_redis_client") as mock_get_client:
            mock_get_client.return_value.__enter__.return_value = mock_client

            is_healthy, message = health_checker._check_redis_url("redis://localhost:6379", "Redis")

            assert is_healthy is False
            assert "Connection failed: Network error" in message

    @patch("dotmac.platform.monitoring.health_checks.get_sync_engine")
    def test_check_database_success(self, mock_get_engine, health_checker):
        """Test successful database check."""
        mock_connection = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        mock_connection.execute.return_value = mock_result

        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        mock_get_engine.return_value = mock_engine

        result = health_checker.check_database()

        assert result.name == "database"
        assert result.status == ServiceStatus.HEALTHY
        assert result.message == "Database connection successful"
        assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.get_sync_engine")
    def test_check_database_failure(self, mock_get_engine, health_checker):
        """Test database check failure."""
        mock_get_engine.side_effect = DatabaseError("Connection failed", None, None)

        result = health_checker.check_database()

        assert result.name == "database"
        assert result.status == ServiceStatus.UNHEALTHY
        assert "Connection failed" in result.message
        assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_redis_success(self, mock_settings, health_checker):
        """Test successful Redis check."""
        mock_settings.redis.redis_url = "redis://localhost:6379"

        with patch.object(health_checker, "_check_redis_url") as mock_check:
            mock_check.return_value = (True, "Redis connection successful")

            result = health_checker.check_redis()

            assert result.name == "redis"
            assert result.status == ServiceStatus.HEALTHY
            assert result.message == "Redis connection successful"
            assert result.required is True
            mock_check.assert_called_once_with("redis://localhost:6379", "Redis")

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_redis_failure(self, mock_settings, health_checker):
        """Test Redis check failure in development mode (fallback available)."""
        mock_settings.redis.redis_url = "redis://localhost:6379"

        with patch.object(health_checker, "_check_redis_url") as mock_check:
            mock_check.return_value = (False, "Connection failed")

            result = health_checker.check_redis()

            assert result.name == "redis"
            assert result.status == ServiceStatus.DEGRADED  # Development mode: fallback available
            assert "Connection failed" in result.message
            assert result.required is False  # Not required in development (fallback available)

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_vault_disabled(self, mock_settings, health_checker):
        """Test vault check when disabled."""
        mock_settings.vault.enabled = False

        result = health_checker.check_vault()

        assert result.name == "vault"
        assert result.status == ServiceStatus.HEALTHY
        assert result.message == "Vault disabled, skipping check"
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_vault_success_prod(self, mock_settings, health_checker):
        """Test successful vault check in production."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = "test-ns"
        mock_settings.environment = "production"

        mock_client = MagicMock()
        mock_client.health_check.return_value = True

        with patch("dotmac.platform.secrets.VaultClient") as mock_vault:
            mock_vault.return_value = mock_client

            result = health_checker.check_vault()

            assert result.name == "vault"
            assert result.status == ServiceStatus.HEALTHY
            assert result.message == "Vault connection successful"
            assert result.required is True  # Production

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_vault_success_dev(self, mock_settings, health_checker):
        """Test successful vault check in development."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = "test-ns"
        mock_settings.environment = "development"

        mock_client = MagicMock()
        mock_client.health_check.return_value = True

        with patch("dotmac.platform.secrets.VaultClient") as mock_vault:
            mock_vault.return_value = mock_client

            result = health_checker.check_vault()

            assert result.name == "vault"
            assert result.status == ServiceStatus.HEALTHY
            assert result.message == "Vault connection successful"
            assert result.required is False  # Development

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_vault_health_check_fails(self, mock_settings, health_checker):
        """Test vault check when health check returns False."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = "test-ns"
        mock_settings.environment = "production"

        mock_client = MagicMock()
        mock_client.health_check.return_value = False

        with patch("dotmac.platform.secrets.VaultClient") as mock_vault:
            mock_vault.return_value = mock_client

            result = health_checker.check_vault()

            assert result.name == "vault"
            assert result.status == ServiceStatus.UNHEALTHY
            assert result.message == "Vault health check failed"
            assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_vault_exception(self, mock_settings, health_checker):
        """Test vault check with exception."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = "test-ns"
        mock_settings.environment = "production"

        with patch("dotmac.platform.secrets.VaultClient") as mock_vault:
            mock_vault.side_effect = Exception("Connection error")

            result = health_checker.check_vault()

            assert result.name == "vault"
            assert result.status == ServiceStatus.UNHEALTHY
            assert "Connection failed: Connection error" in result.message
            assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_celery_broker_redis_success(self, mock_settings, health_checker):
        """Test successful Celery broker check with Redis."""
        mock_settings.celery.broker_url = "redis://localhost:6379/0"

        with patch.object(health_checker, "_check_redis_url") as mock_check:
            mock_check.return_value = (True, "Celery broker connection successful")

            result = health_checker.check_celery_broker()

            assert result.name == "celery_broker"
            assert result.status == ServiceStatus.HEALTHY
            assert result.message == "Celery broker connection successful"
            assert result.required is False
            mock_check.assert_called_once_with("redis://localhost:6379/0", "Celery broker")

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_celery_broker_redis_failure(self, mock_settings, health_checker):
        """Test Celery broker check failure with Redis."""
        mock_settings.celery.broker_url = "redis://localhost:6379/0"

        with patch.object(health_checker, "_check_redis_url") as mock_check:
            mock_check.return_value = (False, "Connection failed")

            result = health_checker.check_celery_broker()

            assert result.name == "celery_broker"
            assert result.status == ServiceStatus.DEGRADED
            assert result.message == "Connection failed"
            assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_celery_broker_rabbitmq(self, mock_settings, health_checker):
        """Test Celery broker check with RabbitMQ."""
        mock_settings.celery.broker_url = "amqp://localhost:5672"

        result = health_checker.check_celery_broker()

        assert result.name == "celery_broker"
        assert result.status == ServiceStatus.UNHEALTHY
        assert "Unsupported Celery broker" in result.message
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_celery_broker_pyamqp(self, mock_settings, health_checker):
        """Test Celery broker check with PyAMQP."""
        mock_settings.celery.broker_url = "pyamqp://localhost:5672"

        result = health_checker.check_celery_broker()

        assert result.name == "celery_broker"
        assert result.status == ServiceStatus.UNHEALTHY
        assert "Unsupported Celery broker" in result.message
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_celery_broker_unknown(self, mock_settings, health_checker):
        """Test Celery broker check with unknown broker."""
        mock_settings.celery.broker_url = "sqs://aws-region/queue-name"

        result = health_checker.check_celery_broker()

        assert result.name == "celery_broker"
        assert result.status == ServiceStatus.UNHEALTHY
        assert "Unsupported Celery broker" in result.message
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_storage_local(self, mock_settings, health_checker):
        """Test storage check with local provider."""
        mock_settings.storage.provider = "local"

        result = health_checker.check_storage()

        assert result.name == "storage"
        assert result.status == ServiceStatus.HEALTHY
        assert result.message == "Using local filesystem storage"
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_storage_minio(self, mock_settings, health_checker):
        """Test storage check with MinIO provider."""
        mock_settings.storage.provider = "minio"
        mock_settings.storage.endpoint = "http://minio:9000"
        mock_settings.storage.access_key = "minio"
        mock_settings.storage.secret_key = "minio-secret"
        mock_settings.storage.bucket = "dotmac-test"
        mock_settings.storage.region = "us-east-1"

        with patch("minio.Minio") as mock_minio:
            client = MagicMock()
            client.bucket_exists.return_value = True
            mock_minio.return_value = client

            result = health_checker.check_storage()

        assert result.name == "storage"
        assert result.status == ServiceStatus.HEALTHY
        assert result.message == "Object storage bucket 'dotmac-test' reachable"
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_storage_s3(self, mock_settings, health_checker):
        """Test storage check with S3 provider."""
        mock_settings.storage.provider = "s3"
        mock_settings.storage.endpoint = "https://s3.amazonaws.com"
        mock_settings.storage.access_key = "aws-access"
        mock_settings.storage.secret_key = "aws-secret"
        mock_settings.storage.bucket = "dotmac-test"
        mock_settings.storage.region = "us-east-1"

        with patch("minio.Minio") as mock_minio:
            client = MagicMock()
            client.bucket_exists.return_value = True
            mock_minio.return_value = client

            result = health_checker.check_storage()

        assert result.name == "storage"
        assert result.status == ServiceStatus.HEALTHY
        assert result.message == "Object storage bucket 'dotmac-test' reachable"
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_observability_disabled(self, mock_settings, health_checker):
        """Test observability check when disabled."""
        mock_settings.observability.otel_enabled = False

        result = health_checker.check_observability()

        assert result.name == "observability"
        assert result.status == ServiceStatus.HEALTHY
        assert result.message == "Observability disabled, skipping check"
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_observability_no_endpoint(self, mock_settings, health_checker):
        """Test observability check with no endpoint configured."""
        mock_settings.observability.otel_enabled = True
        mock_settings.observability.otel_endpoint = ""

        result = health_checker.check_observability()

        assert result.name == "observability"
        assert result.status == ServiceStatus.DEGRADED
        assert result.message == "OTLP endpoint not configured"
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    @patch("dotmac.platform.monitoring.health_checks.httpx")
    def test_check_observability_success(self, mock_httpx, mock_settings, health_checker):
        """Test successful observability check."""
        mock_settings.observability.otel_enabled = True
        mock_settings.observability.otel_endpoint = "http://localhost:4317"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_httpx.Client.return_value.__enter__.return_value = mock_client

        result = health_checker.check_observability()

        assert result.name == "observability"
        assert result.status == ServiceStatus.HEALTHY
        assert result.message == "OTLP endpoint accepted test span"
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    @patch("dotmac.platform.monitoring.health_checks.httpx")
    def test_check_observability_server_error(self, mock_httpx, mock_settings, health_checker):
        """Test observability check with server error."""
        mock_settings.observability.otel_enabled = True
        mock_settings.observability.otel_endpoint = "http://localhost:4317"

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_httpx.Client.return_value.__enter__.return_value = mock_client

        result = health_checker.check_observability()

        assert result.name == "observability"
        assert result.status == ServiceStatus.DEGRADED
        assert result.message == "OTLP endpoint returned 500"
        assert result.required is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    @patch("dotmac.platform.monitoring.health_checks.httpx")
    def test_check_observability_exception(self, mock_httpx, mock_settings, health_checker):
        """Test observability check with exception."""
        mock_settings.observability.otel_enabled = True
        mock_settings.observability.otel_endpoint = "http://localhost:4317"

        mock_client = MagicMock()
        mock_client.post.side_effect = Exception("Network error")
        mock_httpx.Client.return_value.__enter__.return_value = mock_client

        result = health_checker.check_observability()

        assert result.name == "observability"
        assert result.status == ServiceStatus.DEGRADED
        assert "Connection failed: Network error" in result.message
        assert result.required is False


@pytest.mark.integration
class TestHealthCheckerIntegration:
    """Test HealthChecker integration methods."""

    @pytest.fixture
    def health_checker(self):
        """Create HealthChecker instance."""
        return HealthChecker()

    def test_run_all_checks_all_healthy(self, health_checker):
        """Test run_all_checks with all services healthy."""
        with (
            patch.object(health_checker, "check_database") as mock_db,
            patch.object(health_checker, "check_redis") as mock_redis,
            patch.object(health_checker, "check_vault") as mock_vault,
            patch.object(health_checker, "check_storage") as mock_storage,
            patch.object(health_checker, "check_celery_broker") as mock_celery,
            patch.object(health_checker, "check_observability") as mock_obs,
        ):
            # All healthy
            mock_db.return_value = ServiceHealth("database", ServiceStatus.HEALTHY, required=True)
            mock_redis.return_value = ServiceHealth("redis", ServiceStatus.HEALTHY, required=True)
            mock_vault.return_value = ServiceHealth("vault", ServiceStatus.HEALTHY, required=False)
            mock_storage.return_value = ServiceHealth(
                "storage", ServiceStatus.HEALTHY, required=False
            )
            mock_celery.return_value = ServiceHealth(
                "celery_broker", ServiceStatus.HEALTHY, required=False
            )
            mock_obs.return_value = ServiceHealth(
                "observability", ServiceStatus.HEALTHY, required=False
            )

            all_healthy, checks = health_checker.run_all_checks()

            assert all_healthy is True
            assert len(checks) == 6
            assert all(check.is_healthy for check in checks)

    def test_run_all_checks_required_service_unhealthy(self, health_checker):
        """Test run_all_checks with required service unhealthy."""
        with (
            patch.object(health_checker, "check_database") as mock_db,
            patch.object(health_checker, "check_redis") as mock_redis,
            patch.object(health_checker, "check_vault") as mock_vault,
            patch.object(health_checker, "check_storage") as mock_storage,
            patch.object(health_checker, "check_celery_broker") as mock_celery,
            patch.object(health_checker, "check_observability") as mock_obs,
        ):
            # Database unhealthy (required)
            mock_db.return_value = ServiceHealth("database", ServiceStatus.UNHEALTHY, required=True)
            mock_redis.return_value = ServiceHealth("redis", ServiceStatus.HEALTHY, required=True)
            mock_vault.return_value = ServiceHealth("vault", ServiceStatus.HEALTHY, required=False)
            mock_storage.return_value = ServiceHealth(
                "storage", ServiceStatus.HEALTHY, required=False
            )
            mock_celery.return_value = ServiceHealth(
                "celery_broker", ServiceStatus.HEALTHY, required=False
            )
            mock_obs.return_value = ServiceHealth(
                "observability", ServiceStatus.HEALTHY, required=False
            )

            all_healthy, checks = health_checker.run_all_checks()

            assert all_healthy is False
            assert len(checks) == 6

    def test_run_all_checks_optional_service_unhealthy(self, health_checker):
        """Test run_all_checks with optional service unhealthy."""
        with (
            patch.object(health_checker, "check_database") as mock_db,
            patch.object(health_checker, "check_redis") as mock_redis,
            patch.object(health_checker, "check_vault") as mock_vault,
            patch.object(health_checker, "check_storage") as mock_storage,
            patch.object(health_checker, "check_celery_broker") as mock_celery,
            patch.object(health_checker, "check_observability") as mock_obs,
        ):
            # Observability unhealthy (optional)
            mock_db.return_value = ServiceHealth("database", ServiceStatus.HEALTHY, required=True)
            mock_redis.return_value = ServiceHealth("redis", ServiceStatus.HEALTHY, required=True)
            mock_vault.return_value = ServiceHealth("vault", ServiceStatus.HEALTHY, required=False)
            mock_storage.return_value = ServiceHealth(
                "storage", ServiceStatus.HEALTHY, required=False
            )
            mock_celery.return_value = ServiceHealth(
                "celery_broker", ServiceStatus.HEALTHY, required=False
            )
            mock_obs.return_value = ServiceHealth(
                "observability", ServiceStatus.UNHEALTHY, required=False
            )

            all_healthy, checks = health_checker.run_all_checks()

            assert all_healthy is True  # Still healthy because observability is optional
            assert len(checks) == 6

    def test_get_summary(self, health_checker):
        """Test get_summary method."""
        with patch.object(health_checker, "run_all_checks") as mock_run:
            mock_checks = [
                ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True),
                ServiceHealth("redis", ServiceStatus.UNHEALTHY, "Failed", required=True),
                ServiceHealth("vault", ServiceStatus.DEGRADED, "Slow", required=False),
                ServiceHealth("storage", ServiceStatus.HEALTHY, "OK", required=False),
            ]
            mock_run.return_value = (False, mock_checks)

            summary = health_checker.get_summary()

            expected = {
                "healthy": False,
                "services": [
                    {"name": "database", "status": "healthy", "message": "OK", "required": True},
                    {"name": "redis", "status": "unhealthy", "message": "Failed", "required": True},
                    {"name": "vault", "status": "degraded", "message": "Slow", "required": False},
                    {"name": "storage", "status": "healthy", "message": "OK", "required": False},
                ],
                "required_services": ["database", "redis"],
                "failed_services": ["redis", "vault"],
                "failed_required": ["redis"],
            }
            assert summary == expected


@pytest.mark.integration
class TestStartupDependencies:
    """Test startup dependency checking functions."""

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_startup_dependencies_all_healthy(self, mock_settings):
        """Test startup dependencies check with all services healthy."""
        mock_settings.environment = "production"

        mock_checks = [
            ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True),
            ServiceHealth("redis", ServiceStatus.HEALTHY, "OK", required=True),
        ]

        with patch("dotmac.platform.monitoring.health_checks.HealthChecker") as mock_checker_class:
            mock_checker = MagicMock()
            mock_checker.run_all_checks.return_value = (True, mock_checks)
            mock_checker_class.return_value = mock_checker

            result = check_startup_dependencies()

            assert result is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_startup_dependencies_failed_in_prod(self, mock_settings):
        """Test startup dependencies check with failures in production."""
        mock_settings.environment = "production"

        mock_checks = [
            ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True),
            ServiceHealth("redis", ServiceStatus.UNHEALTHY, "Failed", required=True),
        ]

        with patch("dotmac.platform.monitoring.health_checks.HealthChecker") as mock_checker_class:
            mock_checker = MagicMock()
            mock_checker.run_all_checks.return_value = (False, mock_checks)
            mock_checker_class.return_value = mock_checker

            result = check_startup_dependencies()

            assert result is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_startup_dependencies_failed_in_dev(self, mock_settings):
        """Test startup dependencies check with failures in development."""
        mock_settings.environment = "development"

        mock_checks = [
            ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True),
            ServiceHealth("redis", ServiceStatus.UNHEALTHY, "Failed", required=True),
        ]

        with patch("dotmac.platform.monitoring.health_checks.HealthChecker") as mock_checker_class:
            mock_checker = MagicMock()
            mock_checker.run_all_checks.return_value = (False, mock_checks)
            mock_checker_class.return_value = mock_checker

            result = check_startup_dependencies()

            assert result is True  # Should continue in development despite failures

    def test_ensure_infrastructure_running(self, capsys):
        """Test ensure_infrastructure_running function."""
        ensure_infrastructure_running()

        captured = capsys.readouterr()
        assert "Starting DotMac Platform Services" in captured.out
        assert "Required Infrastructure Services:" in captured.out
        assert "PostgreSQL (database)" in captured.out
        assert "Redis (cache & sessions)" in captured.out
        assert "docker-compose up -d" in captured.out

"""
Edge case tests for health check system.

Tests complex scenarios, error conditions, and edge cases
to achieve maximum coverage of health_checks.py.
"""

import os
from unittest.mock import MagicMock, patch

import httpx
import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import (
    RedisError,
)
from redis.exceptions import TimeoutError as RedisTimeoutError
from sqlalchemy.exc import DatabaseError, OperationalError, SQLAlchemyError

from dotmac.platform.monitoring.health_checks import (
    HealthChecker,
    ServiceHealth,
    ServiceStatus,
    _is_production_environment,
    check_startup_dependencies,
    ensure_infrastructure_running,
)


@pytest.mark.integration
class TestHealthCheckerEdgeCases:
    """Test edge cases and complex scenarios in HealthChecker."""

    @pytest.fixture
    def health_checker(self):
        """Create HealthChecker instance."""
        return HealthChecker()

    def test_redis_context_manager_with_none_client(self, health_checker):
        """Test Redis context manager when client is None."""
        with patch("dotmac.platform.monitoring.health_checks.Redis") as mock_redis:
            mock_redis.from_url.return_value = None

            with health_checker._get_redis_client("redis://localhost:6379") as client:
                assert client is None

    def test_redis_context_manager_client_creation_fails(self, health_checker):
        """Test Redis context manager when client creation fails."""
        with patch("dotmac.platform.monitoring.health_checks.Redis") as mock_redis:
            mock_redis.from_url.side_effect = Exception("Client creation failed")

            # Should raise exception during client creation
            with pytest.raises(Exception, match="Client creation failed"):
                with health_checker._get_redis_client("redis://localhost:6379"):
                    pass

    def test_check_redis_url_with_different_redis_errors(self, health_checker):
        """Test Redis URL check with different types of Redis errors."""
        test_cases = [
            (RedisConnectionError("Connection refused"), "Redis error: Connection refused"),
            (RedisTimeoutError("Operation timed out"), "Redis error: Operation timed out"),
            (RedisError("Generic Redis error"), "Redis error: Generic Redis error"),
        ]

        for exception, expected_message in test_cases:
            mock_client = MagicMock()
            mock_client.ping.side_effect = exception

            with patch.object(health_checker, "_get_redis_client") as mock_get_client:
                mock_get_client.return_value.__enter__.return_value = mock_client

                is_healthy, message = health_checker._check_redis_url(
                    "redis://localhost:6379", "Redis"
                )

                assert is_healthy is False
                assert expected_message in message

    @patch("dotmac.platform.monitoring.health_checks.get_sync_engine")
    def test_check_database_with_different_exceptions(self, mock_get_engine, health_checker):
        """Test database check with different types of database exceptions."""
        test_cases = [
            DatabaseError("Database error", None, None),
            OperationalError("Connection error", None, None),
            SQLAlchemyError("SQLAlchemy error"),
            Exception("Generic error"),
        ]

        for exception in test_cases:
            mock_get_engine.side_effect = exception

            result = health_checker.check_database()

            assert result.name == "database"
            assert result.status == ServiceStatus.UNHEALTHY
            assert result.required is True
            assert str(exception) in result.message or "error" in result.message.lower()

            # Reset for next iteration
            mock_get_engine.side_effect = None
            mock_get_engine.reset_mock()

    @patch("dotmac.platform.monitoring.health_checks.get_sync_engine")
    def test_check_database_connection_execute_fails(self, mock_get_engine, health_checker):
        """Test database check when connection.execute fails."""
        mock_connection = MagicMock()
        mock_connection.execute.side_effect = DatabaseError("Query failed", None, None)

        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        mock_get_engine.return_value = mock_engine

        result = health_checker.check_database()

        assert result.name == "database"
        assert result.status == ServiceStatus.UNHEALTHY
        assert "Query failed" in result.message

    @patch("dotmac.platform.monitoring.health_checks.get_sync_engine")
    def test_check_database_scalar_fails(self, mock_get_engine, health_checker):
        """Test database check when result.scalar() fails."""
        mock_result = MagicMock()
        mock_result.scalar.side_effect = Exception("Scalar failed")
        mock_connection = MagicMock()
        mock_connection.execute.return_value = mock_result

        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        mock_get_engine.return_value = mock_engine

        result = health_checker.check_database()

        assert result.name == "database"
        assert result.status == ServiceStatus.UNHEALTHY
        assert "Scalar failed" in result.message

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_vault_import_error(self, mock_settings, health_checker):
        """Test vault check when VaultClient import fails."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = "test-ns"
        mock_settings.environment = "production"

        with patch.dict("sys.modules", {"dotmac.platform.secrets": None}):
            result = health_checker.check_vault()

            assert result.name == "vault"
            assert result.status == ServiceStatus.UNHEALTHY
            assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_vault_client_initialization_fails(self, mock_settings, health_checker):
        """Test vault check when VaultClient initialization fails."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = "test-ns"
        mock_settings.environment = "production"

        with patch("dotmac.platform.secrets.VaultClient") as mock_vault:
            mock_vault.side_effect = ValueError("Invalid configuration")

            result = health_checker.check_vault()

            assert result.name == "vault"
            assert result.status == ServiceStatus.UNHEALTHY
            assert "Invalid configuration" in result.message

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_vault_context_manager_fails(self, mock_settings, health_checker):
        """Test vault check when context manager entry fails."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = "test-ns"
        mock_settings.environment = "production"

        mock_client = MagicMock()
        mock_client.__enter__.side_effect = Exception("Context entry failed")

        with patch("dotmac.platform.secrets.VaultClient") as mock_vault:
            mock_vault.return_value = mock_client

            result = health_checker.check_vault()

            assert result.name == "vault"
            assert result.status == ServiceStatus.UNHEALTHY
            assert "Context entry failed" in result.message

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_celery_broker_edge_case_urls(self, mock_settings, health_checker):
        """Test Celery broker check with edge case URLs."""
        edge_case_urls = [
            ("redis://user:pass@localhost:6379/1", "Redis"),
            ("rediss://secure-redis:6380", "Redis"),  # SSL Redis
            ("amqp://user:pass@localhost:5672/vhost", "RabbitMQ"),
            ("pyamqp://user@localhost", "RabbitMQ"),
            ("memory://", "Unknown"),
            ("filesystem://tmp", "Unknown"),
            ("", "Unknown"),  # Empty URL
        ]

        for broker_url, _expected_type in edge_case_urls:
            mock_settings.celery.broker_url = broker_url

            if "redis" in broker_url.lower():
                with patch.object(health_checker, "_check_redis_url") as mock_check:
                    mock_check.return_value = (True, "Celery broker connection successful")

                    result = health_checker.check_celery_broker()
                    assert result.name == "celery_broker"
                    assert result.status == ServiceStatus.HEALTHY
            else:
                result = health_checker.check_celery_broker()
                assert result.name == "celery_broker"
                assert result.status == ServiceStatus.UNHEALTHY
                if broker_url:
                    assert "Unsupported Celery broker" in result.message

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_storage_unknown_provider(self, mock_settings, health_checker):
        """Test storage check with unknown provider."""
        mock_settings.storage.provider = "unknown-storage-provider"

        result = health_checker.check_storage()

        assert result.name == "storage"
        assert result.status == ServiceStatus.DEGRADED
        assert "unknown-storage-provider" in result.message
        assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    @patch("dotmac.platform.monitoring.health_checks.httpx")
    def test_check_observability_client_creation_fails(
        self, mock_httpx, mock_settings, health_checker
    ):
        """Test observability check when HTTP client creation fails."""
        mock_settings.observability.otel_enabled = True
        mock_settings.observability.otel_endpoint = "http://localhost:4317"

        mock_httpx.Client.side_effect = Exception("Client creation failed")

        result = health_checker.check_observability()

        assert result.name == "observability"
        assert result.status == ServiceStatus.DEGRADED
        assert "Client creation failed" in result.message
        assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    @patch("dotmac.platform.monitoring.health_checks.httpx")
    def test_check_observability_http_timeout(self, mock_httpx, mock_settings, health_checker):
        """Test observability check with HTTP timeout."""
        mock_settings.observability.otel_enabled = True
        mock_settings.observability.otel_endpoint = "http://localhost:4317"

        mock_client = MagicMock()
        mock_client.post.side_effect = httpx.TimeoutException("Request timeout")
        mock_httpx.Client.return_value.__enter__.return_value = mock_client

        result = health_checker.check_observability()

        assert result.name == "observability"
        assert result.status == ServiceStatus.DEGRADED
        assert "Request timeout" in result.message
        assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    @patch("dotmac.platform.monitoring.health_checks.httpx")
    def test_check_observability_various_status_codes(
        self, mock_httpx, mock_settings, health_checker
    ):
        """Test observability check with various HTTP status codes."""
        mock_settings.observability.otel_enabled = True
        mock_settings.observability.otel_endpoint = "http://localhost:4317"

        status_codes_and_expected = [
            (200, ServiceStatus.HEALTHY, "OTLP endpoint accepted test span"),
            (404, ServiceStatus.DEGRADED, "OTLP endpoint returned 404"),
            (401, ServiceStatus.DEGRADED, "OTLP endpoint returned 401"),
            (500, ServiceStatus.DEGRADED, "OTLP endpoint returned 500"),
            (502, ServiceStatus.DEGRADED, "OTLP endpoint returned 502"),
            (503, ServiceStatus.DEGRADED, "OTLP endpoint returned 503"),
        ]

        for status_code, expected_status, expected_message_part in status_codes_and_expected:
            mock_response = MagicMock()
            mock_response.status_code = status_code
            mock_client = MagicMock()
            mock_client.post.return_value = mock_response
            mock_httpx.Client.return_value.__enter__.return_value = mock_client

            result = health_checker.check_observability()

            assert result.name == "observability"
            assert result.status == expected_status
            assert result.message == expected_message_part
            assert result.required is True

    @patch("dotmac.platform.monitoring.health_checks.httpx.Client")
    @patch("dotmac.platform.monitoring.health_checks.socket.socket")
    def test_check_radius_server_healthy(self, mock_socket, mock_httpx, health_checker):
        """RADIUS health check should mark healthy when ports respond."""
        socket_instance = MagicMock()
        socket_instance.connect.return_value = None
        mock_socket.return_value.__enter__.return_value = socket_instance

        http_client = MagicMock()
        response = MagicMock()
        response.status_code = 200
        http_client.get.return_value = response
        mock_httpx.return_value.__enter__.return_value = http_client

        result = health_checker.check_radius_server()

        assert result.name == "radius_server"
        assert result.status == ServiceStatus.HEALTHY
        assert "healthy" in result.message.lower()

    @patch("dotmac.platform.monitoring.health_checks.httpx.Client")
    @patch("dotmac.platform.monitoring.health_checks.socket.socket")
    def test_check_radius_server_degraded_when_unreachable(
        self, mock_socket, mock_httpx, health_checker
    ):
        """RADIUS health check should degrade when UDP port is unreachable."""
        socket_instance = MagicMock()
        socket_instance.connect.side_effect = TimeoutError("timed out")
        mock_socket.return_value.__enter__.return_value = socket_instance

        http_client = MagicMock()
        response = MagicMock()
        response.status_code = 503
        http_client.get.return_value = response
        mock_httpx.return_value.__enter__.return_value = http_client

        result = health_checker.check_radius_server()

        assert result.name == "radius_server"
        assert result.status == ServiceStatus.DEGRADED
        assert "unreachable" in result.message.lower()

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_is_production_environment_true_when_flag_set(self, mock_settings):
        mock_settings.is_production = True
        mock_settings.environment = None
        with patch.dict(os.environ, {}, clear=True):
            assert _is_production_environment() is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_is_production_environment_true_for_prod_string(self, mock_settings):
        mock_settings.is_production = None
        mock_settings.environment = "production"
        with patch.dict(os.environ, {}, clear=True):
            assert _is_production_environment() is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_is_production_environment_uses_environment_variable(self, mock_settings):
        mock_settings.is_production = None
        mock_settings.environment = "development"
        with patch.dict(os.environ, {"ENVIRONMENT": "prod"}, clear=True):
            assert _is_production_environment() is True

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_is_production_environment_false_by_default(self, mock_settings):
        mock_settings.is_production = None
        mock_settings.environment = "development"
        with patch.dict(os.environ, {}, clear=True):
            assert _is_production_environment() is False

    def test_run_all_checks_preserves_order(self, health_checker):
        """Test that run_all_checks returns services in expected order."""
        with (
            patch.object(health_checker, "check_database") as mock_db,
            patch.object(health_checker, "check_redis") as mock_redis,
            patch.object(health_checker, "check_vault") as mock_vault,
            patch.object(health_checker, "check_storage") as mock_storage,
            patch.object(health_checker, "check_celery_broker") as mock_celery,
            patch.object(health_checker, "check_observability") as mock_obs,
            patch.object(health_checker, "check_alertmanager") as mock_am,
            patch.object(health_checker, "check_prometheus") as mock_prom,
            patch.object(health_checker, "check_grafana") as mock_graf,
            patch.object(health_checker, "check_radius_server") as mock_radius,
        ):
            # Mock return values
            mock_db.return_value = ServiceHealth("database", ServiceStatus.HEALTHY, required=True)
            mock_redis.return_value = ServiceHealth("redis", ServiceStatus.HEALTHY, required=True)
            mock_vault.return_value = ServiceHealth("vault", ServiceStatus.HEALTHY, required=True)
            mock_storage.return_value = ServiceHealth(
                "storage", ServiceStatus.HEALTHY, required=True
            )
            mock_celery.return_value = ServiceHealth(
                "celery_broker", ServiceStatus.HEALTHY, required=True
            )
            mock_obs.return_value = ServiceHealth(
                "observability", ServiceStatus.HEALTHY, required=True
            )
            mock_am.return_value = ServiceHealth(
                "alertmanager", ServiceStatus.HEALTHY, required=True
            )
            mock_prom.return_value = ServiceHealth(
                "prometheus", ServiceStatus.HEALTHY, required=True
            )
            mock_graf.return_value = ServiceHealth("grafana", ServiceStatus.HEALTHY, required=True)
            mock_radius.return_value = ServiceHealth(
                "radius_server", ServiceStatus.HEALTHY, required=True
            )

            all_healthy, checks = health_checker.run_all_checks()

            # Verify order matches the expected service order
            expected_order = [
                "database",
                "redis",
                "vault",
                "storage",
                "celery_broker",
                "observability",
                "alertmanager",
                "prometheus",
                "grafana",
                "radius_server",
            ]
            actual_order = [check.name for check in checks]
            assert actual_order == expected_order

    def test_run_all_checks_method_calls(self, health_checker):
        """Test that run_all_checks calls all check methods exactly once."""
        with (
            patch.object(health_checker, "check_database") as mock_db,
            patch.object(health_checker, "check_redis") as mock_redis,
            patch.object(health_checker, "check_vault") as mock_vault,
            patch.object(health_checker, "check_storage") as mock_storage,
            patch.object(health_checker, "check_celery_broker") as mock_celery,
            patch.object(health_checker, "check_observability") as mock_obs,
            patch.object(health_checker, "check_alertmanager") as mock_am,
            patch.object(health_checker, "check_prometheus") as mock_prom,
            patch.object(health_checker, "check_grafana") as mock_graf,
            patch.object(health_checker, "check_radius_server") as mock_radius,
        ):
            # Mock return values
            mock_db.return_value = ServiceHealth("database", ServiceStatus.HEALTHY, required=True)
            mock_redis.return_value = ServiceHealth("redis", ServiceStatus.HEALTHY, required=True)
            mock_vault.return_value = ServiceHealth("vault", ServiceStatus.HEALTHY, required=True)
            mock_storage.return_value = ServiceHealth(
                "storage", ServiceStatus.HEALTHY, required=True
            )
            mock_celery.return_value = ServiceHealth(
                "celery_broker", ServiceStatus.HEALTHY, required=True
            )
            mock_obs.return_value = ServiceHealth(
                "observability", ServiceStatus.HEALTHY, required=True
            )
            mock_am.return_value = ServiceHealth(
                "alertmanager", ServiceStatus.HEALTHY, required=True
            )
            mock_prom.return_value = ServiceHealth(
                "prometheus", ServiceStatus.HEALTHY, required=True
            )
            mock_graf.return_value = ServiceHealth("grafana", ServiceStatus.HEALTHY, required=True)
            mock_radius.return_value = ServiceHealth(
                "radius_server", ServiceStatus.HEALTHY, required=True
            )

            all_healthy, checks = health_checker.run_all_checks()

            # Verify each method called exactly once
            mock_db.assert_called_once_with()
            mock_redis.assert_called_once_with()
            mock_vault.assert_called_once_with()
            mock_storage.assert_called_once_with()
            mock_celery.assert_called_once_with()
            mock_obs.assert_called_once_with()
            mock_am.assert_called_once_with()
            mock_prom.assert_called_once_with()
            mock_graf.assert_called_once_with()
            mock_radius.assert_called_once_with()


@pytest.mark.integration
class TestStartupDependenciesEdgeCases:
    """Test edge cases in startup dependency checking."""

    @patch("dotmac.platform.monitoring.health_checks.settings")
    @patch("dotmac.platform.monitoring.health_checks.logger")
    def test_check_startup_dependencies_logging(self, mock_logger, mock_settings):
        """Test that startup dependencies check logs appropriately."""
        mock_settings.environment = "production"

        mock_checks = [
            ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True),
            ServiceHealth("redis", ServiceStatus.UNHEALTHY, "Failed", required=True),
            ServiceHealth("vault", ServiceStatus.DEGRADED, "Slow", required=True),
            ServiceHealth("alertmanager", ServiceStatus.HEALTHY, "OK", required=True),
        ]

        with patch("dotmac.platform.monitoring.health_checks.HealthChecker") as mock_checker_class:
            mock_checker = MagicMock()
            mock_checker.run_all_checks.return_value = (False, mock_checks)
            mock_checker_class.return_value = mock_checker

            result = check_startup_dependencies()

            assert result is False

            # Verify logging calls
            assert mock_logger.info.called
            assert mock_logger.error.called

            # Check specific log messages
            info_calls = [call[0][0] for call in mock_logger.info.call_args_list]
            error_calls = [call[0][0] for call in mock_logger.error.call_args_list]

            # Should log service status
            service_logs = [
                call
                for call in info_calls
                if any(service in call for service in ["database", "redis", "vault"])
            ]
            assert len(service_logs) >= 3

            # Should log error about required services
            required_service_errors = [
                call for call in error_calls if "Required services not available" in call
            ]
            assert len(required_service_errors) >= 1

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_startup_dependencies_mixed_failures(self, mock_settings):
        """Test startup dependencies with mixed required and optional failures."""
        mock_settings.environment = "development"

        mock_checks = [
            ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True),
            ServiceHealth("redis", ServiceStatus.HEALTHY, "OK", required=True),
            ServiceHealth("vault", ServiceStatus.UNHEALTHY, "Failed", required=True),
            ServiceHealth("observability", ServiceStatus.DEGRADED, "Slow", required=True),
        ]

        with patch("dotmac.platform.monitoring.health_checks.HealthChecker") as mock_checker_class:
            mock_checker = MagicMock()
            mock_checker.run_all_checks.return_value = (False, mock_checks)
            mock_checker_class.return_value = mock_checker

            result = check_startup_dependencies()

            assert result is False

    @patch("dotmac.platform.monitoring.health_checks.settings")
    def test_check_startup_dependencies_no_failed_required(self, mock_settings):
        """Test startup dependencies when no required services fail."""
        mock_settings.environment = "production"

        mock_checks = [
            ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True),
            ServiceHealth("redis", ServiceStatus.HEALTHY, "OK", required=True),
            ServiceHealth("vault", ServiceStatus.HEALTHY, "OK", required=True),
        ]

        with patch("dotmac.platform.monitoring.health_checks.HealthChecker") as mock_checker_class:
            mock_checker = MagicMock()
            mock_checker.run_all_checks.return_value = (True, mock_checks)
            mock_checker_class.return_value = mock_checker

            result = check_startup_dependencies()

            assert result is True

    def test_ensure_infrastructure_running_output_content(self, capsys):
        """Test that ensure_infrastructure_running outputs expected content."""
        ensure_infrastructure_running()

        captured = capsys.readouterr()

        # Check for key content sections
        expected_content = [
            "Starting DotMac Platform Services",
            "Required Infrastructure Services:",
            "PostgreSQL (database)",
            "Redis (cache & sessions)",
            "Vault/OpenBao (secrets)",
            "Celery worker (background tasks)",
            "OTLP Collector (observability)",
            "docker-compose up -d",
        ]

        for content in expected_content:
            assert content in captured.out


@pytest.mark.integration
class TestServiceHealthComplexScenarios:
    """Test complex scenarios with ServiceHealth objects."""

    def test_service_health_equality_comparison(self):
        """Test ServiceHealth objects can be compared for equality."""
        health1 = ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True)
        health2 = ServiceHealth("database", ServiceStatus.HEALTHY, "OK", required=True)
        health3 = ServiceHealth("redis", ServiceStatus.HEALTHY, "OK", required=True)

        # Note: ServiceHealth doesn't implement __eq__, so this tests default object equality
        assert health1 != health2  # Different objects
        assert health1 != health3  # Different names

    def test_service_health_string_representation(self):
        """Test ServiceHealth string representation."""
        health = ServiceHealth("vault", ServiceStatus.DEGRADED, "Connection slow", required=False)

        # Test that object can be converted to string (for logging)
        str_repr = str(health)
        assert "ServiceHealth" in str_repr or "vault" in str(health.__dict__)

    def test_service_health_dict_serialization_edge_cases(self):
        """Test ServiceHealth to_dict with edge cases."""
        test_cases = [
            ServiceHealth("", ServiceStatus.HEALTHY, "", required=True),  # Empty strings
            ServiceHealth(
                "service-with-dashes",
                ServiceStatus.UNHEALTHY,
                "Multi\nline\nmessage",
                required=False,
            ),  # Special chars
            ServiceHealth(
                "very-long-service-name-that-might-cause-issues",
                ServiceStatus.DEGRADED,
                "Very long error message that might contain special characters like quotes \" and 'apostrophes' and other symbols",
                required=True,
            ),
        ]

        for health in test_cases:
            result = health.to_dict()

            # Verify structure is correct
            assert isinstance(result, dict)
            assert "name" in result
            assert "status" in result
            assert "message" in result
            assert "required" in result
            assert isinstance(result["required"], bool)
            assert result["status"] in ["healthy", "degraded", "unhealthy"]

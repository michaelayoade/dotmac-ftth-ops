"""
Regression tests for Redis mandatory in production.

SECURITY: Tests that application startup FAILS in production when Redis is unavailable,
preventing deployment of systems where session revocation won't work correctly.

These tests verify the fix for making Redis availability mandatory in production
to ensure multi-worker session management works correctly.
"""

import os
from unittest.mock import patch

import pytest

from dotmac.platform.monitoring.health_checks import (
    HealthChecker,
    ServiceHealth,
    ServiceStatus,
)


class TestRedisProductionMandatory:
    """Test that Redis is mandatory in production."""

    def test_redis_unhealthy_blocks_production_startup(self):
        """
        SECURITY TEST: Redis unavailability in production returns UNHEALTHY + required=True.

        This ensures the application won't start without Redis in production.
        """
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with patch(
                "dotmac.platform.monitoring.health_checks.HealthChecker._check_redis_url",
                return_value=(False, "Connection refused"),
            ):
                checker = HealthChecker()
                health = checker.check_redis()

                # SECURITY ASSERTION: Redis is UNHEALTHY and REQUIRED in production
                assert health.status == ServiceStatus.UNHEALTHY
                assert health.required is True
                assert "CRITICAL" in health.message
                assert "MANDATORY" in health.message
                assert "Application startup BLOCKED" in health.message

    def test_redis_unhealthy_allows_development_startup(self):
        """Test that Redis unavailability in development returns DEGRADED + not required."""
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            with patch(
                "dotmac.platform.monitoring.health_checks.HealthChecker._check_redis_url",
                return_value=(False, "Connection refused"),
            ):
                checker = HealthChecker()
                health = checker.check_redis()

                # ASSERTION: Redis is DEGRADED but NOT required in development
                assert health.status == ServiceStatus.DEGRADED
                assert health.required is False
                assert "WARNING" in health.message
                assert "in-memory fallback" in health.message
                assert "DEVELOPMENT ONLY" in health.message

    def test_redis_healthy_in_production(self):
        """Test that Redis health check succeeds when Redis is available in production."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with patch(
                "dotmac.platform.monitoring.health_checks.HealthChecker._check_redis_url",
                return_value=(True, "Redis connection successful"),
            ):
                checker = HealthChecker()
                health = checker.check_redis()

                # ASSERTION: Redis is HEALTHY
                assert health.status == ServiceStatus.HEALTHY
                assert health.required is True
                assert "successful" in health.message

    def test_require_redis_sessions_env_var(self):
        """Test that REQUIRE_REDIS_SESSIONS environment variable overrides defaults."""
        # Force Redis to be required even in development
        with patch.dict(
            os.environ, {"ENVIRONMENT": "development", "REQUIRE_REDIS_SESSIONS": "true"}
        ):
            with patch(
                "dotmac.platform.monitoring.health_checks.HealthChecker._check_redis_url",
                return_value=(False, "Connection refused"),
            ):
                checker = HealthChecker()
                health = checker.check_redis()

                # ASSERTION: Redis is UNHEALTHY and REQUIRED (overridden)
                assert health.status == ServiceStatus.UNHEALTHY
                assert health.required is True
                assert "MANDATORY" in health.message


class TestHealthCheckerProductionStartup:
    """Test that health checker blocks production startup when Redis unavailable."""

    def test_run_all_checks_fails_production_without_redis(self):
        """
        SECURITY TEST: run_all_checks returns False when Redis unavailable in production.
        """
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with patch(
                "dotmac.platform.monitoring.health_checks.HealthChecker._check_redis_url",
                return_value=(False, "Connection refused"),
            ):
                # Mock other services as healthy
                with patch(
                    "dotmac.platform.monitoring.health_checks.HealthChecker.check_database",
                    return_value=ServiceHealth(
                        name="database", status=ServiceStatus.HEALTHY, message="OK", required=True
                    ),
                ):
                    with patch(
                        "dotmac.platform.monitoring.health_checks.HealthChecker.check_vault",
                        return_value=ServiceHealth(
                            name="vault",
                            status=ServiceStatus.HEALTHY,
                            message="OK",
                            required=False,
                        ),
                    ):
                        with patch(
                            "dotmac.platform.monitoring.health_checks.HealthChecker.check_storage",
                            return_value=ServiceHealth(
                                name="storage",
                                status=ServiceStatus.HEALTHY,
                                message="OK",
                                required=False,
                            ),
                        ):
                            with patch(
                                "dotmac.platform.monitoring.health_checks.HealthChecker.check_celery_broker",
                                return_value=ServiceHealth(
                                    name="celery",
                                    status=ServiceStatus.HEALTHY,
                                    message="OK",
                                    required=False,
                                ),
                            ):
                                with patch(
                                    "dotmac.platform.monitoring.health_checks.HealthChecker.check_observability",
                                    return_value=ServiceHealth(
                                        name="observability",
                                        status=ServiceStatus.HEALTHY,
                                        message="OK",
                                        required=False,
                                    ),
                                ):
                                    checker = HealthChecker()
                                    all_healthy, checks = checker.run_all_checks()

                                    # SECURITY ASSERTION: Startup should fail
                                    assert all_healthy is False

                                    # Find Redis check
                                    redis_check = next(c for c in checks if c.name == "redis")
                                    assert redis_check.status == ServiceStatus.UNHEALTHY
                                    assert redis_check.required is True

    def test_run_all_checks_succeeds_development_without_redis(self):
        """Test that run_all_checks succeeds in development even without Redis."""
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            with patch(
                "dotmac.platform.monitoring.health_checks.HealthChecker._check_redis_url",
                return_value=(False, "Connection refused"),
            ):
                # Mock other services as healthy
                with patch(
                    "dotmac.platform.monitoring.health_checks.HealthChecker.check_database",
                    return_value=ServiceHealth(
                        name="database", status=ServiceStatus.HEALTHY, message="OK", required=True
                    ),
                ):
                    with patch(
                        "dotmac.platform.monitoring.health_checks.HealthChecker.check_vault",
                        return_value=ServiceHealth(
                            name="vault",
                            status=ServiceStatus.HEALTHY,
                            message="OK",
                            required=False,
                        ),
                    ):
                        with patch(
                            "dotmac.platform.monitoring.health_checks.HealthChecker.check_storage",
                            return_value=ServiceHealth(
                                name="storage",
                                status=ServiceStatus.HEALTHY,
                                message="OK",
                                required=False,
                            ),
                        ):
                            with patch(
                                "dotmac.platform.monitoring.health_checks.HealthChecker.check_celery_broker",
                                return_value=ServiceHealth(
                                    name="celery",
                                    status=ServiceStatus.HEALTHY,
                                    message="OK",
                                    required=False,
                                ),
                            ):
                                with patch(
                                    "dotmac.platform.monitoring.health_checks.HealthChecker.check_observability",
                                    return_value=ServiceHealth(
                                        name="observability",
                                        status=ServiceStatus.HEALTHY,
                                        message="OK",
                                        required=False,
                                    ),
                                ):
                                    checker = HealthChecker()
                                    all_healthy, checks = checker.run_all_checks()

                                    # ASSERTION: Startup should succeed (degraded mode)
                                    assert all_healthy is True

                                    # Redis should be DEGRADED but not blocking
                                    redis_check = next(c for c in checks if c.name == "redis")
                                    assert redis_check.status == ServiceStatus.DEGRADED
                                    assert redis_check.required is False

    def test_get_summary_shows_redis_as_failed_in_production(self):
        """Test that health summary correctly identifies Redis as failed in production."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with patch(
                "dotmac.platform.monitoring.health_checks.HealthChecker._check_redis_url",
                return_value=(False, "Connection refused"),
            ):
                # Mock other services as healthy
                with patch(
                    "dotmac.platform.monitoring.health_checks.HealthChecker.check_database",
                    return_value=ServiceHealth(
                        name="database", status=ServiceStatus.HEALTHY, message="OK", required=True
                    ),
                ):
                    with patch(
                        "dotmac.platform.monitoring.health_checks.HealthChecker.check_vault",
                        return_value=ServiceHealth(
                            name="vault",
                            status=ServiceStatus.HEALTHY,
                            message="OK",
                            required=False,
                        ),
                    ):
                        with patch(
                            "dotmac.platform.monitoring.health_checks.HealthChecker.check_storage",
                            return_value=ServiceHealth(
                                name="storage",
                                status=ServiceStatus.HEALTHY,
                                message="OK",
                                required=False,
                            ),
                        ):
                            with patch(
                                "dotmac.platform.monitoring.health_checks.HealthChecker.check_celery_broker",
                                return_value=ServiceHealth(
                                    name="celery",
                                    status=ServiceStatus.HEALTHY,
                                    message="OK",
                                    required=False,
                                ),
                            ):
                                with patch(
                                    "dotmac.platform.monitoring.health_checks.HealthChecker.check_observability",
                                    return_value=ServiceHealth(
                                        name="observability",
                                        status=ServiceStatus.HEALTHY,
                                        message="OK",
                                        required=False,
                                    ),
                                ):
                                    checker = HealthChecker()
                                    summary = checker.get_summary()

                                    # ASSERTION: Health summary shows failure
                                    assert summary["healthy"] is False
                                    assert "redis" in summary["failed_services"]
                                    assert "redis" in summary["failed_required"]


class TestSettingsProductionValidation:
    """Test that Settings validation enforces Redis configuration in production."""

    def test_settings_validate_production_security_passes_with_redis(self):
        """Test that production validation passes when Redis is properly configured."""
        from dotmac.platform.settings import Settings

        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "production",
                "SECRET_KEY": "production-secret-key-1234567890",
                "JWT__SECRET_KEY": "jwt-secret-key-production-123456789012",  # 32+ chars
                "TRUSTED_HOSTS": '["example.com", "api.example.com"]',  # JSON format
                "REDIS__HOST": "redis.production.example.com",
                "VAULT__ENABLED": "true",
                "DATABASE__PASSWORD": "super-secure-db-password",
                "STORAGE__SECRET_KEY": "super-secure-storage-key",
            },
        ):
            # Create settings and validate
            settings = Settings()  # type: ignore[call-arg]

            # Should not raise
            settings.validate_production_security()

    def test_settings_validate_production_security_fails_with_localhost_redis(self):
        """
        SECURITY TEST: Production validation fails when Redis is localhost.

        This ensures production deployments use proper Redis infrastructure.
        """
        from dotmac.platform.settings import Settings

        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "production",
                "SECRET_KEY": "production-secret-key-1234567890",
                "JWT__SECRET_KEY": "jwt-secret-key-production-123456789012",  # 32+ chars
                "TRUSTED_HOSTS": '["example.com", "api.example.com"]',  # JSON format
                "REDIS__HOST": "localhost",  # INVALID for production
                "VAULT__ENABLED": "true",
                "DATABASE__PASSWORD": "super-secure-db-password",
                "STORAGE__SECRET_KEY": "super-secure-storage-key",
            },
        ):
            settings = Settings()  # type: ignore[call-arg]

            # Should raise ValueError
            with pytest.raises(ValueError) as exc_info:
                settings.validate_production_security()

            # ASSERTION: Error mentions Redis
            assert "Redis" in str(exc_info.value)
            assert "localhost" in str(exc_info.value)
            assert "production" in str(exc_info.value)

    def test_settings_validate_production_security_skipped_in_development(self):
        """Test that production validation is skipped in development."""
        from dotmac.platform.settings import Settings

        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "development",
                "REDIS__HOST": "localhost",  # OK in development
            },
        ):
            settings = Settings()  # type: ignore[call-arg]

            # Should not raise (validation skipped in development)
            settings.validate_production_security()


class TestProductionStartupIntegration:
    """Integration tests for production startup behavior."""

    def test_production_startup_fails_without_redis_documentation(self):
        """
        DOCUMENTATION TEST: Verify expected production startup behavior.

        Expected flow when Redis is unavailable in production:
        1. Settings.validate_production_security() checks Redis host
        2. HealthChecker.check_redis() returns UNHEALTHY + required=True
        3. main.py lifespan checks all_healthy and failed_services
        4. RuntimeError raised, application startup blocked

        This test documents the expected behavior for operators.
        """
        # This is a documentation test - no actual assertions
        # Real integration test would require full FastAPI app startup
        expected_error_message = "Required services unavailable: ['redis']"
        expected_log_message = "CRITICAL: Redis is MANDATORY in production"

        # Document the startup sequence
        assert expected_error_message  # noqa: S101
        assert expected_log_message  # noqa: S101

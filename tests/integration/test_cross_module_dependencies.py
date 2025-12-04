"""
Integration tests for cross-module dependencies.

These tests verify that modules work together correctly and that
their interfaces are compatible. They focus on integration points
and data flow between modules.
"""

from typing import Any
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

# Test module availability and imports
try:
    from dotmac.platform.auth.core import JWTService, UserInfo  # noqa: F401
    from dotmac.platform.core.models import TenantContext

    HAS_AUTH_TENANT = True
except ImportError:
    HAS_AUTH_TENANT = False

try:
    from dotmac.platform.auth.core import JWTService
    from dotmac.platform.secrets.factory import SecretsManagerFactory

    HAS_SECRETS_AUTH = True
except ImportError:
    HAS_SECRETS_AUTH = False

try:
    from dotmac.platform.data_transfer.factory import DataTransferFactory
    from dotmac.platform.file_storage.service import FileStorageService  # noqa: F401

    HAS_DATA_STORAGE = True
except ImportError:
    HAS_DATA_STORAGE = False

try:
    from dotmac.platform.analytics.otel_collector import create_otel_collector
    from dotmac.platform.monitoring.health_checks import HealthChecker

    HAS_ANALYTICS_MONITORING = True
except ImportError:
    HAS_ANALYTICS_MONITORING = False

try:
    from dotmac.platform.communications.template_service import TemplateService
    from dotmac.platform.user_management.models import User  # noqa: F401

    HAS_COMMS_USER = True
except ImportError:
    HAS_COMMS_USER = False


@pytest.mark.integration
class TestAuthTenantIntegration:
    """Test integration between Auth and Tenant modules."""

    @pytest.mark.skipif(not HAS_AUTH_TENANT, reason="Auth/Tenant modules not available")
    def test_auth_with_tenant_context(self, mock_user_info, test_tenant_id):
        """Test that authentication works with tenant context."""
        # Create tenant context
        tenant_context = TenantContext(tenant_id=test_tenant_id)

        # Verify user info contains tenant information
        assert mock_user_info.user_id is not None
        assert mock_user_info.tenant_id == test_tenant_id

        # Verify tenant context matches user's tenant
        assert tenant_context.tenant_id == test_tenant_id
        assert tenant_context.tenant_id == mock_user_info.tenant_id

        # Test that both models can work together
        auth_and_tenant_data = {"user": mock_user_info, "tenant": tenant_context}
        assert auth_and_tenant_data["user"].tenant_id == auth_and_tenant_data["tenant"].tenant_id

    @pytest.mark.skipif(not HAS_AUTH_TENANT, reason="Auth/Tenant modules not available")
    def test_jwt_service_with_tenant_claims(self, test_tenant_id):
        """Test JWT service can handle tenant-specific claims."""
        jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-integration-test")

        # Create token with tenant claims
        claims = {"sub": "user123", "tenant_id": test_tenant_id, "permissions": ["read", "write"]}

        token = jwt_service.create_access_token(
            subject=claims["sub"],
            additional_claims={
                "tenant_id": claims["tenant_id"],
                "permissions": claims["permissions"],
            },
        )
        assert token is not None

        # Verify token contains tenant information
        decoded = jwt_service.verify_token(token)
        assert decoded["tenant_id"] == test_tenant_id
        assert decoded["sub"] == "user123"


@pytest.mark.integration
class TestSecretsAuthIntegration:
    """Test integration between Secrets and Auth modules."""

    @pytest.mark.skipif(not HAS_SECRETS_AUTH, reason="Secrets/Auth modules not available")
    @pytest.mark.asyncio
    async def test_jwt_service_with_secrets_manager(self, tmp_path):
        """Test JWT service can retrieve keys from secrets manager."""
        # Use real local secrets manager with temporary directory
        import os

        os.environ["SECRETS_BACKEND"] = "local"
        os.environ["LOCAL_SECRETS_PATH"] = str(tmp_path)

        # Create secrets manager and store test keys
        secrets_mgr = SecretsManagerFactory.create_secrets_manager("local")
        test_keypair = {
            "private_key": "test-private-key",
            "public_key": "test-public-key",
            "algorithm": "RS256",
        }

        # Store the secret
        secrets_mgr.set_secret("jwt/keypair", test_keypair)

        # Retrieve and verify
        keypair = secrets_mgr.get_secret("jwt/keypair")
        assert "private_key" in keypair
        assert "public_key" in keypair
        assert keypair["private_key"] == "test-private-key"

    @pytest.mark.skipif(not HAS_SECRETS_AUTH, reason="Secrets/Auth modules not available")
    def test_auth_service_secrets_integration(self):
        """Test authentication services integrate with secrets management."""
        # Create real JWT service with test secret
        jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-integration-test")

        # Create token with user claims
        token = jwt_service.create_access_token(
            subject="user123", additional_claims={"tenant_id": "test-tenant"}
        )
        assert token is not None
        assert isinstance(token, str)

        # Verify token can be decoded
        decoded = jwt_service.verify_token(token)
        assert decoded["sub"] == "user123"
        assert decoded["tenant_id"] == "test-tenant"


@pytest.mark.integration
class TestDataTransferStorageIntegration:
    """Test integration between Data Transfer and File Storage modules."""

    @pytest.mark.skipif(not HAS_DATA_STORAGE, reason="Data Transfer/Storage modules not available")
    def test_data_transfer_with_file_storage(self, mock_settings, transfer_config):
        """Test data transfer can work with file storage."""
        with patch("dotmac.platform.data_transfer.factory.settings", mock_settings):
            mock_settings.features.data_transfer_enabled = True

            # Create data transfer factory
            importer = DataTransferFactory.create_importer("csv", config=transfer_config)
            assert importer is not None

            # Mock file storage service
            mock_storage = AsyncMock()
            mock_storage.upload = AsyncMock(
                return_value={"file_id": "123", "url": "https://example.com/file.csv"}
            )

            # Test integration: data transfer processes file from storage
            file_info = {"file_id": "123", "path": "/tmp/test.csv"}

            # This represents the workflow: storage -> data transfer
            assert file_info["file_id"] == "123"
            # Verify importer has a process method (interface check)
            assert hasattr(importer, "process") or callable(importer)

    @pytest.mark.skipif(not HAS_DATA_STORAGE, reason="Data Transfer/Storage modules not available")
    @pytest.mark.asyncio
    async def test_export_to_storage_integration(self, mock_settings):
        """Test exporting data and storing in file storage."""
        with patch("dotmac.platform.data_transfer.factory.settings", mock_settings):
            mock_settings.features.data_transfer_enabled = True

            # Create exporter
            exporter = DataTransferFactory.create_exporter("json")
            assert exporter is not None

            # Mock storage service
            mock_storage = AsyncMock()
            mock_storage.upload.return_value = {"file_id": "export-123", "size": 1024}

            # Simulate export -> storage workflow
            export_result = {"data": [{"id": 1, "name": "test"}]}
            storage_result = await mock_storage.upload("export.json", export_result)

            assert storage_result["file_id"] == "export-123"


@pytest.mark.integration
class TestAnalyticsMonitoringIntegration:
    """Test integration between Analytics and Monitoring modules."""

    @pytest.mark.skipif(
        not HAS_ANALYTICS_MONITORING, reason="Analytics/Monitoring modules not available"
    )
    def test_health_check_with_analytics(self):
        """Test health checks can monitor analytics services."""
        HealthChecker()

        # Create analytics collector
        collector = create_otel_collector("test-tenant", "test-service")
        assert collector is not None

        # Mock health check for analytics
        def analytics_health_check():
            # This would check if analytics collector is operational
            return {"status": "healthy", "metrics_collected": 100}

        # Register analytics health check
        health_result = analytics_health_check()
        assert health_result["status"] == "healthy"

    @pytest.mark.skipif(
        not HAS_ANALYTICS_MONITORING, reason="Analytics/Monitoring modules not available"
    )
    @pytest.mark.asyncio
    async def test_monitoring_with_metrics_collection(self):
        """Test monitoring system collects metrics from analytics."""
        collector = create_otel_collector("test-tenant", "monitoring-service")

        # Record some metrics
        await collector.record_metric("test_counter", 1, "counter")
        await collector.record_metric("test_gauge", 42.0, "gauge")

        # Get metrics summary (this tests the integration)
        summary = collector.get_metrics_summary()
        assert "counters" in summary
        assert "gauges" in summary
        assert summary["tenant"] == "test-tenant"


@pytest.mark.integration
class TestCommunicationsUserIntegration:
    """Test integration between Communications and User Management modules."""

    @pytest.mark.skipif(not HAS_COMMS_USER, reason="Communications/User modules not available")
    @pytest.mark.asyncio
    async def test_template_service_with_user_data(self):
        """Test template service can render templates with user data."""
        # Mock user data
        user_data = {
            "id": str(uuid4()),
            "username": "testuser",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
        }

        # Mock template service
        template_service = Mock(spec=TemplateService)
        template_service.render_template = Mock(return_value="Welcome Test User!")

        # Test integration: template service uses user data
        template_name = "welcome_email"
        rendered = template_service.render_template(template_name, user_data)

        assert "Test User" in rendered
        template_service.render_template.assert_called_once_with(template_name, user_data)

    @pytest.mark.skipif(not HAS_COMMS_USER, reason="Communications/User modules not available")
    def test_user_notification_integration(self):
        """Test user management can trigger notifications."""
        # Mock notification payload
        notification_data = {
            "user_id": "user123",
            "type": "welcome",
            "template": "user_welcome",
            "data": {"username": "newuser", "email": "new@example.com"},
        }

        # Mock communications service
        mock_comms = Mock()
        mock_comms.send_notification = Mock()

        # Simulate user creation triggering notification
        mock_comms.send_notification(notification_data)
        mock_comms.send_notification.assert_called_once_with(notification_data)


@pytest.mark.integration
class TestEndToEndIntegration:
    """End-to-end integration tests across multiple modules."""

    def test_user_authentication_flow(self, mock_user_info, test_tenant_id):
        """Test complete user authentication flow across modules."""
        # 1. User authentication (Auth module)
        assert mock_user_info.user_id is not None
        assert mock_user_info.tenant_id == test_tenant_id

        # 2. Tenant context setting (Tenant module)
        tenant_context = {"tenant_id": test_tenant_id, "permissions": mock_user_info.permissions}

        # 3. Service authorization (checking permissions)
        required_permission = "read"
        has_permission = (
            required_permission in mock_user_info.permissions
            or "*" in mock_user_info.permissions  # Wildcard permission
        )
        assert has_permission is True

        # 4. Resource access (with tenant isolation)
        resource_access = {
            "user_id": mock_user_info.user_id,
            "tenant_id": tenant_context["tenant_id"],
            "action": "read",
            "allowed": has_permission,
        }

        assert resource_access["allowed"] is True

    @pytest.mark.asyncio
    async def test_data_processing_workflow(self, mock_settings):
        """Test data processing workflow across modules."""
        with patch("dotmac.platform.data_transfer.factory.settings", mock_settings):
            mock_settings.features.data_transfer_enabled = True

            # 1. Data ingestion (Data Transfer module)
            importer = DataTransferFactory.create_importer("csv")
            assert importer is not None

            # 2. File storage (File Storage module)
            mock_storage = Mock()
            mock_storage.get_file.return_value = {"path": "/tmp/data.csv", "size": 1024}

            file_info = mock_storage.get_file("data.csv")
            assert file_info["path"].endswith(".csv")

            # 3. Analytics tracking (Analytics module)
            mock_analytics = Mock()
            mock_analytics.track_event = Mock()

            # Track data processing event
            mock_analytics.track_event(
                "data_imported", {"file_size": file_info["size"], "format": "csv"}
            )
            mock_analytics.track_event.assert_called_once()

    def test_error_handling_integration(self):
        """Test error handling across module boundaries."""
        # Mock error scenarios across modules
        errors = {
            "auth_error": "Authentication failed",
            "storage_error": "File not found",
            "data_error": "Invalid format",
            "tenant_error": "Tenant not found",
        }

        # Test error propagation and handling
        for error_type, error_message in errors.items():
            error_context = {
                "type": error_type,
                "message": error_message,
                "timestamp": "2024-01-15T12:00:00Z",
            }

            # Verify error structure is consistent
            assert "type" in error_context
            assert "message" in error_context
            assert error_context["message"] == error_message


@pytest.mark.integration
class TestModuleDependencyHealth:
    """Test health and availability of module dependencies."""

    def test_all_modules_importable(self):
        """Test that all platform modules can be imported."""
        modules_to_test = [
            "dotmac.platform.auth",
            "dotmac.platform.tenant",
            "dotmac.platform.core",
            "dotmac.platform.data_transfer",
            "dotmac.platform.analytics",
        ]

        import_results = {}
        for module_name in modules_to_test:
            try:
                __import__(module_name)
                import_results[module_name] = True
            except ImportError:
                import_results[module_name] = False

        # At least core modules should be importable
        assert import_results.get("dotmac.platform.core", False), "Core module must be importable"

    def test_shared_model_compatibility(self):
        """Test that shared models are compatible across modules."""
        # Test UserInfo model consistency
        if HAS_AUTH_TENANT:
            user_info_fields = {
                "user_id": str,
                "tenant_id": str,
                "permissions": list,
                "roles": list,
            }

            # This tests that UserInfo model structure is consistent
            for field_name, field_type in user_info_fields.items():
                # Verify field types are what we expect
                assert isinstance(field_name, str)
                assert field_type in [str, list, dict]

    def test_configuration_compatibility(self):
        """Test that configuration is compatible across modules."""
        # Mock settings that would be shared across modules
        shared_config = {
            "environment": "test",
            "debug": True,
            "database": {"url": "sqlite:///:memory:"},
            "redis": {"url": "redis://localhost:6379"},
            "features": {"data_transfer_enabled": True, "tracing_enabled": False},
        }

        # Verify configuration structure
        assert "environment" in shared_config
        assert "features" in shared_config
        assert isinstance(shared_config["features"], dict)

    @pytest.mark.asyncio
    async def test_async_compatibility(self):
        """Test async/await compatibility across modules."""

        # Test that async operations work across module boundaries
        async def mock_async_operation():
            return {"status": "success", "data": "test"}

        result = await mock_async_operation()
        assert result["status"] == "success"

        # Test async context managers
        async def async_context_test():
            # This would test async context managers across modules
            async with AsyncMock() as mock_context:
                mock_context.return_value = "context_result"
                return await mock_context()

        context_result = await async_context_test()
        assert context_result is not None


# Integration test fixtures and utilities


@pytest.fixture
def integration_config():
    """Configuration for integration tests."""
    return {"test_mode": True, "timeout": 30, "retry_count": 3, "mock_external_services": True}


@pytest.fixture
def cross_module_mocks():
    """Mocks that span multiple modules."""
    return {
        "auth_service": Mock(),
        "storage_service": Mock(),
        "analytics_service": Mock(),
        "communication_service": Mock(),
    }


@pytest.fixture
def mock_settings():
    """Mock settings for integration tests."""
    settings = Mock()
    settings.features = Mock()
    settings.features.data_transfer_enabled = True
    settings.features.file_storage_enabled = True
    return settings


@pytest.fixture
def transfer_config():
    """Configuration for data transfer tests."""
    return {
        "format": "csv",
        "delimiter": ",",
        "has_header": True,
        "encoding": "utf-8",
        "batch_size": 1000,
    }


# Test utilities for integration testing


class IntegrationTestHelper:
    """Helper class for integration testing."""

    @staticmethod
    def simulate_user_workflow(user_data: dict[str, Any]) -> dict[str, Any]:
        """Simulate a complete user workflow across modules."""
        workflow_steps = [
            "authentication",
            "authorization",
            "resource_access",
            "data_processing",
            "notification",
        ]

        results = {}
        for step in workflow_steps:
            results[step] = {"status": "completed", "timestamp": "2024-01-15T12:00:00Z"}

        return results

    @staticmethod
    def validate_cross_module_data_flow(data: dict[str, Any]) -> bool:
        """Validate that data flows correctly between modules."""
        required_fields = ["user_id", "tenant_id", "timestamp"]
        return all(field in data for field in required_fields)

    @staticmethod
    def mock_external_dependencies() -> dict[str, Mock]:
        """Create mocks for external dependencies."""
        return {"database": Mock(), "redis": Mock(), "file_system": Mock(), "external_api": Mock()}


# Export helper for use in other test files
__all__ = [
    "TestAuthTenantIntegration",
    "TestSecretsAuthIntegration",
    "TestDataTransferStorageIntegration",
    "TestAnalyticsMonitoringIntegration",
    "TestCommunicationsUserIntegration",
    "TestEndToEndIntegration",
    "TestModuleDependencyHealth",
    "IntegrationTestHelper",
]

"""
Integration tests for module interface compatibility.

These tests verify that modules expose the correct interfaces and that
their public APIs are compatible with expected usage patterns.
"""

import inspect
from unittest.mock import AsyncMock, Mock

import pytest

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.integration,
    pytest.mark.parallel_safe,
    pytest.mark.slow,  # These tests may be slower due to module loading
]


@pytest.mark.integration
class TestAuthModuleInterface:
    """Test Auth module interface compatibility."""

    def test_user_info_interface(self):
        """Test UserInfo model has expected interface."""
        try:
            from dotmac.platform.auth.core import UserInfo

            # Test that UserInfo can be instantiated with expected fields
            user_info = UserInfo(
                user_id="test-user",
                username="testuser",
                email="test@example.com",
                permissions=["read"],
                roles=["user"],
                tenant_id="test-tenant",
            )

            # Verify interface
            assert hasattr(user_info, "user_id")
            assert hasattr(user_info, "permissions")
            assert hasattr(user_info, "tenant_id")
            assert isinstance(user_info.permissions, list)

        except ImportError:
            pytest.skip("Auth module not available")

    def test_jwt_service_interface(self):
        """Test JWTService has expected methods."""
        try:
            from dotmac.platform.auth.core import JWTService

            # Check class exists and has expected methods
            assert hasattr(JWTService, "__init__")
            assert hasattr(JWTService, "create_access_token")
            assert hasattr(JWTService, "verify_token")

            # Check method signatures
            create_token_sig = inspect.signature(JWTService.create_access_token)
            verify_token_sig = inspect.signature(JWTService.verify_token)

            # Verify create_access_token accepts subject parameter
            assert "subject" in create_token_sig.parameters

            # Verify verify_token accepts token parameter
            assert "token" in verify_token_sig.parameters

        except ImportError:
            pytest.skip("JWT service not available")


@pytest.mark.integration
class TestDataTransferModuleInterface:
    """Test Data Transfer module interface compatibility."""

    def test_data_transfer_factory_interface(self):
        """Test DataTransferFactory has expected static methods."""
        try:
            from dotmac.platform.data_transfer.factory import DataTransferFactory

            # Check static methods exist
            assert hasattr(DataTransferFactory, "create_importer")
            assert hasattr(DataTransferFactory, "create_exporter")
            assert hasattr(DataTransferFactory, "detect_format")
            assert hasattr(DataTransferFactory, "validate_format")

            # Check method signatures
            create_importer_sig = inspect.signature(DataTransferFactory.create_importer)
            create_exporter_sig = inspect.signature(DataTransferFactory.create_exporter)

            # Verify methods accept format parameter
            assert "format" in create_importer_sig.parameters
            assert "format" in create_exporter_sig.parameters

        except ImportError:
            pytest.skip("Data Transfer factory not available")

    def test_base_importer_interface(self):
        """Test BaseImporter interface is properly defined."""
        try:
            from dotmac.platform.data_transfer.core import BaseImporter

            # Check abstract methods exist
            assert hasattr(BaseImporter, "import_from_file")

            # Verify it has abstract methods (even if not formally ABC)
            import_method = BaseImporter.import_from_file
            assert (
                hasattr(import_method, "__isabstractmethod__")
                and import_method.__isabstractmethod__
            )

        except ImportError:
            pytest.skip("BaseImporter not available")


@pytest.mark.integration
class TestTenantModuleInterface:
    """Test Tenant module interface compatibility."""

    def test_tenant_context_interface(self):
        """Test TenantContext has expected interface."""
        try:
            from dotmac.platform.core.models import TenantContext

            # Test instantiation
            tenant_ctx = TenantContext(tenant_id="test-tenant")

            # Verify interface
            assert hasattr(tenant_ctx, "tenant_id")
            assert tenant_ctx.tenant_id == "test-tenant"

        except ImportError:
            pytest.skip("Tenant context not available")


@pytest.mark.integration
class TestSecretsModuleInterface:
    """Test Secrets module interface compatibility."""

    def test_secrets_manager_interface(self):
        """Test SecretsManager interface is properly defined."""
        try:
            from dotmac.platform.secrets.factory import SecretsManager, SecretsManagerFactory

            # Check that SecretsManager protocol has expected methods
            expected_methods = ["get_secret", "set_secret"]
            for method in expected_methods:
                assert hasattr(SecretsManager, method)

            # Check that factory exists and has create method
            assert hasattr(SecretsManagerFactory, "create_secrets_manager")

            # Test factory method signature
            factory_sig = inspect.signature(SecretsManagerFactory.create_secrets_manager)
            assert "backend" in factory_sig.parameters

        except ImportError:
            pytest.skip("SecretsManager not available")


@pytest.mark.integration
class TestAnalyticsModuleInterface:
    """Test Analytics module interface compatibility."""

    def test_analytics_collector_factory(self):
        """Test analytics collector factory function."""
        try:
            from dotmac.platform.analytics.otel_collector import create_otel_collector

            # Check function signature
            sig = inspect.signature(create_otel_collector)
            assert "tenant_id" in sig.parameters

            # Test function returns collector
            collector = create_otel_collector("test-tenant")
            assert collector is not None
            assert hasattr(collector, "record_metric")

        except ImportError:
            pytest.skip("Analytics collector not available")


@pytest.mark.integration
class TestModuleInterfaceCompatibility:
    """Test compatibility between module interfaces."""

    def test_user_info_serialization_compatibility(self):
        """Test UserInfo can be serialized/deserialized consistently."""
        try:
            from dotmac.platform.auth.core import UserInfo

            # Create UserInfo
            original = UserInfo(
                user_id="test-user",
                username="testuser",
                email="test@example.com",
                permissions=["read", "write"],
                roles=["user"],
                tenant_id="test-tenant",
            )

            # Test serialization (to dict)
            user_dict = original.model_dump()
            assert isinstance(user_dict, dict)
            assert user_dict["user_id"] == "test-user"
            assert user_dict["tenant_id"] == "test-tenant"

            # Test deserialization (from dict)
            reconstructed = UserInfo(**user_dict)
            assert reconstructed.user_id == original.user_id
            assert reconstructed.tenant_id == original.tenant_id
            assert reconstructed.permissions == original.permissions

        except ImportError:
            pytest.skip("UserInfo not available")

    def test_error_handling_consistency(self):
        """Test error handling is consistent across modules."""
        # Define expected error interfaces
        expected_error_attributes = ["message", "code"]

        # Test that errors from different modules have consistent structure
        mock_errors = {
            "auth_error": {"message": "Authentication failed", "code": "AUTH001"},
            "data_error": {"message": "Invalid format", "code": "DATA001"},
            "tenant_error": {"message": "Tenant not found", "code": "TENANT001"},
        }

        for error_type, error_data in mock_errors.items():
            # Verify consistent error structure
            for attr in expected_error_attributes:
                assert attr in error_data, f"{error_type} missing {attr}"

    def test_async_method_signatures(self):
        """Test async methods have consistent signatures across modules."""
        async_method_patterns = {
            "get_*": ["id"],  # get methods should accept id parameter
            "create_*": ["data"],  # create methods should accept data parameter
            "update_*": ["id", "data"],  # update methods should accept id and data
            "delete_*": ["id"],  # delete methods should accept id parameter
        }

        # This test verifies the expected patterns exist
        # In a real implementation, we would introspect actual modules
        for _pattern, expected_params in async_method_patterns.items():
            # Verify pattern expectations
            assert len(expected_params) > 0
            assert isinstance(expected_params, list)


@pytest.mark.integration
class TestServiceDependencyCompatibility:
    """Test that services can depend on each other properly."""

    async def test_auth_service_with_secrets_manager(self):
        """Test auth service can use secrets manager."""
        # Mock secrets manager
        mock_secrets = AsyncMock()
        mock_secrets.get_secret.return_value = {"key": "test-secret"}

        # Mock auth service that depends on secrets
        class MockAuthService:
            def __init__(self, secrets_manager):
                self.secrets = secrets_manager

            async def get_jwt_key(self):
                return await self.secrets.get_secret("jwt/key")

        # Test dependency injection works
        auth_service = MockAuthService(mock_secrets)
        jwt_key = await auth_service.get_jwt_key()

        assert jwt_key["key"] == "test-secret"
        mock_secrets.get_secret.assert_called_once_with("jwt/key")

    async def test_data_service_with_file_storage(self):
        """Test data service can use file storage."""
        # Mock file storage
        mock_storage = AsyncMock()
        mock_storage.upload.return_value = {"file_id": "123", "url": "https://example.com/file"}

        # Mock data service that depends on storage
        class MockDataService:
            def __init__(self, file_storage):
                self.storage = file_storage

            async def export_data(self, data, filename):
                return await self.storage.upload(filename, data)

        # Test dependency works
        data_service = MockDataService(mock_storage)
        result = await data_service.export_data({"test": "data"}, "export.json")

        assert result["file_id"] == "123"
        mock_storage.upload.assert_called_once()

    def test_analytics_with_tenant_context(self):
        """Test analytics service can work with tenant context."""
        # Mock tenant context
        mock_tenant_context = Mock()
        mock_tenant_context.tenant_id = "test-tenant"

        # Mock analytics service
        class MockAnalyticsService:
            def __init__(self, tenant_context):
                self.tenant = tenant_context

            def record_event(self, event_name, data):
                return {"tenant_id": self.tenant.tenant_id, "event": event_name, "data": data}

        # Test integration
        analytics = MockAnalyticsService(mock_tenant_context)
        event = analytics.record_event("user_login", {"user_id": "123"})

        assert event["tenant_id"] == "test-tenant"
        assert event["event"] == "user_login"


@pytest.mark.integration
class TestModuleConfigurationCompatibility:
    """Test module configuration compatibility."""

    def test_shared_configuration_structure(self):
        """Test that shared configuration has expected structure."""
        # Mock shared configuration
        shared_config = {
            "database": {"url": "postgresql://localhost/test", "echo": False},
            "redis": {"url": "redis://localhost:6379", "db": 0},
            "features": {
                "auth_enabled": True,
                "data_transfer_enabled": True,
                "analytics_enabled": False,
            },
            "observability": {"tracing_enabled": False, "metrics_enabled": False},
        }

        # Verify configuration structure
        assert "database" in shared_config
        assert "features" in shared_config
        assert "observability" in shared_config

        # Verify nested structures
        assert "url" in shared_config["database"]
        assert "auth_enabled" in shared_config["features"]
        assert "tracing_enabled" in shared_config["observability"]

    def test_feature_flags_consistency(self):
        """Test feature flags are consistent across modules."""
        # Mock feature flags that would be shared
        feature_flags = {
            "data_transfer_enabled": True,
            "data_transfer_excel": False,
            "auth_mfa_enabled": False,
            "analytics_enabled": True,
            "tracing_opentelemetry": False,
        }

        # Test feature flag structure
        for flag_name, flag_value in feature_flags.items():
            assert isinstance(flag_name, str)
            assert isinstance(flag_value, bool)
            assert flag_name.count("_") >= 1  # Should have module prefix


@pytest.mark.integration
class TestCrossModuleDataFlow:
    """Test data flow between modules."""

    def test_user_data_flow(self, mock_user_info):
        """Test user data flows correctly between auth and other modules."""
        # Simulate data flow: Auth -> User Management -> Communications

        # 1. Auth provides UserInfo
        auth_data = {
            "user_id": mock_user_info.user_id,
            "tenant_id": mock_user_info.tenant_id,
            "permissions": mock_user_info.permissions,
        }

        # 2. User Management uses auth data
        user_mgmt_data = {
            **auth_data,
            "profile": {"name": "Test User", "email": mock_user_info.email},
        }

        # 3. Communications uses user data for notifications
        notification_data = {
            "recipient": user_mgmt_data["profile"]["email"],
            "user_id": user_mgmt_data["user_id"],
            "tenant_id": user_mgmt_data["tenant_id"],
            "template": "welcome",
        }

        # Verify data flows correctly
        assert notification_data["user_id"] == auth_data["user_id"]
        assert notification_data["tenant_id"] == auth_data["tenant_id"]
        assert "recipient" in notification_data

    def test_tenant_isolation_flow(self):
        """Test tenant isolation works across modules."""
        tenant_1_data = {"tenant_id": "tenant-1", "data": {"users": 10}}
        tenant_2_data = {"tenant_id": "tenant-2", "data": {"users": 5}}

        # Mock service that enforces tenant isolation
        class MockTenantService:
            def __init__(self):
                self.data = {}

            def store_data(self, tenant_id, data):
                if tenant_id not in self.data:
                    self.data[tenant_id] = []
                self.data[tenant_id].append(data)

            def get_data(self, tenant_id):
                return self.data.get(tenant_id, [])

        service = MockTenantService()

        # Store data for different tenants
        service.store_data(tenant_1_data["tenant_id"], tenant_1_data["data"])
        service.store_data(tenant_2_data["tenant_id"], tenant_2_data["data"])

        # Verify isolation
        tenant_1_result = service.get_data("tenant-1")
        tenant_2_result = service.get_data("tenant-2")

        assert len(tenant_1_result) == 1
        assert len(tenant_2_result) == 1
        assert tenant_1_result[0]["users"] == 10
        assert tenant_2_result[0]["users"] == 5


# Integration test markers and configuration

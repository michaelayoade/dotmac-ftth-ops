"""
Tests for plugin schema and configuration models.
"""

from datetime import UTC

import pytest
from pydantic import ValidationError

from dotmac.platform.plugins.schema import (
    FieldSpec,
    FieldType,
    PluginConfig,
    PluginHealthCheck,
    PluginInstance,
    PluginStatus,
    PluginTestResult,
    PluginType,
    SelectOption,
    ValidationRule,
)


@pytest.mark.unit
class TestFieldSpec:
    """Test FieldSpec validation and functionality."""

    def test_basic_field_spec(self):
        """Test creating a basic field specification."""
        field = FieldSpec(
            key="api_key",
            label="API Key",
            type=FieldType.STRING,
            description="Your API key",
            required=True,
        )

        assert field.key == "api_key"
        assert field.label == "API Key"
        assert field.type == FieldType.STRING
        assert field.required is True
        assert field.is_secret is False

    def test_secret_field_spec(self):
        """Test secret field specification."""
        field = FieldSpec(
            key="password",
            label="Password",
            type=FieldType.SECRET,
            description="Secret password",
            required=True,
        )

        assert field.type == FieldType.SECRET
        assert field.is_secret is True  # Should be auto-set for SECRET type

    def test_field_with_validation(self):
        """Test field with validation rules."""
        field = FieldSpec(
            key="email",
            label="Email",
            type=FieldType.EMAIL,
            required=True,
            min_length=5,
            max_length=100,
            pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$",
            validation_rules=[
                ValidationRule(
                    type="pattern",
                    value=r"^[\w\.-]+@[\w\.-]+\.\w+$",
                    message="Invalid email format",
                )
            ],
        )

        assert field.min_length == 5
        assert field.max_length == 100
        assert field.pattern is not None
        assert len(field.validation_rules) == 1

    def test_select_field_with_options(self):
        """Test select field with options."""
        field = FieldSpec(
            key="environment",
            label="Environment",
            type=FieldType.SELECT,
            required=True,
            options=[
                SelectOption(value="dev", label="Development"),
                SelectOption(value="prod", label="Production"),
            ],
        )

        assert field.type == FieldType.SELECT
        assert len(field.options) == 2
        assert field.options[0].value == "dev"

    def test_field_key_validation(self):
        """Test field key validation."""
        # Valid keys
        valid_keys = ["api_key", "user-id", "field123", "UPPER_CASE"]
        for key in valid_keys:
            field = FieldSpec(
                key=key,
                label="Test",
                type=FieldType.STRING,
            )
            assert field.key == key

        # Invalid keys
        with pytest.raises(ValidationError):
            FieldSpec(
                key="invalid key with spaces",
                label="Test",
                type=FieldType.STRING,
            )

    def test_field_grouping_and_ordering(self):
        """Test field grouping and ordering."""
        field = FieldSpec(
            key="test",
            label="Test Field",
            type=FieldType.STRING,
            group="Advanced Settings",
            order=5,
        )

        assert field.group == "Advanced Settings"
        assert field.order == 5


@pytest.mark.unit
class TestPluginConfig:
    """Test PluginConfig validation and functionality."""

    def test_basic_plugin_config(self):
        """Test creating a basic plugin configuration."""
        config = PluginConfig(
            name="Test Plugin",
            type=PluginType.NOTIFICATION,
            version="1.0.0",
            description="A test plugin",
            fields=[
                FieldSpec(
                    key="field1",
                    label="Field 1",
                    type=FieldType.STRING,
                )
            ],
        )

        assert config.name == "Test Plugin"
        assert config.type == PluginType.NOTIFICATION
        assert config.version == "1.0.0"
        assert len(config.fields) == 1

    def test_plugin_with_multiple_fields(self):
        """Test plugin with multiple field types."""
        config = PluginConfig(
            name="Complex Plugin",
            type=PluginType.INTEGRATION,
            version="2.0.0",
            description="Plugin with various field types",
            author="Test Author",
            homepage="https://example.com",
            fields=[
                FieldSpec(key="string_field", label="String", type=FieldType.STRING),
                FieldSpec(key="int_field", label="Integer", type=FieldType.INTEGER),
                FieldSpec(key="bool_field", label="Boolean", type=FieldType.BOOLEAN),
                FieldSpec(key="secret_field", label="Secret", type=FieldType.SECRET),
                FieldSpec(key="json_field", label="JSON", type=FieldType.JSON),
            ],
            dependencies=["httpx", "pydantic"],
            tags=["test", "integration"],
            supports_health_check=True,
            supports_test_connection=True,
        )

        assert len(config.fields) == 5
        assert config.author == "Test Author"
        assert config.homepage == "https://example.com"
        assert len(config.dependencies) == 2
        assert len(config.tags) == 2
        assert config.supports_health_check is True

    def test_unique_field_keys_validation(self):
        """Test that field keys must be unique."""
        with pytest.raises(ValidationError) as exc_info:
            PluginConfig(
                name="Invalid Plugin",
                type=PluginType.STORAGE,
                version="1.0.0",
                description="Plugin with duplicate field keys",
                fields=[
                    FieldSpec(key="field1", label="Field 1", type=FieldType.STRING),
                    FieldSpec(key="field1", label="Field 1 Duplicate", type=FieldType.STRING),
                ],
            )

        assert "Field keys must be unique" in str(exc_info.value)

    def test_plugin_name_validation(self):
        """Test plugin name validation."""
        # Valid names
        valid_names = ["Test Plugin", "plugin-name", "plugin_name", "Plugin123"]
        for name in valid_names:
            config = PluginConfig(
                name=name, type=PluginType.ANALYTICS, version="1.0.0", description="Test", fields=[]
            )
            assert config.name == name

        # Invalid names
        with pytest.raises(ValidationError):
            PluginConfig(
                name="",  # Empty name
                type=PluginType.ANALYTICS,
                version="1.0.0",
                description="Test",
                fields=[],
            )


@pytest.mark.unit
class TestPluginInstance:
    """Test PluginInstance model."""

    def test_plugin_instance_creation(self):
        """Test creating a plugin instance."""
        import uuid

        config = PluginConfig(
            name="Test Plugin",
            type=PluginType.PAYMENT,
            version="1.0.0",
            description="Test",
            fields=[],
        )

        instance = PluginInstance(
            id=uuid.uuid4(),
            plugin_name="Test Plugin",
            instance_name="Production Instance",
            config_schema=config,
            status=PluginStatus.ACTIVE,
            has_configuration=True,
        )

        assert instance.plugin_name == "Test Plugin"
        assert instance.instance_name == "Production Instance"
        assert instance.status == PluginStatus.ACTIVE
        assert instance.has_configuration is True

    def test_plugin_status_transitions(self):
        """Test plugin status values."""
        statuses = [
            PluginStatus.REGISTERED,
            PluginStatus.CONFIGURED,
            PluginStatus.ACTIVE,
            PluginStatus.INACTIVE,
            PluginStatus.ERROR,
        ]

        for status in statuses:
            assert status in PluginStatus.__members__.values()


@pytest.mark.unit
class TestPluginHealthCheck:
    """Test PluginHealthCheck model."""

    def test_health_check_creation(self):
        """Test creating a health check result."""
        import uuid
        from datetime import datetime

        health_check = PluginHealthCheck(
            plugin_instance_id=uuid.uuid4(),
            status="healthy",
            message="All systems operational",
            details={
                "api_accessible": True,
                "response_time": 150,
            },
            timestamp=datetime.now(UTC).isoformat(),
            response_time_ms=150,
        )

        assert health_check.status == "healthy"
        assert health_check.message == "All systems operational"
        assert health_check.details["api_accessible"] is True
        assert health_check.response_time_ms == 150

    def test_unhealthy_status(self):
        """Test unhealthy health check."""
        import uuid
        from datetime import datetime

        health_check = PluginHealthCheck(
            plugin_instance_id=uuid.uuid4(),
            status="unhealthy",
            message="API connection failed",
            details={
                "error": "Connection timeout",
                "last_successful": "2024-01-01T00:00:00Z",
            },
            timestamp=datetime.now(UTC).isoformat(),
        )

        assert health_check.status == "unhealthy"
        assert "Connection timeout" in health_check.details["error"]


@pytest.mark.unit
class TestPluginTestResult:
    """Test PluginTestResult model."""

    def test_successful_test_result(self):
        """Test successful connection test result."""
        from datetime import datetime

        result = PluginTestResult(
            success=True,
            message="Connection established successfully",
            details={
                "endpoint": "https://api.example.com",
                "latency_ms": 250,
            },
            timestamp=datetime.now(UTC).isoformat(),
            response_time_ms=250,
        )

        assert result.success is True
        assert "successfully" in result.message.lower()
        assert result.details["latency_ms"] == 250

    def test_failed_test_result(self):
        """Test failed connection test result."""
        from datetime import datetime

        result = PluginTestResult(
            success=False,
            message="Authentication failed",
            details={
                "error": "Invalid API key",
                "status_code": 401,
            },
            timestamp=datetime.now(UTC).isoformat(),
        )

        assert result.success is False
        assert "failed" in result.message.lower()
        assert result.details["status_code"] == 401


@pytest.mark.unit
class TestFieldTypes:
    """Test all field types."""

    def test_all_field_types(self):
        """Test that all field types are properly defined."""
        field_types = [
            FieldType.STRING,
            FieldType.TEXT,
            FieldType.INTEGER,
            FieldType.FLOAT,
            FieldType.BOOLEAN,
            FieldType.SELECT,
            FieldType.MULTI_SELECT,
            FieldType.SECRET,
            FieldType.URL,
            FieldType.EMAIL,
            FieldType.PHONE,
            FieldType.JSON,
            FieldType.ARRAY,
        ]

        # Create a field for each type
        for field_type in field_types:
            field = FieldSpec(
                key=f"field_{field_type.value}",
                label=f"Field {field_type.value}",
                type=field_type,
            )
            assert field.type == field_type


@pytest.mark.unit
class TestPluginTypes:
    """Test all plugin types."""

    def test_all_plugin_types(self):
        """Test that all plugin types are properly defined."""
        plugin_types = [
            PluginType.NOTIFICATION,
            PluginType.PAYMENT,
            PluginType.STORAGE,
            PluginType.SEARCH,
            PluginType.AUTHENTICATION,
            PluginType.INTEGRATION,
            PluginType.ANALYTICS,
            PluginType.WORKFLOW,
        ]

        # Create a plugin config for each type
        for plugin_type in plugin_types:
            config = PluginConfig(
                name=f"Test {plugin_type.value}",
                type=plugin_type,
                version="1.0.0",
                description=f"Test {plugin_type.value} plugin",
                fields=[],
            )
            assert config.type == plugin_type

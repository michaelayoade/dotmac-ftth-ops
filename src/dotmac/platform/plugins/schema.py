"""
Plugin configuration schema definitions.

This module defines the structures for plugin configuration schemas,
allowing plugins to describe their configuration requirements dynamically.
"""

from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FieldType(str, Enum):
    """Supported field types for plugin configuration."""

    STRING = "string"
    TEXT = "text"  # Multi-line string
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    SECRET = "secret"  # Write-only sensitive data
    URL = "url"
    EMAIL = "email"
    PHONE = "phone"
    JSON = "json"
    ARRAY = "array"


class ValidationRule(BaseModel):  # BaseModel resolves to Any in isolation
    """Validation rule for a field."""

    model_config = ConfigDict()

    type: str = Field(description="Type of validation rule")
    value: Any = Field(description="Validation parameter")
    message: str | None = Field(None, description="Custom error message")


class SelectOption(BaseModel):  # BaseModel resolves to Any in isolation
    """Option for select fields."""

    model_config = ConfigDict()

    value: str = Field(description="Option value")
    label: str = Field(description="Display label")
    description: str | None = Field(None, description="Option description")


class FieldSpec(BaseModel):  # BaseModel resolves to Any in isolation
    """Specification for a configuration field."""

    model_config = ConfigDict()

    key: str = Field(description="Field identifier")
    label: str = Field(description="Display label")
    type: FieldType = Field(description="Field type")
    description: str | None = Field(None, description="Field description")
    required: bool = Field(False, description="Whether field is required")
    default: Any = Field(None, description="Default value")

    # Validation
    validation_rules: list[ValidationRule] = Field(
        default_factory=list, description="Validation rules"
    )
    min_length: int | None = Field(None, description="Minimum string length")
    max_length: int | None = Field(None, description="Maximum string length")
    min_value: int | float | None = Field(None, description="Minimum numeric value")
    max_value: int | float | None = Field(None, description="Maximum numeric value")
    pattern: str | None = Field(None, description="Regex pattern for validation")

    # Select field options
    options: list[SelectOption] = Field(
        default_factory=list, description="Options for select fields"
    )

    # UI hints
    placeholder: str | None = Field(None, description="Placeholder text")
    help_text: str | None = Field(None, description="Help text")
    group: str | None = Field(None, description="Field group for organization")
    order: int = Field(0, description="Display order within group")

    # Secret field properties
    is_secret: bool = Field(False, description="Whether field contains sensitive data")

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        """Validate field key format."""
        if not v or not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Field key must be alphanumeric with underscores/hyphens")
        return v

    def __init__(self, **data: Any) -> None:
        """Initialize field spec and auto-set is_secret for SECRET type."""
        # Auto-set is_secret for SECRET field type
        if data.get("type") == FieldType.SECRET and "is_secret" not in data:
            data["is_secret"] = True
        super().__init__(**data)


class PluginType(str, Enum):
    """Types of plugins supported by the system."""

    NOTIFICATION = "notification"
    PAYMENT = "payment"
    STORAGE = "storage"
    SEARCH = "search"
    AUTHENTICATION = "authentication"
    INTEGRATION = "integration"
    ANALYTICS = "analytics"
    WORKFLOW = "workflow"


class PluginStatus(str, Enum):
    """Plugin status states."""

    REGISTERED = "registered"
    CONFIGURED = "configured"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


class PluginConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """Plugin configuration schema."""

    model_config = ConfigDict()

    name: str = Field(description="Plugin name")
    type: PluginType = Field(description="Plugin type")
    version: str = Field(description="Plugin version")
    description: str = Field(description="Plugin description")
    author: str | None = Field(None, description="Plugin author")
    homepage: str | None = Field(None, description="Plugin homepage URL")

    # Configuration fields
    fields: list[FieldSpec] = Field(description="Configuration field specifications")

    # Plugin metadata
    dependencies: list[str] = Field(default_factory=list, description="Required dependencies")
    tags: list[str] = Field(default_factory=list, description="Plugin tags")

    # Feature flags
    supports_health_check: bool = Field(True, description="Whether plugin supports health checks")
    supports_test_connection: bool = Field(
        True, description="Whether plugin supports connection testing"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate plugin name format."""
        if not v or not v.replace("_", "").replace("-", "").replace(" ", "").isalnum():
            raise ValueError(
                "Plugin name must be alphanumeric with spaces, underscores, or hyphens"
            )
        return v

    @field_validator("fields")
    @classmethod
    def validate_unique_field_keys(cls, v: list[FieldSpec]) -> list[FieldSpec]:
        """Ensure field keys are unique."""
        keys = [field.key for field in v]
        if len(keys) != len(set(keys)):
            raise ValueError("Field keys must be unique")
        return v


class PluginInstance(BaseModel):  # BaseModel resolves to Any in isolation
    """Instance of a registered plugin."""

    model_config = ConfigDict()

    id: UUID = Field(description="Plugin instance ID")
    plugin_name: str = Field(description="Plugin name")
    instance_name: str = Field(description="Instance name (for multiple instances)")
    config_schema: PluginConfig = Field(description="Plugin configuration schema")

    # Current state
    status: PluginStatus = Field(PluginStatus.REGISTERED, description="Current plugin status")
    last_health_check: str | None = Field(None, description="Last health check timestamp")
    last_error: str | None = Field(None, description="Last error message")

    # Configuration (values are stored separately in secure storage)
    has_configuration: bool = Field(False, description="Whether plugin has been configured")
    configuration_version: str | None = Field(None, description="Configuration version/hash")


class PluginConfigurationValue(BaseModel):  # BaseModel resolves to Any in isolation
    """Plugin configuration field value."""

    model_config = ConfigDict()

    plugin_instance_id: UUID = Field(description="Plugin instance ID")
    field_key: str = Field(description="Field identifier")
    value: Any = Field(description="Field value (None for secrets)")
    is_secret: bool = Field(False, description="Whether value is stored in secrets manager")
    masked: bool = Field(False, description="Whether value should be masked in responses")

    # Metadata
    created_at: str = Field(description="When value was set")
    updated_at: str = Field(description="When value was last updated")


class PluginHealthCheck(BaseModel):  # BaseModel resolves to Any in isolation
    """Plugin health check result."""

    model_config = ConfigDict()

    plugin_instance_id: UUID = Field(description="Plugin instance ID")
    status: str = Field(description="Health status (healthy/unhealthy/unknown)")
    message: str | None = Field(None, description="Status message")
    details: dict[str, Any] = Field(default_factory=dict, description="Additional details")
    timestamp: str = Field(description="Check timestamp")
    response_time_ms: int | None = Field(None, description="Response time in milliseconds")


class PluginTestResult(BaseModel):  # BaseModel resolves to Any in isolation
    """Plugin connection test result."""

    model_config = ConfigDict()

    success: bool = Field(description="Whether test was successful")
    message: str = Field(description="Test result message")
    details: dict[str, Any] = Field(default_factory=dict, description="Test details")
    timestamp: str = Field(description="Test timestamp")
    response_time_ms: int | None = Field(None, description="Response time in milliseconds")


# API Response Models


class PluginConfigurationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for plugin configuration."""

    model_config = ConfigDict()

    plugin_instance_id: UUID = Field(description="Plugin instance ID")
    configuration: dict[str, Any] = Field(description="Configuration values (secrets masked)")
    config_schema: PluginConfig = Field(description="Configuration schema", alias="schema")
    status: PluginStatus = Field(description="Plugin status")
    last_updated: str | None = Field(None, description="Last configuration update")


class PluginListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for plugin list."""

    model_config = ConfigDict()

    plugins: list[PluginInstance] = Field(description="Registered plugin instances")
    total: int = Field(description="Total number of plugins")


class PluginSchemaResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for plugin schema."""

    model_config = ConfigDict()

    config_schema: PluginConfig = Field(description="Plugin configuration schema", alias="schema")
    instance_id: UUID | None = Field(None, description="Plugin instance ID if configured")

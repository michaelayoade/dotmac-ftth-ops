"""
Plugin system for DotMac Platform Services.

This package provides a dynamic plugin system that allows plugins to:
- Register their own configuration schemas
- Have UI forms auto-generated from schemas
- Store sensitive configuration in Vault
- Provide health checks and connection tests

Provider Types:
- NotificationProvider: Email, SMS, push notifications
- PaymentProvider: Payment processing integrations
- StorageProvider: File storage backends
- SearchProvider: Search engine integrations
- AuthenticationProvider: External auth providers
- IntegrationProvider: General integrations
- AnalyticsProvider: Analytics and tracking
- WorkflowProvider: Workflow automation
- AlertDeliveryProvider: Network monitoring alert delivery
"""

from .interfaces import (
    AlertDeliveryProvider,
    AnalyticsProvider,
    AuthenticationProvider,
    IntegrationProvider,
    NotificationProvider,
    PaymentProvider,
    PluginInterface,
    PluginProvider,
    SearchProvider,
    StorageProvider,
    WorkflowProvider,
)
from .registry import PluginRegistry, get_plugin_registry
from .schema import (
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

__all__ = [
    # Schema types
    "FieldSpec",
    "FieldType",
    "PluginConfig",
    "PluginInstance",
    "PluginStatus",
    "PluginType",
    "PluginHealthCheck",
    "PluginTestResult",
    "SelectOption",
    "ValidationRule",
    # Core components
    "PluginRegistry",
    "get_plugin_registry",
    "PluginProvider",
    "PluginInterface",
    # Provider interfaces
    "AlertDeliveryProvider",
    "AnalyticsProvider",
    "AuthenticationProvider",
    "IntegrationProvider",
    "NotificationProvider",
    "PaymentProvider",
    "SearchProvider",
    "StorageProvider",
    "WorkflowProvider",
]

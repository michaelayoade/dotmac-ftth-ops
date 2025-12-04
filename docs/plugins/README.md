# Dynamic Plugin System Developer Guide

The DotMac Platform Services includes a powerful dynamic plugin system that automatically generates configuration UI forms from plugin schemas. This eliminates the need to hand-code settings pages for every new plugin.

## 🎯 Key Features

- **Dynamic Configuration Forms**: Plugins describe their own configuration schema, UI renders forms automatically
- **Secure Secret Management**: Secret fields are automatically stored in Vault
- **Health Checks**: Built-in health monitoring for plugin instances
- **Connection Testing**: Test configurations before saving
- **Multiple Plugin Types**: Support for notifications, payments, storage, search, and more

## 🚀 Quick Start

### 1. Create Your Plugin

Create a new Python file in the `plugins/` directory or `src/dotmac/platform/plugins/builtin/`:

```python
"""
My Custom Plugin.

Example: Slack notification plugin.
"""

from typing import Any, Dict, Optional
from ..interfaces import NotificationProvider
from ..schema import (
    FieldSpec, FieldType, PluginConfig, PluginType,
    PluginHealthCheck, PluginTestResult
)

class SlackProvider(NotificationProvider):
    """Slack notification provider."""

    def __init__(self):
        self.webhook_url: Optional[str] = None
        self.channel: Optional[str] = None
        self.configured = False

    def get_config_schema(self) -> PluginConfig:
        """Define the plugin configuration schema."""
        return PluginConfig(
            name="Slack",
            type=PluginType.NOTIFICATION,
            version="1.0.0",
            description="Send notifications to Slack channels via webhooks",
            author="Your Company",
            homepage="https://slack.com/api",
            fields=[
                FieldSpec(
                    key="webhook_url",
                    label="Webhook URL",
                    type=FieldType.SECRET,
                    description="Slack webhook URL for posting messages",
                    required=True,
                    is_secret=True,
                    help_text="Get this from your Slack app settings",
                    group="Basic Configuration",
                    order=1,
                ),
                FieldSpec(
                    key="channel",
                    label="Default Channel",
                    type=FieldType.STRING,
                    description="Default channel to post messages",
                    required=True,
                    placeholder="#general",
                    group="Basic Configuration",
                    order=2,
                ),
                FieldSpec(
                    key="username",
                    label="Bot Username",
                    type=FieldType.STRING,
                    description="Display name for the bot",
                    required=False,
                    default="DotMac Bot",
                    group="Appearance",
                    order=1,
                ),
            ],
        )

    async def configure(self, config: Dict[str, Any]) -> bool:
        """Configure the plugin with settings."""
        try:
            self.webhook_url = config.get("webhook_url")
            self.channel = config.get("channel")

            if not self.webhook_url:
                raise ValueError("Webhook URL is required")

            self.configured = True
            return True
        except Exception:
            self.configured = False
            return False

    async def send_notification(
        self, recipient: str, message: str, subject: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send notification to Slack."""
        # Implementation here
        pass

    async def health_check(self) -> PluginHealthCheck:
        """Check plugin health."""
        # Implementation here
        pass

    async def test_connection(self, config: Dict[str, Any]) -> PluginTestResult:
        """Test connection with provided config."""
        # Implementation here
        pass

def register() -> SlackProvider:
    """Register the plugin."""
    return SlackProvider()
```

### 2. Plugin Discovery

The system automatically discovers plugins from:

- `plugins/` directory (local plugins)
- `src/dotmac/platform/plugins/builtin/` (built-in plugins)
- Additional paths configured in settings

## 📋 Configuration Schema

### Field Types

The system supports various field types with automatic UI rendering:

| Type | UI Component | Description |
|------|-------------|-------------|
| `STRING` | Text input | Single-line text |
| `TEXT` | Textarea | Multi-line text |
| `INTEGER` | Number input | Integer values |
| `FLOAT` | Number input | Decimal values |
| `BOOLEAN` | Toggle/Checkbox | True/false values |
| `SELECT` | Dropdown | Single selection |
| `MULTI_SELECT` | Multi-select | Multiple selections |
| `SECRET` | Password input | Write-only sensitive data |
| `URL` | URL input | Web addresses |
| `EMAIL` | Email input | Email addresses |
| `PHONE` | Phone input | Phone numbers |
| `JSON` | JSON editor | JSON objects |
| `ARRAY` | List editor | Arrays of values |

### Field Specifications

```python
FieldSpec(
    key="api_key",                    # Unique field identifier
    label="API Key",                  # Display label
    type=FieldType.SECRET,           # Field type
    description="Your API key",       # Help description
    required=True,                   # Whether required
    default="default_value",         # Default value

    # Validation
    min_length=10,                   # Minimum length
    max_length=100,                  # Maximum length
    pattern=r"^[A-Z0-9]+$",         # Regex pattern
    validation_rules=[               # Custom validation rules
        ValidationRule(
            type="pattern",
            value=r"^sk-",
            message="API key must start with 'sk-'"
        )
    ],

    # UI Configuration
    placeholder="Enter your API key",  # Placeholder text
    help_text="Find this in your dashboard", # Help text
    group="Authentication",            # Field group
    order=1,                          # Display order

    # For SELECT fields
    options=[
        SelectOption(value="prod", label="Production"),
        SelectOption(value="test", label="Test Environment")
    ]
)
```

### Plugin Configuration

```python
PluginConfig(
    name="My Plugin",
    type=PluginType.NOTIFICATION,    # Plugin category
    version="1.0.0",
    description="Plugin description",
    author="Your Name",
    homepage="https://plugin-docs.com",

    fields=[...],                    # Field specifications

    # Optional metadata
    dependencies=["httpx", "pydantic"],
    tags=["messaging", "api"],
    supports_health_check=True,
    supports_test_connection=True,
)
```

## 🔌 Plugin Types & Interfaces

### Available Plugin Types

- `NOTIFICATION` - Notification providers (email, SMS, chat)
- `PAYMENT` - Payment processors
- `STORAGE` - File storage providers
- `SEARCH` - Search engines
- `AUTHENTICATION` - Auth providers
- `INTEGRATION` - General integrations
- `ANALYTICS` - Analytics services
- `WORKFLOW` - Workflow engines

### Base Interfaces

Each plugin type has a corresponding base class to inherit from:

```python
# Notification plugin
class MyNotificationProvider(NotificationProvider):
    async def send_notification(self, recipient: str, message: str,
                              subject: Optional[str] = None,
                              metadata: Optional[Dict[str, Any]] = None) -> bool:
        pass

# Payment plugin
class MyPaymentProvider(PaymentProvider):
    async def process_payment(self, amount: float, currency: str,
                            payment_method: str,
                            metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        pass

# Storage plugin
class MyStorageProvider(StorageProvider):
    async def store_file(self, key: str, content: bytes,
                        metadata: Optional[Dict[str, Any]] = None) -> str:
        pass
```

## 🔒 Secret Management

Secret fields are automatically handled by the system:

1. **Definition**: Mark fields as secrets using `FieldType.SECRET` or `is_secret=True`
2. **Storage**: Secrets are stored in Vault, never in the database
3. **UI**: Secret fields show as password inputs, existing values show as "masked"
4. **API**: Secret values are never returned in API responses

```python
FieldSpec(
    key="api_token",
    label="API Token",
    type=FieldType.SECRET,     # Automatically secret
    required=True,
    is_secret=True,           # Explicitly mark as secret
)
```

## 🏥 Health Checks & Testing

### Health Checks

Implement health checks to monitor plugin status:

```python
async def health_check(self) -> PluginHealthCheck:
    try:
        # Test service connectivity
        response = await self.api_client.get("/health")

        return PluginHealthCheck(
            plugin_instance_id="",  # Filled by system
            status="healthy",
            message="Service is responsive",
            details={
                "api_version": "v2.1",
                "last_request": "2023-12-01T10:30:00Z"
            },
            timestamp="",  # Filled by system
        )
    except Exception as e:
        return PluginHealthCheck(
            plugin_instance_id="",
            status="unhealthy",
            message=f"Service unreachable: {str(e)}",
            details={"error": str(e)},
            timestamp="",
        )
```

### Connection Testing

Allow testing configurations before saving:

```python
async def test_connection(self, config: Dict[str, Any]) -> PluginTestResult:
    try:
        # Test with provided configuration
        api_key = config.get("api_key")
        endpoint = config.get("endpoint")

        # Attempt connection
        client = self.create_client(api_key, endpoint)
        await client.test_connection()

        return PluginTestResult(
            success=True,
            message="Connection successful",
            details={"endpoint": endpoint, "authenticated": True},
            timestamp="",
        )
    except Exception as e:
        return PluginTestResult(
            success=False,
            message=f"Connection failed: {str(e)}",
            details={"error": str(e)},
            timestamp="",
        )
```

## 🌐 REST API Endpoints

The plugin system exposes these endpoints:

### List Available Plugins
```http
GET /api/v1/plugins/
```
Returns all registered plugins with their schemas.

### Get Plugin Schema
```http
GET /api/v1/plugins/{plugin_name}/schema
```
Returns detailed schema for a specific plugin.

### Create Plugin Instance
```http
POST /api/v1/plugins/instances
Content-Type: application/json

{
  "plugin_name": "WhatsApp Business",
  "instance_name": "Production WhatsApp",
  "configuration": {
    "phone_number": "+1234567890",
    "api_token": "secret_token_here",
    "business_account_id": "123456789"
  }
}
```

### Get Plugin Configuration
```http
GET /api/v1/plugins/instances/{instance_id}/configuration
```
Returns configuration with secrets masked.

### Test Connection
```http
POST /api/v1/plugins/instances/{instance_id}/test
Content-Type: application/json

{
  "configuration": {
    "api_token": "new_token_to_test"
  }
}
```

### Health Check
```http
GET /api/v1/plugins/instances/{instance_id}/health
```
Returns current plugin health status.

## 🎨 UI Auto-Generation

The frontend automatically renders forms based on the plugin schema:

1. **Field Types**: Each `FieldType` maps to appropriate UI components
2. **Validation**: Client-side validation based on field specs
3. **Grouping**: Fields are grouped by the `group` property
4. **Ordering**: Fields are ordered by the `order` property
5. **Secrets**: Secret fields show as password inputs with masked display
6. **Help Text**: Descriptions and help text are displayed as tooltips

Example UI rendering for WhatsApp plugin:

```
┌─ Basic Configuration ────────────────────┐
│ Business Phone Number (required)         │
│ ┌─────────────────────────────────────┐  │
│ │ +1234567890                         │  │
│ └─────────────────────────────────────┘  │
│ ℹ️ Your verified WhatsApp Business number│
│                                          │
│ API Access Token (required)              │
│ ┌─────────────────────────────────────┐  │
│ │ ••••••••••••••••••••••••••••••••   │  │
│ └─────────────────────────────────────┘  │
│ ℹ️ Generate from Meta for Developers     │
└──────────────────────────────────────────┘

┌─ Environment ────────────────────────────┐
│ ☑️ Sandbox Mode                          │
│ ℹ️ Enable for testing, disable for prod  │
│                                          │
│ API Version                              │
│ ┌─────────────────────────────────────┐  │
│ │ v18.0 (Latest) ▼                   │  │
│ └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘

[Test Connection] [Save Configuration]
```

## 🔄 Plugin Lifecycle

1. **Discovery**: System scans plugin directories on startup
2. **Registration**: Plugins register with their schemas
3. **Configuration**: Admin configures plugin instances via UI
4. **Validation**: System validates config against schema
5. **Secret Storage**: Secrets automatically stored in Vault
6. **Activation**: Plugin provider is configured and activated
7. **Monitoring**: Health checks monitor plugin status
8. **Updates**: Configuration can be updated with automatic reconfiguration

## 📦 Example: Complete WhatsApp Plugin

See `src/dotmac/platform/plugins/builtin/whatsapp_plugin.py` for a complete working example that demonstrates:

- Complex field types and validation
- Secret management
- Health checks and connection testing
- Error handling
- Grouped configuration fields
- Real-world API integration

This plugin showcases how the system can handle sophisticated integrations with just schema definitions - no custom UI code required!

## 🛠️ Best Practices

1. **Schema Design**: Use clear labels, helpful descriptions, and logical grouping
2. **Validation**: Implement both client-side (schema) and server-side validation
3. **Error Handling**: Provide meaningful error messages in health checks and tests
4. **Security**: Always mark sensitive fields as secrets
5. **Documentation**: Include comprehensive help text and examples
6. **Testing**: Implement robust connection testing for better UX

## 🚀 Deployment

Plugins are automatically discovered and loaded:

1. Place plugin files in the `plugins/` directory
2. Restart the application
3. Plugins appear in the admin UI automatically
4. No additional deployment steps required

The dynamic plugin system makes it easy to extend the platform with new integrations while maintaining a consistent, auto-generated UI experience.
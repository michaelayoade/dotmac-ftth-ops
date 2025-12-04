# Plugin System Documentation

The DotMac Platform Services plugin system allows dynamic extension of the platform without modifying core code.

## Documentation Index

- [Plugin Development Guide](./README.md) - Complete guide for developing plugins
- [API Reference](#) - Coming soon
- [Examples](#) - Coming soon

## Quick Links

- **Getting Started**: See the [Plugin Development Guide](./README.md#getting-started)
- **Plugin Types**: Learn about [different plugin types](./README.md#plugin-types)
- **Configuration Schema**: Understanding [plugin configuration](./README.md#configuration-schema)
- **WhatsApp Example**: See a [complete example](./README.md#example-whatsapp-business-api-plugin)

## Key Features

- ✅ Dynamic plugin discovery and loading
- ✅ Auto-generated configuration UI from schemas
- ✅ Secure secret management with Vault/OpenBao
- ✅ Health checks and connection testing
- ✅ REST API for plugin management
- ✅ Multiple plugin instances support
- ✅ 13 field types with validation
- ✅ Comprehensive test coverage

## Plugin Router Authentication

The plugin management API is now properly secured with authentication. All endpoints require a valid JWT token and use the platform's standard authentication flow.
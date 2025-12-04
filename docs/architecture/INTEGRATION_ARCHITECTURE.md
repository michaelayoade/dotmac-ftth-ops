# Integration Architecture Guide

This document explains how to implement external service integrations in the DotMac platform using the unified config manager, settings, and secrets system.

## Architecture Overview

The DotMac platform uses a **layered integration architecture** that provides:

1. **Configuration Management** - Feature flags and service settings
2. **Secrets Management** - Secure credential storage via Vault
3. **Provider Pattern** - Pluggable service implementations
4. **Factory Pattern** - Dynamic integration instantiation
5. **Health Monitoring** - Integration status and observability

## 1. Configuration Layer

### Settings-based Configuration

Integrations are configured through the platform's settings system with feature flags:

```python
# In src/dotmac/platform/settings.py
class FeatureFlags(BaseModel):
    # Email integrations
    email_enabled: bool = Field(False, description="Enable email notifications")

    # SMS integrations
    sms_enabled: bool = Field(False, description="Enable SMS notifications")

    # Storage integrations
    storage_s3_enabled: bool = Field(False, description="Enable S3 storage")
    storage_minio_enabled: bool = Field(False, description="Enable MinIO storage")

    # Search integrations
    search_meilisearch_enabled: bool = Field(False, description="Enable MeiliSearch")
    search_elasticsearch_enabled: bool = Field(False, description="Enable Elasticsearch")

class EmailSettings(BaseModel):
    provider: str = Field("sendgrid", description="Email provider (sendgrid, ses, smtp)")
    from_address: str = Field("noreply@example.com", description="From address")
    from_name: str = Field("DotMac Platform", description="From name")
```

### Environment Configuration

```bash
# Feature flags
FEATURES__EMAIL_ENABLED=true
FEATURES__SMS_ENABLED=true
FEATURES__STORAGE_S3_ENABLED=true

# Service settings
EMAIL__PROVIDER=sendgrid
EMAIL__FROM_ADDRESS=noreply@yourcompany.com
EMAIL__FROM_NAME="Your Company"

# Storage settings
STORAGE__PROVIDER=s3
STORAGE__BUCKET=your-company-bucket
STORAGE__REGION=us-west-2
```

## 2. Secrets Management

### Vault Integration

Sensitive credentials are stored in HashiCorp Vault using a structured path hierarchy:

```bash
# Email secrets (SendGrid)
vault kv put secret/email/sendgrid \\
    api_key="SG.your_sendgrid_api_key_here"

# SMS secrets (Twilio)
vault kv put secret/sms/twilio \\
    username="your_twilio_account_sid" \\
    password="your_twilio_auth_token"

# Storage secrets (AWS S3)
vault kv put secret/storage/aws \\
    access_key="AKIA..." \\
    secret_key="your_aws_secret_key"

# Search secrets (MeiliSearch)
vault kv put secret/search/meilisearch \\
    api_key="your_meilisearch_master_key"
```

### Secrets Loading

```python
from dotmac.platform.secrets import get_vault_secret_async

# Load secret in integration
api_key = await get_vault_secret_async("email/sendgrid/api_key")
```

## 3. Integration Implementation

### Base Integration Class

All integrations inherit from `BaseIntegration`:

```python
from dotmac.platform.integrations import BaseIntegration, IntegrationConfig

class CustomIntegration(BaseIntegration):
    def __init__(self, config: IntegrationConfig):
        super().__init__(config)
        self._client = None

    async def initialize(self) -> None:
        """Initialize the integration."""
        # Load secrets
        await self.load_secrets()

        # Get configuration
        api_key = self.get_secret("api_key")
        base_url = self.config.settings.get("base_url")

        # Initialize client
        self._client = SomeAPIClient(api_key=api_key, base_url=base_url)

        # Mark as ready
        self._status = IntegrationStatus.READY

    async def health_check(self) -> IntegrationHealth:
        """Check integration health."""
        try:
            # Perform health check
            await self._client.ping()

            return IntegrationHealth(
                name=self.name,
                status=self._status,
                message="API accessible"
            )
        except Exception as e:
            return IntegrationHealth(
                name=self.name,
                status=IntegrationStatus.ERROR,
                message=str(e)
            )

    async def custom_method(self, **kwargs):
        """Custom integration method."""
        if self._status != IntegrationStatus.READY:
            raise RuntimeError("Integration not ready")

        return await self._client.perform_action(**kwargs)
```

### Email Integration Example

```python
class SendGridIntegration(EmailIntegration):
    async def initialize(self) -> None:
        import sendgrid

        await self.load_secrets()
        api_key = self.get_secret("api_key")

        self._client = sendgrid.SendGridAPIClient(api_key=api_key)
        self._status = IntegrationStatus.READY

    async def send_email(self, to, subject, content, **kwargs):
        message = Mail(
            from_email=self.config.settings["from_email"],
            to_emails=to,
            subject=subject,
            plain_text_content=content
        )

        response = self._client.send(message)

        return {
            "status": "sent",
            "message_id": response.headers.get("X-Message-Id"),
            "status_code": response.status_code,
        }
```

## 4. Integration Registry

The `IntegrationRegistry` manages all integrations:

```python
from dotmac.platform.integrations import get_integration_registry

# Get registry and configure from settings
registry = await get_integration_registry()

# Register custom provider
registry.register_provider("email", "custom", CustomEmailIntegration)

# Get integration
email_service = registry.get_integration("email")
await email_service.send_email(...)
```

## 5. Usage Patterns

### Direct Integration Usage

```python
from dotmac.platform.integrations import get_integration_async

# Get integration directly
email_service = await get_integration_async("email")
if email_service:
    result = await email_service.send_email(
        to="user@example.com",
        subject="Welcome!",
        content="Welcome to our platform!"
    )
```

### Service Layer Abstraction

```python
class NotificationService:
    def __init__(self):
        self._email_service = None
        self._sms_service = None

    async def initialize(self):
        self._email_service = await get_integration_async("email")
        self._sms_service = await get_integration_async("sms")

    async def send_notification(self, type: str, recipient: str, message: str):
        if type == "email" and self._email_service:
            return await self._email_service.send_email(
                to=recipient,
                subject="Notification",
                content=message
            )
        elif type == "sms" and self._sms_service:
            return await self._sms_service.send_sms(
                to=recipient,
                message=message
            )
        else:
            # Fallback to basic notification
            return self._send_basic_notification(type, recipient, message)
```

### Context Manager Usage

```python
from dotmac.platform.integrations import integration_context

async with integration_context() as registry:
    email_service = registry.get_integration("email")
    sms_service = registry.get_integration("sms")

    # Use services...
    await email_service.send_email(...)
    await sms_service.send_sms(...)

    # Cleanup handled automatically
```

## 6. Health Monitoring

### Health Checks

```python
async def check_integrations_health():
    registry = await get_integration_registry()
    health_results = await registry.health_check_all()

    for name, health in health_results.items():
        print(f"{name}: {health.status} - {health.message}")

    return health_results
```

### Integration Status Monitoring

```python
# In your monitoring/observability code
async def get_integration_metrics():
    registry = await get_integration_registry()

    metrics = {
        "integrations_total": len(registry._integrations),
        "integrations_healthy": 0,
        "integrations_error": 0,
    }

    health_results = await registry.health_check_all()
    for health in health_results.values():
        if health.status == IntegrationStatus.READY:
            metrics["integrations_healthy"] += 1
        elif health.status == IntegrationStatus.ERROR:
            metrics["integrations_error"] += 1

    return metrics
```

## 7. Error Handling

### Graceful Degradation

```python
async def send_notification_with_fallback(recipient: str, message: str):
    try:
        # Try primary integration
        email_service = await get_integration_async("email")
        if email_service:
            return await email_service.send_email(
                to=recipient,
                subject="Notification",
                content=message
            )
    except Exception as e:
        logger.error("Primary email integration failed", error=str(e))

    try:
        # Fallback to basic notification service
        from dotmac.platform.communications import send_notification, NotificationRequest

        return send_notification(NotificationRequest(
            type="email",
            recipient=recipient,
            content=message
        ))
    except Exception as e:
        logger.error("Fallback notification failed", error=str(e))
        raise
```

### Circuit Breaker Pattern

```python
class CircuitBreakerIntegration(BaseIntegration):
    def __init__(self, config):
        super().__init__(config)
        self._failure_count = 0
        self._last_failure_time = None
        self._circuit_open = False

    async def perform_action(self, **kwargs):
        if self._circuit_open:
            if self._should_retry():
                self._circuit_open = False
                self._failure_count = 0
            else:
                raise RuntimeError("Circuit breaker is open")

        try:
            result = await self._actual_action(**kwargs)
            self._failure_count = 0
            return result
        except Exception as e:
            self._failure_count += 1
            self._last_failure_time = datetime.now()

            if self._failure_count >= 5:  # Threshold
                self._circuit_open = True

            raise
```

## 8. Testing Integrations

### Mock Integrations for Testing

```python
class MockEmailIntegration(EmailIntegration):
    def __init__(self, config):
        super().__init__(config)
        self.sent_emails = []

    async def initialize(self):
        self._status = IntegrationStatus.READY

    async def send_email(self, to, subject, content, **kwargs):
        email_data = {
            "to": to,
            "subject": subject,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            **kwargs
        }
        self.sent_emails.append(email_data)

        return {
            "status": "sent",
            "message_id": f"mock_{len(self.sent_emails)}",
        }

# In tests
@pytest.fixture
async def mock_integrations():
    registry = IntegrationRegistry()
    registry.register_provider("email", "mock", MockEmailIntegration)

    config = IntegrationConfig(
        name="email",
        type=IntegrationType.EMAIL,
        provider="mock",
        enabled=True,
        settings={}
    )

    await registry.register_integration(config)
    return registry
```

## 9. Production Deployment

### Container Configuration

```dockerfile
# Dockerfile
FROM python:3.12-slim

# Install integration dependencies
RUN pip install sendgrid twilio boto3 meilisearch httpx

# Copy application
COPY . /app
WORKDIR /app

# Environment variables
ENV FEATURES__EMAIL_ENABLED=true
ENV FEATURES__SMS_ENABLED=true
ENV EMAIL__PROVIDER=sendgrid
ENV VAULT_ADDR=https://vault.company.com

CMD ["python", "-m", "dotmac.platform.main"]
```

### Kubernetes Configuration

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dotmac-platform
spec:
  template:
    spec:
      containers:
      - name: dotmac-platform
        image: dotmac-platform:latest
        env:
        - name: FEATURES__EMAIL_ENABLED
          value: "true"
        - name: EMAIL__PROVIDER
          value: "sendgrid"
        - name: VAULT_ADDR
          value: "https://vault.company.com"
        - name: VAULT_TOKEN
          valueFrom:
            secretKeyRef:
              name: vault-token
              key: token
```

## 10. Best Practices

### Configuration Management
- Use feature flags to enable/disable integrations
- Store non-sensitive config in environment variables
- Use Vault for all sensitive credentials
- Validate configuration at startup

### Error Handling
- Implement graceful degradation
- Use circuit breakers for external services
- Log integration failures with context
- Provide meaningful error messages

### Performance
- Use connection pooling for HTTP clients
- Implement caching where appropriate
- Use async/await for all I/O operations
- Monitor integration performance metrics

### Security
- Never log sensitive credentials
- Use least-privilege API keys
- Rotate credentials regularly
- Validate all inputs to integrations

### Testing
- Mock integrations in unit tests
- Use real integrations in integration tests
- Test error scenarios and fallbacks
- Verify configuration validation

This architecture provides a robust, secure, and maintainable way to implement external service integrations in the DotMac platform.
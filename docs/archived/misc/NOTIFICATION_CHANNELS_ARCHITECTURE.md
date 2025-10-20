# Pluggable Notification Channels Architecture

**Version**: 1.0.0
**Date**: 2025-10-15
**Status**: Production-Ready

---

## Overview

The ISP Operations Platform now features a **pluggable notification channel architecture** that allows you to send notifications via multiple channels using swappable provider backends.

### Key Features

✅ **Multi-Channel Support**: Email, SMS, Push, Webhook
✅ **Pluggable Providers**: Swap SMS/Push providers via configuration
✅ **Priority-Based Routing**: Different channels for different priorities
✅ **Easy Extension**: Add new channels (Slack, WhatsApp, etc.) without changing core code
✅ **Configuration-Driven**: Enable/disable channels via environment variables
✅ **Provider Flexibility**: Multiple providers per channel type

---

## Architecture

### Components

```
notifications/
├── channels/
│   ├── base.py              # Abstract base class
│   ├── email.py             # Email channel provider
│   ├── sms.py               # SMS channel provider (Twilio/AWS SNS/HTTP)
│   ├── push.py              # Push channel provider (FCM/OneSignal/AWS SNS/HTTP)
│   ├── webhook.py           # Webhook channel provider (Slack/Teams/Discord/Custom)
│   └── factory.py           # Provider factory and manager
└── service.py               # Notification service (updated to use channels)
```

### Class Hierarchy

```
NotificationChannelProvider (ABC)
├── EmailChannelProvider
├── SMSChannelProvider
│   ├── Twilio backend
│   ├── AWS SNS backend
│   └── HTTP API backend
├── PushChannelProvider
│   ├── Firebase Cloud Messaging
│   ├── OneSignal
│   ├── AWS SNS Mobile Push
│   └── HTTP API backend
└── WebhookChannelProvider
    ├── Standard format
    ├── Slack format
    ├── Microsoft Teams format
    └── Discord format
```

---

## Supported Channels

### 1. Email Channel

**Provider**: Communications Email Service (existing)
**Configuration**: Uses existing SMTP settings
**Priority Support**: All priorities
**Best For**: Detailed notifications, audit trails

**Features**:
- HTML email rendering
- Action buttons
- Priority-based styling
- Automatic queuing via communications service

### 2. SMS Channel

**Providers**:
- **Twilio** (default, recommended)
- **AWS SNS**
- **Custom HTTP API**

**Configuration**: See `.env.example` - `NOTIFICATIONS__SMS_*`
**Priority Support**: Configurable minimum priority (default: HIGH)
**Best For**: Critical alerts, urgent notifications

**Features**:
- Multiple SMS provider backends
- Message truncation for SMS limits
- Priority prefixing for urgent messages
- E.164 phone number support
- Cost-aware retry configuration

### 3. Push Notifications Channel

**Providers**:
- **Firebase Cloud Messaging (FCM)** (default)
- **OneSignal**
- **AWS SNS Mobile Push**
- **Custom HTTP API**

**Configuration**: See `.env.example` - `NOTIFICATIONS__PUSH_*`
**Priority Support**: Configurable minimum priority (default: MEDIUM)
**Best For**: Mobile app notifications, real-time alerts

**Features**:
- Multi-device support
- Platform-specific priority (Android/iOS)
- Rich notification data
- Device token management
- Fallback to other channels on failure

### 4. Webhook Channel

**Formats**:
- **Standard JSON** (default)
- **Slack** (Block Kit)
- **Microsoft Teams** (MessageCard)
- **Discord** (Embeds)

**Configuration**: See `.env.example` - `NOTIFICATIONS__WEBHOOK_*`
**Priority Support**: All priorities
**Best For**: Integration with external systems, team collaboration tools

**Features**:
- Multiple webhook endpoints
- Format-specific payloads
- HMAC signature verification
- Custom headers
- Retry configuration

---

## Configuration

### Environment Variables

#### Email Channel

```bash
# Email Channel (uses existing SMTP configuration)
NOTIFICATIONS__EMAIL_ENABLED=true
```

#### SMS Channel

```bash
# SMS Channel
NOTIFICATIONS__SMS_ENABLED=false
NOTIFICATIONS__SMS_PROVIDER=twilio  # twilio | aws_sns | http

# Twilio (most popular)
NOTIFICATIONS__TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
NOTIFICATIONS__TWILIO_AUTH_TOKEN=your_auth_token
NOTIFICATIONS__TWILIO_FROM_NUMBER=+1234567890

# AWS SNS Alternative
NOTIFICATIONS__AWS_REGION=us-east-1

# Custom HTTP API Alternative
NOTIFICATIONS__SMS_HTTP_API_URL=https://api.example.com/sms
NOTIFICATIONS__SMS_HTTP_API_KEY=your_api_key

# SMS Settings
NOTIFICATIONS__SMS_MAX_LENGTH=160
NOTIFICATIONS__SMS_MIN_PRIORITY=HIGH  # Only send SMS for HIGH/URGENT
NOTIFICATIONS__SMS_MAX_RETRIES=2
```

#### Push Channel

```bash
# Push Notifications
NOTIFICATIONS__PUSH_ENABLED=false
NOTIFICATIONS__PUSH_PROVIDER=fcm  # fcm | onesignal | aws_sns | http

# Firebase Cloud Messaging
NOTIFICATIONS__FCM_CREDENTIALS_PATH=/path/to/firebase-credentials.json

# OneSignal Alternative
NOTIFICATIONS__ONESIGNAL_APP_ID=your_app_id
NOTIFICATIONS__ONESIGNAL_API_KEY=your_api_key

# AWS SNS Alternative
NOTIFICATIONS__AWS_REGION=us-east-1

# Custom HTTP API Alternative
NOTIFICATIONS__PUSH_HTTP_API_URL=https://api.example.com/push
NOTIFICATIONS__PUSH_HTTP_API_KEY=your_api_key

# Push Settings
NOTIFICATIONS__PUSH_MIN_PRIORITY=MEDIUM
NOTIFICATIONS__PUSH_MAX_RETRIES=3
```

#### Webhook Channel

```bash
# Webhooks (Slack, Teams, Discord, Custom)
NOTIFICATIONS__WEBHOOK_ENABLED=false
NOTIFICATIONS__WEBHOOK_URLS=["https://hooks.slack.com/services/xxx","https://example.com/webhook"]
NOTIFICATIONS__WEBHOOK_FORMAT=slack  # standard | slack | teams | discord
NOTIFICATIONS__WEBHOOK_SECRET=your_shared_secret
NOTIFICATIONS__WEBHOOK_TIMEOUT=10.0
NOTIFICATIONS__WEBHOOK_MAX_RETRIES=3
```

---

## Usage Examples

### Basic Usage (NotificationService Already Updated)

The NotificationService automatically uses channel providers. No code changes needed!

```python
from notifications.service import NotificationService
from notifications.models import NotificationType, NotificationPriority

# Create notification (sent via configured channels)
notification = await notification_service.create_notification(
    tenant_id=tenant_id,
    user_id=user_id,
    notification_type=NotificationType.ALARM,
    title="Critical Alarm: OLT-01 Offline",
    message="OLT-01 lost connectivity at 14:32 UTC",
    priority=NotificationPriority.URGENT,  # Will trigger SMS + Email + Push
    channels=[NotificationChannel.EMAIL, NotificationChannel.SMS],
    auto_send=True,  # Automatic delivery via all configured channels
)
```

### Send to Specific Channels

```python
# Only send via email and webhook
notification = await notification_service.create_notification(
    tenant_id=tenant_id,
    user_id=user_id,
    notification_type=NotificationType.BILLING,
    title="Payment Due",
    message="Your payment of $99.99 is due in 3 days",
    priority=NotificationPriority.MEDIUM,
    channels=[NotificationChannel.EMAIL, NotificationChannel.WEBHOOK],
)
```

### Validate Channel Availability

```python
from notifications.channels.factory import ChannelProviderFactory

# Check which channels are configured
available = ChannelProviderFactory.get_available_channels()
# Returns: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS]

# Validate all providers
validation = await ChannelProviderFactory.validate_all_providers()
# Returns: {"email": True, "sms": True, "push": False, "webhook": False, "in_app": True}
```

---

## Adding a New Channel

Want to add Telegram, WhatsApp, or Slack direct messaging? Here's how:

### 1. Create Provider Class

```python
# notifications/channels/telegram.py

from .base import NotificationChannelProvider, NotificationContext

class TelegramChannelProvider(NotificationChannelProvider):
    @property
    def channel_name(self) -> str:
        return "telegram"

    async def send(self, context: NotificationContext) -> bool:
        # Get recipient Telegram chat ID
        telegram_chat_id = context.metadata.get("telegram_chat_id")

        # Send via Telegram Bot API
        # ... implementation ...

        return True

    async def validate_config(self) -> bool:
        return bool(self.config.get("bot_token"))
```

### 2. Register in Factory

```python
# notifications/channels/factory.py

from .telegram import TelegramChannelProvider

class ChannelProviderFactory:
    _provider_classes = {
        NotificationChannel.EMAIL: EmailChannelProvider,
        NotificationChannel.SMS: SMSChannelProvider,
        NotificationChannel.PUSH: PushChannelProvider,
        NotificationChannel.WEBHOOK: WebhookChannelProvider,
        NotificationChannel.TELEGRAM: TelegramChannelProvider,  # NEW
    }
```

### 3. Add Configuration

```python
# settings.py

class NotificationSettings(BaseModel):
    # ... existing settings ...

    # Telegram
    telegram_enabled: bool = Field(False, description="Enable Telegram notifications")
    telegram_bot_token: str | None = Field(None, description="Telegram bot token")
```

### 4. Use It!

```python
notification = await notification_service.create_notification(
    tenant_id=tenant_id,
    user_id=user_id,
    notification_type=NotificationType.ALERT,
    title="New Support Ticket",
    message="Ticket #12345 assigned to you",
    channels=[NotificationChannel.TELEGRAM],
    metadata={"telegram_chat_id": user.telegram_chat_id},
)
```

---

## Provider Comparison

### SMS Providers

| Provider | Pros | Cons | Best For |
|----------|------|------|----------|
| **Twilio** | Industry leader, great docs, reliability | Slightly higher cost | Production use |
| **AWS SNS** | Integrates with AWS, cost-effective | Less features than Twilio | AWS-heavy deployments |
| **HTTP API** | Custom provider, full control | Requires custom implementation | Existing SMS infrastructure |

### Push Providers

| Provider | Pros | Cons | Best For |
|----------|------|------|----------|
| **FCM** | Free, Google-backed, cross-platform | Requires Firebase setup | Most use cases |
| **OneSignal** | Easy setup, dashboard, segmentation | Limited free tier | Marketing notifications |
| **AWS SNS** | AWS integration, cost-effective | More complex setup | AWS-heavy deployments |
| **HTTP API** | Custom provider, full control | Requires custom implementation | Existing push infrastructure |

---

## Priority-Based Routing

Channels can be configured to only activate for certain priorities:

```python
# settings.py or via environment variables

NOTIFICATIONS__SMS_MIN_PRIORITY=HIGH      # SMS only for HIGH/URGENT
NOTIFICATIONS__PUSH_MIN_PRIORITY=MEDIUM   # Push for MEDIUM/HIGH/URGENT
NOTIFICATIONS__EMAIL_ENABLED=true         # Email for all priorities
```

### Example Routing

| Priority | Email | SMS | Push | Webhook |
|----------|-------|-----|------|---------|
| LOW | ✅ | ❌ | ❌ | ✅ |
| MEDIUM | ✅ | ❌ | ✅ | ✅ |
| HIGH | ✅ | ✅ | ✅ | ✅ |
| URGENT | ✅ | ✅ | ✅ | ✅ |

---

## Retry Configuration

Each channel has configurable retry behavior:

```python
# SMS - Lower retries due to cost
{
    "max_retries": 2,
    "retry_delay": 120,  # 2 minutes
    "backoff_multiplier": 2,
}

# Push - Standard retries
{
    "max_retries": 3,
    "retry_delay": 60,  # 1 minute
    "backoff_multiplier": 2,
}

# Email - More aggressive retries
{
    "max_retries": 3,
    "retry_delay": 60,
    "backoff_multiplier": 2,
}

# Webhook - Fast retries
{
    "max_retries": 3,
    "retry_delay": 30,  # 30 seconds
    "backoff_multiplier": 2,
}
```

---

## Security Considerations

### SMS

- ✅ Phone numbers masked in logs
- ✅ Credentials stored in environment variables (can use Vault)
- ✅ E.164 format validation
- ✅ Cost-aware retry limits

### Push

- ✅ Firebase credentials in secure file (not in code)
- ✅ Device token validation
- ✅ Platform-specific security (APNS, FCM)
- ✅ Token rotation support

### Webhooks

- ✅ HMAC signature verification
- ✅ URL masking in logs
- ✅ Custom header support (e.g., Authorization)
- ✅ TLS/SSL required for production

---

## Testing

### Unit Tests

```python
import pytest
from notifications.channels import SMSChannelProvider
from notifications.channels.base import NotificationContext

@pytest.mark.asyncio
async def test_sms_channel_twilio():
    # Mock Twilio
    provider = SMSChannelProvider(config={
        "provider": "twilio",
        "twilio_account_sid": "test",
        "twilio_auth_token": "test",
        "twilio_from_number": "+1234567890",
    })

    context = NotificationContext(
        notification_id=uuid4(),
        tenant_id="test-tenant",
        user_id=uuid4(),
        notification_type=NotificationType.ALARM,
        priority=NotificationPriority.URGENT,
        title="Test Alert",
        message="This is a test",
        recipient_phone="+19876543210",
    )

    # This will fail without real Twilio creds, use mocking
    with patch('twilio.rest.Client'):
        result = await provider.send(context)
        assert result is True
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_notification_multi_channel(db_session):
    service = NotificationService(db=db_session)

    # Create notification with multiple channels
    notification = await service.create_notification(
        tenant_id="test-tenant",
        user_id=test_user.id,
        notification_type=NotificationType.SYSTEM,
        title="System Maintenance",
        message="Scheduled maintenance at 2AM UTC",
        channels=[
            NotificationChannel.EMAIL,
            NotificationChannel.WEBHOOK,
        ],
    )

    assert notification.email_sent is True
    # Webhook status checked separately
```

---

## Troubleshooting

### SMS Not Sending

1. **Check provider enabled**: `NOTIFICATIONS__SMS_ENABLED=true`
2. **Verify credentials**: Twilio SID/Token configured correctly
3. **Check phone format**: Must be E.164 format (+1234567890)
4. **Check priority**: SMS may require HIGH/URGENT priority
5. **Review logs**: Search for `sms.notification.sent` or `sms.send.failed`

### Push Not Sending

1. **Check provider enabled**: `NOTIFICATIONS__PUSH_ENABLED=true`
2. **Verify credentials**: FCM credentials file exists and valid
3. **Check device tokens**: User must have registered push tokens
4. **Check priority**: Push may require MEDIUM+ priority
5. **Review logs**: Search for `push.notification.sent` or `push.device.failed`

### Webhook Not Delivering

1. **Check webhook enabled**: `NOTIFICATIONS__WEBHOOK_ENABLED=true`
2. **Verify URLs**: Webhook URLs configured and reachable
3. **Test endpoint**: Use curl to test webhook URL manually
4. **Check signature**: If using `webhook_secret`, verify HMAC generation
5. **Review logs**: Search for `webhook.notification.sent` or `webhook.send.failed`

---

## Performance Considerations

### Channel Delivery Times

| Channel | Typical Delivery | Max Timeout |
|---------|------------------|-------------|
| Email | 5-30 seconds | 60 seconds |
| SMS | 1-10 seconds | 30 seconds |
| Push | 1-5 seconds | 10 seconds |
| Webhook | <1 second | 10 seconds |
| IN_APP | Instant | N/A |

### Scalability

- **Async Operations**: All channel providers use `async/await`
- **Parallel Delivery**: Multiple channels sent in parallel
- **Retry Queues**: Failed deliveries queued for retry
- **Rate Limiting**: Configurable per provider

---

## Migration from Old System

The old NotificationService had placeholder `_send_sms()` and `_send_push()` methods with TODOs. These have been replaced with the pluggable architecture.

### What Changed

**Before**:
```python
async def _send_sms(self, notification: Notification) -> None:
    # TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
    logger.info("SMS notification (placeholder)")
```

**After**:
```python
# Now uses SMSChannelProvider with multiple backends
provider = ChannelProviderFactory.get_provider(NotificationChannel.SMS)
if provider:
    await provider.send(context)
```

### Migration Steps

1. ✅ Install new channel providers
2. ✅ Configure providers via `.env`
3. ✅ Test with low-priority notifications first
4. ✅ Gradually enable channels (email → webhook → push → sms)
5. ✅ Monitor logs for delivery success rates

---

## Future Enhancements

### Planned Additions

- **Telegram Channel**: Direct messaging via Telegram Bot API
- **WhatsApp Channel**: Business messaging via WhatsApp API
- **Voice Call Channel**: Voice alerts for critical incidents (Twilio Voice)
- **Desktop Push**: Browser push notifications (Web Push API)
- **Custom Channel SDK**: Plugin system for third-party channels

### Potential Improvements

- **Template Library**: Pre-built templates per channel
- **A/B Testing**: Test different message formats
- **Delivery Analytics**: Track open rates, click rates
- **Smart Routing**: ML-based channel selection
- **User Preferences**: Per-user channel preferences

---

## Dependencies

### Python Libraries

```bash
# SMS - Twilio
pip install twilio

# SMS - AWS SNS
pip install boto3

# Push - Firebase
pip install firebase-admin

# HTTP Requests
pip install httpx  # Already installed

# Existing
# - structlog (logging)
# - sqlalchemy (database)
# - pydantic (settings)
```

### Optional Dependencies

```toml
# pyproject.toml

[tool.poetry.dependencies]
# Core (required)
httpx = "^0.24.0"

# SMS Providers (optional)
twilio = { version = "^8.0.0", optional = true }
boto3 = { version = "^1.28.0", optional = true }

# Push Providers (optional)
firebase-admin = { version = "^6.2.0", optional = true }

[tool.poetry.extras]
sms = ["twilio"]
push = ["firebase-admin"]
aws = ["boto3"]
all-channels = ["twilio", "firebase-admin", "boto3"]
```

---

## Summary

### Key Achievements

✅ **Pluggable Architecture**: Easy to add new channels
✅ **Multiple Providers**: Swap SMS/Push providers via config
✅ **Production-Ready**: Full error handling, retries, logging
✅ **Zero Breaking Changes**: Existing NotificationService continues to work
✅ **Comprehensive Config**: All providers configurable via environment
✅ **Security-First**: Credentials in env, logging sanitization
✅ **Well-Tested**: Unit and integration test patterns provided

### Files Created

1. `notifications/channels/base.py` - Abstract base class (149 lines)
2. `notifications/channels/email.py` - Email provider (133 lines)
3. `notifications/channels/sms.py` - SMS provider (335 lines)
4. `notifications/channels/push.py` - Push provider (383 lines)
5. `notifications/channels/webhook.py` - Webhook provider (373 lines)
6. `notifications/channels/factory.py` - Provider factory (162 lines)
7. `settings.py` - NotificationSettings added (74 lines)
8. `.env.example` - Configuration examples (46 lines)

**Total**: ~1,655 lines of production code

---

**Documentation Owner**: Platform Engineering
**Date**: 2025-10-15
**Version**: 1.0.0
**Status**: Production-Ready ✅

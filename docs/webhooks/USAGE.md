# Webhook Infrastructure Usage Guide

## Overview

The generic webhook infrastructure allows any platform module to publish events that external systems can subscribe to via HTTP webhooks.

## Architecture

```
Module (billing/communications/etc)
    ↓ publishes event
EventBus
    ↓ finds subscriptions
WebhookDeliveryService
    ↓ delivers HTTP POST
Customer's Webhook Endpoint
```

## For Module Developers: Publishing Events

### 1. Import the EventBus

```python
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent
```

### 2. Publish Events After State Changes

```python
# Example: In billing/invoicing/service.py
async def create_invoice(
    self,
    tenant_id: str,
    customer_id: str,
    items: List[InvoiceItem],
    db: AsyncSession,
) -> Invoice:
    """Create an invoice and publish event."""

    # Create invoice
    invoice = Invoice(
        tenant_id=tenant_id,
        customer_id=customer_id,
        items=items,
        status=InvoiceStatus.DRAFT,
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)

    # Publish event to webhook subscribers
    await get_event_bus().publish(
        event_type=WebhookEvent.INVOICE_CREATED.value,
        event_data={
            "invoice_id": str(invoice.id),
            "customer_id": customer_id,
            "amount": float(invoice.total_amount),
            "currency": invoice.currency,
            "status": invoice.status.value,
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
        },
        tenant_id=tenant_id,
        db=db,  # Pass DB session for webhook delivery
    )

    return invoice
```

### 3. Event Data Best Practices

**Include:**
- IDs for all related entities
- Current state/status
- Timestamps (ISO 8601 format)
- Amounts/quantities (as numbers, not strings)
- Any data needed for the subscriber to understand the event

**Avoid:**
- Sensitive data (passwords, secrets, full payment details)
- Large binary blobs
- Entire object dumps (be selective)
- Internal implementation details

### 4. Example: Communications Module

```python
# In communications/email_service.py
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

async def send_email(self, message: EmailMessage) -> EmailResponse:
    """Send email and publish event."""

    # Send via provider
    response = await self._provider.send(message)

    # Publish event
    if response.status == "sent":
        await get_event_bus().publish(
            event_type=WebhookEvent.EMAIL_SENT.value,
            event_data={
                "message_id": response.id,
                "to": message.to,
                "subject": message.subject,
                "provider": self._provider.name,
                "sent_at": datetime.now(timezone.utc).isoformat(),
            },
            tenant_id=self.tenant_id,
            db=self.db,
        )

    return response
```

## For API Users: Subscribing to Webhooks

### 1. Create a Webhook Subscription

```bash
POST /api/v1/webhooks/subscriptions
Authorization: Bearer <your-token>

{
  "url": "https://your-app.com/webhook",
  "description": "Production webhook endpoint",
  "events": [
    "invoice.created",
    "invoice.paid",
    "payment.succeeded",
    "customer.created"
  ],
  "headers": {
    "X-Custom-Header": "optional-value"
  },
  "retry_enabled": true,
  "max_retries": 3,
  "timeout_seconds": 30
}
```

**Response:**
```json
{
  "id": "sub_abc123",
  "url": "https://your-app.com/webhook",
  "events": ["invoice.created", "invoice.paid"],
  "is_active": true,
  "secret": "<signing-secret>",  // SAVE THIS! Won't be shown again
  "created_at": "2025-09-30T12:00:00Z"
}
```

### 2. Verify Webhook Signatures

Webhook requests include a signature header for security:

```python
import hmac
import hashlib

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify webhook signature."""
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)

# In your webhook handler
@app.post("/webhook")
async def handle_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("X-Webhook-Signature")

    if not verify_webhook_signature(payload, signature, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Process webhook
    data = await request.json()
    event_type = data["type"]

    if event_type == "invoice.created":
        # Handle invoice creation
        pass
```

### 3. Webhook Payload Format

All webhook events follow this structure:

```json
{
  "id": "evt_abc123",           // Event ID (idempotency key)
  "type": "invoice.created",     // Event type
  "timestamp": "2025-09-30T12:00:00Z",
  "tenant_id": "tenant_xyz",     // Your tenant ID
  "data": {
    // Event-specific data
    "invoice_id": "inv_123",
    "customer_id": "cust_456",
    "amount": 100.00,
    "currency": "USD"
  },
  "metadata": {}                 // Optional metadata
}
```

### 4. Headers Sent with Webhooks

```
Content-Type: application/json
User-Agent: DotMac-Webhooks/1.0
X-Webhook-Signature: <hmac-sha256-hex>
X-Webhook-Event-Id: evt_abc123
X-Webhook-Event-Type: invoice.created
X-Webhook-Timestamp: 2025-09-30T12:00:00Z
```

## Available Events

### Billing Events
- `invoice.created` - Invoice created
- `invoice.paid` - Invoice paid
- `invoice.payment_failed` - Invoice payment failed
- `invoice.voided` - Invoice voided
- `payment.succeeded` - Payment succeeded
- `payment.failed` - Payment failed
- `payment.refunded` - Payment refunded
- `subscription.created` - Subscription created
- `subscription.updated` - Subscription updated
- `subscription.cancelled` - Subscription cancelled
- `subscription.renewed` - Subscription renewed

### Customer Events
- `customer.created` - Customer created
- `customer.updated` - Customer updated
- `customer.deleted` - Customer deleted

### User Events
- `user.registered` - User registered
- `user.updated` - User profile updated
- `user.deleted` - User deleted

### Communication Events
- `email.sent` - Email sent
- `email.delivered` - Email delivered
- `email.bounced` - Email bounced
- `email.failed` - Email failed
- `bulk_email.completed` - Bulk email job completed

### File Storage Events
- `file.uploaded` - File uploaded
- `file.deleted` - File deleted
- `file.scan_completed` - Virus scan completed
- `storage.quota_exceeded` - Storage quota exceeded

### Data Transfer Events
- `import.completed` - Import job completed
- `import.failed` - Import job failed
- `export.completed` - Export job completed
- `export.failed` - Export job failed

## Management Endpoints

### List Subscriptions
```bash
GET /api/v1/webhooks/subscriptions
```

### Get Subscription
```bash
GET /api/v1/webhooks/subscriptions/{subscription_id}
```

### Update Subscription
```bash
PATCH /api/v1/webhooks/subscriptions/{subscription_id}
{
  "is_active": false,  // Disable subscription
  "events": ["invoice.created"]  // Update event filter
}
```

### Delete Subscription
```bash
DELETE /api/v1/webhooks/subscriptions/{subscription_id}
```

### Rotate Secret
```bash
POST /api/v1/webhooks/subscriptions/{subscription_id}/rotate-secret
```

### View Delivery Logs
```bash
GET /api/v1/webhooks/subscriptions/{subscription_id}/deliveries
```

### Retry Failed Delivery
```bash
POST /api/v1/webhooks/deliveries/{delivery_id}/retry
```

### List Available Events
```bash
GET /api/v1/webhooks/events
```

## Retry Logic

- Failed deliveries are automatically retried (if `retry_enabled: true`)
- Retry schedule: 5 minutes, 1 hour, 6 hours
- After max retries, delivery is marked as permanently failed
- You can manually retry any delivery via API

## Special HTTP Status Codes

- `410 Gone` - Webhook endpoint permanently disabled (subscription auto-disabled)
- `2xx` - Success (delivery marked successful)
- Other codes - Failure (will retry if enabled)

## Security Best Practices

1. **Always verify signatures** - Never trust webhook payloads without verification
2. **Use HTTPS** - Webhook URLs must use HTTPS in production
3. **Implement idempotency** - Use `event_id` to detect duplicate deliveries
4. **Rate limit** - Implement rate limiting on your webhook endpoint
5. **Rotate secrets** - Periodically rotate webhook secrets
6. **Monitor failures** - Set up alerts for failed deliveries

## Testing Webhooks

Use webhook testing tools like:
- [webhook.site](https://webhook.site) - Free webhook testing
- [ngrok](https://ngrok.com) - Expose local server to internet
- [RequestBin](https://requestbin.com) - Inspect HTTP requests

Example with webhook.site:
```bash
POST /api/v1/webhooks/subscriptions
{
  "url": "https://webhook.site/your-unique-url",
  "events": ["invoice.created"]
}
```

Then trigger an invoice creation and view the payload at webhook.site.
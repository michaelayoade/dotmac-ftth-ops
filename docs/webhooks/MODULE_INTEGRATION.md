# Webhook Event Publishing - Module Integration Complete

## Overview

Webhook event publishing has been successfully integrated into the **Billing** and **Communications** modules. These modules now automatically publish events that external systems can subscribe to via the generic webhook infrastructure.

---

## Billing Module Integration

### Invoice Service (`src/dotmac/platform/billing/invoicing/service.py`)

**Events Published:**

1. **`invoice.created`** - Triggered when invoice is created
   - Published in: `create_invoice()`
   - Event data:
     ```python
     {
         "invoice_id": "inv_123",
         "invoice_number": "INV-2025-001",
         "customer_id": "cust_456",
         "amount": 100.00,  # Decimal amount
         "currency": "USD",
         "status": "draft",
         "payment_status": "pending",
         "due_date": "2025-10-30T12:00:00Z",
         "subscription_id": "sub_789"  # Optional
     }
     ```

2. **`invoice.paid`** - Triggered when invoice is marked as paid
   - Published in: `mark_invoice_paid()`
   - Event data:
     ```python
     {
         "invoice_id": "inv_123",
         "invoice_number": "INV-2025-001",
         "customer_id": "cust_456",
         "amount": 100.00,
         "currency": "USD",
         "payment_id": "pay_789",  # Optional
         "paid_at": "2025-10-30T12:30:00Z"
     }
     ```

3. **`invoice.voided`** - Triggered when invoice is voided
   - Published in: `void_invoice()`
   - Event data:
     ```python
     {
         "invoice_id": "inv_123",
         "invoice_number": "INV-2025-001",
         "customer_id": "cust_456",
         "amount": 100.00,
         "currency": "USD",
         "reason": "Customer requested cancellation",
         "voided_by": "user_123",
         "voided_at": "2025-10-30T13:00:00Z"
     }
     ```

### Payment Service (`src/dotmac/platform/billing/payments/service.py`)

**Events Published:**

1. **`payment.succeeded`** - Triggered on successful payment
   - Published in: `create_payment()` (when status = SUCCEEDED)
   - Event data:
     ```python
     {
         "payment_id": "pay_123",
         "customer_id": "cust_456",
         "amount": 100.00,  # Converted from cents
         "currency": "USD",
         "payment_method_id": "pm_789",
         "provider": "stripe",
         "provider_payment_id": "pi_abc123",
         "invoice_ids": ["inv_1", "inv_2"],  # Optional
         "processed_at": "2025-10-30T14:00:00Z"
     }
     ```

2. **`payment.failed`** - Triggered on failed payment
   - Published in: `create_payment()` (when status = FAILED)
   - Event data:
     ```python
     {
         "payment_id": "pay_123",
         "customer_id": "cust_456",
         "amount": 100.00,
         "currency": "USD",
         "payment_method_id": "pm_789",
         "provider": "stripe",
         "failure_reason": "Insufficient funds",
         "processed_at": "2025-10-30T14:00:00Z"
     }
     ```

3. **`payment.refunded`** - Triggered on successful refund
   - Published in: `refund_payment()` (when status = REFUNDED)
   - Event data:
     ```python
     {
         "refund_id": "ref_123",
         "original_payment_id": "pay_456",
         "customer_id": "cust_789",
         "amount": 50.00,
         "currency": "USD",
         "reason": "Customer requested refund",
         "provider": "stripe",
         "provider_refund_id": "re_abc123",
         "processed_at": "2025-10-30T15:00:00Z",
         "refund_type": "partial"  // or "full"
     }
     ```

---

## Communications Module Integration

### Email Service (`src/dotmac/platform/communications/email_service.py`)

**Events Published:**

1. **`email.sent`** - Triggered on successful email send
   - Published in: `send_email()` (when status = sent)
   - Event data:
     ```python
     {
         "message_id": "email_abc123",
         "to": ["user@example.com"],
         "subject": "Welcome to DotMac",
         "from_email": "noreply@dotmac.com",
         "recipients_count": 1,
         "sent_at": "2025-10-30T16:00:00Z"
     }
     ```

2. **`email.failed`** - Triggered on failed email send
   - Published in: `send_email()` (when exception occurs)
   - Event data:
     ```python
     {
         "message_id": "email_abc123",
         "to": ["user@example.com"],
         "subject": "Welcome to DotMac",
         "from_email": "noreply@dotmac.com",
         "recipients_count": 1,
         "error": "SMTP connection timeout"
     }
     ```

**Usage Pattern:**
```python
# Email service now accepts optional tenant_id and db parameters
email_service = EmailService(smtp_host="smtp.gmail.com", tenant_id="tenant_123", db=db_session)

# Or pass them at call time
await email_service.send_email(message, tenant_id="tenant_123", db=db_session)
```

---

## Implementation Pattern

All event publishing follows this consistent pattern:

```python
# Publish webhook event
try:
    await get_event_bus().publish(
        event_type=WebhookEvent.INVOICE_CREATED.value,
        event_data={
            "invoice_id": invoice_entity.invoice_id,
            "amount": float(total_amount),
            # ... other event-specific data
        },
        tenant_id=tenant_id,
        db=self.db,
    )
except Exception as e:
    # Log but don't fail the operation
    logger.warning("Failed to publish invoice.created event", error=str(e))
```

**Key Design Decisions:**

1. **Non-Blocking**: Webhook publishing failures don't fail the business operation
2. **Best Effort**: Events are published if DB session available, otherwise skipped
3. **Tenant Isolation**: All events include tenant_id for multi-tenant security
4. **Structured Logging**: Failures are logged for observability
5. **Consistent Schema**: All events follow the same payload structure

---

## Event Flow Diagram

```
Business Operation (Invoice/Payment/Email)
    ↓
Database Transaction (commit successful)
    ↓
Metrics Recording (existing)
    ↓
Webhook Event Publishing (new)
    ↓
EventBus.publish()
    ↓
Find Active Subscriptions for Event + Tenant
    ↓
Queue Webhook Deliveries
    ↓
HTTP POST to Subscriber Endpoints
```

---

## Testing Event Publishing

### Manual Testing

```python
# 1. Create webhook subscription
POST /api/v1/webhooks/subscriptions
{
  "url": "https://webhook.site/your-unique-url",
  "events": ["invoice.created", "payment.succeeded", "email.sent"]
}

# 2. Trigger business operations
# Create invoice -> webhook fired
# Process payment -> webhook fired
# Send email -> webhook fired

# 3. View deliveries
GET /api/v1/webhooks/subscriptions/{subscription_id}/deliveries
```

### Automated Testing

```python
# tests/webhooks/test_billing_integration.py
@pytest.mark.asyncio
async def test_invoice_created_webhook(async_db):
    # Create subscription
    subscription_service = WebhookSubscriptionService(async_db)
    subscription = await subscription_service.create_subscription(
        tenant_id="test-tenant",
        subscription_data=WebhookSubscriptionCreate(
            url="https://example.com/webhook",
            events=["invoice.created"]
        )
    )

    # Create invoice
    invoice_service = InvoiceService(async_db)
    invoice = await invoice_service.create_invoice(
        tenant_id="test-tenant",
        customer_id="cust_123",
        # ... invoice data
    )

    # Verify webhook delivery was queued
    deliveries = await subscription_service.get_deliveries(
        subscription_id=str(subscription.id),
        tenant_id="test-tenant"
    )

    assert len(deliveries) == 1
    assert deliveries[0].event_type == "invoice.created"
    assert deliveries[0].event_data["invoice_id"] == invoice.invoice_id
```

---

## Error Handling

Webhook publishing is designed to be resilient:

1. **DB Session Not Available**: Event not published, no error raised
2. **EventBus Failure**: Exception caught and logged, operation continues
3. **No Subscriptions**: Event logged but no deliveries created
4. **Delivery Failure**: Automatic retry with exponential backoff

---

## Next Steps

### Additional Modules to Integrate

1. **Subscription Service** (Billing)
   - `subscription.created`
   - `subscription.updated`
   - `subscription.cancelled`
   - `subscription.renewed`

2. **Customer Management**
   - `customer.created`
   - `customer.updated`
   - `customer.deleted`

3. **User Management**
   - `user.registered`
   - `user.updated`
   - `user.deleted`

4. **File Storage**
   - `file.uploaded`
   - `file.deleted`
   - `file.scan_completed`

5. **Data Transfer**
   - `import.completed`
   - `import.failed`
   - `export.completed`
   - `export.failed`

### Integration Checklist

For each new module integration:

- [ ] Import `get_event_bus` and `WebhookEvent`
- [ ] Add event publishing after successful operation
- [ ] Use try/except to catch webhook errors
- [ ] Pass `tenant_id` and `db` session
- [ ] Include relevant entity IDs and amounts
- [ ] Convert dates to ISO 8601 format
- [ ] Log webhook publishing failures
- [ ] Write integration tests
- [ ] Update documentation

---

## Benefits Realized

✅ **Automatic event notifications** for critical business operations
✅ **Real-time integration** with customer systems
✅ **Audit trail** via delivery logs
✅ **Retry mechanism** for failed deliveries
✅ **Multi-tenant isolation** for security
✅ **Non-blocking design** preserves operation reliability
✅ **Extensible architecture** for future events

---

## Files Modified

### Billing Module
- `src/dotmac/platform/billing/invoicing/service.py` (+60 lines)
- `src/dotmac/platform/billing/payments/service.py` (+70 lines)

### Communications Module
- `src/dotmac/platform/communications/email_service.py` (+50 lines)

**Total**: ~180 lines of integration code across 3 files

---

## Event Publishing Statistics

Once deployed, monitor webhook health via:

```bash
# View subscription statistics
GET /api/v1/webhooks/subscriptions

# View recent deliveries
GET /api/v1/webhooks/deliveries?limit=100

# View failed deliveries
GET /api/v1/webhooks/deliveries?status=failed
```

Key metrics to track:
- Total events published per day
- Delivery success rate
- Average delivery latency
- Retry rate
- Failed subscription count

---

## Status: ✅ Integration Complete

The billing and communications modules are now fully integrated with the webhook infrastructure and ready for production use!
# Webhook Event Implementation Quick Reference

**Last Updated:** November 8, 2025
**Overall Coverage:** 34% (16 of 47 events)

---

## Quick Status Overview

```
Billing:        ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░ 85% (11/13)
Communication:  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 33% (2/6)
Ticketing:      ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░░ 75% (3/4, dual system)
Customer:       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% (0/3)
User:           ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% (0/4)
Credit Notes:   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% (0/2, missing from enum)
File Storage:   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% (0/4)
Data Transfer:  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% (0/4)
Analytics:      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% (0/2)
Audit:          ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% (0/2)
```

---

## Events Fully Implemented (11)

| Event | File | Lines | Status |
|-------|------|-------|--------|
| invoice.created | billing/invoicing/service.py | 255-258 | ✓ |
| invoice.finalized | billing/invoicing/service.py | 361-364 | ✓ |
| invoice.paid | billing/invoicing/service.py | 482-485 | ✓ |
| invoice.voided | billing/invoicing/service.py | 429-432 | ✓ |
| payment.succeeded | billing/payments/service.py | 158-161 | ✓ |
| payment.failed | billing/payments/service.py | 193-196 | ✓ |
| payment.refunded | billing/payments/service.py | 421-424 | ✓ |
| subscription.created | billing/subscriptions/service.py | 237-240 | ✓ |
| subscription.updated | billing/subscriptions/service.py | 452-455 | ✓ |
| subscription.cancelled | billing/subscriptions/service.py | 556-559 | ✓ |
| subscription.renewed | billing/subscriptions/service.py | 900-903 | ✓ |

---

## Events Missing Implementation (36)

### Priority 1: Critical Gaps (Add Now)

#### Credit Notes (2 events - Missing from enum)
```python
# Add to webhooks/models.py WebhookEvent enum:
CREDIT_NOTE_CREATED = "credit_note.created"
CREDIT_NOTE_ISSUED = "credit_note.issued"
CREDIT_NOTE_VOIDED = "credit_note.voided"
CREDIT_NOTE_APPLIED = "credit_note.applied"
```

**Implementation:**
- File: `billing/credit_notes/service.py`
- Methods: create_credit_note (line 48), issue_credit_note (line 202), void_credit_note (line 229), apply_credit_to_invoice (line 280)

#### Billing Edge Cases (2 events - Defined but not published)
```python
# invoice.payment_failed - when payment fails on invoice
# Add to: billing/invoicing/service.py - payment failure handler

# subscription.trial_ending - proactive trial expiry notification
# Add to: billing/subscriptions/service.py - trial countdown logic
```

### Priority 2: Core Entities (High Value)

#### Customer Events (3 events)
```
customer.created
customer.updated
customer.deleted
```
**Location:** `customer_management/service.py` or `customer_management/router.py`

**Also Fix:** Remove hardcoded strings in router.py:
- Line 187: "customer.suspended" → WebhookEvent.CUSTOMER_SUSPENDED
- Line 266: "customer.reactivated" → WebhookEvent.CUSTOMER_REACTIVATED
- Line 360: "customer.churned" → WebhookEvent.CUSTOMER_CHURNED

#### User Events (4 events)
```
user.registered    → auth/router.py or user_management/service.py
user.updated       → auth/router.py or user_management/service.py
user.deleted       → user_management/service.py
user.login         → auth/router.py (lines 385, 421, 474, 540, 603, 644, 668, 727, 856, 880)
```

### Priority 3: Data Operations

#### File Storage (4 events)
```
file.uploaded      → file_storage/service.py
file.deleted       → file_storage/service.py
file.scan_completed → file_storage/service.py or plugins/
storage.quota_exceeded → file_storage/service.py (quota check)
```

#### Data Transfer (4 events)
```
import.completed   → data_import/service.py (line 91+)
import.failed      → data_import/service.py (error handler)
export.completed   → data_transfer/exporters.py
export.failed      → data_transfer/exporters.py (error handler)
```

### Priority 4: Advanced Features

#### Communication (4 remaining events)
```
email.delivered    → communications/ + ESP webhook handler
email.bounced      → communications/ + ESP webhook handler
bulk_email.completed → communications/ (campaign service)
bulk_email.failed    → communications/ (campaign service)
```

#### Analytics (2 events)
```
metric.threshold_exceeded  → analytics/service.py or aggregators.py
report.generated          → analytics/service.py or billing/reports/service.py
```

#### Audit (2 events)
```
security.alert           → audit/service.py (based on activity type)
compliance.violation     → audit/service.py (compliance checks)
```

### Priority 5: Complex Cases

#### Ticketing (4 events - Special: Uses Different Event System)
```
PROBLEM: Uses TicketingEvents class, not WebhookEvent enum
STATUS:  Events published but not as webhooks

ticket.created         → ticketing/events.py (implemented via TicketingEvents)
ticket.updated         → ticketing/events.py (implemented via TicketingEvents)
ticket.closed          → ticketing/events.py (implemented via TicketingEvents)
ticket.sla_breach      → NOT IMPLEMENTED (needs fault_management/sla_service.py)

SOLUTION: Create adapter/bridge to convert TicketingEvents → WebhookEvent
```

---

## Implementation Patterns

### Pattern 1: Service-Level Event Publishing
```python
# In service.py method:
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

await get_event_bus().publish(
    event_type=WebhookEvent.EVENT_NAME.value,
    event_data={
        "id": str(entity_id),
        "field": value,
    },
    tenant_id=tenant_id,
    db=session,
)
```

### Pattern 2: Router-Level Event Publishing
```python
# In router.py endpoint:
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

event_bus = get_event_bus()
await event_bus.publish(
    event_type=WebhookEvent.EVENT_NAME.value,
    payload={...},
)
```

### Pattern 3: Event Helper Functions (billing/events.py style)
```python
# New file or add to billing/events.py:
async def emit_customer_created(
    customer_id: str,
    customer_email: str,
    tenant_id: str,
    event_bus: EventBus | None = None,
    **extra_data,
) -> None:
    bus = event_bus or get_event_bus()
    await bus.publish(
        event_type=BillingEvents.CUSTOMER_CREATED,
        payload={
            "customer_id": customer_id,
            "email": customer_email,
            **extra_data,
        },
        metadata={"tenant_id": tenant_id},
        priority=EventPriority.HIGH,
    )
```

---

## Files to Modify (Summary)

### Must Do (Phase 1):
- [ ] `webhooks/models.py` - Add CREDIT_NOTE_* events
- [ ] `billing/credit_notes/service.py` - Implement 4 methods with event publishing
- [ ] `billing/invoicing/service.py` - Add INVOICE_PAYMENT_FAILED
- [ ] `billing/subscriptions/service.py` - Add SUBSCRIPTION_TRIAL_ENDING

### Should Do (Phase 2):
- [ ] `customer_management/service.py` - Add CUSTOMER_* publishing
- [ ] `customer_management/router.py` - Use WebhookEvent enum + emit
- [ ] `user_management/service.py` - Add USER_* publishing
- [ ] `auth/router.py` - Add USER_LOGIN publishing

### Nice to Have (Phase 3-5):
- [ ] `file_storage/service.py` - Add FILE_* events
- [ ] `data_import/service.py` - Add IMPORT_* events
- [ ] `data_transfer/exporters.py` - Add EXPORT_* events
- [ ] `communications/email_service.py` - Add EMAIL_DELIVERED, EMAIL_BOUNCED
- [ ] `analytics/service.py` - Add METRIC_THRESHOLD_EXCEEDED, REPORT_GENERATED
- [ ] `audit/service.py` - Add SECURITY_ALERT, COMPLIANCE_VIOLATION
- [ ] `webhooks/` - Add ticketing adapter/bridge
- [ ] `fault_management/sla_service.py` - Add TICKET_SLA_BREACH

---

## Testing Checklist

For each new event, verify:

- [ ] Event publishes when condition occurs
- [ ] Event data contains all relevant IDs
- [ ] Tenant ID is properly set
- [ ] Event is registered in WebhookEvent enum
- [ ] Webhook subscriptions receive the event
- [ ] Delivery is logged correctly
- [ ] Idempotency is maintained

---

## Known Issues

1. **Ticketing Dual System**: Events use TicketingEvents class, not WebhookEvent. Need bridge/adapter pattern.

2. **Customer Custom Events**: router.py publishes "customer.suspended", etc. as raw strings instead of enum values.

3. **Credit Notes Missing**: Events referenced in billing/events.py but not in WebhookEvent enum.

4. **User Management Gap**: No webhook integration despite all events being defined.

5. **File Storage**: No events despite service existing.

6. **Email Delivery Tracking**: Requires ESP (SendGrid/Mailgun) webhook handler integration.

---

## Contact & Questions

For issues or clarifications about this audit, refer to:
- Full report: `docs/WEBHOOK_EVENT_COVERAGE_AUDIT.md`
- Webhook models: `src/dotmac/platform/webhooks/models.py`
- Event bus: `src/dotmac/platform/webhooks/events.py`

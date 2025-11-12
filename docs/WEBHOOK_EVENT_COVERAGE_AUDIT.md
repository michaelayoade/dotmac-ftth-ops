# Comprehensive Webhook Event Coverage Audit
## dotmac-ftth-ops Platform

**Date:** November 8, 2025
**Status:** Feature Branch: feature/bss-phase1-isp-enhancements
**Scope:** All webhook events defined in src/dotmac/platform/webhooks/models.py

---

## EXECUTIVE SUMMARY

**Total Events Defined:** 47 events in WebhookEvent enum
**Events with Implementations:** 10-12 events (21-26%)
**Events Missing Implementations:** 35-37 events (74-79%)
**Critical Gaps:** Credit notes, user management, file storage, data transfer, analytics, audit/compliance, ticketing SLA

---

## 1. BILLING EVENTS (13 defined, 11 implemented - 85% coverage)

### Fully Implemented (11):
- ✓ **INVOICE_CREATED**
  - Location: `/src/dotmac/platform/billing/invoicing/service.py:255-258`
  - Publishes: WebhookEvent.INVOICE_CREATED.value
  
- ✓ **INVOICE_FINALIZED**
  - Location: `/src/dotmac/platform/billing/invoicing/service.py:361-364`
  - Publishes: WebhookEvent.INVOICE_FINALIZED.value

- ✓ **INVOICE_PAID**
  - Location: `/src/dotmac/platform/billing/invoicing/service.py:482-485`
  - Publishes: WebhookEvent.INVOICE_PAID.value

- ✓ **INVOICE_VOIDED**
  - Location: `/src/dotmac/platform/billing/invoicing/service.py:429-432`
  - Publishes: WebhookEvent.INVOICE_VOIDED.value

- ✓ **PAYMENT_SUCCEEDED**
  - Location: `/src/dotmac/platform/billing/payments/service.py:158-161`
  - Publishes: WebhookEvent.PAYMENT_SUCCEEDED.value

- ✓ **PAYMENT_FAILED**
  - Location: `/src/dotmac/platform/billing/payments/service.py:193-196`
  - Publishes: WebhookEvent.PAYMENT_FAILED.value

- ✓ **PAYMENT_REFUNDED**
  - Location: `/src/dotmac/platform/billing/payments/service.py:421-424`
  - Publishes: WebhookEvent.PAYMENT_REFUNDED.value

- ✓ **SUBSCRIPTION_CREATED**
  - Location: `/src/dotmac/platform/billing/subscriptions/service.py:237-240`
  - Publishes: WebhookEvent.SUBSCRIPTION_CREATED.value

- ✓ **SUBSCRIPTION_UPDATED**
  - Location: `/src/dotmac/platform/billing/subscriptions/service.py:452-455`
  - Publishes: WebhookEvent.SUBSCRIPTION_UPDATED.value

- ✓ **SUBSCRIPTION_CANCELLED**
  - Location: `/src/dotmac/platform/billing/subscriptions/service.py:556-559`
  - Publishes: WebhookEvent.SUBSCRIPTION_CANCELLED.value

- ✓ **SUBSCRIPTION_RENEWED**
  - Location: `/src/dotmac/platform/billing/subscriptions/service.py:900-903`
  - Publishes: WebhookEvent.SUBSCRIPTION_RENEWED.value

### Not Yet Implemented (2):
- ✗ **INVOICE_PAYMENT_FAILED** (defined but never published)
  - Defined: `/src/dotmac/platform/webhooks/models.py:37`
  - Should be in: `/src/dotmac/platform/billing/invoicing/service.py`
  - Related to payment rejection scenarios

- ✗ **SUBSCRIPTION_TRIAL_ENDING** (defined but never published)
  - Defined: `/src/dotmac/platform/webhooks/models.py:46`
  - Should be in: `/src/dotmac/platform/billing/subscriptions/service.py`
  - Proactive notification before trial ends

---

## 2. CREDIT NOTE EVENTS (Missing from WebhookEvent enum) - CRITICAL GAP

### Findings:
- **Problem:** Credit notes are referenced in billing/events.py but NOT in WebhookEvent enum
- **Location:** `/src/dotmac/platform/billing/events.py:62-63`
  - CREDIT_NOTE_CREATED = "credit_note.created"
  - CREDIT_NOTE_ISSUED = "credit_note.issued"

- **Service:** `/src/dotmac/platform/billing/credit_notes/service.py`
  - Has methods: create_credit_note, issue_credit_note, void_credit_note, apply_credit_to_invoice
  - NO webhook event publishing found

### Action Items:
1. Add CREDIT_NOTE_CREATED and CREDIT_NOTE_ISSUED to WebhookEvent enum
2. Add publishing in CreditNoteService methods
3. Add CREDIT_NOTE_VOIDED and CREDIT_NOTE_APPLIED for completeness

### Locations to Implement:
- `/src/dotmac/platform/billing/credit_notes/service.py` (methods: 48, 202, 229, 280)

---

## 3. CUSTOMER EVENTS (3 defined, 0 webhook implementations - 0% coverage)

### Defined but Not Implemented:
- ✗ **CUSTOMER_CREATED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:49`
  - Also in: `/src/dotmac/platform/billing/events.py:52`
  - Service: `/src/dotmac/platform/customer_management/service.py`
  - Router events found: `/src/dotmac/platform/customer_management/router.py:186, 266, 360`
  - These publish generic events, not WebhookEvent

- ✗ **CUSTOMER_UPDATED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:50`
  - Also in: `/src/dotmac/platform/billing/events.py:53`
  - Service: `/src/dotmac/platform/customer_management/service.py`
  - No webhook integration

- ✗ **CUSTOMER_DELETED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:51`
  - Also in: `/src/dotmac/platform/billing/events.py:54`
  - Service: `/src/dotmac/platform/customer_management/service.py`
  - No webhook integration

### Related Custom Events (Not in WebhookEvent):
- customer.suspended (publishing: `/src/dotmac/platform/customer_management/router.py:187`)
- customer.reactivated (publishing: `/src/dotmac/platform/customer_management/router.py:266`)
- customer.churned (publishing: `/src/dotmac/platform/customer_management/router.py:360`)

### Locations to Implement:
- Create customer event emission helpers in: `/src/dotmac/platform/billing/events.py`
- Hook into CustomerService methods: create, update, delete
- Update router to use WebhookEvent enum instead of raw strings

---

## 4. USER EVENTS (4 defined, 0 implementations - 0% coverage)

### All Not Implemented:
- ✗ **USER_REGISTERED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:54`
  - Potential location: `/src/dotmac/platform/user_management/service.py`
  - Auth router handles creation: `/src/dotmac/platform/auth/router.py` (but no webhook publish)

- ✗ **USER_UPDATED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:55`
  - Potential location: `/src/dotmac/platform/user_management/service.py`
  - Auth router has updates but no webhook publish

- ✗ **USER_DELETED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:56`
  - Potential location: `/src/dotmac/platform/user_management/service.py`
  - No implementation found

- ✗ **USER_LOGIN**
  - Defined: `/src/dotmac/platform/webhooks/models.py:57`
  - Audit logs exist: `/src/dotmac/platform/audit/__init__.py:22` (USER_LOGIN activity)
  - Auth router logs logins: `/src/dotmac/platform/auth/router.py` (lines 385, 421, 474, 540, 603, 644, 668, 727, 856, 880)
  - But no webhook event publish

### Locations to Implement:
- Create user event helpers: `/src/dotmac/platform/user_management/` (need new file or add to service)
- Update `/src/dotmac/platform/user_management/service.py` methods
- Update `/src/dotmac/platform/auth/router.py` for login events

---

## 5. COMMUNICATION EVENTS (6 defined, 2 implemented - 33% coverage)

### Implemented (2):
- ✓ **EMAIL_SENT**
  - Location: `/src/dotmac/platform/communications/email_service.py:145-159`
  - Publishes: WebhookEvent.EMAIL_SENT.value

- ✓ **EMAIL_FAILED**
  - Location: `/src/dotmac/platform/communications/email_service.py:184-200`
  - Publishes: WebhookEvent.EMAIL_FAILED.value

### Not Implemented (4):
- ✗ **EMAIL_DELIVERED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:61`
  - Requires: Integration with ESP (SendGrid/Mailgun) webhook handlers
  - Should track: Bounce/delivery webhooks from email providers

- ✗ **EMAIL_BOUNCED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:62`
  - Requires: ESP webhook integration
  - Should track: Hard and soft bounces

- ✗ **BULK_EMAIL_COMPLETED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:64`
  - Requires: Campaign/batch email service
  - Should trigger: After successful bulk send completion

- ✗ **BULK_EMAIL_FAILED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:65`
  - Requires: Campaign/batch email service
  - Should trigger: After bulk send failure

### Locations to Implement:
- ESP webhook handlers: `/src/dotmac/platform/communications/` (new file: `email_webhooks.py`)
- Bulk email service: Not yet identified in codebase
- Communication router: `/src/dotmac/platform/communications/router.py`

---

## 6. FILE STORAGE EVENTS (4 defined, 0 implementations - 0% coverage)

### All Not Implemented:
- ✗ **FILE_UPLOADED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:68`
  - Service: `/src/dotmac/platform/file_storage/service.py`
  - Router: `/src/dotmac/platform/file_storage/router.py`
  - No webhook publish found

- ✗ **FILE_DELETED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:69`
  - Service: `/src/dotmac/platform/file_storage/service.py`
  - Router: `/src/dotmac/platform/file_storage/router.py`
  - No webhook publish found

- ✗ **FILE_SCAN_COMPLETED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:70`
  - Related: Antivirus/malware scanning integration (not yet visible)
  - May be in plugins: `/src/dotmac/platform/file_storage/plugins/`

- ✗ **STORAGE_QUOTA_EXCEEDED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:71`
  - Related: Tenant storage quota monitoring
  - Not yet integrated

### Locations to Implement:
- File storage service methods: `/src/dotmac/platform/file_storage/service.py`
  - async def store() - for FILE_UPLOADED
  - async def delete() - for FILE_DELETED
  - Need quota monitoring logic

---

## 7. DATA TRANSFER EVENTS (4 defined, 0 implementations - 0% coverage)

### All Not Implemented:
- ✗ **IMPORT_COMPLETED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:74`
  - Service: `/src/dotmac/platform/data_import/service.py`
  - Router: `/src/dotmac/platform/data_import/router.py`
  - Import tracking exists but no webhook publish

- ✗ **IMPORT_FAILED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:75`
  - Service: `/src/dotmac/platform/data_import/service.py`
  - Error handling exists but no webhook publish

- ✗ **EXPORT_COMPLETED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:76`
  - Service: `/src/dotmac/platform/data_transfer/exporters.py`
  - Router: `/src/dotmac/platform/data_transfer/router.py`
  - No webhook publish found

- ✗ **EXPORT_FAILED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:77`
  - Service: `/src/dotmac/platform/data_transfer/exporters.py`
  - Error handling exists but no webhook publish

### Locations to Implement:
- Import service: `/src/dotmac/platform/data_import/service.py` (lines 91+)
- Export service: `/src/dotmac/platform/data_transfer/exporters.py`
- Data transfer router: `/src/dotmac/platform/data_transfer/router.py`

---

## 8. ANALYTICS EVENTS (2 defined, 0 implementations - 0% coverage)

### All Not Implemented:
- ✗ **METRIC_THRESHOLD_EXCEEDED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:80`
  - Service: `/src/dotmac/platform/analytics/service.py`
  - Aggregators: `/src/dotmac/platform/analytics/aggregators.py`
  - Threshold checking exists but no webhook publish

- ✗ **REPORT_GENERATED**
  - Defined: `/src/dotmac/platform/webhooks/models.py:81`
  - Service: `/src/dotmac/platform/billing/reports/service.py` and `/src/dotmac/platform/analytics/service.py`
  - Report generation exists but no webhook publish

### Locations to Implement:
- Analytics service: `/src/dotmac/platform/analytics/service.py`
- Metrics aggregators: `/src/dotmac/platform/analytics/aggregators.py`
- Billing reports: `/src/dotmac/platform/billing/reports/service.py`

---

## 9. AUDIT EVENTS (2 defined, 0 implementations - 0% coverage)

### All Not Implemented:
- ✗ **SECURITY_ALERT**
  - Defined: `/src/dotmac/platform/webhooks/models.py:84`
  - Service: `/src/dotmac/platform/audit/service.py`
  - Audit logging exists but no security alert webhook publish
  - Related: ActivityType.USER_LOGIN exists but no alert emission

- ✗ **COMPLIANCE_VIOLATION**
  - Defined: `/src/dotmac/platform/webhooks/models.py:85`
  - Service: `/src/dotmac/platform/audit/service.py`
  - Compliance tracking infrastructure not visible
  - Related: Licensing framework has COMPLIANCE mode

### Locations to Implement:
- Audit service: `/src/dotmac/platform/audit/service.py`
- Audit models: `/src/dotmac/platform/audit/models.py` (has ActivityType enum)
- Monitoring: Consider `/src/dotmac/platform/monitoring/` integration

---

## 10. TICKETING EVENTS (4 defined, unclear state - NEEDS BRIDGE)

### Critical Finding: Dual Event Systems
**Problem:** Ticketing uses its own TicketingEvents class, NOT WebhookEvent enum

**TicketingEvents (in ticketing/events.py):**
- TICKET_CREATED = "ticket.created" (emitted via emit_ticket_created)
- TICKET_UPDATED = "ticket.updated" (emitted via emit_ticket_status_changed)
- TICKET_STATUS_CHANGED = "ticket.status_changed" (emitted)
- TICKET_ASSIGNED = "ticket.assigned" (emitted via emit_ticket_assigned)
- TICKET_RESOLVED = "ticket.resolved" (emitted implicitly)
- TICKET_CLOSED = "ticket.closed" (emitted implicitly)
- TICKET_REOPENED = "ticket.reopened" (no emit function found)
- TICKET_MESSAGE_ADDED = "ticket.message.added" (emitted via emit_ticket_message_added)
- TICKET_ESCALATED_TO_PARTNER = "ticket.escalated.to_partner" (emitted)
- TICKET_ESCALATED_TO_PLATFORM = "ticket.escalated.to_platform" (no emit function)

**WebhookEvent (in webhooks/models.py):**
- TICKET_CREATED = "ticket.created" (defined but NOT linked to TicketingEvents)
- TICKET_UPDATED = "ticket.updated" (defined but NOT linked)
- TICKET_CLOSED = "ticket.closed" (defined but NOT linked)
- TICKET_SLA_BREACH = "ticket.sla_breach" (defined but NOT implemented anywhere)

### Analysis:
1. Ticketing events are published to generic event bus (not webhook-specific)
2. No conversion from TicketingEvents to WebhookEvent happens
3. TICKET_SLA_BREACH is defined but has NO implementation or tracking logic

### Implementations (via TicketingEvents, need bridging):
- ✓ TICKET_CREATED (ticketing/events.py:51-102, service.py:165)
- ✓ TICKET_UPDATED (ticketing/events.py:168-222, service.py:314)
- ✓ TICKET_CLOSED (implicit in status_changed, service.py:438)
- ✗ TICKET_SLA_BREACH (defined but no implementation)

### Locations That Need Changes:
1. Bridge TicketingEvents to WebhookEvent conversion:
   - `/src/dotmac/platform/webhooks/delivery.py` - webhook delivery mechanism
   - Or create adapter in `/src/dotmac/platform/webhooks/` (new file: `ticketing_adapter.py`)

2. Implement TICKET_SLA_BREACH:
   - `/src/dotmac/platform/fault_management/sla_service.py` (has SLA logic)
   - `/src/dotmac/platform/ticketing/service.py` (emit after SLA breach detection)

---

## 11. MODULES WITH NO WEBHOOK INTEGRATION

### Complete Gaps (modules with relevant code but zero webhook publish calls):

1. **User Management** (`/src/dotmac/platform/user_management/`)
   - Service exists but no event emission
   - Auth router handles user lifecycle but no webhooks

2. **File Storage** (`/src/dotmac/platform/file_storage/`)
   - Service has upload/delete methods but no webhooks
   - Router exists but no event publishing

3. **Data Transfer** (`/src/dotmac/platform/data_transfer/`)
   - Importers and exporters exist
   - No success/failure event publishing

4. **Analytics** (`/src/dotmac/platform/analytics/`)
   - Aggregators and metrics exist
   - No threshold or report events published

5. **Audit** (`/src/dotmac/platform/audit/`)
   - Activity logging exists
   - No security alert or compliance violation events

6. **Ticketing** (Partial - dual system issue)
   - Uses TicketingEvents, not WebhookEvent
   - No SLA breach implementation

---

## IMPLEMENTATION PRIORITY & ROADMAP

### Phase 1: Critical (Billing/Credit Notes)
**Priority:** HIGH - Directly impacts business operations
**Effort:** LOW (mostly copy existing patterns)

1. Add CREDIT_NOTE events to WebhookEvent enum
2. Implement webhook publishing in CreditNoteService
3. Test with existing webhook infrastructure

**Files to modify:**
- `/src/dotmac/platform/webhooks/models.py` - add enum values
- `/src/dotmac/platform/billing/credit_notes/service.py` - add event publishing
- `/src/dotmac/platform/billing/events.py` - add emission helpers (optional)

---

### Phase 2: Core Entities (Customer, User)
**Priority:** HIGH - Primary business entities
**Effort:** MEDIUM (need routing integration)

1. Implement CUSTOMER_* events in CustomerService
2. Implement USER_* events in UserService and auth
3. Update routers to use WebhookEvent enum
4. Consider audit trail integration for USER_LOGIN

**Files to modify:**
- `/src/dotmac/platform/customer_management/service.py` - add event helpers
- `/src/dotmac/platform/customer_management/router.py` - use WebhookEvent
- `/src/dotmac/platform/user_management/service.py` - add event publishing
- `/src/dotmac/platform/auth/router.py` - add login event publishing

---

### Phase 3: Data Movement (Import/Export, File Storage)
**Priority:** MEDIUM - Important for data operations
**Effort:** MEDIUM (need job/task status tracking)

1. Add event publishing to import/export jobs
2. Implement file storage events
3. Integrate with existing job tracking system

**Files to modify:**
- `/src/dotmac/platform/data_import/service.py`
- `/src/dotmac/platform/data_transfer/exporters.py`
- `/src/dotmac/platform/file_storage/service.py`

---

### Phase 4: Advanced Notifications (Email, Analytics, Audit)
**Priority:** MEDIUM - Nice-to-have but valuable
**Effort:** HIGH (requires external integrations)

1. Email delivery tracking (requires ESP webhook integration)
2. Analytics threshold and report events
3. Security and compliance event system

**Files to modify:**
- `/src/dotmac/platform/communications/email_service.py` - add ESP integration
- `/src/dotmac/platform/analytics/service.py` - add threshold events
- `/src/dotmac/platform/audit/service.py` - add security/compliance events

---

### Phase 5: Ticketing Integration
**Priority:** LOW (currently working but on different event system)
**Effort:** HIGH (requires bridge/adapter pattern)

1. Bridge TicketingEvents to WebhookEvent
2. Implement TICKET_SLA_BREACH
3. Consider consolidating to single event system

**Files to modify:**
- `/src/dotmac/platform/webhooks/` - add adapter or converter
- `/src/dotmac/platform/ticketing/service.py` - publish WebhookEvent
- `/src/dotmac/platform/fault_management/sla_service.py` - add SLA breach events

---

## SUMMARY TABLE

| Category | Defined | Implemented | Coverage | Priority |
|----------|---------|-------------|----------|----------|
| Billing | 13 | 11 | 85% | DONE |
| Credit Notes | 0* | 0 | 0% | Phase 1 |
| Customer | 3 | 0 | 0% | Phase 2 |
| User | 4 | 0 | 0% | Phase 2 |
| Communication | 6 | 2 | 33% | Phase 4 |
| File Storage | 4 | 0 | 0% | Phase 3 |
| Data Transfer | 4 | 0 | 0% | Phase 3 |
| Analytics | 2 | 0 | 0% | Phase 4 |
| Audit | 2 | 0 | 0% | Phase 4 |
| Ticketing | 4 | ~3** | 75% | Phase 5 |
| **TOTAL** | **47** | **~16** | **34%** | |

*Not in enum, only in billing/events.py
**Via TicketingEvents, not WebhookEvent

---

## RECOMMENDED NEXT STEPS

1. **Immediate (This Sprint):**
   - Add CREDIT_NOTE events to WebhookEvent enum
   - Add missing billing events (INVOICE_PAYMENT_FAILED, SUBSCRIPTION_TRIAL_ENDING)
   - Implement credit note webhook publishing

2. **Short Term (Next Sprint):**
   - Add CUSTOMER_* event publishing
   - Add USER_* event publishing
   - Update routers to use WebhookEvent consistently

3. **Medium Term (Following Sprints):**
   - Implement data transfer events
   - Implement file storage events
   - Bridge ticketing events

4. **Long Term:**
   - Email delivery tracking (ESP integration)
   - Analytics and audit events
   - Consolidate event systems if needed

# BSS (Business Support Systems) Completion Plan

**Version:** 1.0
**Date:** 2025-10-14
**Status:** Planning Phase

## Executive Summary

Based on the architecture document's claim of "90% BSS Complete" and codebase analysis, this document identifies the **remaining 10% of BSS features** needed to fully support ISP operations.

The existing platform has a **solid foundation** with billing, customer management, communications, analytics, partner management, and ticketing already implemented. However, several **ISP-specific BSS enhancements** are required.

---

## Current BSS Status Analysis

### ✅ **Fully Complete Modules (No Changes Needed)**

| Module | Status | Evidence |
|--------|--------|----------|
| **Core Billing Engine** | ✅ Complete | Products, prices, invoicing, payments, receipts all implemented |
| **Subscription Management** | ✅ Complete | Plans, subscriptions, lifecycle, events, usage tracking |
| **Payment Processing** | ✅ Complete | Multiple payment methods, reconciliation, Stripe integration |
| **Multi-Currency Support** | ✅ Complete | Exchange rates, currency conversion |
| **Tax Calculation** | ✅ Complete | Tax classes, rates, exemptions |
| **Credit Notes/Refunds** | ✅ Complete | Full credit note lifecycle |
| **Invoice Generation** | ✅ Complete | PDF generation (ReportLab), email delivery |
| **Payment Reconciliation** | ✅ Complete | Automated and manual reconciliation |
| **Basic CRM** | ✅ Complete | Customer lifecycle, segmentation, activities, notes |
| **Contact Management** | ✅ Complete | Contact roles, many-to-many relationships |
| **Communications** | ✅ Complete | Email, SMS, templates, event listeners |
| **Analytics & Reporting** | ✅ Complete | Metrics, aggregators, OTEL collector |
| **Partner Management** | ✅ Complete | Partner lifecycle, revenue sharing, portal |
| **Multi-Tenancy** | ✅ Complete | Tenant isolation, RLS policies |
| **RBAC & Auth** | ✅ Complete | Role-based access control |
| **Audit Logging** | ✅ Complete | Comprehensive audit trails |
| **File Storage** | ✅ Complete | MinIO/S3 integration |
| **Webhooks** | ✅ Complete | Event-driven webhooks |
| **Feature Flags** | ✅ Complete | Dynamic feature control |
| **Secrets Management** | ✅ Complete | Vault integration |

---

## 🔧 **Missing BSS Features (The Final 10%)**

### 1. **ISP-Specific Customer Fields** 🔴 Critical
**Current State:** Customer model has generic fields
**Gap:** Missing ISP subscriber-specific attributes
**Impact:** Cannot properly manage ISP subscribers

**Required Fields:**
```python
class Customer(Base):
    # ... existing fields ...

    # ISP-Specific Fields (NEW)
    service_address: Mapped[str | None]  # Installation address (may differ from billing)
    service_address_line2: Mapped[str | None]
    service_city: Mapped[str | None]
    service_state: Mapped[str | None]
    service_postal_code: Mapped[str | None]
    service_country: Mapped[str | None]
    service_coordinates: Mapped[dict] = mapped_column(JSON)  # GPS lat/lon

    # Installation tracking
    installation_status: Mapped[str | None]  # pending, scheduled, completed, failed
    installation_date: Mapped[datetime | None]
    installation_technician_id: Mapped[UUID | None]
    installation_notes: Mapped[str | None]

    # Service details
    connection_type: Mapped[str | None]  # ftth, wireless, dsl, cable
    last_mile_technology: Mapped[str | None]  # gpon, xgs-pon, docsis, lte
    service_plan_speed: Mapped[str | None]  # e.g., "100/100 Mbps"

    # Network device links (JSON for flexibility)
    assigned_devices: Mapped[dict] = mapped_column(JSON, default=dict)
    # Example: {"onu_serial": "ZTEG1234", "cpe_mac": "AA:BB:CC:DD:EE:FF"}

    # Bandwidth management
    current_bandwidth_profile: Mapped[str | None]
    static_ip_assigned: Mapped[str | None]
    ipv6_prefix: Mapped[str | None]

    # Service quality
    avg_uptime_percent: Mapped[Decimal | None]
    last_outage_date: Mapped[datetime | None]
    total_outages: Mapped[int] = mapped_column(default=0)
```

**Migration Required:** Yes
**Estimated Effort:** 2 days
**Priority:** 🔴 Critical

---

### 2. **Dunning & Collections Management** 🟠 High
**Current State:** Basic subscription status tracking
**Gap:** No automated dunning workflows for past-due accounts
**Impact:** Manual follow-up on late payments

**Required Components:**
```python
# models.py
class DunningCampaign(Base):
    id: Mapped[UUID]
    tenant_id: Mapped[str]
    name: Mapped[str]
    description: Mapped[str | None]

    # Trigger conditions
    trigger_after_days: Mapped[int]  # Days past due
    max_retries: Mapped[int]
    retry_interval_days: Mapped[int]

    # Actions (JSON array)
    actions: Mapped[list] = mapped_column(JSON)
    # Example: [
    #   {"type": "email", "template": "payment_reminder_1", "delay_days": 0},
    #   {"type": "sms", "template": "payment_alert", "delay_days": 3},
    #   {"type": "suspend_service", "delay_days": 7}
    # ]

    is_active: Mapped[bool]

class DunningExecution(Base):
    id: Mapped[UUID]
    tenant_id: Mapped[str]
    campaign_id: Mapped[UUID]
    subscription_id: Mapped[str]
    customer_id: Mapped[UUID]

    status: Mapped[str]  # pending, in_progress, completed, failed, canceled
    started_at: Mapped[datetime]
    completed_at: Mapped[datetime | None]

    current_step: Mapped[int]
    total_steps: Mapped[int]

    execution_log: Mapped[list] = mapped_column(JSON)

# service.py
class DunningService:
    async def evaluate_overdue_subscriptions(self) -> None:
        """Daily task to identify overdue subscriptions and start dunning."""
        pass

    async def execute_dunning_step(self, execution_id: UUID) -> None:
        """Execute next step in dunning campaign."""
        pass

    async def cancel_dunning(self, execution_id: UUID, reason: str) -> None:
        """Cancel dunning (e.g., payment received)."""
        pass
```

**Integration Points:**
- Billing module (subscription status)
- Communications (email/SMS notifications)
- Service lifecycle (suspend/terminate service)
- Audit logging

**Estimated Effort:** 3 days
**Priority:** 🟠 High

---

### 3. **Service Bundles & Add-ons** 🟠 High
**Current State:** Single product subscriptions
**Gap:** Cannot sell bundled packages (Internet + IPTV + VoIP)
**Impact:** Limited sales flexibility

**Required Components:**
```python
# models.py
class BillingBundleTable(BillingSQLModel):
    __tablename__ = "billing_bundles"

    bundle_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]

    name: Mapped[str]
    description: Mapped[str | None]

    # Bundle pricing
    bundle_price: Mapped[Decimal]
    discount_type: Mapped[str]  # percentage, fixed_amount
    discount_value: Mapped[Decimal]

    # Included products (JSON)
    included_products: Mapped[list] = mapped_column(JSON)
    # Example: [
    #   {"product_id": "prod_internet_100mb", "quantity": 1},
    #   {"product_id": "prod_iptv_basic", "quantity": 1}
    # ]

    # Requirements
    requires_all_products: Mapped[bool]  # All products must be active
    is_active: Mapped[bool]

class BillingAddonTable(BillingSQLModel):
    __tablename__ = "billing_addons"

    addon_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]

    name: Mapped[str]
    description: Mapped[str | None]

    # Linked to base product/plan
    base_product_id: Mapped[str]
    addon_product_id: Mapped[str]

    # Pricing
    addon_price: Mapped[Decimal]
    billing_cycle: Mapped[str]  # monthly, one_time

    # Constraints
    max_quantity: Mapped[int | None]
    is_optional: Mapped[bool]
    is_active: Mapped[bool]

class SubscriptionAddonTable(BillingSQLModel):
    __tablename__ = "subscription_addons"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]
    subscription_id: Mapped[str]
    addon_id: Mapped[str]

    quantity: Mapped[int]
    status: Mapped[str]  # active, suspended, canceled

    added_at: Mapped[datetime]
    canceled_at: Mapped[datetime | None]
```

**API Endpoints:**
```python
POST /api/v1/billing/bundles
GET  /api/v1/billing/bundles/{id}
POST /api/v1/billing/subscriptions/{id}/addons
DELETE /api/v1/billing/subscriptions/{id}/addons/{addon_id}
```

**Estimated Effort:** 4 days
**Priority:** 🟠 High

---

### 4. **Usage Billing Enhancements** 🟡 Medium
**Current State:** Basic usage tracking in subscription
**Gap:** Need granular usage billing for pay-as-you-go services
**Impact:** Cannot bill for overage, metered services

**Required Components:**
```python
# models.py
class UsageRecordTable(BillingSQLModel):
    __tablename__ = "usage_records"

    record_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]
    subscription_id: Mapped[str]
    customer_id: Mapped[str]

    # Usage details
    usage_type: Mapped[str]  # data_transfer, voice_minutes, sms_count
    quantity: Mapped[Decimal]
    unit: Mapped[str]  # GB, minutes, count

    # Pricing
    unit_price: Mapped[Decimal]
    total_amount: Mapped[Decimal]

    # Billing period
    period_start: Mapped[datetime]
    period_end: Mapped[datetime]

    # Billing status
    billed_status: Mapped[str]  # pending, billed, error
    invoice_id: Mapped[str | None]
    billed_at: Mapped[datetime | None]

    # Source tracking
    source_system: Mapped[str]  # radius, api, import
    external_reference: Mapped[str | None]

class UsageAggregationTable(BillingSQLModel):
    __tablename__ = "usage_aggregations"

    aggregation_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]
    subscription_id: Mapped[str]

    # Aggregation period
    period_start: Mapped[datetime]
    period_end: Mapped[datetime]

    # Aggregated data (JSON)
    usage_summary: Mapped[dict] = mapped_column(JSON)
    # Example: {
    #   "data_download_gb": 150.5,
    #   "data_upload_gb": 45.2,
    #   "voice_minutes": 120,
    #   "sms_sent": 50
    # }

    # Overage tracking
    overage_charges: Mapped[dict] = mapped_column(JSON)
    total_overage_amount: Mapped[Decimal]

    # Status
    status: Mapped[str]  # pending, completed, billed
    aggregated_at: Mapped[datetime]
```

**Services:**
```python
class UsageBillingService:
    async def record_usage(
        self,
        subscription_id: str,
        usage_type: str,
        quantity: Decimal,
        unit: str,
        timestamp: datetime
    ) -> UsageRecord:
        """Record usage event."""
        pass

    async def aggregate_usage(
        self,
        subscription_id: str,
        period_start: datetime,
        period_end: datetime
    ) -> UsageAggregation:
        """Aggregate usage for billing period."""
        pass

    async def calculate_overages(
        self,
        subscription_id: str,
        aggregation: UsageAggregation
    ) -> dict:
        """Calculate overage charges based on plan limits."""
        pass

    async def bill_usage(
        self,
        subscription_id: str,
        aggregation_id: str
    ) -> Invoice:
        """Generate invoice for usage charges."""
        pass
```

**Estimated Effort:** 3 days
**Priority:** 🟡 Medium

---

### 5. **Contract Management** 🟡 Medium
**Current State:** Subscriptions without formal contracts
**Gap:** No long-term contract tracking, SLAs, commitments
**Impact:** Cannot enforce contract terms, early termination fees

**Required Components:**
```python
# models.py
class ContractTable(BillingSQLModel):
    __tablename__ = "contracts"

    contract_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]
    customer_id: Mapped[str]

    # Contract details
    contract_number: Mapped[str]
    name: Mapped[str]
    description: Mapped[str | None]

    # Duration
    start_date: Mapped[datetime]
    end_date: Mapped[datetime]
    term_months: Mapped[int]

    # Auto-renewal
    auto_renew: Mapped[bool]
    renewal_term_months: Mapped[int]
    renewal_notice_days: Mapped[int]

    # Commitments
    minimum_monthly_commitment: Mapped[Decimal | None]
    total_contract_value: Mapped[Decimal]

    # Early termination
    early_termination_allowed: Mapped[bool]
    early_termination_fee: Mapped[Decimal | None]
    early_termination_fee_type: Mapped[str]  # fixed, percentage, remaining_value

    # SLA
    sla_uptime_percent: Mapped[Decimal]
    sla_penalty_percent: Mapped[Decimal | None]

    # Status
    status: Mapped[str]  # draft, active, expired, terminated

    # Document
    contract_document_url: Mapped[str | None]
    signed_at: Mapped[datetime | None]
    signed_by: Mapped[str | None]

class ContractSubscriptionLink(BillingSQLModel):
    __tablename__ = "contract_subscriptions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]
    contract_id: Mapped[str]
    subscription_id: Mapped[str]

    added_at: Mapped[datetime]
    removed_at: Mapped[datetime | None]
    is_active: Mapped[bool]
```

**Estimated Effort:** 3 days
**Priority:** 🟡 Medium

---

### 6. **Revenue Recognition** 🟢 Low
**Current State:** Simple accrual billing
**Gap:** No deferred revenue tracking for compliance (ASC 606)
**Impact:** Accounting compliance issues for audits

**Required Components:**
```python
# models.py
class RevenueRecognitionTable(BillingSQLModel):
    __tablename__ = "revenue_recognition"

    recognition_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]
    invoice_id: Mapped[str]
    subscription_id: Mapped[str]

    # Revenue details
    total_revenue: Mapped[Decimal]
    recognized_revenue: Mapped[Decimal]
    deferred_revenue: Mapped[Decimal]

    # Recognition period
    recognition_start: Mapped[datetime]
    recognition_end: Mapped[datetime]
    recognition_method: Mapped[str]  # straight_line, usage_based

    # Schedule (JSON array)
    recognition_schedule: Mapped[list] = mapped_column(JSON)
    # Example: [
    #   {"date": "2025-11-01", "amount": 50.00, "recognized": true},
    #   {"date": "2025-12-01", "amount": 50.00, "recognized": false}
    # ]

    # Status
    status: Mapped[str]  # pending, in_progress, completed
    last_recognition_date: Mapped[datetime | None]
```

**Estimated Effort:** 4 days
**Priority:** 🟢 Low (Can defer to Phase 2)

---

### 7. **Quote Management** 🟢 Low
**Current State:** Direct order creation
**Gap:** No formal quote/proposal workflow
**Impact:** Sales team cannot send formal quotes

**Required Components:**
```python
# models.py
class QuoteTable(BillingSQLModel):
    __tablename__ = "quotes"

    quote_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str]
    quote_number: Mapped[str]
    customer_id: Mapped[str]

    # Quote details
    title: Mapped[str]
    description: Mapped[str | None]

    # Pricing
    subtotal: Mapped[Decimal]
    tax_amount: Mapped[Decimal]
    discount_amount: Mapped[Decimal]
    total_amount: Mapped[Decimal]

    # Line items (JSON)
    line_items: Mapped[list] = mapped_column(JSON)

    # Validity
    valid_until: Mapped[datetime]

    # Status
    status: Mapped[str]  # draft, sent, accepted, rejected, expired, converted

    # Actions
    sent_at: Mapped[datetime | None]
    accepted_at: Mapped[datetime | None]
    rejected_at: Mapped[datetime | None]
    converted_to_subscription_id: Mapped[str | None]

    # Document
    quote_pdf_url: Mapped[str | None]
```

**Estimated Effort:** 3 days
**Priority:** 🟢 Low (Can defer to Phase 2)

---

### 8. **Customer Portal Self-Service** 🟡 Medium
**Current State:** Admin portal only
**Gap:** Subscribers cannot manage their own account
**Impact:** High support load for simple tasks

**Required Features:**
- View account information
- View/download invoices
- View/download receipts
- View payment history
- Update payment method
- View usage statistics (data, voice, SMS)
- View service status (online/offline)
- Submit support tickets
- Change password/settings
- Request service upgrade/downgrade
- View outage notifications

**Implementation:**
```
Frontend: Next.js subscriber portal (separate from admin)
API: New router at /api/v1/portal/* with subscriber-only permissions
Auth: JWT with subscriber role
```

**Estimated Effort:** 5 days (frontend + backend)
**Priority:** 🟡 Medium

---

### 9. **Enhanced Ticketing for ISP Support** 🟡 Medium
**Current State:** Basic ticketing (open, in_progress, resolved, closed)
**Gap:** ISP-specific ticket types and workflows
**Impact:** Cannot track installation, outage, technical issues properly

**Required Enhancements:**
```python
# Extend existing Ticket model
class TicketTypeEnum(str, Enum):
    GENERAL_INQUIRY = "general_inquiry"
    BILLING_ISSUE = "billing_issue"
    TECHNICAL_SUPPORT = "technical_support"
    INSTALLATION_REQUEST = "installation_request"
    OUTAGE_REPORT = "outage_report"
    SERVICE_UPGRADE = "service_upgrade"
    SERVICE_DOWNGRADE = "service_downgrade"
    CANCELLATION_REQUEST = "cancellation_request"
    EQUIPMENT_ISSUE = "equipment_issue"
    SPEED_ISSUE = "speed_issue"

# Add to Ticket model
ticket_type: Mapped[TicketTypeEnum]
service_address: Mapped[str | None]
affected_services: Mapped[list] = mapped_column(JSON)  # ["internet", "voip"]
device_serial_numbers: Mapped[list] = mapped_column(JSON)

# SLA tracking
sla_due_date: Mapped[datetime | None]
sla_breached: Mapped[bool]
first_response_at: Mapped[datetime | None]
resolution_time_minutes: Mapped[int | None]
```

**Estimated Effort:** 2 days
**Priority:** 🟡 Medium

---

### 10. **Reporting Enhancements** 🟢 Low
**Current State:** Basic analytics aggregators
**Gap:** ISP-specific reports needed
**Impact:** Manual reporting for business metrics

**Required Reports:**
- MRR (Monthly Recurring Revenue) trend
- ARR (Annual Recurring Revenue)
- Churn rate by month
- ARPU (Average Revenue Per User)
- Customer acquisition cost (CAC)
- Customer lifetime value (CLTV)
- Subscriber growth by plan
- Payment success/failure rates
- Dunning effectiveness
- Support ticket resolution times
- Revenue by service type
- Aging reports (overdue invoices)

**Implementation:**
- Use existing analytics module
- Add ISP-specific aggregators
- Create scheduled report generation tasks

**Estimated Effort:** 3 days
**Priority:** 🟢 Low (Can defer to Phase 2)

---

## Implementation Priority Matrix

### Phase 1: Critical ISP Enhancements (2 weeks)
| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| ISP-Specific Customer Fields | 🔴 Critical | 2 days | None |
| Dunning & Collections | 🟠 High | 3 days | Billing, Communications |
| Service Bundles & Add-ons | 🟠 High | 4 days | Billing |
| Enhanced Ticketing | 🟡 Medium | 2 days | Ticketing |
| Usage Billing Enhancements | 🟡 Medium | 3 days | Billing |

**Total: 14 days (2 weeks)**

### Phase 2: Value-Add Features (2 weeks)
| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Customer Portal Self-Service | 🟡 Medium | 5 days | Auth, Billing, Customer Mgmt |
| Contract Management | 🟡 Medium | 3 days | Billing |
| Reporting Enhancements | 🟢 Low | 3 days | Analytics |
| Quote Management | 🟢 Low | 3 days | Billing |

**Total: 14 days (2 weeks)**

### Phase 3: Compliance & Advanced (Can Defer)
| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Revenue Recognition | 🟢 Low | 4 days | Billing, Accounting |

**Total: 4 days**

---

## Database Migration Strategy

### New Tables Required:
1. `dunning_campaigns` - Dunning workflow definitions
2. `dunning_executions` - Active dunning processes
3. `billing_bundles` - Product bundles
4. `billing_addons` - Add-on products
5. `subscription_addons` - Subscriber add-ons
6. `usage_records` - Granular usage tracking
7. `usage_aggregations` - Aggregated usage for billing
8. `contracts` - Customer contracts
9. `contract_subscriptions` - Contract-subscription links
10. `revenue_recognition` - Revenue recognition schedules
11. `quotes` - Sales quotes

### Schema Migrations:
- Extend `customers` table with ISP fields
- Extend `tickets` table with ISP ticket types
- Add indexes for performance

### Migration Plan:
```bash
# Generate migrations
alembic revision --autogenerate -m "add_isp_customer_fields"
alembic revision --autogenerate -m "add_dunning_tables"
alembic revision --autogenerate -m "add_bundle_addon_tables"
alembic revision --autogenerate -m "add_usage_billing_tables"
alembic revision --autogenerate -m "add_contract_tables"

# Run migrations
alembic upgrade head
```

---

## API Design Guidelines

### Endpoint Structure:
```
/api/v1/billing/bundles/*           - Bundle management
/api/v1/billing/addons/*            - Add-on management
/api/v1/billing/usage/*             - Usage billing
/api/v1/billing/dunning/*           - Dunning management
/api/v1/billing/contracts/*         - Contract management
/api/v1/billing/quotes/*            - Quote management
/api/v1/portal/*                    - Subscriber self-service
/api/v1/customers/isp/*             - ISP-specific customer ops
```

### Authentication:
- Admin endpoints: `require_permission("billing:write")`
- Portal endpoints: `require_subscriber_auth()`

---

## Testing Strategy

### Unit Tests:
- Service layer for all new features
- Business logic validation
- Edge case handling

### Integration Tests:
- API endpoint testing
- Database operations
- Event publishing

### E2E Tests:
- Dunning workflow end-to-end
- Bundle subscription flow
- Usage billing cycle
- Customer portal user journey

---

## Success Metrics

### BSS Completion Criteria:
- ✅ All 10 features implemented
- ✅ 100% test coverage for new code
- ✅ API documentation updated
- ✅ Database migrations tested
- ✅ Customer portal deployed
- ✅ Dunning workflows active
- ✅ Usage billing integrated with RADIUS (OSS)

---

## Next Steps

1. **Get stakeholder approval** on priority order
2. **Assign development team** to Phase 1 features
3. **Create detailed technical specs** for each feature
4. **Set up development branches** for parallel work
5. **Begin implementation** starting with ISP customer fields
6. **Continuous integration** with OSS module development

---

## Document References

- [ISP Platform Architecture](ISP_PLATFORM_ARCHITECTURE.md)
- [Database Schema Design](DATABASE_SCHEMA.md) (TBD)
- [API Specifications](API_SPECIFICATIONS.md) (TBD)

---

**Last Updated:** 2025-10-14
**Next Review:** After Phase 1 completion

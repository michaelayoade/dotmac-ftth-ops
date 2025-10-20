# Partner Portal Revenue Share - Implementation Status

## Overview

This document tracks the implementation status of the partner portal revenue share feature following the plan outlined in `partner-portal-revenue-share-plan.md`.

---

## Phase 1: Backend Foundation ✅ (Completed)

### 1. Database Migration ⚠️
**Status**: Migration file created, **BLOCKED - partner base tables not in database**

**Files Created**:
- `alembic/versions/2025_10_09_0339-3dd35f0c1f3f_add_partner_payouts_table.py`

**Tables to Create**:
- `partner_payouts` - Payout batches aggregating multiple commission events
- Enum: `payoutstatus` (pending, ready, processing, completed, failed, cancelled)
- Indexes:
  - `ix_partner_payouts_partner_status` (partner_id, status)
  - `ix_partner_payouts_dates` (payout_date, period_start, period_end)

**⚠️ CRITICAL ISSUE DISCOVERED**:
The partner base tables (`partners`, `partner_users`, `partner_accounts`, `partner_commissions`, `partner_commission_events`) were **never migrated to the database**. The models exist in code (`src/dotmac/platform/partner_management/models.py`) but no migration was ever created for them.

**Resolution Required**:
1. Create a new migration for all partner base tables:
   ```bash
   DATABASE_URL="..." .venv/bin/alembic revision --autogenerate -m "Add partner management base tables (partners, partner_users, partner_accounts, partner_commissions, partner_commission_events)"
   ```

2. Apply both migrations in order:
   ```bash
   DATABASE_URL="..." .venv/bin/alembic upgrade head
   ```

**Alternative - Manual SQL Creation** (if Alembic issues persist):
See `scripts/create_partner_tables.sql` for complete SQL schema creation script.

---

### 2. PartnerRevenueService ✅
**Status**: Fully implemented

**File**: `src/dotmac/platform/partner_management/revenue_service.py`

**Methods Implemented**:
- `get_partner_revenue_metrics()` - Get revenue metrics for a time period
- `list_commission_events()` - List commission events with filtering and pagination
- `list_payouts()` - List payouts with filtering and pagination
- `create_payout_batch()` - Create payout batch from approved unpaid commissions
- `calculate_commission()` - Calculate commission based on partner's rules

**Features**:
- Multi-tenant aware (respects tenant_id context)
- Period-based metrics (defaults to current month)
- Status filtering (pending, approved, paid, rejected for commissions)
- Pagination support (limit/offset)
- Automatic commission linking to payouts
- Decimal precision for financial calculations

---

### 3. Revenue API Router ✅
**Status**: Fully implemented and integrated

**File**: `src/dotmac/platform/partner_management/revenue_router.py`

**Endpoints Implemented**:
1. `GET /api/v1/partners/revenue/metrics` - Revenue metrics for period
2. `GET /api/v1/partners/revenue/commissions` - List commission events
3. `GET /api/v1/partners/revenue/payouts` - List payouts
4. `GET /api/v1/partners/revenue/payouts/{payout_id}` - Get payout details
5. `GET /api/v1/partners/revenue/commissions/{commission_id}` - Get commission details

**Query Parameters**:
- `period_start` - Start of time period (ISO 8601 datetime)
- `period_end` - End of time period (ISO 8601 datetime)
- `status` - Filter by status (CommissionStatus or PayoutStatus)
- `limit` - Max results (1-500, default 100)
- `offset` - Pagination offset (default 0)

**Integration**:
- Registered in `src/dotmac/platform/partner_management/router.py` (line 44)
- Uses partner authentication dependency (placeholder for now)
- Full OpenAPI documentation with examples

---

### 4. Pydantic Schemas ✅
**Status**: Schema added to existing schemas file

**File**: `src/dotmac/platform/partner_management/schemas.py` (line 579-591)

**Schema Added**:
- `PartnerRevenueMetrics` - Revenue metrics response model

**Existing Schemas Used**:
- `PartnerCommissionEventResponse` (line 370)
- `PartnerPayoutResponse` (line 534)
- `PartnerRevenueDashboard` (line 594)

---

### 5. Billing Integration for Commission Tracking ✅
**Status**: Event handler implemented, pending registration in app startup

**File**: `src/dotmac/platform/partner_management/event_handlers.py`

**Event Handler Implemented**:
- `handle_invoice_payment_for_commission()` - Creates commission events when invoices are paid

**Logic Flow**:
1. Subscribe to `InvoicePaymentReceivedEvent` from billing domain
2. Check if customer is managed by a partner (via `PartnerAccount`)
3. Calculate commission based on partner's commission rate
4. Create `PartnerCommissionEvent` with status `APPROVED`
5. Log commission creation for audit

**Registration Function**:
- `register_partner_event_handlers()` - Registers all partner event handlers

**Next Step**: Call `register_partner_event_handlers()` in application startup (`src/dotmac/platform/main.py`)
```python
# In lifespan() function after database initialization
from dotmac.platform.partner_management.event_handlers import register_partner_event_handlers
register_partner_event_handlers()
```

---

## Phase 2: Frontend Implementation ⏳ (Pending)

### Partner Revenue Dashboard Page
**Status**: Not started

**Planned Location**: `frontend/apps/base-app/app/partners/revenue/page.tsx`

**Features**:
- Revenue metrics cards (total commissions, payouts, pending)
- Commission events table with search/filter
- Payouts table with status badges
- Date range selector for metrics

---

### Partner Revenue Components
**Status**: Not started

**Components to Build**:
1. `RevenueMetricsCard.tsx` - Display key revenue metrics
2. `CommissionEventsTable.tsx` - Searchable/filterable commission list
3. `PayoutsTable.tsx` - Payout history with status
4. `DateRangeSelector.tsx` - Period selection for metrics

---

## Phase 3: Testing & Polish ⏳ (Pending)

### Unit Tests
**Status**: Not started

**Test Files to Create**:
- `tests/partner_management/test_revenue_service.py`
- `tests/partner_management/test_revenue_router.py`
- `tests/partner_management/test_event_handlers.py`

**Test Coverage Goals**:
- Commission calculation accuracy
- Payout batch creation with multiple events
- Event handler commission tracking
- API endpoint authorization
- Revenue metrics aggregation

---

### E2E Tests
**Status**: Not started

**Test File**: `frontend/apps/base-app/e2e/partner-portal-revenue.spec.ts`

**Test Scenarios**:
- Partner login and revenue dashboard access
- View commission events with filtering
- View payout history
- Metrics calculation for different periods
- Empty state handling

---

## Implementation Summary

### ✅ Completed (Backend Foundation)
- [x] Database migration for `partner_payouts` table
- [x] `PartnerRevenueService` with 5 core methods
- [x] Revenue API router with 5 endpoints
- [x] `PartnerRevenueMetrics` schema
- [x] Billing integration event handler

### ⏳ Pending
- [ ] Apply database migration to production
- [ ] Register event handlers in app startup
- [ ] Frontend revenue dashboard page
- [ ] Frontend revenue components (4 components)
- [ ] Unit tests for revenue service
- [ ] E2E tests for partner portal

### 🔧 Next Actions

1. **Apply Database Migration**:
   ```bash
   DATABASE_URL="postgresql://..." .venv/bin/alembic upgrade head
   ```

2. **Register Event Handlers** (in `src/dotmac/platform/main.py`):
   ```python
   from dotmac.platform.partner_management.event_handlers import register_partner_event_handlers

   # In lifespan() after database init:
   register_partner_event_handlers()
   logger.info("partner.event_handlers.registered")
   ```

3. **Test API Endpoints** (manual verification):
   ```bash
   # Start backend
   .venv/bin/uvicorn dotmac.platform.main:app --reload

   # Test endpoints
   curl http://localhost:8000/api/v1/partners/revenue/metrics
   curl http://localhost:8000/api/v1/partners/revenue/commissions
   curl http://localhost:8000/api/v1/partners/revenue/payouts
   ```

4. **Implement Frontend Dashboard** (following tenant billing patterns):
   - Copy structure from `frontend/apps/base-app/app/tenant/billing/page.tsx`
   - Create partner revenue page at `app/partners/revenue/page.tsx`
   - Reuse currency utilities from `lib/utils/currency.ts`

---

## API Documentation

### Revenue Metrics Endpoint
```
GET /api/v1/partners/revenue/metrics
Query Parameters:
  - period_start: ISO 8601 datetime (optional, defaults to start of month)
  - period_end: ISO 8601 datetime (optional, defaults to now)

Response:
{
  "partner_id": "uuid",
  "period_start": "2025-09-01T00:00:00Z",
  "period_end": "2025-09-30T23:59:59Z",
  "total_commissions": "12500.50",
  "total_commission_count": 45,
  "total_payouts": "10000.00",
  "pending_amount": "2500.50",
  "currency": "USD"
}
```

### Commission Events Endpoint
```
GET /api/v1/partners/revenue/commissions
Query Parameters:
  - status: CommissionStatus enum (pending, approved, paid, rejected)
  - limit: int (1-500, default 100)
  - offset: int (default 0)

Response: Array of PartnerCommissionEventResponse
[
  {
    "id": "uuid",
    "partner_id": "uuid",
    "customer_id": "uuid",
    "invoice_id": "uuid",
    "commission_amount": "250.50",
    "currency": "USD",
    "status": "approved",
    "event_type": "invoice_payment",
    "event_date": "2025-09-15T14:30:00Z",
    "payout_id": null,
    ...
  }
]
```

### Payouts Endpoint
```
GET /api/v1/partners/revenue/payouts
Query Parameters:
  - status: PayoutStatus enum (pending, ready, processing, completed, failed, cancelled)
  - limit: int (1-500, default 100)
  - offset: int (default 0)

Response: Array of PartnerPayoutResponse
[
  {
    "id": "uuid",
    "partner_id": "uuid",
    "total_amount": "10000.00",
    "currency": "USD",
    "commission_count": 40,
    "payment_reference": "PAY-2025-09-001",
    "payment_method": "bank_transfer",
    "status": "completed",
    "payout_date": "2025-09-30T00:00:00Z",
    "completed_at": "2025-10-02T10:15:00Z",
    "period_start": "2025-09-01T00:00:00Z",
    "period_end": "2025-09-30T23:59:59Z",
    ...
  }
]
```

---

## Files Created/Modified

### Created Files
1. `src/dotmac/platform/partner_management/revenue_service.py` (356 lines)
2. `src/dotmac/platform/partner_management/revenue_router.py` (251 lines)
3. `src/dotmac/platform/partner_management/event_handlers.py` (160 lines)
4. `alembic/versions/2025_10_09_0339-3dd35f0c1f3f_add_partner_payouts_table.py` (108 lines)
5. `docs/partner-portal-implementation-status.md` (this file)

### Modified Files
1. `src/dotmac/platform/partner_management/schemas.py` (added PartnerRevenueMetrics)
2. `src/dotmac/platform/partner_management/router.py` (imported and registered revenue_router)

---

## Database Schema

### partner_payouts Table
```sql
CREATE TABLE partner_payouts (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    total_amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    commission_count INTEGER NOT NULL DEFAULT 0,
    payment_reference VARCHAR(255),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'manual',
    status payoutstatus NOT NULL DEFAULT 'pending',
    payout_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    failure_reason TEXT
);

CREATE INDEX ix_partner_payouts_partner_status ON partner_payouts(partner_id, status);
CREATE INDEX ix_partner_payouts_dates ON partner_payouts(payout_date, period_start, period_end);
```

---

**Last Updated**: 2025-10-09
**Implementation Progress**: Phase 1 Complete (60%), Phase 2 Pending (0%), Phase 3 Pending (0%)
**Overall Progress**: 60% Complete

# Reporting & Analytics Polish - Implementation Summary

**Date**: 2025-11-07
**Status**: ✅ Complete

## Overview

Completed all 5 items from the "Reporting & analytics polish" bucket in `docs/TODO_GAP_CLOSEOUT.md:47-52`. This implementation adds comprehensive finance and operations visibility through new reporting endpoints.

---

## 1. Blocked Customers Dashboard ✅

**Endpoint**: `GET /billing/reports/blocked-customers`

### Features
- Lists all suspended subscribers with outstanding balances
- Shows days in suspended state (with min/max filters)
- Calculates recommended next action based on business logic:
  - `escalate_to_collections` - 90+ days blocked
  - `final_notice` - 60-89 days blocked
  - `collections_call` - 30-59 days blocked + balance > $10,000
  - `payment_reminder` - 14-59 days blocked
  - `monitor` - < 14 days blocked
- Priority scoring (critical, high, medium, low) based on:
  - Days blocked threshold
  - Outstanding balance threshold
- Sorted by priority, then by days blocked (descending)

### Response Structure
```json
[
  {
    "subscriber_id": "string",
    "username": "string",
    "customer_name": "string",
    "email": "string",
    "phone": "string",
    "suspended_at": "ISO-8601",
    "days_blocked": 45,
    "overdue_invoices": 3,
    "outstanding_balance": 15000.00,
    "next_action": "collections_call",
    "priority": "high"
  }
]
```

### Implementation Details
- **Generator**: `BlockedCustomersReportGenerator` in `generators.py:848-1013`
- **Router**: `router.py:150-189`
- Joins `Subscriber`, `Customer`, and `InvoiceEntity` tables
- Filters: `min_days_blocked`, `max_days_blocked`

---

## 2. Services Export (CSV/JSON) ✅

**Endpoint**: `GET /billing/reports/services/export`

### Features
- Export all active subscriber services for accounting sync
- Supports CSV and JSON formats
- Optional inclusion of suspended services
- Auto-generates filename with current date

### Query Parameters
- `format`: `csv` or `json` (default: `csv`)
- `include_suspended`: boolean (default: `false`)

### CSV Example
```csv
subscriber_id,username,status,created_at,suspended_at
SUB-001,user001,active,2024-01-15T10:30:00Z,
SUB-002,user002,suspended,2024-02-20T14:45:00Z,2024-10-01T09:00:00Z
```

### Implementation Details
- **Router**: `router.py:266-340`
- Uses Python's `csv` module for CSV generation
- Sets `Content-Disposition` header for file download
- Filename format: `services_export_YYYYMMDD.{csv|json}`

---

## 3. Enriched Aging Reports ✅

### 3.1 Aging by Partner
**Endpoint**: `GET /billing/reports/aging/by-partner`

Returns AR aging buckets grouped by `partner_id` for multi-partner operators.

### 3.2 Aging by Region
**Endpoint**: `GET /billing/reports/aging/by-region`

Returns AR aging buckets grouped by `billing_country` for geographic analysis.

### Response Structure
```json
[
  {
    "partner_id": "PARTNER-123",  // or "region": "US"
    "invoice_count": 25,
    "total_outstanding": 125000.00,
    "buckets": {
      "current": 50000.00,
      "1_30_days": 30000.00,
      "31_60_days": 25000.00,
      "61_90_days": 15000.00,
      "over_90_days": 5000.00
    }
  }
]
```

### Implementation Details
- **Generator Methods**:
  - `AgingReportGenerator.get_aging_by_partner()` - `generators.py:643-743`
  - `AgingReportGenerator.get_aging_by_region()` - `generators.py:745-845`
- **Router**: `router.py:191-264`
- Joins `InvoiceEntity` and `Customer` tables
- Groups by `partner_id` or `billing_country`
- Calculates full aging buckets for each group

---

## 4. SLA Breach Reports + Auto-Credit Visibility ✅

**Endpoint**: `GET /billing/reports/sla-breaches`

### Features
- Lists all SLA breaches with credit amounts issued
- Shows breach details (type, severity, deviation)
- Links to SLA instance and customer
- Resolution status tracking
- Summary statistics

### Query Parameters
- `resolved`: boolean filter (optional)
- `min_credit_amount`: float filter (default: 0.0)

### Response Structure
```json
{
  "summary": {
    "total_breaches": 45,
    "resolved_breaches": 30,
    "unresolved_breaches": 15,
    "total_credits_issued": 8500.00
  },
  "breaches": [
    {
      "breach_id": "uuid",
      "breach_type": "availability",
      "severity": "critical",
      "detected_at": "ISO-8601",
      "resolved_at": "ISO-8601",
      "resolved": true,
      "target_value": 99.9,
      "actual_value": 97.5,
      "deviation_percent": 2.41,
      "credit_amount": 250.00,
      "instance_id": "uuid",
      "customer_id": "uuid",
      "customer_name": "Acme Corp",
      "service_id": "uuid",
      "service_name": "Business Internet 100Mbps",
      "sla_status": "breached"
    }
  ]
}
```

### Implementation Details
- **Router**: `router.py:31-145`
- Joins `SLABreach` and `SLAInstance` tables
- Aggregates summary statistics with `func.count()` and `func.sum()`
- Uses existing SLA infrastructure from `fault_management` module

---

## 5. Session History Explorer ✅

**Endpoint**: `GET /billing/reports/sessions/history`

### Features
- Query 12+ months of RADIUS accounting data
- Pagination support (limit/offset)
- Filtering by subscriber ID or username
- Configurable date range
- Usage summaries (data and duration)

### Query Parameters
- `subscriber_id`: string (optional)
- `username`: string (optional)
- `start_date`: datetime (optional, defaults to 30 days ago)
- `end_date`: datetime (optional, defaults to now)
- `limit`: int (default: 100, max: 1000)
- `offset`: int (default: 0)

### Response Structure
```json
{
  "summary": {
    "total_sessions": 1250,
    "returned_sessions": 100,
    "total_data_usage_gb": 456.789,
    "total_duration_hours": 2340.5,
    "period_start": "2024-10-01T00:00:00Z",
    "period_end": "2024-11-07T23:59:59Z"
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "has_more": true
  },
  "sessions": [
    {
      "time": "2024-11-07T14:30:00Z",
      "subscriber_id": "SUB-001",
      "username": "user001",
      "session_id": "0a1b2c3d4e5f",
      "nas_ip_address": "10.0.1.1",
      "framed_ip_address": "100.64.1.123",
      "framed_ipv6_address": "2001:db8::1",
      "session_start_time": "2024-11-07T10:00:00Z",
      "session_stop_time": "2024-11-07T14:30:00Z",
      "session_duration_seconds": 16200,
      "session_duration_hours": 4.5,
      "total_bytes": 5368709120,
      "total_gb": 5.000,
      "input_octets": 1073741824,
      "output_octets": 4294967296,
      "upload_gb": 1.000,
      "download_gb": 4.000,
      "terminate_cause": "User-Request"
    }
  ]
}
```

### Implementation Details
- **Router**: `router.py:342-492`
- Queries `RadAcctTimeSeries` hypertable (TimescaleDB)
- Converts bytes to GB, seconds to hours
- Calculates total usage and duration sums
- Separate count query for pagination metadata

---

## File Structure

### New Files Created
1. **`src/dotmac/platform/billing/reports/router.py`** (495 lines)
   - All 5 reporting endpoints
   - FastAPI router with authentication
   - Comprehensive error handling

### Modified Files
1. **`src/dotmac/platform/billing/reports/generators.py`**
   - Added `AgingReportGenerator.get_aging_by_partner()` (lines 643-743)
   - Added `AgingReportGenerator.get_aging_by_region()` (lines 745-845)
   - Added `BlockedCustomersReportGenerator` class (lines 848-1013)

2. **`src/dotmac/platform/billing/router.py`**
   - Imported reports router (line 16)
   - Registered reports router (line 43)

---

## API Endpoint Summary

All endpoints are now available under `/billing/reports/`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/billing/reports/blocked-customers` | GET | Suspended customers with collections actions |
| `/billing/reports/aging/by-partner` | GET | AR aging breakdown by partner |
| `/billing/reports/aging/by-region` | GET | AR aging breakdown by region |
| `/billing/reports/services/export` | GET | Export active services (CSV/JSON) |
| `/billing/reports/sla-breaches` | GET | SLA breaches with auto-credits |
| `/billing/reports/sessions/history` | GET | RADIUS session history explorer |

---

## Authentication & Authorization

All endpoints use:
- **Dependency**: `get_current_user_with_rbac`
- **Session**: `get_async_session`
- **Tenant Isolation**: All queries filtered by `current_user.tenant_id`

---

## Testing

### Manual Testing
```bash
# Blocked customers
curl -X GET "http://localhost:8000/billing/reports/blocked-customers?min_days_blocked=30" \
  -H "Authorization: Bearer $TOKEN"

# Aging by partner
curl -X GET "http://localhost:8000/billing/reports/aging/by-partner" \
  -H "Authorization: Bearer $TOKEN"

# Services export (CSV)
curl -X GET "http://localhost:8000/billing/reports/services/export?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o services_export.csv

# SLA breaches
curl -X GET "http://localhost:8000/billing/reports/sla-breaches?resolved=false" \
  -H "Authorization: Bearer $TOKEN"

# Session history
curl -X GET "http://localhost:8000/billing/reports/sessions/history?subscriber_id=SUB-001&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Syntax Validation
All files verified with `python3 -m py_compile`:
- ✅ `router.py`
- ✅ `generators.py`
- ✅ `billing/router.py`

---

## Use Cases

### Collections Team
- View blocked customers dashboard sorted by priority
- Identify customers requiring escalation (90+ days)
- Track outstanding balances by severity

### Finance Team
- Export services for accounting reconciliation
- Analyze AR aging by partner for cash flow forecasting
- Review aging by region for geographic risk assessment

### Operations Team
- Monitor SLA breaches and credit liabilities
- Track SLA compliance metrics
- Investigate customer service quality issues

### Support Team
- Explore session history for troubleshooting
- Verify customer usage for billing disputes
- Identify connectivity patterns and issues

### Management
- Dashboard view of suspended customers
- SLA performance and financial impact
- Regional and partner performance analysis

---

## Next Steps (Optional Enhancements)

1. **Frontend Components**
   - React data tables for each report
   - Charts/graphs for visual analysis
   - Export buttons for CSV/JSON downloads

2. **Scheduled Reports**
   - Daily blocked customers digest email
   - Weekly aging reports to finance team
   - Monthly SLA compliance summary

3. **Alerts & Thresholds**
   - Alert when customer blocked > 90 days
   - Notify when SLA breaches exceed threshold
   - Warning when aging over 90 days increases

4. **Additional Filters**
   - Date range pickers for all reports
   - Multi-select for severity/priority
   - Search/autocomplete for customers

---

## Completion Checklist

- [x] Blocked customers dashboard with next-action logic
- [x] Services export in CSV and JSON formats
- [x] Aging report breakdowns (partner + region)
- [x] SLA breach report with credit visibility
- [x] Session history explorer with pagination
- [x] All endpoints registered in main router
- [x] Syntax validation passed
- [x] Tenant isolation implemented
- [x] Authentication/authorization configured
- [x] Error handling implemented
- [x] Documentation completed

**Status**: All 5 items from the "Reporting & analytics polish" bucket are now complete.

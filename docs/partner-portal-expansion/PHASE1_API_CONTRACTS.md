# Phase 1: Partner Portal Expansion - API Contracts

**Version:** 1.0
**Date:** 2025-11-07
**Status:** Draft - Design Review

## Executive Summary

This document defines the REST API contracts for partner multi-tenant management. All endpoints are designed for MSPs and enterprise headquarters to manage multiple customer tenants from a unified interface.

## Base URL & Authentication

**Base URL**: `/api/v1/partner/`

**Authentication**:
- Bearer token in `Authorization` header
- Token must belong to partner user with appropriate permissions
- Optional `X-Active-Tenant-Id` header for context switching

**Common Headers**:
```
Authorization: Bearer {jwt_token}
X-Active-Tenant-Id: {tenant_id}  # Optional, for multi-tenant operations
Content-Type: application/json
```

## API Endpoints

### 1. Managed Tenant Management

#### 1.1 List Managed Tenants

**Endpoint**: `GET /api/v1/partner/customers`

**Description**: List all tenants managed by the authenticated partner.

**Permissions**: `partner.tenants.list`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by tenant status: `active`, `suspended`, `trial` |
| `search` | string | No | Search by tenant name or domain |
| `limit` | integer | No | Results per page (default: 50, max: 100) |
| `offset` | integer | No | Pagination offset |
| `sort_by` | string | No | Sort field: `name`, `created_at`, `outstanding_balance` |
| `sort_order` | string | No | Sort direction: `asc`, `desc` (default: `asc`) |

**Response**: `200 OK`
```json
{
  "items": [
    {
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Fiber ISP",
      "slug": "acme-fiber",
      "domain": "acme-fiber.com",
      "status": "active",
      "plan_type": "professional",
      "relationship": {
        "link_id": "650e8400-e29b-41d4-a716-446655440001",
        "access_role": "msp_full",
        "start_date": "2024-01-15T00:00:00Z",
        "end_date": null,
        "relationship_type": "msp_managed"
      },
      "metrics": {
        "outstanding_balance": 15420.50,
        "open_tickets": 3,
        "sla_breach_count_30d": 1,
        "total_subscribers": 1247
      },
      "billing": {
        "billing_cycle": "monthly",
        "current_mrr": 24500.00,
        "last_invoice_date": "2025-10-01T00:00:00Z",
        "next_invoice_date": "2025-11-01T00:00:00Z"
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2025-11-07T12:00:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0,
  "has_more": false
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks `partner.tenants.list` permission
- `429 Too Many Requests`: Rate limit exceeded

---

#### 1.2 Get Tenant Details

**Endpoint**: `GET /api/v1/partner/customers/{tenant_id}`

**Description**: Get detailed information about a specific managed tenant.

**Permissions**: `partner.tenants.list`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | string (UUID) | Yes | Tenant identifier |

**Response**: `200 OK`
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Fiber ISP",
  "slug": "acme-fiber",
  "domain": "acme-fiber.com",
  "status": "active",
  "plan_type": "professional",
  "contact": {
    "email": "admin@acme-fiber.com",
    "phone": "+1-555-0123",
    "billing_email": "billing@acme-fiber.com"
  },
  "address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state_province": "CA",
    "postal_code": "94105",
    "country": "US"
  },
  "relationship": {
    "link_id": "650e8400-e29b-41d4-a716-446655440001",
    "access_role": "msp_full",
    "custom_permissions": {
      "billing.write": true,
      "provisioning.activate_service": true
    },
    "start_date": "2024-01-15T00:00:00Z",
    "end_date": null,
    "sla_response_hours": 4,
    "sla_uptime_target": 99.95,
    "notify_on_sla_breach": true,
    "notify_on_billing_threshold": true,
    "billing_alert_threshold": 50000.00
  },
  "metrics": {
    "current_users": 8,
    "max_users": 20,
    "total_subscribers": 1247,
    "active_subscribers": 1180,
    "suspended_subscribers": 67,
    "current_mrr": 24500.00,
    "outstanding_balance": 15420.50,
    "avg_uptime_30d": 99.92,
    "open_tickets": 3,
    "sla_breach_count_30d": 1
  },
  "subscription": {
    "billing_cycle": "monthly",
    "trial_ends_at": null,
    "subscription_starts_at": "2024-01-15T00:00:00Z",
    "subscription_ends_at": null
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2025-11-07T12:00:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Tenant not found or not managed by partner
- `403 Forbidden`: User lacks permission or tenant link is inactive

---

### 2. Consolidated Billing

#### 2.1 Get Billing Summary

**Endpoint**: `GET /api/v1/partner/billing/summary`

**Description**: Get aggregate billing summary across all managed tenants.

**Permissions**: `partner.billing.summary.read`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_date` | string (ISO 8601) | No | Start date for analysis (default: 30 days ago) |
| `to_date` | string (ISO 8601) | No | End date for analysis (default: today) |
| `tenant_ids` | string (comma-separated UUIDs) | No | Filter specific tenants |
| `status` | string | No | Filter by invoice status: `draft`, `finalized`, `paid`, `overdue` |
| `currency` | string (ISO 4217) | No | Currency code (default: USD) |

**Response**: `200 OK`
```json
{
  "summary": {
    "total_revenue": 1245300.75,
    "total_outstanding": 234560.50,
    "total_overdue": 45200.00,
    "invoice_count": 142,
    "paid_invoice_count": 118,
    "overdue_invoice_count": 8,
    "managed_tenant_count": 42,
    "currency": "USD"
  },
  "by_tenant": [
    {
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_name": "Acme Fiber ISP",
      "total_revenue": 24500.00,
      "outstanding_balance": 15420.50,
      "overdue_amount": 0.00,
      "invoice_count": 3,
      "last_payment_date": "2025-10-25T10:30:00Z",
      "last_payment_amount": 24500.00
    }
  ],
  "period": {
    "from_date": "2025-10-01T00:00:00Z",
    "to_date": "2025-11-07T23:59:59Z",
    "days": 38
  }
}
```

---

#### 2.2 List Invoices (Consolidated)

**Endpoint**: `GET /api/v1/partner/billing/invoices`

**Description**: List invoices across all managed tenants with filtering and search.

**Permissions**: `partner.billing.invoices.read`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_date` | string (ISO 8601) | No | Invoice date range start |
| `to_date` | string (ISO 8601) | No | Invoice date range end |
| `status` | string | No | Filter by status: `draft`, `finalized`, `paid`, `overdue`, `cancelled` |
| `tenant_ids` | string (comma-separated) | No | Filter specific tenants |
| `min_amount` | number | No | Minimum invoice amount |
| `max_amount` | number | No | Maximum invoice amount |
| `search` | string | No | Search invoice number or customer name |
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Pagination offset |
| `sort_by` | string | No | Sort field: `invoice_date`, `amount`, `status` |
| `sort_order` | string | No | `asc` or `desc` |

**Response**: `200 OK`
```json
{
  "items": [
    {
      "invoice_id": "750e8400-e29b-41d4-a716-446655440002",
      "invoice_number": "INV-2025-001234",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_name": "Acme Fiber ISP",
      "customer_id": "850e8400-e29b-41d4-a716-446655440003",
      "customer_name": "John Doe",
      "invoice_date": "2025-10-01T00:00:00Z",
      "due_date": "2025-10-15T00:00:00Z",
      "status": "paid",
      "subtotal": 99.99,
      "tax": 8.00,
      "total": 107.99,
      "paid_amount": 107.99,
      "balance": 0.00,
      "currency": "USD",
      "payment_date": "2025-10-14T15:30:00Z",
      "days_overdue": 0,
      "created_at": "2025-10-01T00:00:00Z"
    }
  ],
  "total": 1542,
  "limit": 50,
  "offset": 0,
  "aggregates": {
    "total_amount": 152430.75,
    "paid_amount": 138200.50,
    "outstanding_amount": 14230.25
  }
}
```

---

#### 2.3 Export Invoices

**Endpoint**: `POST /api/v1/partner/billing/invoices/export`

**Description**: Generate CSV/PDF export of invoices for specified period.

**Permissions**: `partner.billing.invoices.export`

**Request Body**:
```json
{
  "format": "csv",  // or "pdf"
  "from_date": "2025-10-01T00:00:00Z",
  "to_date": "2025-10-31T23:59:59Z",
  "tenant_ids": ["550e8400-e29b-41d4-a716-446655440000"],
  "status": ["finalized", "paid"],
  "include_line_items": true,
  "columns": ["invoice_number", "customer_name", "total", "status", "payment_date"]
}
```

**Response**: `202 Accepted`
```json
{
  "export_id": "950e8400-e29b-41d4-a716-446655440004",
  "status": "processing",
  "estimated_completion": "2025-11-07T12:05:00Z",
  "download_url": null,
  "expires_at": "2025-11-14T12:00:00Z"
}
```

**Follow-up**: `GET /api/v1/partner/billing/exports/{export_id}`
```json
{
  "export_id": "950e8400-e29b-41d4-a716-446655440004",
  "status": "completed",
  "format": "csv",
  "file_size_bytes": 245680,
  "row_count": 1542,
  "download_url": "https://cdn.dotmac.io/exports/950e8400-e29b-41d4-a716-446655440004.csv?token=...",
  "created_at": "2025-11-07T12:00:00Z",
  "completed_at": "2025-11-07T12:04:32Z",
  "expires_at": "2025-11-14T12:00:00Z"
}
```

---

### 3. Multi-Tenant Support

#### 3.1 List Tickets (Consolidated)

**Endpoint**: `GET /api/v1/partner/support/tickets`

**Description**: List support tickets across all managed tenants.

**Permissions**: `partner.support.tickets.list`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_ids` | string (comma-separated) | No | Filter specific tenants |
| `status` | string | No | Filter by status: `open`, `pending`, `resolved`, `closed` |
| `priority` | string | No | Filter by priority: `low`, `normal`, `high`, `urgent` |
| `assigned_to` | string (UUID) | No | Filter by assignee user ID |
| `created_from` | string (ISO 8601) | No | Created date range start |
| `created_to` | string (ISO 8601) | No | Created date range end |
| `search` | string | No | Search ticket subject/description |
| `limit` | integer | No | Results per page |
| `offset` | integer | No | Pagination offset |

**Response**: `200 OK`
```json
{
  "items": [
    {
      "ticket_id": "a50e8400-e29b-41d4-a716-446655440005",
      "ticket_number": "TKT-2025-12345",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_name": "Acme Fiber ISP",
      "customer_id": "850e8400-e29b-41d4-a716-446655440003",
      "customer_name": "John Doe",
      "subject": "Internet connection intermittent",
      "status": "open",
      "priority": "high",
      "category": "technical",
      "assigned_to": "b60e8400-e29b-41d4-a716-446655440006",
      "assigned_to_name": "Sarah Johnson",
      "created_at": "2025-11-07T08:30:00Z",
      "updated_at": "2025-11-07T10:15:00Z",
      "sla_breach_at": "2025-11-07T16:30:00Z",
      "is_sla_breached": false,
      "last_response_at": "2025-11-07T10:15:00Z",
      "response_count": 3
    }
  ],
  "total": 127,
  "limit": 50,
  "offset": 0,
  "aggregates": {
    "open_count": 45,
    "pending_count": 32,
    "resolved_count": 50,
    "sla_breach_count": 8,
    "avg_resolution_hours": 14.5
  }
}
```

---

#### 3.2 Create Ticket on Behalf of Tenant

**Endpoint**: `POST /api/v1/partner/support/tickets`

**Description**: Create a support ticket on behalf of a managed tenant.

**Permissions**: `partner.support.tickets.create`

**Headers**:
- `X-Active-Tenant-Id`: Required (which tenant to create ticket for)

**Request Body**:
```json
{
  "subject": "Service outage in North Zone",
  "description": "Multiple subscribers reporting connectivity issues in North Zone fiber ring. Suspected fiber cut at Mile Marker 42.",
  "priority": "urgent",
  "category": "network_outage",
  "customer_id": "850e8400-e29b-41d4-a716-446655440003",  // Optional
  "tags": ["fiber-cut", "north-zone", "mass-outage"],
  "notify_customer": true
}
```

**Response**: `201 Created`
```json
{
  "ticket_id": "c70e8400-e29b-41d4-a716-446655440007",
  "ticket_number": "TKT-2025-12346",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "open",
  "priority": "urgent",
  "created_by_partner": true,
  "created_by_partner_id": "d80e8400-e29b-41d4-a716-446655440008",
  "created_by_partner_name": "MSP Operations Team",
  "created_at": "2025-11-07T12:00:00Z",
  "sla_breach_at": "2025-11-07T13:00:00Z"  // 1-hour SLA for urgent tickets
}
```

---

#### 3.3 Update Ticket

**Endpoint**: `PATCH /api/v1/partner/support/tickets/{ticket_id}`

**Description**: Update ticket status or add comments.

**Permissions**: `partner.support.tickets.update`

**Request Body**:
```json
{
  "status": "pending",  // Optional
  "priority": "high",   // Optional
  "assigned_to": "b60e8400-e29b-41d4-a716-446655440006",  // Optional
  "comment": {
    "content": "We've deployed a field technician to investigate. ETA 45 minutes.",
    "is_internal": false,
    "notify_customer": true
  }
}
```

**Response**: `200 OK`
```json
{
  "ticket_id": "c70e8400-e29b-41d4-a716-446655440007",
  "ticket_number": "TKT-2025-12346",
  "status": "pending",
  "updated_at": "2025-11-07T12:15:00Z",
  "comment_id": "e90e8400-e29b-41d4-a716-446655440009"
}
```

---

### 4. Usage & SLA Reports

#### 4.1 Get Multi-Tenant Usage Summary

**Endpoint**: `GET /api/v1/partner/reports/usage`

**Description**: Aggregate usage metrics across managed tenants.

**Permissions**: `partner.reports.usage.read`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_date` | string (ISO 8601) | No | Start date (default: 30 days ago) |
| `to_date` | string (ISO 8601) | No | End date (default: today) |
| `tenant_ids` | string (comma-separated) | No | Filter specific tenants |
| `group_by` | string | No | Grouping: `day`, `week`, `month`, `tenant` |

**Response**: `200 OK`
```json
{
  "summary": {
    "total_subscribers": 5280,
    "active_subscribers": 4950,
    "total_data_gb": 45820.75,
    "avg_data_per_subscriber_gb": 8.68,
    "period_days": 30
  },
  "by_tenant": [
    {
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_name": "Acme Fiber ISP",
      "subscriber_count": 1247,
      "active_subscriber_count": 1180,
      "total_data_gb": 10824.30,
      "avg_data_per_subscriber_gb": 8.68,
      "peak_bandwidth_mbps": 2400,
      "avg_bandwidth_mbps": 850
    }
  ],
  "time_series": [
    {
      "date": "2025-10-08",
      "total_data_gb": 1520.40,
      "active_subscribers": 4950
    }
  ]
}
```

---

#### 4.2 Get Multi-Tenant SLA Report

**Endpoint**: `GET /api/v1/partner/reports/sla`

**Description**: SLA compliance metrics across managed tenants.

**Permissions**: `partner.reports.sla.read`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_date` | string (ISO 8601) | No | Start date (default: 30 days ago) |
| `to_date` | string (ISO 8601) | No | End date (default: today) |
| `tenant_ids` | string (comma-separated) | No | Filter specific tenants |
| `target_percentage` | number | No | SLA target (default: 99.9) |

**Response**: `200 OK`
```json
{
  "summary": {
    "tenant_count": 42,
    "avg_uptime_percentage": 99.89,
    "tenants_meeting_sla": 40,
    "tenants_breaching_sla": 2,
    "total_breach_count": 12,
    "total_downtime_minutes": 28560,
    "worst_uptime_percentage": 98.75
  },
  "by_tenant": [
    {
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_name": "Acme Fiber ISP",
      "uptime_percentage": 99.92,
      "downtime_minutes": 345,
      "breach_count": 1,
      "meets_sla": true,
      "sla_target": 99.9,
      "worst_day": {
        "date": "2025-10-15",
        "uptime_percentage": 99.45
      },
      "outage_count": 2,
      "mttr_minutes": 172.5
    }
  ]
}
```

---

### 5. Alerts & Notifications

#### 5.1 Get SLA Breach Alerts

**Endpoint**: `GET /api/v1/partner/alerts/sla`

**Description**: List recent SLA breach alerts across managed tenants.

**Permissions**: `partner.alerts.sla.read`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_ids` | string (comma-separated) | No | Filter specific tenants |
| `from_date` | string (ISO 8601) | No | Alert date range start |
| `status` | string | No | Filter: `active`, `acknowledged`, `resolved` |
| `severity` | string | No | Filter: `critical`, `warning`, `info` |
| `limit` | integer | No | Results per page |

**Response**: `200 OK`
```json
{
  "items": [
    {
      "alert_id": "f00e8400-e29b-41d4-a716-446655440010",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_name": "Acme Fiber ISP",
      "alert_type": "sla_breach",
      "severity": "critical",
      "title": "Monthly SLA target breached",
      "message": "Uptime dropped to 99.45% on 2025-10-15, below 99.9% target",
      "triggered_at": "2025-10-16T00:00:00Z",
      "acknowledged_at": null,
      "resolved_at": null,
      "status": "active",
      "metadata": {
        "breach_date": "2025-10-15",
        "actual_uptime": 99.45,
        "target_uptime": 99.9,
        "downtime_minutes": 792
      }
    }
  ],
  "total": 8,
  "active_count": 3,
  "acknowledged_count": 2,
  "resolved_count": 3
}
```

---

#### 5.2 Get Billing Alerts

**Endpoint**: `GET /api/v1/partner/alerts/billing`

**Description**: Billing threshold alerts (AR exceeds configured thresholds).

**Permissions**: `partner.alerts.billing.read`

**Response**: Similar structure to SLA alerts, with billing-specific metadata.

---

## Error Handling

### Standard Error Response

All endpoints return errors in this format:

```json
{
  "error": {
    "code": "TENANT_ACCESS_DENIED",
    "message": "Partner does not have access to tenant 550e8400-e29b-41d4-a716-446655440000",
    "details": {
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "partner_id": "d80e8400-e29b-41d4-a716-446655440008",
      "reason": "No active PartnerTenantLink found"
    },
    "request_id": "req_abc123def456",
    "timestamp": "2025-11-07T12:00:00Z"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | User lacks required permission |
| `TENANT_ACCESS_DENIED` | 403 | Partner doesn't have access to specified tenant |
| `TENANT_LINK_EXPIRED` | 403 | PartnerTenantLink has expired |
| `TENANT_NOT_FOUND` | 404 | Tenant ID doesn't exist |
| `INVOICE_NOT_FOUND` | 404 | Invoice not found or not accessible |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

**Per-Partner Limits**:
- Listing endpoints: 100 requests/minute
- Detail endpoints: 200 requests/minute
- Write operations: 50 requests/minute
- Export operations: 10 requests/hour

**Per-Tenant Limits** (when using X-Active-Tenant-Id):
- 500 requests/minute per tenant

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1636300000
```

---

## Pagination

**Standard Pagination Parameters**:
- `limit`: Results per page (default: 50, max: 100)
- `offset`: Skip N results

**Response Format**:
```json
{
  "items": [...],
  "total": 1542,
  "limit": 50,
  "offset": 100,
  "has_more": true
}
```

---

## Filtering & Search

**Date Ranges**: ISO 8601 format (`2025-11-07T12:00:00Z`)
**Multi-Value Filters**: Comma-separated (`status=active,trial`)
**Search**: Supports partial matches on text fields
**Sorting**: `sort_by` + `sort_order` parameters

---

## Versioning

**Current Version**: v1
**Deprecation Policy**: 6-month notice before breaking changes
**Version Header**: `X-API-Version: 1` (optional, defaults to latest)

---

## Webhooks (Future)

Partners can subscribe to events:
- `partner.tenant.sla_breach`
- `partner.tenant.billing_threshold`
- `partner.tenant.ticket_created`
- `partner.tenant.status_changed`

---

**Document Owner**: API Team, Platform Engineering
**Reviewers**: Product, Security, Frontend Team

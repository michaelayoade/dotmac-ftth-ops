# BSS Phase 1 API Documentation

**Version:** 1.0.0
**Last Updated:** October 14, 2025
**Base URL:** `http://localhost:8000` (development)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dunning & Collections API](#dunning--collections-api)
3. [Service Lifecycle API](#service-lifecycle-api)
4. [Usage Billing API](#usage-billing-api)
5. [Subscriber Management API](#subscriber-management-api)
6. [NetBox IPAM Integration](#netbox-ipam-integration)
7. [RADIUS AAA Integration](#radius-aaa-integration)
8. [Common Patterns](#common-patterns)
9. [Error Handling](#error-handling)
10. [Deployment Orchestration API](#deployment-orchestration-api)

---

## Authentication

All API endpoints require authentication via JWT tokens or API keys.

### Headers

```http
Authorization: Bearer <jwt_token>
X-Tenant-ID: <tenant_id>
Content-Type: application/json
```

### Getting an Access Token

**Endpoint:** `POST /api/auth/token`

**Request:**
```json
{
  "username": "admin@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Dunning & Collections API

Automated collection workflows for past-due accounts.

### Create Dunning Campaign

**Endpoint:** `POST /api/billing/dunning/campaigns`

**Description:** Create a new dunning campaign with automated action sequence.

**Request:**
```json
{
  "name": "Standard Payment Recovery",
  "description": "3-step collection workflow for overdue accounts",
  "trigger_after_days": 7,
  "max_retries": 3,
  "retry_interval_days": 3,
  "actions": [
    {
      "type": "email",
      "delay_days": 0,
      "template": "payment_reminder_1"
    },
    {
      "type": "sms",
      "delay_days": 3,
      "template": "payment_alert"
    },
    {
      "type": "suspend_service",
      "delay_days": 7
    }
  ],
  "exclusion_rules": {
    "min_lifetime_value": 1000.0,
    "customer_tiers": ["premium", "vip"]
  },
  "priority": 10,
  "is_active": true
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "demo-alpha",
  "name": "Standard Payment Recovery",
  "trigger_after_days": 7,
  "max_retries": 3,
  "actions": [...],
  "is_active": true,
  "total_executions": 0,
  "successful_executions": 0,
  "total_recovered_amount": 0,
  "created_at": "2025-10-14T12:00:00Z"
}
```

### List Dunning Campaigns

**Endpoint:** `GET /api/billing/dunning/campaigns`

**Query Parameters:**
- `is_active` (optional): Filter by active status (true/false)
- `skip` (optional): Pagination offset (default: 0)
- `limit` (optional): Results per page (default: 100)

**Response:** `200 OK`
```json
{
  "campaigns": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Standard Payment Recovery",
      "trigger_after_days": 7,
      "total_executions": 42,
      "successful_executions": 35,
      "total_recovered_amount": 15000
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 100
}
```

### Create Dunning Execution

**Endpoint:** `POST /api/billing/dunning/executions`

**Description:** Start dunning campaign execution for a specific subscription.

**Request:**
```json
{
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "subscription_id": "sub_abc123",
  "customer_id": "660e8400-e29b-41d4-a716-446655440000",
  "invoice_id": "in_xyz789",
  "outstanding_amount": 10000
}
```

**Response:** `201 Created`
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "subscription_id": "sub_abc123",
  "status": "pending",
  "current_step": 0,
  "total_steps": 3,
  "outstanding_amount": 10000,
  "recovered_amount": 0,
  "next_action_at": "2025-10-14T13:00:00Z",
  "started_at": "2025-10-14T12:00:00Z"
}
```

### Get Dunning Statistics

**Endpoint:** `GET /api/billing/dunning/stats`

**Response:** `200 OK`
```json
{
  "total_campaigns": 5,
  "active_campaigns": 3,
  "total_executions": 250,
  "successful_recoveries": 200,
  "total_recovered_amount": 85000,
  "success_rate": 80.0,
  "average_recovery_amount": 425
}
```

---

## Service Lifecycle API

Comprehensive service instance lifecycle management.

### Provision Service

**Endpoint:** `POST /api/services/lifecycle/provision`

**Description:** Provision a new service instance with automatic resource allocation.

**Request:**
```json
{
  "customer_id": "660e8400-e29b-41d4-a716-446655440000",
  "service_type": "fiber_internet",
  "service_name": "Fiber Internet 100 Mbps",
  "plan_id": "plan_fiber_100",
  "subscription_id": "sub_abc123",
  "service_config": {
    "bandwidth_down_mbps": 100,
    "bandwidth_up_mbps": 50,
    "static_ip": "203.0.113.10",
    "vlan_id": 100
  },
  "installation_address": "123 Main St, Springfield, IL 62701",
  "installation_scheduled_date": "2025-10-21T09:00:00Z",
  "auto_activate": true
}
```

**Response:** `201 Created`
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "service_identifier": "SVC-20251014-001",
  "tenant_id": "demo-alpha",
  "customer_id": "660e8400-e29b-41d4-a716-446655440000",
  "service_type": "fiber_internet",
  "service_name": "Fiber Internet 100 Mbps",
  "status": "active",
  "provisioning_status": "completed",
  "service_config": {
    "bandwidth_down_mbps": 100,
    "bandwidth_up_mbps": 50,
    "static_ip": "203.0.113.10",
    "vlan_id": 100
  },
  "provisioned_at": "2025-10-14T12:00:00Z",
  "activated_at": "2025-10-14T12:00:05Z"
}
```

### Suspend Service

**Endpoint:** `POST /api/services/lifecycle/{service_id}/suspend`

**Description:** Suspend an active service (e.g., for non-payment).

**Request:**
```json
{
  "reason": "Non-payment - invoice overdue 30 days",
  "fraud_suspension": false,
  "suspended_by_user_id": "990e8400-e29b-41d4-a716-446655440000"
}
```

**Response:** `200 OK`
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "service_identifier": "SVC-20251014-001",
  "status": "suspended",
  "suspended_at": "2025-10-14T15:30:00Z",
  "suspension_reason": "Non-payment - invoice overdue 30 days"
}
```

### Resume Service

**Endpoint:** `POST /api/services/lifecycle/{service_id}/resume`

**Description:** Resume a suspended service after payment received.

**Request:**
```json
{
  "resumed_by_user_id": "990e8400-e29b-41d4-a716-446655440000",
  "notes": "Payment received, resuming service"
}
```

**Response:** `200 OK`
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "suspended_at": null,
  "resumed_at": "2025-10-14T16:00:00Z"
}
```

### Terminate Service

**Endpoint:** `POST /api/services/lifecycle/{service_id}/terminate`

**Description:** Permanently terminate a service.

**Request:**
```json
{
  "reason": "Customer cancellation request",
  "terminated_by_user_id": "990e8400-e29b-41d4-a716-446655440000"
}
```

**Response:** `200 OK`
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "status": "terminated",
  "terminated_at": "2025-10-14T17:00:00Z",
  "termination_reason": "Customer cancellation request"
}
```

### Get Service Lifecycle Events

**Endpoint:** `GET /api/services/lifecycle/{service_id}/events`

**Response:** `200 OK`
```json
{
  "events": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440000",
      "event_type": "provision_started",
      "occurred_at": "2025-10-14T12:00:00Z",
      "metadata": {}
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440000",
      "event_type": "provision_completed",
      "occurred_at": "2025-10-14T12:00:05Z",
      "metadata": {"duration_seconds": 5}
    },
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440000",
      "event_type": "suspension_completed",
      "occurred_at": "2025-10-14T15:30:00Z",
      "metadata": {"reason": "Non-payment"}
    }
  ]
}
```

---

## Usage Billing API

Metered and pay-as-you-go billing for ISP services.

### Create Usage Record

**Endpoint:** `POST /api/billing/usage/records`

**Description:** Record metered usage for billing.

**Request:**
```json
{
  "subscription_id": "sub_abc123",
  "customer_id": "660e8400-e29b-41d4-a716-446655440000",
  "usage_type": "data_transfer",
  "quantity": 15.5,
  "unit": "GB",
  "unit_price": 0.10,
  "period_start": "2025-10-14T11:00:00Z",
  "period_end": "2025-10-14T12:00:00Z",
  "source_system": "radius",
  "source_record_id": "radacct_12345",
  "description": "Hourly data usage aggregation"
}
```

**Response:** `201 Created`
```json
{
  "id": "dd0e8400-e29b-41d4-a716-446655440000",
  "subscription_id": "sub_abc123",
  "usage_type": "data_transfer",
  "quantity": 15.5,
  "unit": "GB",
  "unit_price": 0.10,
  "total_amount": 155,
  "currency": "USD",
  "billed_status": "pending",
  "period_start": "2025-10-14T11:00:00Z",
  "period_end": "2025-10-14T12:00:00Z",
  "created_at": "2025-10-14T12:05:00Z"
}
```

### Get Pending Usage

**Endpoint:** `GET /api/billing/usage/pending`

**Query Parameters:**
- `subscription_id` (optional): Filter by subscription
- `customer_id` (optional): Filter by customer
- `period_start` (optional): Filter by period start
- `period_end` (optional): Filter by period end

**Response:** `200 OK`
```json
{
  "records": [
    {
      "id": "dd0e8400-e29b-41d4-a716-446655440000",
      "subscription_id": "sub_abc123",
      "usage_type": "data_transfer",
      "quantity": 15.5,
      "total_amount": 155,
      "billed_status": "pending"
    }
  ],
  "total_amount": 155,
  "total_records": 1
}
```

### Mark Usage as Billed

**Endpoint:** `POST /api/billing/usage/records/{record_id}/mark-billed`

**Description:** Mark usage record as included in invoice.

**Request:**
```json
{
  "invoice_id": "in_xyz789"
}
```

**Response:** `200 OK`
```json
{
  "id": "dd0e8400-e29b-41d4-a716-446655440000",
  "billed_status": "billed",
  "invoice_id": "in_xyz789",
  "billed_at": "2025-10-14T12:10:00Z"
}
```

### Aggregate Usage

**Endpoint:** `POST /api/billing/usage/aggregate`

**Description:** Aggregate usage records for reporting.

**Request:**
```json
{
  "subscription_id": "sub_abc123",
  "period_type": "daily",
  "period_start": "2025-10-14T00:00:00Z",
  "period_end": "2025-10-14T23:59:59Z"
}
```

**Response:** `200 OK`
```json
{
  "id": "ee0e8400-e29b-41d4-a716-446655440000",
  "subscription_id": "sub_abc123",
  "usage_type": "data_transfer",
  "period_type": "daily",
  "period_start": "2025-10-14T00:00:00Z",
  "period_end": "2025-10-14T23:59:59Z",
  "total_quantity": 145.8,
  "total_amount": 1458,
  "record_count": 24
}
```

### Generate Usage Report

**Endpoint:** `POST /api/billing/usage/reports`

**Request:**
```json
{
  "subscription_id": "sub_abc123",
  "period_start": "2025-10-01T00:00:00Z",
  "period_end": "2025-10-31T23:59:59Z",
  "include_breakdown": true
}
```

**Response:** `200 OK`
```json
{
  "subscription_id": "sub_abc123",
  "period_start": "2025-10-01T00:00:00Z",
  "period_end": "2025-10-31T23:59:59Z",
  "usage_by_type": {
    "data_transfer": {
      "total_quantity": 450.5,
      "unit": "GB",
      "total_amount": 4505
    },
    "voice_minutes": {
      "total_quantity": 120.0,
      "unit": "minutes",
      "total_amount": 1200
    }
  },
  "total_amount": 5705,
  "currency": "USD"
}
```

---

## Subscriber Management API

ISP subscriber provisioning with automatic IP allocation.

### Create Subscriber

**Endpoint:** `POST /api/subscribers`

**Description:** Create subscriber with automatic IP allocation from NetBox.

**Request:**
```json
{
  "username": "john.doe@alpha.com",
  "password": "secure_password_123",
  "customer_id": "660e8400-e29b-41d4-a716-446655440000",
  "service_type": "fiber_internet",
  "status": "active",
  "bandwidth_profile": {
    "download_mbps": 100,
    "upload_mbps": 50
  },
  "allocate_ip": true,
  "ip_pool_name": "residential_pool_1"
}
```

**Response:** `201 Created`
```json
{
  "id": "ff0e8400-e29b-41d4-a716-446655440000",
  "username": "john.doe@alpha.com",
  "customer_id": "660e8400-e29b-41d4-a716-446655440000",
  "service_type": "fiber_internet",
  "status": "active",
  "static_ipv4": "10.100.0.15",
  "bandwidth_profile": {
    "download_mbps": 100,
    "upload_mbps": 50
  },
  "radius_created": true,
  "created_at": "2025-10-14T12:00:00Z"
}
```

### Test RADIUS Authentication

**Command Line:**
```bash
docker exec isp-freeradius radtest john.doe@alpha.com secure_password_123 localhost 0 testing123
```

**Expected Response:**
```
Sent Access-Request Id 123 from 0.0.0.0:54321 to 127.0.0.1:1812 length 78
Received Access-Accept Id 123 from 127.0.0.1:1812 to 0.0.0.0:54321 length 56
	Framed-IP-Address = 10.100.0.15
	WISPr-Bandwidth-Max-Down = 100000000
	WISPr-Bandwidth-Max-Up = 50000000
```

---

## NetBox IPAM Integration

### Get Available IP Ranges

**Endpoint:** `GET http://localhost:8080/api/ipam/ip-ranges/`

**Headers:**
```
Authorization: Token 0123456789abcdef0123456789abcdef01234567
```

**Response:** `200 OK`
```json
{
  "count": 4,
  "results": [
    {
      "id": 1,
      "display": "10.100.0.0/24 - Residential Pool Alpha",
      "start_address": "10.100.0.1",
      "end_address": "10.100.0.254",
      "size": 254,
      "utilization": "2.36%"
    }
  ]
}
```

### Allocate IP Address

**Endpoint:** `POST http://localhost:8080/api/ipam/ip-addresses/`

**Request:**
```json
{
  "address": "10.100.0.20/32",
  "status": "active",
  "tenant": 1,
  "description": "john.doe@alpha.com - Residential Fiber"
}
```

**Response:** `201 Created`
```json
{
  "id": 15,
  "address": "10.100.0.20/32",
  "status": "active",
  "tenant": {
    "id": 1,
    "name": "Demo ISP Alpha"
  }
}
```

---

## RADIUS AAA Integration

### RADIUS Tables

#### radcheck (Authentication)
```sql
SELECT * FROM radcheck WHERE username = 'john.doe@alpha.com';
```

| id | username | attribute | op | value |
|----|----------|-----------|-------|------|
| 1 | john.doe@alpha.com | Cleartext-Password | := | secure_password_123 |

#### radreply (Authorization)
```sql
SELECT * FROM radreply WHERE username = 'john.doe@alpha.com';
```

| id | username | attribute | op | value |
|----|----------|-----------|-------|------|
| 1 | john.doe@alpha.com | Framed-IP-Address | := | 10.100.0.15 |
| 2 | john.doe@alpha.com | WISPr-Bandwidth-Max-Down | := | 100000000 |
| 3 | john.doe@alpha.com | WISPr-Bandwidth-Max-Up | := | 50000000 |

#### radacct (Session Accounting)
```sql
SELECT * FROM radacct WHERE username = 'john.doe@alpha.com' ORDER BY acctstarttime DESC LIMIT 1;
```

| Field | Value |
|-------|-------|
| acctsessionid | SESSION-20251014-001 |
| username | john.doe@alpha.com |
| nasipaddress | 192.168.1.1 |
| framedipaddress | 10.100.0.15 |
| acctstarttime | 2025-10-14 08:00:00 |
| acctstoptime | 2025-10-14 18:30:00 |
| acctsessiontime | 37800 |
| acctinputoctets | 5368709120 |
| acctoutputoctets | 1073741824 |

---

## Common Patterns

### Pagination

Most list endpoints support pagination:

```
GET /api/billing/dunning/campaigns?skip=0&limit=50
```

**Response includes:**
```json
{
  "results": [...],
  "total": 250,
  "skip": 0,
  "limit": 50
}
```

### Filtering

Filter by date range:
```
GET /api/billing/usage/records?period_start=2025-10-01T00:00:00Z&period_end=2025-10-31T23:59:59Z
```

Filter by status:
```
GET /api/services/lifecycle/instances?status=active
```

### Sorting

Sort by creation date:
```
GET /api/billing/dunning/executions?sort=-created_at
```

(Use `-` prefix for descending order)

---

## Error Handling

### Standard Error Response

All errors return a consistent format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Service instance not found",
    "details": {
      "service_id": "880e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

### Common HTTP Status Codes

| Status | Code | Description |
|--------|------|-------------|
| 200 | OK | Request successful |
| 201 | CREATED | Resource created successfully |
| 400 | BAD_REQUEST | Invalid request data |
| 401 | UNAUTHORIZED | Authentication required |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict (e.g., duplicate) |
| 422 | UNPROCESSABLE_ENTITY | Validation error |
| 429 | TOO_MANY_REQUESTS | Rate limit exceeded |
| 500 | INTERNAL_SERVER_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

### Validation Errors

Validation errors include field-specific details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "errors": [
        {
          "field": "quantity",
          "message": "quantity must be positive",
          "value": -10.0
        }
      ]
    }
  }
}
```

## Deployment Orchestration API

Deployment automation endpoints that power orchestration dashboards and partner monitoring workflows.

### Get Deployment Statistics

**Endpoint:** `GET /api/v1/deployment/stats`

**Query Parameters:**
- `tenant_id` (optional): Restrict statistics to a specific tenant.

**Response:** `200 OK`
```json
{
  "total_instances": 42,
  "states": {
    "active": 30,
    "provisioning": 5,
    "failed": 4,
    "suspended": 3
  },
  "health": {
    "healthy": 28,
    "degraded": 9,
    "unhealthy": 5
  }
}
```

### Get Template Usage Metrics

**Endpoint:** `GET /api/v1/deployment/stats/templates`

**Response:** `200 OK`
```json
{
  "templates": [
    {
      "template_name": "k8s_prod",
      "display_name": "Kubernetes - Production",
      "instances": 12
    },
    {
      "template_name": "edge_gateway",
      "display_name": "Edge Gateway Bundle",
      "instances": 7
    }
  ],
  "total_templates": 2,
  "total_instances": 19
}
```

### Get Resource Allocation Totals

**Endpoint:** `GET /api/v1/deployment/stats/resources`

**Query Parameters:**
- `tenant_id` (optional): Restrict totals to a specific tenant.

**Response:** `200 OK`
```json
{
  "total_cpu": 128,
  "total_memory": 512,
  "total_storage": 1024
}
```

`total_cpu` is expressed in cores, while `total_memory` and `total_storage` represent GiB.

---

## Rate Limiting

API endpoints are rate-limited:

- **Default:** 100 requests per minute per tenant
- **Authenticated users:** 1000 requests per minute
- **Bulk operations:** 10 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1697299200
```

---

## Webhooks (Coming Soon)

Subscribe to events:
- `service.provisioned`
- `service.suspended`
- `service.terminated`
- `dunning.execution.completed`
- `usage.threshold.exceeded`

---

## SDK Support (Coming Soon)

Official SDKs:
- Python: `pip install dotmac-platform-sdk`
- Node.js: `npm install @dotmac/platform-sdk`
- Go: `go get github.com/dotmac/platform-sdk-go`

---

## Support

- **Documentation:** `/docs` (development environment)
- **API Schema:** `/openapi.json`
- **Health Check:** `GET /health`
- **Version:** `GET /version`

---

**Generated:** October 14, 2025
**Platform Version:** 1.0.0
**API Version:** v1

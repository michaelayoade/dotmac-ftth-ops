# ISP Platform - API Specifications

**Version:** 1.0
**Date:** 2025-10-14
**Base URL:** `https://api.yourdomain.com`
**API Version:** v1

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Patterns](#common-patterns)
4. [RADIUS APIs](#radius-apis)
5. [Service Lifecycle APIs](#service-lifecycle-apis)
6. [Network Management APIs](#network-management-apis)
7. [FTTH Management APIs](#ftth-management-apis)
8. [Wireless Management APIs](#wireless-management-apis)
9. [Subscriber Management APIs](#subscriber-management-apis)
10. [VPN Management APIs](#vpn-management-apis)
11. [Monitoring APIs](#monitoring-apis)
12. [Error Codes](#error-codes)
13. [Webhooks](#webhooks)

---

## Overview

The ISP Platform provides comprehensive RESTful APIs for managing all aspects of ISP operations.

**API Characteristics:**
- **RESTful design** - Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- **JSON format** - All requests and responses use JSON
- **Multi-tenant** - All APIs are tenant-scoped
- **Paginated** - List endpoints support pagination
- **Versioned** - API version in URL (`/api/v1/`)
- **OpenAPI 3.0** - Full OpenAPI specification available at `/api/v1/docs`
- **GraphQL** - Alternative GraphQL API at `/api/v1/graphql`

**Base URLs:**
- Development: `http://localhost:8000/api/v1`
- Staging: `https://api-staging.yourdomain.com/api/v1`
- Production: `https://api.yourdomain.com/api/v1`

---

## Authentication

### JWT Bearer Token

All API requests require authentication via JWT bearer token.

**Headers:**
```http
Authorization: Bearer <access_token>
X-Tenant-ID: <tenant_id>
Content-Type: application/json
```

### Login Endpoint

**POST** `/api/v1/auth/login/cookie`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "tenant_id": "tenant_123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "full_name": "John Doe",
    "roles": ["noc_engineer"]
  }
}
```

### Token Refresh

**POST** `/api/v1/auth/refresh`

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

---

## Common Patterns

### Pagination

**Query Parameters:**
- `page` - Page number (default: 1)
- `page_size` - Items per page (default: 20, max: 100)
- `sort_by` - Field to sort by
- `sort_order` - `asc` or `desc`

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 156,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

### Filtering

**Query Parameters:**
```
?status=active
?created_after=2025-01-01T00:00:00Z
?search=john
```

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "SUBSCRIBER_NOT_FOUND",
    "message": "Subscriber with ID sub_123 not found",
    "details": { ... }
  }
}
```

### Standard HTTP Status Codes
- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## RADIUS APIs

Base path: `/api/v1/radius`

### Create RADIUS Credentials

**POST** `/api/v1/radius/subscribers`

Create RADIUS authentication credentials for a subscriber.

**Request:**
```json
{
  "subscriber_id": "sub_123",
  "username": "user001",
  "password": "secure_password",
  "bandwidth_profile_id": "profile_123",
  "attributes": {
    "Session-Timeout": 86400,
    "Idle-Timeout": 3600,
    "Framed-IP-Address": "10.100.1.1"
  }
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "radcred_123",
    "subscriber_id": "sub_123",
    "username": "user001",
    "bandwidth_profile": {
      "name": "50M",
      "download_mbps": 50,
      "upload_mbps": 50
    },
    "status": "active",
    "created_at": "2025-10-14T12:00:00Z"
  }
}
```

### Update Bandwidth Profile

**PUT** `/api/v1/radius/subscribers/{subscriber_id}/bandwidth`

Change subscriber bandwidth profile.

**Request:**
```json
{
  "bandwidth_profile_id": "profile_456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "subscriber_id": "sub_123",
    "old_profile": "50M",
    "new_profile": "100M",
    "applied_at": "2025-10-14T12:05:00Z"
  }
}
```

### Suspend Subscriber

**PUT** `/api/v1/radius/subscribers/{subscriber_id}/suspend`

Suspend subscriber by removing RADIUS authentication.

**Request:**
```json
{
  "reason": "non_payment",
  "notes": "Invoice overdue by 30 days"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "subscriber_id": "sub_123",
    "status": "suspended",
    "suspended_at": "2025-10-14T12:10:00Z"
  }
}
```

### Reactivate Subscriber

**PUT** `/api/v1/radius/subscribers/{subscriber_id}/reactivate`

Reactivate suspended subscriber.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "subscriber_id": "sub_123",
    "status": "active",
    "reactivated_at": "2025-10-14T12:15:00Z"
  }
}
```

### Get Active Sessions

**GET** `/api/v1/radius/sessions`

List all active RADIUS sessions.

**Query Parameters:**
- `subscriber_id` - Filter by subscriber
- `nas_ip` - Filter by NAS IP
- `page`, `page_size` - Pagination

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "session_id": "sess_123",
      "username": "user001",
      "subscriber_id": "sub_123",
      "nas_ip": "10.0.1.1",
      "framed_ip": "10.100.1.1",
      "start_time": "2025-10-14T10:00:00Z",
      "session_time": 7200,
      "bytes_in": 1073741824,
      "bytes_out": 536870912
    }
  ],
  "pagination": { ... }
}
```

### Get Subscriber Usage

**GET** `/api/v1/radius/subscribers/{subscriber_id}/usage`

Get usage statistics for a subscriber.

**Query Parameters:**
- `start_date` - Start date (ISO 8601)
- `end_date` - End date (ISO 8601)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "subscriber_id": "sub_123",
    "period": {
      "start": "2025-10-01T00:00:00Z",
      "end": "2025-10-14T23:59:59Z"
    },
    "usage": {
      "total_sessions": 42,
      "total_time_seconds": 302400,
      "total_download_bytes": 107374182400,
      "total_upload_bytes": 53687091200,
      "total_download_gb": 100.0,
      "total_upload_gb": 50.0,
      "total_data_gb": 150.0
    },
    "daily_breakdown": [
      {
        "date": "2025-10-01",
        "download_gb": 5.2,
        "upload_gb": 2.1,
        "sessions": 3
      }
    ]
  }
}
```

### Register NAS (Router)

**POST** `/api/v1/radius/nas`

Register a new Network Access Server (router).

**Request:**
```json
{
  "nasname": "10.0.1.1",
  "shortname": "router01",
  "type": "mikrotik",
  "secret": "shared_secret_here",
  "description": "Main edge router"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "nas_123",
    "nasname": "10.0.1.1",
    "shortname": "router01",
    "type": "mikrotik",
    "created_at": "2025-10-14T12:00:00Z"
  }
}
```

---

## Service Lifecycle APIs

Base path: `/api/v1/service-lifecycle`

### Activate Service

**POST** `/api/v1/service-lifecycle/activate`

Activate a new subscriber service (full workflow).

**Request:**
```json
{
  "subscriber_id": "sub_123",
  "service_type": "ftth",
  "bandwidth_profile_id": "profile_50m",
  "billing_plan_id": "plan_residential_50m",
  "installation_date": "2025-10-20",
  "config": {
    "pppoe_username": "user001",
    "pppoe_password": "secure_pass",
    "static_ip": null,
    "vlan_id": 100,
    "onu_serial": "HWTC12345678",
    "wifi_ssid": "CustomerNet_001",
    "wifi_password": "wifi_secure_pass"
  }
}
```

**Response:** `202 Accepted` (Async operation)
```json
{
  "success": true,
  "data": {
    "activation_id": "act_123",
    "subscriber_id": "sub_123",
    "status": "pending",
    "workflow_id": "wf_123",
    "estimated_completion": "2025-10-14T12:10:00Z",
    "steps": [
      {
        "step": "validate_subscriber",
        "status": "pending",
        "order": 1
      },
      {
        "step": "create_radius_credentials",
        "status": "pending",
        "order": 2
      },
      {
        "step": "allocate_ip_address",
        "status": "pending",
        "order": 3
      },
      {
        "step": "provision_onu",
        "status": "pending",
        "order": 4
      },
      {
        "step": "configure_cpe",
        "status": "pending",
        "order": 5
      },
      {
        "step": "activate_billing",
        "status": "pending",
        "order": 6
      },
      {
        "step": "send_welcome_email",
        "status": "pending",
        "order": 7
      }
    ]
  }
}
```

### Check Activation Status

**GET** `/api/v1/service-lifecycle/activations/{activation_id}`

Check status of activation workflow.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "activation_id": "act_123",
    "subscriber_id": "sub_123",
    "status": "in_progress",
    "current_step": "provision_onu",
    "progress_percent": 57,
    "started_at": "2025-10-14T12:00:00Z",
    "steps": [
      {
        "step": "validate_subscriber",
        "status": "completed",
        "completed_at": "2025-10-14T12:00:30Z"
      },
      {
        "step": "create_radius_credentials",
        "status": "completed",
        "completed_at": "2025-10-14T12:01:00Z"
      },
      {
        "step": "allocate_ip_address",
        "status": "completed",
        "completed_at": "2025-10-14T12:01:15Z"
      },
      {
        "step": "provision_onu",
        "status": "in_progress",
        "started_at": "2025-10-14T12:01:20Z"
      }
    ]
  }
}
```

### Suspend Service

**POST** `/api/v1/service-lifecycle/suspend`

Suspend subscriber service (removes RADIUS auth, redirects to walled garden).

**Request:**
```json
{
  "subscriber_id": "sub_123",
  "reason": "non_payment",
  "walled_garden": true,
  "walled_garden_url": "https://portal.example.com/pay",
  "notify_subscriber": true
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "suspension_id": "susp_123",
    "subscriber_id": "sub_123",
    "status": "pending",
    "workflow_id": "wf_456"
  }
}
```

### Terminate Service

**POST** `/api/v1/service-lifecycle/terminate`

Terminate subscriber service permanently.

**Request:**
```json
{
  "subscriber_id": "sub_123",
  "reason": "customer_request",
  "termination_date": "2025-10-20",
  "refund_amount": 0.00,
  "schedule_equipment_pickup": true
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "termination_id": "term_123",
    "subscriber_id": "sub_123",
    "status": "scheduled",
    "termination_date": "2025-10-20",
    "workflow_id": "wf_789"
  }
}
```

### Upgrade/Downgrade Plan

**POST** `/api/v1/service-lifecycle/change-plan`

Change subscriber bandwidth plan.

**Request:**
```json
{
  "subscriber_id": "sub_123",
  "new_bandwidth_profile_id": "profile_100m",
  "new_billing_plan_id": "plan_residential_100m",
  "effective_date": "immediate",
  "proration": "charge_prorated"
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "change_id": "chg_123",
    "subscriber_id": "sub_123",
    "old_profile": "50M",
    "new_profile": "100M",
    "proration_charge": 15.00,
    "effective_at": "2025-10-14T12:05:00Z"
  }
}
```

---

## Network Management APIs

Base path: `/api/v1/network`

### List Devices

**GET** `/api/v1/network/devices`

List all network devices.

**Query Parameters:**
- `device_type` - Filter by type (olt, router, switch, etc.)
- `status` - Filter by status
- `site_name` - Filter by site
- `page`, `page_size` - Pagination

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "dev_123",
      "name": "OLT-HQ-01",
      "device_type": "olt",
      "vendor": "Huawei",
      "model": "MA5800-X17",
      "primary_ip": "10.0.1.10",
      "status": "active",
      "operational_status": "online",
      "location": {
        "site_name": "Headquarters",
        "lat": 40.7128,
        "lng": -74.0060
      },
      "capacity": {
        "total_ports": 16,
        "used_ports": 12,
        "utilization_percent": 75
      }
    }
  ],
  "pagination": { ... }
}
```

### Get Device Details

**GET** `/api/v1/network/devices/{device_id}`

Get detailed information about a device.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "dev_123",
    "name": "OLT-HQ-01",
    "device_type": "olt",
    "vendor": "Huawei",
    "model": "MA5800-X17",
    "serial_number": "2102350ABCD1234",
    "primary_ip": "10.0.1.10",
    "management_ip": "10.0.1.10",
    "mac_address": "00:11:22:33:44:55",
    "status": "active",
    "operational_status": "online",
    "location": {
      "site_name": "Headquarters",
      "address": "123 Main St, New York, NY 10001",
      "lat": 40.7128,
      "lng": -74.0060,
      "rack_location": "Rack 3, RU 10-14"
    },
    "firmware_version": "V800R022C00",
    "hardware_version": "V3.0",
    "last_config_backup": "2025-10-14T02:00:00Z",
    "uptime_seconds": 2592000,
    "ports": {
      "total": 16,
      "used": 12,
      "available": 4
    },
    "netbox_id": 456,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

### Create Device

**POST** `/api/v1/network/devices`

Register a new network device.

**Request:**
```json
{
  "name": "Router-Branch-01",
  "device_type": "router",
  "vendor": "MikroTik",
  "model": "CCR1036-12G-4S",
  "serial_number": "ABC123456789",
  "primary_ip": "10.0.2.1",
  "management_ip": "10.0.2.1",
  "location": {
    "site_name": "Branch Office",
    "address": "456 Branch Ave",
    "lat": 40.7580,
    "lng": -73.9855
  },
  "credentials_vault_path": "secret/devices/router-branch-01"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "dev_456",
    "name": "Router-Branch-01",
    "device_type": "router",
    "status": "active",
    "created_at": "2025-10-14T12:00:00Z"
  }
}
```

### IP Address Management (IPAM)

#### List IP Pools

**GET** `/api/v1/network/ipam/pools`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "pool_123",
      "name": "Residential Subscribers",
      "network_cidr": "10.100.0.0/16",
      "gateway": "10.100.0.1",
      "dns_primary": "8.8.8.8",
      "dns_secondary": "8.8.4.4",
      "total_ips": 65534,
      "allocated_ips": 1250,
      "available_ips": 64284,
      "utilization_percent": 1.9,
      "vlan_id": 100,
      "is_active": true
    }
  ]
}
```

#### Allocate IP Address

**POST** `/api/v1/network/ipam/allocate`

Allocate an IP address from a pool.

**Request:**
```json
{
  "ip_pool_id": "pool_123",
  "subscriber_id": "sub_123",
  "ip_address": null,
  "mac_address": "aa:bb:cc:dd:ee:ff"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "allocation_id": "alloc_123",
    "ip_address": "10.100.1.50",
    "subscriber_id": "sub_123",
    "mac_address": "aa:bb:cc:dd:ee:ff",
    "status": "allocated",
    "allocated_at": "2025-10-14T12:00:00Z"
  }
}
```

#### Release IP Address

**DELETE** `/api/v1/network/ipam/allocations/{allocation_id}`

Release an IP address back to the pool.

**Response:** `204 No Content`

---

## FTTH Management APIs

Base path: `/api/v1/ftth`

### List OLTs

**GET** `/api/v1/ftth/olts`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "olt_123",
      "name": "OLT-HQ-01",
      "device_id": "dev_123",
      "olt_type": "gpon",
      "max_pon_ports": 16,
      "active_pon_ports": 12,
      "total_onu_capacity": 2048,
      "active_onus": 850,
      "utilization_percent": 41.5,
      "status": "online"
    }
  ]
}
```

### Get OLT Details

**GET** `/api/v1/ftth/olts/{olt_id}`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "olt_123",
    "name": "OLT-HQ-01",
    "device": {
      "vendor": "Huawei",
      "model": "MA5800-X17",
      "ip": "10.0.1.10"
    },
    "olt_type": "gpon",
    "pon_ports": [
      {
        "port_number": 0,
        "port_id": "0/0/0",
        "status": "online",
        "onus_connected": 68,
        "max_onus": 128,
        "utilization_percent": 53.1
      },
      {
        "port_number": 1,
        "port_id": "0/0/1",
        "status": "online",
        "onus_connected": 45,
        "max_onus": 128,
        "utilization_percent": 35.2
      }
    ],
    "total_capacity": {
      "max_onus": 2048,
      "active_onus": 850,
      "available_capacity": 1198
    }
  }
}
```

### List ONUs

**GET** `/api/v1/ftth/onus`

**Query Parameters:**
- `olt_id` - Filter by OLT
- `subscriber_id` - Filter by subscriber
- `status` - Filter by status
- `pon_port` - Filter by PON port

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "onu_123",
      "serial_number": "HWTC12345678",
      "vendor": "Huawei",
      "model": "HG8310M",
      "olt_id": "olt_123",
      "pon_port": 0,
      "onu_id": 1,
      "status": "active",
      "operational_status": "up",
      "subscriber": {
        "id": "sub_123",
        "number": "SUB-000001",
        "name": "John Doe"
      },
      "optical_metrics": {
        "rx_power_dbm": -18.5,
        "tx_power_dbm": 2.3,
        "distance_meters": 1500
      },
      "last_seen": "2025-10-14T11:55:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Provision ONU

**POST** `/api/v1/ftth/onus/provision`

Provision (whitelist and activate) an ONU on the OLT.

**Request:**
```json
{
  "olt_id": "olt_123",
  "pon_port": 0,
  "serial_number": "HWTC12345678",
  "subscriber_id": "sub_123",
  "service_profile": "1G_SYMMETRIC",
  "vlan_id": 100
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "onu_id": "onu_123",
    "serial_number": "HWTC12345678",
    "olt_id": "olt_123",
    "pon_port": 0,
    "onu_id_assigned": 1,
    "status": "provisioning",
    "job_id": "job_123"
  }
}
```

### Get ONU Metrics

**GET** `/api/v1/ftth/onus/{onu_id}/metrics`

Get real-time metrics for an ONU.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "onu_id": "onu_123",
    "timestamp": "2025-10-14T12:00:00Z",
    "optical": {
      "rx_power_dbm": -18.5,
      "tx_power_dbm": 2.3,
      "temperature_celsius": 45,
      "voltage_v": 3.3,
      "distance_meters": 1500
    },
    "ethernet_ports": [
      {
        "port": 1,
        "status": "up",
        "speed": "1000M",
        "duplex": "full"
      }
    ],
    "service": {
      "vlan_id": 100,
      "bandwidth_profile": "1G_SYMMETRIC"
    }
  }
}
```

### TR-069 (GenieACS) APIs

#### List CPE Devices

**GET** `/api/v1/ftth/tr069/devices`

List all TR-069 managed CPE devices.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "device_id": "cpe_123",
      "serial_number": "HWTC12345678",
      "subscriber_id": "sub_123",
      "model": "HG8310M",
      "firmware_version": "V300R019C00SPC110",
      "connection_status": "online",
      "last_inform": "2025-10-14T11:58:00Z",
      "wan_ip": "100.64.1.50",
      "lan_ip": "192.168.1.1"
    }
  ]
}
```

#### Configure CPE WiFi

**POST** `/api/v1/ftth/tr069/devices/{device_id}/wifi`

Configure WiFi settings on CPE via TR-069.

**Request:**
```json
{
  "ssid": "CustomerNet_001",
  "password": "secure_wifi_password",
  "channel": "auto",
  "mode": "802.11ac",
  "encryption": "wpa2-psk"
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "task_id": "task_123",
    "device_id": "cpe_123",
    "status": "pending",
    "estimated_completion": "2025-10-14T12:02:00Z"
  }
}
```

#### Reboot CPE

**POST** `/api/v1/ftth/tr069/devices/{device_id}/reboot`

Remotely reboot a CPE device.

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "task_id": "task_456",
    "device_id": "cpe_123",
    "action": "reboot",
    "status": "pending"
  }
}
```

---

## Wireless Management APIs

Base path: `/api/v1/wireless`

### List Towers

**GET** `/api/v1/wireless/towers`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "tower_123",
      "name": "Tower Hill",
      "tower_type": "monopole",
      "height_meters": 50,
      "location": {
        "lat": 40.7580,
        "lng": -73.9855,
        "elevation_meters": 120,
        "address": "Hill Road, NY"
      },
      "status": "active",
      "sectors_count": 3,
      "total_subscribers": 145
    }
  ]
}
```

### List Sectors

**GET** `/api/v1/wireless/sectors`

**Query Parameters:**
- `tower_id` - Filter by tower

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "sector_123",
      "name": "North Sector",
      "tower_id": "tower_123",
      "device_id": "dev_789",
      "frequency_mhz": 5800,
      "channel": 149,
      "azimuth": 0,
      "beamwidth_degrees": 90,
      "max_range_km": 15,
      "max_capacity_mbps": 500,
      "current_subscribers": 48,
      "utilization_percent": 65,
      "status": "online"
    }
  ]
}
```

### Get Sector Details

**GET** `/api/v1/wireless/sectors/{sector_id}`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "sector_123",
    "name": "North Sector",
    "tower": {
      "id": "tower_123",
      "name": "Tower Hill"
    },
    "radio": {
      "frequency_mhz": 5800,
      "channel": 149,
      "channel_width_mhz": 80,
      "tx_power_dbm": 27
    },
    "antenna": {
      "model": "Ubiquiti airMAX Sector",
      "gain_dbi": 19,
      "azimuth": 0,
      "beamwidth": 90,
      "downtilt": 3
    },
    "coverage_area": {
      "max_range_km": 15,
      "geojson": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      }
    },
    "subscribers": {
      "count": 48,
      "max_capacity": 60,
      "avg_signal_dbm": -65
    }
  }
}
```

### List Wireless Subscribers

**GET** `/api/v1/wireless/subscribers`

**Query Parameters:**
- `sector_id` - Filter by sector
- `status` - Filter by status

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "wsub_123",
      "subscriber_id": "sub_456",
      "subscriber_name": "Jane Doe",
      "sector_id": "sector_123",
      "cpe_mac": "aa:bb:cc:dd:ee:ff",
      "cpe_model": "Ubiquiti NanoStation AC",
      "location": {
        "lat": 40.7650,
        "lng": -73.9800,
        "address": "789 Customer St"
      },
      "signal": {
        "strength_dbm": -68,
        "quality_percent": 85,
        "snr_db": 35
      },
      "link": {
        "distance_km": 3.2,
        "speed_mbps": 200
      },
      "status": "active",
      "last_seen": "2025-10-14T11:59:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

## Subscriber Management APIs

Base path: `/api/v1/subscribers`

### List Subscribers

**GET** `/api/v1/subscribers`

**Query Parameters:**
- `status` - Filter by status
- `service_type` - Filter by service type
- `search` - Search by name, number, email
- `page`, `page_size`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "sub_123",
      "subscriber_number": "SUB-000001",
      "customer": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1-555-0100"
      },
      "service_type": "ftth",
      "status": "active",
      "bandwidth_profile": "50M",
      "service_address": "123 Main St, Apt 4B, New York, NY 10001",
      "installation_status": "completed",
      "installation_date": "2025-01-15",
      "service_activated_at": "2025-01-15T14:30:00Z",
      "monthly_bill": 49.99,
      "last_payment_date": "2025-10-01"
    }
  ],
  "pagination": { ... }
}
```

### Get Subscriber Details

**GET** `/api/v1/subscribers/{subscriber_id}`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "sub_123",
    "subscriber_number": "SUB-000001",
    "customer_id": "cust_456",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1-555-0100"
    },
    "service": {
      "type": "ftth",
      "connection_type": "pppoe",
      "status": "active",
      "bandwidth_profile": {
        "id": "profile_123",
        "name": "50M",
        "download_mbps": 50,
        "upload_mbps": 50
      }
    },
    "address": {
      "line1": "123 Main St, Apt 4B",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "USA",
      "location": {
        "lat": 40.7128,
        "lng": -74.0060
      }
    },
    "installation": {
      "status": "completed",
      "date": "2025-01-15",
      "installed_by": "tech_789"
    },
    "network": {
      "pppoe_username": "user001",
      "static_ip": null,
      "vlan_id": 100,
      "onu_serial": "HWTC12345678",
      "olt_name": "OLT-HQ-01",
      "pon_port": "0/0/1"
    },
    "usage": {
      "monthly_data_cap_gb": null,
      "current_month_usage_gb": 125.5
    },
    "billing": {
      "subscription_id": "billing_sub_789",
      "monthly_charge": 49.99,
      "billing_cycle_day": 1,
      "last_payment_date": "2025-10-01",
      "next_billing_date": "2025-11-01"
    },
    "dates": {
      "service_activated_at": "2025-01-15T14:30:00Z",
      "created_at": "2025-01-10T10:00:00Z"
    }
  }
}
```

### Create Subscriber

**POST** `/api/v1/subscribers`

**Request:**
```json
{
  "customer_id": "cust_456",
  "service_type": "ftth",
  "connection_type": "pppoe",
  "service_address": {
    "line1": "123 Main St, Apt 4B",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "lat": 40.7128,
    "lng": -74.0060
  },
  "bandwidth_profile_id": "profile_123",
  "billing_plan_id": "plan_residential_50m",
  "installation_date": "2025-10-20"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "sub_789",
    "subscriber_number": "SUB-000156",
    "status": "pending",
    "created_at": "2025-10-14T12:00:00Z"
  }
}
```

### Update Subscriber

**PATCH** `/api/v1/subscribers/{subscriber_id}`

**Request:**
```json
{
  "service_address": {
    "line1": "456 New St, Apt 2A"
  },
  "notes": "Customer relocated"
}
```

**Response:** `200 OK`

### Get Subscriber Services

**GET** `/api/v1/subscribers/{subscriber_id}/services`

Get all services for a subscriber (RADIUS, ONU, CPE, etc.).

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "subscriber_id": "sub_123",
    "radius": {
      "username": "user001",
      "bandwidth_profile": "50M",
      "status": "active"
    },
    "ftth": {
      "olt_name": "OLT-HQ-01",
      "pon_port": "0/0/1",
      "onu": {
        "serial_number": "HWTC12345678",
        "status": "active",
        "rx_power_dbm": -18.5,
        "distance_meters": 1500
      },
      "cpe": {
        "model": "HG8310M",
        "wan_ip": "100.64.1.50",
        "wifi_ssid": "CustomerNet_001",
        "last_seen": "2025-10-14T11:58:00Z"
      }
    },
    "ip_allocation": {
      "ip_address": "10.100.1.50",
      "mac_address": "aa:bb:cc:dd:ee:ff"
    }
  }
}
```

---

## VPN Management APIs

Base path: `/api/v1/vpn`

### List VPN Tunnels

**GET** `/api/v1/vpn/tunnels`

**Query Parameters:**
- `device_id` - Filter by device
- `status` - Filter by status

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "vpn_123",
      "tunnel_name": "OLT-Branch-01-VPN",
      "device_id": "dev_456",
      "device_name": "OLT-Branch-01",
      "tunnel_type": "wireguard",
      "vpn_ip": "10.200.1.10",
      "status": "active",
      "last_handshake": "2025-10-14T11:55:00Z",
      "data_rx_gb": 125.5,
      "data_tx_gb": 45.2
    }
  ]
}
```

### Create VPN Tunnel

**POST** `/api/v1/vpn/tunnels`

**Request:**
```json
{
  "device_id": "dev_456",
  "tunnel_name": "OLT-Branch-01-VPN",
  "tunnel_type": "wireguard"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "vpn_123",
    "tunnel_name": "OLT-Branch-01-VPN",
    "device_id": "dev_456",
    "vpn_ip": "10.200.1.10",
    "status": "configured",
    "config_available": true
  }
}
```

### Get VPN Configuration

**GET** `/api/v1/vpn/tunnels/{tunnel_id}/config`

Download WireGuard configuration file.

**Response:** `200 OK`
```ini
[Interface]
PrivateKey = <private-key>
Address = 10.200.1.10/32
DNS = 10.200.0.1

[Peer]
PublicKey = <server-public-key>
Endpoint = vpn.example.com:51820
AllowedIPs = 10.200.0.0/16, 10.0.0.0/8
PersistentKeepalive = 25
```

### Get VPN Status

**GET** `/api/v1/vpn/tunnels/{tunnel_id}/status`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "tunnel_id": "vpn_123",
    "status": "active",
    "last_handshake": "2025-10-14T11:55:00Z",
    "endpoint": "203.0.113.50:51820",
    "transfer": {
      "rx_bytes": 134764544000,
      "tx_bytes": 48528588800,
      "rx_gb": 125.5,
      "tx_gb": 45.2
    },
    "uptime_seconds": 2592000
  }
}
```

---

## Monitoring APIs

Base path: `/api/v1/monitoring`

### Get Network Health

**GET** `/api/v1/monitoring/health`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "overall_status": "healthy",
    "timestamp": "2025-10-14T12:00:00Z",
    "devices": {
      "total": 25,
      "online": 24,
      "offline": 1,
      "degraded": 0
    },
    "subscribers": {
      "total": 1250,
      "active_sessions": 1205,
      "suspended": 15,
      "offline": 30
    },
    "olts": {
      "total": 5,
      "online": 5,
      "offline": 0,
      "utilization_avg": 42.5
    },
    "bandwidth": {
      "total_capacity_gbps": 10,
      "current_usage_gbps": 4.2,
      "utilization_percent": 42
    }
  }
}
```

### Get Active Alarms

**GET** `/api/v1/monitoring/alarms`

**Query Parameters:**
- `severity` - Filter by severity (critical, high, medium, low)
- `status` - Filter by status (active, acknowledged, resolved)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "alarm_123",
      "severity": "high",
      "type": "device_offline",
      "device_id": "dev_456",
      "device_name": "Router-Branch-01",
      "message": "Device unreachable",
      "status": "active",
      "triggered_at": "2025-10-14T11:30:00Z",
      "acknowledged_at": null,
      "acknowledged_by": null
    }
  ]
}
```

### Get Performance Metrics

**GET** `/api/v1/monitoring/metrics`

**Query Parameters:**
- `device_id` - Specific device
- `metric_type` - Type of metric (cpu, memory, bandwidth, etc.)
- `start_time`, `end_time` - Time range
- `interval` - Data granularity (1m, 5m, 1h, 1d)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "device_id": "dev_123",
    "metric_type": "bandwidth",
    "interval": "5m",
    "unit": "mbps",
    "datapoints": [
      {
        "timestamp": "2025-10-14T11:00:00Z",
        "rx_mbps": 450.5,
        "tx_mbps": 380.2
      },
      {
        "timestamp": "2025-10-14T11:05:00Z",
        "rx_mbps": 478.3,
        "tx_mbps": 395.1
      }
    ]
  }
}
```

---

## Error Codes

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    },
    "request_id": "req_123",
    "timestamp": "2025-10-14T12:00:00Z"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |

### RADIUS-Specific Errors

| Code | Description |
|------|-------------|
| `RADIUS_SUBSCRIBER_NOT_FOUND` | Subscriber doesn't exist |
| `RADIUS_CREDENTIALS_EXIST` | Credentials already created |
| `RADIUS_NAS_NOT_CONFIGURED` | NAS not registered |
| `RADIUS_PROFILE_NOT_FOUND` | Bandwidth profile not found |

### Service Lifecycle Errors

| Code | Description |
|------|-------------|
| `ACTIVATION_FAILED` | Service activation failed |
| `ACTIVATION_IN_PROGRESS` | Activation already in progress |
| `SUBSCRIBER_ALREADY_ACTIVE` | Subscriber already active |
| `INSUFFICIENT_CAPACITY` | No capacity available |

---

## Webhooks

The platform can send webhooks for real-time event notifications.

### Configuring Webhooks

**POST** `/api/v1/webhooks/subscriptions`

**Request:**
```json
{
  "url": "https://your-server.com/webhooks/isp-platform",
  "events": [
    "subscriber.activated",
    "subscriber.suspended",
    "service.activation.completed",
    "service.activation.failed",
    "onu.online",
    "onu.offline",
    "alarm.triggered"
  ],
  "secret": "webhook_signing_secret"
}
```

### Webhook Payload

**Header:**
```
X-ISP-Platform-Signature: sha256=<hmac_signature>
X-ISP-Platform-Event: subscriber.activated
X-ISP-Platform-Request-ID: req_123
```

**Payload:**
```json
{
  "event": "subscriber.activated",
  "timestamp": "2025-10-14T12:00:00Z",
  "tenant_id": "tenant_123",
  "data": {
    "subscriber_id": "sub_123",
    "subscriber_number": "SUB-000001",
    "service_type": "ftth",
    "bandwidth_profile": "50M",
    "activated_at": "2025-10-14T12:00:00Z"
  }
}
```

### Event Types

| Event | Description |
|-------|-------------|
| `subscriber.activated` | Service activated |
| `subscriber.suspended` | Service suspended |
| `subscriber.terminated` | Service terminated |
| `service.activation.completed` | Activation workflow completed |
| `service.activation.failed` | Activation workflow failed |
| `onu.online` | ONU came online |
| `onu.offline` | ONU went offline |
| `onu.provisioned` | ONU provisioned |
| `alarm.triggered` | Alarm triggered |
| `alarm.cleared` | Alarm cleared |
| `device.offline` | Device went offline |
| `device.online` | Device came online |

---

## Rate Limiting

**Limits:**
- Anonymous: 100 requests/hour
- Authenticated: 1,000 requests/hour
- Premium: 10,000 requests/hour

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1699632000
```

---

## OpenAPI Documentation

Full OpenAPI 3.0 specification available at:
- **Swagger UI:** `https://api.yourdomain.com/api/v1/docs`
- **ReDoc:** `https://api.yourdomain.com/api/v1/redoc`
- **JSON:** `https://api.yourdomain.com/api/v1/openapi.json`

---

## Related Documents

- [Architecture Overview](ISP_PLATFORM_ARCHITECTURE.md)
- [Database Schema](DATABASE_SCHEMA.md)
- [Infrastructure Setup](INFRASTRUCTURE_SETUP.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-14 | API Team | Initial API specifications |

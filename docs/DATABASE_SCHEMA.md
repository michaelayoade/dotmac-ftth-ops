# ISP Platform - Database Schema Design

**Version:** 1.0
**Date:** 2025-10-14
**Database:** PostgreSQL 14+
**ORM:** SQLAlchemy 2.0

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Design Principles](#schema-design-principles)
3. [Core Tables (Existing)](#core-tables-existing)
4. [RADIUS Tables (New)](#radius-tables-new)
5. [Network Management Tables (New)](#network-management-tables-new)
6. [FTTH Tables (New)](#ftth-tables-new)
7. [Wireless Tables (New)](#wireless-tables-new)
8. [Service Lifecycle Tables (New)](#service-lifecycle-tables-new)
9. [Entity Relationship Diagrams](#entity-relationship-diagrams)
10. [Indexes & Performance](#indexes--performance)
11. [Migrations](#migrations)

---

## Overview

The ISP Platform database schema consists of:
- **Existing tables**: BSS modules (billing, customers, tenants) - ~80 tables
- **New tables**: OSS modules (RADIUS, network, FTTH, wireless) - ~60 tables
- **Total**: ~140 tables

**Database Architecture:**
- Single PostgreSQL database with schema-based organization
- Multi-tenant isolation via `tenant_id` column + Row-Level Security (RLS)
- Audit columns on all tables (created_at, updated_at, created_by, etc.)
- Soft deletes via `deleted_at` column

---

## Schema Design Principles

### 1. Multi-Tenant Isolation
Every table includes `tenant_id` for data isolation:
```sql
CREATE TABLE example_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id),
    -- other columns
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Enable Row-Level Security
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's data
CREATE POLICY tenant_isolation_policy ON example_table
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR);
```

### 2. Audit Columns
All tables include:
- `created_at` - Record creation timestamp
- `updated_at` - Last modification timestamp
- `deleted_at` - Soft delete timestamp (NULL = not deleted)
- `created_by` - User ID who created the record
- `updated_by` - User ID who last modified the record

### 3. Primary Keys
- UUIDs for distributed systems and security
- `gen_random_uuid()` for PostgreSQL 13+

### 4. Foreign Keys
- All foreign keys use `ON DELETE CASCADE` or `ON DELETE SET NULL` appropriately
- Indexed for performance

### 5. Timestamps
- All timestamps use `TIMESTAMP WITH TIME ZONE` (timestamptz)
- Store in UTC, convert in application layer

---

## Core Tables (Existing)

### Tenants & Users

#### `tenants` (Existing - Enhanced)
```sql
CREATE TABLE tenants (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'trial',
        -- 'active', 'suspended', 'trial', 'inactive', 'pending', 'cancelled'
    plan_type VARCHAR(50) NOT NULL DEFAULT 'free',
        -- 'free', 'starter', 'professional', 'enterprise', 'custom'

    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),
    billing_email VARCHAR(255),
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',

    -- Subscription dates
    trial_ends_at TIMESTAMPTZ,
    subscription_starts_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,

    -- Limits and quotas
    max_users INTEGER DEFAULT 5,
    max_api_calls_per_month INTEGER DEFAULT 10000,
    max_storage_gb INTEGER DEFAULT 10,

    -- NEW: ISP-specific limits
    max_subscribers INTEGER DEFAULT 100,
    max_olts INTEGER DEFAULT 2,
    max_routers INTEGER DEFAULT 5,
    max_wireless_aps INTEGER DEFAULT 10,

    -- Current usage
    current_users INTEGER DEFAULT 0,
    current_api_calls INTEGER DEFAULT 0,
    current_storage_gb NUMERIC(10,2) DEFAULT 0,

    -- NEW: ISP-specific usage
    current_subscribers INTEGER DEFAULT 0,
    current_olts INTEGER DEFAULT 0,
    current_routers INTEGER DEFAULT 0,
    current_wireless_aps INTEGER DEFAULT 0,

    -- Feature flags and settings
    features JSONB DEFAULT '{}'::JSONB,
    settings JSONB DEFAULT '{}'::JSONB,
    custom_metadata JSONB DEFAULT '{}'::JSONB,

    -- Company info
    company_size VARCHAR(50),
    industry VARCHAR(100),
    country VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Branding
    logo_url VARCHAR(500),
    primary_color VARCHAR(20),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
```

#### `users` (Existing)
```sql
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    password_hash VARCHAR(255),
    full_name VARCHAR(255),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,

    -- Roles
    roles JSONB DEFAULT '[]'::JSONB,
        -- ['tenant_admin', 'noc_engineer', 'support_agent', 'field_tech']

    -- MFA
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),

    -- Timestamps
    last_login_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
```

### Billing (Existing - Reference Only)
The billing module already has comprehensive tables:
- `billing_subscriptions`
- `billing_subscription_plans`
- `billing_invoices`
- `billing_invoice_line_items`
- `billing_payments`
- `billing_products`
- `billing_prices`
- etc.

---

## RADIUS Tables (New)

### `radcheck` - Authentication Credentials
```sql
CREATE TABLE radcheck (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscriber_id VARCHAR(255) REFERENCES subscribers(id) ON DELETE CASCADE,

    -- RADIUS standard fields
    username VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
        -- 'Cleartext-Password', 'MD5-Password', 'SHA1-Password', etc.
    op VARCHAR(2) NOT NULL DEFAULT ':=',
        -- ':=' (set), '==' (equal), '=' (add), etc.
    value VARCHAR(253) NOT NULL,
        -- Password or attribute value

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_radcheck_username ON radcheck(username);
CREATE INDEX idx_radcheck_tenant ON radcheck(tenant_id);
CREATE INDEX idx_radcheck_subscriber ON radcheck(subscriber_id);
CREATE UNIQUE INDEX idx_radcheck_unique ON radcheck(tenant_id, username, attribute);
```

### `radreply` - Authorization Attributes
```sql
CREATE TABLE radreply (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscriber_id VARCHAR(255) REFERENCES subscribers(id) ON DELETE CASCADE,

    -- RADIUS standard fields
    username VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
        -- 'Mikrotik-Rate-Limit', 'Framed-IP-Address', 'Session-Timeout', etc.
    op VARCHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL,
        -- e.g., '10M/10M 20M/20M' for Mikrotik-Rate-Limit

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_radreply_username ON radreply(username);
CREATE INDEX idx_radreply_tenant ON radreply(tenant_id);
CREATE INDEX idx_radreply_subscriber ON radreply(subscriber_id);
```

### `radacct` - Accounting Sessions
```sql
CREATE TABLE radacct (
    radacctid BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscriber_id VARCHAR(255) REFERENCES subscribers(id) ON DELETE SET NULL,

    -- Session identification
    acctsessionid VARCHAR(64) NOT NULL,
    acctuniqueid VARCHAR(32) NOT NULL,
    username VARCHAR(64) NOT NULL,

    -- NAS information
    nasipaddress INET NOT NULL,
    nasportid VARCHAR(15),
    nasporttype VARCHAR(32),

    -- Session details
    acctstarttime TIMESTAMPTZ,
    acctupdatetime TIMESTAMPTZ,
    acctstoptime TIMESTAMPTZ,
    acctsessiontime BIGINT,
        -- Duration in seconds
    acctauthentic VARCHAR(32),
    connectinfo_start VARCHAR(50),
    connectinfo_stop VARCHAR(50),

    -- Bandwidth usage
    acctinputoctets BIGINT DEFAULT 0,
        -- Download bytes
    acctoutputoctets BIGINT DEFAULT 0,
        -- Upload bytes

    -- Counters (for rollover support)
    acctinputgigawords INTEGER DEFAULT 0,
    acctoutputgigawords INTEGER DEFAULT 0,

    -- Termination
    acctterminatecause VARCHAR(32),
        -- 'User-Request', 'Session-Timeout', 'Admin-Reset', etc.

    -- Service details
    servicetype VARCHAR(32),
    framedprotocol VARCHAR(32),
    framedipaddress INET,
    framedipv6address INET,
    framedipv6prefix VARCHAR(45),
    framedinterfaceid VARCHAR(44),
    delegatedipv6prefix VARCHAR(45),

    -- Location
    calledstationid VARCHAR(50),
    callingstationid VARCHAR(50),

    -- Accounting
    acctinterval INTEGER,
    acctstartdelay BIGINT,
    acctstopdelay BIGINT,

    -- Extended attributes
    class VARCHAR(64),
    framedmtu INTEGER,
    xascendsessionsvrkey VARCHAR(10),

    UNIQUE(acctuniqueid)
);

-- Indexes for performance
CREATE INDEX idx_radacct_username ON radacct(username);
CREATE INDEX idx_radacct_tenant ON radacct(tenant_id);
CREATE INDEX idx_radacct_subscriber ON radacct(subscriber_id);
CREATE INDEX idx_radacct_sessionid ON radacct(acctsessionid);
CREATE INDEX idx_radacct_start ON radacct(acctstarttime);
CREATE INDEX idx_radacct_stop ON radacct(acctstoptime);
CREATE INDEX idx_radacct_nasip ON radacct(nasipaddress);
CREATE INDEX idx_radacct_active ON radacct(username, nasipaddress)
    WHERE acctstoptime IS NULL;

-- Partition by month for performance
CREATE TABLE radacct_2025_01 PARTITION OF radacct
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- Create partitions for each month...
```

### `nas` - Network Access Servers (Routers)
```sql
CREATE TABLE nas (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- NAS identification
    nasname VARCHAR(128) NOT NULL,
        -- IP address or hostname
    shortname VARCHAR(32) NOT NULL,
        -- Short name for logs
    type VARCHAR(30) DEFAULT 'other',
        -- 'cisco', 'mikrotik', 'juniper', 'other'

    -- Authentication
    secret VARCHAR(60) NOT NULL,
        -- Shared secret for RADIUS

    -- Configuration
    ports INTEGER,
    server VARCHAR(64),
    community VARCHAR(50),
    description VARCHAR(200),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, nasname)
);

CREATE INDEX idx_nas_tenant ON nas(tenant_id);
CREATE INDEX idx_nas_name ON nas(nasname);
```

### `bandwidth_profiles` - Speed Plans
```sql
CREATE TABLE bandwidth_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Profile details
    name VARCHAR(100) NOT NULL,
        -- e.g., '10M', '50M', '100M', '1G'
    description TEXT,

    -- Speed limits (in Mbps)
    download_mbps INTEGER NOT NULL,
    upload_mbps INTEGER NOT NULL,

    -- Burst speeds (optional)
    download_burst_mbps INTEGER,
    upload_burst_mbps INTEGER,
    burst_threshold_mbps INTEGER,
    burst_time_seconds INTEGER,

    -- Priority (for QoS)
    priority INTEGER DEFAULT 5,
        -- 1 (highest) to 10 (lowest)

    -- Limits
    monthly_data_cap_gb INTEGER,
        -- NULL = unlimited
    daily_data_cap_gb INTEGER,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- RADIUS attribute template
    radius_attributes JSONB DEFAULT '{}'::JSONB,
        -- { "Mikrotik-Rate-Limit": "10M/10M 20M/20M" }

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_bandwidth_profiles_tenant ON bandwidth_profiles(tenant_id)
    WHERE deleted_at IS NULL;
```

---

## Network Management Tables (New)

### `subscribers` - ISP Customers (Extends customers)
```sql
CREATE TABLE subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id VARCHAR(255) REFERENCES customers(id) ON DELETE SET NULL,
        -- Link to existing customer_management module

    -- Subscriber identification
    subscriber_number VARCHAR(50) UNIQUE NOT NULL,
        -- e.g., 'SUB-000001'

    -- Service details
    service_type VARCHAR(50) NOT NULL,
        -- 'ftth', 'wireless', 'dsl', 'cable'
    connection_type VARCHAR(50),
        -- 'pppoe', 'dhcp', 'static_ip', 'hotspot'

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
        -- 'pending', 'active', 'suspended', 'terminated', 'on_hold'
    suspension_reason VARCHAR(255),

    -- Service address (installation location)
    service_address_line1 VARCHAR(255),
    service_address_line2 VARCHAR(255),
    service_address_city VARCHAR(100),
    service_address_state VARCHAR(100),
    service_address_postal_code VARCHAR(20),
    service_address_country VARCHAR(100),
    service_location_lat NUMERIC(10,8),
    service_location_lng NUMERIC(11,8),

    -- Installation
    installation_status VARCHAR(50),
        -- 'not_scheduled', 'scheduled', 'in_progress', 'completed', 'failed'
    installation_date DATE,
    installed_by VARCHAR(255),
        -- User ID of field tech
    installation_notes TEXT,

    -- Network details
    bandwidth_profile_id UUID REFERENCES bandwidth_profiles(id),
    static_ip_address INET,
    vlan_id INTEGER,

    -- RADIUS credentials
    pppoe_username VARCHAR(64),
    pppoe_password VARCHAR(64),
    mac_address VARCHAR(17),

    -- Usage tracking
    monthly_data_usage_gb NUMERIC(12,2) DEFAULT 0,
    last_usage_reset_date DATE,

    -- Service dates
    service_activated_at TIMESTAMPTZ,
    service_suspended_at TIMESTAMPTZ,
    service_terminated_at TIMESTAMPTZ,

    -- Billing
    billing_subscription_id VARCHAR(255),
        -- Link to billing module
    billing_cycle_day INTEGER DEFAULT 1,
        -- Day of month for billing

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_subscribers_tenant ON subscribers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_subscribers_status ON subscribers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_subscribers_number ON subscribers(subscriber_number);
CREATE INDEX idx_subscribers_customer ON subscribers(customer_id);
CREATE INDEX idx_subscribers_location ON subscribers USING GIST (
    point(service_location_lng, service_location_lat)
);
```

### `ip_pools` - IP Address Pools
```sql
CREATE TABLE ip_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Pool details
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Network
    network_cidr CIDR NOT NULL,
        -- e.g., '10.100.0.0/16'
    gateway INET,
    dns_primary INET,
    dns_secondary INET,

    -- Range
    start_ip INET NOT NULL,
    end_ip INET NOT NULL,

    -- Usage
    total_ips INTEGER NOT NULL,
    allocated_ips INTEGER DEFAULT 0,
    available_ips INTEGER NOT NULL,

    -- Type
    pool_type VARCHAR(50) DEFAULT 'dynamic',
        -- 'dynamic', 'static', 'reserved'

    -- VLAN
    vlan_id INTEGER,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_ip_pools_tenant ON ip_pools(tenant_id) WHERE deleted_at IS NULL;
```

### `ip_allocations` - IP Address Assignments
```sql
CREATE TABLE ip_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ip_pool_id UUID NOT NULL REFERENCES ip_pools(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES subscribers(id) ON DELETE SET NULL,

    -- Allocation
    ip_address INET NOT NULL,
    mac_address VARCHAR(17),

    -- Status
    status VARCHAR(50) DEFAULT 'allocated',
        -- 'allocated', 'active', 'reserved', 'released'

    -- Lease (for DHCP)
    lease_start TIMESTAMPTZ,
    lease_end TIMESTAMPTZ,

    -- Audit
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    created_by VARCHAR(255),

    UNIQUE(tenant_id, ip_address)
);

CREATE INDEX idx_ip_allocations_tenant ON ip_allocations(tenant_id);
CREATE INDEX idx_ip_allocations_pool ON ip_allocations(ip_pool_id);
CREATE INDEX idx_ip_allocations_subscriber ON ip_allocations(subscriber_id);
CREATE INDEX idx_ip_allocations_ip ON ip_allocations(ip_address);
```

### `devices` - Network Devices
```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Device identification
    name VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) NOT NULL,
        -- 'olt', 'router', 'switch', 'wireless_ap', 'tower', 'cpe', 'onu'
    vendor VARCHAR(100),
        -- 'Huawei', 'ZTE', 'Nokia', 'Mikrotik', 'Cisco', 'Ubiquiti', 'Cambium'
    model VARCHAR(100),
    serial_number VARCHAR(100),

    -- Network
    primary_ip INET,
    management_ip INET,
    mac_address VARCHAR(17),

    -- Location
    site_name VARCHAR(100),
    location_address TEXT,
    location_lat NUMERIC(10,8),
    location_lng NUMERIC(11,8),
    rack_location VARCHAR(50),

    -- Status
    status VARCHAR(50) DEFAULT 'active',
        -- 'active', 'inactive', 'maintenance', 'failed'
    operational_status VARCHAR(50),
        -- 'online', 'offline', 'degraded'

    -- Management credentials (reference to vault)
    credentials_vault_path VARCHAR(255),

    -- SNMP
    snmp_community VARCHAR(100),
    snmp_version VARCHAR(10) DEFAULT 'v2c',
        -- 'v1', 'v2c', 'v3'

    -- External system references
    netbox_id INTEGER,
        -- ID in NetBox
    voltha_id VARCHAR(255),
        -- ID in VOLTHA (for OLTs)

    -- Capacity
    port_count INTEGER,
    ports_used INTEGER DEFAULT 0,

    -- Metadata
    firmware_version VARCHAR(100),
    hardware_version VARCHAR(100),
    notes TEXT,
    config_backup_path VARCHAR(500),
    last_config_backup TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_devices_tenant ON devices(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_type ON devices(device_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_location ON devices USING GIST (
    point(location_lng, location_lat)
) WHERE deleted_at IS NULL;
```

### `vpn_tunnels` - VPN Connections
```sql
CREATE TABLE vpn_tunnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
        -- OLT or router using the tunnel

    -- Tunnel details
    tunnel_name VARCHAR(100) NOT NULL,
    tunnel_type VARCHAR(50) DEFAULT 'wireguard',
        -- 'wireguard', 'ipsec', 'openvpn'

    -- WireGuard specific
    public_key TEXT,
    private_key_vault_path VARCHAR(255),
        -- Path in vault (never store in DB!)

    -- Network
    vpn_ip INET NOT NULL,
        -- IP assigned to peer
    vpn_network CIDR,
        -- Allowed IPs

    -- Endpoint
    server_endpoint VARCHAR(255),
        -- 'vpn.example.com:51820'
    peer_endpoint VARCHAR(255),
        -- Last known peer endpoint

    -- Status
    status VARCHAR(50) DEFAULT 'configured',
        -- 'configured', 'active', 'disconnected', 'error'
    last_handshake TIMESTAMPTZ,

    -- Statistics
    data_rx_bytes BIGINT DEFAULT 0,
    data_tx_bytes BIGINT DEFAULT 0,

    -- Configuration
    config_generated_at TIMESTAMPTZ,
    config_downloaded_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, vpn_ip)
);

CREATE INDEX idx_vpn_tunnels_tenant ON vpn_tunnels(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vpn_tunnels_device ON vpn_tunnels(device_id);
CREATE INDEX idx_vpn_tunnels_status ON vpn_tunnels(status);
```

---

## FTTH Tables (New)

### `olts` - Optical Line Terminals
```sql
CREATE TABLE olts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- OLT specific details
    olt_type VARCHAR(50),
        -- 'gpon', 'xgspon', 'epon', 'xgepon'
    max_pon_ports INTEGER,
    active_pon_ports INTEGER DEFAULT 0,

    -- VOLTHA
    voltha_device_id VARCHAR(255),
    voltha_parent_id VARCHAR(255),

    -- Capacity
    total_onu_capacity INTEGER,
        -- Max ONUs supported
    active_onus INTEGER DEFAULT 0,

    -- Management
    management_protocol VARCHAR(50),
        -- 'snmp', 'ssh', 'telnet', 'netconf', 'voltha'

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_olts_tenant ON olts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_olts_device ON olts(device_id);
```

### `onus` - Optical Network Units
```sql
CREATE TABLE onus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    olt_id UUID NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES subscribers(id) ON DELETE SET NULL,

    -- ONU identification
    serial_number VARCHAR(100) NOT NULL,
    vendor VARCHAR(100),
    model VARCHAR(100),

    -- PON details
    pon_port INTEGER NOT NULL,
        -- PON port on OLT (0-15 typically)
    onu_id INTEGER NOT NULL,
        -- ONU ID on PON port (0-127 typically)

    -- Status
    status VARCHAR(50) DEFAULT 'discovered',
        -- 'discovered', 'provisioned', 'active', 'offline', 'failed'
    admin_status VARCHAR(50) DEFAULT 'disabled',
        -- 'enabled', 'disabled'
    operational_status VARCHAR(50),
        -- 'up', 'down', 'degraded'

    -- Optical metrics
    rx_power_dbm NUMERIC(6,2),
        -- Received optical power
    tx_power_dbm NUMERIC(6,2),
        -- Transmitted optical power
    distance_meters INTEGER,
        -- Distance from OLT

    -- Service
    service_profile VARCHAR(100),
    vlan_id INTEGER,

    -- TR-069 (if ONU supports it)
    acs_url VARCHAR(255),
        -- GenieACS URL
    acs_username VARCHAR(100),
    acs_password_vault_path VARCHAR(255),

    -- CPE details (if integrated router)
    wifi_ssid VARCHAR(64),
    wifi_password_vault_path VARCHAR(255),
    lan_ip INET,

    -- External references
    voltha_device_id VARCHAR(255),
    genieacs_device_id VARCHAR(255),

    -- Metrics
    last_seen TIMESTAMPTZ,
    uptime_seconds BIGINT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, serial_number),
    UNIQUE(olt_id, pon_port, onu_id)
);

CREATE INDEX idx_onus_tenant ON onus(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_onus_olt ON onus(olt_id);
CREATE INDEX idx_onus_subscriber ON onus(subscriber_id);
CREATE INDEX idx_onus_status ON onus(status);
CREATE INDEX idx_onus_serial ON onus(serial_number);
```

### `splitters` - Fiber Splitters
```sql
CREATE TABLE splitters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    olt_id UUID REFERENCES olts(id) ON DELETE SET NULL,

    -- Splitter details
    name VARCHAR(100) NOT NULL,
    split_ratio VARCHAR(20) NOT NULL,
        -- '1x2', '1x4', '1x8', '1x16', '1x32', '1x64'
    splitter_type VARCHAR(50) DEFAULT 'plc',
        -- 'plc' (Planar Lightwave Circuit), 'fbt' (Fused Biconical Taper)

    -- Location
    location_name VARCHAR(100),
    location_address TEXT,
    location_lat NUMERIC(10,8),
    location_lng NUMERIC(11,8),
    installation_type VARCHAR(50),
        -- 'pole_mount', 'underground', 'indoor', 'nap', 'fdh'

    -- Capacity
    input_ports INTEGER DEFAULT 1,
    output_ports INTEGER NOT NULL,
    ports_used INTEGER DEFAULT 0,

    -- Upstream connection
    parent_splitter_id UUID REFERENCES splitters(id) ON DELETE SET NULL,
    parent_output_port INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'active',
        -- 'active', 'inactive', 'maintenance'

    -- Metadata
    installation_date DATE,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_splitters_tenant ON splitters(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_splitters_olt ON splitters(olt_id);
CREATE INDEX idx_splitters_location ON splitters USING GIST (
    point(location_lng, location_lat)
) WHERE deleted_at IS NULL;
```

### `fiber_cables` - Fiber Cable Infrastructure
```sql
CREATE TABLE fiber_cables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Cable details
    cable_name VARCHAR(100) NOT NULL,
    cable_type VARCHAR(50),
        -- 'single_mode', 'multi_mode', 'armored', 'aerial', 'underground'
    fiber_count INTEGER NOT NULL,
        -- Number of fiber strands

    -- Endpoints
    start_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    start_device_port VARCHAR(50),
    start_location_name VARCHAR(100),
    start_location_lat NUMERIC(10,8),
    start_location_lng NUMERIC(11,8),

    end_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    end_device_port VARCHAR(50),
    end_location_name VARCHAR(100),
    end_location_lat NUMERIC(10,8),
    end_location_lng NUMERIC(11,8),

    -- Physical characteristics
    length_meters NUMERIC(10,2),
    color_code VARCHAR(50),
    installation_method VARCHAR(50),
        -- 'aerial', 'underground', 'duct', 'direct_burial'

    -- Path (for mapping)
    geojson_path JSONB,
        -- GeoJSON LineString of cable route

    -- Status
    status VARCHAR(50) DEFAULT 'active',
        -- 'active', 'inactive', 'damaged', 'maintenance'

    -- Metadata
    installation_date DATE,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, cable_name)
);

CREATE INDEX idx_fiber_cables_tenant ON fiber_cables(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fiber_cables_start_device ON fiber_cables(start_device_id);
CREATE INDEX idx_fiber_cables_end_device ON fiber_cables(end_device_id);
```

---

## Wireless Tables (New)

### `wireless_towers` - Tower Sites
```sql
CREATE TABLE wireless_towers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tower details
    name VARCHAR(100) NOT NULL,
    tower_type VARCHAR(50),
        -- 'monopole', 'guyed', 'lattice', 'rooftop', 'water_tower'
    height_meters NUMERIC(6,2),

    -- Location
    site_address TEXT,
    latitude NUMERIC(10,8) NOT NULL,
    longitude NUMERIC(11,8) NOT NULL,
    elevation_meters NUMERIC(8,2),

    -- Access
    access_notes TEXT,
    site_contact_name VARCHAR(100),
    site_contact_phone VARCHAR(50),

    -- Power
    power_type VARCHAR(50),
        -- 'grid', 'solar', 'generator', 'battery_backup'
    has_backup_power BOOLEAN DEFAULT FALSE,

    -- Status
    status VARCHAR(50) DEFAULT 'active',
        -- 'active', 'inactive', 'planned', 'under_construction'

    -- Metadata
    construction_date DATE,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_wireless_towers_tenant ON wireless_towers(tenant_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wireless_towers_location ON wireless_towers USING GIST (
    point(longitude, latitude)
) WHERE deleted_at IS NULL;
```

### `wireless_sectors` - Tower Sectors/Antennas
```sql
CREATE TABLE wireless_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tower_id UUID NOT NULL REFERENCES wireless_towers(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
        -- Access point device

    -- Sector details
    name VARCHAR(100) NOT NULL,
    sector_number INTEGER,
        -- 1, 2, 3, etc.

    -- Radio configuration
    frequency_mhz INTEGER NOT NULL,
        -- e.g., 2400, 5800
    channel_width_mhz INTEGER,
        -- 20, 40, 80, 160
    channel_number INTEGER,

    -- Antenna
    antenna_model VARCHAR(100),
    antenna_gain_dbi NUMERIC(5,2),
    azimuth INTEGER NOT NULL,
        -- 0-360 degrees (compass direction)
    beamwidth_degrees INTEGER NOT NULL,
        -- Horizontal beamwidth (e.g., 90)
    downtilt_degrees INTEGER DEFAULT 0,
        -- Vertical tilt

    -- Coverage
    max_range_km NUMERIC(6,2),
        -- Maximum coverage radius
    coverage_area_geojson JSONB,
        -- GeoJSON Polygon of coverage area

    -- Capacity
    max_capacity_mbps INTEGER,
    max_subscribers INTEGER,
    current_subscribers INTEGER DEFAULT 0,

    -- Power
    tx_power_dbm INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'active',
        -- 'active', 'inactive', 'maintenance'
    operational_status VARCHAR(50),
        -- 'online', 'offline', 'degraded'

    -- Metadata
    installation_date DATE,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, tower_id, name)
);

CREATE INDEX idx_wireless_sectors_tenant ON wireless_sectors(tenant_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wireless_sectors_tower ON wireless_sectors(tower_id);
CREATE INDEX idx_wireless_sectors_device ON wireless_sectors(device_id);
```

### `wireless_subscribers` - Wireless Customer Radios
```sql
CREATE TABLE wireless_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    sector_id UUID NOT NULL REFERENCES wireless_sectors(id) ON DELETE CASCADE,

    -- CPE details
    cpe_mac VARCHAR(17) NOT NULL,
    cpe_model VARCHAR(100),
    cpe_ip INET,

    -- Installation
    install_latitude NUMERIC(10,8) NOT NULL,
    install_longitude NUMERIC(11,8) NOT NULL,
    install_elevation_meters NUMERIC(8,2),
    install_address TEXT,

    -- Signal quality
    signal_strength_dbm INTEGER,
    signal_quality_percent INTEGER,
    noise_floor_dbm INTEGER,
    snr_db INTEGER,
        -- Signal-to-Noise Ratio

    -- Link details
    distance_km NUMERIC(6,3),
    link_speed_mbps INTEGER,
    frequency_mhz INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'active',
        -- 'active', 'inactive', 'offline'
    last_seen TIMESTAMPTZ,

    -- Metadata
    installation_date DATE,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    UNIQUE(tenant_id, cpe_mac)
);

CREATE INDEX idx_wireless_subscribers_tenant ON wireless_subscribers(tenant_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wireless_subscribers_subscriber ON wireless_subscribers(subscriber_id);
CREATE INDEX idx_wireless_subscribers_sector ON wireless_subscribers(sector_id);
CREATE INDEX idx_wireless_subscribers_location ON wireless_subscribers USING GIST (
    point(install_longitude, install_latitude)
) WHERE deleted_at IS NULL;
```

---

## Service Lifecycle Tables (New)

### `service_activations` - Service Activation Records
```sql
CREATE TABLE service_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,

    -- Activation details
    activation_type VARCHAR(50) NOT NULL,
        -- 'new_service', 'reactivation', 'plan_change', 'relocation'

    -- Workflow
    workflow_id UUID,
        -- Reference to workflow execution
    workflow_status VARCHAR(50) DEFAULT 'pending',
        -- 'pending', 'in_progress', 'completed', 'failed', 'rolled_back'

    -- Steps completed
    steps_completed JSONB DEFAULT '[]'::JSONB,
        -- ["radius_provisioned", "onu_activated", "billing_started"]
    current_step VARCHAR(100),

    -- Timing
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Service details
    bandwidth_profile_id UUID REFERENCES bandwidth_profiles(id),
    billing_plan_id VARCHAR(255),

    -- Error handling
    error_message TEXT,
    error_step VARCHAR(100),
    retry_count INTEGER DEFAULT 0,

    -- Requester
    requested_by VARCHAR(255),
        -- User ID who initiated

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_activations_tenant ON service_activations(tenant_id);
CREATE INDEX idx_service_activations_subscriber ON service_activations(subscriber_id);
CREATE INDEX idx_service_activations_status ON service_activations(workflow_status);
CREATE INDEX idx_service_activations_date ON service_activations(requested_at);
```

### `ansible_jobs` - Automation Job History
```sql
CREATE TABLE ansible_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Job details
    job_name VARCHAR(100) NOT NULL,
    playbook_name VARCHAR(255) NOT NULL,
    job_type VARCHAR(50),
        -- 'provisioning', 'backup', 'firmware_update', 'configuration'

    -- Target
    target_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    inventory JSONB,
        -- Ansible inventory

    -- Execution
    status VARCHAR(50) DEFAULT 'pending',
        -- 'pending', 'running', 'success', 'failed', 'cancelled'
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Results
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    ansible_facts JSONB,
    changed_tasks INTEGER,
    failed_tasks INTEGER,

    -- AWX reference
    awx_job_id INTEGER,

    -- Requester
    triggered_by VARCHAR(255),
        -- User ID or 'system'
    trigger_source VARCHAR(50),
        -- 'manual', 'scheduled', 'workflow', 'api'

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ansible_jobs_tenant ON ansible_jobs(tenant_id);
CREATE INDEX idx_ansible_jobs_device ON ansible_jobs(target_device_id);
CREATE INDEX idx_ansible_jobs_status ON ansible_jobs(status);
CREATE INDEX idx_ansible_jobs_date ON ansible_jobs(started_at);
```

---

## Entity Relationship Diagrams

### Core Relationships

```
tenants (1) ─────┬───── (*) users
                 ├───── (*) subscribers
                 ├───── (*) devices
                 ├───── (*) olts
                 ├───── (*) wireless_towers
                 ├───── (*) ip_pools
                 ├───── (*) bandwidth_profiles
                 └───── (*) radcheck/radreply/radacct

subscribers (1) ─┬───── (0..1) customers (existing)
                 ├───── (0..1) bandwidth_profiles
                 ├───── (0..1) onus
                 ├───── (0..*) wireless_subscribers
                 ├───── (0..*) radacct
                 └───── (0..*) service_activations

devices (1) ─────┬───── (0..1) olts
                 ├───── (0..1) vpn_tunnels
                 ├───── (0..*) wireless_sectors
                 └───── (0..*) ansible_jobs

olts (1) ────────┴───── (*) onus

wireless_towers (1) ───── (*) wireless_sectors

wireless_sectors (1) ──── (*) wireless_subscribers

ip_pools (1) ───────────── (*) ip_allocations
```

### RADIUS Authentication Flow
```
subscriber.pppoe_username
    │
    ▼
radcheck (username + password)
    │
    ▼
radreply (bandwidth profile attributes)
    │
    ▼
radacct (session tracking + usage)
    │
    ▼
billing module (usage-based billing)
```

---

## Indexes & Performance

### Critical Indexes

All tables include:
- Primary key index (automatic)
- `tenant_id` index (multi-tenant queries)
- Soft delete filter: `WHERE deleted_at IS NULL`

**High-traffic tables:**

#### radacct (millions of rows)
```sql
-- Partition by month
CREATE TABLE radacct_YYYY_MM PARTITION OF radacct
    FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01');

-- Indexes on each partition
CREATE INDEX idx_radacct_YYYY_MM_username ON radacct_YYYY_MM(username);
CREATE INDEX idx_radacct_YYYY_MM_tenant ON radacct_YYYY_MM(tenant_id);
CREATE INDEX idx_radacct_YYYY_MM_active ON radacct_YYYY_MM(username, nasipaddress)
    WHERE acctstoptime IS NULL;
```

#### Geographic queries (GIST indexes)
```sql
-- Devices
CREATE INDEX idx_devices_location ON devices USING GIST (
    point(location_lng, location_lat)
) WHERE deleted_at IS NULL;

-- Towers
CREATE INDEX idx_wireless_towers_location ON wireless_towers USING GIST (
    point(longitude, latitude)
) WHERE deleted_at IS NULL;
```

### Query Optimization

**Composite indexes for common queries:**
```sql
-- Subscriber lookup by number
CREATE INDEX idx_subscribers_tenant_number ON subscribers(tenant_id, subscriber_number)
    WHERE deleted_at IS NULL;

-- Active sessions
CREATE INDEX idx_radacct_active_sessions ON radacct(tenant_id, acctsessionid)
    WHERE acctstoptime IS NULL;

-- Device by type and status
CREATE INDEX idx_devices_type_status ON devices(tenant_id, device_type, status)
    WHERE deleted_at IS NULL;
```

---

## Migrations

### Migration Strategy

**Tools:**
- Alembic (Python ORM migration tool)
- Versioned migrations in `alembic/versions/`

**Migration Process:**
```bash
# Create new migration
alembic revision -m "Add RADIUS tables"

# Run migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Initial Migrations (Order Matters!)

**Phase 1: Core Extensions**
1. `001_extend_tenants_table.py` - Add ISP-specific columns to tenants
2. `002_create_subscribers_table.py` - Create subscribers table
3. `003_create_bandwidth_profiles.py` - Create bandwidth profiles

**Phase 2: RADIUS**
4. `004_create_radius_tables.py` - radcheck, radreply, radacct, nas
5. `005_partition_radacct.py` - Create monthly partitions for radacct

**Phase 3: Network Management**
6. `006_create_ip_pools.py` - IP pools and allocations
7. `007_create_devices.py` - Network devices table
8. `008_create_vpn_tunnels.py` - VPN tunnels

**Phase 4: FTTH**
9. `009_create_olts.py` - OLTs table
10. `010_create_onus.py` - ONUs table
11. `011_create_splitters.py` - Splitters table
12. `012_create_fiber_cables.py` - Fiber infrastructure

**Phase 5: Wireless**
13. `013_create_wireless_towers.py` - Towers table
14. `014_create_wireless_sectors.py` - Sectors table
15. `015_create_wireless_subscribers.py` - Wireless CPE

**Phase 6: Automation**
16. `016_create_service_activations.py` - Activation tracking
17. `017_create_ansible_jobs.py` - Automation jobs

### Example Migration

**alembic/versions/004_create_radius_tables.py:**
```python
"""Create RADIUS tables

Revision ID: 004
Revises: 003
Create Date: 2025-10-14

"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'

def upgrade():
    # radcheck
    op.create_table(
        'radcheck',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False),
        sa.Column('subscriber_id', sa.String(255)),
        sa.Column('username', sa.String(64), nullable=False),
        sa.Column('attribute', sa.String(64), nullable=False),
        sa.Column('op', sa.String(2), nullable=False, server_default=':='),
        sa.Column('value', sa.String(253), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subscriber_id'], ['subscribers.id'], ondelete='CASCADE')
    )

    op.create_index('idx_radcheck_username', 'radcheck', ['username'])
    op.create_index('idx_radcheck_tenant', 'radcheck', ['tenant_id'])
    op.create_index('idx_radcheck_subscriber', 'radcheck', ['subscriber_id'])
    op.create_unique_constraint(
        'uq_radcheck_tenant_username_attr',
        'radcheck',
        ['tenant_id', 'username', 'attribute']
    )

    # radreply
    # ... (similar structure)

    # radacct
    # ... (with partitioning)

    # nas
    # ... (NAS table)

def downgrade():
    op.drop_table('radcheck')
    op.drop_table('radreply')
    op.drop_table('radacct')
    op.drop_table('nas')
```

---

## Data Seeding

### Seed Data for Development

**scripts/seed_data.py:**
```python
"""Seed database with test data for development"""

async def seed_data():
    # Create test tenant
    tenant = Tenant(
        id='tenant_test_001',
        name='Test ISP',
        slug='test-isp',
        status=TenantStatus.ACTIVE,
        max_subscribers=1000,
        max_olts=5
    )

    # Create bandwidth profiles
    profiles = [
        BandwidthProfile(
            tenant_id=tenant.id,
            name='10M',
            download_mbps=10,
            upload_mbps=10
        ),
        BandwidthProfile(
            tenant_id=tenant.id,
            name='50M',
            download_mbps=50,
            upload_mbps=50
        ),
        # ...
    ]

    # Create test subscribers
    subscribers = [
        Subscriber(
            tenant_id=tenant.id,
            subscriber_number='SUB-000001',
            service_type='ftth',
            status='active',
            pppoe_username='test001',
            pppoe_password='test123',
            bandwidth_profile_id=profiles[0].id
        ),
        # ...
    ]

    # Create RADIUS credentials
    for sub in subscribers:
        radcheck = RadCheck(
            tenant_id=tenant.id,
            subscriber_id=sub.id,
            username=sub.pppoe_username,
            attribute='Cleartext-Password',
            value=sub.pppoe_password
        )
        # ...
```

---

## Related Documents

- [Architecture Overview](ISP_PLATFORM_ARCHITECTURE.md)
- [API Specifications](API_SPECIFICATIONS.md)
- [Infrastructure Setup](INFRASTRUCTURE_SETUP.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-14 | Data Team | Initial database schema design |

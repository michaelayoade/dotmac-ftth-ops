# Platform Architecture Review

## Current Issue

The platform backend is registering **65 total routers** (12 platform + 53 tenant), including many ISP-specific operations that should only be in tenant/ISP instances.

## Deployment Modes

- **Current**: `multi_tenant` (default) - mounts BOTH platform and tenant apps
- **Platform Backend**: Should use `hybrid` mode with `ENABLE_PLATFORM_ROUTES=true`
- **ISP Backend**: Should use `single_tenant` or `hybrid` with `ENABLE_PLATFORM_ROUTES=false`

## Routers That Should NOT Be in Platform App

### 1. RADIUS (Line 2025-11-23 11:48:05)
- `✅ RADIUS AAA and session management` - **REMOVE**
- RADIUS is ISP-tenant specific (each ISP has their own RADIUS config)
- Should ONLY be in tenant/ISP app

### 2. Customer Operations
- `✅ Customer relationship management` - **REMOVE**
- `✅ Customer self-service portal` - **REMOVE**
- `✅ Contact management` - **REMOVE**
- Customers belong to specific ISPs, not the platform

### 3. Billing Operations
- All billing routers (invoices, payments, subscriptions, etc.) - **REMOVE**
- Each tenant has their own billing

### 4. Network Infrastructure
- `✅ OLT and PON access network management` - **REMOVE**
- `✅ Network inventory and IPAM` - **REMOVE**
- `✅ CPE management (TR-069)` - **REMOVE**
- `✅ PON/Fiber network management` - **REMOVE**
- `✅ Wireless infrastructure management` - **REMOVE**
- `✅ WireGuard VPN management` - **REMOVE**
- Each ISP manages their own network

### 5. Service Operations
- `✅ Subscriber provisioning workflows` - **REMOVE**
- `✅ Service provisioning and lifecycle` - **REMOVE**
- `✅ Internet service plan management` - **REMOVE**
- Services/subscribers belong to ISPs

### 6. Support Operations
- `✅ Support ticketing` - **REMOVE**
- Each ISP has their own support tickets

### 7. Other Tenant-Specific
- `✅ Lead management and sales` - **REMOVE**
- `✅ Sales order management` - **REMOVE**
- `✅ Workflow orchestration and automation` - **REMOVE**
- `✅ Network diagnostics tools` - **REMOVE**
- `✅ Alarm and SLA monitoring` - **REMOVE**

## Routers That SHOULD Be in Platform App

### Platform Control Plane (Currently Correct)
1. ✅ Cross-tenant platform administration
2. ✅ Tenant provisioning and lifecycle management
3. ✅ Automated tenant onboarding workflows
4. ✅ Custom domain verification for tenants
5. ✅ SaaS licensing and activation management
6. ✅ Composable licensing with dynamic plan builder
7. ✅ Platform-wide settings and configuration
8. ✅ Platform-wide observability and traces
9. ✅ Platform-wide log aggregation
10. ✅ Platform-wide audit trail
11. ✅ Platform-wide analytics and insights (cross-tenant)
12. ✅ Multi-tenant deployment orchestration

### Additional Platform-Level
- Partner relationship management (if partners can have multiple tenants)
- Cross-tenant analytics and reporting
- Platform health monitoring
- Tenant usage/billing (for platform operator)

## Recommended Configuration

### Platform Backend (.env or docker-compose)
```bash
DEPLOYMENT_MODE=hybrid
ENABLE_PLATFORM_ROUTES=true
ENVIRONMENT=production
```

### ISP Backend (.env or docker-compose)
```bash
DEPLOYMENT_MODE=single_tenant  # or hybrid with ENABLE_PLATFORM_ROUTES=false
ENVIRONMENT=development  # or production
```

## Current Status

- **Platform Backend**: Running at http://localhost:8001
  - Currently: multi_tenant mode (both apps mounted)
  - Should be: hybrid mode with platform routes only

- **ISP Backend**: Running at http://localhost:8000
  - Currently: multi_tenant mode (both apps mounted)
  - Should be: single_tenant mode (tenant app only)

## API Endpoint Structure

### After Fix:
- Platform: `http://localhost:8001/api/platform/v1/*`
- ISP Tenant: `http://localhost:8000/api/v1/*` (single_tenant) or `/api/tenant/v1/*` (hybrid)

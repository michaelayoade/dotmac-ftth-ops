# ISP/Telecom SaaS Licensing Model V2

**Subscription-Tier & Feature-Group Based Licensing**

---

## Business Model

### Current (Generic Software Licensing) ❌
- License per device/seat/CPU
- Activation codes for desktop software
- Offline activation for air-gapped environments
- **Not suitable for multi-tenant SaaS ISP platform**

### New (ISP/Telecom SaaS Licensing) ✅
- **Subscription tiers** (Starter, Professional, Business, Enterprise, Custom)
- **Feature groups** per tier (Billing, CRM, RADIUS, Analytics, OSS integrations)
- **Resource quotas** per tenant (users, customers, API calls, storage)
- **Add-on features** for customization
- **Usage-based billing** for overages

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    Subscription Plan                            │
│                                                                 │
│  Plan: "Professional"                                           │
│  Tier: PROFESSIONAL                                             │
│  Price: $299/month or $2,999/year                              │
│  Trial: 14 days                                                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Included Features (PlanFeature)                          │  │
│  │                                                            │  │
│  │  ✓ BILLING_BASIC (Invoicing, payments)                   │  │
│  │  ✓ CRM (Customer management)                              │  │
│  │  ✓ RADIUS (AAA authentication)                            │  │
│  │  ✓ NETWORK_MONITORING (Real-time monitoring)              │  │
│  │  ✓ ANALYTICS_BASIC (Dashboards, reports)                  │  │
│  │  ✓ EMAIL (Email notifications)                            │  │
│  │  ✓ API_ACCESS (REST API)                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Resource Quotas (PlanQuota)                              │  │
│  │                                                            │  │
│  │  • USERS: 25 staff users                                  │  │
│  │  • CUSTOMERS: 5,000 subscribers                           │  │
│  │  • API_CALLS: 100,000 calls/month                         │  │
│  │  • STORAGE_GB: 100 GB                                     │  │
│  │  • INVOICES: Unlimited (-1)                               │  │
│  │  • TICKETS: 500 tickets/month                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                   Tenant Subscription                           │
│                                                                 │
│  Tenant: "acme-isp" (tenant_id)                                │
│  Plan: "Professional"                                           │
│  Status: ACTIVE                                                 │
│  Billing Cycle: ANNUALLY                                        │
│  Current Period: 2025-01-01 to 2026-01-01                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Add-On Features (TenantFeatureOverride)                  │  │
│  │                                                            │  │
│  │  + WIRELESS (Add-on: $99/month)                           │  │
│  │  + ANALYTICS_ADVANCED (Promotion: Free for 3 months)      │  │
│  │  + WHITE_LABEL (Custom negotiated)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Current Usage (TenantQuotaUsage)                         │  │
│  │                                                            │  │
│  │  • USERS: 18 / 25 (72% utilization)                       │  │
│  │  • CUSTOMERS: 3,247 / 5,000 (65% utilization)             │  │
│  │  • API_CALLS: 87,324 / 100,000 (87% utilization) ⚠️       │  │
│  │  • STORAGE_GB: 112 / 100 (112% - overage!) 🔴            │  │
│  │    → Overage: 12 GB × $0.50/GB = $6.00                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### 1. `subscription_plans` - Plan Definitions

```sql
CREATE TABLE subscription_plans (
    id VARCHAR(36) PRIMARY KEY,
    plan_name VARCHAR(100) UNIQUE NOT NULL,     -- "Professional Plan"
    plan_code VARCHAR(50) UNIQUE NOT NULL,      -- "PROFESSIONAL"
    tier VARCHAR(20) NOT NULL,                  -- STARTER, PROFESSIONAL, BUSINESS, ENTERPRISE
    description TEXT,

    -- Pricing
    monthly_price NUMERIC(15,2) NOT NULL,       -- $299.00
    annual_price NUMERIC(15,2),                 -- $2,999.00 (16% discount)
    setup_fee NUMERIC(15,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Trial
    trial_days INTEGER DEFAULT 14,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT TRUE,             -- Show on pricing page

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

**Example Plans:**

| Plan Name | Tier | Monthly | Annual | Users | Customers | Features |
|-----------|------|---------|--------|-------|-----------|----------|
| Starter | STARTER | $99 | $999 | 5 | 500 | Basic billing, CRM |
| Professional | PROFESSIONAL | $299 | $2,999 | 25 | 5,000 | + RADIUS, Monitoring |
| Business | BUSINESS | $799 | $7,999 | 100 | 25,000 | + Advanced analytics, OSS |
| Enterprise | ENTERPRISE | Custom | Custom | Unlimited | Unlimited | All features |

#### 2. `plan_features` - Features per Plan

```sql
CREATE TABLE plan_features (
    id VARCHAR(36) PRIMARY KEY,
    plan_id VARCHAR(36) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    feature_code VARCHAR(100) NOT NULL,         -- "radius_aaa", "wireless_management"
    feature_category VARCHAR(50) NOT NULL,      -- RADIUS, WIRELESS, BILLING_ADVANCED
    enabled BOOLEAN DEFAULT TRUE,

    -- Feature configuration (JSON)
    config JSONB DEFAULT '{}',                  -- { "max_nas_devices": 50 }

    created_at TIMESTAMP WITH TIME ZONE NOT NULL,

    UNIQUE (plan_id, feature_code)
);
```

**Example Feature Categories:**

```python
# Core Platform (always included)
CORE = "CORE"

# Billing & Finance
BILLING_BASIC = "BILLING_BASIC"           # Basic invoicing
BILLING_ADVANCED = "BILLING_ADVANCED"     # Recurring, usage-based, proration
PAYMENTS = "PAYMENTS"                     # Payment processing integrations
REVENUE_SHARING = "REVENUE_SHARING"       # Partner revenue management

# Customer Management
CRM = "CRM"                               # Customer relationship management
CUSTOMER_PORTAL = "CUSTOMER_PORTAL"       # Self-service portal

# Network Management
RADIUS = "RADIUS"                         # RADIUS AAA
NETWORK_MONITORING = "NETWORK_MONITORING" # Real-time monitoring
FIBER_MANAGEMENT = "FIBER_MANAGEMENT"     # Fiber infrastructure management
WIRELESS = "WIRELESS"                     # Wireless infrastructure

# OSS Integrations
NETBOX = "NETBOX"                         # NetBox IPAM/DCIM
GENIEACS = "GENIEACS"                     # GenieACS CPE management
VOLTHA = "VOLTHA"                         # VOLTHA OLT management
WIREGUARD = "WIREGUARD"                   # WireGuard VPN management

# Service Management
ORCHESTRATION = "ORCHESTRATION"           # Service orchestration workflows
PROVISIONING = "PROVISIONING"             # Auto-provisioning
SCHEDULER = "SCHEDULER"                   # Task scheduling

# Analytics & Reporting
ANALYTICS_BASIC = "ANALYTICS_BASIC"       # Basic dashboards
ANALYTICS_ADVANCED = "ANALYTICS_ADVANCED" # Advanced analytics, custom reports
USAGE_BILLING = "USAGE_BILLING"           # Usage-based billing

# Communications
EMAIL = "EMAIL"                           # Email notifications
SMS = "SMS"                               # SMS notifications
WEBHOOKS = "WEBHOOKS"                     # Webhook integrations

# Advanced Features
AUTOMATION = "AUTOMATION"                 # Workflow automation
API_ACCESS = "API_ACCESS"                 # REST API access
GRAPHQL = "GRAPHQL"                       # GraphQL API access
WHITE_LABEL = "WHITE_LABEL"               # White-label branding
MULTI_CURRENCY = "MULTI_CURRENCY"         # Multi-currency support
```

#### 3. `plan_quotas` - Resource Limits per Plan

```sql
CREATE TABLE plan_quotas (
    id VARCHAR(36) PRIMARY KEY,
    plan_id VARCHAR(36) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL,            -- USERS, CUSTOMERS, API_CALLS, etc.
    quota_limit INTEGER NOT NULL,               -- -1 = unlimited
    soft_limit INTEGER,                         -- Warning threshold (80% of limit)

    -- Overage billing
    overage_allowed BOOLEAN DEFAULT FALSE,
    overage_rate NUMERIC(15,4),                 -- $0.50 per GB storage overage

    created_at TIMESTAMP WITH TIME ZONE NOT NULL,

    UNIQUE (plan_id, quota_type)
);
```

**Quota Types:**

```python
USERS = "USERS"                 # Number of staff users
CUSTOMERS = "CUSTOMERS"         # Number of end customers/subscribers
API_CALLS = "API_CALLS"         # API calls per month
STORAGE_GB = "STORAGE_GB"       # Storage in GB
BANDWIDTH_TB = "BANDWIDTH_TB"   # Bandwidth in TB per month
TICKETS = "TICKETS"             # Support tickets per month
INVOICES = "INVOICES"           # Invoices generated per month
SESSIONS = "SESSIONS"           # Concurrent RADIUS sessions
```

#### 4. `tenant_subscriptions` - Active Tenant Subscription

```sql
CREATE TABLE tenant_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) UNIQUE NOT NULL,      -- One subscription per tenant
    plan_id VARCHAR(36) REFERENCES subscription_plans(id),

    -- Status
    status VARCHAR(20) NOT NULL,                -- TRIAL, ACTIVE, PAST_DUE, SUSPENDED, etc.
    billing_cycle VARCHAR(20) NOT NULL,         -- MONTHLY, ANNUALLY

    -- Trial period
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,

    -- Current billing period
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Cancellation
    cancelled_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,

    -- Billing
    auto_renew BOOLEAN DEFAULT TRUE,
    billing_email VARCHAR(255),
    payment_method_id VARCHAR(100),

    -- Payment provider integration
    stripe_subscription_id VARCHAR(100),
    paypal_subscription_id VARCHAR(100),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

**Subscription Statuses:**

```python
TRIAL = "TRIAL"               # In trial period
ACTIVE = "ACTIVE"             # Active paid subscription
PAST_DUE = "PAST_DUE"        # Payment failed but still active (grace period)
SUSPENDED = "SUSPENDED"       # Suspended due to non-payment
CANCELLED = "CANCELLED"       # Cancelled by customer
EXPIRED = "EXPIRED"          # Trial or subscription expired
```

#### 5. `tenant_feature_overrides` - Custom Features per Tenant

```sql
CREATE TABLE tenant_feature_overrides (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
    feature_code VARCHAR(100) NOT NULL,
    feature_category VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,

    -- Override type
    override_type VARCHAR(20) NOT NULL,         -- ADD_ON, CUSTOM, TRIAL, PROMOTION

    -- Pricing (if add-on)
    monthly_fee NUMERIC(15,2),                  -- $99/month for wireless add-on

    -- Expiry (for trials/promotions)
    expires_at TIMESTAMP WITH TIME ZONE,        -- Free advanced analytics for 3 months

    -- Configuration
    config JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL,

    UNIQUE (subscription_id, feature_code)
);
```

**Use Cases:**

1. **Add-Ons:**
   ```json
   {
       "feature_code": "wireless_management",
       "override_type": "ADD_ON",
       "monthly_fee": 99.00,
       "enabled": true
   }
   ```

2. **Promotional Features:**
   ```json
   {
       "feature_code": "analytics_advanced",
       "override_type": "PROMOTION",
       "enabled": true,
       "expires_at": "2025-04-01T00:00:00Z"
   }
   ```

3. **Custom Negotiated:**
   ```json
   {
       "feature_code": "white_label",
       "override_type": "CUSTOM",
       "enabled": true,
       "config": {
           "custom_domain": "manage.acme-isp.com",
           "logo_url": "https://..."
       }
   }
   ```

#### 6. `tenant_quota_usage` - Current Resource Usage

```sql
CREATE TABLE tenant_quota_usage (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL,
    current_usage INTEGER DEFAULT 0,
    quota_limit INTEGER NOT NULL,               -- -1 = unlimited

    -- Period (for monthly quotas)
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Overage tracking
    overage_count INTEGER DEFAULT 0,            -- 12 GB over limit
    overage_charges NUMERIC(15,2) DEFAULT 0.00, -- $6.00

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,

    UNIQUE (subscription_id, quota_type)
);
```

**Quota Usage Example:**

```json
{
    "quota_type": "API_CALLS",
    "current_usage": 87324,
    "quota_limit": 100000,
    "period_start": "2025-01-01T00:00:00Z",
    "period_end": "2025-02-01T00:00:00Z",
    "overage_count": 0,
    "overage_charges": 0.00
}
```

#### 7. `feature_usage_logs` - Feature Usage Analytics

```sql
CREATE TABLE feature_usage_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    feature_code VARCHAR(100) NOT NULL,
    feature_category VARCHAR(50) NOT NULL,
    user_id VARCHAR(36),

    -- Usage details
    action VARCHAR(50) NOT NULL,                -- VIEW, CREATE, UPDATE, DELETE
    resource_type VARCHAR(100),                 -- customer, invoice, ticket
    resource_id VARCHAR(100),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX ix_feature_usage_tenant_feature ON feature_usage_logs(tenant_id, feature_code);
CREATE INDEX ix_feature_usage_tenant_date ON feature_usage_logs(tenant_id, created_at);
```

**Use Cases:**
- Analytics: Which features are most used?
- Upsell: Identify tenants using trial features heavily
- Compliance: Audit feature access

#### 8. `subscription_events` - Audit Trail

```sql
CREATE TABLE subscription_events (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) REFERENCES tenant_subscriptions(id),
    event_type VARCHAR(50) NOT NULL,

    -- State changes
    previous_plan_id VARCHAR(36),
    new_plan_id VARCHAR(36),
    previous_status VARCHAR(20),
    new_status VARCHAR(20),

    -- Actor
    user_id VARCHAR(36),
    ip_address VARCHAR(50),

    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

**Event Types:**
- `CREATED` - Subscription created (trial start)
- `UPGRADED` - Plan upgraded
- `DOWNGRADED` - Plan downgraded
- `RENEWED` - Subscription renewed
- `CANCELLED` - Subscription cancelled
- `SUSPENDED` - Suspended for non-payment
- `REACTIVATED` - Reactivated after suspension
- `EXPIRED` - Trial/subscription expired

---

## Feature Entitlement Enforcement

### Middleware Approach

```python
# src/dotmac/platform/licensing/enforcement.py

from functools import wraps
from typing import Callable

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

from .models_v2 import FeatureCategory
from .service_v2 import SubscriptionService


class FeatureEntitlementMiddleware(BaseHTTPMiddleware):
    """Enforce feature entitlements based on subscription."""

    async def dispatch(self, request: Request, call_next):
        # Skip for public endpoints
        if request.url.path in ["/api/v1/auth/login", "/api/v1/platform/config"]:
            return await call_next(request)

        # Get tenant from request state (set by auth middleware)
        tenant_id = getattr(request.state, "tenant_id", None)

        if not tenant_id:
            return await call_next(request)

        # Map endpoint to required feature
        required_feature = get_required_feature(request.url.path, request.method)

        if not required_feature:
            # No specific feature required
            return await call_next(request)

        # Check entitlement
        service = SubscriptionService(tenant_id)
        has_feature = await service.has_feature(required_feature)

        if not has_feature:
            raise HTTPException(
                status_code=403,
                detail=f"Feature '{required_feature}' not available in your subscription plan. "
                       f"Please upgrade to access this feature.",
            )

        return await call_next(request)


def get_required_feature(path: str, method: str) -> FeatureCategory | None:
    """Map API endpoint to required feature category."""

    # RADIUS endpoints
    if path.startswith("/api/v1/radius"):
        return FeatureCategory.RADIUS

    # Wireless management
    if path.startswith("/api/v1/wireless"):
        return FeatureCategory.WIRELESS

    # Advanced analytics
    if path.startswith("/api/v1/analytics/advanced"):
        return FeatureCategory.ANALYTICS_ADVANCED

    # Billing endpoints
    if path.startswith("/api/v1/billing"):
        if method in ["POST", "PUT", "DELETE"]:
            return FeatureCategory.BILLING_ADVANCED  # Creating/editing requires advanced
        return FeatureCategory.BILLING_BASIC

    # NetBox integration
    if path.startswith("/api/v1/netbox"):
        return FeatureCategory.NETBOX

    # GenieACS integration
    if path.startswith("/api/v1/genieacs"):
        return FeatureCategory.GENIEACS

    # VOLTHA integration
    if path.startswith("/api/v1/voltha"):
        return FeatureCategory.VOLTHA

    # Orchestration
    if path.startswith("/api/v1/orchestration"):
        return FeatureCategory.ORCHESTRATION

    # GraphQL API
    if path.startswith("/api/v1/graphql"):
        return FeatureCategory.GRAPHQL

    # White-label endpoints
    if path.startswith("/api/v1/tenant/branding"):
        return FeatureCategory.WHITE_LABEL

    # Default: no specific feature required
    return None
```

### Decorator Approach (More Granular)

```python
from functools import wraps

def require_feature(feature: FeatureCategory):
    """Decorator to enforce feature entitlement on specific endpoints."""

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get tenant from current user
            current_user = get_current_user()  # From dependency injection
            tenant_id = current_user.tenant_id

            # Check feature entitlement
            service = SubscriptionService(tenant_id)
            has_feature = await service.has_feature(feature)

            if not has_feature:
                plan = await service.get_current_plan()
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "feature_not_entitled",
                        "message": f"Your '{plan.plan_name}' plan does not include '{feature.value}'",
                        "upgrade_url": "/pricing",
                        "required_tier": get_minimum_tier_for_feature(feature),
                    },
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# Usage in routers:

@router.get("/api/v1/wireless/access-points")
@require_feature(FeatureCategory.WIRELESS)
async def get_wireless_access_points():
    """Get wireless access points (requires WIRELESS feature)."""
    # Only executed if tenant has WIRELESS feature
    pass


@router.post("/api/v1/analytics/advanced/custom-report")
@require_feature(FeatureCategory.ANALYTICS_ADVANCED)
async def generate_custom_report(data: CustomReportRequest):
    """Generate custom analytics report (requires ANALYTICS_ADVANCED feature)."""
    pass
```

### Quota Enforcement

```python
async def check_quota(tenant_id: str, quota_type: QuotaType, increment: int = 1) -> None:
    """Check and enforce quota limits."""

    service = SubscriptionService(tenant_id)
    usage = await service.get_quota_usage(quota_type)

    # Check if at limit
    if usage.quota_limit != -1 and usage.current_usage >= usage.quota_limit:
        # Check if overage allowed
        if not usage.overage_allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "quota_exceeded",
                    "quota_type": quota_type.value,
                    "current_usage": usage.current_usage,
                    "quota_limit": usage.quota_limit,
                    "message": f"You've reached your {quota_type.value} limit. Upgrade your plan for more capacity.",
                    "upgrade_url": "/pricing",
                },
            )

        # Calculate overage charges
        overage_charge = increment * usage.overage_rate
        usage.overage_count += increment
        usage.overage_charges += overage_charge

    # Increment usage
    usage.current_usage += increment
    await service.save_quota_usage(usage)


# Usage in endpoints:

@router.post("/api/v1/users")
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    # Check user quota
    await check_quota(current_user.tenant_id, QuotaType.USERS, increment=1)

    # Create user
    new_user = await create_user_service(user_data)
    return new_user


@router.post("/api/v1/customers")
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    # Check customer quota
    await check_quota(current_user.tenant_id, QuotaType.CUSTOMERS, increment=1)

    # Create customer
    new_customer = await create_customer_service(customer_data)
    return new_customer
```

---

## Integration with Settings

### Dynamic Feature Flags from Subscription

```python
# src/dotmac/platform/licensing/integration.py

from ..settings import Settings
from .service_v2 import SubscriptionService


async def get_tenant_feature_flags(tenant_id: str) -> dict[str, bool]:
    """Get feature flags from tenant's subscription."""

    service = SubscriptionService(tenant_id)
    subscription = await service.get_subscription(tenant_id)

    if not subscription:
        # Return default free tier features
        return get_default_features()

    # Get plan features
    plan_features = await service.get_plan_features(subscription.plan_id)

    # Get tenant-specific overrides (add-ons)
    overrides = await service.get_tenant_feature_overrides(subscription.id)

    # Combine
    all_features = {}

    for feature in plan_features:
        all_features[feature.feature_code] = feature.enabled

    for override in overrides:
        # Check if expired
        if override.expires_at and override.expires_at < datetime.now(UTC):
            continue
        all_features[override.feature_code] = override.enabled

    return all_features


# Update platform config endpoint to include entitlements

@router.get("/config")
async def get_platform_config(
    settings: Settings,
    current_user: User = Depends(get_current_user),
):
    """Get platform config with tenant-specific entitlements."""

    # Get tenant feature flags from subscription
    entitlements = await get_tenant_feature_flags(current_user.tenant_id)

    return {
        "app": {...},
        "features": {
            # Core features from settings
            **settings.features.model_dump(),
            # Tenant-specific entitlements from subscription
            **entitlements,
        },
        "subscription": {
            "plan": subscription.plan.plan_name,
            "tier": subscription.plan.tier,
            "status": subscription.status,
            "trial_end": subscription.trial_end if subscription.status == "TRIAL" else None,
            "current_period_end": subscription.current_period_end,
        },
        "quotas": await get_tenant_quotas(current_user.tenant_id),
    }
```

---

## Billing Integration

### Subscription Creation Flow

```python
@router.post("/api/v1/subscriptions/create")
async def create_subscription(
    plan_code: str,
    billing_cycle: BillingCycle,
    payment_method_id: str,
    current_user: User = Depends(get_current_user),
):
    """Create new subscription for tenant."""

    # Get plan
    plan = await get_plan_by_code(plan_code)

    # Calculate price
    if billing_cycle == BillingCycle.MONTHLY:
        amount = plan.monthly_price
    elif billing_cycle == BillingCycle.ANNUALLY:
        amount = plan.annual_price or (plan.monthly_price * 12)

    # Create Stripe subscription
    stripe_subscription = stripe.Subscription.create(
        customer=current_user.stripe_customer_id,
        items=[{"price": plan.stripe_price_id}],
        payment_behavior="default_incomplete",
        expand=["latest_invoice.payment_intent"],
    )

    # Create tenant subscription
    subscription = TenantSubscription(
        tenant_id=current_user.tenant_id,
        plan_id=plan.id,
        status=SubscriptionStatus.TRIAL if plan.trial_days > 0 else SubscriptionStatus.ACTIVE,
        billing_cycle=billing_cycle,
        trial_start=datetime.now(UTC),
        trial_end=datetime.now(UTC) + timedelta(days=plan.trial_days),
        current_period_start=datetime.now(UTC),
        current_period_end=datetime.now(UTC) + timedelta(days=30 if billing_cycle == BillingCycle.MONTHLY else 365),
        stripe_subscription_id=stripe_subscription.id,
    )

    db.add(subscription)
    db.commit()

    # Initialize quotas
    await initialize_tenant_quotas(subscription)

    return subscription
```

### Webhook Handlers

```python
@router.post("/webhooks/stripe")
async def handle_stripe_webhook(request: Request):
    """Handle Stripe subscription webhooks."""

    event = stripe.Event.construct_from(await request.json(), stripe.api_key)

    if event.type == "customer.subscription.created":
        # Subscription activated
        await activate_subscription(event.data.object.id)

    elif event.type == "customer.subscription.updated":
        # Subscription changed (upgrade/downgrade)
        await update_subscription(event.data.object.id)

    elif event.type == "invoice.payment_succeeded":
        # Payment succeeded, renew subscription
        await renew_subscription(event.data.object.subscription)

    elif event.type == "invoice.payment_failed":
        # Payment failed, mark as past due
        await mark_subscription_past_due(event.data.object.subscription)

    elif event.type == "customer.subscription.deleted":
        # Subscription cancelled
        await cancel_subscription(event.data.object.id)

    return {"status": "success"}
```

---

## Migration from Old Model

### Data Migration Script

```python
# scripts/migrate_to_subscription_model.py

async def migrate_licenses_to_subscriptions():
    """Migrate from old device-based licenses to subscription model."""

    # 1. Create default plans if not exist
    await create_default_plans()

    # 2. For each tenant with old licenses
    tenants = await get_tenants_with_licenses()

    for tenant in tenants:
        # Determine appropriate plan based on current licenses
        plan = determine_plan_from_licenses(tenant.licenses)

        # Create subscription
        subscription = TenantSubscription(
            tenant_id=tenant.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            billing_cycle=BillingCycle.MONTHLY,
            current_period_start=datetime.now(UTC),
            current_period_end=datetime.now(UTC) + timedelta(days=30),
        )

        db.add(subscription)

        # Migrate custom features from old licenses
        for license in tenant.licenses:
            for feature in license.features:
                override = TenantFeatureOverride(
                    subscription_id=subscription.id,
                    feature_code=feature.feature_id,
                    feature_category=map_old_feature_to_category(feature),
                    enabled=True,
                    override_type="CUSTOM",
                )
                db.add(override)

    db.commit()


async def create_default_plans():
    """Create default subscription plans."""

    plans = [
        {
            "plan_name": "Starter",
            "plan_code": "STARTER",
            "tier": SubscriptionTier.STARTER,
            "monthly_price": 99.00,
            "annual_price": 999.00,
            "trial_days": 14,
            "features": [
                FeatureCategory.BILLING_BASIC,
                FeatureCategory.CRM,
                FeatureCategory.EMAIL,
                FeatureCategory.API_ACCESS,
            ],
            "quotas": {
                QuotaType.USERS: 5,
                QuotaType.CUSTOMERS: 500,
                QuotaType.API_CALLS: 10000,
                QuotaType.STORAGE_GB: 10,
            },
        },
        # ... other plans
    ]

    for plan_data in plans:
        plan = SubscriptionPlan(**plan_data)
        db.add(plan)

        # Add features
        for feature_cat in plan_data["features"]:
            plan_feature = PlanFeature(
                plan_id=plan.id,
                feature_code=feature_cat.value.lower(),
                feature_category=feature_cat,
                enabled=True,
            )
            db.add(plan_feature)

        # Add quotas
        for quota_type, limit in plan_data["quotas"].items():
            plan_quota = PlanQuota(
                plan_id=plan.id,
                quota_type=quota_type,
                quota_limit=limit,
            )
            db.add(plan_quota)

    db.commit()
```

---

## Next Steps

1. **Create Migration:** Alembic migration for new subscription tables
2. **Seed Data:** Create default subscription plans (Starter, Professional, Business, Enterprise)
3. **Service Layer:** Implement `SubscriptionService` with entitlement checks
4. **Middleware:** Add `FeatureEntitlementMiddleware` to app
5. **API Endpoints:** Subscription management endpoints (upgrade, downgrade, add-ons)
6. **Frontend:** Pricing page, subscription dashboard, usage metrics
7. **Billing Integration:** Stripe/PayPal webhook handlers
8. **Testing:** Integration tests for feature enforcement

---

## Summary

✅ **Old Model:** Generic software licensing (device/seat based)
✅ **New Model:** SaaS subscription tiers with feature groups and quotas

**Key Differences:**

| Aspect | Old Model | New Model |
|--------|-----------|-----------|
| **License Unit** | Per device/seat/CPU | Per tenant subscription |
| **Features** | Individual feature flags | Feature groups/categories |
| **Activation** | Device activation codes | Subscription status |
| **Billing** | One-time or per-device | Monthly/annual subscription |
| **Quotas** | None | Users, customers, API calls, storage |
| **Customization** | N/A | Add-ons, custom overrides |
| **Enforcement** | Activation limits | Feature + quota enforcement |

**This model is perfect for B2B ISP/Telecom SaaS!**

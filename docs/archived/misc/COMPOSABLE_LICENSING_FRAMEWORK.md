# Composable Licensing Framework

## Overview

The Composable Licensing Framework is a flexible, building-block-based system for creating dynamic service plans for ISP/Telecom SaaS platforms. Unlike traditional rigid subscription tiers (Starter, Professional, Enterprise), this framework allows you to:

- **Build custom plans** from reusable feature modules and quotas
- **Create one-off plans** for enterprise customers
- **Mix and match** features without predefined bundles
- **Add promotional features** with expiration dates
- **Support trial periods** with limited features
- **Enable add-ons** that can be added to any plan
- **Track usage** and bill for overages
- **Implement volume-based pricing** with tiered quotas

## Architecture

### Core Building Blocks

```
┌──────────────────────────────────────────────────────────┐
│                    Service Plan                           │
│  (Dynamically composed from modules + quotas)            │
└───────────────┬──────────────────────────────────────────┘
                │
     ┌──────────┴──────────┐
     │                     │
     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│ Feature Modules │   │ Quota Definitions│
│                 │   │                  │
│ - RADIUS AAA    │   │ - Staff Users    │
│ - Wireless Mgmt │   │ - Subscribers    │
│ - Analytics     │   │ - API Calls      │
│ - Billing       │   │ - Storage        │
└─────────────────┘   └─────────────────┘
```

### Database Schema

#### 1. Feature Modules (Building Blocks)

Reusable feature components that can be added to any plan:

```python
class FeatureModule(BaseModel):
    id: UUID
    module_code: str  # "radius_aaa", "wireless_management"
    module_name: str  # "RADIUS AAA", "Wireless Management"
    category: ModuleCategory  # NETWORK, OSS_INTEGRATION, BILLING, etc.
    description: str
    dependencies: list[str]  # Required modules
    pricing_model: PricingModel  # FLAT_FEE, PER_UNIT, TIERED, USAGE_BASED
    base_price: float
    config_schema: dict  # JSON Schema for validation
    default_config: dict
    is_active: bool
```

#### 2. Module Capabilities

Granular capabilities within modules (API endpoints, UI routes):

```python
class ModuleCapability(BaseModel):
    id: UUID
    module_id: UUID
    capability_code: str  # "radius_authentication", "nas_management"
    capability_name: str
    api_endpoints: list[str]  # ["/api/v1/radius/auth", ...]
    ui_routes: list[str]  # ["/dashboard/radius", ...]
    permissions: list[str]  # ["radius:read", "radius:write"]
    config: dict
    is_active: bool
```

#### 3. Quota Definitions (Building Blocks)

Reusable quota types with custom metrics:

```python
class QuotaDefinition(BaseModel):
    id: UUID
    quota_code: str  # "staff_users", "subscribers", "api_calls"
    quota_name: str
    unit_name: str  # "users", "GB", "calls"
    pricing_model: PricingModel
    overage_rate: float  # Charge per unit over quota
    is_metered: bool  # Track usage for billing
    reset_period: str  # MONTHLY, QUARTERLY, ANNUAL, null=never
    config: dict
    is_active: bool
```

#### 4. Service Plans (Composed Dynamically)

Plans built from modules and quotas:

```python
class ServicePlan(BaseModel):
    id: UUID
    plan_name: str
    plan_code: str
    version: int
    is_template: bool  # Reusable template vs one-off custom
    is_public: bool  # Show on pricing page
    is_custom: bool  # Custom negotiated plan
    base_price_monthly: float
    annual_discount_percent: float
    trial_days: int
    trial_modules: list[str]  # Modules available during trial
    metadata: dict
    is_active: bool
```

#### 5. Plan Module Inclusions

Modules included in a plan with customization:

```python
class PlanModule(BaseModel):
    id: UUID
    plan_id: UUID
    module_id: UUID
    included_by_default: bool
    is_optional_addon: bool  # Can be added later
    override_price: float  # Custom pricing for this plan
    trial_only: bool  # Only during trial
    promotional_until: datetime  # Free until date
    config: dict
```

#### 6. Plan Quota Allocations

Quota limits for a plan:

```python
class PlanQuotaAllocation(BaseModel):
    id: UUID
    plan_id: UUID
    quota_id: UUID
    included_quantity: int  # -1 = unlimited
    soft_limit: int  # Warning threshold
    allow_overage: bool
    overage_rate_override: float
    pricing_tiers: list[dict]  # Volume-based pricing
    # Example: [{"from": 0, "to": 1000, "price": 0}, {"from": 1001, "to": 5000, "price": 0.01}]
    config: dict
```

#### 7. Tenant Subscriptions

Active subscriptions per tenant:

```python
class TenantSubscription(BaseModel):
    id: UUID
    tenant_id: UUID
    plan_id: UUID
    status: SubscriptionStatus  # TRIAL, ACTIVE, PAST_DUE, etc.
    billing_cycle: BillingCycle  # MONTHLY, ANNUAL
    monthly_price: float  # Snapshot at subscription time
    annual_price: float
    trial_start/end: datetime
    current_period_start/end: datetime
    stripe_subscription_id: str
    custom_config: dict
```

## Usage Examples

### Example 1: Creating Feature Modules

```python
from dotmac.platform.licensing.service_framework import LicensingFrameworkService

service = LicensingFrameworkService(db)

# Create RADIUS AAA module
radius_module = await service.create_feature_module(
    module_code="radius_aaa",
    module_name="RADIUS AAA",
    category=ModuleCategory.NETWORK,
    description="RADIUS authentication, authorization, and accounting",
    dependencies=[],
    pricing_model=PricingModel.FLAT_FEE,
    base_price=99.00,
    config_schema={
        "type": "object",
        "properties": {
            "nas_count": {"type": "integer", "minimum": 1},
            "redundancy": {"type": "boolean"}
        }
    },
    default_config={"nas_count": 5, "redundancy": False}
)

# Add capabilities
await service.add_module_capability(
    module_id=radius_module.id,
    capability_code="radius_authentication",
    capability_name="RADIUS Authentication",
    description="Authenticate users via RADIUS protocol",
    api_endpoints=["/api/v1/radius/auth", "/api/v1/radius/users"],
    ui_routes=["/dashboard/radius", "/dashboard/radius/users"],
    permissions=["radius:read", "radius:write"],
    config={}
)
```

### Example 2: Creating Quota Definitions

```python
# Create staff users quota
staff_quota = await service.create_quota_definition(
    quota_code="staff_users",
    quota_name="Staff Users",
    description="Number of staff/admin users",
    unit_name="users",
    pricing_model=PricingModel.PER_UNIT,
    overage_rate=5.00,  # $5 per extra user
    is_metered=False,
    reset_period=None,  # Lifetime quota
    config={}
)

# Create API calls quota (metered)
api_quota = await service.create_quota_definition(
    quota_code="api_calls",
    quota_name="API Calls",
    description="Monthly API call limit",
    unit_name="calls",
    pricing_model=PricingModel.TIERED,
    overage_rate=0.001,  # $0.001 per call over quota
    is_metered=True,
    reset_period="MONTHLY",
    config={}
)
```

### Example 3: Building a Custom Plan

```python
# Create a custom plan for an enterprise customer
plan = await service.create_service_plan(
    plan_name="Acme Corp Custom Plan",
    plan_code="acme_corp_2025",
    description="Custom plan for Acme Corp with wireless + billing",
    base_price_monthly=500.00,
    annual_discount_percent=15.0,
    is_template=False,
    is_public=False,
    is_custom=True,
    trial_days=30,
    trial_modules=["radius_aaa"],
    module_configs=[
        {
            "module_id": radius_module.id,
            "included": True,
            "addon": False,
            "price": 80.00,  # Discounted from $99
            "trial_only": False,
            "config": {"nas_count": 10, "redundancy": True}
        },
        {
            "module_id": wireless_module.id,
            "included": True,
            "addon": False,
            "price": 150.00,
            "trial_only": False,
            "config": {}
        },
        {
            "module_id": analytics_module.id,
            "included": False,
            "addon": True,  # Optional add-on
            "price": 50.00,
            "trial_only": False,
            "config": {}
        }
    ],
    quota_configs=[
        {
            "quota_id": staff_quota.id,
            "quantity": 20,
            "soft_limit": 18,
            "allow_overage": True,
            "overage_rate": 4.00,  # Discounted overage
            "pricing_tiers": [],
            "config": {}
        },
        {
            "quota_id": subscribers_quota.id,
            "quantity": 10000,
            "soft_limit": 9500,
            "allow_overage": True,
            "overage_rate": None,  # Use default
            "pricing_tiers": [
                {"from": 0, "to": 5000, "price": 0},
                {"from": 5001, "to": 10000, "price": 0.05},
                {"from": 10001, "to": 50000, "price": 0.03}
            ],
            "config": {}
        },
        {
            "quota_id": api_quota.id,
            "quantity": 1000000,  # 1M calls/month
            "soft_limit": 900000,
            "allow_overage": True,
            "overage_rate": 0.0005,  # Half price overages
            "pricing_tiers": [],
            "config": {}
        }
    ],
    metadata={"customer_id": "acme_corp", "contract_expiry": "2026-12-31"}
)
```

### Example 4: Creating a Reusable Template

```python
# Create a template that can be reused
template = await service.create_service_plan(
    plan_name="SMB Standard",
    plan_code="smb_standard_v1",
    description="Standard plan for small-medium ISPs",
    base_price_monthly=199.00,
    annual_discount_percent=20.0,
    is_template=True,  # Reusable template
    is_public=True,  # Show on pricing page
    is_custom=False,
    trial_days=14,
    trial_modules=["radius_aaa", "billing_basic"],
    module_configs=[
        {
            "module_id": radius_module.id,
            "included": True,
            "addon": False,
            "price": None,  # Use base price
            "trial_only": False,
            "config": {}
        },
        {
            "module_id": billing_module.id,
            "included": True,
            "addon": False,
            "price": None,
            "trial_only": False,
            "config": {}
        }
    ],
    quota_configs=[
        {
            "quota_id": staff_quota.id,
            "quantity": 5,
            "soft_limit": 4,
            "allow_overage": True,
            "overage_rate": None,
            "pricing_tiers": [],
            "config": {}
        },
        {
            "quota_id": subscribers_quota.id,
            "quantity": 1000,
            "soft_limit": 900,
            "allow_overage": True,
            "overage_rate": None,
            "pricing_tiers": [],
            "config": {}
        }
    ],
    metadata={}
)

# Duplicate template for customization
custom_plan = await service.duplicate_plan_as_template(
    source_plan_id=template.id,
    new_plan_name="SMB Standard - Customer XYZ",
    new_plan_code="smb_standard_xyz"
)
```

### Example 5: Subscribing a Tenant

```python
# Subscribe tenant to a plan
subscription = await service.create_subscription(
    tenant_id=tenant.id,
    plan_id=plan.id,
    billing_cycle=BillingCycle.ANNUAL,
    start_trial=True,
    addon_module_ids=[analytics_module.id],  # Add analytics as add-on
    custom_config={"contract_number": "CTR-2025-001"},
    stripe_customer_id="cus_xxxxx",
    stripe_subscription_id="sub_xxxxx"
)
```

### Example 6: Feature Entitlement Enforcement

```python
# Check if tenant has access to a feature
from dotmac.platform.licensing.enforcement import require_module

@router.get("/radius/auth")
@require_module("radius_aaa", "radius_authentication")
async def authenticate(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_session)
):
    # Only executes if tenant has radius_aaa module with radius_authentication capability
    return {"message": "Authentication endpoint"}
```

Alternative using dependency injection:

```python
from dotmac.platform.licensing.enforcement import require_module_dependency

@router.get("/radius/auth")
async def authenticate(
    _: None = Depends(
        lambda t=Depends(get_current_tenant), db=Depends(get_session):
            require_module_dependency("radius_aaa", "radius_authentication", t, db)
    ),
    tenant: Tenant = Depends(get_current_tenant)
):
    return {"message": "Authentication endpoint"}
```

### Example 7: Quota Enforcement

```python
from dotmac.platform.licensing.enforcement import enforce_quota

@router.post("/users")
@enforce_quota("staff_users", quantity=1)
async def create_user(
    user_data: UserCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_session)
):
    # Quota is automatically checked and consumed before this executes
    # If quota exceeded and overage not allowed, raises 429 error
    user = await create_user_logic(user_data)
    return user
```

For soft enforcement with warnings:

```python
from dotmac.platform.licensing.enforcement import check_quota

@router.post("/customers")
@check_quota("active_subscribers", quantity=1)
async def create_customer(
    quota_available: bool,
    quota_info: dict,
    customer_data: CustomerCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_session)
):
    if not quota_available:
        if quota_info.get("overage_allowed"):
            # Warn about overage charges
            logger.warning(
                "Subscriber quota exceeded",
                overage_rate=quota_info["overage_rate"],
                current=quota_info["current"],
                allocated=quota_info["allocated"]
            )
        else:
            raise HTTPException(
                status_code=429,
                detail=f"Subscriber quota exceeded. Current: {quota_info['current']}, Limit: {quota_info['allocated']}"
            )

    customer = await create_customer_logic(customer_data)

    # Manually consume quota
    service = LicensingFrameworkService(db)
    await service.consume_quota(
        tenant_id=tenant.id,
        quota_code="active_subscribers",
        quantity=1,
        metadata={"customer_id": str(customer.id)}
    )

    return customer
```

### Example 8: Adding/Removing Add-ons

```python
# Tenant adds analytics add-on to their subscription
await service.add_addon_to_subscription(
    subscription_id=subscription.id,
    module_id=analytics_module.id,
    activated_by=user.id
)

# Tenant removes add-on
await service.remove_addon_from_subscription(
    subscription_id=subscription.id,
    module_id=analytics_module.id,
    deactivated_by=user.id
)
```

### Example 9: Checking Quotas Programmatically

```python
# Check quota before performing action
result = await service.check_quota(
    tenant_id=tenant.id,
    quota_code="api_calls",
    requested_quantity=100
)

if result["allowed"]:
    # Proceed with API calls
    await make_api_calls()

    # Consume quota
    await service.consume_quota(
        tenant_id=tenant.id,
        quota_code="api_calls",
        quantity=100,
        metadata={"endpoint": "bulk_import"}
    )
else:
    # Handle quota exceeded
    if result["overage_allowed"]:
        print(f"Overage will be charged at ${result['overage_rate']}/call")
    else:
        raise QuotaExceededError("Monthly API quota exceeded")
```

### Example 10: Context Manager for Quota

```python
from dotmac.platform.licensing.enforcement import QuotaContext

async def make_external_api_call(tenant_id: UUID, db: AsyncSession):
    async with QuotaContext(tenant_id, "api_calls", db, quantity=1):
        # Quota checked before entering, consumed after successful exit
        result = await external_api.call()
        return result
```

## API Endpoints

### Module Management (Platform Admin Only)

```
POST   /api/v1/licensing/modules                 - Create feature module
GET    /api/v1/licensing/modules                 - List modules
GET    /api/v1/licensing/modules/{id}            - Get module details
PATCH  /api/v1/licensing/modules/{id}            - Update module
POST   /api/v1/licensing/modules/{id}/capabilities - Add capability
```

### Quota Management (Platform Admin Only)

```
POST   /api/v1/licensing/quotas                  - Create quota definition
GET    /api/v1/licensing/quotas                  - List quotas
GET    /api/v1/licensing/quotas/{id}             - Get quota details
PATCH  /api/v1/licensing/quotas/{id}             - Update quota
```

### Plan Builder (Platform Admin Only)

```
POST   /api/v1/licensing/plans                   - Create service plan
GET    /api/v1/licensing/plans                   - List plans
GET    /api/v1/licensing/plans/{id}              - Get plan details
PATCH  /api/v1/licensing/plans/{id}              - Update plan
POST   /api/v1/licensing/plans/{id}/duplicate    - Duplicate as template
GET    /api/v1/licensing/plans/{id}/pricing      - Calculate pricing
```

### Subscription Management

```
POST   /api/v1/licensing/subscriptions           - Create subscription (admin)
GET    /api/v1/licensing/subscriptions/current   - Get current subscription
POST   /api/v1/licensing/subscriptions/current/addons    - Add add-on
DELETE /api/v1/licensing/subscriptions/current/addons    - Remove add-on
```

### Entitlement & Quota Checking

```
POST   /api/v1/licensing/entitlements/check      - Check feature entitlement
GET    /api/v1/licensing/entitlements/capabilities - Get entitled capabilities
POST   /api/v1/licensing/quotas/check            - Check quota availability
POST   /api/v1/licensing/quotas/consume          - Consume quota
POST   /api/v1/licensing/quotas/release          - Release quota
```

## Migration from Old System

If you have an existing licensing system with rigid tiers, here's how to migrate:

### Step 1: Define Feature Modules

Map your existing features to modules:

```python
# Old: Hardcoded tier with features
"Professional": {
    "features": ["RADIUS", "WIRELESS", "BILLING", "ANALYTICS"],
    "price": 299
}

# New: Separate modules
modules = [
    {"code": "radius_aaa", "price": 99},
    {"code": "wireless_management", "price": 150},
    {"code": "billing_basic", "price": 80},
    {"code": "analytics", "price": 70}
]
```

### Step 2: Define Quota Definitions

Map your limits to quotas:

```python
# Old: Hardcoded limits
"Professional": {
    "max_users": 20,
    "max_subscribers": 5000
}

# New: Quota definitions
quotas = [
    {"code": "staff_users", "overage_rate": 5.00},
    {"code": "active_subscribers", "overage_rate": 0.05}
]
```

### Step 3: Create Plan Templates

Convert tiers to templates:

```python
# Create template for each old tier
professional_template = await service.create_service_plan(
    plan_name="Professional",
    plan_code="professional_v2",
    is_template=True,
    is_public=True,
    module_configs=[...],  # All Professional modules
    quota_configs=[...],   # All Professional quotas
)
```

### Step 4: Migrate Existing Subscriptions

```python
# For each existing subscription
for old_sub in old_subscriptions:
    tier = old_sub.tier  # "Professional"
    template = tier_templates[tier]

    # Create new subscription from template
    new_sub = await service.create_subscription(
        tenant_id=old_sub.tenant_id,
        plan_id=template.id,
        billing_cycle=old_sub.billing_cycle,
        start_trial=False,
        addon_module_ids=[],
        custom_config={"migrated_from": old_sub.id}
    )
```

## Best Practices

### 1. Module Design

- **Keep modules focused**: Each module should represent a distinct feature area
- **Define clear dependencies**: If Module B requires Module A, declare it
- **Use config schemas**: Validate module configuration with JSON Schema
- **Version capabilities**: Track capability changes for backward compatibility

### 2. Quota Design

- **Choose appropriate reset periods**: Monthly for usage-based, none for perpetual limits
- **Set reasonable soft limits**: Warn at 90% of quota
- **Enable overage for flexibility**: Allow customers to exceed with charges
- **Use tiered pricing**: Reward high-volume customers

### 3. Plan Design

- **Start with templates**: Create reusable templates for common use cases
- **Customize for enterprise**: Clone templates and adjust for custom deals
- **Version your plans**: Increment version when making breaking changes
- **Track metadata**: Store contract details, expiry dates, custom terms

### 4. Enforcement

- **Use decorators for critical features**: Block access to unauthorized features
- **Implement soft checks for UX**: Warn before blocking on quota limits
- **Log usage for analytics**: Track which features are most used
- **Handle errors gracefully**: Return clear error messages with upgrade paths

## Troubleshooting

### Module dependencies not resolved

**Error**: `ModuleResolutionError: Dependency module 'xxx' not found`

**Solution**: Ensure all dependency modules are created before the dependent module:

```python
# Create base module first
base_module = await service.create_feature_module(module_code="base", ...)

# Then create dependent module
advanced_module = await service.create_feature_module(
    module_code="advanced",
    dependencies=["base"],  # Reference base module
    ...
)
```

### Quota exceeded errors

**Error**: `QuotaExceededError: Quota xxx exceeded`

**Solution**: Either increase quota allocation or enable overage:

```python
# Option 1: Increase quota in plan
plan_quota.included_quantity = 100

# Option 2: Enable overage
plan_quota.allow_overage = True
plan_quota.overage_rate_override = 0.10
```

### Feature not entitled

**Error**: `FeatureNotEntitledError: Feature not entitled: xxx`

**Solution**: Add the module to the subscription:

```python
# Add as included module in plan
await service.add_addon_to_subscription(
    subscription_id=subscription.id,
    module_id=module.id
)
```

## Performance Considerations

### Caching

Cache entitlement checks for frequently accessed endpoints:

```python
from functools import lru_cache

@lru_cache(maxsize=1000)
async def get_entitled_capabilities(tenant_id: UUID):
    service = LicensingFrameworkService(db)
    return await service.get_entitled_capabilities(tenant_id)
```

### Database Indexes

The migration creates indexes on:
- `tenant_id` for fast tenant lookups
- `status` for filtering active subscriptions
- `module_id` and `quota_id` for joins
- `logged_at` for time-based queries

### Query Optimization

Use `selectinload` to avoid N+1 queries:

```python
result = await db.execute(
    select(TenantSubscription)
    .options(
        selectinload(TenantSubscription.modules).selectinload(SubscriptionModule.module),
        selectinload(TenantSubscription.quotas)
    )
    .where(TenantSubscription.tenant_id == tenant_id)
)
```

## Security

### Authorization

- **Platform Admin**: Can create/edit modules, quotas, and plans
- **Tenant Admin**: Can view current subscription and manage add-ons
- **Tenant User**: Can view capabilities but not manage subscription

### Audit Trail

All subscription events are logged:

```python
class SubscriptionEvent(BaseModel):
    event_type: EventType  # SUBSCRIPTION_CREATED, ADDON_ADDED, etc.
    event_data: dict
    created_by: UUID
    created_at: datetime
```

### Rate Limiting

Enforce API quotas to prevent abuse:

```python
@router.get("/api/data")
@enforce_quota("api_calls", quantity=1)
async def get_data(...):
    return data
```

## Monitoring

### Metrics to Track

1. **Subscription Metrics**
   - Active subscriptions by plan
   - Trial conversion rate
   - Churn rate
   - MRR (Monthly Recurring Revenue)

2. **Module Metrics**
   - Most popular modules
   - Least used modules (candidates for deprecation)
   - Add-on attachment rate

3. **Quota Metrics**
   - Average usage per quota
   - Overage frequency
   - Quota limit increases over time

4. **Revenue Metrics**
   - Overage revenue
   - Add-on revenue
   - Upgrade revenue

### Example Analytics Query

```sql
-- Most popular add-ons
SELECT
    m.module_name,
    COUNT(*) as activation_count,
    SUM(sm.addon_price) as total_revenue
FROM licensing_subscription_modules sm
JOIN licensing_feature_modules m ON sm.module_id = m.id
WHERE sm.source = 'ADDON'
GROUP BY m.module_name
ORDER BY activation_count DESC;
```

## Next Steps

1. **Seed Initial Data**: Create your feature modules and quota definitions
2. **Build Plan Templates**: Define 3-5 reusable templates for common use cases
3. **Integrate with Billing**: Connect Stripe/PayPal webhooks for subscription events
4. **Add to Frontend**: Build UI for plan selection and add-on management
5. **Monitor Usage**: Set up analytics to track feature usage and revenue

## Support

For questions or issues:
- Check the API documentation at `/api/v1/docs`
- Review enforcement examples in `src/dotmac/platform/licensing/enforcement.py`
- See service layer code in `src/dotmac/platform/licensing/service_framework.py`

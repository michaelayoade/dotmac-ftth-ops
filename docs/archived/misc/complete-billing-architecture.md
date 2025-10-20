# Complete Billing System Architecture

## System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Product Catalog │    │  Subscriptions  │    │ Pricing Engine  │
│                 │    │                 │    │                 │
│ • Products      │    │ • Plans         │    │ • Simple Rules  │
│ • SKUs          │◄──►│ • Customer Subs │◄──►│ • Discounts     │
│ • Categories    │    │ • Renewals      │    │ • Customer Rates│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
         ┌─────────────────────────────────────────┐
         │         EXISTING SYSTEMS                │
         │                                         │
         │ • Invoice Service (your current system) │
         │ • Payment Processing (Stripe)           │
         │ • Tax Calculation (your tax system)     │
         │ • Customer Management                   │
         │ • Admin Settings System                 │
         └─────────────────────────────────────────┘
```

## Data Models & Database Schema

### 1. Product Catalog Tables

```sql
-- Products table (new)
CREATE TABLE billing_products (
    product_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    product_type VARCHAR(20) NOT NULL, -- one_time, subscription, usage_based, hybrid
    base_price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    tax_class VARCHAR(20) NOT NULL DEFAULT 'standard',
    usage_type VARCHAR(50), -- api_calls, storage_gb, users, etc.
    usage_unit_name VARCHAR(50), -- 'API Calls', 'GB Storage', etc.
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(tenant_id, sku)
);

-- Product categories (new) - simple flat structure
CREATE TABLE billing_product_categories (
    category_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_tax_class VARCHAR(20) DEFAULT 'standard',
    sort_order INTEGER DEFAULT 0,

    UNIQUE(tenant_id, name)
);
```

### 2. Subscription Tables

```sql
-- Subscription plans (new)
CREATE TABLE billing_subscription_plans (
    plan_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL REFERENCES billing_products(product_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    billing_cycle VARCHAR(20) NOT NULL, -- monthly, quarterly, annual
    price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    setup_fee DECIMAL(15,2),
    trial_days INTEGER,
    included_usage JSONB DEFAULT '{}', -- {"api_calls": 1000, "storage_gb": 10}
    overage_rates JSONB DEFAULT '{}',  -- {"api_calls": "0.01", "storage_gb": "0.10"}
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer subscriptions (new)
CREATE TABLE billing_subscriptions (
    subscription_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL, -- Links to your existing customers
    plan_id VARCHAR(50) NOT NULL REFERENCES billing_subscription_plans(plan_id),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL, -- trial, active, past_due, canceled, ended
    trial_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    custom_price DECIMAL(15,2), -- Customer-specific pricing override
    usage_records JSONB DEFAULT '{}', -- Current period usage tracking
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Subscription events (new) - audit trail
CREATE TABLE billing_subscription_events (
    event_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    subscription_id VARCHAR(50) NOT NULL REFERENCES billing_subscriptions(subscription_id),
    event_type VARCHAR(50) NOT NULL, -- created, renewed, canceled, etc.
    event_data JSONB DEFAULT '{}',
    user_id VARCHAR(50), -- Who triggered the event
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Pricing Rules Tables

```sql
-- Simple pricing rules (new)
CREATE TABLE billing_pricing_rules (
    rule_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,

    -- What does this rule apply to?
    applies_to_product_ids TEXT[], -- Array of product IDs
    applies_to_categories TEXT[],   -- Array of categories
    applies_to_all BOOLEAN DEFAULT FALSE,

    -- Simple conditions
    min_quantity INTEGER,
    customer_segments TEXT[], -- Array of customer types/segments

    -- Discount configuration
    discount_type VARCHAR(20) NOT NULL, -- percentage, fixed_amount, fixed_price
    discount_value DECIMAL(15,2) NOT NULL,

    -- Time constraints
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,

    -- Usage limits
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rule usage tracking (new)
CREATE TABLE billing_rule_usage (
    usage_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    rule_id VARCHAR(50) NOT NULL REFERENCES billing_pricing_rules(rule_id),
    customer_id VARCHAR(50) NOT NULL,
    invoice_id VARCHAR(50), -- Links to your existing invoices
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Integration with Existing Tables

```sql
-- Your existing invoice_lines table gets enhanced
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS product_id VARCHAR(50);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS pricing_rule_id VARCHAR(50);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(50);

-- Your existing invoices table gets enhanced
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(50);

-- Add billing settings to your existing settings system
-- (This integrates with your admin settings we built earlier)
```

## Service Layer Architecture

### 1. Product Management Service

```python
class ProductService:
    """Simple CRUD for products with business logic."""

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def create_product(self, data: ProductCreateRequest, tenant_id: str) -> Product:
        """Create product with SKU uniqueness validation."""
        # Validate SKU uniqueness within tenant
        # Create product with auto-generated ID
        # Return created product

    async def get_catalog(self, tenant_id: str, filters: ProductFilters) -> List[Product]:
        """Get filtered product catalog."""
        # Filter by category, product_type, active status
        # Return paginated results

    async def update_price(self, product_id: str, new_price: Decimal, tenant_id: str) -> Product:
        """Update product price (no versioning - simple update)."""
        # Validate product exists and belongs to tenant
        # Update price directly
        # Log price change in audit trail

    async def get_usage_products(self, tenant_id: str) -> List[Product]:
        """Get products configured for usage-based billing."""
        # Filter products where product_type IN ('usage_based', 'hybrid')
        # Return with usage configuration
```

### 2. Subscription Management Service

```python
class SubscriptionService:
    """Complete subscription lifecycle management."""

    def __init__(self, db: DatabaseManager, invoice_service: InvoiceService):
        self.db = db
        self.invoice_service = invoice_service  # Your existing service

    async def create_subscription(
        self,
        customer_id: str,
        plan_id: str,
        options: SubscriptionOptions,
        tenant_id: str
    ) -> Subscription:
        """Create new subscription with trial handling."""
        # Validate plan exists and is active
        # Calculate billing periods
        # Handle trial period if configured
        # Create subscription record
        # Generate setup fee invoice if applicable
        # Return subscription

    async def process_renewals(self, tenant_id: str) -> List[RenewalResult]:
        """Background job - process all due renewals."""
        # Find subscriptions where current_period_end <= NOW()
        # For each subscription:
        #   - Calculate usage charges (if hybrid plan)
        #   - Create renewal invoice via your existing invoice service
        #   - Update subscription period
        #   - Handle payment processing
        # Return results for monitoring

    async def change_plan(
        self,
        subscription_id: str,
        new_plan_id: str,
        tenant_id: str
    ) -> PlanChangeResult:
        """Handle plan changes with simple proration."""
        # Get current subscription and plans
        # Calculate simple proration (daily rate * remaining days)
        # Create proration invoice/credit
        # Update subscription plan
        # Log plan change event
        # Return change details

    async def cancel_subscription(
        self,
        subscription_id: str,
        immediate: bool,
        tenant_id: str
    ) -> Subscription:
        """Cancel subscription (immediate or at period end)."""
        # Update cancellation flags
        # If immediate: end subscription now, create prorated credit
        # If at period end: set cancel_at_period_end flag
        # Log cancellation event
        # Return updated subscription
```

### 3. Pricing Engine Service

```python
class PricingEngine:
    """Simple pricing calculations with rule application."""

    def __init__(self, db: DatabaseManager):
        self.db = db
        self.cache = {}  # Simple in-memory cache for pricing rules

    async def calculate_line_price(
        self,
        product_id: str,
        quantity: int,
        customer_id: str,
        tenant_id: str
    ) -> PriceCalculation:
        """Calculate final price for invoice line item."""
        # Get product base price
        # Get customer information for segmentation
        # Find applicable pricing rules (simple filtering)
        # Apply first matching rule (no conflict resolution)
        # Return price breakdown

    async def calculate_subscription_price(
        self,
        plan_id: str,
        customer_id: str,
        custom_price: Optional[Decimal],
        tenant_id: str
    ) -> PriceCalculation:
        """Calculate subscription pricing with customer overrides."""
        # Get plan base price
        # Apply customer-specific pricing if set
        # Apply any subscription-specific pricing rules
        # Return final subscription price

    async def calculate_usage_charges(
        self,
        subscription_id: str,
        usage_records: Dict[str, int],
        tenant_id: str
    ) -> List[UsageCharge]:
        """Calculate overage charges for hybrid plans."""
        # Get subscription plan with included usage and overage rates
        # For each usage type:
        #   - Calculate overage (actual - included)
        #   - Apply overage rate
        # Return list of usage charges for invoice
```

### 4. Integration Service (The Glue)

```python
class BillingIntegrationService:
    """Connects new billing system to existing invoice/payment systems."""

    def __init__(
        self,
        product_service: ProductService,
        subscription_service: SubscriptionService,
        pricing_engine: PricingEngine,
        invoice_service: InvoiceService,  # Your existing service
        payment_service: PaymentService   # Your existing service
    ):
        self.products = product_service
        self.subscriptions = subscription_service
        self.pricing = pricing_engine
        self.invoices = invoice_service
        self.payments = payment_service

    async def create_product_invoice(
        self,
        customer_id: str,
        items: List[InvoiceItem],
        tenant_id: str
    ) -> Invoice:
        """Create invoice for product purchases using pricing engine."""
        # For each item:
        #   - Calculate price using pricing engine
        #   - Create invoice line with price breakdown in metadata
        # Create invoice using your existing invoice service
        # Return created invoice

    async def process_subscription_billing_cycle(self, tenant_id: str):
        """Daily background job - process all subscription billing."""
        # Find subscriptions due for renewal
        # Find subscriptions ending trial periods
        # Find failed payments to retry
        # Process each type appropriately
        # Send notifications for failures
        # Update subscription statuses

    async def handle_payment_webhook(self, payment_event: PaymentEvent):
        """Handle payment success/failure for subscriptions."""
        # If subscription payment succeeded:
        #   - Update subscription status to active
        #   - Reset usage counters if applicable
        # If subscription payment failed:
        #   - Update status to past_due
        #   - Schedule retry according to settings
        #   - Send notifications
```

## API Layer (FastAPI Router)

### Endpoints Structure

```python
# /api/v1/billing/products
@router.get("/products")                    # List products
@router.post("/products")                   # Create product
@router.get("/products/{product_id}")       # Get product
@router.put("/products/{product_id}")       # Update product
@router.delete("/products/{product_id}")    # Deactivate product

# /api/v1/billing/plans
@router.get("/plans")                       # List subscription plans
@router.post("/plans")                      # Create plan
@router.get("/plans/{plan_id}")             # Get plan details
@router.put("/plans/{plan_id}")             # Update plan

# /api/v1/billing/subscriptions
@router.get("/subscriptions")               # List customer subscriptions
@router.post("/subscriptions")              # Create subscription
@router.get("/subscriptions/{sub_id}")      # Get subscription details
@router.put("/subscriptions/{sub_id}/plan") # Change plan
@router.delete("/subscriptions/{sub_id}")   # Cancel subscription

# /api/v1/billing/pricing
@router.post("/pricing/calculate")          # Calculate price for items
@router.get("/pricing/rules")               # List pricing rules
@router.post("/pricing/rules")              # Create pricing rule

# /api/v1/billing/usage
@router.post("/usage/record")               # Record usage for subscription
@router.get("/usage/{sub_id}")              # Get usage for subscription
```

## Admin Settings Integration

### Billing Settings Added to Your Admin System

```python
# Added to your existing SettingsCategory enum
class SettingsCategory(str, Enum):
    # ... existing categories ...
    BILLING = "billing"

# New billing settings model
class BillingSettings(BaseModel):
    # Product settings
    default_currency: str = "USD"
    auto_generate_skus: bool = True
    sku_prefix: str = "PROD"

    # Subscription settings
    default_trial_days: int = 14
    allow_plan_changes: bool = True
    proration_enabled: bool = True

    # Pricing settings
    max_discount_percent: Decimal = Decimal("50")
    customer_specific_pricing_enabled: bool = True

    # Processing settings
    auto_process_renewals: bool = False
    payment_retry_days: int = 3
    grace_period_days: int = 7
```

## Background Jobs & Automation

### Scheduled Tasks

```python
# Daily billing processor
@celery_app.task
def process_daily_billing():
    """Process all subscription renewals and usage billing."""
    for tenant in get_active_tenants():
        # Process subscription renewals
        # Calculate usage charges
        # Handle failed payments
        # Send renewal notifications

# Weekly cleanup
@celery_app.task
def cleanup_expired_pricing_rules():
    """Remove expired and used-up pricing rules."""
    # Deactivate expired rules
    # Archive fully-used promotional codes

# Monthly reporting
@celery_app.task
def generate_billing_reports():
    """Generate monthly billing analytics."""
    # Revenue reports by product/plan
    # Usage analytics
    # Churn analysis
```

## Migration Strategy

### Phase 1: Foundation
1. Create new billing tables
2. Add billing settings to admin system
3. Create basic product CRUD

### Phase 2: Core Features
1. Implement subscription plans and lifecycle
2. Build pricing engine with simple rules
3. Create integration service

### Phase 3: Advanced Features
1. Usage-based billing
2. Background processing jobs
3. Advanced reporting

## Data Flow Examples

### Creating a Subscription Invoice

```
1. Subscription renewal job runs
2. SubscriptionService.process_renewals() called
3. For each due subscription:
   a. Get plan details
   b. Calculate base price (with customer overrides)
   c. Calculate usage charges (if hybrid plan)
   d. Create invoice lines with metadata
   e. Call existing InvoiceService.create_invoice()
   f. Update subscription period
   g. Log renewal event
```

### Purchasing Products with Pricing Rules

```
1. Customer adds products to cart
2. Frontend calls /api/v1/billing/pricing/calculate
3. PricingEngine.calculate_line_price() for each item
4. Apply applicable pricing rules (first match wins)
5. Return price breakdown to frontend
6. On purchase, call BillingIntegrationService.create_product_invoice()
7. Integration service uses existing InvoiceService with calculated prices
```

This architecture gives you a complete, production-ready billing system that's simple to understand and maintain while providing all the SaaS billing features you need. Everything integrates cleanly with your existing systems without requiring changes to your proven invoice/payment foundation.

Would you like me to start implementing any specific part of this architecture?
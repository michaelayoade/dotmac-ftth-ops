# Billing System Design - Product Catalog & Subscription Management

## Overview
This document outlines the design for the missing foundational components in the DotMac billing system: Product Catalog, Subscription Management, and Pricing Engine.

## System Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Product Catalog   │    │  Subscription Mgmt  │    │   Pricing Engine    │
│                     │    │                     │    │                     │
│ • Products/Services │◄──►│ • Subscriptions     │◄──►│ • Price Calculation │
│ • SKUs & Categories │    │ • Billing Cycles    │    │ • Discounts         │
│ • Tax Classifications│    │ • Lifecycle Mgmt    │    │ • Customer Pricing  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                           │                           │
           └───────────────────────────┼───────────────────────────┘
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │           Invoice Generation            │
                    │                                         │
                    │ • Line Item Creation                    │
                    │ • Tax Calculation Integration           │
                    │ • Payment Processing                    │
                    └─────────────────────────────────────────┘
```

## 1. Product Catalog System

### Core Models

#### Product Base Model
```python
class Product(BillingBaseModel):
    """Base product/service definition."""

    product_id: str = Field(description="Unique product identifier")
    sku: str = Field(description="Stock Keeping Unit")
    name: str = Field(description="Product display name", max_length=255)
    description: Optional[str] = Field(None, description="Product description")

    # Classification
    product_type: ProductType = Field(description="PHYSICAL, DIGITAL, SERVICE")
    category_id: Optional[str] = Field(None, description="Product category")

    # Tax & Accounting
    tax_class: TaxClass = Field(description="Tax classification")
    revenue_recognition: RevenueRecognition = Field(description="How revenue is recognized")

    # Lifecycle
    status: ProductStatus = Field(default=ProductStatus.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class ProductType(str, Enum):
    PHYSICAL = "physical"      # Tangible goods
    DIGITAL = "digital"        # Software, downloads
    SERVICE = "service"        # Professional services
    SUBSCRIPTION = "subscription"  # Recurring services

class ProductStatus(str, Enum):
    DRAFT = "draft"           # Not yet available
    ACTIVE = "active"         # Available for sale
    INACTIVE = "inactive"     # Temporarily unavailable
    DISCONTINUED = "discontinued"  # No longer offered

class TaxClass(str, Enum):
    STANDARD = "standard"     # Standard tax rate
    REDUCED = "reduced"       # Reduced tax rate
    EXEMPT = "exempt"         # Tax exempt
    ZERO_RATED = "zero_rated" # Zero tax rate
    DIGITAL_SERVICES = "digital_services"  # Digital services tax
```

#### Product Categories
```python
class ProductCategory(BillingBaseModel):
    """Hierarchical product categorization."""

    category_id: str = Field(description="Category identifier")
    name: str = Field(description="Category name")
    parent_id: Optional[str] = Field(None, description="Parent category")
    path: str = Field(description="Full category path")

    # Tax defaults for category
    default_tax_class: TaxClass = Field(default=TaxClass.STANDARD)

    # Metadata
    description: Optional[str] = None
    sort_order: int = Field(default=0)

    # Hierarchy methods
    def get_full_path(self) -> str:
        """Get full category path (e.g., 'Software/SaaS/Analytics')"""
        return self.path
```

#### Product Variants
```python
class ProductVariant(BillingBaseModel):
    """Product variations (size, color, plan tier, etc.)"""

    variant_id: str = Field(description="Variant identifier")
    product_id: str = Field(description="Parent product")

    # Variant attributes
    variant_name: str = Field(description="Variant display name")
    variant_type: str = Field(description="Type of variation (size, plan, etc.)")

    # Pricing override
    base_price: Optional[Decimal] = Field(None, description="Override base price")

    # Attributes
    attributes: Dict[str, Any] = Field(default_factory=dict)

    # Status
    is_default: bool = Field(default=False)
    status: ProductStatus = Field(default=ProductStatus.ACTIVE)
```

### Product Service Layer
```python
class ProductCatalogService:
    """Service for managing products and catalog operations."""

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def create_product(
        self,
        product_data: ProductCreateRequest,
        tenant_id: str
    ) -> Product:
        """Create a new product with full validation."""

        # Validate SKU uniqueness within tenant
        existing = await self.get_product_by_sku(product_data.sku, tenant_id)
        if existing:
            raise ProductError(f"SKU {product_data.sku} already exists")

        # Create product with tenant isolation
        product = Product(
            product_id=generate_id("prod_"),
            tenant_id=tenant_id,
            **product_data.model_dump()
        )

        await self.db.save(product)
        return product

    async def get_catalog(
        self,
        tenant_id: str,
        category_id: Optional[str] = None,
        product_type: Optional[ProductType] = None,
        status: ProductStatus = ProductStatus.ACTIVE,
        page: int = 1,
        limit: int = 50
    ) -> PaginatedResponse[Product]:
        """Get paginated product catalog with filters."""

        query = self.db.query(Product).filter(
            Product.tenant_id == tenant_id,
            Product.status == status
        )

        if category_id:
            query = query.filter(Product.category_id == category_id)
        if product_type:
            query = query.filter(Product.product_type == product_type)

        return await self.db.paginate(query, page, limit)

    async def search_products(
        self,
        tenant_id: str,
        search_term: str,
        filters: Optional[ProductSearchFilters] = None
    ) -> List[Product]:
        """Full-text search across products."""
        # Implementation with search indexing
        pass
```

## 2. Subscription Management System

### Core Models

#### Subscription Plans
```python
class SubscriptionPlan(BillingBaseModel):
    """Subscription plan definition."""

    plan_id: str = Field(description="Plan identifier")
    product_id: str = Field(description="Associated product")

    # Plan details
    name: str = Field(description="Plan name")
    description: Optional[str] = Field(None)

    # Billing configuration
    billing_cycle: BillingCycle = Field(description="How often to bill")
    billing_interval: int = Field(default=1, description="Interval multiplier")

    # Pricing
    base_price: Decimal = Field(description="Base subscription price")
    setup_fee: Optional[Decimal] = Field(None, description="One-time setup fee")
    currency: str = Field(default="USD")

    # Trial configuration
    trial_period_days: Optional[int] = Field(None, description="Free trial days")

    # Features & Limits
    features: Dict[str, Any] = Field(default_factory=dict, description="Plan features")
    usage_limits: Dict[str, int] = Field(default_factory=dict, description="Usage quotas")

    # Plan lifecycle
    status: PlanStatus = Field(default=PlanStatus.ACTIVE)
    is_public: bool = Field(default=True, description="Available for signup")

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

class BillingCycle(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUALLY = "semi_annually"
    ANNUALLY = "annually"
    CUSTOM = "custom"

class PlanStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPRECATED = "deprecated"
```

#### Customer Subscriptions
```python
class Subscription(BillingBaseModel):
    """Customer subscription instance."""

    subscription_id: str = Field(description="Subscription identifier")
    customer_id: str = Field(description="Customer who owns subscription")
    plan_id: str = Field(description="Current subscription plan")

    # Billing periods
    current_period_start: datetime = Field(description="Current billing period start")
    current_period_end: datetime = Field(description="Current billing period end")

    # Status and lifecycle
    status: SubscriptionStatus = Field(description="Current subscription status")

    # Trial information
    trial_start: Optional[datetime] = Field(None)
    trial_end: Optional[datetime] = Field(None)

    # Cancellation
    cancel_at_period_end: bool = Field(default=False)
    canceled_at: Optional[datetime] = Field(None)
    ended_at: Optional[datetime] = Field(None)

    # Pricing overrides
    custom_price: Optional[Decimal] = Field(None, description="Customer-specific pricing")
    discount_percentage: Optional[Decimal] = Field(None)

    # Usage tracking
    usage_records: Dict[str, Any] = Field(default_factory=dict)

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SubscriptionStatus(str, Enum):
    INCOMPLETE = "incomplete"          # Payment method setup pending
    INCOMPLETE_EXPIRED = "incomplete_expired"  # Setup expired
    TRIALING = "trialing"             # In trial period
    ACTIVE = "active"                 # Active subscription
    PAST_DUE = "past_due"            # Payment failed, retrying
    CANCELED = "canceled"             # Canceled, still active until period end
    UNPAID = "unpaid"                # Final payment failed
    PAUSED = "paused"                # Temporarily suspended
```

#### Subscription Events
```python
class SubscriptionEvent(BillingBaseModel):
    """Track subscription lifecycle events."""

    event_id: str = Field(description="Event identifier")
    subscription_id: str = Field(description="Related subscription")

    event_type: SubscriptionEventType = Field(description="Type of event")
    event_data: Dict[str, Any] = Field(description="Event-specific data")

    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[str] = Field(None, description="User who triggered event")

class SubscriptionEventType(str, Enum):
    CREATED = "subscription.created"
    ACTIVATED = "subscription.activated"
    TRIAL_STARTED = "subscription.trial_started"
    TRIAL_ENDED = "subscription.trial_ended"
    RENEWED = "subscription.renewed"
    UPGRADED = "subscription.upgraded"
    DOWNGRADED = "subscription.downgraded"
    CANCELED = "subscription.canceled"
    PAUSED = "subscription.paused"
    RESUMED = "subscription.resumed"
    ENDED = "subscription.ended"
```

### Subscription Service Layer
```python
class SubscriptionManagementService:
    """Core subscription management logic."""

    def __init__(
        self,
        db: DatabaseManager,
        invoice_service: InvoiceService,
        payment_service: PaymentService
    ):
        self.db = db
        self.invoice_service = invoice_service
        self.payment_service = payment_service

    async def create_subscription(
        self,
        customer_id: str,
        plan_id: str,
        options: SubscriptionCreateOptions,
        tenant_id: str
    ) -> Subscription:
        """Create new subscription with proper lifecycle setup."""

        plan = await self.get_plan(plan_id, tenant_id)
        if not plan:
            raise SubscriptionError(f"Plan {plan_id} not found")

        # Calculate billing periods
        now = datetime.now(timezone.utc)
        period_start, period_end = self._calculate_billing_period(
            start_date=options.start_date or now,
            billing_cycle=plan.billing_cycle,
            billing_interval=plan.billing_interval
        )

        # Handle trial period
        trial_end = None
        if plan.trial_period_days and options.include_trial:
            trial_end = now + timedelta(days=plan.trial_period_days)

        subscription = Subscription(
            subscription_id=generate_id("sub_"),
            customer_id=customer_id,
            plan_id=plan_id,
            tenant_id=tenant_id,
            current_period_start=period_start,
            current_period_end=period_end,
            trial_end=trial_end,
            status=SubscriptionStatus.TRIALING if trial_end else SubscriptionStatus.ACTIVE,
            custom_price=options.custom_price,
            metadata=options.metadata or {}
        )

        # Save subscription and create initial event
        await self.db.save(subscription)
        await self._create_event(subscription, SubscriptionEventType.CREATED)

        # Create setup fee invoice if applicable
        if plan.setup_fee and plan.setup_fee > 0:
            await self._create_setup_fee_invoice(subscription, plan)

        return subscription

    async def renew_subscription(
        self,
        subscription_id: str,
        tenant_id: str
    ) -> Subscription:
        """Process subscription renewal and generate invoice."""

        subscription = await self.get_subscription(subscription_id, tenant_id)
        plan = await self.get_plan(subscription.plan_id, tenant_id)

        # Calculate next billing period
        next_start = subscription.current_period_end
        next_end = self._calculate_next_period_end(
            next_start, plan.billing_cycle, plan.billing_interval
        )

        # Create renewal invoice
        invoice = await self._create_renewal_invoice(subscription, plan)

        # Update subscription
        subscription.current_period_start = next_start
        subscription.current_period_end = next_end
        await self.db.save(subscription)

        await self._create_event(subscription, SubscriptionEventType.RENEWED)

        return subscription

    async def change_plan(
        self,
        subscription_id: str,
        new_plan_id: str,
        proration_behavior: ProrationBehavior,
        tenant_id: str
    ) -> Subscription:
        """Handle subscription plan changes with proration."""

        subscription = await self.get_subscription(subscription_id, tenant_id)
        old_plan = await self.get_plan(subscription.plan_id, tenant_id)
        new_plan = await self.get_plan(new_plan_id, tenant_id)

        # Calculate proration if needed
        proration_amount = Decimal("0")
        if proration_behavior == ProrationBehavior.CREATE_PRORATIONS:
            proration_amount = await self._calculate_proration(
                subscription, old_plan, new_plan
            )

        # Update subscription
        old_plan_id = subscription.plan_id
        subscription.plan_id = new_plan_id

        # Create proration invoice/credit if needed
        if proration_amount != 0:
            await self._create_proration_invoice(
                subscription, proration_amount, old_plan, new_plan
            )

        await self.db.save(subscription)

        # Create appropriate event
        event_type = (
            SubscriptionEventType.UPGRADED
            if new_plan.base_price > old_plan.base_price
            else SubscriptionEventType.DOWNGRADED
        )
        await self._create_event(subscription, event_type, {
            "old_plan_id": old_plan_id,
            "new_plan_id": new_plan_id,
            "proration_amount": str(proration_amount)
        })

        return subscription
```

## 3. Pricing Engine System

### Core Models

#### Pricing Rules
```python
class PricingRule(BillingBaseModel):
    """Flexible pricing rule system."""

    rule_id: str = Field(description="Pricing rule identifier")
    name: str = Field(description="Rule name")

    # Rule targeting
    applies_to: PricingTarget = Field(description="What this rule applies to")
    conditions: List[PricingCondition] = Field(description="When rule applies")

    # Pricing modifications
    pricing_type: PricingType = Field(description="How to modify price")
    amount: Decimal = Field(description="Amount or percentage")

    # Rule metadata
    priority: int = Field(default=0, description="Rule priority (higher wins)")
    starts_at: Optional[datetime] = Field(None)
    ends_at: Optional[datetime] = Field(None)

    # Usage limits
    usage_limit: Optional[int] = Field(None, description="Max times rule can be used")
    usage_count: int = Field(default=0)

    status: RuleStatus = Field(default=RuleStatus.ACTIVE)

class PricingType(str, Enum):
    PERCENTAGE_DISCOUNT = "percentage_discount"
    FIXED_DISCOUNT = "fixed_discount"
    PERCENTAGE_MARKUP = "percentage_markup"
    FIXED_MARKUP = "fixed_markup"
    FIXED_PRICE = "fixed_price"
    TIERED_PRICING = "tiered_pricing"

class PricingCondition(BaseModel):
    """Condition for when pricing rule applies."""

    condition_type: ConditionType = Field(description="Type of condition")
    operator: ComparisonOperator = Field(description="Comparison operator")
    value: Any = Field(description="Value to compare against")

class ConditionType(str, Enum):
    CUSTOMER_SEGMENT = "customer_segment"
    ORDER_QUANTITY = "order_quantity"
    ORDER_TOTAL = "order_total"
    CUSTOMER_LIFETIME_VALUE = "customer_lifetime_value"
    GEOGRAPHIC_LOCATION = "geographic_location"
    TIME_OF_DAY = "time_of_day"
    DAY_OF_WEEK = "day_of_week"
    SEASON = "season"
```

#### Tiered Pricing
```python
class PriceTier(BillingBaseModel):
    """Volume-based pricing tiers."""

    tier_id: str = Field(description="Tier identifier")
    product_id: str = Field(description="Product this tier applies to")

    # Tier definition
    min_quantity: int = Field(description="Minimum quantity for tier")
    max_quantity: Optional[int] = Field(None, description="Maximum quantity (None = unlimited)")

    # Pricing
    unit_price: Decimal = Field(description="Price per unit in this tier")
    flat_fee: Optional[Decimal] = Field(None, description="Flat fee for tier")

    # Tier metadata
    tier_name: str = Field(description="Tier display name")
    description: Optional[str] = None

class UsageBasedPricing(BillingBaseModel):
    """Usage-based pricing model."""

    pricing_id: str = Field(description="Pricing model identifier")
    product_id: str = Field(description="Associated product")

    # Usage metrics
    usage_type: UsageType = Field(description="What is being measured")
    unit_name: str = Field(description="Unit name (API calls, GB, users)")

    # Pricing model
    pricing_model: UsagePricingModel = Field(description="How usage is priced")
    tiers: List[UsageTier] = Field(description="Usage pricing tiers")

    # Billing configuration
    measurement_period: MeasurementPeriod = Field(description="When to measure usage")
    reset_period: ResetPeriod = Field(description="When to reset usage counters")

class UsageType(str, Enum):
    API_CALLS = "api_calls"
    DATA_TRANSFER = "data_transfer"
    STORAGE = "storage"
    USERS = "users"
    TRANSACTIONS = "transactions"
    COMPUTE_HOURS = "compute_hours"
    CUSTOM = "custom"
```

### Pricing Engine Service
```python
class PricingEngine:
    """Core pricing calculation engine."""

    def __init__(self, db: DatabaseManager):
        self.db = db
        self.cache = {}  # Price calculation cache

    async def calculate_price(
        self,
        request: PriceCalculationRequest
    ) -> PriceCalculationResult:
        """Calculate final price with all applicable rules and discounts."""

        # Get base product price
        product = await self.get_product(request.product_id, request.tenant_id)
        base_price = product.base_price or Decimal("0")

        # Initialize calculation context
        context = PricingContext(
            product=product,
            customer_id=request.customer_id,
            quantity=request.quantity,
            calculation_date=request.calculation_date or datetime.now(timezone.utc),
            tenant_id=request.tenant_id,
            metadata=request.metadata or {}
        )

        # Apply tiered pricing if configured
        if product.pricing_model == PricingModel.TIERED:
            base_price = await self._calculate_tiered_price(product, context)

        # Apply usage-based pricing if configured
        elif product.pricing_model == PricingModel.USAGE_BASED:
            base_price = await self._calculate_usage_price(product, context)

        # Get applicable pricing rules
        rules = await self._get_applicable_rules(context)

        # Apply pricing rules in priority order
        final_price = base_price
        applied_rules = []

        for rule in sorted(rules, key=lambda r: r.priority, reverse=True):
            if await self._rule_applies(rule, context):
                price_adjustment = await self._apply_pricing_rule(
                    rule, final_price, context
                )
                final_price = price_adjustment.new_price
                applied_rules.append(price_adjustment)

        # Calculate tax if applicable
        tax_amount = await self._calculate_tax(final_price, product, context)

        return PriceCalculationResult(
            base_price=base_price,
            final_price=final_price,
            tax_amount=tax_amount,
            total_price=final_price + tax_amount,
            applied_rules=applied_rules,
            context=context
        )

    async def _calculate_tiered_price(
        self,
        product: Product,
        context: PricingContext
    ) -> Decimal:
        """Calculate price using tiered pricing model."""

        tiers = await self.get_price_tiers(product.product_id, context.tenant_id)
        quantity = context.quantity
        total_price = Decimal("0")

        for tier in sorted(tiers, key=lambda t: t.min_quantity):
            tier_quantity = min(
                quantity,
                (tier.max_quantity or quantity) - tier.min_quantity + 1
            )

            if tier_quantity > 0:
                tier_price = tier.unit_price * tier_quantity
                if tier.flat_fee:
                    tier_price += tier.flat_fee

                total_price += tier_price
                quantity -= tier_quantity

            if quantity <= 0:
                break

        return total_price
```

## Discussion Points

Now let's discuss these designs:

### 1. **Product Catalog Architecture**
- **Question**: Should we support complex product hierarchies (parent-child relationships)?
- **Question**: How granular should product variants be? (size/color vs subscription tiers)
- **Question**: Should products have versioning for price changes?

### 2. **Subscription Management**
- **Question**: How should we handle mid-cycle plan changes? Full proration or simplified?
- **Question**: Should we support usage-based billing within subscriptions?
- **Question**: How complex should trial periods be? (different trials per plan vs global)

### 3. **Pricing Engine Complexity**
- **Question**: How many concurrent pricing rules should we support?
- **Question**: Should pricing rules have customer-specific overrides?
- **Question**: How should we handle pricing conflicts when multiple rules apply?

### 4. **Integration Concerns**
- **Question**: How tightly should this integrate with the existing invoice system?
- **Question**: Should we build our own proration logic or integrate with Stripe's?
- **Question**: How do we handle currency conversion in pricing calculations?

### 5. **Performance Considerations**
- **Question**: Should pricing calculations be cached? For how long?
- **Question**: How do we handle high-volume usage-based pricing calculations?
- **Question**: Should complex pricing rules be pre-calculated or real-time?

What aspects would you like to dive deeper into or modify in this design?
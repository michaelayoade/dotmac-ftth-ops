# Billing Module Navigation Guide

**Quick Reference for DotMac Platform Billing System**

> 📦 **Module Location**: `src/dotmac/platform/billing/`
> 📊 **Size**: 73 files, 17+ service classes
> 🎯 **Purpose**: Complete billing, invoicing, and subscription management

---

## 📁 Directory Structure

```
billing/
├── core/               # Base models and entities
│   ├── models.py       # Pydantic models (Invoice, Payment, Customer)
│   ├── entities.py     # SQLAlchemy entities
│   └── enums.py        # Status enums, types
│
├── catalog/            # Product Management ⭐
│   ├── models.py       # Product, ProductCategory models
│   ├── service.py      # ProductService (CRUD operations)
│   └── router.py       # REST API: /api/v1/billing/catalog
│
├── subscriptions/      # Subscription Lifecycle ⭐
│   ├── models.py       # Subscription, SubscriptionPlan models
│   ├── service.py      # SubscriptionService
│   └── router.py       # REST API: /api/v1/billing/subscriptions
│
├── pricing/            # Dynamic Pricing Engine ⭐
│   ├── models.py       # PricingRule, Discount models
│   ├── service.py      # PricingService (tiered, volume pricing)
│   └── router.py       # REST API: /api/v1/billing/pricing
│
├── invoicing/          # Invoice Generation ⭐
│   ├── service.py      # ⚠️ DEPRECATED - Legacy invoice service
│   ├── money_service.py # ✅ CURRENT - Money-aware invoice service
│   ├── money_router.py # REST API for invoice operations
│   └── router.py       # Legacy router
│
├── payments/           # Payment Processing
│   ├── service.py      # PaymentService (Stripe integration)
│   └── providers.py    # Payment provider interfaces
│
├── tax/                # Tax Calculation
│   ├── calculator.py   # Tax calculation engine
│   ├── service.py      # Tax service
│   └── reports.py      # Tax reporting
│
├── bank_accounts/      # Banking Integration
│   ├── models.py       # BankAccount models
│   ├── service.py      # Manual payment handling
│   └── router.py       # REST API: /api/v1/billing/bank-accounts
│
├── credit_notes/       # Refunds & Credits
│   ├── models.py       # CreditNote models
│   ├── service.py      # CreditNoteService
│   └── router.py       # REST API: /api/v1/billing/credit-notes
│
├── reports/            # Financial Reporting
│   ├── generators.py   # Report generators
│   └── service.py      # Report service
│
├── receipts/           # Receipt Generation
│   ├── models.py       # Receipt models
│   └── generators.py   # Receipt PDF generators
│
├── settings/           # Billing Configuration
│   ├── models.py       # BillingSettings models
│   ├── service.py      # Settings management
│   └── router.py       # REST API: /api/v1/billing/settings
│
└── webhooks/           # Webhook Handlers
    ├── handlers.py     # Stripe webhook handlers
    └── router.py       # Webhook endpoints
```

---

## 🎯 When to Use What Service

### Adding a New Product
```python
from dotmac.platform.billing.catalog.service import ProductService
from dotmac.platform.billing.catalog.models import ProductCreateRequest

service = ProductService(db_session)
product = await service.create_product(
    ProductCreateRequest(
        name="Premium Plan",
        type=ProductType.RECURRING,
        price=9900,  # $99.00 in cents
        currency="USD"
    ),
    tenant_id="acme-corp"
)
```
📍 **Location**: `catalog/service.py:ProductService`
🌐 **API**: `POST /api/v1/billing/catalog/products`

---

### Creating a Subscription
```python
from dotmac.platform.billing.subscriptions.service import SubscriptionService

service = SubscriptionService(db_session)
subscription = await service.create_subscription(
    customer_id="cust_123",
    plan_id="plan_premium",
    trial_days=14
)
```
📍 **Location**: `subscriptions/service.py:SubscriptionService`
🌐 **API**: `POST /api/v1/billing/subscriptions`

---

### Generating an Invoice
```python
from dotmac.platform.billing.invoicing.money_service import MoneyInvoiceService

# ✅ USE THIS (Money-aware)
service = MoneyInvoiceService(db_session)
invoice = await service.create_invoice(
    customer_id="cust_123",
    line_items=[...],
    currency="USD"
)
```
📍 **Location**: `invoicing/money_service.py:MoneyInvoiceService` ✅
🌐 **API**: `POST /api/v1/billing/invoices`

⚠️ **DO NOT USE**: `invoicing/service.py` (deprecated, legacy code)

---

### Processing a Payment
```python
from dotmac.platform.billing.payments.service import PaymentService

service = PaymentService(db_session)
payment = await service.create_payment(
    invoice_id="inv_123",
    amount=9900,
    payment_method_id="pm_stripe_..."
)
```
📍 **Location**: `payments/service.py:PaymentService`
🌐 **API**: `POST /api/v1/billing/payments`

---

### Calculating Tax
```python
from dotmac.platform.billing.tax.calculator import TaxCalculator

calculator = TaxCalculator()
tax_amount = calculator.calculate_tax(
    amount=9900,
    tax_rate=0.08,  # 8%
    jurisdiction="CA"
)
```
📍 **Location**: `tax/calculator.py:TaxCalculator`

---

### Applying Dynamic Pricing
```python
from dotmac.platform.billing.pricing.service import PricingService

service = PricingService(db_session)
final_price = await service.calculate_price(
    product_id="prod_123",
    quantity=10,
    customer_id="cust_123"  # Customer-specific pricing
)
```
📍 **Location**: `pricing/service.py:PricingService`
🌐 **API**: `POST /api/v1/billing/pricing/calculate`

---

## 🔑 Key Services Reference

| Service | File | Purpose | API Prefix |
|---------|------|---------|------------|
| **ProductService** | `catalog/service.py:30` | Product CRUD | `/api/v1/billing/catalog` |
| **SubscriptionService** | `subscriptions/service.py:25` | Subscription lifecycle | `/api/v1/billing/subscriptions` |
| **PricingService** | `pricing/service.py:20` | Dynamic pricing | `/api/v1/billing/pricing` |
| **MoneyInvoiceService** ✅ | `invoicing/money_service.py:45` | Invoice generation | `/api/v1/billing/invoices` |
| **PaymentService** | `payments/service.py:35` | Payment processing | `/api/v1/billing/payments` |
| **TaxCalculator** | `tax/calculator.py:15` | Tax calculations | N/A (utility) |
| **CreditNoteService** | `credit_notes/service.py:20` | Refunds/credits | `/api/v1/billing/credit-notes` |
| **BankAccountService** | `bank_accounts/service.py:25` | Manual payments | `/api/v1/billing/bank-accounts` |

---

## 🗂️ Core Models

### Invoice Models (Money-Aware)
```python
# ✅ Current implementation
from dotmac.platform.billing.money_models import MoneyInvoice, MoneyInvoiceLineItem

invoice = MoneyInvoice(
    tenant_id="acme",
    customer_id="cust_123",
    subtotal=Money(99.00, "USD"),
    tax_amount=Money(7.92, "USD"),
    total=Money(106.92, "USD")
)
```
📍 **Location**: `money_models.py:45`

### Payment Models
```python
from dotmac.platform.billing.core.models import Payment

payment = Payment(
    tenant_id="acme",
    invoice_id="inv_123",
    amount=10692,  # $106.92 in cents
    currency="USD",
    status=PaymentStatus.SUCCEEDED
)
```
📍 **Location**: `core/models.py:150`

### Subscription Models
```python
from dotmac.platform.billing.subscriptions.models import Subscription

subscription = Subscription(
    customer_id="cust_123",
    plan_id="plan_premium",
    status=SubscriptionStatus.ACTIVE,
    trial_end_date=datetime.now() + timedelta(days=14)
)
```
📍 **Location**: `subscriptions/models.py:40`

---

## 🚦 Common Workflows

### Complete Billing Flow
```python
# 1. Create product
product_service = ProductService(db)
product = await product_service.create_product(...)

# 2. Create subscription
sub_service = SubscriptionService(db)
subscription = await sub_service.create_subscription(...)

# 3. Generate invoice (auto-triggered by subscription)
invoice_service = MoneyInvoiceService(db)
invoice = await invoice_service.create_invoice_from_subscription(subscription.id)

# 4. Process payment
payment_service = PaymentService(db)
payment = await payment_service.create_payment(invoice.id, payment_method_id)

# 5. Generate receipt (auto-triggered after successful payment)
```

### Refund Flow
```python
# 1. Create credit note
credit_service = CreditNoteService(db)
credit_note = await credit_service.issue_credit_note(
    invoice_id="inv_123",
    amount=5000,  # Partial refund
    reason="Customer request"
)

# 2. Process refund through payment provider
payment_service = PaymentService(db)
refund = await payment_service.create_refund(
    payment_id="pay_123",
    amount=5000
)
```

---

## ⚠️ Important Notes

### Money Handling
Always use `Money` type from `py-moneyed` for currency values:
```python
from moneyed import Money

# ✅ Correct
price = Money(99.99, "USD")

# ❌ Wrong (floating point errors)
price = 99.99
```

### Tenant Isolation
All billing operations are tenant-scoped:
```python
# Always pass tenant_id
product = await service.create_product(request, tenant_id="acme-corp")

# Queries automatically filtered by tenant via middleware
```

### Idempotency
Invoice creation supports idempotency keys:
```python
invoice = await service.create_invoice(
    ...,
    idempotency_key="invoice-2024-01-001"  # Prevents duplicates
)
```

---

## 📚 Related Documentation

- [Complete Billing Architecture](../complete-billing-architecture.md)
- [Money Implementation Guide](../billing-money-implementation.md)
- [Billing System Design](../billing-system-design.md)
- [API Reference](../api/billing.md)

---

## 🆘 Troubleshooting

### "Which service should I use?"
1. Check this guide's "When to Use What Service" section
2. Look at the service's docstring for examples
3. Check tests in `tests/billing/test_<module>_service.py`

### "Legacy vs Current code"
- `invoicing/service.py` → ❌ Deprecated
- `invoicing/money_service.py` → ✅ Use this

### "Where is feature X?"
Use `rg` (ripgrep) to search:
```bash
rg "class.*Service" src/dotmac/platform/billing --type py
rg "def create_payment" src/dotmac/platform/billing --type py
```

---

**Last Updated**: 2025-09-29
**Maintainer**: Platform Team
**Questions?** Check `#billing-dev` in Slack
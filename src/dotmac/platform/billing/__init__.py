"""
Billing system module.

Provides billing capabilities including:
- Product catalog management
- Subscription lifecycle
- Usage-based billing
- Pricing rules and discounts
- Invoice and payment processing
- Money-aware models with accurate currency handling
- PDF invoice generation

Integrated with DotMac platform services.
"""

from dotmac.platform.billing.catalog.models import (
    Product,
    ProductCategory,
    ProductCategoryCreateRequest,
    ProductCategoryResponse,
    ProductCreateRequest,
    ProductFilters,
    ProductResponse,
    ProductType,
    ProductUpdateRequest,
    TaxClass,
    UsageType,
)
from dotmac.platform.billing.catalog.service import ProductService

# Import core models for tests
from dotmac.platform.billing.core.models import (
    Customer,
    Invoice,
    InvoiceItem,
    InvoiceLineItem,
    Payment,
    Price,
    Subscription,
)
from dotmac.platform.billing.exceptions import (
    BillingConfigurationError,
    BillingError,
    CategoryNotFoundError,
    InvalidPricingRuleError,
    PlanNotFoundError,
    PricingError,
    ProductError,
    ProductNotFoundError,
    SubscriptionError,
    SubscriptionNotFoundError,
    UsageTrackingError,
)
from dotmac.platform.billing.models import (
    BillingBaseModel,
    BillingPricingRuleTable,
    BillingProductCategoryTable,
    BillingProductTable,
    BillingRuleUsageTable,
    BillingSettingsTable,
    BillingSQLModel,
    BillingSubscriptionEventTable,
    BillingSubscriptionPlanTable,
    BillingSubscriptionTable,
)

__all__ = [
    # Product catalog
    "Product",
    "ProductCategory",
    "ProductType",
    "UsageType",
    "TaxClass",
    "ProductCreateRequest",
    "ProductUpdateRequest",
    "ProductCategoryCreateRequest",
    "ProductFilters",
    "ProductResponse",
    "ProductCategoryResponse",
    "ProductService",
    # Core billing models
    "Invoice",
    "InvoiceLineItem",
    "InvoiceItem",
    "Payment",
    "Customer",
    "Subscription",
    "Price",
    # Exceptions
    "BillingError",
    "ProductError",
    "ProductNotFoundError",
    "CategoryNotFoundError",
    "SubscriptionError",
    "SubscriptionNotFoundError",
    "PlanNotFoundError",
    "PricingError",
    "InvalidPricingRuleError",
    "UsageTrackingError",
    "BillingConfigurationError",
    # Database models
    "BillingBaseModel",
    "BillingSQLModel",
    "BillingProductTable",
    "BillingProductCategoryTable",
    "BillingSubscriptionPlanTable",
    "BillingSubscriptionTable",
    "BillingSubscriptionEventTable",
    "BillingPricingRuleTable",
    "BillingRuleUsageTable",
    "BillingSettingsTable",
    # Money-aware models and utilities
    "MoneyInvoice",
    "MoneyInvoiceLineItem",
    "MoneyField",
    "money_handler",
    "create_money",
    "format_money",
    "InvoiceMigrationAdapter",
    "BatchMigrationService",
    "MoneyInvoiceService",
    "ReportLabInvoiceGenerator",
]

# Import Money modules for convenience
from dotmac.platform.billing.invoicing.money_service import MoneyInvoiceService
from dotmac.platform.billing.money_migration import BatchMigrationService, InvoiceMigrationAdapter
from dotmac.platform.billing.money_models import MoneyField, MoneyInvoice, MoneyInvoiceLineItem
from dotmac.platform.billing.money_utils import create_money, format_money, money_handler
from dotmac.platform.billing.pdf_generator_reportlab import ReportLabInvoiceGenerator

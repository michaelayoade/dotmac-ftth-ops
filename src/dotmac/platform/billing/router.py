"""
Main billing module router aggregating all billing sub-routers
"""

from fastapi import APIRouter

from .addons.router import router as addons_router
from .bank_accounts.router import router as bank_accounts_router
from .catalog.router import router as catalog_router
from .credit_notes.router import router as credit_note_router
from .dunning.router import router as dunning_router
from .invoicing.money_router import router as money_invoice_router
from .invoicing.router import router as invoice_router
from .payment_methods.router import router as payment_methods_router
from .payments.router import router as payments_router
from .reports.router import router as reports_router
from .settings.router import router as settings_router
from .subscriptions.router import router as subscriptions_router
from .subscriptions.tenant_router import router as tenant_subscriptions_router
from .usage.router import router as usage_router
from .webhooks.router import router as webhook_router

# Create main billing router - no prefix here as it's added in main router registration
router = APIRouter(prefix="/billing", tags=["Billing"])

# Include sub-routers with hierarchical tags for better API docs organization
router.include_router(invoice_router, prefix="", tags=["Billing - Invoices"])
router.include_router(money_invoice_router, prefix="", tags=["Billing - Money Invoices"])
router.include_router(webhook_router, prefix="", tags=["Billing - Webhooks"])
router.include_router(credit_note_router, prefix="", tags=["Billing - Credit Notes"])
router.include_router(settings_router, prefix="", tags=["Billing - Settings"])
router.include_router(bank_accounts_router, prefix="", tags=["Billing - Bank Accounts"])
router.include_router(catalog_router, prefix="", tags=["Billing - Catalog"])
router.include_router(
    subscriptions_router, prefix="/subscriptions", tags=["Billing - Subscriptions"]
)
router.include_router(tenant_subscriptions_router, prefix="", tags=["Tenant - Subscriptions"])
router.include_router(addons_router, prefix="", tags=["Tenant - Add-ons"])
router.include_router(payment_methods_router, prefix="", tags=["Tenant - Payment Methods"])
router.include_router(payments_router, prefix="", tags=["Billing - Payments"])
router.include_router(dunning_router, prefix="/dunning", tags=["Billing - Dunning"])
router.include_router(usage_router, prefix="", tags=["Billing - Usage"])
router.include_router(reports_router, prefix="", tags=["Billing - Reports"])

# Additional billing endpoints can be added here

__all__ = ["router"]

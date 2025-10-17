"""
Add-ons module for tenant self-service billing.

Provides marketplace functionality for tenants to purchase additional
features, resources, and services on top of their base subscription.
"""

from .models import (
    Addon,
    AddonBillingType,
    AddonResponse,
    AddonStatus,
    AddonType,
    CancelAddonRequest,
    PurchaseAddonRequest,
    TenantAddon,
    TenantAddonResponse,
    UpdateAddonQuantityRequest,
)
from .router import router
from .service import AddonService

__all__ = [
    # Models
    "Addon",
    "AddonType",
    "AddonBillingType",
    "AddonStatus",
    "TenantAddon",
    # Request/Response models
    "AddonResponse",
    "TenantAddonResponse",
    "PurchaseAddonRequest",
    "UpdateAddonQuantityRequest",
    "CancelAddonRequest",
    # Service
    "AddonService",
    # Router
    "router",
]

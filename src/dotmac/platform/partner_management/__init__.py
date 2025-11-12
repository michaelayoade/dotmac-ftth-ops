"""
Partner Management Module.

Provides comprehensive partner relationship management including:
- Partner profiles and status tracking
- Partner user access control
- Partner-customer account assignments
- Partner-tenant multi-account management (MSP/Enterprise HQ)
- Commission tracking and payout management
- Referral lead tracking and conversion
"""

from dotmac.platform.partner_management import (
    commission_rules_router,
    portal_router,
    revenue_router,
)
from dotmac.platform.partner_management.models import (
    CommissionStatus,
    Partner,
    PartnerAccount,
    PartnerCommission,
    PartnerCommissionEvent,
    PartnerStatus,
    PartnerTenantAccessRole,
    PartnerTenantLink,
    PartnerTier,
    PartnerUser,
    PayoutStatus,
    ReferralLead,
    ReferralStatus,
)

__all__ = [
    "Partner",
    "PartnerStatus",
    "PartnerTier",
    "PartnerUser",
    "PartnerAccount",
    "PartnerTenantLink",
    "PartnerTenantAccessRole",
    "PartnerCommission",
    "PartnerCommissionEvent",
    "CommissionStatus",
    "PayoutStatus",
    "ReferralLead",
    "ReferralStatus",
    "commission_rules_router",
    "portal_router",
    "revenue_router",
]

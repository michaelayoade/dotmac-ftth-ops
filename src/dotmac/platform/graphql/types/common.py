"""
Common GraphQL types and enums shared across multiple domains.

This module contains enums and types that are used by multiple GraphQL types
to avoid duplication and schema conflicts.
"""

from enum import Enum

import strawberry


@strawberry.enum
class BillingCycleEnum(str, Enum):
    """Billing cycle options used across tenants, subscriptions, and plans."""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    ANNUAL = "annual"  # Alias for yearly (used by subscriptions)
    CUSTOM = "custom"

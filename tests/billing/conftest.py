"""Expose billing fixtures for pytest."""

from tests.billing._fixtures.shared import *  # noqa: F401,F403

# Import factory fixtures for creating real test data (reduces mock usage)
from tests.billing.factories import (  # noqa: F401
    customer_factory,
    invoice_factory,
    payment_factory,
    payment_method_factory,
    subscription_factory,
    subscription_plan_factory,
)

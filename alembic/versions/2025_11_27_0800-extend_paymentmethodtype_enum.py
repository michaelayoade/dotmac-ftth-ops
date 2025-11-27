"""Extend paymentmethodtype enum with bank_accounts values

The bank_accounts.entities.PaymentMethodType enum has additional values
(bank_transfer, ach, money_order, mobile_money, other) that were not
included in the core.enums.PaymentMethodType used when the PG enum was created.

Revision ID: 2025_11_27_0800
Revises: 2025_11_10_0700
Create Date: 2025-11-27 08:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "2025_11_27_0800"
down_revision: Union[str, None] = "2025_11_10_0700"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing values to paymentmethodtype enum.

    Current PG enum values: card, bank_account, digital_wallet, crypto, check, wire_transfer, cash
    Adding: bank_transfer, ach, money_order, mobile_money, other
    """
    # PostgreSQL allows adding new values to an enum with ADD VALUE IF NOT EXISTS
    op.execute("ALTER TYPE paymentmethodtype ADD VALUE IF NOT EXISTS 'bank_transfer'")
    op.execute("ALTER TYPE paymentmethodtype ADD VALUE IF NOT EXISTS 'ach'")
    op.execute("ALTER TYPE paymentmethodtype ADD VALUE IF NOT EXISTS 'money_order'")
    op.execute("ALTER TYPE paymentmethodtype ADD VALUE IF NOT EXISTS 'mobile_money'")
    op.execute("ALTER TYPE paymentmethodtype ADD VALUE IF NOT EXISTS 'other'")


def downgrade() -> None:
    """Cannot remove enum values in PostgreSQL without recreating the type.

    If downgrade is needed, the enum values will remain but won't be used.
    To fully remove, would need to:
    1. Create new enum without the values
    2. Migrate all columns
    3. Drop old enum
    4. Rename new enum

    This is destructive and rarely needed, so we skip it.
    """
    pass

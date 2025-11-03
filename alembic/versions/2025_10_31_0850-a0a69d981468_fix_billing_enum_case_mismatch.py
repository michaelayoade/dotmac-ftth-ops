"""fix_billing_enum_case_mismatch

Revision ID: a0a69d981468
Revises: ea6ad3f28ea7
Create Date: 2025-10-31 08:50:50.230512

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "a0a69d981468"
down_revision = "ea6ad3f28ea7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Fix enum case mismatch between database (UPPERCASE) and Python code (lowercase)."""

    # Fix PaymentMethodType enum
    # Database has: ACH, BANK_TRANSFER, CASH, CHECK, CRYPTO, MOBILE_MONEY, MONEY_ORDER, OTHER, WIRE_TRANSFER
    # Python needs: card, bank_account, digital_wallet, crypto, check, wire_transfer, cash

    op.execute("ALTER TYPE paymentmethodtype RENAME TO paymentmethodtype_old")

    op.execute("""
        CREATE TYPE paymentmethodtype AS ENUM (
            'card',
            'bank_account',
            'digital_wallet',
            'crypto',
            'check',
            'wire_transfer',
            'cash'
        )
    """)

    # Convert columns: manual_payments.payment_method, payment_methods.type, payments.payment_method_type
    op.execute("""
        ALTER TABLE manual_payments
        ALTER COLUMN payment_method TYPE text USING (
            CASE payment_method::text
                WHEN 'ACH' THEN 'bank_account'
                WHEN 'BANK_TRANSFER' THEN 'bank_account'
                WHEN 'CASH' THEN 'cash'
                WHEN 'CHECK' THEN 'check'
                WHEN 'WIRE_TRANSFER' THEN 'wire_transfer'
                WHEN 'CRYPTO' THEN 'crypto'
                WHEN 'MOBILE_MONEY' THEN 'digital_wallet'
                WHEN 'MONEY_ORDER' THEN 'check'
                WHEN 'OTHER' THEN 'cash'
                ELSE 'cash'  -- Fallback ensures migration succeeds; review unmapped values post-migration.
            END
        )
    """)

    op.execute("""
        ALTER TABLE manual_payments
        ALTER COLUMN payment_method TYPE paymentmethodtype USING payment_method::paymentmethodtype
    """)

    op.execute("""
        ALTER TABLE payment_methods
        ALTER COLUMN type TYPE text USING (
            CASE type::text
                WHEN 'ACH' THEN 'bank_account'
                WHEN 'BANK_TRANSFER' THEN 'bank_account'
                WHEN 'CASH' THEN 'cash'
                WHEN 'CHECK' THEN 'check'
                WHEN 'WIRE_TRANSFER' THEN 'wire_transfer'
                WHEN 'CRYPTO' THEN 'crypto'
                WHEN 'MOBILE_MONEY' THEN 'digital_wallet'
                WHEN 'MONEY_ORDER' THEN 'check'
                WHEN 'OTHER' THEN 'cash'
                ELSE 'cash'
            END
        )
    """)

    op.execute("""
        ALTER TABLE payment_methods
        ALTER COLUMN type TYPE paymentmethodtype USING type::paymentmethodtype
    """)

    op.execute("""
        ALTER TABLE payments
        ALTER COLUMN payment_method_type TYPE text USING (
            CASE payment_method_type::text
                WHEN 'ACH' THEN 'bank_account'
                WHEN 'BANK_TRANSFER' THEN 'bank_account'
                WHEN 'CASH' THEN 'cash'
                WHEN 'CHECK' THEN 'check'
                WHEN 'WIRE_TRANSFER' THEN 'wire_transfer'
                WHEN 'CRYPTO' THEN 'crypto'
                WHEN 'MOBILE_MONEY' THEN 'digital_wallet'
                WHEN 'MONEY_ORDER' THEN 'check'
                WHEN 'OTHER' THEN 'cash'
                ELSE 'cash'
            END
        )
    """)

    op.execute("""
        ALTER TABLE payments
        ALTER COLUMN payment_method_type TYPE paymentmethodtype USING payment_method_type::paymentmethodtype
    """)

    op.execute("DROP TYPE paymentmethodtype_old")

    # Fix PaymentStatus enum
    # Database has: PENDING, PROCESSING, SUCCEEDED, FAILED, REFUNDED, PARTIALLY_REFUNDED, CANCELLED
    # Python needs: pending, processing, succeeded, failed, refunded, partially_refunded, cancelled

    op.execute("ALTER TYPE paymentstatus RENAME TO paymentstatus_old")

    op.execute("""
        CREATE TYPE paymentstatus AS ENUM (
            'pending',
            'processing',
            'succeeded',
            'failed',
            'refunded',
            'partially_refunded',
            'cancelled'
        )
    """)

    # Convert columns: invoices.payment_status, license_orders.payment_status, payments.status

    op.execute("""
        ALTER TABLE invoices
        ALTER COLUMN payment_status TYPE text USING lower(payment_status::text)
    """)

    op.execute("""
        ALTER TABLE invoices
        ALTER COLUMN payment_status TYPE paymentstatus USING payment_status::paymentstatus
    """)

    op.execute("""
        ALTER TABLE license_orders
        ALTER COLUMN payment_status TYPE text USING lower(payment_status::text)
    """)

    op.execute("""
        ALTER TABLE license_orders
        ALTER COLUMN payment_status TYPE paymentstatus USING payment_status::paymentstatus
    """)

    op.execute("""
        ALTER TABLE payments
        ALTER COLUMN status TYPE text USING lower(status::text)
    """)

    op.execute("""
        ALTER TABLE payments
        ALTER COLUMN status TYPE paymentstatus USING status::paymentstatus
    """)

    op.execute("DROP TYPE paymentstatus_old")

    # Fix InvoiceStatus enum
    # Database has: DRAFT, OPEN, PAID, VOID, OVERDUE, PARTIALLY_PAID
    # Python needs: draft, open, paid, void, overdue, partially_paid

    op.execute("ALTER TYPE invoicestatus RENAME TO invoicestatus_old")

    op.execute("""
        CREATE TYPE invoicestatus AS ENUM (
            'draft',
            'open',
            'paid',
            'void',
            'overdue',
            'partially_paid'
        )
    """)

    # Convert columns: invoices.status

    op.execute("""
        ALTER TABLE invoices
        ALTER COLUMN status TYPE text USING lower(status::text)
    """)

    op.execute("""
        ALTER TABLE invoices
        ALTER COLUMN status TYPE invoicestatus USING status::invoicestatus
    """)

    op.execute("DROP TYPE invoicestatus_old")


def downgrade() -> None:
    """Revert enum changes back to UPPERCASE values."""

    # Revert InvoiceStatus
    op.execute("ALTER TYPE invoicestatus RENAME TO invoicestatus_new")

    op.execute("""
        CREATE TYPE invoicestatus AS ENUM (
            'DRAFT',
            'OPEN',
            'PAID',
            'VOID',
            'OVERDUE',
            'PARTIALLY_PAID'
        )
    """)

    op.execute("""
        ALTER TABLE invoices
        ALTER COLUMN status TYPE text USING upper(status::text)
    """)

    op.execute("""
        ALTER TABLE invoices
        ALTER COLUMN status TYPE invoicestatus USING status::invoicestatus
    """)

    op.execute("DROP TYPE invoicestatus_new")

    # Revert PaymentStatus
    op.execute("ALTER TYPE paymentstatus RENAME TO paymentstatus_new")

    op.execute("""
        CREATE TYPE paymentstatus AS ENUM (
            'PENDING',
            'PROCESSING',
            'SUCCEEDED',
            'FAILED',
            'REFUNDED',
            'PARTIALLY_REFUNDED',
            'CANCELLED'
        )
    """)

    op.execute("""
        ALTER TABLE payments
        ALTER COLUMN status TYPE text USING upper(status::text)
    """)

    op.execute("""
        ALTER TABLE payments
        ALTER COLUMN status TYPE paymentstatus USING status::paymentstatus
    """)

    op.execute("""
        ALTER TABLE license_orders
        ALTER COLUMN payment_status TYPE text USING upper(payment_status::text)
    """)

    op.execute("""
        ALTER TABLE license_orders
        ALTER COLUMN payment_status TYPE paymentstatus USING payment_status::paymentstatus
    """)

    op.execute("""
        ALTER TABLE invoices
        ALTER COLUMN payment_status TYPE text USING upper(payment_status::text)
    """)

    op.execute("""
        ALTER TABLE invoices
        ALTER COLUMN payment_status TYPE paymentstatus USING payment_status::paymentstatus
    """)

    op.execute("DROP TYPE paymentstatus_new")

    # Revert PaymentMethodType
    op.execute("ALTER TYPE paymentmethodtype RENAME TO paymentmethodtype_new")

    op.execute("""
        CREATE TYPE paymentmethodtype AS ENUM (
            'ACH',
            'BANK_TRANSFER',
            'CASH',
            'CHECK',
            'CRYPTO',
            'MOBILE_MONEY',
            'MONEY_ORDER',
            'OTHER',
            'WIRE_TRANSFER'
        )
    """)

    # Reverse mapping
    op.execute("""
        ALTER TABLE payments
        ALTER COLUMN payment_method_type TYPE text USING (
            CASE payment_method_type::text
                WHEN 'cash' THEN 'CASH'
                WHEN 'check' THEN 'CHECK'
                WHEN 'bank_account' THEN 'ACH'
                WHEN 'wire_transfer' THEN 'WIRE_TRANSFER'
                WHEN 'crypto' THEN 'CRYPTO'
                WHEN 'digital_wallet' THEN 'MOBILE_MONEY'
                WHEN 'card' THEN 'OTHER'
                ELSE 'CASH'
            END
        )
    """)

    op.execute("""
        ALTER TABLE payments
        ALTER COLUMN payment_method_type TYPE paymentmethodtype USING payment_method_type::paymentmethodtype
    """)

    op.execute("""
        ALTER TABLE payment_methods
        ALTER COLUMN type TYPE text USING (
            CASE type::text
                WHEN 'cash' THEN 'CASH'
                WHEN 'check' THEN 'CHECK'
                WHEN 'bank_account' THEN 'ACH'
                WHEN 'wire_transfer' THEN 'WIRE_TRANSFER'
                WHEN 'crypto' THEN 'CRYPTO'
                WHEN 'digital_wallet' THEN 'MOBILE_MONEY'
                WHEN 'card' THEN 'OTHER'
                ELSE 'CASH'
            END
        )
    """)

    op.execute("""
        ALTER TABLE payment_methods
        ALTER COLUMN type TYPE paymentmethodtype USING type::paymentmethodtype
    """)

    op.execute("""
        ALTER TABLE manual_payments
        ALTER COLUMN payment_method TYPE text USING (
            CASE payment_method::text
                WHEN 'cash' THEN 'CASH'
                WHEN 'check' THEN 'CHECK'
                WHEN 'bank_account' THEN 'ACH'
                WHEN 'wire_transfer' THEN 'WIRE_TRANSFER'
                WHEN 'crypto' THEN 'CRYPTO'
                WHEN 'digital_wallet' THEN 'MOBILE_MONEY'
                WHEN 'card' THEN 'OTHER'
                ELSE 'CASH'
            END
        )
    """)

    op.execute("""
        ALTER TABLE manual_payments
        ALTER COLUMN payment_method TYPE paymentmethodtype USING payment_method::paymentmethodtype
    """)

    op.execute("DROP TYPE paymentmethodtype_new")

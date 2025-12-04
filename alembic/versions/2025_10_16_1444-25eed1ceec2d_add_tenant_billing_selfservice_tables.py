"""add_tenant_billing_selfservice_tables

Revision ID: 25eed1ceec2d
Revises: 9c3d4e5f6a7b
Create Date: 2025-10-16 14:44:26.194442

Adds tables for tenant self-service billing:
- billing_addons: Add-ons catalog
- billing_tenant_addons: Tenant purchased add-ons
- billing_payment_methods: Payment methods (cards, bank accounts)
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "25eed1ceec2d"
down_revision = "9c3d4e5f6a7b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ============================================================================
    # Create Enums (skip if already exist)
    # ============================================================================

    # Create enums only if they don't exist
    conn = op.get_bind()

    # Check and create addon_type_enum
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'addon_type_enum')"))
    if not result.scalar():
        op.execute("CREATE TYPE addon_type_enum AS ENUM ('feature', 'resource', 'service', 'user_seats', 'integration')")

    # Check and create addon_billing_type_enum
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'addon_billing_type_enum')"))
    if not result.scalar():
        op.execute("CREATE TYPE addon_billing_type_enum AS ENUM ('one_time', 'recurring', 'metered')")

    # Check and create addon_status_enum
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'addon_status_enum')"))
    if not result.scalar():
        op.execute("CREATE TYPE addon_status_enum AS ENUM ('active', 'canceled', 'ended', 'suspended')")

    # Check and create payment_method_type_enum
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type_enum')"))
    if not result.scalar():
        op.execute("CREATE TYPE payment_method_type_enum AS ENUM ('card', 'bank_account', 'wallet', 'wire_transfer', 'check')")

    # Check and create payment_method_status_enum
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_status_enum')"))
    if not result.scalar():
        op.execute("CREATE TYPE payment_method_status_enum AS ENUM ('active', 'pending_verification', 'verification_failed', 'expired', 'inactive')")

    # Check and create card_brand_enum
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_brand_enum')"))
    if not result.scalar():
        op.execute("CREATE TYPE card_brand_enum AS ENUM ('visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay', 'unknown')")

    # ============================================================================
    # Create billing_addons table (Add-ons catalog)
    # ============================================================================

    op.create_table(
        "billing_addons",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("addon_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "addon_type",
            postgresql.ENUM(
                "feature",
                "resource",
                "service",
                "user_seats",
                "integration",
                name="addon_type_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "billing_type",
            postgresql.ENUM(
                "one_time", "recurring", "metered", name="addon_billing_type_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        # Pricing
        sa.Column("price", sa.Numeric(precision=19, scale=4), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("setup_fee", sa.Numeric(precision=19, scale=4), nullable=True),
        # Quantity configuration
        sa.Column("is_quantity_based", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("min_quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("max_quantity", sa.Integer(), nullable=True),
        # Metered billing
        sa.Column("metered_unit", sa.String(length=50), nullable=True),
        sa.Column("included_quantity", sa.Integer(), nullable=True),
        # Availability
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
        # Plan compatibility
        sa.Column(
            "compatible_with_all_plans", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column("compatible_plan_ids", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        # Metadata
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("icon", sa.String(length=255), nullable=True),
        sa.Column("features", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("addon_id"),
    )

    # Create indexes for billing_addons
    op.create_index("ix_billing_addons_addon_id", "billing_addons", ["addon_id"])
    op.create_index("ix_billing_addons_is_active", "billing_addons", ["is_active"])
    op.create_index("ix_billing_addons_addon_type", "billing_addons", ["addon_type"])
    op.create_index("ix_billing_addons_is_featured", "billing_addons", ["is_featured"])

    # ============================================================================
    # Create billing_tenant_addons table (Tenant purchased add-ons)
    # ============================================================================

    op.create_table(
        "billing_tenant_addons",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_addon_id", sa.String(length=255), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("addon_id", sa.String(length=255), nullable=False),
        # Subscription association
        sa.Column("subscription_id", sa.String(length=255), nullable=True),
        # Current state
        sa.Column(
            "status",
            postgresql.ENUM(
                "active", "canceled", "ended", "suspended", name="addon_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        # Billing dates
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        # Usage tracking
        sa.Column("current_usage", sa.Integer(), nullable=False, server_default="0"),
        # Metadata
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_addon_id"),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_billing_tenant_addons_tenant_id",
            ondelete="CASCADE",
        ),
    )

    # Create indexes for billing_tenant_addons
    op.create_index("ix_billing_tenant_addons_tenant_addon_id", "billing_tenant_addons", ["tenant_addon_id"])
    op.create_index("ix_billing_tenant_addons_tenant_id", "billing_tenant_addons", ["tenant_id"])
    op.create_index("ix_billing_tenant_addons_addon_id", "billing_tenant_addons", ["addon_id"])
    op.create_index("ix_billing_tenant_addons_status", "billing_tenant_addons", ["status"])
    op.create_index(
        "ix_billing_tenant_addons_tenant_status",
        "billing_tenant_addons",
        ["tenant_id", "status"],
    )

    # ============================================================================
    # Create billing_payment_methods table
    # ============================================================================

    op.create_table(
        "billing_payment_methods",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("payment_method_id", sa.String(length=255), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        # Basic information
        sa.Column(
            "method_type",
            postgresql.ENUM(
                "card",
                "bank_account",
                "wallet",
                "wire_transfer",
                "check",
                name="payment_method_type_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "pending_verification",
                "verification_failed",
                "expired",
                "inactive",
                name="payment_method_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        # Card-specific fields
        sa.Column(
            "card_brand",
            postgresql.ENUM(
                "visa",
                "mastercard",
                "amex",
                "discover",
                "diners",
                "jcb",
                "unionpay",
                "unknown",
                name="card_brand_enum",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("card_last4", sa.String(length=4), nullable=True),
        sa.Column("card_exp_month", sa.Integer(), nullable=True),
        sa.Column("card_exp_year", sa.Integer(), nullable=True),
        sa.Column("card_fingerprint", sa.String(length=255), nullable=True),
        # Bank account-specific fields
        sa.Column("bank_name", sa.String(length=255), nullable=True),
        sa.Column("bank_account_last4", sa.String(length=4), nullable=True),
        sa.Column("bank_routing_number", sa.String(length=20), nullable=True),
        sa.Column("bank_account_type", sa.String(length=50), nullable=True),
        # Wallet-specific fields
        sa.Column("wallet_type", sa.String(length=50), nullable=True),
        # Billing details
        sa.Column("billing_name", sa.String(length=255), nullable=True),
        sa.Column("billing_email", sa.String(length=255), nullable=True),
        sa.Column("billing_phone", sa.String(length=50), nullable=True),
        # Billing address
        sa.Column("billing_address_line1", sa.String(length=255), nullable=True),
        sa.Column("billing_address_line2", sa.String(length=255), nullable=True),
        sa.Column("billing_city", sa.String(length=100), nullable=True),
        sa.Column("billing_state", sa.String(length=100), nullable=True),
        sa.Column("billing_postal_code", sa.String(length=20), nullable=True),
        sa.Column("billing_country", sa.String(length=2), nullable=False, server_default="US"),
        # Gateway integration
        sa.Column("gateway_customer_id", sa.String(length=255), nullable=True),
        sa.Column("gateway_payment_method_id", sa.String(length=255), nullable=True),
        sa.Column("gateway_provider", sa.String(length=50), nullable=True),
        # Verification
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        # Metadata
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("payment_method_id"),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_billing_payment_methods_tenant_id",
            ondelete="CASCADE",
        ),
    )

    # Create indexes for billing_payment_methods
    op.create_index(
        "ix_billing_payment_methods_payment_method_id",
        "billing_payment_methods",
        ["payment_method_id"],
    )
    op.create_index("ix_billing_payment_methods_tenant_id", "billing_payment_methods", ["tenant_id"])
    op.create_index("ix_billing_payment_methods_status", "billing_payment_methods", ["status"])
    op.create_index(
        "ix_billing_payment_methods_tenant_default",
        "billing_payment_methods",
        ["tenant_id", "is_default"],
    )
    op.create_index(
        "ix_billing_payment_methods_gateway_customer",
        "billing_payment_methods",
        ["gateway_customer_id"],
    )
    op.create_index(
        "ix_billing_payment_methods_card_fingerprint",
        "billing_payment_methods",
        ["card_fingerprint"],
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("billing_payment_methods")
    op.drop_table("billing_tenant_addons")
    op.drop_table("billing_addons")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS card_brand_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS payment_method_status_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS payment_method_type_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS addon_status_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS addon_billing_type_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS addon_type_enum CASCADE")

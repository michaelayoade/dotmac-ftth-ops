"""Add partner management tables and foreign keys

Revision ID: 364eab9b9915
Revises: 7f4b9f1cee2c
Create Date: 2025-10-09 05:11:35.200239

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "364eab9b9915"
down_revision = "7f4b9f1cee2c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    partner_status_enum = postgresql.ENUM(
        "pending",
        "active",
        "suspended",
        "terminated",
        "archived",
        name="partnerstatus",
        create_type=False,
    )
    partner_status_enum.create(bind, checkfirst=True)

    partner_tier_enum = postgresql.ENUM(
        "bronze",
        "silver",
        "gold",
        "platinum",
        "direct",
        name="partnertier",
        create_type=False,
    )
    partner_tier_enum.create(bind, checkfirst=True)

    commission_model_enum = postgresql.ENUM(
        "revenue_share",
        "flat_fee",
        "tiered",
        "hybrid",
        name="commissionmodel",
        create_type=False,
    )
    commission_model_enum.create(bind, checkfirst=True)

    commission_status_enum = postgresql.ENUM(
        "pending",
        "approved",
        "paid",
        "clawback",
        "cancelled",
        name="commissionstatus",
        create_type=False,
    )
    commission_status_enum.create(bind, checkfirst=True)

    payout_status_enum = postgresql.ENUM(
        "pending",
        "ready",
        "processing",
        "completed",
        "failed",
        "cancelled",
        name="payoutstatus",
        create_type=False,
    )
    payout_status_enum.create(bind, checkfirst=True)

    referral_status_enum = postgresql.ENUM(
        "new",
        "contacted",
        "qualified",
        "converted",
        "lost",
        "invalid",
        name="referralstatus",
        create_type=False,
    )
    referral_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "partners",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("partner_number", sa.String(length=50), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", partner_status_enum, nullable=False),
        sa.Column("tier", partner_tier_enum, nullable=False),
        sa.Column("commission_model", commission_model_enum, nullable=False),
        sa.Column("default_commission_rate", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("primary_email", sa.String(length=255), nullable=False),
        sa.Column("billing_email", sa.String(length=255), nullable=True),
        sa.Column("support_email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("address_line1", sa.String(length=200), nullable=True),
        sa.Column("address_line2", sa.String(length=200), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("state_province", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("country", sa.String(length=2), nullable=True),
        sa.Column("tax_id", sa.String(length=50), nullable=True),
        sa.Column("vat_number", sa.String(length=50), nullable=True),
        sa.Column("business_registration", sa.String(length=100), nullable=True),
        sa.Column("sla_response_hours", sa.Integer(), nullable=True),
        sa.Column("sla_uptime_percentage", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("partnership_start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("partnership_end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_review_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_review_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_customers", sa.Integer(), nullable=False),
        sa.Column("total_revenue_generated", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("total_commissions_earned", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("total_commissions_paid", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("total_referrals", sa.Integer(), nullable=False),
        sa.Column("converted_referrals", sa.Integer(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("custom_fields", sa.JSON(), nullable=False),
        sa.Column("external_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("partner_number"),
        sa.UniqueConstraint("tenant_id", "partner_number", name="uq_tenant_partner_number"),
        sa.UniqueConstraint("tenant_id", "company_name", name="uq_tenant_company_name"),
    )
    op.create_index("ix_partners_company_name", "partners", ["company_name"])
    op.create_index("ix_partners_external_id", "partners", ["external_id"])
    op.create_index("ix_partners_partner_number", "partners", ["partner_number"])
    op.create_index("ix_partners_status", "partners", ["status"])
    op.create_index("ix_partners_tenant_id", "partners", ["tenant_id"])
    op.create_index("ix_partners_tier", "partners", ["tier"])
    op.create_index("ix_partner_status_tier", "partners", ["status", "tier"])
    op.create_index(
        "ix_partner_dates", "partners", ["partnership_start_date", "partnership_end_date"]
    )
    op.create_index(op.f("ix_partners_created_at"), "partners", ["created_at"])

    op.create_table(
        "partner_users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "partner_id",
            sa.UUID(),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_primary_contact", sa.Boolean(), nullable=False),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("partner_id", "email", name="uq_partner_user_email"),
    )
    op.create_index(op.f("ix_partner_users_email"), "partner_users", ["email"], unique=False)
    op.create_index(
        "ix_partner_user_partner", "partner_users", ["partner_id", "is_active"], unique=False
    )
    op.create_index(
        op.f("ix_partner_users_partner_id"), "partner_users", ["partner_id"], unique=False
    )
    op.create_index(
        op.f("ix_partner_users_tenant_id"), "partner_users", ["tenant_id"], unique=False
    )

    op.create_table(
        "partner_accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "partner_id",
            sa.UUID(),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "customer_id",
            sa.UUID(),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("engagement_type", sa.String(length=50), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("custom_commission_rate", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("partner_id", "customer_id", name="uq_partner_customer"),
    )
    op.create_index(
        "ix_partner_account_dates",
        "partner_accounts",
        ["partner_id", "start_date", "end_date"],
        unique=False,
    )
    op.create_index(
        "ix_partner_account_active",
        "partner_accounts",
        ["partner_id", "is_active"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_accounts_partner_id"),
        "partner_accounts",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_accounts_customer_id"),
        "partner_accounts",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_accounts_tenant_id"),
        "partner_accounts",
        ["tenant_id"],
        unique=False,
    )

    op.create_table(
        "partner_commission_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "partner_id",
            sa.UUID(),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rule_name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("commission_type", commission_model_enum, nullable=False),
        sa.Column("commission_rate", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("flat_fee_amount", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("tier_config", sa.JSON(), nullable=False),
        sa.Column("applies_to_products", sa.JSON(), nullable=True),
        sa.Column("applies_to_customers", sa.JSON(), nullable=True),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_commission_rule_partner_active",
        "partner_commission_rules",
        ["partner_id", "is_active"],
        unique=False,
    )
    op.create_index(
        "ix_commission_rule_dates",
        "partner_commission_rules",
        ["effective_from", "effective_to"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_commission_rules_partner_id"),
        "partner_commission_rules",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_commission_rules_tenant_id"),
        "partner_commission_rules",
        ["tenant_id"],
        unique=False,
    )

    op.create_table(
        "partner_payouts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "partner_id",
            sa.UUID(),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("total_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("commission_count", sa.Integer(), nullable=False),
        sa.Column("payment_reference", sa.String(length=255), nullable=True),
        sa.Column("payment_method", sa.String(length=50), nullable=False),
        sa.Column("status", payout_status_enum, nullable=False),
        sa.Column("payout_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_partner_payouts_partner_status",
        "partner_payouts",
        ["partner_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_partner_payouts_dates",
        "partner_payouts",
        ["payout_date", "period_start", "period_end"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_payouts_partner_id"),
        "partner_payouts",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_payouts_tenant_id"),
        "partner_payouts",
        ["tenant_id"],
        unique=False,
    )

    op.create_table(
        "partner_commission_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "partner_id",
            sa.UUID(),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invoice_id",
            sa.UUID(),
            sa.ForeignKey("invoices.invoice_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "customer_id",
            sa.UUID(),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("commission_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("base_amount", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("commission_rate", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("status", commission_status_enum, nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "payout_id",
            sa.UUID(),
            sa.ForeignKey("partner_payouts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_commission_event_partner_status",
        "partner_commission_events",
        ["partner_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_commission_event_dates",
        "partner_commission_events",
        ["event_date", "paid_at"],
        unique=False,
    )
    op.create_index(
        "ix_commission_event_payout",
        "partner_commission_events",
        ["payout_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_commission_events_partner_id"),
        "partner_commission_events",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_commission_events_invoice_id"),
        "partner_commission_events",
        ["invoice_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_commission_events_tenant_id"),
        "partner_commission_events",
        ["tenant_id"],
        unique=False,
    )

    op.create_table(
        "partner_referrals",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "partner_id",
            sa.UUID(),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("contact_name", sa.String(length=255), nullable=False),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("contact_phone", sa.String(length=30), nullable=True),
        sa.Column("estimated_value", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", referral_status_enum, nullable=False),
        sa.Column(
            "converted_customer_id",
            sa.UUID(),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("conversion_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_value", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("submitted_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_contact_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("qualified_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=100), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_referral_partner_status",
        "partner_referrals",
        ["partner_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_referral_dates",
        "partner_referrals",
        ["submitted_date", "conversion_date"],
        unique=False,
    )
    op.create_index(
        "ix_referral_email",
        "partner_referrals",
        ["contact_email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_referrals_partner_id"),
        "partner_referrals",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_partner_referrals_tenant_id"),
        "partner_referrals",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_partner_referrals_tenant_id"), table_name="partner_referrals")
    op.drop_index(op.f("ix_partner_referrals_partner_id"), table_name="partner_referrals")
    op.drop_index("ix_referral_email", table_name="partner_referrals")
    op.drop_index("ix_referral_dates", table_name="partner_referrals")
    op.drop_index("ix_referral_partner_status", table_name="partner_referrals")
    op.drop_table("partner_referrals")

    op.drop_index(
        op.f("ix_partner_commission_events_tenant_id"),
        table_name="partner_commission_events",
    )
    op.drop_index(
        op.f("ix_partner_commission_events_invoice_id"),
        table_name="partner_commission_events",
    )
    op.drop_index(
        op.f("ix_partner_commission_events_partner_id"),
        table_name="partner_commission_events",
    )
    op.drop_index("ix_commission_event_payout", table_name="partner_commission_events")
    op.drop_index("ix_commission_event_dates", table_name="partner_commission_events")
    op.drop_index("ix_commission_event_partner_status", table_name="partner_commission_events")
    op.drop_table("partner_commission_events")

    op.drop_index(op.f("ix_partner_payouts_tenant_id"), table_name="partner_payouts")
    op.drop_index(op.f("ix_partner_payouts_partner_id"), table_name="partner_payouts")
    op.drop_index("ix_partner_payouts_dates", table_name="partner_payouts")
    op.drop_index("ix_partner_payouts_partner_status", table_name="partner_payouts")
    op.drop_table("partner_payouts")

    op.drop_index(
        op.f("ix_partner_commission_rules_tenant_id"),
        table_name="partner_commission_rules",
    )
    op.drop_index(
        op.f("ix_partner_commission_rules_partner_id"),
        table_name="partner_commission_rules",
    )
    op.drop_index("ix_commission_rule_dates", table_name="partner_commission_rules")
    op.drop_index("ix_commission_rule_partner_active", table_name="partner_commission_rules")
    op.drop_table("partner_commission_rules")

    op.drop_index(op.f("ix_partner_accounts_tenant_id"), table_name="partner_accounts")
    op.drop_index(op.f("ix_partner_accounts_customer_id"), table_name="partner_accounts")
    op.drop_index(op.f("ix_partner_accounts_partner_id"), table_name="partner_accounts")
    op.drop_index("ix_partner_account_active", table_name="partner_accounts")
    op.drop_index("ix_partner_account_dates", table_name="partner_accounts")
    op.drop_table("partner_accounts")

    op.drop_index(op.f("ix_partner_users_tenant_id"), table_name="partner_users")
    op.drop_index(op.f("ix_partner_users_partner_id"), table_name="partner_users")
    op.drop_index("ix_partner_user_partner", table_name="partner_users")
    op.drop_index(op.f("ix_partner_users_email"), table_name="partner_users")
    op.drop_table("partner_users")

    op.drop_index(op.f("ix_partners_created_at"), table_name="partners")
    op.drop_index("ix_partner_dates", table_name="partners")
    op.drop_index("ix_partner_status_tier", table_name="partners")
    op.drop_index("ix_partners_tier", table_name="partners")
    op.drop_index("ix_partners_tenant_id", table_name="partners")
    op.drop_index("ix_partners_status", table_name="partners")
    op.drop_index("ix_partners_partner_number", table_name="partners")
    op.drop_index("ix_partners_external_id", table_name="partners")
    op.drop_index("ix_partners_company_name", table_name="partners")
    op.drop_table("partners")

    bind = op.get_bind()
    postgresql.ENUM(name="referralstatus").drop(bind, checkfirst=True)
    postgresql.ENUM(name="payoutstatus").drop(bind, checkfirst=True)
    postgresql.ENUM(name="commissionstatus").drop(bind, checkfirst=True)
    postgresql.ENUM(name="commissionmodel").drop(bind, checkfirst=True)
    postgresql.ENUM(name="partnertier").drop(bind, checkfirst=True)
    postgresql.ENUM(name="partnerstatus").drop(bind, checkfirst=True)

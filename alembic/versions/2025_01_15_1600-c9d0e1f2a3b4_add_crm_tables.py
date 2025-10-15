"""add_crm_tables

Revision ID: c9d0e1f2a3b4
Revises: b7c8d9e0f1a2
Create Date: 2025-01-15 16:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "c9d0e1f2a3b4"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create CRM tables for leads, quotes, and site surveys."""

    # Create enums
    op.execute(
        """
        CREATE TYPE leadstatus AS ENUM (
            'new', 'contacted', 'qualified', 'site_survey_scheduled',
            'site_survey_completed', 'quote_sent', 'negotiating',
            'won', 'lost', 'disqualified'
        )
    """
    )

    op.execute(
        """
        CREATE TYPE leadsource AS ENUM (
            'website', 'referral', 'partner', 'cold_call',
            'social_media', 'event', 'advertisement', 'walk_in', 'other'
        )
    """
    )

    op.execute(
        """
        CREATE TYPE quotestatus AS ENUM (
            'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'revised'
        )
    """
    )

    op.execute(
        """
        CREATE TYPE sitesurveystatus AS ENUM (
            'scheduled', 'in_progress', 'completed', 'failed', 'canceled'
        )
    """
    )

    op.execute(
        """
        CREATE TYPE serviceability AS ENUM (
            'serviceable', 'not_serviceable', 'pending_expansion', 'requires_construction'
        )
    """
    )

    # Create leads table
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("lead_number", sa.String(50), nullable=False, index=True),
        sa.Column(
            "status",
            postgresql.ENUM(name="leadstatus", create_type=False),
            nullable=False,
            server_default="new",
            index=True,
        ),
        sa.Column(
            "source",
            postgresql.ENUM(name="leadsource", create_type=False),
            nullable=False,
            server_default="website",
            index=True,
        ),
        sa.Column("priority", sa.Integer, nullable=False, server_default="3"),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, index=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("service_address_line1", sa.String(200), nullable=False),
        sa.Column("service_address_line2", sa.String(200), nullable=True),
        sa.Column("service_city", sa.String(100), nullable=False),
        sa.Column("service_state_province", sa.String(100), nullable=False),
        sa.Column("service_postal_code", sa.String(20), nullable=False),
        sa.Column("service_country", sa.String(2), nullable=False, server_default="US"),
        sa.Column("service_coordinates", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column(
            "is_serviceable",
            postgresql.ENUM(name="serviceability", create_type=False),
            nullable=True,
        ),
        sa.Column("serviceability_checked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("serviceability_notes", sa.Text, nullable=True),
        sa.Column("interested_service_types", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("desired_bandwidth", sa.String(50), nullable=True),
        sa.Column("estimated_monthly_budget", sa.Numeric(10, 2), nullable=True),
        sa.Column("desired_installation_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "assigned_to_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partners.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("qualified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("disqualified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("disqualification_reason", sa.Text, nullable=True),
        sa.Column("converted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "converted_to_customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("first_contact_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_contact_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("expected_close_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_unique_constraint("uq_lead_tenant_number", "leads", ["tenant_id", "lead_number"])
    op.create_index("ix_lead_status_priority", "leads", ["tenant_id", "status", "priority"])
    op.create_index("ix_lead_assigned", "leads", ["assigned_to_id"])

    # Create quotes table
    op.create_table(
        "quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("quote_number", sa.String(50), nullable=False, index=True),
        sa.Column(
            "status",
            postgresql.ENUM(name="quotestatus", create_type=False),
            nullable=False,
            server_default="draft",
            index=True,
        ),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("service_plan_name", sa.String(200), nullable=False),
        sa.Column("bandwidth", sa.String(50), nullable=False),
        sa.Column("monthly_recurring_charge", sa.Numeric(10, 2), nullable=False),
        sa.Column("installation_fee", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("equipment_fee", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("activation_fee", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("total_upfront_cost", sa.Numeric(10, 2), nullable=False),
        sa.Column("contract_term_months", sa.Integer, nullable=False, server_default="12"),
        sa.Column("early_termination_fee", sa.Numeric(10, 2), nullable=True),
        sa.Column("promo_discount_months", sa.Integer, nullable=True),
        sa.Column("promo_monthly_discount", sa.Numeric(10, 2), nullable=True),
        sa.Column("valid_until", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("viewed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("signature_data", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("line_items", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("metadata", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_unique_constraint("uq_quote_tenant_number", "quotes", ["tenant_id", "quote_number"])
    op.create_index("ix_quote_valid_until", "quotes", ["valid_until"])

    # Create site_surveys table
    op.create_table(
        "site_surveys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("survey_number", sa.String(50), nullable=False, index=True),
        sa.Column(
            "status",
            postgresql.ENUM(name="sitesurveystatus", create_type=False),
            nullable=False,
            server_default="scheduled",
            index=True,
        ),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("scheduled_date", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("completed_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "technician_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "serviceability",
            postgresql.ENUM(name="serviceability", create_type=False),
            nullable=True,
        ),
        sa.Column("nearest_fiber_distance_meters", sa.Integer, nullable=True),
        sa.Column("requires_fiber_extension", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("fiber_extension_cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("nearest_olt_id", sa.String(100), nullable=True),
        sa.Column("available_pon_ports", sa.Integer, nullable=True),
        sa.Column("estimated_installation_time_hours", sa.Integer, nullable=True),
        sa.Column(
            "special_equipment_required", postgresql.JSON, nullable=False, server_default="[]"
        ),
        sa.Column("installation_complexity", sa.String(20), nullable=True),
        sa.Column("photos", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("recommendations", sa.Text, nullable=True),
        sa.Column("obstacles", sa.Text, nullable=True),
        sa.Column("metadata", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_unique_constraint(
        "uq_survey_tenant_number", "site_surveys", ["tenant_id", "survey_number"]
    )
    op.create_index("ix_survey_scheduled", "site_surveys", ["scheduled_date"])
    op.create_index("ix_survey_technician", "site_surveys", ["technician_id"])


def downgrade() -> None:
    """Drop CRM tables and enums."""

    op.drop_table("site_surveys")
    op.drop_table("quotes")
    op.drop_table("leads")

    op.execute("DROP TYPE IF EXISTS serviceability")
    op.execute("DROP TYPE IF EXISTS sitesurveystatus")
    op.execute("DROP TYPE IF EXISTS quotestatus")
    op.execute("DROP TYPE IF EXISTS leadsource")
    op.execute("DROP TYPE IF EXISTS leadstatus")

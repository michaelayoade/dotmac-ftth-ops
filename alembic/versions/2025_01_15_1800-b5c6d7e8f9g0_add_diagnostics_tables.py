"""add_diagnostics_tables

Revision ID: b5c6d7e8f9g0
Revises: e1f2g3h4i5j6
Create Date: 2025-01-15 18:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "b5c6d7e8f9g0"
down_revision = "e1f2g3h4i5j6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create diagnostics tables."""

    # Create DiagnosticType enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE diagnostictype AS ENUM (
                'connectivity_check',
                'ping_test',
                'traceroute',
                'radius_session',
                'onu_status',
                'cpe_status',
                'ip_verification',
                'bandwidth_test',
                'latency_test',
                'packet_loss_test',
                'cpe_restart',
                'onu_reboot',
                'health_check',
                'service_path_trace'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """
    )

    # Create DiagnosticStatus enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE diagnosticstatus AS ENUM (
                'pending',
                'running',
                'completed',
                'failed',
                'timeout'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """
    )

    # Create DiagnosticSeverity enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE diagnosticseverity AS ENUM (
                'info',
                'warning',
                'error',
                'critical'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """
    )

    # Create diagnostic_runs table
    op.create_table(
        "diagnostic_runs",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        # Tenant isolation
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # Diagnostic info
        sa.Column(
            "diagnostic_type",
            postgresql.ENUM(name="diagnostictype", create_type=False),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(name="diagnosticstatus", create_type=False),
            nullable=False,
            server_default="pending",
            index=True,
        ),
        sa.Column(
            "severity",
            postgresql.ENUM(name="diagnosticseverity", create_type=False),
            nullable=True,
        ),
        # Target entity
        sa.Column(
            "subscriber_id",
            sa.String(255),
            sa.ForeignKey("subscribers.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # Execution details
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "completed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "duration_ms",
            sa.Integer,
            nullable=True,
        ),
        # Results
        sa.Column(
            "success",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "summary",
            sa.Text,
            nullable=True,
        ),
        sa.Column(
            "error_message",
            sa.Text,
            nullable=True,
        ),
        # Detailed results (JSON)
        sa.Column(
            "results",
            postgresql.JSON,
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "recommendations",
            postgresql.JSON,
            nullable=False,
            server_default="[]",
        ),
        # Metadata
        sa.Column(
            "metadata",
            postgresql.JSON,
            nullable=False,
            server_default="{}",
        ),
        # Timestamps
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
        # Soft delete
        sa.Column(
            "deleted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        # Audit fields
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "updated_by_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # Create indexes
    op.create_index(
        "ix_diagnostic_runs_tenant_type",
        "diagnostic_runs",
        ["tenant_id", "diagnostic_type"],
    )
    op.create_index(
        "ix_diagnostic_runs_tenant_status",
        "diagnostic_runs",
        ["tenant_id", "status"],
    )
    op.create_index(
        "ix_diagnostic_runs_subscriber",
        "diagnostic_runs",
        ["subscriber_id", "created_at"],
    )
    op.create_index(
        "ix_diagnostic_runs_created_at",
        "diagnostic_runs",
        ["created_at"],
    )


def downgrade() -> None:
    """Drop diagnostics tables and enums."""

    # Drop table
    op.drop_table("diagnostic_runs")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS diagnostictype")
    op.execute("DROP TYPE IF EXISTS diagnosticstatus")
    op.execute("DROP TYPE IF EXISTS diagnosticseverity")

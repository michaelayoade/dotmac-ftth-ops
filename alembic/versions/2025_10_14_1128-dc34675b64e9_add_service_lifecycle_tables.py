"""add_service_lifecycle_tables

Revision ID: dc34675b64e9
Revises: 2ee94a91ad86
Create Date: 2025-10-14 11:28:15.368480

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "dc34675b64e9"
down_revision = "2ee94a91ad86"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add service lifecycle management tables."""

    # Create ServiceType enum (with checkfirst to avoid duplicate errors)
    service_type_enum = sa.Enum(
        "fiber_internet",
        "dsl_internet",
        "cable_internet",
        "wireless_internet",
        "satellite_internet",
        "voip",
        "pstn",
        "mobile",
        "iptv",
        "cable_tv",
        "static_ip",
        "email_hosting",
        "cloud_storage",
        "managed_wifi",
        "network_security",
        "triple_play",
        "double_play",
        "custom_bundle",
        name="servicetype",
    )
    service_type_enum.create(op.get_bind(), checkfirst=True)

    # Create ServiceStatus enum
    service_status_enum = sa.Enum(
        "pending",
        "provisioning",
        "provisioning_failed",
        "active",
        "suspended",
        "suspended_fraud",
        "degraded",
        "maintenance",
        "terminating",
        "terminated",
        "failed",
        name="servicestatus",
    )
    service_status_enum.create(op.get_bind(), checkfirst=True)

    # Create ProvisioningStatus enum
    provisioning_status_enum = sa.Enum(
        "pending",
        "validating",
        "allocating_resources",
        "configuring_equipment",
        "activating_service",
        "testing",
        "completed",
        "failed",
        "rolled_back",
        name="provisioningstatus",
    )
    provisioning_status_enum.create(op.get_bind(), checkfirst=True)

    # Create LifecycleEventType enum
    lifecycle_event_type_enum = sa.Enum(
        "provision_requested",
        "provision_started",
        "provision_completed",
        "provision_failed",
        "activation_requested",
        "activation_completed",
        "activation_failed",
        "modification_requested",
        "modification_completed",
        "modification_failed",
        "suspension_requested",
        "suspension_completed",
        "suspension_failed",
        "resumption_requested",
        "resumption_completed",
        "resumption_failed",
        "termination_requested",
        "termination_started",
        "termination_completed",
        "termination_failed",
        "status_changed",
        "health_check_completed",
        "maintenance_started",
        "maintenance_completed",
        "error_detected",
        "error_resolved",
        name="lifecycleeventtype",
    )
    lifecycle_event_type_enum.create(op.get_bind(), checkfirst=True)

    # Create service_instances table
    op.create_table(
        "service_instances",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=False),
        # Service identification
        sa.Column(
            "service_identifier",
            sa.String(length=100),
            unique=True,
            nullable=False,
            comment="Unique service identifier",
        ),
        sa.Column("service_name", sa.String(length=255), nullable=False, comment="Service name"),
        sa.Column(
            "service_type",
            postgresql.ENUM(name="servicetype", create_type=False),
            nullable=False,
            comment="Type of service",
        ),
        # Relationships
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Customer who owns this service",
        ),
        sa.Column(
            "subscription_id",
            sa.String(length=50),
            nullable=True,
            comment="Related billing subscription ID",
        ),
        sa.Column(
            "plan_id",
            sa.String(length=50),
            nullable=True,
            comment="Service plan/product ID",
        ),
        # Status
        sa.Column(
            "status",
            postgresql.ENUM(name="servicestatus", create_type=False),
            nullable=False,
            comment="Current status",
        ),
        sa.Column(
            "provisioning_status",
            postgresql.ENUM(name="provisioningstatus", create_type=False),
            nullable=True,
            comment="Provisioning workflow status",
        ),
        # Lifecycle dates
        sa.Column(
            "ordered_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="When service was ordered",
        ),
        sa.Column(
            "provisioning_started_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Provisioning start",
        ),
        sa.Column(
            "provisioned_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Provisioning completion",
        ),
        sa.Column(
            "activated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Service activation",
        ),
        sa.Column(
            "suspended_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Service suspension",
        ),
        sa.Column(
            "terminated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Service termination",
        ),
        # Configuration
        sa.Column(
            "service_config",
            postgresql.JSONB,
            nullable=False,
            server_default="{}",
            comment="Service configuration",
        ),
        # Installation
        sa.Column(
            "installation_address",
            sa.String(length=500),
            nullable=True,
            comment="Installation address",
        ),
        sa.Column(
            "installation_scheduled_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Scheduled installation date",
        ),
        sa.Column(
            "installation_completed_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Installation completion date",
        ),
        sa.Column(
            "installation_technician_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Assigned technician",
        ),
        # Network
        sa.Column(
            "equipment_assigned",
            postgresql.JSONB,
            nullable=False,
            server_default="[]",
            comment="Assigned equipment list",
        ),
        sa.Column("ip_address", sa.String(length=45), nullable=True, comment="IP address"),
        sa.Column("mac_address", sa.String(length=17), nullable=True, comment="MAC address"),
        sa.Column("vlan_id", sa.Integer(), nullable=True, comment="VLAN ID"),
        # Integration
        sa.Column(
            "external_service_id",
            sa.String(length=100),
            nullable=True,
            comment="External system ID",
        ),
        sa.Column(
            "network_element_id",
            sa.String(length=100),
            nullable=True,
            comment="Network element ID",
        ),
        # Suspension
        sa.Column("suspension_reason", sa.Text(), nullable=True, comment="Suspension reason"),
        sa.Column(
            "auto_resume_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Auto-resume date",
        ),
        # Termination
        sa.Column("termination_reason", sa.Text(), nullable=True, comment="Termination reason"),
        sa.Column(
            "termination_type",
            sa.String(length=50),
            nullable=True,
            comment="Termination type",
        ),
        # Health
        sa.Column(
            "last_health_check_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Last health check",
        ),
        sa.Column("health_status", sa.String(length=50), nullable=True, comment="Health status"),
        sa.Column(
            "uptime_percentage",
            sa.Float(),
            nullable=True,
            comment="Uptime percentage",
        ),
        # Workflow
        sa.Column("workflow_id", sa.String(length=100), nullable=True, comment="Workflow ID"),
        sa.Column(
            "retry_count", sa.Integer(), nullable=False, server_default="0", comment="Retry count"
        ),
        sa.Column(
            "max_retries", sa.Integer(), nullable=False, server_default="3", comment="Max retries"
        ),
        # Notifications
        sa.Column(
            "notification_sent",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="Notification sent",
        ),
        # Metadata
        sa.Column(
            "metadata",
            postgresql.JSONB,
            nullable=False,
            server_default="{}",
            comment="Metadata",
        ),
        sa.Column("notes", sa.Text(), nullable=True, comment="Internal notes"),
        # Audit fields
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        # Foreign keys
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["installation_technician_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for service_instances
    op.create_index(
        "ix_service_identifier", "service_instances", ["service_identifier"], unique=True
    )
    op.create_index("ix_service_tenant", "service_instances", ["tenant_id"])
    op.create_index("ix_service_customer", "service_instances", ["customer_id"])
    op.create_index("ix_service_type", "service_instances", ["service_type"])
    op.create_index("ix_service_status", "service_instances", ["status"])
    op.create_index(
        "ix_service_provisioning_status",
        "service_instances",
        ["provisioning_status"],
    )
    op.create_index("ix_service_subscription", "service_instances", ["subscription_id"])
    op.create_index("ix_service_provisioned_at", "service_instances", ["provisioned_at"])
    op.create_index("ix_service_activated_at", "service_instances", ["activated_at"])
    op.create_index("ix_service_terminated_at", "service_instances", ["terminated_at"])
    op.create_index("ix_service_health_check", "service_instances", ["last_health_check_at"])
    # Composite indexes
    op.create_index("ix_service_tenant_customer", "service_instances", ["tenant_id", "customer_id"])
    op.create_index("ix_service_tenant_status", "service_instances", ["tenant_id", "status"])
    op.create_index("ix_service_tenant_type", "service_instances", ["tenant_id", "service_type"])
    op.create_index(
        "ix_service_installation_scheduled",
        "service_instances",
        ["tenant_id", "installation_scheduled_date"],
    )

    # Create lifecycle_events table
    op.create_table(
        "lifecycle_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=False),
        # Relationships
        sa.Column(
            "service_instance_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Related service instance",
        ),
        # Event information
        sa.Column(
            "event_type",
            postgresql.ENUM(name="lifecycleeventtype", create_type=False),
            nullable=False,
            comment="Event type",
        ),
        sa.Column(
            "event_timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="Event timestamp",
        ),
        # Status transitions
        sa.Column(
            "previous_status",
            postgresql.ENUM(name="servicestatus", create_type=False),
            nullable=True,
            comment="Previous status",
        ),
        sa.Column(
            "new_status",
            postgresql.ENUM(name="servicestatus", create_type=False),
            nullable=True,
            comment="New status",
        ),
        # Event details
        sa.Column("description", sa.Text(), nullable=True, comment="Event description"),
        # Success tracking
        sa.Column(
            "success",
            sa.Boolean(),
            nullable=False,
            server_default="true",
            comment="Operation success",
        ),
        sa.Column("error_message", sa.Text(), nullable=True, comment="Error message"),
        sa.Column("error_code", sa.String(length=50), nullable=True, comment="Error code"),
        # Workflow tracking
        sa.Column("workflow_id", sa.String(length=100), nullable=True, comment="Workflow ID"),
        sa.Column("task_id", sa.String(length=100), nullable=True, comment="Task ID"),
        # Duration
        sa.Column("duration_seconds", sa.Float(), nullable=True, comment="Operation duration"),
        # User/System
        sa.Column(
            "triggered_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Triggering user",
        ),
        sa.Column(
            "triggered_by_system",
            sa.String(length=100),
            nullable=True,
            comment="Triggering system",
        ),
        # Event data
        sa.Column(
            "event_data",
            postgresql.JSONB,
            nullable=False,
            server_default="{}",
            comment="Event data",
        ),
        sa.Column(
            "external_system_response",
            postgresql.JSONB,
            nullable=True,
            comment="External system response",
        ),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        # Foreign keys
        sa.ForeignKeyConstraint(
            ["service_instance_id"], ["service_instances.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["triggered_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for lifecycle_events
    op.create_index("ix_lifecycle_service", "lifecycle_events", ["service_instance_id"])
    op.create_index("ix_lifecycle_event_type", "lifecycle_events", ["event_type"])
    op.create_index("ix_lifecycle_timestamp", "lifecycle_events", ["event_timestamp"])
    op.create_index("ix_lifecycle_success", "lifecycle_events", ["success"])
    op.create_index("ix_lifecycle_workflow", "lifecycle_events", ["workflow_id"])
    # Composite indexes
    op.create_index(
        "ix_lifecycle_service_tenant",
        "lifecycle_events",
        ["tenant_id", "service_instance_id"],
    )

    # Create provisioning_workflows table
    op.create_table(
        "provisioning_workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=False),
        # Workflow identification
        sa.Column(
            "workflow_id",
            sa.String(length=100),
            unique=True,
            nullable=False,
            comment="Workflow ID",
        ),
        sa.Column(
            "workflow_type",
            sa.String(length=50),
            nullable=False,
            comment="Workflow type",
        ),
        # Relationships
        sa.Column(
            "service_instance_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Related service instance",
        ),
        # Status
        sa.Column(
            "status",
            postgresql.ENUM(name="provisioningstatus", create_type=False),
            nullable=False,
            comment="Workflow status",
        ),
        # Steps
        sa.Column("total_steps", sa.Integer(), nullable=False, comment="Total steps"),
        sa.Column(
            "current_step",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Current step",
        ),
        sa.Column(
            "completed_steps",
            postgresql.JSONB,
            nullable=False,
            server_default="[]",
            comment="Completed steps",
        ),
        sa.Column(
            "failed_steps",
            postgresql.JSONB,
            nullable=False,
            server_default="[]",
            comment="Failed steps",
        ),
        # Execution
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Workflow start",
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Workflow completion",
        ),
        # Error handling
        sa.Column(
            "retry_count", sa.Integer(), nullable=False, server_default="0", comment="Retry count"
        ),
        sa.Column("last_error", sa.Text(), nullable=True, comment="Last error"),
        # Rollback
        sa.Column(
            "rollback_required",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="Rollback required",
        ),
        sa.Column(
            "rollback_completed",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="Rollback completed",
        ),
        # Configuration
        sa.Column(
            "workflow_config",
            postgresql.JSONB,
            nullable=False,
            server_default="{}",
            comment="Workflow config",
        ),
        sa.Column(
            "step_results",
            postgresql.JSONB,
            nullable=False,
            server_default="{}",
            comment="Step results",
        ),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        # Foreign keys
        sa.ForeignKeyConstraint(
            ["service_instance_id"], ["service_instances.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for provisioning_workflows
    op.create_index("ix_workflow_id", "provisioning_workflows", ["workflow_id"], unique=True)
    op.create_index("ix_workflow_service", "provisioning_workflows", ["service_instance_id"])
    op.create_index("ix_workflow_status", "provisioning_workflows", ["status"])
    op.create_index("ix_workflow_type", "provisioning_workflows", ["workflow_type"])
    # Composite indexes
    op.create_index(
        "ix_workflow_tenant_service",
        "provisioning_workflows",
        ["tenant_id", "service_instance_id"],
    )

    # Explicit commit for enum creation
    connection = op.get_bind()
    connection.commit()


def downgrade() -> None:
    """Remove service lifecycle management tables."""

    # Drop tables
    op.drop_table("provisioning_workflows")
    op.drop_table("lifecycle_events")
    op.drop_table("service_instances")

    # Drop enums
    sa.Enum(name="lifecycleeventtype").drop(op.get_bind())
    sa.Enum(name="provisioningstatus").drop(op.get_bind())
    sa.Enum(name="servicestatus").drop(op.get_bind())
    sa.Enum(name="servicetype").drop(op.get_bind())

    # Explicit commit
    connection = op.get_bind()
    connection.commit()

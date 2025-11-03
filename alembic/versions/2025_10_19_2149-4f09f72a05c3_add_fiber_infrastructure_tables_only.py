"""Add fiber infrastructure tables only

Revision ID: 4f09f72a05c3
Revises: c4d8e9f0a1b2
Create Date: 2025-10-19 21:49:20.276449

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "4f09f72a05c3"
down_revision = "c4d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create fiber_cables table
    op.create_table(
        "fiber_cables",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "cable_id",
            sa.String(length=50),
            nullable=False,
            comment="Unique cable identifier for operations",
        ),
        sa.Column(
            "name", sa.String(length=200), nullable=True, comment="Descriptive name for the cable"
        ),
        sa.Column(
            "fiber_type",
            sa.Enum("SINGLE_MODE", "MULTI_MODE", name="fibertype"),
            nullable=False,
            comment="Single-mode or multi-mode fiber",
        ),
        sa.Column(
            "fiber_count",
            sa.Integer(),
            nullable=False,
            comment="Number of fiber strands in the cable",
        ),
        sa.Column(
            "status",
            sa.Enum(
                "ACTIVE",
                "INACTIVE",
                "UNDER_CONSTRUCTION",
                "MAINTENANCE",
                "DAMAGED",
                "RETIRED",
                name="fibercablestatus",
            ),
            nullable=False,
            comment="Current operational status",
        ),
        sa.Column(
            "installation_type",
            sa.Enum("AERIAL", "UNDERGROUND", "DUCT", "DIRECT_BURIAL", name="cableinstallationtype"),
            nullable=True,
            comment="Method of cable installation",
        ),
        sa.Column(
            "start_site_id",
            sa.String(length=50),
            nullable=True,
            comment="Starting site/location identifier",
        ),
        sa.Column(
            "end_site_id",
            sa.String(length=50),
            nullable=True,
            comment="Ending site/location identifier",
        ),
        sa.Column(
            "length_km", sa.Float(), nullable=True, comment="Total cable length in kilometers"
        ),
        sa.Column(
            "route_geojson",
            sa.JSON(),
            nullable=True,
            comment="GeoJSON LineString representing cable route",
        ),
        sa.Column(
            "manufacturer", sa.String(length=100), nullable=True, comment="Cable manufacturer"
        ),
        sa.Column("model", sa.String(length=100), nullable=True, comment="Cable model number"),
        sa.Column(
            "installation_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date cable was installed",
        ),
        sa.Column(
            "warranty_expiry_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Warranty expiration date",
        ),
        sa.Column(
            "attenuation_db_per_km",
            sa.Float(),
            nullable=True,
            comment="Attenuation in dB per kilometer",
        ),
        sa.Column(
            "max_capacity",
            sa.Integer(),
            nullable=True,
            comment="Maximum number of services supported",
        ),
        sa.Column("notes", sa.Text(), nullable=True, comment="Additional notes and comments"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.CheckConstraint("fiber_count > 0", name="ck_fiber_cables_fiber_count_positive"),
        sa.CheckConstraint(
            "length_km IS NULL OR length_km > 0", name="ck_fiber_cables_length_positive"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_fiber_cables_cable_id"), "fiber_cables", ["cable_id"], unique=False)
    op.create_index(
        op.f("ix_fiber_cables_end_site_id"), "fiber_cables", ["end_site_id"], unique=False
    )
    op.create_index(
        op.f("ix_fiber_cables_fiber_type"), "fiber_cables", ["fiber_type"], unique=False
    )
    op.create_index(
        op.f("ix_fiber_cables_installation_type"),
        "fiber_cables",
        ["installation_type"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_cables_route", "fiber_cables", ["start_site_id", "end_site_id"], unique=False
    )
    op.create_index(
        op.f("ix_fiber_cables_start_site_id"), "fiber_cables", ["start_site_id"], unique=False
    )
    op.create_index(op.f("ix_fiber_cables_status"), "fiber_cables", ["status"], unique=False)
    op.create_index(
        "ix_fiber_cables_tenant_cable_id", "fiber_cables", ["tenant_id", "cable_id"], unique=True
    )
    op.create_index(
        "ix_fiber_cables_tenant_fiber_type",
        "fiber_cables",
        ["tenant_id", "fiber_type"],
        unique=False,
    )
    op.create_index(op.f("ix_fiber_cables_tenant_id"), "fiber_cables", ["tenant_id"], unique=False)
    op.create_index(
        "ix_fiber_cables_tenant_status", "fiber_cables", ["tenant_id", "status"], unique=False
    )

    # Create fiber_distribution_points table
    op.create_table(
        "fiber_distribution_points",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "point_id",
            sa.String(length=50),
            nullable=False,
            comment="Unique distribution point identifier",
        ),
        sa.Column(
            "point_type",
            sa.Enum("FDH", "FDT", "FAT", "SPLITTER", "PATCH_PANEL", name="distributionpointtype"),
            nullable=False,
            comment="Type of distribution point",
        ),
        sa.Column(
            "name",
            sa.String(length=200),
            nullable=True,
            comment="Descriptive name for the distribution point",
        ),
        sa.Column(
            "status",
            sa.Enum(
                "ACTIVE",
                "INACTIVE",
                "UNDER_CONSTRUCTION",
                "MAINTENANCE",
                "DAMAGED",
                "RETIRED",
                name="fibercablestatus",
            ),
            nullable=False,
            comment="Operational status",
        ),
        sa.Column(
            "site_id",
            sa.String(length=50),
            nullable=True,
            comment="Site identifier where point is located",
        ),
        sa.Column(
            "location_geojson",
            sa.JSON(),
            nullable=True,
            comment="GeoJSON Point representing distribution point location",
        ),
        sa.Column("address", sa.String(length=500), nullable=True, comment="Physical address"),
        sa.Column(
            "total_ports",
            sa.Integer(),
            nullable=True,
            comment="Total number of ports/connections available",
        ),
        sa.Column(
            "used_ports", sa.Integer(), nullable=False, comment="Number of ports currently in use"
        ),
        sa.Column(
            "manufacturer", sa.String(length=100), nullable=True, comment="Equipment manufacturer"
        ),
        sa.Column("model", sa.String(length=100), nullable=True, comment="Equipment model number"),
        sa.Column(
            "installation_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date equipment was installed",
        ),
        sa.Column("notes", sa.Text(), nullable=True, comment="Additional notes and comments"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.CheckConstraint(
            "total_ports IS NULL OR total_ports > 0",
            name="ck_distribution_points_total_ports_positive",
        ),
        sa.CheckConstraint(
            "total_ports IS NULL OR used_ports <= total_ports",
            name="ck_distribution_points_used_not_exceeds_total",
        ),
        sa.CheckConstraint(
            "used_ports >= 0", name="ck_distribution_points_used_ports_non_negative"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fiber_distribution_points_point_id"),
        "fiber_distribution_points",
        ["point_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_distribution_points_point_type"),
        "fiber_distribution_points",
        ["point_type"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_distribution_points_site", "fiber_distribution_points", ["site_id"], unique=False
    )
    op.create_index(
        op.f("ix_fiber_distribution_points_site_id"),
        "fiber_distribution_points",
        ["site_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_distribution_points_status"),
        "fiber_distribution_points",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_distribution_points_tenant_id"),
        "fiber_distribution_points",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_distribution_points_tenant_point_id",
        "fiber_distribution_points",
        ["tenant_id", "point_id"],
        unique=True,
    )
    op.create_index(
        "ix_fiber_distribution_points_tenant_status",
        "fiber_distribution_points",
        ["tenant_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_distribution_points_tenant_type",
        "fiber_distribution_points",
        ["tenant_id", "point_type"],
        unique=False,
    )

    # Create fiber_service_areas table
    op.create_table(
        "fiber_service_areas",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "area_id",
            sa.String(length=50),
            nullable=False,
            comment="Unique service area identifier",
        ),
        sa.Column("name", sa.String(length=200), nullable=False, comment="Service area name"),
        sa.Column(
            "area_type",
            sa.Enum("RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "MIXED", name="serviceareatype"),
            nullable=False,
            comment="Type of area (residential, commercial, etc.)",
        ),
        sa.Column(
            "coverage_geojson",
            sa.JSON(),
            nullable=True,
            comment="GeoJSON Polygon representing coverage boundary",
        ),
        sa.Column("postal_codes", sa.JSON(), nullable=True, comment="List of postal codes covered"),
        sa.Column(
            "is_serviceable",
            sa.Boolean(),
            nullable=False,
            comment="Whether area is currently serviceable",
        ),
        sa.Column(
            "construction_status",
            sa.String(length=50),
            nullable=True,
            comment="Construction phase (planned, under_construction, completed)",
        ),
        sa.Column(
            "go_live_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date area went live for service",
        ),
        sa.Column(
            "homes_passed", sa.Integer(), nullable=False, comment="Number of homes passed by fiber"
        ),
        sa.Column(
            "homes_connected",
            sa.Integer(),
            nullable=False,
            comment="Number of homes with active connections",
        ),
        sa.Column(
            "businesses_passed",
            sa.Integer(),
            nullable=False,
            comment="Number of businesses passed by fiber",
        ),
        sa.Column(
            "businesses_connected",
            sa.Integer(),
            nullable=False,
            comment="Number of businesses with active connections",
        ),
        sa.Column("notes", sa.Text(), nullable=True, comment="Additional notes and comments"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.CheckConstraint(
            "businesses_connected <= businesses_passed",
            name="ck_service_areas_businesses_connected_not_exceeds_passed",
        ),
        sa.CheckConstraint(
            "businesses_connected >= 0", name="ck_service_areas_businesses_connected_non_negative"
        ),
        sa.CheckConstraint(
            "businesses_passed >= 0", name="ck_service_areas_businesses_passed_non_negative"
        ),
        sa.CheckConstraint(
            "homes_connected <= homes_passed",
            name="ck_service_areas_homes_connected_not_exceeds_passed",
        ),
        sa.CheckConstraint(
            "homes_connected >= 0", name="ck_service_areas_homes_connected_non_negative"
        ),
        sa.CheckConstraint("homes_passed >= 0", name="ck_service_areas_homes_passed_non_negative"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fiber_service_areas_area_id"), "fiber_service_areas", ["area_id"], unique=False
    )
    op.create_index(
        op.f("ix_fiber_service_areas_area_type"), "fiber_service_areas", ["area_type"], unique=False
    )
    op.create_index(
        "ix_fiber_service_areas_construction",
        "fiber_service_areas",
        ["construction_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_service_areas_construction_status"),
        "fiber_service_areas",
        ["construction_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_service_areas_is_serviceable"),
        "fiber_service_areas",
        ["is_serviceable"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_service_areas_serviceable",
        "fiber_service_areas",
        ["is_serviceable"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_service_areas_tenant_area_id",
        "fiber_service_areas",
        ["tenant_id", "area_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_fiber_service_areas_tenant_id"), "fiber_service_areas", ["tenant_id"], unique=False
    )
    op.create_index(
        "ix_fiber_service_areas_tenant_type",
        "fiber_service_areas",
        ["tenant_id", "area_type"],
        unique=False,
    )

    # Create fiber_health_metrics table
    op.create_table(
        "fiber_health_metrics",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("cable_id", sa.UUID(), nullable=False, comment="Reference to fiber cable"),
        sa.Column(
            "measured_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="When metrics were measured",
        ),
        sa.Column(
            "health_status",
            sa.Enum("EXCELLENT", "GOOD", "FAIR", "DEGRADED", "CRITICAL", name="fiberhealthstatus"),
            nullable=False,
            comment="Overall health status",
        ),
        sa.Column(
            "health_score", sa.Float(), nullable=True, comment="Numerical health score (0-100)"
        ),
        sa.Column("total_loss_db", sa.Float(), nullable=True, comment="Total optical loss in dB"),
        sa.Column("splice_loss_db", sa.Float(), nullable=True, comment="Total splice loss in dB"),
        sa.Column(
            "connector_loss_db", sa.Float(), nullable=True, comment="Total connector loss in dB"
        ),
        sa.Column("detected_issues", sa.JSON(), nullable=True, comment="List of detected issues"),
        sa.Column("recommendations", sa.JSON(), nullable=True, comment="List of recommendations"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.CheckConstraint(
            "health_score IS NULL OR (health_score >= 0 AND health_score <= 100)",
            name="ck_health_metrics_score_range",
        ),
        sa.ForeignKeyConstraint(["cable_id"], ["fiber_cables.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fiber_health_metrics_cable_id"), "fiber_health_metrics", ["cable_id"], unique=False
    )
    op.create_index(
        "ix_fiber_health_metrics_cable_measured",
        "fiber_health_metrics",
        ["cable_id", "measured_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_health_metrics_health_status"),
        "fiber_health_metrics",
        ["health_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_health_metrics_measured_at"),
        "fiber_health_metrics",
        ["measured_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_health_metrics_tenant_id"),
        "fiber_health_metrics",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_health_metrics_tenant_status",
        "fiber_health_metrics",
        ["tenant_id", "health_status"],
        unique=False,
    )

    # Create fiber_otdr_test_results table
    op.create_table(
        "fiber_otdr_test_results",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("cable_id", sa.UUID(), nullable=False, comment="Reference to fiber cable"),
        sa.Column("strand_id", sa.Integer(), nullable=False, comment="Strand number being tested"),
        sa.Column(
            "test_date",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="When test was performed",
        ),
        sa.Column(
            "wavelength_nm",
            sa.Integer(),
            nullable=True,
            comment="Test wavelength in nanometers (e.g., 1310, 1550)",
        ),
        sa.Column(
            "pulse_width_ns", sa.Integer(), nullable=True, comment="Pulse width in nanoseconds"
        ),
        sa.Column("total_loss_db", sa.Float(), nullable=True, comment="Total measured loss in dB"),
        sa.Column(
            "length_km", sa.Float(), nullable=True, comment="Measured fiber length in kilometers"
        ),
        sa.Column(
            "events_detected", sa.Integer(), nullable=False, comment="Number of events detected"
        ),
        sa.Column(
            "events",
            sa.JSON(),
            nullable=True,
            comment="List of splice/connector events with details",
        ),
        sa.Column(
            "pass_fail", sa.Boolean(), nullable=True, comment="Whether test passed quality criteria"
        ),
        sa.Column(
            "tester_id",
            sa.String(length=50),
            nullable=True,
            comment="Identifier of person who performed test",
        ),
        sa.Column("notes", sa.Text(), nullable=True, comment="Additional test notes"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.CheckConstraint("events_detected >= 0", name="ck_otdr_test_results_events_non_negative"),
        sa.CheckConstraint("strand_id > 0", name="ck_otdr_test_results_strand_positive"),
        sa.ForeignKeyConstraint(["cable_id"], ["fiber_cables.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fiber_otdr_test_results_cable_id"),
        "fiber_otdr_test_results",
        ["cable_id"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_otdr_test_results_cable_strand",
        "fiber_otdr_test_results",
        ["cable_id", "strand_id"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_otdr_test_results_cable_test_date",
        "fiber_otdr_test_results",
        ["cable_id", "test_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_otdr_test_results_tenant_id"),
        "fiber_otdr_test_results",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_fiber_otdr_test_results_tenant_pass_fail",
        "fiber_otdr_test_results",
        ["tenant_id", "pass_fail"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_otdr_test_results_test_date"),
        "fiber_otdr_test_results",
        ["test_date"],
        unique=False,
    )

    # Create fiber_splice_points table
    op.create_table(
        "fiber_splice_points",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "splice_id",
            sa.String(length=50),
            nullable=False,
            comment="Unique splice point identifier",
        ),
        sa.Column("cable_id", sa.UUID(), nullable=False, comment="Reference to fiber cable"),
        sa.Column(
            "distribution_point_id",
            sa.UUID(),
            nullable=True,
            comment="Reference to distribution point (if applicable)",
        ),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "DEGRADED", "FAILED", "PENDING_TEST", name="splicestatus"),
            nullable=False,
            comment="Splice quality status",
        ),
        sa.Column(
            "splice_type",
            sa.String(length=50),
            nullable=True,
            comment="Type of splice (fusion, mechanical, etc.)",
        ),
        sa.Column(
            "location_geojson",
            sa.JSON(),
            nullable=True,
            comment="GeoJSON Point representing splice location",
        ),
        sa.Column(
            "enclosure_type",
            sa.String(length=50),
            nullable=True,
            comment="Type of splice enclosure",
        ),
        sa.Column(
            "insertion_loss_db", sa.Float(), nullable=True, comment="Splice insertion loss in dB"
        ),
        sa.Column("return_loss_db", sa.Float(), nullable=True, comment="Splice return loss in dB"),
        sa.Column(
            "last_test_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date of last quality test",
        ),
        sa.Column("notes", sa.Text(), nullable=True, comment="Additional notes and comments"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["cable_id"], ["fiber_cables.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["distribution_point_id"], ["fiber_distribution_points.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fiber_splice_points_cable_id"), "fiber_splice_points", ["cable_id"], unique=False
    )
    op.create_index(
        "ix_fiber_splice_points_cable_status",
        "fiber_splice_points",
        ["cable_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_splice_points_distribution_point_id"),
        "fiber_splice_points",
        ["distribution_point_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fiber_splice_points_splice_id"), "fiber_splice_points", ["splice_id"], unique=False
    )
    op.create_index(
        op.f("ix_fiber_splice_points_status"), "fiber_splice_points", ["status"], unique=False
    )
    op.create_index(
        op.f("ix_fiber_splice_points_tenant_id"), "fiber_splice_points", ["tenant_id"], unique=False
    )
    op.create_index(
        "ix_fiber_splice_points_tenant_splice_id",
        "fiber_splice_points",
        ["tenant_id", "splice_id"],
        unique=True,
    )
    op.create_index(
        "ix_fiber_splice_points_tenant_status",
        "fiber_splice_points",
        ["tenant_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    # Drop fiber tables in reverse order (respecting FK dependencies)
    op.drop_index("ix_fiber_splice_points_tenant_status", table_name="fiber_splice_points")
    op.drop_index("ix_fiber_splice_points_tenant_splice_id", table_name="fiber_splice_points")
    op.drop_index(op.f("ix_fiber_splice_points_tenant_id"), table_name="fiber_splice_points")
    op.drop_index(op.f("ix_fiber_splice_points_status"), table_name="fiber_splice_points")
    op.drop_index(op.f("ix_fiber_splice_points_splice_id"), table_name="fiber_splice_points")
    op.drop_index(
        op.f("ix_fiber_splice_points_distribution_point_id"), table_name="fiber_splice_points"
    )
    op.drop_index("ix_fiber_splice_points_cable_status", table_name="fiber_splice_points")
    op.drop_index(op.f("ix_fiber_splice_points_cable_id"), table_name="fiber_splice_points")
    op.drop_table("fiber_splice_points")

    op.drop_index(op.f("ix_fiber_otdr_test_results_test_date"), table_name="fiber_otdr_test_results")
    op.drop_index(
        "ix_fiber_otdr_test_results_tenant_pass_fail", table_name="fiber_otdr_test_results"
    )
    op.drop_index(op.f("ix_fiber_otdr_test_results_tenant_id"), table_name="fiber_otdr_test_results")
    op.drop_index(
        "ix_fiber_otdr_test_results_cable_test_date", table_name="fiber_otdr_test_results"
    )
    op.drop_index("ix_fiber_otdr_test_results_cable_strand", table_name="fiber_otdr_test_results")
    op.drop_index(op.f("ix_fiber_otdr_test_results_cable_id"), table_name="fiber_otdr_test_results")
    op.drop_table("fiber_otdr_test_results")

    op.drop_index("ix_fiber_health_metrics_tenant_status", table_name="fiber_health_metrics")
    op.drop_index(op.f("ix_fiber_health_metrics_tenant_id"), table_name="fiber_health_metrics")
    op.drop_index(op.f("ix_fiber_health_metrics_measured_at"), table_name="fiber_health_metrics")
    op.drop_index(op.f("ix_fiber_health_metrics_health_status"), table_name="fiber_health_metrics")
    op.drop_index("ix_fiber_health_metrics_cable_measured", table_name="fiber_health_metrics")
    op.drop_index(op.f("ix_fiber_health_metrics_cable_id"), table_name="fiber_health_metrics")
    op.drop_table("fiber_health_metrics")

    op.drop_index("ix_fiber_service_areas_tenant_type", table_name="fiber_service_areas")
    op.drop_index(op.f("ix_fiber_service_areas_tenant_id"), table_name="fiber_service_areas")
    op.drop_index("ix_fiber_service_areas_tenant_area_id", table_name="fiber_service_areas")
    op.drop_index("ix_fiber_service_areas_serviceable", table_name="fiber_service_areas")
    op.drop_index(op.f("ix_fiber_service_areas_is_serviceable"), table_name="fiber_service_areas")
    op.drop_index(
        op.f("ix_fiber_service_areas_construction_status"), table_name="fiber_service_areas"
    )
    op.drop_index("ix_fiber_service_areas_construction", table_name="fiber_service_areas")
    op.drop_index(op.f("ix_fiber_service_areas_area_type"), table_name="fiber_service_areas")
    op.drop_index(op.f("ix_fiber_service_areas_area_id"), table_name="fiber_service_areas")
    op.drop_table("fiber_service_areas")

    op.drop_index("ix_fiber_distribution_points_tenant_type", table_name="fiber_distribution_points")
    op.drop_index(
        "ix_fiber_distribution_points_tenant_status", table_name="fiber_distribution_points"
    )
    op.drop_index(
        "ix_fiber_distribution_points_tenant_point_id", table_name="fiber_distribution_points"
    )
    op.drop_index(op.f("ix_fiber_distribution_points_tenant_id"), table_name="fiber_distribution_points")
    op.drop_index(op.f("ix_fiber_distribution_points_status"), table_name="fiber_distribution_points")
    op.drop_index(op.f("ix_fiber_distribution_points_site_id"), table_name="fiber_distribution_points")
    op.drop_index("ix_fiber_distribution_points_site", table_name="fiber_distribution_points")
    op.drop_index(
        op.f("ix_fiber_distribution_points_point_type"), table_name="fiber_distribution_points"
    )
    op.drop_index(op.f("ix_fiber_distribution_points_point_id"), table_name="fiber_distribution_points")
    op.drop_table("fiber_distribution_points")

    op.drop_index("ix_fiber_cables_tenant_status", table_name="fiber_cables")
    op.drop_index(op.f("ix_fiber_cables_tenant_id"), table_name="fiber_cables")
    op.drop_index("ix_fiber_cables_tenant_fiber_type", table_name="fiber_cables")
    op.drop_index("ix_fiber_cables_tenant_cable_id", table_name="fiber_cables")
    op.drop_index(op.f("ix_fiber_cables_status"), table_name="fiber_cables")
    op.drop_index(op.f("ix_fiber_cables_start_site_id"), table_name="fiber_cables")
    op.drop_index("ix_fiber_cables_route", table_name="fiber_cables")
    op.drop_index(op.f("ix_fiber_cables_installation_type"), table_name="fiber_cables")
    op.drop_index(op.f("ix_fiber_cables_fiber_type"), table_name="fiber_cables")
    op.drop_index(op.f("ix_fiber_cables_end_site_id"), table_name="fiber_cables")
    op.drop_index(op.f("ix_fiber_cables_cable_id"), table_name="fiber_cables")
    op.drop_table("fiber_cables")

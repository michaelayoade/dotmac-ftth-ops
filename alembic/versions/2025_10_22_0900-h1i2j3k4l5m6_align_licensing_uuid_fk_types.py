"""align licensing uuid fk types

Revision ID: h1i2j3k4l5m6
Revises: g6h7i8j9k0l1
Create Date: 2025-10-22 09:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'h1i2j3k4l5m6'
down_revision: str | None = 'g6h7i8j9k0l1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _get_fk_name(inspector, table: str, column: str, referred_table: str) -> str | None:
    for fk in inspector.get_foreign_keys(table):
        if column in fk.get("constrained_columns", []) and fk.get("referred_table") == referred_table:
            return fk.get("name")
    return None


def _table_exists(inspector, table: str) -> bool:
    try:
        return inspector.has_table(table)
    except Exception:
        return False


def _upgrade_fk_to_uuid(
    table: str,
    column: str,
    referred_table: str,
    nullable: bool,
    ondelete: str | None = None,
) -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _table_exists(inspector, table):
        return

    existing_fk_name = _get_fk_name(inspector, table, column, referred_table)
    if existing_fk_name:
        op.drop_constraint(existing_fk_name, table, type_="foreignkey")
    fk_name = existing_fk_name or f"{table}_{column}_fkey"
    op.alter_column(
        table,
        column,
        existing_type=sa.String(length=36),
        type_=postgresql.UUID(as_uuid=True),
        existing_nullable=nullable,
        postgresql_using=f"{column}::uuid",
    )
    op.create_foreign_key(
        fk_name,
        source_table=table,
        referent_table=referred_table,
        local_cols=[column],
        remote_cols=["id"],
        ondelete=ondelete,
    )


def _downgrade_fk_to_string(
    table: str,
    column: str,
    referred_table: str,
    nullable: bool,
    ondelete: str | None = None,
) -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _table_exists(inspector, table):
        return

    existing_fk_name = _get_fk_name(inspector, table, column, referred_table)
    if existing_fk_name:
        op.drop_constraint(existing_fk_name, table, type_="foreignkey")
    fk_name = existing_fk_name or f"{table}_{column}_fkey"
    op.alter_column(
        table,
        column,
        existing_type=postgresql.UUID(as_uuid=True),
        type_=sa.String(length=36),
        existing_nullable=nullable,
        postgresql_using=f"{column}::text",
    )
    op.create_foreign_key(
        fk_name,
        source_table=table,
        referent_table=referred_table,
        local_cols=[column],
        remote_cols=["id"],
        ondelete=ondelete,
    )


def upgrade() -> None:
    """Align licensing foreign key columns with UUID types."""

    _upgrade_fk_to_uuid("plan_features", "plan_id", "subscription_plans", nullable=False, ondelete="CASCADE")
    _upgrade_fk_to_uuid("plan_quotas", "plan_id", "subscription_plans", nullable=False, ondelete="CASCADE")
    _upgrade_fk_to_uuid("tenant_subscriptions", "plan_id", "subscription_plans", nullable=False)
    _upgrade_fk_to_uuid(
        "tenant_feature_overrides",
        "subscription_id",
        "tenant_subscriptions",
        nullable=False,
        ondelete="CASCADE",
    )
    _upgrade_fk_to_uuid(
        "tenant_quota_usage",
        "subscription_id",
        "tenant_subscriptions",
        nullable=False,
        ondelete="CASCADE",
    )
    _upgrade_fk_to_uuid(
        "subscription_events",
        "subscription_id",
        "tenant_subscriptions",
        nullable=False,
    )
    _upgrade_fk_to_uuid(
        "licensing_subscription_modules",
        "subscription_id",
        "licensing_tenant_subscriptions",
        nullable=False,
        ondelete="CASCADE",
    )
    _upgrade_fk_to_uuid(
        "licensing_subscription_quota_usage",
        "subscription_id",
        "licensing_tenant_subscriptions",
        nullable=False,
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Revert licensing foreign key columns to string UUID storage."""

    _downgrade_fk_to_string(
        "licensing_subscription_quota_usage",
        "subscription_id",
        "licensing_tenant_subscriptions",
        nullable=False,
        ondelete="CASCADE",
    )
    _downgrade_fk_to_string(
        "licensing_subscription_modules",
        "subscription_id",
        "licensing_tenant_subscriptions",
        nullable=False,
        ondelete="CASCADE",
    )
    _downgrade_fk_to_string(
        "subscription_events",
        "subscription_id",
        "tenant_subscriptions",
        nullable=False,
    )
    _downgrade_fk_to_string(
        "tenant_quota_usage",
        "subscription_id",
        "tenant_subscriptions",
        nullable=False,
        ondelete="CASCADE",
    )
    _downgrade_fk_to_string(
        "tenant_feature_overrides",
        "subscription_id",
        "tenant_subscriptions",
        nullable=False,
        ondelete="CASCADE",
    )
    _downgrade_fk_to_string("tenant_subscriptions", "plan_id", "subscription_plans", nullable=False)
    _downgrade_fk_to_string("plan_quotas", "plan_id", "subscription_plans", nullable=False, ondelete="CASCADE")
    _downgrade_fk_to_string("plan_features", "plan_id", "subscription_plans", nullable=False, ondelete="CASCADE")
